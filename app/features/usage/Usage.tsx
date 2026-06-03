import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMe } from "~/lib/auth";
import { AccountSubnav } from "~/components/AccountSubnav";
import { useSites, type Site } from "~/features/dashboard/queries";
import { useSiteUsage, type Usage as UsageData } from "./queries";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function getDomain(site: Site): string | null {
  try {
    return site.wp_url ? new URL(site.wp_url).hostname : site.domain;
  } catch {
    return site.domain;
  }
}

function getSiteName(site: Site): string {
  return site.site_name || site.domain || "Unnamed site";
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="wts-badge live">
        <span className="dot" />Active
      </span>
    );
  }
  return (
    <span className="wts-badge archived">
      <span className="dot" />
      {status}
    </span>
  );
}

function UsageBody({ site, usage }: { site: Site; usage: UsageData | null }) {
  const domain = getDomain(site) || "—";

  if (!usage) {
    return (
      <div className="wts-card">
        <div className="wts-card-head">
          <span className="wts-card-title">{getSiteName(site)}</span>
          <span className="wts-mono" style={{ fontSize: 12, color: "var(--muted)" }}>
            {domain}
          </span>
        </div>
        <div
          className="wts-card-body"
          style={{ textAlign: "center", padding: "48px 24px", color: "var(--muted-2)" }}
        >
          <div style={{ fontSize: 14 }}>No usage data yet</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>
            AI proxy key will be registered automatically when your site is deployed.
          </div>
        </div>
      </div>
    );
  }

  const used = usage.tokensUsed || 0;
  const limit = usage.tokenLimit || 0;
  const pct = limit > 0 ? (used / limit) * 100 : 0;
  const barPct = Math.min(pct, 100);
  const barColor = pct > 90 ? "var(--danger)" : pct > 70 ? "var(--warn)" : "var(--ink)";
  const status = usage.status || "active";

  return (
    <>
      <div className="wts-card" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          <div style={{ padding: "20px 22px", borderRight: "1px solid var(--line)" }}>
            <div
              style={{
                fontSize: 11.5,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Tokens used
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6 }}>
              <div className="wts-serif" style={{ fontSize: 36 }}>
                {formatTokens(used)}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>/ {formatTokens(limit)}</div>
            </div>
            <div style={{ marginTop: 6, height: 4, background: "var(--bg-3)", borderRadius: 2 }}>
              <div
                style={{
                  width: `${barPct.toFixed(1)}%`,
                  height: "100%",
                  background: barColor,
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
          <div style={{ padding: "20px 22px", borderRight: "1px solid var(--line)" }}>
            <div
              style={{
                fontSize: 11.5,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Usage
            </div>
            <div className="wts-serif" style={{ fontSize: 36, marginTop: 6 }}>
              {pct.toFixed(1)}%
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              of monthly limit
            </div>
          </div>
          <div style={{ padding: "20px 22px", borderRight: "1px solid var(--line)" }}>
            <div
              style={{
                fontSize: 11.5,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Remaining
            </div>
            <div className="wts-serif" style={{ fontSize: 36, marginTop: 6 }}>
              {formatTokens(Math.max(0, limit - used))}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>tokens left</div>
          </div>
          <div style={{ padding: "20px 22px" }}>
            <div
              style={{
                fontSize: 11.5,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Period
            </div>
            <div className="wts-serif" style={{ fontSize: 22, marginTop: 6 }}>
              {usage.period || "—"}
            </div>
            <div style={{ marginTop: 8 }}>
              <StatusBadge status={status} />
            </div>
          </div>
        </div>
      </div>

      <div className="wts-card">
        <div className="wts-card-head">
          <span className="wts-card-title">{getSiteName(site)}</span>
          <span className="wts-mono" style={{ fontSize: 12, color: "var(--muted)" }}>
            {domain}
          </span>
        </div>
        <table className="wts-table">
          <tbody>
            <tr>
              <td style={{ color: "var(--muted)", width: 200 }}>Status</td>
              <td>
                <StatusBadge status={status} />
              </td>
            </tr>
            <tr>
              <td style={{ color: "var(--muted)" }}>Period</td>
              <td>{usage.period || "—"}</td>
            </tr>
            <tr>
              <td style={{ color: "var(--muted)" }}>Tokens used</td>
              <td className="num">{used.toLocaleString()}</td>
            </tr>
            <tr>
              <td style={{ color: "var(--muted)" }}>Token limit</td>
              <td className="num">{limit.toLocaleString()}</td>
            </tr>
            <tr>
              <td style={{ color: "var(--muted)" }}>Remaining</td>
              <td className="num">{Math.max(0, limit - used).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

export function Usage() {
  const { data: user } = useMe();
  const sitesQuery = useSites();
  const [selectedId, setSelectedId] = useState<string>("");

  const sites = (sitesQuery.data ?? []).filter((s) => s.wp_url || s.domain);

  useEffect(() => {
    const first = sites[0];
    if (!selectedId && first) {
      setSelectedId(first.id);
    }
  }, [sites, selectedId]);

  const selectedSite = sites.find((s) => s.id === selectedId);
  const usageQuery = useSiteUsage(selectedSite ? selectedId : undefined);

  const crumbName = user?.displayName || user?.email?.split("@")[0] || "Account";

  return (
    <>
      <div className="wts-top">
        <div className="wts-crumbs">
          <span>{crumbName}</span>
          <span className="sep">/</span>
          <span>Account</span>
          <span className="sep">/</span>
          <b>Usage</b>
        </div>
        {sites.length > 0 ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Site:</span>
            <select
              className="wts-input"
              style={{ height: 30, minWidth: 200, padding: "0 28px 0 10px", fontSize: 13 }}
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {getSiteName(s)}
                </option>
              ))}
            </select>
          </div>
        ) : null}
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
              <h1 className="wts-page-title">Usage</h1>
              <p className="wts-page-lede">AI proxy token usage this month. Hourly refresh.</p>
            </div>
          </div>

          {sitesQuery.isLoading ? (
            <div className="loading-state">Loading usage data…</div>
          ) : sitesQuery.isError ? (
            <div
              className="wts-card"
              style={{ padding: 24, textAlign: "center", color: "var(--danger)" }}
            >
              Failed to load sites.
            </div>
          ) : sites.length === 0 ? (
            <div
              className="wts-card"
              style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}
            >
              No sites with domains yet. Create your first site from the{" "}
              <Link to="/dashboard" style={{ color: "var(--accent)" }}>
                dashboard
              </Link>
              .
            </div>
          ) : usageQuery.isLoading || !selectedSite ? (
            <div className="loading-state">Loading usage…</div>
          ) : (
            <UsageBody site={selectedSite} usage={usageQuery.data ?? null} />
          )}
        </div>
      </div>
    </>
  );
}
