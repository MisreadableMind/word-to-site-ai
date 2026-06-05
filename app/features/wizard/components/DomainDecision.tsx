import { useEffect, useState } from "react";
import { checkDomainDns, purchaseDomain, quoteDomain } from "../wizardApi";

interface DomainDecisionProps {
  domain: string;
  cnameTarget: string;
  companyName: string;
  onSaveResume: () => boolean;
  onClearResume: () => void;
  onVerifiedPublish: () => void;
  onSubdomain: () => void;
  onBack: () => void;
}

function initialsFor(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => (s[0] ?? "").toUpperCase())
      .join("") || "··"
  );
}

const checkSvg = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.6">
    <path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const FEATURES: [string, boolean][] = [
  ["Domain registered in your name", true],
  ["DNS configured automatically", true],
  ["SSL certificate (auto-renews)", true],
  ["Whois privacy included", true],
  ["One yearly renewal, no surprises", false],
];

export function DomainDecision({
  domain,
  cnameTarget,
  companyName,
  onSaveResume,
  onClearResume,
  onVerifiedPublish,
  onSubdomain,
  onBack,
}: DomainDecisionProps) {
  const [priceAmount, setPriceAmount] = useState("—");
  const [priceSub, setPriceSub] = useState("Charged once. Renews next year, you'll get a reminder first.");
  const [registerLabel, setRegisterLabel] = useState("Register & publish —");
  const [registerDisabled, setRegisterDisabled] = useState(true);
  const [verifyLabel, setVerifyLabel] = useState("I've added the record — verify & publish");
  const [verifying, setVerifying] = useState(false);
  const [registering, setRegistering] = useState(false);

  const name = companyName || domain;
  const initials = initialsFor(name);

  useEffect(() => {
    let cancelled = false;
    const setDisabled = (label: string) => {
      if (cancelled) return;
      setRegisterLabel(label);
      setRegisterDisabled(true);
    };

    (async () => {
      try {
        const data = await quoteDomain(domain);
        if (cancelled) return;
        if (data.premium) {
          setPriceAmount("—");
          setPriceSub("Premium domain — buy via the Domains page.");
          setDisabled("Premium domain");
          return;
        }
        if (!data.available) {
          setPriceAmount("—");
          setPriceSub(`${domain} isn't available for registration.`);
          setDisabled("Domain unavailable");
          return;
        }
        const price = Number(data.totalPriceUsd).toFixed(2);
        setPriceAmount(`$${price}`);
        setPriceSub("Charged once. Renews next year, you'll get a reminder first.");
        setRegisterLabel(`Register & publish — $${price}`);
        setRegisterDisabled(false);
      } catch {
        if (cancelled) return;
        setPriceAmount("—");
        setPriceSub("Couldn't fetch the price right now.");
        setDisabled("Register & publish");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [domain]);

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text).catch(() => {});
  };

  const register = async () => {
    setRegistering(true);
    const original = registerLabel;
    setRegisterLabel("Redirecting…");
    if (!onSaveResume()) {
      setRegistering(false);
      setRegisterLabel(original);
      return;
    }
    try {
      const data = await purchaseDomain(domain);
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("Checkout failed");
    } catch {
      onClearResume();
      setRegistering(false);
      setRegisterLabel(original);
    }
  };

  const verify = async () => {
    if (verifying) return;
    setVerifying(true);
    setVerifyLabel("Checking DNS…");
    let pointsHere = false;
    let reachable = true;
    try {
      const data = await checkDomainDns(domain);
      pointsHere = !!data.pointsHere;
    } catch {
      reachable = false;
    }
    if (pointsHere) {
      onVerifiedPublish();
      return;
    }
    setVerifyLabel(
      reachable
        ? "Still propagating — try again in a moment"
        : "Couldn't reach our DNS checker — try again",
    );
    setTimeout(() => {
      setVerifyLabel("I've added the record — verify & publish");
      setVerifying(false);
    }, 6000);
  };

  return (
    <div className="dd-root">
      <div className="dd-header">
        <div>
          <div className="dd-eyebrow">Almost there · one more step</div>
          <h1 className="wts-page-title">
            How should we connect <span className="dd-title-domain">{domain}</span>?
          </h1>
          <p className="wts-page-lede">
            Your site is ready to publish. It just needs <b>{domain}</b> pointed at our service. Pick how you'd like to handle it.
          </p>
        </div>
        <div className="dd-chip">
          <div className="dd-chip-label">Publishing</div>
          <div className="dd-chip-row">
            <div className="dd-chip-initials">{initials}</div>
            <div>
              <div className="dd-chip-name">{name}</div>
              <div className="dd-chip-domain">{domain}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="dd-grid">
        <div className="dd-card dd-card-a">
          <div className="dd-card-pill">Recommended</div>
          <div className="dd-card-head">
            <div className="dd-card-head-row">
              <div className="dd-card-icon">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12" />
                </svg>
              </div>
              <div>
                <div className="dd-card-eyebrow">Option A</div>
                <h3 className="dd-card-title">Let us handle it</h3>
              </div>
            </div>
            <p className="dd-card-desc">
              We register the domain in your name, configure DNS, and issue an SSL certificate. Live in about two minutes.
            </p>
          </div>
          <ul className="dd-features">
            {FEATURES.map(([txt, strong]) => (
              <li key={txt} className={strong ? "strong" : "weak"}>
                {checkSvg}
                <span>{txt}</span>
              </li>
            ))}
          </ul>
          <div className="dd-price-block">
            <div className="dd-price-row">
              <div>
                <div className="dd-price-big">
                  <span className="amount">{priceAmount}</span>
                  <span className="per">/ year</span>
                </div>
                <div className="dd-price-sub">{priceSub}</div>
              </div>
            </div>
            <button
              className="wts-btn primary lg"
              style={{ width: "100%", justifyContent: "center" }}
              disabled={registerDisabled || registering}
              onClick={() => void register()}
            >
              {registerLabel}
            </button>
          </div>
        </div>

        <div className="dd-card dd-card-b">
          <div className="dd-card-head">
            <div className="dd-card-head-row">
              <div className="dd-card-icon">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M5 7l3-3 3 3M8 4v8M3 12h10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div className="dd-card-eyebrow">Option B</div>
                <h3 className="dd-card-title">I'll set up DNS myself</h3>
              </div>
            </div>
            <p className="dd-card-desc">
              If you've already registered <b>{domain}</b> elsewhere — Namecheap, Cloudflare, GoDaddy — add this CNAME record at your registrar.
            </p>
          </div>
          <div className="dd-card-b-body">
            <div className="dd-cname-head">
              <div className="dd-cname-label">CNAME record</div>
              <button
                className="wts-btn ghost dd-copy-all"
                type="button"
                onClick={() => copy(`Name: ${domain}\nValue: ${cnameTarget}\nTTL: Auto / 300`)}
              >
                Copy all
              </button>
            </div>
            <div className="dd-cname">
              <div className="dd-cname-row">
                <div className="k">Name</div>
                <div className="v">{domain}</div>
                <button className="wts-btn ghost" type="button" onClick={() => copy(domain)}>
                  Copy
                </button>
              </div>
              <div className="dd-cname-row">
                <div className="k">Value</div>
                <div className="v">{cnameTarget || "—"}</div>
                <button className="wts-btn ghost" type="button" onClick={() => copy(cnameTarget)}>
                  Copy
                </button>
              </div>
              <div className="dd-cname-row">
                <div className="k">TTL</div>
                <div className="v">Auto / 300</div>
                <span />
              </div>
            </div>
            <details className="dd-details">
              <summary>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M3 2l3 3-3 3" />
                </svg>
                Step-by-step instructions
              </summary>
              <ol>
                <li>Sign in to your domain registrar.</li>
                <li>
                  Find the DNS settings for <span className="dd-mono">{domain}</span>.
                </li>
                <li>Add a new CNAME record using the values above.</li>
                <li>Save and return here.</li>
              </ol>
            </details>
          </div>
          <div className="dd-card-b-cta">
            <div className="dd-hint">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                <circle cx="8" cy="8" r="6" />
                <path d="M8 5v3.5L10 10" strokeLinecap="round" />
              </svg>
              DNS usually propagates in 5–60 minutes.
            </div>
            <button
              className="wts-btn lg"
              type="button"
              style={{ width: "100%", justifyContent: "center" }}
              disabled={verifying}
              onClick={() => void verify()}
            >
              {verifyLabel}
            </button>
          </div>
        </div>
      </div>

      <div className="dd-footer">
        <div className="dd-footer-info">
          <div className="dd-footer-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="dd-footer-head">Not ready for a custom domain?</div>
            <div className="dd-footer-body">
              Publish on your free WordToSite subdomain now — you can add a domain anytime from Settings.
            </div>
          </div>
        </div>
        <button className="wts-btn" type="button" onClick={onSubdomain}>
          Continue with subdomain →
        </button>
      </div>

      <div className="dd-bottom-nav">
        <button className="wts-btn ghost" type="button" onClick={onBack}>
          ← Back to settings
        </button>
        <div className="dd-bottom-note">You can change the domain later, before or after publishing.</div>
      </div>
    </div>
  );
}
