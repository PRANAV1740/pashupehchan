import type { Animal, AppEvent, EnrolResult, Household, IdentifyResult, Reminder } from "./types";

// Production: set VITE_API_URL to the deployed backend. Falls back to localhost for dev.
const BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  "http://localhost:8000";

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  base: BASE,

  async health(timeoutMs = 10000): Promise<{ status: string; embedder: string }> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await j(await fetch(`${BASE}/health`, { signal: ctrl.signal }));
    } finally {
      clearTimeout(timer);
    }
  },

  async listHouseholds(): Promise<Household[]> {
    return j(await fetch(`${BASE}/households`));
  },

  async createHousehold(name: string, village?: string): Promise<Household> {
    return j(
      await fetch(`${BASE}/households`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, village: village || null }),
      })
    );
  },

  async listAnimals(householdId: string): Promise<Animal[]> {
    return j(await fetch(`${BASE}/households/${householdId}/animals`));
  },

  async createAnimal(input: {
    household_id: string;
    name: string;
    species: string;
    approx_age_months?: number | null;
    ear_tag_number?: string | null;
  }): Promise<Animal> {
    return j(
      await fetch(`${BASE}/animals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
    );
  },

  async enrol(animalId: string, shots: Blob[]): Promise<EnrolResult> {
    const form = new FormData();
    shots.forEach((b, i) => form.append("files", b, `shot-${i}.jpg`));
    return j(await fetch(`${BASE}/animals/${animalId}/enrol`, { method: "POST", body: form }));
  },

  async identify(householdId: string, shot: Blob): Promise<IdentifyResult> {
    const form = new FormData();
    form.append("file", shot, "probe.jpg");
    return j(await fetch(`${BASE}/households/${householdId}/identify`, { method: "POST", body: form }));
  },

  async listEvents(animalId: string): Promise<AppEvent[]> {
    return j(await fetch(`${BASE}/animals/${animalId}/events`));
  },

  async createEvent(input: {
    animal_id: string;
    type: string;
    note_text?: string | null;
    source?: string;
    occurred_on?: string | null;
    payload?: Record<string, unknown> | null;
  }): Promise<AppEvent> {
    return j(
      await fetch(`${BASE}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
    );
  },

  async listReminders(householdId: string): Promise<Reminder[]> {
    return j(await fetch(`${BASE}/households/${householdId}/reminders`));
  },

  async markReminderDone(reminderId: string): Promise<Reminder> {
    return j(await fetch(`${BASE}/reminders/${reminderId}/done`, { method: "POST" }));
  },
};
