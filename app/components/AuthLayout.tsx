import { useEffect } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMe } from "~/lib/auth";
import "~/styles/auth.css";

const RIGHT_COPY = {
  login: {
    heading: "Write to your site, instead of clicking through it.",
    body: "Voice and prompts replace dashboards. Talk to your site like you'd brief a designer — it edits in place.",
  },
  register: {
    heading: "A website is one conversation away.",
    body: "Describe what you want — a portfolio, a bakery, a band. We draft pages, copy and a skin. You tune everything by voice.",
  },
} as const;

export function AuthLayout({
  variant,
  children,
}: {
  variant: "login" | "register";
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, string | undefined>;
  const { data: user } = useMe();

  useEffect(() => {
    document.documentElement.dataset.theme = "platform";
  }, []);

  useEffect(() => {
    if (user) navigate({ to: search.redirect || "/dashboard", replace: true });
  }, [user, navigate, search]);

  const right = RIGHT_COPY[variant];

  return (
    <div className="wts">
      <div className="auth-grid">
        <div className="auth-left">
          <Link className="auth-brand-row" to="/">
            <div className="wts-mark">w</div>
            <span className="wts-wordmark">
              word<span className="arrow">→</span>site
            </span>
          </Link>

          <div className="auth-left-form">{children}</div>

          <div className="auth-foot">
            <span>© 2026 word→site</span>
            <span style={{ display: "flex", gap: 18 }}>
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
            </span>
          </div>
        </div>

        <div className="auth-right">
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <span className="wts-badge accent">
              <span className="dot" />v2 · platform
            </span>
          </div>

          <div>
            <h2
              className="wts-serif"
              style={{ fontSize: 38, lineHeight: 1.08, letterSpacing: "-0.022em", maxWidth: "22ch" }}
            >
              {right.heading}
            </h2>
            <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 14, maxWidth: "44ch", lineHeight: 1.55 }}>
              {right.body}
            </p>
          </div>

          <div className="wts-card" style={{ padding: 18, boxShadow: "var(--shadow-md)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 22, height: 22, background: "var(--ink)", borderRadius: 4, color: "var(--bg)", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 600 }}>
                  CB
                </div>
                <span style={{ fontWeight: 500 }}>Casa Bom Pão</span>
              </div>
              <span className="wts-badge live">
                <span className="dot" />Live
              </span>
            </div>
            <div className="wts-voice-bar" style={{ padding: "10px 12px", background: "var(--bg)" }}>
              <div className="wts-voice-mic" style={{ width: 28, height: 28 }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="6" y="2" width="4" height="8" rx="2" />
                  <path d="M3.5 8a4.5 4.5 0 009 0M8 12.5v2M5.5 14.5h5" />
                </svg>
              </div>
              <div className="wts-voice-waveform active">
                <svg viewBox="0 0 240 28" preserveAspectRatio="none">
                  <path d="M0,14 Q15,14 30,11 T60,14 T90,9 T120,14 T150,12 T180,15 T210,11 T240,14" />
                </svg>
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--muted)", fontStyle: "italic" }}>
              "Make the headline quieter — italicise Sunday."
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted-2)" }}>
            <span>500 voice min/mo · unlimited drafts</span>
            <span>14-day free trial</span>
          </div>
        </div>
      </div>
    </div>
  );
}
