import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "@tanstack/react-router";
import { useMe } from "~/lib/auth";
import { useSitesCount } from "~/features/dashboard/queries";
import { Sidebar } from "./Sidebar";
import "~/styles/platform.css";

export function PlatformLayout() {
  const loc = useLocation();
  const { data: user, isLoading, isError } = useMe();
  const sitesCount = useSitesCount(!!user);

  useEffect(() => {
    document.documentElement.dataset.theme = "platform";
  }, []);

  if (isLoading) {
    return <div className="wts" />;
  }

  if (isError || !user) {
    return <Navigate to="/login" search={{ redirect: loc.href }} replace />;
  }

  return (
    <div className="wts">
      <div className="wts-shell">
        <Sidebar user={user} sitesCount={sitesCount} />
        <div className="wts-shell-main">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
