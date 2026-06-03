import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWizard } from "../WizardContext";
import { FieldWithMic } from "../components/FieldWithMic";
import { skinRecommendQuery } from "../queries";
import { completeInterview, suggestStep2 } from "../wizardApi";
import type { InterviewAnswers, OnboardingResult } from "../types";

function maskPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length > 10) digits = digits.slice(0, 10);
  let formatted = "";
  if (digits.length > 0) formatted = `(${digits.slice(0, 3)}`;
  if (digits.length >= 3) formatted += ") ";
  if (digits.length > 3) formatted += digits.slice(3, 6);
  if (digits.length >= 6) formatted += "-";
  if (digits.length > 6) formatted += digits.slice(6, 10);
  return formatted;
}

interface GenerateState {
  team: boolean;
  advantages: boolean;
}

export function OwnerInfoStep() {
  const { state, dispatch } = useWizard();
  const answers = state.interviewAnswers;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (answers.companyName && answers.industry) {
      void queryClient.prefetchQuery(skinRecommendQuery(answers));
    }
  }, [queryClient, answers]);

  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [zip, setZip] = useState("");
  const [phone, setPhone] = useState("");
  const [team, setTeam] = useState("");
  const [advantages, setAdvantages] = useState("");

  const [generating, setGenerating] = useState<GenerateState>({ team: false, advantages: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (field: "team" | "advantages") => {
    const companyName = answers.companyName;
    const industry = answers.industry;
    if (!companyName || !industry) return;

    setGenerating((g) => ({ ...g, [field]: true }));
    try {
      const data = await suggestStep2(companyName, industry, answers.services);
      if (data.success) {
        if (field === "team" && data.team) setTeam(data.team);
        if (field === "advantages" && data.advantages) setAdvantages(data.advantages);
      }
    } catch {
      /* keep existing text */
    } finally {
      setGenerating((g) => ({ ...g, [field]: false }));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const address = [street.trim(), city.trim(), stateCode.trim().toUpperCase(), zip.trim()]
      .filter(Boolean)
      .join(", ");

    const patch: Partial<InterviewAnswers> = {};
    if (address) patch.address = address;
    if (phone.trim()) patch.phone = phone.trim();
    if (team.trim()) patch.team = team.trim();
    if (advantages.trim()) patch.advantages = advantages.trim();
    dispatch({ type: "PATCH_ANSWERS", patch });

    const payload: Partial<InterviewAnswers> = {
      email: answers.email,
      companyName: answers.companyName,
      industry: answers.industry,
      services: answers.services,
      aboutUs: answers.aboutUs,
      ...patch,
    };
    if (state.tagline) payload.tagline = state.tagline;

    setSubmitting(true);
    try {
      const result = await completeInterview(payload);
      const onboarding = result as OnboardingResult;
      dispatch({ type: "SET_ONBOARDING_RESULT", result: onboarding });
      dispatch({ type: "GO_STATE", state: "configure" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete interview.");
      dispatch({ type: "SET_REVIEW_VIEW", view: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) {
    return (
      <div className="celebration-section">
        <div className="celebration">
          <div className="celebration-spinner" role="status" aria-label="Building" />
          <h2>Almost there</h2>
          <p>Building your website configuration…</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginTop: 32, marginBottom: 24 }}>
        <h1 className="wts-page-title">A few more details.</h1>
        <p className="wts-page-lede">All optional — skip what doesn't apply.</p>
      </div>

      {error ? (
        <div className="result-card error" style={{ marginBottom: 16 }}>
          <div className="error-detail">{error}</div>
        </div>
      ) : null}

      <div className="wts-card" style={{ maxWidth: 680 }}>
        <div className="wts-card-body">
          <form className="voice-form" onSubmit={submit}>
            <div className="wts-field">
              <label className="wts-field-label">Business address</label>
              <input
                className="wts-input"
                type="text"
                value={street}
                placeholder="Street address"
                style={{ marginBottom: 8 }}
                onChange={(e) => setStreet(e.target.value)}
              />
              <div className="field-row">
                <input
                  className="wts-input"
                  type="text"
                  value={city}
                  placeholder="City"
                  onChange={(e) => setCity(e.target.value)}
                />
                <input
                  className="wts-input"
                  type="text"
                  value={stateCode}
                  placeholder="State"
                  maxLength={2}
                  style={{ textTransform: "uppercase" }}
                  onChange={(e) => setStateCode(e.target.value)}
                />
                <input
                  className="wts-input"
                  type="text"
                  value={zip}
                  placeholder="ZIP"
                  maxLength={10}
                  onChange={(e) => setZip(e.target.value)}
                />
              </div>
            </div>

            <div className="wts-field">
              <label className="wts-field-label">Phone number</label>
              <input
                className="wts-input"
                type="tel"
                value={phone}
                placeholder="(555) 123-4567"
                maxLength={14}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
              />
            </div>

            <FieldWithMic
              label="About your team"
              multiline
              rows={3}
              value={team}
              placeholder="e.g., 10-person team led by industry veterans…"
              required={false}
              disabled={generating.team}
              onChange={setTeam}
              onTranscript={setTeam}
            >
              <button
                type="button"
                className={`btn-generate${generating.team ? " is-generating" : ""}`}
                disabled={generating.team}
                onClick={() => void generate("team")}
              >
                <svg className="icon-sparkle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                <svg
                  className="icon-spinner"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <circle cx="12" cy="12" r="10" opacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                {generating.team ? "Generating…" : "Generate with AI"}
              </button>
            </FieldWithMic>

            <FieldWithMic
              label="What makes you different?"
              multiline
              rows={3}
              value={advantages}
              placeholder="Your competitive advantages, unique selling points…"
              required={false}
              disabled={generating.advantages}
              onChange={setAdvantages}
              onTranscript={setAdvantages}
            >
              <button
                type="button"
                className={`btn-generate${generating.advantages ? " is-generating" : ""}`}
                disabled={generating.advantages}
                onClick={() => void generate("advantages")}
              >
                <svg className="icon-sparkle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                <svg
                  className="icon-spinner"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <circle cx="12" cy="12" r="10" opacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                {generating.advantages ? "Generating…" : "Generate with AI"}
              </button>
            </FieldWithMic>

            <div className="step-nav">
              <button
                type="button"
                className="wts-btn"
                onClick={() => dispatch({ type: "GO_STATE", state: "describe-voice" })}
              >
                ← Back
              </button>
              <button type="submit" className="wts-btn primary">
                Continue →
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
