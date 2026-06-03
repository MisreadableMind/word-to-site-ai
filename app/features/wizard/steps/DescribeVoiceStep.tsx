import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useMe } from "~/lib/auth";
import { useWizard } from "../WizardContext";
import { FieldWithMic } from "../components/FieldWithMic";
import { QuickChips } from "../components/QuickChips";
import {
  DEFAULT_ABOUT_OPTIONS,
  DEFAULT_SERVICE_OPTIONS,
  INDUSTRY_OPTIONS,
  SERVICES_BY_INDUSTRY,
} from "../constants";
import { generateTagline, matchIndustry, suggestOptions } from "../wizardApi";
import type { WizardField } from "../types";

function uniq(values: string[]): string[] {
  return [...new Set(values)];
}

function servicesForIndustry(industry: string): string[] {
  return SERVICES_BY_INDUSTRY[industry] ?? DEFAULT_SERVICE_OPTIONS;
}

export function DescribeVoiceStep() {
  const { state, dispatch } = useWizard();
  const { data: user } = useMe();
  const answers = state.interviewAnswers;

  const [serviceOptions, setServiceOptions] = useState<string[]>(DEFAULT_SERVICE_OPTIONS);
  const [aboutOptions, setAboutOptions] = useState<string[]>(DEFAULT_ABOUT_OPTIONS);
  const [regenerating, setRegenerating] = useState(false);

  const taglineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSuggestKey = useRef("");
  const emailPrefilled = useRef(false);

  useEffect(() => {
    if (!emailPrefilled.current && user?.email && !answers.email) {
      emailPrefilled.current = true;
      dispatch({ type: "SET_FIELD", field: "email", value: user.email });
    }
  }, [user?.email, answers.email, dispatch]);

  const setField = (field: WizardField, value: string) =>
    dispatch({ type: "SET_FIELD", field, value });

  const runTagline = async (companyName: string, industry: string) => {
    setRegenerating(true);
    try {
      const data = await generateTagline(companyName, industry);
      dispatch({ type: "SET_TAGLINE", tagline: data.tagline || "" });
    } catch {
      dispatch({ type: "SET_TAGLINE", tagline: "" });
    } finally {
      setRegenerating(false);
    }
  };

  const triggerCompanyIndustry = (companyName: string, industry: string) => {
    if (taglineTimer.current) clearTimeout(taglineTimer.current);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (!companyName || !industry) return;

    taglineTimer.current = setTimeout(() => void runTagline(companyName, industry), 800);

    const key = `${companyName}::${industry}`;
    if (key === lastSuggestKey.current) return;
    suggestTimer.current = setTimeout(async () => {
      try {
        const data = await suggestOptions(companyName, industry);
        if (!data.success) return;
        lastSuggestKey.current = key;
        if (data.services?.length) {
          setServiceOptions((prev) => uniq([...prev, ...(data.services ?? [])]));
        }
        if (data.about?.length) {
          setAboutOptions((prev) => uniq([...prev, ...(data.about ?? [])]));
        }
      } catch {
        /* keep existing chips */
      }
    }, 1000);
  };

  const onCompanyChange = (value: string) => {
    setField("companyName", value);
    triggerCompanyIndustry(value, answers.industry);
  };

  const onIndustryChange = (value: string) => {
    setField("industry", value);
    triggerCompanyIndustry(answers.companyName, value);
  };

  const selectIndustry = (option: string) => {
    setField("industry", option);
    setServiceOptions((prev) => uniq([...prev, ...servicesForIndustry(option)]));
    triggerCompanyIndustry(answers.companyName, option);
  };

  const toggleService = (option: string) => {
    const current = answers.services.split(",").map((s) => s.trim()).filter(Boolean);
    const next = current.includes(option)
      ? current.filter((s) => s !== option)
      : [...current, option];
    setField("services", next.join(", "));
  };

  const toggleAbout = (option: string) => {
    const current = answers.aboutUs
      .split(".")
      .map((s) => s.trim())
      .filter(Boolean);
    const next = current.includes(option)
      ? current.filter((s) => s !== option)
      : [...current, option];
    setField("aboutUs", next.length ? `${next.join(". ")}.` : "");
  };

  const onIndustryTranscript = async (text: string) => {
    try {
      const data = await matchIndustry(text, INDUSTRY_OPTIONS);
      const matched = data.success && data.matched ? data.matched : text;
      setField("industry", matched);
      if (INDUSTRY_OPTIONS.includes(matched)) {
        setServiceOptions((prev) => uniq([...prev, ...servicesForIndustry(matched)]));
      }
      triggerCompanyIndustry(answers.companyName, matched);
    } catch {
      setField("industry", text);
      triggerCompanyIndustry(answers.companyName, text);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: "GO_STATE", state: "details" });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 32, marginTop: 24 }}>
      <div>
        <h1 className="wts-page-title">Tell us about your business.</h1>
        <p className="wts-page-lede">Speak naturally with the mic or type — whatever's easier.</p>

        <form className="voice-form" onSubmit={submit} style={{ marginTop: 24 }}>
          <div className="wts-field">
            <label className="wts-field-label">
              Email <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              className="wts-input"
              type="email"
              value={answers.email}
              placeholder="you@company.com"
              required
              onChange={(e) => setField("email", e.target.value)}
            />
          </div>

          <FieldWithMic
            label={
              <>
                Company name <span style={{ color: "var(--danger)" }}>*</span>
              </>
            }
            multiline={false}
            rows={1}
            value={answers.companyName}
            placeholder="e.g., BrightPath"
            required
            disabled={false}
            onChange={onCompanyChange}
            onTranscript={onCompanyChange}
          />

          <FieldWithMic
            label={
              <>
                Industry <span style={{ color: "var(--danger)" }}>*</span>
              </>
            }
            multiline={false}
            rows={1}
            value={answers.industry}
            placeholder="e.g., Technology, Healthcare, Consulting"
            required
            disabled={false}
            onChange={onIndustryChange}
            onTranscript={onIndustryTranscript}
          >
            <QuickChips
              options={INDUSTRY_OPTIONS}
              mode="single"
              value={answers.industry}
              onToggle={selectIndustry}
            />
          </FieldWithMic>

          {state.tagline || regenerating ? (
            <div className="wts-field">
              <label className="wts-field-label">Tagline</label>
              <motion.div
                layout
                transition={{ duration: 0.28, ease: "easeOut" }}
                className={`tagline-box${regenerating ? " is-regenerating" : ""}`}
              >
                <motion.span layout="position" className="tagline-text">
                  {state.tagline ? `"${state.tagline}"` : ""}
                </motion.span>
                <div className="tagline-skeleton" aria-hidden="true" />
                <motion.button
                  layout="position"
                  type="button"
                  className="regenerate-btn"
                  disabled={regenerating}
                  onClick={() => {
                    if (answers.companyName && answers.industry) {
                      void runTagline(answers.companyName, answers.industry);
                    }
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 1 0 3-6.7" />
                    <polyline points="3 4 3 9 8 9" />
                  </svg>
                  <span>Regenerate</span>
                </motion.button>
              </motion.div>
            </div>
          ) : null}

          <FieldWithMic
            label={
              <>
                Services / Products <span style={{ color: "var(--danger)" }}>*</span>
              </>
            }
            multiline={false}
            rows={1}
            value={answers.services}
            placeholder="e.g., Web design, SEO, Branding"
            required
            disabled={false}
            onChange={(v) => setField("services", v)}
            onTranscript={(v) => setField("services", v)}
          >
            <QuickChips
              options={serviceOptions}
              mode="multi"
              value={answers.services}
              onToggle={toggleService}
            />
          </FieldWithMic>

          <FieldWithMic
            label={
              <>
                About your business <span style={{ color: "var(--danger)" }}>*</span>
              </>
            }
            multiline
            rows={3}
            value={answers.aboutUs}
            placeholder="Brief description of what you do and who you serve…"
            required
            disabled={false}
            onChange={(v) => setField("aboutUs", v)}
            onTranscript={(v) => setField("aboutUs", v)}
          >
            <QuickChips
              options={aboutOptions}
              mode="multi"
              value={answers.aboutUs}
              onToggle={toggleAbout}
            />
          </FieldWithMic>

          <div className="step-nav">
            <button type="button" className="wts-btn" onClick={() => dispatch({ type: "BACK_TO_PATH" })}>
              ← Back
            </button>
            <button type="submit" className="wts-btn primary">
              Continue →
            </button>
          </div>
        </form>
      </div>

      <aside
        className="right-rail"
        style={{ borderRadius: 8, maxHeight: 600, alignSelf: "start", position: "sticky", top: 24 }}
      >
        <div
          style={{
            fontSize: 11.5,
            color: "var(--muted-2)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            fontWeight: 600,
            marginBottom: 14,
          }}
        >
          What we'll know
        </div>
        <div className="right-rail-section">
          <div style={{ fontSize: 11, color: "var(--muted-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Tip
          </div>
          <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 6, lineHeight: 1.5 }}>
            Tap the mic on any field. We'll transcribe and auto-fill — including matching the right industry.
          </div>
        </div>
        <div className="right-rail-section">
          <div style={{ fontSize: 11, color: "var(--muted-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Up next
          </div>
          <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 6 }}>
            Optional details — address, phone, team.
          </div>
        </div>
      </aside>
    </div>
  );
}
