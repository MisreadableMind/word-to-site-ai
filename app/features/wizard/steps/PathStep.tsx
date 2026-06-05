import { useWizard } from "../WizardContext";
import type { WizardFlow } from "../types";

interface PathCardProps {
  flow: WizardFlow;
  label: string;
  time: string;
  title: string;
  body: string;
  steps: string[];
  selected: boolean;
  onSelect: () => void;
}

function PathCard({ label, time, title, body, steps, selected, onSelect }: PathCardProps) {
  return (
    <button type="button" className={`choice-card${selected ? " selected" : ""}`} onClick={onSelect}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="choice-card-label">{label}</span>
        <span className="wts-badge badge-time">{time}</span>
        <span className="wts-badge accent badge-selected">
          <span className="dot" />
          Selected
        </span>
      </div>
      <h3 className="choice-card-title">{title}</h3>
      <p className="choice-card-body">{body}</p>
      <ol className="choice-card-steps">
        {steps.map((step, i) => (
          <li key={step}>
            <span className="n">{i + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </button>
  );
}

export function PathStep() {
  const { state, dispatch } = useWizard();

  return (
    <div>
      <div style={{ marginTop: 36, marginBottom: 28 }}>
        <h1 className="wts-page-title">How would you like to start?</h1>
        <p className="wts-page-lede">Two paths. Both end at a published site you can edit by voice.</p>
      </div>

      <div className="choice-grid">
        <PathCard
          flow="voice"
          label="A · From scratch"
          time="~90 sec"
          title="Start fresh"
          body="Fill out a quick form about your business. We'll draft pages, copy and a skin from scratch."
          steps={[
            "Tell us about your business",
            "Auto-generated pages and copy",
            "Skin & domain selection",
            "Publish",
          ]}
          selected={state.flow === "voice"}
          onSelect={() => dispatch({ type: "SELECT_FLOW", flow: "voice" })}
        />
        <PathCard
          flow="copy"
          label="B · Migrate existing"
          time="~2 min"
          title="Migrate from URL"
          body="Point us at your current site. We'll scrape pages, copy and assets, then rebuild on a calmer foundation."
          steps={[
            "Paste a URL",
            "Auto-extract brand & structure",
            "Choose skin & domain",
            "Publish",
          ]}
          selected={state.flow === "copy"}
          onSelect={() => dispatch({ type: "SELECT_FLOW", flow: "copy" })}
        />
      </div>

      <div className="step-nav" style={{ marginTop: 32 }}>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>You can switch paths until you publish.</span>
        <div style={{ display: "flex", gap: 8 }}>
          <a className="wts-btn" href="/dashboard">
            ← Back
          </a>
          <button
            className="wts-btn primary"
            disabled={!state.flow}
            onClick={() =>
              dispatch({
                type: "GO_STATE",
                state: state.flow === "copy" ? "describe-copy" : "describe-voice",
              })
            }
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
