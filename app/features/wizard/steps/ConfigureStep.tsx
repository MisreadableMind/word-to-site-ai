import { useState } from "react";
import { useWizard } from "../WizardContext";
import { SkinPicker } from "../components/SkinPicker";
import { FIELD_LABELS } from "../constants";
import { checkDomainDns, classifyDomain } from "../wizardApi";
import type { WizardField } from "../types";

const SUMMARY_ORDER: WizardField[] = [
  "email",
  "companyName",
  "industry",
  "services",
  "aboutUs",
  "address",
  "phone",
  "team",
  "advantages",
];

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function truncate(value: string): string {
  return value.length > 80 ? `${value.slice(0, 77)}…` : value;
}

export function ConfigureStep() {
  const { state, dispatch } = useWizard();
  const answers = state.interviewAnswers;
  const [hint, setHint] = useState<{ text: string; error: boolean } | null>(null);
  const [checking, setChecking] = useState(false);

  const summaryItems = SUMMARY_ORDER.map((field) => ({ field, value: answers[field] })).filter(
    (item) => item.value,
  );

  const goBack = () => {
    if (state.flow === "voice") dispatch({ type: "GO_STATE", state: "details" });
    else if (state.flow === "copy") dispatch({ type: "GO_STATE", state: "describe-copy" });
    else dispatch({ type: "GO_STATE", state: "path" });
  };

  const publish = async () => {
    if (!state.onboardingResult) return;
    dispatch({ type: "RESET_RETRIES" });
    setHint(null);

    const domain = state.domain.trim();
    if (!domain || state.registerNewDomain) {
      dispatch({ type: "START_DEPLOY" });
      return;
    }

    setChecking(true);
    try {
      const classification = await classifyDomain(domain).catch(() => null);
      const kind = classification?.classification?.kind;
      if (kind === "invalid" || kind === "reserved" || kind === "platform_subdomain") {
        setHint({
          error: true,
          text:
            kind === "platform_subdomain"
              ? "This is a WordToSite-managed subdomain — you can't BYOD it."
              : kind === "reserved"
                ? "This TLD isn't available."
                : "Invalid domain format.",
        });
        setChecking(false);
        return;
      }

      const dns = await checkDomainDns(domain).catch(() => null);
      setChecking(false);
      if (dns && dns.pointsHere) {
        dispatch({ type: "SET_REVIEW_VIEW", view: "deploying" });
        return;
      }
      dispatch({
        type: "SHOW_DOMAIN_DECISION",
        domain,
        cname: dns?.expectedCnameTarget ?? "",
      });
    } catch {
      setChecking(false);
      dispatch({ type: "SET_REVIEW_VIEW", view: "deploying" });
    }
  };

  return (
    <div>
      <div style={{ marginTop: 32, marginBottom: 24 }}>
        <h1 className="wts-page-title">Configure your site.</h1>
        <p className="wts-page-lede">Pick a skin and (optionally) a domain.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
        <div>
          {summaryItems.length ? (
            <div style={{ marginBottom: 20 }}>
              <div className="section-label-row">Your website brief</div>
              <div className="wts-card">
                <div className="wts-card-body">
                  {summaryItems.map(({ field, value }) => (
                    <div className="summary-item" key={field}>
                      <span className="summary-label">{FIELD_LABELS[field] ?? field}</span>
                      <span className="summary-value">{truncate(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div>
            <div className="section-label-row">Choose your skin</div>
            <SkinPicker />
          </div>

          <div style={{ marginTop: 20 }}>
            <div className="section-label-row">Included features</div>
            <div className="included-features-grid">
              <div className="included-feature-item">
                <CheckIcon />
                Contact form
              </div>
              <div className="included-feature-item">
                <CheckIcon />
                AI blog posts
              </div>
              <div className="included-feature-item">
                <CheckIcon />
                SEO optimization
              </div>
              <div className="included-feature-item">
                <CheckIcon />
                Analytics
              </div>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <div className="section-label-row">Domain (optional)</div>
            <div className="wts-card">
              <div className="wts-card-body">
                <div className="wts-field">
                  <label className="wts-field-label">Custom domain</label>
                  <input
                    className="wts-input"
                    type="text"
                    value={state.domain}
                    placeholder="example.com"
                    onChange={(e) => dispatch({ type: "SET_DOMAIN", domain: e.target.value })}
                  />
                  <div
                    className="wts-field-hint"
                    style={hint?.error ? { color: "var(--danger)" } : undefined}
                  >
                    {hint
                      ? hint.text
                      : "Enter a domain you already own to point at your site. To register a new domain, complete onboarding first — you can buy one from your domains. Leave blank to use a free wts subdomain."}
                  </div>
                </div>
                <div className="step-nav" style={{ marginTop: 18, paddingTop: 0, borderTop: 0 }}>
                  <button className="wts-btn" onClick={goBack}>
                    ← Back
                  </button>
                  <button className="wts-btn accent" disabled={checking} onClick={() => void publish()}>
                    {checking ? "Checking…" : "Publish →"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside style={{ position: "sticky", top: 24, alignSelf: "start" }}>
          <div className="wts-card" style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 11.5, color: "var(--muted-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Almost there
            </div>
            <div className="wts-serif" style={{ fontSize: 20, marginTop: 4 }}>
              Step 3 of 4
            </div>
            <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.55 }}>
              Pick a skin and add a domain. You can change both later from the dashboard.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
