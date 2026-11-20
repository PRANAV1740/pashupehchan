import { useState } from "react";
import { api } from "../api";
import type { Household } from "../types";
import BigButton from "../components/BigButton";
import Camera from "../components/Camera";
import { useT } from "../i18n";

interface Props {
  household: Household;
  onDone: () => void;
  onToast: (msg: string) => void;
}

const TARGET_SHOTS = 5;

interface Shot {
  blob: Blob;
  url: string;
}

export default function EnrolScreen({ household, onDone, onToast }: Props) {
  const t = useT();
  const [step, setStep] = useState<"details" | "capture">("details");
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("cattle");
  const [ageYears, setAgeYears] = useState("");
  const [shots, setShots] = useState<Shot[]>([]);
  const [saving, setSaving] = useState(false);

  function addShot(blob: Blob, url: string) {
    setShots((s) => (s.length >= TARGET_SHOTS ? s : [...s, { blob, url }]));
  }

  async function save() {
    setSaving(true);
    try {
      const animal = await api.createAnimal({
        household_id: household.id,
        name: name.trim() || t("enrol.unnamed"),
        species,
        approx_age_months: ageYears ? Math.round(parseFloat(ageYears) * 12) : null,
      });
      const res = await api.enrol(
        animal.id,
        shots.map((s) => s.blob)
      );
      if (res.rejected.length) {
        onToast(t("enrol.someRejected", { ok: res.accepted_shots, bad: res.rejected.length }));
      }
      onDone();
    } catch (e) {
      onToast(t("enrol.saveFailed", { msg: (e as Error).message }));
      setSaving(false);
    }
  }

  if (step === "details") {
    return (
      <div>
        <div className="card">
          <label className="label">{t("enrol.nameLabel")}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("enrol.namePlaceholder")} />

          <label className="label">{t("enrol.speciesLabel")}</label>
          <select className="input" value={species} onChange={(e) => setSpecies(e.target.value)}>
            <option value="cattle">🐄 {t("species.cattle")}</option>
            <option value="buffalo">🐃 {t("species.buffalo")}</option>
          </select>

          <label className="label">{t("enrol.ageLabel")}</label>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            value={ageYears}
            onChange={(e) => setAgeYears(e.target.value)}
            placeholder={t("enrol.agePlaceholder")}
          />
        </div>
        <BigButton emoji="📸" label={t("enrol.next")} onClick={() => setStep("capture")} />
      </div>
    );
  }

  const displayName = name.trim() || t("enrol.newAnimal");

  return (
    <div>
      <div className="card">
        {t("enrol.captureIntro", { name: displayName, total: TARGET_SHOTS })}
        <div className="shots">
          {Array.from({ length: TARGET_SHOTS }).map((_, i) =>
            shots[i] ? (
              <img key={i} className="thumb" src={shots[i].url} alt={`shot ${i + 1}`} />
            ) : (
              <div key={i} className="slot">
                {i + 1}
              </div>
            )
          )}
        </div>
      </div>

      {shots.length < TARGET_SHOTS ? (
        <Camera
          tip={t("enrol.captureTip", { k: shots.length + 1, total: TARGET_SHOTS })}
          captureLabel={t("camera.capture")}
          onCapture={addShot}
        />
      ) : (
        <div className="card center">
          <div style={{ fontSize: 36 }}>✅</div>
          <p>{t("enrol.allDone")}</p>
        </div>
      )}

      <BigButton
        emoji="💾"
        label={saving ? t("enrol.saving") : t("enrol.save", { n: shots.length, total: TARGET_SHOTS })}
        disabled={saving || shots.length === 0}
        onClick={save}
      />
      {shots.length > 0 && !saving && (
        <BigButton label={t("enrol.removeLast")} variant="ghost" onClick={() => setShots((s) => s.slice(0, -1))} />
      )}
    </div>
  );
}
