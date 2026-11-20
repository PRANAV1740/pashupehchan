import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { dictionaries, en, type Dict, type Lang, type TKey } from "./strings";

export { LANGS } from "./strings";
export type { Lang, TKey } from "./strings";

type Vars = Record<string, string | number>;

interface Ctx {
  lang: Lang;
  chosen: boolean;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Vars) => string;
}

const I18nContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "pashu_lang";
const DEFAULT_LANG: Lang = "hi"; // Hindi-first, per the product

function readStored(): Lang | null {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s && s in dictionaries ? (s as Lang) : null;
  } catch {
    return null;
  }
}

function fill(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const stored = readStored();
  const [lang, setLangState] = useState<Lang>(stored ?? DEFAULT_LANG);
  const [chosen, setChosen] = useState<boolean>(stored !== null);

  useEffect(() => {
    try {
      document.documentElement.lang = lang;
    } catch {
      /* ignore */
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    setChosen(true);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: TKey, vars?: Vars) => {
      const dict = dictionaries[lang] as Partial<Dict>;
      const template = dict[key] ?? en[key] ?? key;
      return fill(template, vars);
    },
    [lang]
  );

  return <I18nContext.Provider value={{ lang, chosen, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useT(): (key: TKey, vars?: Vars) => string {
  return useI18n().t;
}
