import { useEffect, useState } from "react";
import { useOnboardingStream } from "~/hooks/useOnboardingStream";
import { useWizard } from "../WizardContext";
import { ProgressSteps, type ProgressStepDef } from "../components/ProgressSteps";
import { DeployResult } from "../components/DeployResult";
import { DomainDecision } from "../components/DomainDecision";
import { Paywall } from "../components/Paywall";
import { asPaywallError, errorText } from "../deployResult";
import { buildConfirmStreamPath } from "../wizardApi";
import { clearResumeSnapshot, saveResumeSnapshot } from "../resume";
import { MAX_DEPLOY_RETRIES } from "../constants";
import type { DeployResultPayload, PaywallError } from "../types";

const DEPLOY_STEPS: ProgressStepDef[] = [
  { id: "creating_site", label: "Creating WordPress site" },
  { id: "switching_skin", label: "Installing theme & default content" },
  { id: "applying_deployment", label: "Applying branding" },
  { id: "complete", label: "Done" },
];

export function ReviewStep() {
  const { state, dispatch } = useWizard();
  const stream = useOnboardingStream();
  const [paywall, setPaywall] = useState<PaywallError | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployResult, setDeployResult] = useState<DeployResultPayload | null>(null);

  useEffect(() => {
    if (state.reviewView !== "deploying" || !state.onboardingResult) return;
    setPaywall(null);
    setDeployError(null);
    setDeployResult(null);
    stream.start(String(state.deployNonce), buildConfirmStreamPath(state));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.deployNonce, state.reviewView]);

  useEffect(() => {
    if (state.reviewView !== "deploying") return;

    if (stream.status === "done" && stream.result) {
      const payload = stream.result as DeployResultPayload;
      if (payload.needsConfirmation) {
        dispatch({
          type: "SHOW_OWNED_DOMAIN",
          domain: payload.alreadyOwnedDomain || state.domain.trim(),
        });
      } else if (payload.success) {
        setDeployResult(payload);
        dispatch({ type: "SET_REVIEW_VIEW", view: "success" });
      } else {
        const pw = asPaywallError(payload.error);
        if (pw) setPaywall(pw);
        setDeployError(errorText(payload.error) || "Deployment failed");
        dispatch({ type: "SET_REVIEW_VIEW", view: "error" });
      }
    } else if (stream.status === "error") {
      const pw = asPaywallError(stream.error);
      if (pw) setPaywall(pw);
      setDeployError(errorText(stream.error) || "Deployment failed");
      dispatch({ type: "SET_REVIEW_VIEW", view: "error" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.status, stream.result, stream.error]);

  const backToSettings = () => {
    stream.stop();
    dispatch({ type: "RESET_RETRIES" });
    dispatch({ type: "GO_STATE", state: "configure" });
  };

  const retry = () => {
    if (state.deployRetryCount >= MAX_DEPLOY_RETRIES) return;
    dispatch({ type: "INCREMENT_RETRY" });
    dispatch({ type: "START_DEPLOY" });
  };

  const lastEvent = stream.events[stream.events.length - 1] ?? null;
  const attemptedSiteName =
    state.onboardingResult?.contentContext?.business?.name || state.domain.trim() || "";

  if (state.reviewView === "owned-domain") {
    return (
      <div style={{ marginTop: 16 }}>
        <div className="result-card error">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            Domain already registered
          </h3>
          <div className="error-detail">
            <strong>{state.decisionDomain}</strong> is already registered to your account from a previous deploy.
            Continue setting up its DNS and WordPress site?
          </div>
          <p className="error-subline">A new WordPress site will be created and pointed at this domain.</p>
          <div className="error-actions">
            <button className="wts-btn" onClick={backToSettings}>
              Cancel
            </button>
            <button
              className="wts-btn primary"
              onClick={() => {
                dispatch({ type: "RESET_RETRIES" });
                dispatch({ type: "SET_ACCEPT_OWNED_DOMAIN", value: true });
                dispatch({ type: "START_DEPLOY" });
              }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state.reviewView === "domain-decision") {
    return (
      <DomainDecision
        domain={state.decisionDomain}
        cnameTarget={state.decisionCname}
        companyName={state.interviewAnswers.companyName}
        onSaveResume={() => saveResumeSnapshot(state, state.decisionDomain)}
        onClearResume={clearResumeSnapshot}
        onVerifiedPublish={() => {
          dispatch({ type: "RESET_RETRIES" });
          dispatch({ type: "SET_ACCEPT_OWNED_DOMAIN", value: true });
          dispatch({ type: "START_DEPLOY" });
        }}
        onSubdomain={() => {
          dispatch({ type: "SET_DOMAIN", domain: "" });
          dispatch({ type: "SET_REGISTER_NEW_DOMAIN", value: false });
          dispatch({ type: "RESET_RETRIES" });
          dispatch({ type: "START_DEPLOY" });
        }}
        onBack={backToSettings}
      />
    );
  }

  if (state.reviewView === "success" && deployResult) {
    return (
      <div style={{ marginTop: 16 }}>
        <DeployResult data={deployResult} />
      </div>
    );
  }

  if (state.reviewView === "error") {
    const canRetry = state.deployRetryCount < MAX_DEPLOY_RETRIES;
    const subline =
      state.deployRetryCount > 0
        ? `Attempt ${state.deployRetryCount + 1} of ${MAX_DEPLOY_RETRIES + 1} failed.`
        : "Check your configuration and try again.";
    return (
      <div style={{ marginTop: 16 }}>
        {paywall ? (
          <Paywall error={paywall} attemptedSiteName={attemptedSiteName} onClose={() => setPaywall(null)} />
        ) : null}
        <div className="result-card error">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            Something went wrong
          </h3>
          <div className="error-detail">{deployError ?? "An unexpected error occurred."}</div>
          <p className="error-subline">{subline}</p>
          {!canRetry ? (
            <p className="error-limit-note">Retry limit reached. Adjust your settings and try again.</p>
          ) : null}
          <div className="error-actions">
            <button className="wts-btn" onClick={backToSettings}>
              Back to settings
            </button>
            {canRetry ? (
              <button className="wts-btn primary" onClick={retry}>
                Try again
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginTop: 32, marginBottom: 24 }}>
        <h1 className="wts-page-title">Publishing.</h1>
        <p className="wts-page-lede">Hang tight — usually 30–60 seconds.</p>
      </div>
      {paywall ? (
        <Paywall error={paywall} attemptedSiteName={attemptedSiteName} onClose={() => setPaywall(null)} />
      ) : null}
      <div style={{ marginTop: 16 }}>
        <div className="loading-block">
          <div className="spinner" />
          <p className="loading-text">Deploying your website…</p>
          <p className="loading-sub">This usually takes 30–60 seconds</p>
        </div>
        <ProgressSteps
          steps={DEPLOY_STEPS}
          activeId={lastEvent?.step ?? "creating_site"}
          activeMessage={lastEvent?.message ?? null}
          failed={false}
        />
      </div>
    </div>
  );
}
