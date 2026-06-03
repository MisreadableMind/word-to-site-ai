import { useEffect, useReducer, useRef, useState, type ReactElement } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { useMe } from "~/lib/auth";
import { WizardProvider } from "./WizardContext";
import { initialWizardData, wizardReducer } from "./wizardReducer";
import { Stepper } from "./components/Stepper";
import { PathStep } from "./steps/PathStep";
import { DescribeCopyStep } from "./steps/DescribeCopyStep";
import { DescribeVoiceStep } from "./steps/DescribeVoiceStep";
import { OwnerInfoStep } from "./steps/OwnerInfoStep";
import { ConfigureStep } from "./steps/ConfigureStep";
import { ReviewStep } from "./steps/ReviewStep";
import { clearResumeSnapshot, readResumeSnapshot } from "./resume";
import { domainBySession } from "./wizardApi";
import {
  RESUME_POLL_INTERVAL_MS,
  RESUME_POLL_MAX_ATTEMPTS,
} from "./constants";
import "~/styles/wizard.css";

type ResumeStatus = "idle" | "polling" | "failed" | "timeout";

export function Wizard() {
  const [state, dispatch] = useReducer(wizardReducer, initialWizardData);
  const { data: user } = useMe();
  const search = useSearch({ strict: false }) as Record<string, string | undefined>;
  const [resumeStatus, setResumeStatus] = useState<ResumeStatus>("idle");
  const [resumeDomain, setResumeDomain] = useState("");
  const [resumeError, setResumeError] = useState("");
  const resumeStarted = useRef(false);

  const crumbName = user?.displayName || user?.email?.split("@")[0] || "Account";

  useEffect(() => {
    const sessionId = search.resumeFromPurchase;
    if (!sessionId || resumeStarted.current) return;
    resumeStarted.current = true;

    const snap = readResumeSnapshot();
    if (!snap) {
      window.location.href = `/domains.html?session_id=${encodeURIComponent(sessionId)}`;
      return;
    }

    setResumeDomain(snap.domain);
    setResumeStatus("polling");

    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < RESUME_POLL_MAX_ATTEMPTS; attempt++) {
        if (cancelled) return;
        try {
          const data = await domainBySession(sessionId);
          const status = data.domain?.status;
          if (status === "registered") {
            clearResumeSnapshot();
            dispatch({
              type: "RESTORE",
              data: {
                onboardingResult: snap.onboardingResult,
                selectedSkin: snap.selectedSkin,
                selectedEditor: snap.selectedEditor,
                domain: snap.domain,
                registerNewDomain: false,
                acceptOwnedDomain: true,
                deployRetryCount: 0,
              },
            });
            setResumeStatus("idle");
            dispatch({ type: "START_DEPLOY" });
            return;
          }
          if (status === "failed") {
            clearResumeSnapshot();
            setResumeError(data.domain?.errorMessage || "Registration failed.");
            setResumeStatus("failed");
            return;
          }
        } catch {
          /* retry */
        }
        await new Promise((r) => setTimeout(r, RESUME_POLL_INTERVAL_MS));
      }
      if (cancelled) return;
      clearResumeSnapshot();
      setResumeStatus("timeout");
    })();

    return () => {
      cancelled = true;
    };
  }, [search]);

  let body: ReactElement;
  if (resumeStatus === "polling") {
    body = (
      <div className="result-card">
        <h3>Registering your domain…</h3>
        <div className="error-detail">
          Just a moment — finishing up <strong>{resumeDomain}</strong> and getting your site ready.
        </div>
      </div>
    );
  } else if (resumeStatus === "failed") {
    body = (
      <div className="result-card error">
        <h3>Domain registration failed</h3>
        <div className="error-detail">
          {resumeError} If you were charged, the payment was refunded automatically.
        </div>
        <div className="error-actions">
          <a className="wts-btn" href="/domains.html">
            Go to Domains
          </a>
        </div>
      </div>
    );
  } else if (resumeStatus === "timeout") {
    body = (
      <div className="result-card error">
        <h3>Taking longer than expected</h3>
        <div className="error-detail">
          Your domain is still being set up. You can finish from the Domains page once it's ready.
        </div>
        <div className="error-actions">
          <a className="wts-btn" href="/domains.html">
            Go to Domains
          </a>
        </div>
      </div>
    );
  } else {
    switch (state.stateName) {
      case "path":
        body = <PathStep />;
        break;
      case "describe-copy":
        body = <DescribeCopyStep />;
        break;
      case "describe-voice":
        body = <DescribeVoiceStep />;
        break;
      case "details":
        body = <OwnerInfoStep />;
        break;
      case "configure":
        body = <ConfigureStep />;
        break;
      case "review":
        body = <ReviewStep />;
        break;
      default:
        body = <PathStep />;
    }
  }

  return (
    <WizardProvider value={{ state, dispatch }}>
      <div className="wts-top">
        <div className="wts-crumbs">
          <span>{crumbName}</span>
          <span className="sep">/</span>
          <span>Sites</span>
          <span className="sep">/</span>
          <b>New site</b>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link className="wts-btn ghost" to="/dashboard" style={{ height: 28, padding: "0 10px", fontSize: 12 }}>
            Cancel ✕
          </Link>
        </div>
      </div>

      <div className="wts-content">
        <div style={{ padding: "28px 36px 60px", maxWidth: 1280, margin: "0 auto" }}>
          <Stepper flow={state.flow} stateName={state.stateName} />
          {body}
        </div>
      </div>
    </WizardProvider>
  );
}
