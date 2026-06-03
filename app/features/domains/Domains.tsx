import { useEffect, useRef, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { ApiError } from "~/lib/api";
import { useMe } from "~/lib/auth";
import { AccountSubnav } from "~/components/AccountSubnav";
import {
  classifyDomain,
  domainsKey,
  fetchDomainBySession,
  useDomains,
  usePurchaseDomain,
  useQuoteDomain,
  type Classification,
  type Domain,
  type Quote,
} from "./queries";
import "~/styles/account.css";

type BannerKind = "success" | "warn" | "error" | "info";

interface Banner {
  kind: BannerKind;
  text: string;
}

type HintKind = "ok" | "warn" | "err" | "";

interface Hint {
  kind: HintKind;
  text: string;
  apex: string | null;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function DomainStatusBadge({ status }: { status: string }) {
  if (status === "registered") {
    return (
      <span className="wts-badge live">
        <span className="dot" />Registered
      </span>
    );
  }
  if (status === "awaiting_payment" || status === "registering") {
    return (
      <span className="wts-badge accent">
        <span className="dot" />
        {status.replace("_", " ")}
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span
        className="wts-badge draft"
        style={{
          color: "var(--danger)",
          borderColor: "rgba(180,35,24,0.2)",
          background: "rgba(180,35,24,0.06)",
        }}
      >
        <span className="dot" style={{ background: "var(--danger)" }} />
        Failed
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

function classificationToHint(c: Classification | null): Hint {
  if (!c || c.kind === "invalid") {
    if (c && c.reason && c.reason !== "empty") {
      return { kind: "err", text: `Invalid domain (${c.reason}).`, apex: null };
    }
    return { kind: "", text: "", apex: null };
  }
  if (c.kind === "platform_subdomain") {
    return {
      kind: "warn",
      text: "This is already your free WordToSite subdomain — no registration needed.",
      apex: null,
    };
  }
  if (c.kind === "reserved") {
    return { kind: "err", text: "This TLD isn’t available for public registration.", apex: null };
  }
  if (c.kind === "subdomain") {
    return { kind: "err", text: "subdomain", apex: c.apex };
  }
  return { kind: "ok", text: `${c.apex} looks registerable.`, apex: c.apex };
}

export function Domains() {
  const { data: user } = useMe();
  const search = useSearch({ strict: false }) as Record<string, string | undefined>;
  const qc = useQueryClient();
  const domainsQuery = useDomains();
  const quoteMutation = useQuoteDomain();
  const purchaseMutation = usePurchaseDomain();

  const [input, setInput] = useState("");
  const [banner, setBanner] = useState<Banner | null>(null);
  const [hint, setHint] = useState<Hint>({ kind: "", text: "", apex: null });
  const [canQuote, setCanQuote] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [unavailable, setUnavailable] = useState<Quote | null>(null);

  const classifyAbort = useRef<AbortController | null>(null);
  const classifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (search.status === "cancelled") {
      setBanner({ kind: "warn", text: "Domain purchase cancelled. No charges were made." });
    }
  }, [search]);

  useEffect(() => {
    const sessionId = search.session_id;
    if (!sessionId) return;

    let cancelled = false;

    async function poll(id: string) {
      try {
        const domain = await fetchDomainBySession(id);
        if (cancelled) return;
        if (domain.status === "awaiting_payment" || domain.status === "registering") {
          setBanner({ kind: "info", text: `Setting up ${domain.domain} — refreshing in a few seconds…` });
          pollTimer.current = setTimeout(() => poll(id), 3000);
          return;
        }
        if (domain.status === "registered") {
          setBanner({
            kind: "success",
            text: `${domain.domain} is registered. It can now be mapped to one of your sites.`,
          });
        } else if (domain.status === "failed") {
          setBanner({
            kind: "error",
            text: `Registration failed: ${domain.errorMessage || "unknown error"}. Your payment was refunded.`,
          });
        }
        qc.invalidateQueries({ queryKey: domainsKey });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setBanner({ kind: "info", text: "Looking up your purchase…" });
          pollTimer.current = setTimeout(() => poll(id), 2000);
          return;
        }
        setBanner({ kind: "error", text: err instanceof Error ? err.message : "Status lookup failed" });
      }
    }

    poll(sessionId);
    const timer = pollTimer;
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [search, qc]);

  function runClassify(value: string) {
    if (classifyAbort.current) classifyAbort.current.abort();
    if (!value) {
      setHint({ kind: "", text: "", apex: null });
      setCanQuote(false);
      return;
    }
    const controller = new AbortController();
    classifyAbort.current = controller;
    classifyDomain(value, controller.signal)
      .then((classification) => {
        const h = classificationToHint(classification);
        setHint(h);
        setCanQuote(classification.kind === "registerable");
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        console.warn("classify failed:", err);
      });
  }

  function onInputChange(value: string) {
    const v = value.trim().toLowerCase();
    setInput(value);
    setCanQuote(false);
    if (classifyTimer.current) clearTimeout(classifyTimer.current);
    classifyTimer.current = setTimeout(() => runClassify(v), 300);
  }

  function useApex(apex: string) {
    setInput(apex);
    runClassify(apex);
  }

  async function getQuote() {
    setBanner(null);
    setQuote(null);
    setUnavailable(null);
    const domain = input.trim().toLowerCase();
    if (!domain) return;
    try {
      const data = await quoteMutation.mutateAsync(domain);
      if (!data.available) {
        setUnavailable(data);
        return;
      }
      setQuote(data);
    } catch (err) {
      setBanner({ kind: "error", text: err instanceof ApiError ? err.message : "Quote failed" });
    }
  }

  async function purchase() {
    if (!quote) return;
    setBanner(null);
    try {
      const result = await purchaseMutation.mutateAsync(quote.domain);
      window.location.href = result.url;
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body;
        const upgradeRequired =
          typeof body === "object" &&
          body !== null &&
          "error" in body &&
          typeof (body as { error: unknown }).error === "object" &&
          (body as { error: { upgradeRequired?: boolean } }).error.upgradeRequired === true;
        if (upgradeRequired) {
          setBanner({ kind: "warn", text: err.message });
          return;
        }
      }
      setBanner({ kind: "error", text: err instanceof ApiError ? err.message : "Purchase failed" });
    }
  }

  const crumbName = user?.displayName || user?.email?.split("@")[0] || "Account";
  const domains = domainsQuery.data ?? [];

  return (
    <>
      <div className="wts-top">
        <div className="wts-crumbs">
          <span>{crumbName}</span>
          <span className="sep">/</span>
          <b>Domains</b>
        </div>
      </div>

      <div className="wts-content">
        <AccountSubnav />

        <div style={{ padding: "32px 36px 60px", maxWidth: 1080 }}>
          <div style={{ marginBottom: 28 }}>
            <h1 className="wts-page-title">Domains</h1>
            <p className="wts-page-lede">
              Register a custom domain for your site. You pay Namecheap's wholesale price plus a 20%
              service fee — no recurring platform charge for the domain itself.
            </p>
          </div>

          {banner ? <div className={`banner ${banner.kind}`}>{banner.text}</div> : null}

          <div className="wts-card" style={{ marginBottom: 16 }}>
            <div className="wts-card-head">
              <span className="wts-card-title">Add a custom domain</span>
            </div>
            <div className="wts-card-body">
              <div className="wts-field">
                <label className="wts-field-label">Domain</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="wts-input"
                    value={input}
                    placeholder="example.com"
                    autoComplete="off"
                    spellCheck={false}
                    style={{ flex: 1 }}
                    onChange={(e) => onInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canQuote) getQuote();
                    }}
                  />
                  <button
                    className="wts-btn primary"
                    disabled={!canQuote || quoteMutation.isPending}
                    onClick={getQuote}
                  >
                    {quoteMutation.isPending ? "Checking…" : "Check price"}
                  </button>
                </div>
                <div
                  className="wts-field-hint"
                  style={{
                    marginTop: 8,
                    color:
                      hint.kind === "ok"
                        ? "var(--accent)"
                        : hint.kind === "warn"
                          ? "#9a6700"
                          : hint.kind === "err"
                            ? "var(--danger)"
                            : undefined,
                  }}
                >
                  {hint.kind === "err" && hint.apex ? (
                    <>
                      Subdomains aren’t registerable.{" "}
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (hint.apex) useApex(hint.apex);
                        }}
                      >
                        Use {hint.apex} instead
                      </a>
                      .
                    </>
                  ) : (
                    hint.text
                  )}
                </div>
              </div>

              {unavailable ? (
                <div className="quote">
                  <div className="quote-row">
                    <span>{unavailable.domain}</span>
                    <span className="muted">
                      {unavailable.premium
                        ? `Premium domain ($${unavailable.premiumPrice || "???"}) — contact support to register`
                        : "Not available — try a different name"}
                    </span>
                  </div>
                </div>
              ) : null}

              {quote ? (
                <div className="quote">
                  <div className="quote-row">
                    <span>{quote.domain} (1 year)</span>
                    <span className="muted">Available</span>
                  </div>
                  <div className="quote-row">
                    <span className="muted">Namecheap wholesale</span>
                    <span className="wts-mono">${quote.wholesalePriceUsd.toFixed(2)}</span>
                  </div>
                  <div className="quote-row">
                    <span className="muted">word→site service fee ({quote.markupPercent}%)</span>
                    <span className="wts-mono">${quote.markupUsd.toFixed(2)}</span>
                  </div>
                  <div className="quote-row total">
                    <span>Total today</span>
                    <span>${quote.totalPriceUsd.toFixed(2)}</span>
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <button
                      className="wts-btn accent"
                      disabled={purchaseMutation.isPending}
                      onClick={purchase}
                    >
                      {purchaseMutation.isPending
                        ? "Redirecting…"
                        : `Pay $${quote.totalPriceUsd.toFixed(2)} and register →`}
                    </button>
                  </div>
                  <p style={{ marginTop: 10, fontSize: 12.5, color: "var(--muted)" }}>
                    You'll be redirected to Stripe Checkout. If domain registration fails after
                    payment, you're refunded automatically.
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="wts-card">
            <div className="wts-card-head">
              <span className="wts-card-title">Your domains</span>
            </div>
            {domainsQuery.isLoading ? (
              <div style={{ padding: 18, color: "var(--muted)", fontSize: 13 }}>Loading…</div>
            ) : domainsQuery.isError ? (
              <div style={{ padding: 18, color: "var(--muted)", fontSize: 13 }}>
                {domainsQuery.error instanceof ApiError && domainsQuery.error.status === 404
                  ? "Domain features are not configured on this deployment."
                  : domainsQuery.error instanceof Error
                    ? domainsQuery.error.message
                    : "Failed to load domains"}
              </div>
            ) : domains.length === 0 ? (
              <div style={{ padding: 18, color: "var(--muted)", fontSize: 13 }}>
                No domains yet. Search above to register one.
              </div>
            ) : (
              <DomainsTable domains={domains} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function DomainsTable({ domains }: { domains: Domain[] }) {
  return (
    <table className="wts-table">
      <thead>
        <tr>
          <th>Domain</th>
          <th>Status</th>
          <th style={{ textAlign: "right" }}>Paid</th>
          <th>Expires</th>
        </tr>
      </thead>
      <tbody>
        {domains.map((d) => (
          <tr key={d.id}>
            <td style={{ fontWeight: 500 }}>{d.domain}</td>
            <td>
              <DomainStatusBadge status={d.status} />
            </td>
            <td className="num" style={{ textAlign: "right" }}>
              {d.totalChargedCents != null ? formatMoney(d.totalChargedCents) : "—"}
            </td>
            <td style={{ color: "var(--muted)" }}>
              {d.expiresAt
                ? DateTime.fromISO(d.expiresAt).toLocaleString({
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
