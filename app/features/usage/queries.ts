import { useQuery } from "@tanstack/react-query";
import { api } from "~/lib/api";

export interface Usage {
  domain: string;
  status: string;
  tokensUsed: number;
  tokenLimit: number;
  remaining: number;
  allowed: boolean;
  period: string;
}

interface UsageResponse {
  success: boolean;
  usage: Usage | null;
  message: string;
}

export function useSiteUsage(siteId: string | undefined) {
  return useQuery({
    queryKey: ["sites", siteId, "usage"],
    queryFn: () =>
      api<UsageResponse>(`/api/sites/${siteId}/usage`).then((r) => r.usage),
    enabled: !!siteId,
  });
}
