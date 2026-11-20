import { LANGS, useI18n } from "../i18n";

interface Props {
  dismissable?: boolean;
  onClose?: () => void;
}

/** Full-screen language picker. Shown on first launch (not dismissable) and
 * from the top-bar globe (dismissable). */
export default function LanguageSheet({ dismissable, onClose }: Props) {
  const { lang, setLang, t } = useI18n();

  function pick(code: (typeof LANGS)[number]["code"]) {
    setLang(code);
    onClose?.();
  }

  return (
    <div className="lang-sheet" role="dialog" aria-modal="true">
      <div className="lang-sheet-inner">
        <div className="lang-sheet-head">
          <div className="brand">{t("lang.choose")}</div>
          {dismissable && (
            <button className="back" onClick={onClose} aria-label={t("common.back")}>
              ✕
            </button>
          )}
        </div>
        <div className="lang-list">
          {LANGS.map((l) => (
            <button
              key={l.code}
              className={`lang-item ${l.code === lang ? "active" : ""}`}
              onClick={() => pick(l.code)}
            >
              <span className="lang-native">{l.native}</span>
              <span className="lang-english">{l.english}</span>
              {l.code === lang && <span className="lang-check">✓</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
