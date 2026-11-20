"""Photo-quality gate.

Rejects blurred or badly-lit nose photos before they are enrolled or matched,
so a retake is asked for on capture rather than a bad vector polluting the
gallery. Runs on the raw bytes with Pillow + numpy only.
"""
from __future__ import annotations

import io

import numpy as np
from PIL import Image, ImageOps

from ..config import get_settings
from ..schemas import QualityReport


def _laplacian_variance(gray: np.ndarray) -> float:
    # 4-neighbour Laplacian; its variance is a standard sharpness proxy.
    lap = np.zeros_like(gray)
    lap[1:-1, 1:-1] = (
        gray[:-2, 1:-1] + gray[2:, 1:-1] + gray[1:-1, :-2] + gray[1:-1, 2:] - 4 * gray[1:-1, 1:-1]
    )
    return float(lap.var())


def assess_quality(image_bytes: bytes) -> QualityReport:
    s = get_settings()
    img = Image.open(io.BytesIO(image_bytes))
    img = ImageOps.exif_transpose(img).convert("L").resize((256, 256), Image.BILINEAR)
    gray = np.asarray(img, dtype=np.float32)

    sharpness = _laplacian_variance(gray)
    brightness = float(gray.mean())

    reason: str | None = None
    if sharpness < s.quality_min_sharpness:
        reason = "blurred"
    elif brightness < s.quality_min_brightness:
        reason = "too_dark"
    elif brightness > s.quality_max_brightness:
        reason = "too_bright"

    return QualityReport(ok=reason is None, sharpness=round(sharpness, 1), brightness=round(brightness, 1), reason=reason)
