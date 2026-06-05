interface PreviewPaneProps {
  wpUrl: string;
  displayUrl: string;
  visitUrl: string;
  adminUrl: string;
  changesCount: number;
}

export function PreviewPane({
  wpUrl,
  displayUrl,
  visitUrl,
  adminUrl,
  changesCount,
}: PreviewPaneProps) {
  const hasSite = !!wpUrl;
  return (
    <aside className="preview-pane">
      <div className="preview-head">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="preview-head-label">Preview</span>
          <span className="wts-mono" style={{ fontSize: 12, color: "var(--ink)" }}>
            /
          </span>
        </div>
        <div className="wts-tabs">
          <button className="wts-tab active">Desktop</button>
        </div>
      </div>
      <div className="preview-body">
        {hasSite ? (
          <div className="preview-frame">
            <div className="preview-chrome">
              <div className="preview-chrome-dots">
                <span style={{ background: "#E27D60" }} />
                <span style={{ background: "#E8B26F" }} />
                <span style={{ background: "#67B26F" }} />
              </div>
              <span className="preview-chrome-url">{displayUrl}</span>
            </div>
            <iframe
              className="preview-iframe"
              src={wpUrl}
              loading="lazy"
              sandbox="allow-same-origin allow-scripts"
              tabIndex={-1}
              title="Site preview"
            />
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--muted)" }}>
            <div
              className="wts-mono"
              style={{
                fontSize: 11,
                color: "var(--muted-2)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              No site loaded
            </div>
            <p style={{ fontSize: 13, marginTop: 8 }}>
              Open a site from your dashboard to preview it here.
            </p>
          </div>
        )}
      </div>
      <div className="preview-foot">
        <span>
          <span style={{ color: "var(--accent)" }}>
            {changesCount > 0 ? changesCount : "No"}
          </span>{" "}
          changes staged
        </span>
        {visitUrl ? (
          <a
            className="wts-btn ghost"
            href={visitUrl}
            target="_blank"
            rel="noopener"
            style={{ height: 26, padding: "0 8px", fontSize: 12 }}
          >
            Visit ↗
          </a>
        ) : null}
        {adminUrl ? (
          <a
            className="wts-btn ghost"
            href={adminUrl}
            target="_blank"
            rel="noopener"
            style={{ height: 26, padding: "0 8px", fontSize: 12 }}
          >
            Admin ↗
          </a>
        ) : null}
      </div>
    </aside>
  );
}
