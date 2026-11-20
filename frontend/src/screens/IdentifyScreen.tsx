import { useState } from "react";
import { api } from "../api";
import type { Household, IdentifyResult } from "../types";
import BigButton from "../components/BigButton";
import Camera from "../components/Camera";
import { useT } from "../i18n";
import type { TKey } from "../i18n";

interface Props {
  household: Household;
  onOpenAnimal: (id: string) => void;
}

const DECISION_EMOJI: Record<string, string> = {
  match: "✅",
  review: "🤔",
  no_match: "❓",
  low_quality: "📷",
};

const QUALITY_KEYS = new Set(["blurred", "too_dark", "too_bright"]);

export default function IdentifyScreen({ household, onOpenAnimal }: Props) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IdentifyResult | null>(null);
  const [probeUrl, setProbeUrl] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);

  async function run(blob: Blob, url: string) {
    setBusy(true);
    setErrored(false);
    setProbeUrl(url);
    try {
      setResult(await api.identify(household.id, blob));
    } catch {
      setErrored(true);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setResult(null);
    setProbeUrl(null);
    setErrored(false);
  }

  // Build the message from the decision code, not the server's text, so it is
  // always shown in the chosen language.
  function localizedMessage(r: IdentifyResult): string {
    if (r.decision === "low_quality") {
      const reason = r.quality.reason;
      if (reason && QUALITY_KEYS.has(reason)) return t(`identify.quality.${reason}` as TKey);
      return t("identify.msg.low_quality");
    }
    if (r.decision === "match" && r.best) return t("identify.msg.match", { name: r.best.name });
    if (r.decision === "review") return t("identify.msg.review");
    return t("identify.msg.no_match");
  }

  if (busy) return <div className="spinner" />;

  if (errored) {
    return (
      <div>
        <div className="result no_match">
          <div className="big-emoji">⚠️</div>
          <h2>{t("identify.error")}</h2>
        </div>
        <BigButton emoji="🔄" label={t("identify.again")} variant="secondary" onClick={reset} />
      </div>
    );
  }

  if (result) {
    const heading = result.decision === "match" && result.best ? result.best.name : t(`identify.decision.${result.decision}` as TKey);
    return (
      <div>
        {probeUrl && (
          <div className="camera-wrap" style={{ aspectRatio: "1 / 1", marginBottom: 14 }}>
            <img className="preview" src={probeUrl} alt="probe" />
          </div>
        )}
        <div className={`result ${result.decision}`}>
          <div className="big-emoji">{DECISION_EMOJI[result.decision]}</div>
          <h2>{heading}</h2>
          {result.best && <p className="sim">{t("identify.matchPercent", { percent: Math.round(result.best.similarity * 100) })}</p>}
          <p>{localizedMessage(result)}</p>
        </div>

        {result.candidates.length > 1 && (
          <div className="card">
            <div className="section-title" style={{ marginTop: 0 }}>
              {t("identify.otherMatches")}
            </div>
            {result.candidates.slice(1).map((c) => (
              <div key={c.animal_id} className="animal-row" style={{ padding: "8px 0" }} onClick={() => onOpenAnimal(c.animal_id)}>
                <div className="avatar">{c.species === "buffalo" ? "🐃" : "🐄"}</div>
                <div className="name">{c.name}</div>
                <span className="badge">{Math.round(c.similarity * 100)}%</span>
              </div>
            ))}
          </div>
        )}

        {result.decision === "match" && result.best && (
          <BigButton emoji="📖" label={t("identify.openRecord", { name: result.best.name })} onClick={() => onOpenAnimal(result.best!.animal_id)} />
        )}
        <BigButton emoji="🔄" label={t("identify.again")} variant="secondary" onClick={reset} />
      </div>
    );
  }

  return (
    <div>
      <div className="card center">
        <p className="muted" style={{ margin: 0 }}>
          {t("identify.intro")}
        </p>
      </div>
      <Camera tip={t("identify.tip")} captureLabel={t("identify.capture")} onCapture={run} />
    </div>
  );
}
