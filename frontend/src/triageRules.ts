/**
 * Triage red-flag checklist — deterministic, offline, no AI.
 *
 * The family taps the signs that apply; the case is sorted into green / amber /
 * red by the worst sign selected. A red flag ALWAYS escalates — this rule lives
 * outside any model. The app never names a disease or a medicine; it only sorts
 * urgency and routes to a vet.
 *
 * NOTE: this default checklist MUST be reviewed and signed off by a veterinarian
 * before field use.
 */
import type { TKey } from "./i18n";

export type Level = "green" | "amber" | "red";

export interface Symptom {
  key: string;
  emoji: string;
  severity: Exclude<Level, "green">; // red or amber
  labelKey: TKey;
}

// Order matters only for display; red flags are listed first.
export const SYMPTOMS: Symptom[] = [
  { key: "cantStand", emoji: "🛑", severity: "red", labelKey: "symptom.cantStand" },
  { key: "bloat", emoji: "🎈", severity: "red", labelKey: "symptom.bloat" },
  { key: "breathing", emoji: "😮‍💨", severity: "red", labelKey: "symptom.breathing" },
  { key: "bleeding", emoji: "🩸", severity: "red", labelKey: "symptom.bleeding" },
  { key: "calving", emoji: "⚠️", severity: "red", labelKey: "symptom.calving" },
  { key: "notEating", emoji: "🚫", severity: "red", labelKey: "symptom.notEating" },
  { key: "eatingLess", emoji: "🍽️", severity: "amber", labelKey: "symptom.eatingLess" },
  { key: "lame", emoji: "🦵", severity: "amber", labelKey: "symptom.lame" },
  { key: "looseDung", emoji: "💩", severity: "amber", labelKey: "symptom.looseDung" },
  { key: "lessMilk", emoji: "🥛", severity: "amber", labelKey: "symptom.lessMilk" },
  { key: "dull", emoji: "😔", severity: "amber", labelKey: "symptom.dull" },
];

const SEVERITY_OF: Record<string, Exclude<Level, "green">> = Object.fromEntries(
  SYMPTOMS.map((s) => [s.key, s.severity])
);

/** Worst selected sign wins; nothing selected => green (just watch). */
export function computeLevel(selected: string[]): Level {
  if (selected.some((k) => SEVERITY_OF[k] === "red")) return "red";
  if (selected.some((k) => SEVERITY_OF[k] === "amber")) return "amber";
  return "green";
}

// National 24x7 mobile veterinary helpline.
export const HELPLINE = "1962";
