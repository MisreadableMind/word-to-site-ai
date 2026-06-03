import { useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { AuthLayout } from "~/components/AuthLayout";
import { PasswordInput } from "~/components/PasswordInput";
import { useRegister } from "~/lib/auth";

export const Route = createFileRoute("/register")({
  component: Register,
  head: () => ({
    meta: [{ title: "word→site | Create account" }],
  }),
});

function Register() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, string | undefined>;
  const register = useRegister();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mismatch, setMismatch] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    try {
      await register.mutateAsync({
        email,
        password,
        displayName: displayName || undefined,
      });
      navigate({ to: search.redirect || "/dashboard", replace: true });
    } catch {
    }
  }

  const errorText = mismatch
    ? "Passwords do not match"
    : register.isError
      ? (register.error as Error).message
      : null;

  return (
    <AuthLayout variant="register">
      <h1 className="wts-page-title">Create account.</h1>
      <p className="wts-page-lede" style={{ marginTop: 8 }}>
        Free to start. No card needed.
      </p>

      {errorText ? <div className="auth-error">{errorText}</div> : null}

      <form
        onSubmit={onSubmit}
        style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div className="wts-field">
          <label className="wts-field-label" htmlFor="displayName">Full name</label>
          <input
            className="wts-input"
            type="text"
            id="displayName"
            name="displayName"
            placeholder="Anna Mota"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="wts-field">
            <label className="wts-field-label" htmlFor="password">Password</label>
            <PasswordInput
              id="password"
              name="password"
              value={password}
              onChange={setPassword}
              placeholder="8+ characters"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>
          <div className="wts-field">
            <label className="wts-field-label" htmlFor="confirmPassword">Confirm</label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Repeat"
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        <label
          style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5, marginTop: 4 }}
        >
          <input
            type="checkbox"
            required
            style={{ marginTop: 2, width: 14, height: 14, accentColor: "var(--accent)" }}
          />
          <span>
            I agree to the{" "}
            <Link to="/terms" style={{ color: "var(--accent)" }}>Terms</Link> and{" "}
            <Link to="/privacy" style={{ color: "var(--accent)" }}>Privacy Policy</Link>.
          </span>
        </label>

        <button
          className="wts-btn primary lg"
          type="submit"
          disabled={register.isPending}
          style={{ marginTop: 8, justifyContent: "center" }}
        >
          {register.isPending ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p style={{ marginTop: 28, fontSize: 13.5, color: "var(--muted)" }}>
        Already have an account?{" "}
        <Link to="/login" style={{ color: "var(--accent)", fontWeight: 500 }}>
          Sign in →
        </Link>
      </p>
    </AuthLayout>
  );
}
