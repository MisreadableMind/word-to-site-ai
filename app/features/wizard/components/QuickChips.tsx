import type { ChipMode } from "../constants";

interface QuickChipsProps {
  options: string[];
  mode: ChipMode;
  value: string;
  onToggle: (option: string) => void;
}

function isSelected(value: string, option: string): boolean {
  return value.includes(option);
}

export function QuickChips({ options, value, onToggle }: QuickChipsProps) {
  return (
    <div className="quick-options">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={`quick-chip${isSelected(value, option) ? " selected" : ""}`}
          onClick={() => onToggle(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
