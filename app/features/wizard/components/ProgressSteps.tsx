export interface ProgressStepDef {
  id: string;
  label: string;
}

export type StepStatus = "pending" | "active" | "completed" | "error";

interface ProgressStepsProps {
  steps: ProgressStepDef[];
  activeId: string | null;
  activeMessage: string | null;
  failed: boolean;
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function ProgressSteps({ steps, activeId, activeMessage, failed }: ProgressStepsProps) {
  const activeIndex = activeId ? steps.findIndex((s) => s.id === activeId) : -1;

  return (
    <div className="workflow-progress">
      <div className="progress-card">
        <div className="progress-steps">
          {steps.map((step, i) => {
            let status: StepStatus = "pending";
            if (activeIndex === -1) {
              status = "pending";
            } else if (i < activeIndex) {
              status = "completed";
            } else if (i === activeIndex) {
              status = failed ? "error" : "active";
            }
            const label = status === "active" && activeMessage ? activeMessage : step.label;
            return (
              <div key={step.id} className={`progress-step ${status}`}>
                <span className="step-icon">
                  {status === "completed" ? <CheckIcon /> : status === "error" ? <CrossIcon /> : null}
                </span>
                <span className="step-label">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
