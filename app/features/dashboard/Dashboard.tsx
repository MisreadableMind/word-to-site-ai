import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { DateTime } from "luxon";
import clsx from "clsx";
import { useMe } from "~/lib/auth";
import { Dialog } from "~/components/Dialog";
import { colorForSite, siteBaseUrl, siteInitials } from "~/lib/site";
import { useDeleteSite, useSites, type Site } from "./queries";
import "~/styles/dashboard.css";

type Filter = "all" | "active" | "provisioning" | "deleted";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Live" },
  { key: "provisioning", label: "Provisioning" },
  { key: "deleted", label: "Archived" },
];

function StatusBadge({ status }: { status: string }) {
  if (status === "active")
    return <span className="wts-badge live"><span className="dot" />Live</span>;
  if (status === "provisioning")
    return <span className="wts-badge draft"><span className="dot" />Provisioning</span>;
  if (status === "deleted")
    return <span className="wts-badge archived"><span className="dot" />Archived</span>;
  return <span className="wts-badge archived"><span className="dot" />{status || "Unknown"}</span>;
}

function SiteRow({ site, onDelete }: { site: Site; onDelete: (id: string) => void }) {
  const displayUrl = site.domain || site.wp_url || "";
  const baseUrl = siteBaseUrl(site);
  const created = DateTime.fromISO(site.created_at).toLocaleString({
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <tr data-id={site.id}>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 30, height: 30, background: colorForSite(site), borderRadius: 5, color: "var(--bg)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
            {siteInitials(site.site_name)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 500, fontSize: 13.5 }}>{site.site_name || "Untitled site"}</div>
            <div className="wts-mono" style={{ fontSize: 11.5, color: "var(--muted-2)", marginTop: 1 }}>{displayUrl}</div>
          </div>
        </div>
      </td>
      <td style={{ color: "var(--muted)" }}>{site.template_slug || site.onboard_type || "—"}</td>
      <td><StatusBadge status={site.status} /></td>
      <td style={{ color: "var(--muted)" }}>{created}</td>
      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
        {baseUrl ? (
          <a className="wts-btn ghost" href={baseUrl} target="_blank" rel="noopener" style={{ height: 26, padding: "0 10px", fontSize: 12 }}>Visit ↗</a>
        ) : null}
        <Link className="wts-btn ghost" to="/editor" search={{ site: site.id }} style={{ height: 26, padding: "0 10px", fontSize: 12 }}>Open</Link>
        <button className="wts-btn ghost" onClick={() => onDelete(site.id)} style={{ height: 26, padding: "0 8px", fontSize: 12, color: "var(--danger)" }}>Delete</button>
      </td>
    </tr>
  );
}

export function Dashboard() {
  const { data: user } = useMe();
  const { data: sites, isLoading, isError } = useSites();
  const deleteSite = useDeleteSite();
  const [filter, setFilter] = useState<Filter>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const list = sites ?? [];
  const counts = {
    all: list.length,
    active: list.filter((s) => s.status === "active").length,
    provisioning: list.filter((s) => s.status === "provisioning").length,
    deleted: list.filter((s) => s.status === "deleted").length,
  };
  const filtered = filter === "all" ? list : list.filter((s) => s.status === filter);

  async function confirmDelete() {
    if (!deletingId) return;
    await deleteSite.mutateAsync(deletingId).catch(() => {});
    setDeletingId(null);
  }

  const crumbName = user?.displayName || user?.email?.split("@")[0] || "Account";

  return (
    <>
      <div className="wts-top">
        <div className="wts-crumbs">
          <span>{crumbName}</span>
          <span className="sep">/</span>
          <b>Sites</b>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link className="wts-btn primary" to="/app">
            <span className="ico">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3v10M3 8h10" /></svg>
            </span>
            New site
          </Link>
        </div>
      </div>

      <div className="wts-content">
        {isLoading ? (
          <div className="loading-state">Loading…</div>
        ) : (
          <div style={{ padding: "32px 36px 60px", maxWidth: 1280, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28 }}>
              <div>
                <h1 className="wts-page-title">Sites</h1>
                <p className="wts-page-lede">
                  {counts.all} site{counts.all !== 1 ? "s" : ""} · {counts.active} live · {counts.provisioning} provisioning · {counts.deleted} archived
                </p>
              </div>
            </div>

            {isError ? (
              <div className="wts-card" style={{ padding: 24, textAlign: "center", color: "var(--danger)" }}>Failed to load sites</div>
            ) : list.length === 0 ? (
              <div className="empty-card">
                <div className="empty-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
                </div>
                <h2 className="wts-page-sub" style={{ fontSize: 18 }}>No sites yet</h2>
                <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "8px 0 20px" }}>Create your first website in under 90 seconds.</p>
                <Link className="wts-btn primary" to="/app">
                  <span className="ico">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3v10M3 8h10" /></svg>
                  </span>
                  Create your first site
                </Link>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <div className="wts-tabs">
                    {FILTERS.map((f) => (
                      <button key={f.key} className={clsx("wts-tab", filter === f.key && "active")} onClick={() => setFilter(f.key)}>
                        {f.label} <span className="count">{counts[f.key]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="wts-card">
                  <div className="wts-card-head">
                    <div className="wts-card-title">Your sites</div>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 12, color: "var(--muted)" }}>
                      <span>Sort: <b style={{ color: "var(--ink)", fontWeight: 500 }}>Last updated</b> ↓</span>
                    </div>
                  </div>
                  {filtered.length === 0 ? (
                    <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted-2)", fontSize: 13.5 }}>No sites in this filter.</div>
                  ) : (
                    <table className="wts-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Type</th>
                          <th>Status</th>
                          <th>Created</th>
                          <th style={{ width: "1%", whiteSpace: "nowrap" }} />
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((site) => (
                          <SiteRow key={site.id} site={site} onDelete={setDeletingId} />
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <Dialog open={!!deletingId} onClose={() => setDeletingId(null)}>
        <h3 className="wts-page-sub" style={{ fontSize: 16, marginBottom: 8 }}>Delete site?</h3>
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 20 }}>
          This will remove the site from your dashboard. The WordPress instance will remain active.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="wts-btn" onClick={() => setDeletingId(null)}>Cancel</button>
          <button className="wts-btn danger" onClick={confirmDelete} disabled={deleteSite.isPending}>Delete</button>
        </div>
      </Dialog>
    </>
  );
}
