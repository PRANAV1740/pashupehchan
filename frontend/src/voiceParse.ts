/**
 * Lightweight, offline keyword parser for voice logging.
 *
 * It maps a spoken transcript to a best-guess event type and date. It is a
 * *convenience* that pre-selects the icon — the family always confirms (and can
 * correct) via the buttons, so partial coverage is fine. This keeps logging
 * working with no network and no API key; a hosted LLM parser can replace this
 * later behind the same `parseUtterance` signature.
 */
import type { Lang } from "./i18n";

export type EventType = "vaccination" | "illness" | "breeding" | "note";

// Substrings (lowercased) that signal each event type, across languages.
const TYPE_KEYWORDS: Record<Exclude<EventType, "note">, string[]> = {
  vaccination: [
    "vaccin", "injection", "shot", // en
    "टीक", "वैक्सीन", // hi
    "लस", // mr
    "રસી", // gu
    "ਟੀਕਾ", // pa
    "টিকা", // bn
    "தடுப்பூசி", "ஊசி", // ta
    "టీకా", // te
    "ಲಸಿಕೆ", // kn
  ],
  illness: [
    "sick", "ill", "fever", "not eating", "eating less", "weak", // en
    "बीमार", "बुखार", "कम खा", "खा नहीं", "कमजोर", // hi
    "आजार", "ताप", "कमी खा", // mr
    "બીમાર", "તાવ", "ઓછું ખા", // gu
    "ਬਿਮਾਰ", "ਬੁਖ਼ਾਰ", "ਘੱਟ ਖਾ", // pa
    "অসুখ", "জ্বর", "কম খা", // bn
    "நோய்", "காய்ச்சல்", "சாப்பிட", // ta
    "జబ్బు", "జ్వరం", "తక్కువ తిం", // te
    "ಕಾಯಿಲೆ", "ಜ್ವರ", "ಕಡಿಮೆ ತಿನ್", // kn
  ],
  breeding: [
    "breed", "heat", "pregnan", "insemin", "mating", // en
    "गर्भ", "गाभिन", "गरमी", "प्रजनन", // hi
    "माजावर", // mr
    "ગર્ભ", // gu
    "ਗਰਭ", // pa
    "গর্ভ", // bn
    "கர்ப்ப", "இனப்பெருக்க", // ta
    "గర్భ", // te
    "ಗರ್ಭ", // kn
  ],
};

// Substrings signalling "yesterday".
const YESTERDAY_KEYWORDS = [
  "yesterday", "कल", "काल", "ગઈકાલ", "ਕੱਲ੍ਹ", "গতকাল", "নেற்று", "நேற்று", "నిన్న", "ನಿನ್ನೆ",
];

export interface ParseResult {
  type: EventType | null;
  when: "today" | "yesterday";
}

export function parseUtterance(transcript: string, _lang: Lang): ParseResult {
  const text = transcript.toLowerCase();
  let type: EventType | null = null;
  for (const [t, words] of Object.entries(TYPE_KEYWORDS)) {
    if (words.some((w) => text.includes(w.toLowerCase()))) {
      type = t as EventType;
      break;
    }
  }
  const when = YESTERDAY_KEYWORDS.some((w) => text.includes(w.toLowerCase())) ? "yesterday" : "today";
  return { type, when };
}

/** Map the UI language to a BCP-47 tag for the Web Speech API. */
export function speechLang(lang: Lang): string {
  const map: Record<Lang, string> = {
    en: "en-IN",
    hi: "hi-IN",
    mr: "mr-IN",
    gu: "gu-IN",
    pa: "pa-IN",
    bn: "bn-IN",
    ta: "ta-IN",
    te: "te-IN",
    kn: "kn-IN",
  };
  return map[lang];
}
