import { useEffect, useState } from "react";
import { PLAN_ORDER } from "../constants";
import { checkout, loadPlans } from "../wizardApi";
import type { BillingPlan, PaywallError } from "../types";

interface PaywallProps {
  error: PaywallError;
  attemptedSiteName: string;
  onClose: () => void;
}

type LoadState = "loading" | "loaded" | "error";

function planFeatures(plan: BillingPlan): string[] {
  const out: string[] = [];
  out.push(plan.maxSites === 1 ? "1 live site" : `${plan.maxSites} live sites included`);
  if (plan.extraSiteDayUsd != null) {
    out.push(`Extra sites $${plan.extraSiteDayUsd.toFixed(2)} / day`);
  }
  const tokens =
    plan.monthlyTokens >= 1_000_000
      ? `${(plan.monthlyTokens / 1_000_000).toFixed(plan.monthlyTokens % 1_000_000 === 0 ? 0 : 1)}M tokens / mo`
      : `${Math.round(plan.monthlyTokens / 1000)}k tokens / mo`;
  out.push(tokens);
  if (plan.customDomain === "managed") out.push("Custom domains supported");
  return out;
}

function CheckSvg() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 7.5L5.5 10.5L11.5 4" />
    </svg>
  );
}

export function Paywall({ error, attemptedSiteName, onClose }: PaywallProps) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [shown, setShown] = useState<BillingPlan[]>([]);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  const planLabel =
    error.currentPlanLabel ||
    (error.currentPlan ? error.currentPlan[0]?.toUpperCase() + error.currentPlan.slice(1) : "Free");
  const limit = error.currentPlanLimit ?? 1;
  const siteWord = limit === 1 ? "site" : "sites";

  useEffect(() => {
    document.body.style.overflow = "hidden";
    let cancelled = false;
    (async () => {
      try {
        const data = await loadPlans();
        if (cancelled) return;
        const paid = (data.plans || []).filter((p) => p.tier !== "free");
        const currentIdx = PLAN_ORDER.indexOf(error.currentPlan || "free");
        const above = paid
          .filter((p) => PLAN_ORDER.indexOf(p.tier) > currentIdx)
          .sort((a, b) => PLAN_ORDER.indexOf(a.tier) - PLAN_ORDER.indexOf(b.tier))
          .slice(0, 2);
        setShown(above);
        setLoadState("loaded");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    })();
    return () => {
      cancelled = true;
      document.body.style.overflow = "";
    };
  }, [error.currentPlan]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const startCheckout = async (planTier: string) => {
    setCheckingOut(planTier);
    try {
      const data = await checkout(planTier);
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setCheckingOut(null);
    } catch {
      setCheckingOut(null);
    }
  };

  return (
    <div className="wts-paywall-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wts-paywall" role="dialog" aria-modal="true" aria-labelledby="paywallTitle">
        <button className="wts-paywall-close" type="button" aria-label="Close" onClick={onClose}>
          <svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
        <div className="wts-paywall-head">
          <div className="wts-paywall-eyebrow">
            <svg width="6" height="6" viewBox="0 0 6 6">
              <circle cx="3" cy="3" r="3" fill="currentColor" />
            </svg>
            <span>Plan limit reached</span>
          </div>
          <h2 id="paywallTitle" className="wts-page-title">
            One more step — pick a plan.
          </h2>
          <p className="wts-paywall-body">
            Your <strong>{planLabel}</strong> plan includes {limit} published {siteWord}.{" "}
            {error.blockingSiteName && attemptedSiteName ? (
              <>
                You're trying to publish <strong>{attemptedSiteName}</strong>, but{" "}
                <strong>{error.blockingSiteName}</strong> already takes that slot.
              </>
            ) : attemptedSiteName ? (
              <>
                You're trying to publish <strong>{attemptedSiteName}</strong>, but you've already reached that limit.
              </>
            ) : (
              <>You've reached that limit.</>
            )}
          </p>
        </div>

        <div className="wts-paywall-plans">
          {loadState === "loading" ? (
            <div className="wts-muted" style={{ gridColumn: "1 / -1", padding: "8px 0", fontSize: 13 }}>
              Loading plans…
            </div>
          ) : loadState === "error" ? (
            <div className="wts-muted" style={{ gridColumn: "1 / -1", padding: "8px 0", fontSize: 13 }}>
              Couldn't load plans. <a href="/pricing">See pricing →</a>
            </div>
          ) : shown.length === 0 ? (
            <div className="wts-muted" style={{ gridColumn: "1 / -1", padding: "8px 0", fontSize: 13 }}>
              You're already on the highest plan.
            </div>
          ) : (
            shown.map((plan, i) => {
              const recommended = i === shown.length - 1 && shown.length > 1;
              return (
                <div key={plan.tier} className={recommended ? "wts-paywall-card recommended" : "wts-paywall-card"}>
                  {recommended ? <div className="wts-paywall-rc">Recommended</div> : null}
                  <div className="wts-paywall-card-head">
                    <div>
                      <div className="wts-paywall-card-name">{plan.label}</div>
                      <div className="wts-paywall-card-tag">{plan.tagline || ""}</div>
                    </div>
                    <div className="wts-paywall-card-price">
                      <span className="amount">${plan.monthlyPriceUsd}</span>
                      <span className="per">/ month</span>
                    </div>
                  </div>
                  <ul className="wts-paywall-features">
                    {planFeatures(plan).map((f) => (
                      <li key={f}>
                        <CheckSvg /> {f}
                      </li>
                    ))}
                  </ul>
                  <div className="wts-paywall-card-cta">
                    <button
                      className={recommended ? "wts-btn primary" : "wts-btn"}
                      disabled={checkingOut !== null}
                      onClick={() => void startCheckout(plan.tier)}
                    >
                      {checkingOut === plan.tier ? "Redirecting…" : `Upgrade to ${plan.label}`}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="wts-paywall-trust">
          <div className="wts-paywall-trust-item">
            <CheckSvg />
            Prorated to the day
          </div>
          <div className="wts-paywall-trust-item">
            <CheckSvg />
            Cancel anytime
          </div>
        </div>
        <div className="wts-paywall-footer">
          <a href="/pricing">Compare all plans →</a>
        </div>
      </div>
    </div>
  );
}
