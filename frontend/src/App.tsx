import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { Animal, Household } from "./types";
import { useI18n } from "./i18n";
import LanguageSheet from "./components/LanguageSheet";
import Home from "./screens/Home";
import EnrolScreen from "./screens/EnrolScreen";
import IdentifyScreen from "./screens/IdentifyScreen";
import AnimalScreen from "./screens/AnimalScreen";
import VoiceLogScreen from "./screens/VoiceLogScreen";
import RemindersScreen from "./screens/RemindersScreen";
import TriageScreen from "./screens/TriageScreen";
import type { Reminder } from "./types";

type Screen =
  | { name: "home" }
  | { name: "enrol" }
  | { name: "identify" }
  | { name: "animal"; animalId: string }
  | { name: "voice"; animalId: string }
  | { name: "reminders" }
  | { name: "triage"; animalId?: string };

export default function App() {
  const { t, chosen } = useI18n();
  const [household, setHousehold] = useState<Household | null>(null);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [online, setOnline] = useState(false);
  const [embedder, setEmbedder] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [langOpen, setLangOpen] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const refreshAnimals = useCallback(async (hhId: string) => {
    setAnimals(await api.listAnimals(hhId));
  }, []);

  const refreshReminders = useCallback(async (hhId: string) => {
    setReminders(await api.listReminders(hhId));
  }, []);

  const onReminderDone = useCallback(
    async (id: string) => {
      if (!household) return;
      await api.markReminderDone(id);
      await refreshReminders(household.id);
      showToast(t("reminders.markedDone"));
    },
    [household, refreshReminders, showToast, t]
  );

  useEffect(() => {
    (async () => {
      try {
        const h = await api.health();
        setOnline(true);
        setEmbedder(h.embedder);
        const existing = await api.listHouseholds();
        const hh = existing[0] ?? (await api.createHousehold("Mera Ghar"));
        setHousehold(hh);
        await refreshAnimals(hh.id);
        await refreshReminders(hh.id);
      } catch {
        setOnline(false);
      } finally {
        setBooting(false);
      }
    })();
  }, [refreshAnimals, refreshReminders]);

  const go = useCallback((s: Screen) => setScreen(s), []);

  const title =
    screen.name === "enrol"
      ? t("title.enrol")
      : screen.name === "identify"
        ? t("title.identify")
        : screen.name === "voice"
          ? t("voice.title")
          : screen.name === "reminders"
            ? t("reminders.title")
            : screen.name === "triage"
              ? t("triage.title")
              : screen.name === "animal"
                ? t("title.animal")
                : "PashuPehchan";

  return (
    <div className="app">
      <div className="topbar">
        {screen.name !== "home" ? (
          <button
            className="back"
            onClick={() =>
              go(
                (screen.name === "voice" || (screen.name === "triage" && screen.animalId))
                  ? { name: "animal", animalId: screen.animalId as string }
                  : { name: "home" }
              )
            }
            aria-label={t("common.back")}
          >
            ‹
          </button>
        ) : (
          <div className="avatar" aria-hidden>
            🐃
          </div>
        )}
        <div>
          <div className="brand">{title}</div>
          <div className="sub">{screen.name === "home" ? t("brandTagline") : household?.name}</div>
        </div>
        <span className="pill-status">
          <span className={`dot ${online ? "ok" : "off"}`} />
          {online ? t("status.online") : t("status.offline")}
        </span>
        <button className="globe" onClick={() => setLangOpen(true)} aria-label={t("lang.change")}>
          🌐
        </button>
      </div>

      <div className="content">
        {booting ? (
          <div className="spinner" />
        ) : !online ? (
          <div className="card center">
            <div style={{ fontSize: 40 }}>🔌</div>
            <h3>{t("offline.title")}</h3>
            <p className="muted">
              {t("offline.hint")} <code>uvicorn app.main:app --reload</code>
            </p>
          </div>
        ) : !household ? (
          <div className="spinner" />
        ) : screen.name === "home" ? (
          <Home
            household={household}
            animals={animals}
            reminders={reminders}
            embedder={embedder}
            onIdentify={() => go({ name: "identify" })}
            onEnrol={() => go({ name: "enrol" })}
            onOpenAnimal={(id) => go({ name: "animal", animalId: id })}
            onOpenReminders={() => go({ name: "reminders" })}
            onOpenTriage={() => go({ name: "triage" })}
          />
        ) : screen.name === "enrol" ? (
          <EnrolScreen
            household={household}
            onDone={async () => {
              await refreshAnimals(household.id);
              await refreshReminders(household.id);
              showToast(t("enrol.savedToast"));
              go({ name: "home" });
            }}
            onToast={showToast}
          />
        ) : screen.name === "identify" ? (
          <IdentifyScreen household={household} onOpenAnimal={(id) => go({ name: "animal", animalId: id })} />
        ) : screen.name === "voice" ? (
          <VoiceLogScreen
            animalId={screen.animalId}
            animalName={animals.find((a) => a.id === screen.animalId)?.name ?? t("common.animal")}
            species={animals.find((a) => a.id === screen.animalId)?.species ?? "cattle"}
            onSaved={async () => {
              await refreshReminders(household.id);
              go({ name: "animal", animalId: screen.animalId });
            }}
            onToast={showToast}
          />
        ) : screen.name === "reminders" ? (
          <RemindersScreen reminders={reminders} animals={animals} onDone={onReminderDone} />
        ) : screen.name === "triage" ? (
          <TriageScreen
            animals={animals}
            animalId={screen.animalId}
            reminders={reminders}
            onToast={showToast}
            onLogged={() => refreshReminders(household.id)}
            onClose={() => go(screen.animalId ? { name: "animal", animalId: screen.animalId } : { name: "home" })}
          />
        ) : (
          <AnimalScreen
            animal={animals.find((a) => a.id === screen.animalId) ?? null}
            animalId={screen.animalId}
            reminders={reminders}
            onVoiceLog={() => go({ name: "voice", animalId: screen.animalId })}
            onReminderDone={onReminderDone}
            onReportProblem={() => go({ name: "triage", animalId: screen.animalId })}
          />
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
      {(!chosen || langOpen) && <LanguageSheet dismissable={chosen} onClose={() => setLangOpen(false)} />}
    </div>
  );
}
