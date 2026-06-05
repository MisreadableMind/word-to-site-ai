import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import clsx from "clsx";
import { Icon, type IconName } from "./Icon";
import { initials, useLogout, type User } from "~/lib/auth";

type NavItem = { href: string; label: string; icon: IconName; newTab: boolean };

const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Sites", icon: "home", newTab: false },
  { href: "/app", label: "New site", icon: "plus", newTab: false },
  { href: "/domains", label: "Domains", icon: "globe", newTab: false },
];
const ACCOUNT_NAV: NavItem[] = [
  { href: "/usage", label: "Usage", icon: "chart", newTab: false },
  { href: "/billing", label: "Billing", icon: "card", newTab: false },
  { href: "/profile", label: "Settings", icon: "cog", newTab: false },
  { href: "/plans", label: "Plans", icon: "chart", newTab: false },
];
const HELP_NAV: NavItem[] = [
  { href: "/docs", label: "Docs", icon: "book", newTab: true },
  { href: "/changelog", label: "Changelog", icon: "help", newTab: true },
];

function NavLinks({
  items,
  sitesCount,
}: {
  items: NavItem[];
  sitesCount?: number;
}) {
  return (
    <>
      {items.map((i) => (
        <Link
          key={i.href}
          to={i.href}
          className="wts-side-link"
          activeProps={{ className: "wts-side-link active" }}
          activeOptions={{ exact: true }}
          target={i.newTab ? "_blank" : undefined}
          rel={i.newTab ? "noopener" : undefined}
        >
          <span className="ico">
            <Icon name={i.icon} />
          </span>
          <span>{i.label}</span>
          {i.href === "/dashboard" && sitesCount !== undefined ? (
            <span className="count">{sitesCount}</span>
          ) : null}
        </Link>
      ))}
    </>
  );
}

export function Sidebar({
  user,
  sitesCount,
}: {
  user: User;
  sitesCount?: number;
}) {
  const navigate = useNavigate();
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const footRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!footRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  const name =
    user.displayName || user.email.split("@")[0] || "Account";

  async function onLogout() {
    await logout.mutateAsync().catch(() => {});
    navigate({ to: "/login" });
  }

  return (
    <aside className="wts-side">
      <Link to="/dashboard" className="wts-side-brand" style={{ textDecoration: "none" }}>
        <div className="wts-mark">w</div>
        <span className="wts-wordmark">
          word<span className="arrow">→</span>site
        </span>
      </Link>

      <div className="wts-side-section" style={{ paddingTop: 12 }}>
        <NavLinks items={MAIN_NAV} sitesCount={sitesCount} />
      </div>

      <div className="wts-side-section">
        <div className="wts-side-section-label">Account</div>
        <NavLinks items={ACCOUNT_NAV} />
      </div>

      <div className="wts-side-section">
        <div className="wts-side-section-label">Help</div>
        <NavLinks items={HELP_NAV} />
      </div>

      <div className="wts-side-foot" ref={footRef}>
        <button
          className="wts-side-user"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
        >
          <div className="wts-avatar">{initials(user.displayName || user.email)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="name">{name}</div>
            <div className="email">{user.email}</div>
          </div>
          <span style={{ color: "var(--muted-2)" }}>▾</span>
        </button>
        <div className={clsx("user-dropdown", open && "open")}>
          <Link to="/profile">Profile</Link>
          <Link to="/billing">Billing</Link>
          <Link to="/usage">Usage</Link>
          <Link to="/domains">Domains</Link>
          <div className="divider" />
          <button className="danger" onClick={onLogout} disabled={logout.isPending}>
            Log out
          </button>
        </div>
      </div>
    </aside>
  );
}
