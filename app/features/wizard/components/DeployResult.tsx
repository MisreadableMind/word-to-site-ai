import { useEffect, useRef, useState } from "react";
import { normalizeSite } from "../deployResult";
import type { DeployResultPayload } from "../types";

type SiteStatus = "checking" | "live" | "starting" | "unreachable";

function useSiteStatus(url: string): { status: SiteStatus; attempts: number } {
  const [status, setStatus] = useState<SiteStatus>("checking");
  const [attempts, setAttempts] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!url || startedRef.current) return;
    startedRef.current = true;
    let count = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const maxAttempts = 10;

    const ping = async () => {
      try {
        await fetch(url, { mode: "no-cors", cache: "no-cache" });
        setStatus("live");
      } catch {
        count += 1;
        setAttempts(count);
        if (count < maxAttempts) {
          setStatus("starting");
          timer = setTimeout(() => void ping(), 5000);
        } else {
          setStatus("unreachable");
        }
      }
    };
    void ping();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [url]);

  return { status, attempts };
}

function statusColor(status: SiteStatus): string {
  if (status === "live") return "var(--success)";
  if (status === "unreachable") return "var(--danger)";
  return "var(--warn)";
}

function statusLabel(status: SiteStatus, attempts: number): string {
  if (status === "live") return "Site is live";
  if (status === "unreachable") return "Could not reach site — it may still be provisioning";
  if (status === "starting") return `Starting up… (${attempts}/10)`;
  return "Checking site status…";
}

export function DeployResult({ data }: { data: DeployResultPayload }) {
  const site = normalizeSite(data.site);
  const finalUrl = data.finalUrls?.site || data.finalUrls?.temporaryUrl || "";
  const siteUrl = site?.url || finalUrl;
  const adminUrl = site?.adminUrl || (siteUrl ? `${siteUrl}/wp-admin` : "");
  const username = site?.username || "";
  const password = site?.password || "";
  const magicLogin = site?.magicLoginUrl || "";
  const loginTarget = magicLogin || adminUrl;
  const magicLoginFull = magicLogin ? `${window.location.origin}${magicLogin}` : "";

  const { status, attempts } = useSiteStatus(siteUrl);

  const tempUrl = data.finalUrls?.temporaryUrl;
  const showTemp = tempUrl && siteUrl && tempUrl !== siteUrl;

  return (
    <div className="result-card success">
      <h3>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        Website deployed
      </h3>

      {siteUrl ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 4px" }}>
            <span
              style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor(status), flexShrink: 0 }}
            />
            <span style={{ fontSize: 12, color: status === "live" || status === "unreachable" ? statusColor(status) : "var(--muted)" }}>
              {statusLabel(status, attempts)}
            </span>
          </div>

          <div className="site-url-prominent">
            <a href={siteUrl} target="_blank" rel="noopener">
              {siteUrl} ↗
            </a>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a href={loginTarget} target="_blank" rel="noopener" className="wts-btn accent lg" style={{ textDecoration: "none" }}>
              Open admin →
            </a>
            <a href={siteUrl} target="_blank" rel="noopener" className="wts-btn lg" style={{ textDecoration: "none" }}>
              View site ↗
            </a>
            <a href="/dashboard" className="wts-btn ghost lg" style={{ textDecoration: "none" }}>
              Back to sites
            </a>
          </div>
        </>
      ) : null}

      {username || password || magicLogin ? (
        <details
          style={{ marginTop: 20, background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", overflow: "hidden" }}
        >
          <summary style={{ padding: "12px 16px", cursor: "pointer", fontSize: 13, fontWeight: 500, userSelect: "none" }}>
            Site credentials &amp; magic login
          </summary>
          <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {magicLogin ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="result-label">Magic login</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span
                    style={{ flex: 1, fontFamily: "var(--mono)", fontSize: 12, padding: "6px 10px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-sm)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {magicLoginFull}
                  </span>
                  <a href={magicLoginFull} target="_blank" rel="noopener" className="wts-btn ghost" style={{ height: 28, padding: "0 10px", fontSize: 12 }}>
                    Open
                  </a>
                </div>
              </div>
            ) : null}
            {siteUrl ? (
              <div>
                <span className="result-label">Admin URL</span>
                <div style={{ fontSize: 12, fontFamily: "var(--mono)", marginTop: 4, wordBreak: "break-all" }}>{adminUrl}</div>
              </div>
            ) : null}
            {username ? (
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <span className="result-label">Username</span>
                  <div style={{ fontSize: 13, fontFamily: "var(--mono)", marginTop: 4 }}>{username}</div>
                </div>
                {password ? (
                  <div>
                    <span className="result-label">Password</span>
                    <div style={{ fontSize: 13, fontFamily: "var(--mono)", marginTop: 4 }}>{password}</div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      {showTemp ? (
        <div className="result-row">
          <span className="result-label">Temp URL</span>
          <span className="result-value">
            <a href={tempUrl} target="_blank" rel="noopener">
              {tempUrl}
            </a>
          </span>
        </div>
      ) : null}

      {data.editor ? (
        <div className="result-note">
          Editor:{" "}
          <a href={data.editor.url} target="_blank" rel="noopener" style={{ color: "var(--accent)", fontWeight: 500 }}>
            {data.editor.mode === "light" ? "Light editor" : "WP Admin"}
          </a>
          {data.editor.bounced ? ` (bounced: ${data.editor.reason})` : ""}
        </div>
      ) : null}
    </div>
  );
}
