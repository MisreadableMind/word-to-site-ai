import { useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { AuthLayout } from "~/components/AuthLayout";
import { PasswordInput } from "~/components/PasswordInput";
import { useLogin } from "~/lib/auth";

export const Route = createFileRoute("/login")({
  component: Login,
  head: () => ({
    meta: [{ title: "word→site | Sign in" }],
  }),
});

function Login() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, string | undefined>;
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, password });
      navigate({ to: search.redirect || "/dashboard", replace: true });
    } catch {
    }
  }

  return (
    <AuthLayout variant="login">
      <h1 className="wts-page-title">Sign in.</h1>
      <p className="wts-page-lede" style={{ marginTop: 8 }}>
        Welcome back. Pick up where you left.
      </p>

      {login.isError ? (
        <div className="auth-error">{(login.error as Error).message}</div>
      ) : null}

      <form
        onSubmit={onSubmit}
        style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div className="wts-field">
          <label className="wts-field-label" htmlFor="email">Email</label>
          <input
            className="wts-input"
            type="email"
            id="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="wts-field">
          <label className="wts-field-label" htmlFor="password">Password</label>
          <PasswordInput
            id="password"
            name="password"
            value={password}
            onChange={setPassword}
            placeholder="Your password"
            autoComplete="current-password"
            required
          />
        </div>

        <button
          className="wts-btn primary lg"
          type="submit"
          disabled={login.isPending}
          style={{ marginTop: 8, justifyContent: "center" }}
        >
          {login.isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p style={{ marginTop: 28, fontSize: 13.5, color: "var(--muted)" }}>
        New here?{" "}
        <Link to="/register" style={{ color: "var(--accent)", fontWeight: 500 }}>
          Create an account →
        </Link>
      </p>
    </AuthLayout>
  );
}
