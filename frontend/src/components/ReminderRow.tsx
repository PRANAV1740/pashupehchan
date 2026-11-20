import type { Reminder } from "../types";
import { useT } from "../i18n";
import type { TKey } from "../i18n";

const VACCINE_EMOJI: Record<string, string> = {
  fmd: "💉",
  hs: "💉",
  bq: "💉",
  deworm: "🪱",
  breeding_check: "🐣",
  followup: "🩺",
};
const KNOWN = new Set(Object.keys(VACCINE_EMOJI));

export function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${iso}T00:00:00`);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

/** Count reminders that are overdue or due within `withinDays`. */
export function reminderDueCount(reminders: Reminder[], withinDays = 14): number {
  return reminders.filter((r) => daysUntil(r.due_on) <= withinDays).length;
}

interface Props {
  reminder: Reminder;
  animalName?: string;
  onDone: (id: string) => void;
  busy?: boolean;
}

export default function ReminderRow({ reminder, animalName, onDone, busy }: Props) {
  const t = useT();
  const d = daysUntil(reminder.due_on);
  const label = KNOWN.has(reminder.type) ? t(`vaccine.${reminder.type}` as TKey) : reminder.label;
  const emoji = VACCINE_EMOJI[reminder.type] ?? "🔔";
  const status = d < 0 ? t("reminders.overdue") : d === 0 ? t("reminders.dueToday") : t("reminders.dueInDays", { n: d });
  const cls = d < 0 ? "due-overdue" : d <= 3 ? "due-soon" : "due-ok";

  return (
    <div className="reminder-row">
      <div className="avatar">{emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="name" style={{ fontSize: 16 }}>
          {label}
          {animalName ? ` · ${animalName}` : ""}
        </div>
        <div className={`meta ${cls}`}>
          {status} · {reminder.due_on}
        </div>
      </div>
      <button className="done-btn" disabled={busy} onClick={() => onDone(reminder.id)}>
        {t("reminders.done")}
      </button>
    </div>
  );
}
