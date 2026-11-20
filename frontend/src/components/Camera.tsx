import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../i18n";

interface Props {
  tip?: string;
  captureLabel?: string;
  onCapture: (blob: Blob, previewUrl: string) => void;
}

/**
 * Camera with a guided oval for the nose. Uses the rear camera when available
 * and falls back to a file picker (so the app is demoable on a laptop and can
 * be fed saved dataset photos). Capture draws the current frame to a canvas and
 * returns a JPEG blob.
 */
export default function Camera({ tip, captureLabel, onCapture }: Props) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((tk) => tk.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch {
        setError(t("camera.noCamera"));
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((tk) => tk.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    const side = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, side, side);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob, URL.createObjectURL(blob));
      },
      "image/jpeg",
      0.92
    );
  }, [onCapture]);

  const onFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onCapture(file, URL.createObjectURL(file));
      e.target.value = "";
    },
    [onCapture]
  );

  return (
    <div>
      <div className="camera-wrap">
        {!error ? (
          <>
            <video ref={videoRef} playsInline muted />
            <div className="guide">
              <div className="oval" />
              <div className="tip">{tip ?? t("camera.defaultTip")}</div>
            </div>
          </>
        ) : (
          <div className="guide" style={{ color: "#fff", padding: 20, textAlign: "center" }}>
            <div>
              <div style={{ fontSize: 40 }}>📷</div>
              <div style={{ marginTop: 8 }}>{error}</div>
            </div>
          </div>
        )}
      </div>

      <div className="cam-actions">
        {!error && (
          <button className="bigbtn" onClick={capture} disabled={!ready}>
            <span className="emoji">📸</span> {captureLabel ?? t("camera.capture")}
          </button>
        )}
        <label className="bigbtn secondary" style={{ cursor: "pointer" }}>
          <span className="emoji">🖼️</span> {t("camera.gallery")}
          <input type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
        </label>
      </div>
    </div>
  );
}
