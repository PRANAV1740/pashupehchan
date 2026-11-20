import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import BigButton from "../components/BigButton";
import { useI18n } from "../i18n";
import type { TKey } from "../i18n";
import { parseUtterance, speechLang, type EventType } from "../voiceParse";

interface Props {
  animalId: string;
  animalName: string;
  species: string;
  onSaved: () => void;
  onToast: (msg: string) => void;
}

const TYPES: { type: EventType; emoji: string; key: TKey }[] = [
  { type: "vaccination", emoji: "💉", key: "event.vaccination" },
  { type: "illness", emoji: "🤒", key: "event.illness" },
  { type: "breeding", emoji: "🐣", key: "event.breeding" },
  { type: "note", emoji: "📝", key: "event.note" },
];

function isoDay(deltaDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export default function VoiceLogScreen({ animalId, animalName, species, onSaved, onToast }: Props) {
  const { t, lang } = useI18n();
  const [type, setType] = useState<EventType | null>(null);
  const [when, setWhen] = useState<"today" | "yesterday">("today");
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  const SR = typeof window !== "undefined" ? window.SpeechRecognition ?? window.webkitSpeechRecognition : undefined;
  const supported = !!SR;

  useEffect(() => () => recRef.current?.abort(), []);

  function startListening() {
    if (!SR) return;
    setHint(null);
    const rec = new SR();
    recRef.current = rec;
    rec.lang = speechLang(lang);
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.onresult = (e) => {
      const text = e.results?.[0]?.[0]?.transcript ?? "";
      if (!text) {
        setHint(t("voice.noSpeech"));
        return;
      }
      setTranscript(text);
      const parsed = parseUtterance(text, lang);
      if (parsed.type) setType(parsed.type);
      setWhen(parsed.when);
    };
    rec.onerror = (ev) => {
      const denied = ev.error === "not-allowed" || ev.error === "service-not-allowed";
      setHint(denied ? t("voice.micDenied") : t("voice.noSpeech"));
      setListening(false);
    };
    rec.onend = () => setListening(false);
    try {
      rec.start();
      setListening(true);
    } catch {
      setHint(t("voice.micDenied"));
      setListening(false);
    }
  }

  function stopListening() {
    recRef.current?.stop();
    setListening(false);
  }

  async function save() {
    if (!type) return;
    setSaving(true);
    const note = transcript.trim();
    try {
      await api.createEvent({
        animal_id: animalId,
        type,
        note_text: note || null,
        source: note ? "voice" : "icon",
        occurred_on: when === "today" ? isoDay(0) : isoDay(-1),
        payload: note ? { transcript: note, lang } : null,
      });
      onToast(t("voice.savedToast"));
      onSaved();
    } catch (e) {
      onToast(t("voice.saveFailed", { msg: (e as Error).message }));
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="card">
        <div className="animal-row" style={{ padding: 0 }}>
          <div className="avatar">{species === "buffalo" ? "🐃" : "🐄"}</div>
          <div>
            <div className="name">{animalName}</div>
            <div className="meta">{t("voice.title")}</div>
          </div>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 4 }}>
        {t("voice.pickType")}
      </div>
      <div className="type-grid">
        {TYPES.map((x) => (
          <button key={x.type} className={`type-btn ${type === x.type ? "active" : ""}`} onClick={() => setType(x.type)}>
            <span className="emoji">{x.emoji}</span>
            {t(x.key)}
          </button>
        ))}
      </div>

      <div className="mic-area">
        {supported ? (
          <button
            className={`mic-btn ${listening ? "listening" : ""}`}
            onClick={listening ? stopListening : startListening}
            aria-label={t("voice.tapSpeak")}
          >
            🎙️
          </button>
        ) : (
          <div style={{ fontSize: 44 }}>🔇</div>
        )}
        <div className="muted center">
          {supported ? (listening ? t("voice.listening") : t("voice.tapSpeak")) : t("voice.notSupported")}
        </div>
        {supported && !transcript && !hint && (
          <div className="muted center" style={{ fontSize: 13 }}>
            {t("voice.examples")}
          </div>
        )}
        {hint && <div className="muted center">{hint}</div>}
        {transcript && (
          <div className="heard-box">
            <b>{t("voice.heard")}:</b> “{transcript}”
          </div>
        )}
      </div>

      <div className="section-title">{t("voice.when")}</div>
      <div className="seg">
        <button className={when === "today" ? "active" : ""} onClick={() => setWhen("today")}>
          {t("voice.today")}
        </button>
        <button className={when === "yesterday" ? "active" : ""} onClick={() => setWhen("yesterday")}>
          {t("voice.yesterday")}
        </button>
      </div>

      <BigButton emoji="✅" label={saving ? t("enrol.saving") : t("voice.confirm")} disabled={!type || saving} onClick={save} />
      {transcript && !saving && (
        <BigButton
          label={t("voice.again")}
          variant="ghost"
          onClick={() => {
            setTranscript("");
            setHint(null);
          }}
        />
      )}
    </div>
  );
}
