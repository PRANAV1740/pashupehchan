"""Nose-print embedder.

Turns a nose photo into an L2-normalized fingerprint vector. A new animal is
enrolled simply by storing its vectors — no retraining — which is why identity
scales to any number of animals.

Two implementations:

* ``TorchBackboneEmbedder`` — a pretrained MobileNetV3 backbone (ImageNet
  features). This is the real product path: the same backbone is later
  fine-tuned on field nose photos with a metric-learning head. If torch is not
  installed, it is skipped.
* ``ClassicalEmbedder`` — a dependency-free fallback built from Pillow + numpy
  (multi-scale grayscale gradient histograms). It keeps the whole API runnable
  on any machine and during the first field visits before the model is trained.

``get_embedder()`` picks the best one available and caches it. The chosen
embedder's name is stored with every print so vectors from different embedders
are never compared.
"""
from __future__ import annotations

import io
from functools import lru_cache

import numpy as np
from PIL import Image, ImageOps


def _l2_normalize(v: np.ndarray) -> np.ndarray:
    n = float(np.linalg.norm(v))
    return v / n if n > 1e-8 else v


class Embedder:
    name: str = "base"
    dim: int = 0

    def embed(self, image_bytes: bytes) -> list[float]:  # pragma: no cover - interface
        raise NotImplementedError


class ClassicalEmbedder(Embedder):
    """Hand-built descriptor: gradient-orientation histograms over an image
    pyramid of the nose crop. Deterministic, fast, needs no ML runtime.

    It is not as discriminative as a trained CNN, but it is a genuine feature
    vector (not a hash) and is good enough to demonstrate within-household
    matching while the real model is being trained.
    """

    name = "classical-grad-v1"
    dim = 8 * 8 * 8  # cells x cells x orientation bins

    _SIDE = 128
    _CELLS = 8
    _BINS = 8

    def embed(self, image_bytes: bytes) -> list[float]:
        img = Image.open(io.BytesIO(image_bytes))
        img = ImageOps.exif_transpose(img).convert("L")
        img = ImageOps.autocontrast(img, cutoff=1)
        img = img.resize((self._SIDE, self._SIDE), Image.BILINEAR)
        arr = np.asarray(img, dtype=np.float32) / 255.0

        gx = np.zeros_like(arr)
        gy = np.zeros_like(arr)
        gx[:, 1:-1] = arr[:, 2:] - arr[:, :-2]
        gy[1:-1, :] = arr[2:, :] - arr[:-2, :]
        mag = np.sqrt(gx * gx + gy * gy)
        ang = (np.arctan2(gy, gx) + np.pi) % np.pi  # 0..pi (unsigned orientation)
        bins = np.minimum((ang / np.pi * self._BINS).astype(int), self._BINS - 1)

        cell = self._SIDE // self._CELLS
        feats = np.zeros((self._CELLS, self._CELLS, self._BINS), dtype=np.float32)
        for cy in range(self._CELLS):
            for cx in range(self._CELLS):
                ys, xs = slice(cy * cell, (cy + 1) * cell), slice(cx * cell, (cx + 1) * cell)
                m = mag[ys, xs].ravel()
                b = bins[ys, xs].ravel()
                hist = np.bincount(b, weights=m, minlength=self._BINS)
                # block-normalize so lighting/contrast changes matter less
                feats[cy, cx] = hist / (np.linalg.norm(hist) + 1e-6)
        return _l2_normalize(feats.ravel()).tolist()


class TorchBackboneEmbedder(Embedder):
    """Pretrained MobileNetV3-Large features (global-pooled, 960-d)."""

    name = "mobilenetv3-large-in1k"
    dim = 960

    def __init__(self) -> None:
        import torch
        from torchvision import transforms
        from torchvision.models import MobileNet_V3_Large_Weights, mobilenet_v3_large

        self._torch = torch
        weights = MobileNet_V3_Large_Weights.IMAGENET1K_V2
        model = mobilenet_v3_large(weights=weights)
        model.classifier = torch.nn.Identity()  # expose pooled features
        model.eval()
        self._model = model
        self._tf = transforms.Compose(
            [
                transforms.Resize(256),
                transforms.CenterCrop(224),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ]
        )

    def embed(self, image_bytes: bytes) -> list[float]:
        img = Image.open(io.BytesIO(image_bytes))
        img = ImageOps.exif_transpose(img).convert("RGB")
        x = self._tf(img).unsqueeze(0)
        with self._torch.no_grad():
            feat = self._model(x).squeeze(0).cpu().numpy().astype(np.float32)
        return _l2_normalize(feat).tolist()


@lru_cache
def get_embedder() -> Embedder:
    try:
        import torch  # noqa: F401
        import torchvision  # noqa: F401

        return TorchBackboneEmbedder()
    except Exception:
        return ClassicalEmbedder()
