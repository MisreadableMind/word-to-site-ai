import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiSend } from "~/lib/api";

export interface Site {
  id: string;
  site_name: string | null;
  domain: string | null;
  wp_url: string | null;
  status: string;
  template_slug: string | null;
  onboard_type: string | null;
  created_at: string;
  expires_at: string | null;
  bought_out_at: string | null;
}

interface SitesResponse {
  success: boolean;
  sites: Site[];
}
interface SiteResponse {
  success: boolean;
  site: Site;
}

export const sitesKey = ["sites"] as const;

export function useSites() {
  return useQuery({
    queryKey: sitesKey,
    queryFn: () => api<SitesResponse>("/api/sites").then((r) => r.sites),
  });
}

export function useSitesCount(enabled: boolean): number | undefined {
  const { data } = useQuery({
    queryKey: sitesKey,
    queryFn: () => api<SitesResponse>("/api/sites").then((r) => r.sites),
    enabled,
  });
  return data?.length;
}

export function useSite(id: string | undefined) {
  return useQuery({
    queryKey: ["sites", id],
    queryFn: () => api<SiteResponse>(`/api/sites/${id}`).then((r) => r.site),
    enabled: !!id,
  });
}

export function useDeleteSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiSend<{ success: boolean }>(`/api/sites/${id}`, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: sitesKey }),
  });
}

interface BuyoutResponse {
  success: boolean;
  url: string;
  sessionId: string;
}

export function useBuyout() {
  return useMutation({
    mutationFn: ({ siteId, domain }: { siteId: string; domain: string }) =>
      apiSend<BuyoutResponse>(`/api/sites/${siteId}/buyout`, "POST", { domain }),
  });
}
