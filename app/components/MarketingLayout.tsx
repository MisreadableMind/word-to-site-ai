import { useEffect } from "react";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { useMe } from "~/lib/auth";
import "~/styles/marketing.css";

function MarketingNav() {
  const { data: user } = useMe();
  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="nav-left">
          <Link className="nav-brand" to="/">
            <div className="nav-logo">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <span>WordToSite</span>
          </Link>
          <div className="nav-links">
            <a className="nav-link" href="/#how">How it works</a>
            <a className="nav-link" href="/#features">Features</a>
            <a className="nav-link" href="/#compare">Compare</a>
            <a className="nav-link" href="/#pricing">Pricing</a>
            <a className="nav-link" href="/#golive">Going live</a>
            <a className="nav-link" href="/#faq">FAQ</a>
          </div>
        </div>
        <div className="nav-right">
          <div className="nav-badge">
            <span className="pulse" />
            v3.0
          </div>
          {user ? (
            <Link className="nav-link" to="/dashboard">Dashboard</Link>
          ) : (
            <Link className="nav-link" to="/login">Log in</Link>
          )}
          <Link className="btn-nav" to="/app">
            Launch App
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </nav>
  );
}

function MarketingFooter() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-left">
          <div className="footer-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          WordToSite
        </div>
        <div className="footer-links">
          <Link className="footer-link" to="/app">Dashboard</Link>
          <a className="footer-link" href="/#how">How it works</a>
          <a className="footer-link" href="/#pricing">Pricing</a>
          <a className="footer-link" href="/#faq">FAQ</a>
          <Link className="footer-link" to="/privacy">Privacy</Link>
          <Link className="footer-link" to="/terms">Terms</Link>
          <Link className="footer-link" to="/mission">Mission</Link>
          <Link className="footer-link" to="/docs">Docs</Link>
          <Link className="footer-link" to="/changelog">Changelog</Link>
        </div>
        <div className="footer-right">
          <span className="footer-version">v3.0.0</span>
        </div>
      </div>
    </footer>
  );
}

export function MarketingLayout() {
  const location = useLocation();

  useEffect(() => {
    document.documentElement.dataset.theme = "marketing";
  }, []);

  // Scroll-reveal: add .visible to .fade-in elements as they enter the viewport.
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".fade-in:not(.visible)");
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            observer.unobserve(e.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [location.pathname]);

  return (
    <>
      <div className="grid-bg" />
      <MarketingNav />
      <Outlet />
      <MarketingFooter />
    </>
  );
}
