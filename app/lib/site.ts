import type { Site } from "~/features/dashboard/queries";

export function tryParseUrl(value: string | null): URL | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const full = /^https?:\/\//i.test(value) ? value.trim() : `https://${value.trim()}`;
  try {
    return new URL(full);
  } catch {
    return null;
  }
}

export function siteBaseUrl(site: Site): string {
  const wp = tryParseUrl(site.wp_url);
  const custom = tryParseUrl(site.domain);
  const customIsSlugOfWp =
    custom && wp ? wp.hostname.startsWith(`${custom.hostname}.`) : false;
  if (custom && !customIsSlugOfWp) return custom.origin;
  return wp ? wp.origin : "";
}

const SITE_COLORS = ["#3F3D3A", "#8B5A2B", "#1F5240", "#2A3050", "#7A7A72", "#5A4B6E"];

export function colorForSite(site: Site): string {
  let hash = 0;
  const key = (site.id || site.site_name || "").toString();
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return SITE_COLORS[hash % SITE_COLORS.length] as string;
}

export function siteInitials(name: string | null): string {
  return (
    (name || "NA")
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase() || "")
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "NA"
  );
}
