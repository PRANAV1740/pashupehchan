interface Props {
  emoji?: string;
  label: string;
  hint?: string;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  onClick?: () => void;
}

export default function BigButton({ emoji, label, hint, variant = "primary", disabled, onClick }: Props) {
  return (
    <button className={`bigbtn ${variant}`} disabled={disabled} onClick={onClick}>
      {emoji && <span className="emoji">{emoji}</span>}
      <span>
        {label}
        {hint && <span className="hint">{hint}</span>}
      </span>
    </button>
  );
}
