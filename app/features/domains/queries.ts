import { useMutation, useQuery } from "@tanstack/react-query";
import { api, apiSend } from "~/lib/api";

export interface Classification {
  kind: string;
  reason: string;
  apex: string;
  tld: string;
}

interface ClassifyResponse {
  success: boolean;
  classification: Classification;
}

export interface Quote {
  success: boolean;
  domain: string;
  available: boolean;
  premium: boolean;
  premiumPrice: number | null;
  reason: string;
  wholesalePriceUsd: number;
  markupUsd: number;
  totalPriceUsd: number;
  markupPercent: number;
  currency: string;
}

export interface Domain {
  id: string;
  domain: string;
  status: string;
  siteId: string | null;
  totalChargedCents: number | null;
  wholesaleCents: number | null;
  errorMessage: string | null;
  registeredAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface DomainsResponse {
  success: boolean;
  domains: Domain[];
}

interface DomainResponse {
  success: boolean;
  domain: Domain;
}

interface PurchaseResponse {
  success: boolean;
  url: string;
  sessionId: string;
}

export const domainsKey = ["domains"] as const;

export function useDomains() {
  return useQuery({
    queryKey: domainsKey,
    queryFn: () => api<DomainsResponse>("/api/domains").then((r) => r.domains),
    retry: false,
  });
}

export function classifyDomain(domain: string, signal: AbortSignal): Promise<Classification> {
  return api<ClassifyResponse>(`/api/domains/classify?domain=${encodeURIComponent(domain)}`, {
    signal,
  }).then((r) => r.classification);
}

export function fetchDomainBySession(sessionId: string): Promise<Domain> {
  return api<DomainResponse>(
    `/api/domains/by-session/${encodeURIComponent(sessionId)}`,
  ).then((r) => r.domain);
}

export function useQuoteDomain() {
  return useMutation({
    mutationFn: (domain: string) => apiSend<Quote>("/api/domains/quote", "POST", { domain }),
  });
}

export function usePurchaseDomain() {
  return useMutation({
    mutationFn: (domain: string) =>
      apiSend<PurchaseResponse>("/api/domains/purchase", "POST", { domain }),
  });
}
