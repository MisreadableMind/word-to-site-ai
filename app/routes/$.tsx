import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/$")({
  component: NotFound,
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
