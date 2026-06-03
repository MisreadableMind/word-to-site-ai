import { api, apiSend } from "~/lib/api";
import { DEPLOY_FEATURES } from "./constants";
import type {
  BillingPlan,
  DeploymentContext,
  InterviewAnswers,
  OnboardingResult,
  SkinRecommendation,
} from "./types";
import type { WizardData } from "./wizardReducer";

interface TaglineResponse {
  success: boolean;
  tagline: string;
}

interface MatchIndustryResponse {
  success: boolean;
  matched: string;
}

interface SuggestOptionsResponse {
  success: boolean;
  services: string[] | null;
  about: string[] | null;
}

interface SuggestStep2Response {
  success: boolean;
  team: string | null;
  advantages: string | null;
}

interface SkinsRecommendResponse {
  success: boolean;
  recommended: SkinRecommendation[];
}

interface ClassifyResponse {
  success: boolean;
  classification: { kind: string; apex: string; reason: string };
}

interface CheckDnsResponse {
  domain: string;
  expectedCnameTarget: string;
  resolves: boolean;
  pointsHere: boolean;
}

interface QuoteResponse {
  success: boolean;
  available: boolean;
  premium: boolean;
  totalPriceUsd: number;
}

interface PlansResponse {
  success: boolean;
  plans: BillingPlan[];
}

interface CheckoutResponse {
  success: boolean;
  url: string;
}

export function generateTagline(companyName: string, industry: string): Promise<TaglineResponse> {
  return apiSend<TaglineResponse>("/api/onboard/generate-tagline", "POST", { companyName, industry });
}

export function matchIndustry(text: string, options: string[]): Promise<MatchIndustryResponse> {
  return apiSend<MatchIndustryResponse>("/api/onboard/match-industry", "POST", { text, options });
}

export function suggestOptions(companyName: string, industry: string): Promise<SuggestOptionsResponse> {
  return apiSend<SuggestOptionsResponse>("/api/onboard/suggest-options", "POST", { companyName, industry });
}

export function suggestStep2(
  companyName: string,
  industry: string,
  services: string,
): Promise<SuggestStep2Response> {
  return apiSend<SuggestStep2Response>("/api/onboard/suggest-step2", "POST", { companyName, industry, services });
}

export function completeInterview(answers: Partial<InterviewAnswers>): Promise<OnboardingResult> {
  return apiSend<OnboardingResult>("/api/onboard/interview/complete", "POST", { answers, language: "en" });
}

export function recommendSkins(answers: InterviewAnswers): Promise<SkinsRecommendResponse> {
  return apiSend<SkinsRecommendResponse>("/api/skins/recommend", "POST", {
    companyName: answers.companyName,
    industry: answers.industry,
    services: answers.services,
    aboutUs: answers.aboutUs,
  });
}

export function classifyDomain(domain: string): Promise<ClassifyResponse> {
  return api<ClassifyResponse>(`/api/domains/classify?domain=${encodeURIComponent(domain)}`);
}

export function checkDomainDns(domain: string): Promise<CheckDnsResponse> {
  return api<CheckDnsResponse>(`/api/onboard/check-domain-dns?domain=${encodeURIComponent(domain)}`);
}

export function quoteDomain(domain: string): Promise<QuoteResponse> {
  return apiSend<QuoteResponse>("/api/domains/quote", "POST", { domain });
}

export function purchaseDomain(domain: string): Promise<CheckoutResponse> {
  return apiSend<CheckoutResponse>("/api/domains/purchase", "POST", { domain, fromWizard: true });
}

export function loadPlans(): Promise<PlansResponse> {
  return api<PlansResponse>("/api/billing/plans");
}

export function checkout(planTier: string): Promise<CheckoutResponse> {
  return apiSend<CheckoutResponse>("/api/billing/checkout", "POST", { planTier });
}

export interface DomainBySessionResponse {
  success: boolean;
  domain: { status: string; errorMessage: string };
}

export function domainBySession(sessionId: string): Promise<DomainBySessionResponse> {
  return api<DomainBySessionResponse>(`/api/domains/by-session/${encodeURIComponent(sessionId)}`);
}

export function buildDeploymentContext(state: WizardData): DeploymentContext {
  const base = (state.onboardingResult?.deploymentContext ?? {}) as DeploymentContext;
  const dc: DeploymentContext = { ...base, features: DEPLOY_FEATURES };

  const resolvedSkinSlug = state.selectedSkin || state.onboardingResult?.templateMatch?.slug || "";
  if (resolvedSkinSlug) {
    dc.template = { ...(base.template ?? {}), slug: resolvedSkinSlug, skin: resolvedSkinSlug };
  }
  return dc;
}

export function buildConfirmStreamPath(state: WizardData): string {
  const dc = buildDeploymentContext(state);
  const params = new URLSearchParams({
    deploymentContext: JSON.stringify(dc),
    contentContext: JSON.stringify(state.onboardingResult?.contentContext ?? {}),
    templateSlug: state.selectedSkin || state.onboardingResult?.templateMatch?.slug || "",
    apiKey: "",
  });
  const domain = state.domain.trim();
  if (domain) {
    params.set("domain", domain);
    params.set("registerNewDomain", String(state.registerNewDomain));
    if (state.acceptOwnedDomain) params.set("acceptOwnedDomain", "true");
  }
  return `/api/onboard/confirm/stream?${params.toString()}`;
}
