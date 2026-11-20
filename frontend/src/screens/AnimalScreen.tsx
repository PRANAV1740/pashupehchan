import { useEffect, useState } from "react";
import { api } from "../api";
import type { Animal, AppEvent, Reminder } from "../types";
import BigButton from "../components/BigButton";
import ReminderRow from "../components/ReminderRow";
import { useT } from "../i18n";
import type { TKey } from "../i18n";

interface Props {
  animal: Animal | null;
  animalId: string;
  reminders: Reminder[];
  onVoiceLog: () => void;
  onReminderDone: (id: string) => void;
  onReportProblem: () => void;
}

const EVENT_EMOJI: Record<string, string> = {
  vaccination: "💉",
  illness: "🤒",
  breeding: "🐣",
  triage: "🚦",
  note: "📝",
};

export default function AnimalScreen({ animal, animalId, reminders, onVoiceLog, onReminderDone, onReportProblem }: Props) {
  const t = useT();
  const [events, setEvents] = useState<AppEvent[] | null>(null);
  const mine = reminders.filter((r) => r.animal_id === animalId);

  useEffect(() => {
    api.listEvents(animalId).then(setEvents).catch(() => setEvents([]));
  }, [animalId]);

  const meta: string[] = [];
  if (animal?.approx_age_months) meta.push(t("animal.years", { n: Math.round(animal.approx_age_months / 12) }));
  meta.push(t("animal.photos", { n: animal?.noseprint_count ?? 0 }));
  if (animal?.ear_tag_number) meta.push(t("animal.tag", { tag: animal.ear_tag_number }));

  return (
    <div>
      <div className="card">
        <div className="animal-row" style={{ padding: 0 }}>
          <div className="avatar">{animal?.species === "buffalo" ? "🐃" : "🐄"}</div>
          <div>
            <div className="name">{animal?.name ?? t("common.animal")}</div>
            <div className="meta">{meta.join(" · ")}</div>
          </div>
        </div>
      </div>

      <BigButton emoji="🎙️" label={t("animal.voiceLog")} onClick={onVoiceLog} />
      <BigButton emoji="🚑" label={t("animal.reportProblem")} variant="secondary" onClick={onReportProblem} />

      {mine.length > 0 && (
        <>
          <div className="section-title">{t("reminders.title")}</div>
          <div className="card" style={{ padding: 0 }}>
            {mine
              .slice()
              .sort((a, b) => (a.due_on < b.due_on ? -1 : 1))
              .map((r, i) => (
                <div key={r.id} style={{ borderTop: i ? "1px solid var(--line)" : "none" }}>
                  <ReminderRow reminder={r} onDone={onReminderDone} />
                </div>
              ))}
          </div>
        </>
      )}

      <div className="section-title">{t("animal.passbook")}</div>
      {events === null ? (
        <div className="spinner" />
      ) : events.length === 0 ? (
        <div className="card center">
          <div style={{ fontSize: 34 }}>📖</div>
          <p className="muted">{t("animal.emptyRecord")}</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {events.map((e, i) => (
            <div key={e.id} className="animal-row" style={{ borderTop: i ? "1px solid var(--line)" : "none" }}>
              <div className="avatar">{EVENT_EMOJI[e.type] ?? "📝"}</div>
              <div>
                <div className="name" style={{ fontSize: 16 }}>
                  {t(`event.${e.type}` as TKey)}
                </div>
                <div className="meta">
                  {e.occurred_on}
                  {e.note_text ? ` · ${e.note_text}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
