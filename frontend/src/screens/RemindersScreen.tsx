import type { Animal, Reminder } from "../types";
import ReminderRow from "../components/ReminderRow";
import { useT } from "../i18n";

interface Props {
  reminders: Reminder[];
  animals: Animal[];
  onDone: (id: string) => void;
}

export default function RemindersScreen({ reminders, animals, onDone }: Props) {
  const t = useT();
  const nameOf = (id: string) => animals.find((a) => a.id === id)?.name ?? "";
  const sorted = [...reminders].sort((a, b) => (a.due_on < b.due_on ? -1 : 1));

  if (sorted.length === 0) {
    return (
      <div className="card center">
        <div style={{ fontSize: 40 }}>✅</div>
        <p className="muted">{t("reminders.none")}</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      {sorted.map((r, i) => (
        <div key={r.id} style={{ borderTop: i ? "1px solid var(--line)" : "none" }}>
          <ReminderRow reminder={r} animalName={nameOf(r.animal_id)} onDone={onDone} />
        </div>
      ))}
    </div>
  );
}
