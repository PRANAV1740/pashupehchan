export interface Household {
  id: string;
  name: string;
  village: string | null;
  share_code: string;
  created_at: string;
}

export interface Animal {
  id: string;
  household_id: string;
  name: string;
  species: string;
  approx_age_months: number | null;
  ear_tag_number: string | null;
  created_at: string;
  noseprint_count: number;
}

export interface QualityReport {
  ok: boolean;
  sharpness: number;
  brightness: number;
  reason: string | null;
}

export interface EnrolResult {
  animal: Animal;
  accepted_shots: number;
  rejected: QualityReport[];
}

export interface MatchCandidate {
  animal_id: string;
  name: string;
  species: string;
  similarity: number;
}

export type IdentifyDecision = "match" | "review" | "no_match" | "low_quality";

export interface IdentifyResult {
  decision: IdentifyDecision;
  quality: QualityReport;
  best: MatchCandidate | null;
  candidates: MatchCandidate[];
  message: string;
}

export interface AppEvent {
  id: string;
  animal_id: string;
  type: string;
  note_text: string | null;
  source: string;
  occurred_on: string;
  created_at: string;
}

export interface Reminder {
  id: string;
  animal_id: string;
  type: string;
  label: string;
  due_on: string;
  status: string;
}
