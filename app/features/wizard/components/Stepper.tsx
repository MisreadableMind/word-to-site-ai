import { STATE_INDEX, STEPPERS } from "../constants";
import type { WizardFlow, WizardState } from "../types";

export function Stepper({ flow, stateName }: { flow: WizardFlow | null; stateName: WizardState }) {
  const activeFlow: WizardFlow | "default" = flow && STEPPERS[flow] ? flow : "default";
  const labels = STEPPERS[activeFlow];
  const activeIndex = STATE_INDEX[activeFlow][stateName] ?? 0;

  return (
    <div className="wts-stepper">
      {labels.map((label, i) => {
        const cls = i < activeIndex ? "done" : i === activeIndex ? "active" : "todo";
        const glyph = cls === "done" ? "✓" : String(i + 1);
        return (
          <div key={label} style={{ display: "flex", alignItems: "center" }}>
            <div className={`wts-step ${cls}`}>
              <div className="wts-step-circle">{glyph}</div>
              <span className="wts-step-label">{label}</span>
            </div>
            {i < labels.length - 1 ? <div className="wts-step-connector" /> : null}
          </div>
        );
      })}
    </div>
  );
}
