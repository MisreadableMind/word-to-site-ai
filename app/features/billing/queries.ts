import { useMutation, useQuery } from "@tanstack/react-query";
import { api, apiSend } from "~/lib/api";

export interface Entitlements {
  label: string;
  maxSites: number;
  monthlyTokens: number;
  extraSiteDayUsd: number | null;
  siteTtlDays: number | null;
}

export interface SubscriptionUsage {
  sitesUsed: number;
  includedSites: number;
  overageSites: number;
  extraSiteDayUsd: number | null;
  monthOverageSiteDays: number;
  monthOverageAmountCents: number;
}

export interface Subscription {
  id: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  planTier: string;
  priceLabel?: string | null;
  upcomingAmount?: number | null;
}

export interface SubscriptionResponse {
  success: boolean;
  planTier: string;
  entitlements: Entitlements;
  usage: SubscriptionUsage;
  subscription: Subscription | null;
}

export interface Invoice {
  id: string;
  number: string | null;
  status: string;
  amountPaid: number;
  currency: string;
  created: number;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
}

interface InvoicesResponse {
  success: boolean;
  invoices: Invoice[];
}

interface PortalResponse {
  success: boolean;
  url: string;
}

export const subscriptionKey = ["billing", "subscription"] as const;
export const invoicesKey = ["billing", "invoices"] as const;

export function useSubscription() {
  return useQuery({
    queryKey: subscriptionKey,
    queryFn: () => api<SubscriptionResponse>("/api/billing/subscription"),
    retry: false,
  });
}

export function useInvoices() {
  return useQuery({
    queryKey: invoicesKey,
    queryFn: () =>
      api<InvoicesResponse>("/api/billing/invoices").then((r) => r.invoices),
    retry: false,
  });
}

export function usePortal() {
  return useMutation({
    mutationFn: () => apiSend<PortalResponse>("/api/billing/portal", "POST"),
  });
}
