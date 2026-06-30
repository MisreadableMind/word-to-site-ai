import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMe } from "~/lib/auth";
import { AccountSubnav } from "~/components/AccountSubnav";
import { checkout, loadPlans } from "~/features/wizard/wizardApi";
import { PLAN_ORDER } from "~/features/wizard/constants";
import type { BillingPlan } from "~/features/wizard/types";
import "~/styles/plans.css";

const FEATURED = "pro";

type LoadState = "loading" | "loaded" | "error";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return String(n);
}

function planFeatures(plan: BillingPlan): string[] {
  const lines: string[] = [];
  lines.push(
    plan.maxSites === 1
      ? "1 live site"
      : `${plan.maxSites} live sites included`,
  );
  if (plan.extraSiteDayUsd != null) {
    lines.push(`Extra live sites: $${plan.extraSiteDayUsd.toFixed(2)} / day each`);
  }
  if (plan.siteTtlDays != null) {
    lines.push(`Sites expire after ${plan.siteTtlDays} days`);
  }
  lines.push(plan.customDomain === false ? "Live preview URL" : "Custom domains supported");
  lines.push(`${formatTokens(plan.monthlyTokens)} AI tokens / month`);
  lines.push(plan.tier === "free" ? "WordToSite badge in footer" : "No platform branding");
  return lines;
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Plans() {
  const { data: user } = useMe();
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [checkingOut, setCheckingOut] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await loadPlans();
        if (cancelled) return;
        const byTier = new Map((data.plans || []).map((p) => [p.tier, p]));
        const ordered = PLAN_ORDER.map((t) => byTier.get(t)).filter(
          (p): p is BillingPlan => Boolean(p),
        );
        setPlans(ordered);
        setLoadState("loaded");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = async (tier: string) => {
    setCheckingOut(tier);
    try {
      const data = await checkout(tier);
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setCheckingOut("");
    } catch {
      setCheckingOut("");
    }
  };

  const crumbName = user?.displayName || user?.email?.split("@")[0] || "Account";

  return (
    <>
      <div className="wts-top">
        <div className="wts-crumbs">
          <span>{crumbName}</span>
          <span className="sep">/</span>
          <span>Account</span>
          <span className="sep">/</span>
          <b>Plans</b>
        </div>
      </div>

      <div className="wts-content">
        <AccountSubnav />

        <div style={{ padding: "32px 36px 60px", maxWidth: 1280 }}>
          <h1 className="wts-page-title">Plans</h1>
          <p className="wts-page-lede">
            Pay for what you ship. Switch or cancel any time — prorated to the day.
          </p>

          {loadState === "error" ? (
            <div className="account-msg error" style={{ marginTop: 16 }}>
              Couldn't load plans. Billing may not be enabled on this deployment.
            </div>
          ) : null}

          <div className="plans-grid" style={{ marginTop: 24 }}>
            {plans.map((plan) => {
              const isCurrent = user?.planTier === plan.tier;
              const featured = plan.tier === FEATURED;
              const paid = plan.tier !== "free";
              return (
                <div key={plan.tier} className={`plan-card${isCurrent ? " selected" : ""}`}>
                  {isCurrent ? (
                    <span className="plan-tag">Your plan</span>
                  ) : featured ? (
                    <span className="plan-tag popular">Most popular</span>
                  ) : null}
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
                      {planFeatures(plan).map((f) => (
                        <li key={f}>
                          <CheckIcon />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="plan-cta">
                    {isCurrent ? (
                      <button type="button" className="wts-btn" disabled>
                        Current plan
                      </button>
                    ) : paid ? (
                      <button
                        type="button"
                        className={`wts-btn${featured ? " primary" : ""}`}
                        disabled={checkingOut !== ""}
                        onClick={() => void subscribe(plan.tier)}
                      >
                        {checkingOut === plan.tier ? "Redirecting…" : "Subscribe →"}
                      </button>
                    ) : (
                      <Link className="wts-btn" to="/dashboard">
                        Use free plan
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p style={{ fontSize: 12.5, color: "var(--muted-2)", textAlign: "center" }}>
            Prices in USD, billed monthly. All paid plans include the customer portal — switch tiers or
            cancel anytime.
          </p>
        </div>
      </div>
    </>
  );
}
