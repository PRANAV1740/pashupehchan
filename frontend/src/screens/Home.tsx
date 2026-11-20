import type { Animal, Household, Reminder } from "../types";
import BigButton from "../components/BigButton";
import { reminderDueCount } from "../components/ReminderRow";
import { useT } from "../i18n";

interface Props {
  household: Household;
  animals: Animal[];
  reminders: Reminder[];
  embedder: string;
  onIdentify: () => void;
  onEnrol: () => void;
  onOpenAnimal: (id: string) => void;
  onOpenReminders: () => void;
  onOpenTriage: () => void;
}

const SPECIES_EMOJI: Record<string, string> = { cattle: "🐄", buffalo: "🐃" };

export default function Home({ household, animals, reminders, embedder, onIdentify, onEnrol, onOpenAnimal, onOpenReminders, onOpenTriage }: Props) {
  const t = useT();
  const dueCount = reminderDueCount(reminders);
  return (
    <div>
      {reminders.length > 0 && (
        <button className={`bigbtn ${dueCount > 0 ? "warn" : "secondary"}`} onClick={onOpenReminders}>
          <span className="emoji">🔔</span>
          <span>{dueCount > 0 ? t("reminders.banner", { n: dueCount }) : t("reminders.title")}</span>
        </button>
      )}
      <BigButton emoji="🔍" label={t("home.identify")} hint={t("home.identifyHint")} onClick={onIdentify} />
      <BigButton emoji="➕" label={t("home.enrol")} hint={t("home.enrolHint")} variant="secondary" onClick={onEnrol} />
      {animals.length > 0 && (
        <BigButton emoji="🚑" label={t("home.help")} hint={t("home.helpHint")} variant="secondary" onClick={onOpenTriage} />
      )}

      <div className="section-title">{t("home.yourAnimals", { n: animals.length })}</div>

      {animals.length === 0 ? (
        <div className="card center">
          <div style={{ fontSize: 40 }}>🐄</div>
          <p className="muted">
            {t("home.emptyTitle")}
            <br />
            {t("home.emptyHint")}
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {animals.map((a, i) => (
            <div
              key={a.id}
              className="animal-row"
              style={{ borderTop: i ? "1px solid var(--line)" : "none" }}
              onClick={() => onOpenAnimal(a.id)}
            >
              <div className="avatar">{SPECIES_EMOJI[a.species] ?? "🐄"}</div>
              <div>
                <div className="name">{a.name}</div>
                <div className="meta">
                  {a.approx_age_months ? t("animal.years", { n: Math.round(a.approx_age_months / 12) }) : t("animal.noAge")}
                  {a.ear_tag_number ? ` · ${t("animal.tag", { tag: a.ear_tag_number })}` : ""}
                </div>
              </div>
              <span className={`badge ${a.noseprint_count < 3 ? "warn" : ""}`}>{a.noseprint_count} 📸</span>
            </div>
          ))}
        </div>
      )}

      <p className="muted center" style={{ marginTop: 18 }}>
        {t("home.footer", { code: household.share_code, embedder })}
      </p>
    </div>
  );
}
