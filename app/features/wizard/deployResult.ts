import type { NormalizedSite, PaywallError } from "./types";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function normalizeSite(site: Record<string, unknown> | null): NormalizedSite | null {
  if (!site) return null;

  let url =
    str(site.wp_url) ||
    str(site.url) ||
    str(site.site_url) ||
    str(site.siteUrl) ||
    str(site.wordpress_url) ||
    str(site.domain) ||
    "";

  if (!url) {
    for (const v of Object.values(site)) {
      if (
        typeof v === "string" &&
        /^https?:\/\/.+\..+/.test(v) &&
        !v.includes("/api/") &&
        !v.includes("/wp-json/")
      ) {
        url = v;
        break;
      }
    }
  }

  if (url && !url.startsWith("http")) url = `https://${url}`;

  return {
    url,
    adminUrl: str(site.wp_admin_url) || (url ? `${url}/wp-admin` : ""),
    username: str(site.wp_username) || str(site.username) || str(site.admin_user),
    password: str(site.wp_password) || str(site.password) || str(site.admin_pass),
    id: str(site.id) || str(site.siteId),
    magicLoginUrl: str(site.magic_login_url),
  };
}

export function asPaywallError(errLike: unknown): PaywallError | null {
  if (!isObject(errLike)) return null;
  if (errLike.upgradeRequired !== true || errLike.requiredFor !== "siteCreate") return null;
  return {
    upgradeRequired: true,
    requiredFor: "siteCreate",
    currentPlan: str(errLike.currentPlan),
    currentPlanLabel: str(errLike.currentPlanLabel),
    currentPlanLimit: typeof errLike.currentPlanLimit === "number" ? errLike.currentPlanLimit : 1,
    blockingSiteName: str(errLike.blockingSiteName),
  };
}

export function errorText(msg: unknown): string {
  if (typeof msg === "string") return msg;
  if (isObject(msg) && typeof msg.message === "string") return msg.message;
  return "An unexpected error occurred.";
}
