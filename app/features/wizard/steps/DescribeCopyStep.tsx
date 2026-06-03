import { useEffect, useState } from "react";
import { useOnboardingStream } from "~/hooks/useOnboardingStream";
import { useWizard } from "../WizardContext";
import { ProgressSteps, type ProgressStepDef } from "../components/ProgressSteps";
import type { OnboardingResult } from "../types";

const ANALYZE_STEPS: ProgressStepDef[] = [
  { id: "analyzing_source", label: "Scraping website content" },
  { id: "matching_template", label: "Matching template" },
  { id: "generating_contexts", label: "Generating configuration" },
  { id: "complete", label: "Done" },
];

export function DescribeCopyStep() {
  const { dispatch } = useWizard();
  const stream = useOnboardingStream();
  const [url, setUrl] = useState("");

  const lastEvent = stream.events[stream.events.length - 1] ?? null;

  useEffect(() => {
    if (stream.status === "done" && stream.result) {
      const result = stream.result as OnboardingResult;
      dispatch({ type: "SET_ONBOARDING_RESULT", result });
      dispatch({ type: "GO_STATE", state: "configure" });
    }
  }, [stream.status, stream.result, dispatch]);

  const scan = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    stream.start(`/api/onboard/analyze-url/stream?url=${encodeURIComponent(trimmed)}`);
  };

  const busy = stream.status === "streaming";

  return (
    <div>
      <div style={{ marginTop: 32, marginBottom: 24 }}>
        <h1 className="wts-page-title">Where does your site live?</h1>
        <p className="wts-page-lede">Paste a URL and we'll scrape pages, copy and assets.</p>
      </div>

      {busy ? (
        <>
          <div className="loading-block">
            <div className="spinner" />
            <p className="loading-text">Analyzing your website…</p>
            <p className="loading-sub">This usually takes 30–60 seconds</p>
          </div>
          <ProgressSteps
            steps={ANALYZE_STEPS}
            activeId={lastEvent?.step ?? "analyzing_source"}
            activeMessage={lastEvent?.message ?? null}
            failed={false}
          />
        </>
      ) : (
        <>
          <div className="wts-card" style={{ maxWidth: 680 }}>
            <div className="wts-card-body">
              <div className="wts-field" style={{ marginBottom: 14 }}>
                <label className="wts-field-label">Site URL</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="wts-input"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://yourwebsite.com"
                    style={{ flex: 1 }}
                  />
                  <button className="wts-btn primary" onClick={scan}>
                    Scan
                  </button>
                </div>
                <div className="wts-field-hint">
                  We'll scrape your site, extract branding, and match the best skin.
                </div>
              </div>
            </div>
          </div>

          {stream.status === "error" ? (
            <div className="result-card error" style={{ marginTop: 16 }}>
              <div className="error-detail">{stream.error ?? "Connection lost during analysis."}</div>
            </div>
          ) : null}

          <div className="step-nav">
            <button className="wts-btn" onClick={() => dispatch({ type: "BACK_TO_PATH" })}>
              ← Back
            </button>
          </div>
        </>
      )}
    </div>
  );
}
