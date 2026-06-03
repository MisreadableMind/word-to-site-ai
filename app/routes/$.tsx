import { Link, Navigate, createFileRoute, useLocation } from "@tanstack/react-router";

const LEGACY_MAP: Record<string, string> = {
  "/index.html": "/",
  "/app.html": "/app",
  "/dashboard.html": "/dashboard",
  "/login.html": "/login",
  "/register.html": "/register",
  "/pricing.html": "/pricing",
  "/docs.html": "/docs",
  "/changelog.html": "/changelog",
  "/mission.html": "/mission",
  "/privacy.html": "/privacy",
  "/terms.html": "/terms",
  "/editor.html": "/editor",
  "/billing.html": "/billing",
  "/domains.html": "/domains",
  "/usage.html": "/usage",
  "/profile.html": "/profile",
};

export const Route = createFileRoute("/$")({
  component: CatchAll,
  head: () => ({
    meta: [
      { title: "Page not found — WordToSite" },
      { name: "description", content: "This page doesn't exist." },
    ],
  }),
});

function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 48, fontFamily: "system-ui, sans-serif", background: "#09090B", color: "#FAFAFA" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 48, margin: 0 }}>404</h1>
        <p style={{ color: "#A1A1AA", marginTop: 8 }}>This page doesn't exist.</p>
        <Link to="/" style={{ color: "#818CF8", marginTop: 16, display: "inline-block" }}>← Back home</Link>
      </div>
    </main>
  );
}

function CatchAll() {
  const location = useLocation();
  const target = LEGACY_MAP[location.pathname];
  if (!target) return <NotFound />;

  const search = { ...(location.search as Record<string, string | undefined>) };
  const redirect = search.redirect;
  if (redirect) {
    const parts = redirect.split("?");
    const redirectPath = parts[0] ?? "";
    const rest = parts.slice(1);
    const mapped = LEGACY_MAP[redirectPath];
    if (mapped) {
      search.redirect = rest.length ? `${mapped}?${rest.join("?")}` : mapped;
    }
  }
  return <Navigate to={target} search={search} replace />;
}
