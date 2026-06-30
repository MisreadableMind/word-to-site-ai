import { useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { DateTime } from "luxon";
import clsx from "clsx";
import { ApiError } from "~/lib/api";
import { useMe } from "~/lib/auth";
import { AccountSubnav } from "~/components/AccountSubnav";
import {
  useInvoices,
  usePortal,
  useSubscription,
  type Invoice,
  type SubscriptionResponse,
} from "./queries";
import "~/styles/account.css";

type BannerKind = "success" | "warn" | "error";

interface Banner {
  kind: BannerKind;
  text: string;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function StatusBadge({ subscription }: { subscription: SubscriptionResponse["subscription"] }) {
  if (!subscription) {
    return (
      <span className="wts-badge archived">
        <span className="dot" />Free
      </span>
    );
  }
  const cls =
    subscription.status === "active"
      ? "live"
      : subscription.status === "past_due" || subscription.status === "canceled"
        ? "draft"
        : "";
  return (
    <span className={clsx("wts-badge", cls)}>
      <span className="dot" />
      {subscription.status}
    </span>
  );
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const date = DateTime.fromSeconds(invoice.created).toLocaleString({
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const statusClass = invoice.status === "paid" ? "live" : "draft";
  return (
    <tr>
      <td className="num">{date}</td>
      <td>{invoice.number || invoice.id}</td>
      <td className="num" style={{ textAlign: "right" }}>
        {formatMoney(invoice.amountPaid)} {invoice.currency.toUpperCase()}
      </td>
      <td>
        <span className={clsx("wts-badge", statusClass)}>
          <span className="dot" />
          {invoice.status}
        </span>
      </td>
      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
        {invoice.hostedInvoiceUrl ? (
          <a
            className="wts-btn ghost"
            href={invoice.hostedInvoiceUrl}
            target="_blank"
            rel="noopener"
            style={{ height: 24, padding: "0 8px", fontSize: 11.5 }}
          >
            View
          </a>
        ) : null}{" "}
        {invoice.invoicePdf ? (
          <a
            className="wts-btn ghost"
            href={invoice.invoicePdf}
            target="_blank"
            rel="noopener"
            style={{ height: 24, padding: "0 8px", fontSize: 11.5 }}
          >
            PDF
          </a>
        ) : null}
      </td>
    </tr>
  );
}

export function Billing() {
  const { data: user } = useMe();
  const search = useSearch({ strict: false }) as Record<string, string | undefined>;
  const subscriptionQuery = useSubscription();
  const invoicesQuery = useInvoices();
  const portal = usePortal();
  const [banner, setBanner] = useState<Banner | null>(null);

  const data = subscriptionQuery.data;
  const sub = data?.subscription ?? null;

  let derivedBanner: Banner | null = null;
  if (banner) {
    derivedBanner = banner;
  } else if (search.status === "success") {
    derivedBanner = {
      kind: "success",
      text: "Subscription updated. It may take a moment for the new plan to appear here.",
    };
  } else if (subscriptionQuery.isError) {
    const err = subscriptionQuery.error;
    if (err instanceof ApiError && err.status === 404) {
      derivedBanner = { kind: "warn", text: "Billing is not enabled on this deployment." };
    } else {
      derivedBanner = {
        kind: "error",
        text: err instanceof Error ? err.message : "Failed to load billing",
      };
    }
  } else if (sub && sub.status === "past_due") {
    derivedBanner = {
      kind: "warn",
      text: 'A recent payment failed. Update your payment method via "Manage subscription" to avoid losing access.',
    };
  } else if (sub && sub.cancelAtPeriodEnd) {
    derivedBanner = {
      kind: "warn",
      text: "Your subscription is set to cancel at the end of the current period.",
    };
  }

  async function openPortal() {
    setBanner(null);
    try {
      const result = await portal.mutateAsync();
      window.location.href = result.url;
    } catch (err) {
      setBanner({
        kind: "error",
        text: err instanceof ApiError ? err.message : "Failed",
      });
    }
  }

  const crumbName = user?.displayName || user?.email?.split("@")[0] || "Account";

  const periodEnd = sub?.currentPeriodEnd ? DateTime.fromISO(sub.currentPeriodEnd) : null;
  const renewsLabel = sub?.cancelAtPeriodEnd ? "Ends" : "Renews";
  const daysFromNow = periodEnd
    ? Math.max(0, Math.round(periodEnd.diff(DateTime.now(), "days").days))
    : 0;

  return (
    <>
      <div className="wts-top">
        <div className="wts-crumbs">
          <span>{crumbName}</span>
          <span className="sep">/</span>
          <span>Account</span>
          <span className="sep">/</span>
          <b>Billing</b>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {sub ? (
            <button className="wts-btn" onClick={openPortal} disabled={portal.isPending}>
              Manage subscription
            </button>
          ) : null}
        </div>
      </div>

      <div className="wts-content">
        <AccountSubnav />

        <div style={{ padding: "32px 36px 60px", maxWidth: 1080 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 24,
              gap: 24,
            }}
          >
            <div>
              <h1 className="wts-page-title">Billing</h1>
              <p className="wts-page-lede">Plan, payment, and invoice history.</p>
            </div>
            {sub && periodEnd ? (
              <div className="wts-card" style={{ padding: "14px 20px", minWidth: 260 }}>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--muted-2)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Next charge
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                  <div className="wts-serif" style={{ fontSize: 28 }}>
                    {sub.upcomingAmount ? formatMoney(sub.upcomingAmount) : "—"}
                  </div>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    on{" "}
                    {periodEnd.toLocaleString({
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {derivedBanner ? (
            <div className={`banner ${derivedBanner.kind}`}>{derivedBanner.text}</div>
          ) : null}

          <div className="wts-card" style={{ marginBottom: 16 }}>
            <div className="wts-card-head">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="wts-card-title">Current plan</span>
                <StatusBadge subscription={sub} />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Link className="wts-btn" to="/pricing">
                  Change plan
                </Link>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
              <div style={{ padding: "18px 20px", borderRight: "1px solid var(--line)" }}>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--muted-2)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Plan
                </div>
                <div className="wts-serif" style={{ fontSize: 22, marginTop: 4 }}>
                  {data ? data.entitlements.label || data.planTier : "—"}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  {sub && sub.priceLabel
                    ? sub.priceLabel
                    : (data?.planTier || "free").toUpperCase()}
                </div>
              </div>
              <div style={{ padding: "18px 20px", borderRight: "1px solid var(--line)" }}>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--muted-2)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Live sites
                </div>
                <div className="wts-serif" style={{ fontSize: 22, marginTop: 4 }}>
                  {data ? `${data.usage.sitesUsed}` : "—"}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  {data
                    ? data.usage.overageSites > 0 && data.usage.extraSiteDayUsd != null
                      ? `${data.usage.includedSites} included · ${data.usage.overageSites} extra @ $${data.usage.extraSiteDayUsd.toFixed(2)}/day`
                      : `${data.usage.includedSites} included`
                    : "included"}
                </div>
              </div>
              <div style={{ padding: "18px 20px", borderRight: "1px solid var(--line)" }}>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--muted-2)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  AI tokens / mo
                </div>
                <div className="wts-serif" style={{ fontSize: 22, marginTop: 4 }}>
                  {data ? (data.entitlements.monthlyTokens || 0).toLocaleString() : "—"}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  monthly allowance
                </div>
              </div>
              <div style={{ padding: "18px 20px" }}>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--muted-2)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {periodEnd ? renewsLabel : "Renews"}
                </div>
                <div className="wts-serif" style={{ fontSize: 22, marginTop: 4 }}>
                  {periodEnd ? periodEnd.toLocaleString({ month: "short", day: "numeric" }) : "—"}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  {periodEnd
                    ? `${daysFromNow} day${daysFromNow !== 1 ? "s" : ""} from now`
                    : sub
                      ? ""
                      : "No active subscription"}
                </div>
              </div>
            </div>
          </div>

          <div className="wts-card">
            <div className="wts-card-head">
              <span className="wts-card-title">Invoice history</span>
            </div>
            {invoicesQuery.isLoading ? (
              <div style={{ padding: 18, fontSize: 13, color: "var(--muted)" }}>Loading…</div>
            ) : invoicesQuery.isError ? (
              <div style={{ padding: 18, fontSize: 13, color: "var(--muted)" }}>
                Could not load invoices.
              </div>
            ) : !invoicesQuery.data || invoicesQuery.data.length === 0 ? (
              <div style={{ padding: 18, fontSize: 13, color: "var(--muted)" }}>
                No invoices yet.
              </div>
            ) : (
              <table className="wts-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Number</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {invoicesQuery.data.map((inv) => (
                    <InvoiceRow key={inv.id} invoice={inv} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
