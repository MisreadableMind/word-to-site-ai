import { useCallback, useEffect, useRef, useState } from "react";
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
  const [suggestLoading, setSuggestLoading] = useState(false);

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

  const runTagline = async () => {
    setRegenerating(true);
    try {
      const data = await generateTagline(answers);
      dispatch({ type: "SET_TAGLINE", tagline: data.tagline || "" });
    } catch {
      dispatch({ type: "SET_TAGLINE", tagline: "" });
    } finally {
      setRegenerating(false);
    }
  };

  const triggerCompanyIndustry = (companyName: string, industry: string) => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (!companyName || !industry) {
      if (industry) setServiceOptions(servicesForIndustry(industry));
      setSuggestLoading(false);
      return;
    }

    const key = `${companyName}::${industry}`;
    if (key === lastSuggestKey.current) {
      setSuggestLoading(false);
      return;
    }
    setSuggestLoading(true);
    suggestTimer.current = setTimeout(async () => {
      try {
        const data = await suggestOptions(companyName, industry);
        if (!data.success) {
          setServiceOptions(servicesForIndustry(industry));
          return;
        }
        lastSuggestKey.current = key;
        setServiceOptions(data.services?.length ? uniq(data.services) : servicesForIndustry(industry));
        if (data.about?.length) setAboutOptions(uniq(data.about));
      } catch {
        setServiceOptions(servicesForIndustry(industry));
      } finally {
        setSuggestLoading(false);
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
    triggerCompanyIndustry(answers.companyName, option);
  };

  const toggleService = useCallback(
    (option: string) => {
      const current = answers.services.split(",").map((s) => s.trim()).filter(Boolean);
      const next = current.includes(option)
        ? current.filter((s) => s !== option)
        : [...current, option];
      dispatch({ type: "SET_FIELD", field: "services", value: next.join(", ") });
    },
    [answers.services, dispatch],
  );

  const toggleAbout = useCallback(
    (option: string) => {
      const current = answers.aboutUs.split(".").map((s) => s.trim()).filter(Boolean);
      const next = current.includes(option)
        ? current.filter((s) => s !== option)
        : [...current, option];
      dispatch({ type: "SET_FIELD", field: "aboutUs", value: next.length ? `${next.join(". ")}.` : "" });
    },
    [answers.aboutUs, dispatch],
  );

  const onIndustryTranscript = async (text: string) => {
    try {
      const data = await matchIndustry(text, INDUSTRY_OPTIONS);
      const matched = data.success && data.matched ? data.matched : text;
      setField("industry", matched);
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
              loading={false}
              onToggle={selectIndustry}
            />
          </FieldWithMic>

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
              loading={suggestLoading}
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
              loading={suggestLoading}
              onToggle={toggleAbout}
            />
          </FieldWithMic>

          <div className="wts-field">
            <label className="wts-field-label">
              Tagline <span style={{ color: "var(--muted-2)", fontWeight: 400 }}>(optional)</span>
            </label>
            <motion.div
              layout
              transition={{ duration: 0.28, ease: "easeOut" }}
              className={`tagline-box${regenerating ? " is-regenerating" : ""}`}
            >
              <motion.span
                layout="position"
                className="tagline-text"
                style={state.tagline ? undefined : { color: "var(--muted-2)" }}
              >
                {state.tagline ? `"${state.tagline}"` : "No tagline yet — generate one (optional)."}
              </motion.span>
              <div className="tagline-skeleton" aria-hidden="true" />
              <motion.button
                layout="position"
                type="button"
                className="regenerate-btn"
                disabled={regenerating || !answers.companyName || !answers.industry}
                onClick={() => {
                  if (answers.companyName && answers.industry) {
                    void runTagline();
                  }
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 3-6.7" />
                  <polyline points="3 4 3 9 8 9" />
                </svg>
                <span>{regenerating ? "Generating…" : state.tagline ? "Regenerate" : "Generate"}</span>
              </motion.button>
            </motion.div>
            {!regenerating && (!answers.companyName || !answers.industry) ? (
              <div className="wts-field-hint">
                Add your company name and industry first to generate a tagline.
              </div>
            ) : null}
          </div>

          <motion.div layout transition={{ duration: 0.28, ease: "easeOut" }} className="step-nav">
            <button type="button" className="wts-btn" onClick={() => dispatch({ type: "BACK_TO_PATH" })}>
              ← Back
            </button>
            <button type="submit" className="wts-btn primary">
              Continue →
            </button>
          </motion.div>
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
