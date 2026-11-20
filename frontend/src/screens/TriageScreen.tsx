import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { Animal, Reminder } from "../types";
import BigButton from "../components/BigButton";
import { daysUntil } from "../components/ReminderRow";
import { useI18n } from "../i18n";
import type { TKey } from "../i18n";
import { computeLevel, HELPLINE, SYMPTOMS, type Level } from "../triageRules";

interface Props {
  animals: Animal[];
  animalId?: string;
  reminders: Reminder[];
  onToast: (msg: string) => void;
  onLogged: () => void;
  onClose: () => void;
}

const KNOWN_VACCINE = new Set(["fmd", "hs", "bq", "deworm", "breeding_check", "followup"]);
const RESULT_EMOJI: Record<Level, string> = { green: "👀", amber: "🩺", red: "🚨" };

export default function TriageScreen({ animals, animalId, reminders, onToast, onLogged, onClose }: Props) {
  const { t } = useI18n();
  const [chosenId, setChosenId] = useState<string | null>(animalId ?? (animals.length === 1 ? animals[0].id : null));
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<Level | null>(null);
  const postedRef = useRef(false);

  const animal = animals.find((a) => a.id === chosenId) ?? null;

  function toggle(key: string) {
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
  }

  function vaccineLabel(r: Reminder): string {
    return KNOWN_VACCINE.has(r.type) ? t(`vaccine.${r.type}` as TKey) : r.label;
  }

  function buildHistory(level: Level): string {
    const lines: string[] = [t("triage.historyTitle")];
    if (animal) {
      const age = animal.approx_age_months ? `${Math.round(animal.approx_age_months / 12)}y` : "?";
      const tag = animal.ear_tag_number ? `, tag ${animal.ear_tag_number}` : "";
      lines.push(`• ${animal.name} — ${t(`species.${animal.species}` as TKey)}, ${age}${tag}`);
      const overdue = reminders.filter((r) => r.animal_id === animal.id && daysUntil(r.due_on) < 0).map(vaccineLabel);
      if (overdue.length) lines.push(`• ${t("reminders.overdue")}: ${overdue.join(", ")}`);
    }
    const signs = selected.map((k) => t(`symptom.${k}` as TKey)).join(", ");
    lines.push(`• ${t("triage.signs")}: ${signs || "-"}`);
    lines.push(`• ${t(`triage.${level}.head` as TKey)}`);
    lines.push(t("triage.noDiagnosis"));
    return lines.join("\n");
  }

  // Log the triage event once, when a result is reached.
  useEffect(() => {
    if (!result || !animal || postedRef.current) return;
    postedRef.current = true;
    const signs = selected.map((k) => t(`symptom.${k}` as TKey)).join(", ");
    api
      .createEvent({
        animal_id: animal.id,
        type: "triage",
        note_text: `${t(`triage.${result}.head` as TKey)}: ${signs || "-"}`,
        source: "triage",
        payload: { level: result, symptoms: selected },
      })
      .then(() => {
        onToast(t("triage.savedToast"));
        onLogged();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  async function share() {
    if (!result) return;
    const text = buildHistory(result);
    const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ text });
      } catch {
        /* cancelled */
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        onToast(t("triage.share"));
      } catch {
        /* ignore */
      }
    }
  }

  // Step 1: choose an animal (only when not pre-selected and more than one).
  if (!chosenId) {
    return (
      <div>
        <div className="section-title" style={{ marginTop: 0 }}>
          {t("triage.choose")}
        </div>
        <div className="card" style={{ padding: 0 }}>
          {animals.map((a, i) => (
            <div
              key={a.id}
              className="animal-row"
              style={{ borderTop: i ? "1px solid var(--line)" : "none" }}
              onClick={() => setChosenId(a.id)}
            >
              <div className="avatar">{a.species === "buffalo" ? "🐃" : "🐄"}</div>
              <div className="name">{a.name}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Step 3: result.
  if (result) {
    return (
      <div>
        <div className={`result ${result}`}>
          <div className="big-emoji">{RESULT_EMOJI[result]}</div>
          <h2>{t(`triage.${result}.head` as TKey)}</h2>
          <p>{t(`triage.${result}.msg` as TKey)}</p>
        </div>

        {result === "red" && (
          <a className="bigbtn danger" href={`tel:${HELPLINE}`}>
            <span className="emoji">📞</span> {t("triage.callVet")}
          </a>
        )}
        {result === "amber" && (
          <a className="bigbtn" href={`tel:${HELPLINE}`}>
            <span className="emoji">📞</span> {t("triage.callParavet")}
          </a>
        )}

        {result !== "green" && (
          <>
            <BigButton emoji="📤" label={t("triage.share")} variant="secondary" onClick={share} />
            <div className="history-box">{buildHistory(result)}</div>
          </>
        )}

        <p className="muted center" style={{ margin: "12px 2px" }}>
          {t("triage.noDiagnosis")}
        </p>
        <BigButton emoji="✅" label={t("triage.done")} variant={result === "green" ? undefined : "ghost"} onClick={onClose} />
      </div>
    );
  }

  // Step 2: symptom checklist.
  return (
    <div>
      <div className="card">
        <b>{animal?.name}</b> — {t("triage.whatWrong")}
      </div>
      <div className="type-grid">
        {SYMPTOMS.map((s) => (
          <button
            key={s.key}
            className={`type-btn ${selected.includes(s.key) ? "active" : ""}`}
            onClick={() => toggle(s.key)}
          >
            <span className="emoji">{s.emoji}</span>
            <span style={{ fontSize: 13, lineHeight: 1.2 }}>{t(s.labelKey)}</span>
          </button>
        ))}
      </div>
      <BigButton emoji="➡️" label={t("triage.getAdvice")} onClick={() => setResult(computeLevel(selected))} />
    </div>
  );
}
