import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { apiSend, ApiError } from "~/lib/api";
import "~/styles/pricing.css";

export const Route = createFileRoute("/_marketing/pricing")({
  component: Pricing,
  head: () => ({
    meta: [
      { title: "word→site | Plans" },
      {
        name: "description",
        content:
          "Simple, usage-based pricing for WordToSite. Start free, then pick a plan that scales with your sites, AI tokens, and voice commands. Switch or cancel any time.",
      },
    ],
  }),
});

type PlanTier = "free" | "starter" | "pro" | "business";

type Plan = {
  tier: PlanTier;
  label: string;
  tagline: string;
  monthlyPriceUsd: number;
  features: string[];
  cta: string;
  to: string;
};

const PLANS: Plan[] = [
  {
    tier: "free",
    label: "Free",
    tagline: "Try the basics",
    monthlyPriceUsd: 0,
    features: [
      "1 site",
      "Subdomain on wts.ai only",
      "50K AI tokens / month",
      "5 voice / day",
      "WordToSite badge in footer",
    ],
    cta: "Use free plan",
    to: "/dashboard",
  },
  {
    tier: "starter",
    label: "Starter",
    tagline: "For your first real site",
    monthlyPriceUsd: 19,
    features: [
      "1 site",
      "Bring your own domain",
      "250K AI tokens / month",
      "25 voice / day",
      "No platform branding",
    ],
    cta: "Subscribe →",
    to: "",
  },
  {
    tier: "pro",
    label: "Pro",
    tagline: "Best for growing teams",
    monthlyPriceUsd: 49,
    features: [
      "3 sites",
      "Buy custom domains (wholesale + 20%)",
      "1M AI tokens / month",
      "100 voice / day",
      "No platform branding",
    ],
    cta: "Subscribe →",
    to: "",
  },
  {
    tier: "business",
    label: "Business",
    tagline: "For agencies and publishers",
    monthlyPriceUsd: 99,
    features: [
      "10 sites",
      "Buy custom domains (wholesale + 20%)",
      "5M AI tokens / month",
      "500 voice / day",
      "No platform branding",
    ],
    cta: "Subscribe →",
    to: "",
  },
];

const FEATURED: PlanTier = "pro";

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Pricing() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<PlanTier | "">("");
  const [error, setError] = useState("");

  async function subscribe(planTier: PlanTier) {
    setError("");
    setPending(planTier);
    try {
      const { url } = await apiSend<{ url: string }>("/api/billing/checkout", "POST", { planTier });
      window.location.href = url;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate({ to: "/login", search: { redirect: "/pricing" } });
        return;
      }
      setError(err instanceof ApiError ? err.message : "Checkout failed. Please try again.");
      setPending("");
    }
  }

  return (
    <>
      <section id="plans" className="border-t">
        <div className="section-container">
          <div className="section-header center fade-in">
            <div className="section-eyebrow">plans</div>
            <h1 className="section-title">Pay for what you ship.</h1>
            <p className="section-desc">
              Switch or cancel any time — prorated to the day. All paid plans include the customer portal.
            </p>
          </div>

          {error ? <div className="pricing-msg">{error}</div> : null}

          <div className="pricing-grid fade-in">
            {PLANS.map((plan) => {
              const featured = plan.tier === FEATURED;
              const paid = plan.tier !== "free";
              return (
                <div className={`plan-card${featured ? " featured" : ""}`} key={plan.tier}>
                  {featured ? <span className="plan-tag">Most popular</span> : null}
                  <div className="plan-head">
                    <div className="plan-name">{plan.label}</div>
                    <div className="plan-tagline">{plan.tagline}</div>
                    <div className="plan-price-row">
                      <div className="plan-price">
                        <span className="currency">$</span>
                        {plan.monthlyPriceUsd}
                      </div>
                      <div className="plan-per">per month</div>
                    </div>
                  </div>
                  <div className="plan-feats">
                    <ul>
                      {plan.features.map((f) => (
                        <li key={f}>
                          <CheckIcon />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="plan-cta">
                    {paid ? (
                      <button
                        type="button"
                        className={`plan-btn${featured ? " primary" : ""}`}
                        disabled={pending === plan.tier}
                        onClick={() => subscribe(plan.tier)}
                      >
                        {pending === plan.tier ? "Redirecting…" : plan.cta}
                      </button>
                    ) : (
                      <Link className="plan-btn" to={plan.to}>
                        {plan.cta}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="pricing-foot">
            Prices in USD, billed monthly. All paid plans include the customer portal — switch tiers or
            cancel anytime. Questions? See our <Link to="/terms">terms</Link> or <Link to="/docs">docs</Link>.
          </p>
        </div>
      </section>

      <section className="border-t cta-section">
        <div className="section-container">
          <div className="fade-in">
            <h2 className="cta-title">Build your site first.<br />Pick a plan when you're ready.</h2>
            <p className="cta-desc">
              Start free and migrate or create a site by talking to it. Upgrade any time as you grow.
            </p>
            <div className="cta-actions">
              <Link className="btn-hero btn-hero-primary" to="/app">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="16" height="16">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                Create your site
              </Link>
              <a className="btn-hero btn-hero-secondary" href="#plans">Compare plans</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
