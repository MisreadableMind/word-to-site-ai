export type WizardFlow = "voice" | "copy";

export type WizardState =
  | "path"
  | "describe-voice"
  | "describe-copy"
  | "details"
  | "configure"
  | "review";

export type WizardField =
  | "email"
  | "companyName"
  | "industry"
  | "services"
  | "aboutUs"
  | "tagline"
  | "address"
  | "phone"
  | "team"
  | "advantages";

export interface InterviewAnswers {
  email: string;
  companyName: string;
  industry: string;
  services: string;
  aboutUs: string;
  tagline: string;
  address: string;
  phone: string;
  team: string;
  advantages: string;
}

export interface TemplateMatch {
  slug: string;
}

export interface DeploymentTemplate {
  slug: string;
  skin: string;
}

export interface DeploymentBranding {
  siteTitle: string;
  tagline: string;
}

export interface DeploymentContext {
  features: string[];
  template?: Partial<DeploymentTemplate>;
  branding?: Partial<DeploymentBranding>;
  [key: string]: unknown;
}

export interface ContentBusiness {
  name: string;
  tagline: string;
  [key: string]: unknown;
}

export interface ContentContext {
  business?: ContentBusiness;
  [key: string]: unknown;
}

export interface OnboardingResult {
  success: boolean;
  deploymentContext: DeploymentContext | null;
  contentContext: ContentContext | null;
  templateMatch: TemplateMatch | null;
}

export interface SkinRecommendation {
  slug: string;
  title: string;
  category: string;
  demo_url: string;
  reason: string;
  confidence: number;
}

export interface NormalizedSite {
  url: string;
  adminUrl: string;
  username: string;
  password: string;
  id: string;
  magicLoginUrl: string;
}

export interface DeployResultEditor {
  url: string;
  mode: string;
  bounced: boolean;
  reason: string;
}

export interface DeployResultStep {
  step: string;
  success: boolean;
}

export interface DeployResultPayload {
  success: boolean;
  needsConfirmation: boolean;
  alreadyOwnedDomain: string;
  error: unknown;
  site: Record<string, unknown> | null;
  finalUrls: { site: string; temporaryUrl: string } | null;
  editor: DeployResultEditor | null;
  steps: DeployResultStep[];
}

export interface PaywallError {
  upgradeRequired: boolean;
  requiredFor: string;
  currentPlan: string;
  currentPlanLabel: string;
  currentPlanLimit: number;
  blockingSiteName: string;
}

export interface BillingPlan {
  tier: string;
  label: string;
  tagline: string;
  monthlyPriceUsd: number;
  maxSites: number;
  monthlyTokens: number;
  voicePerDay: number;
  customDomain: string | false;
}

export interface ResumeSnapshot {
  version: number;
  savedAt: number;
  domain: string;
  selectedSkin: string | null;
  selectedEditor: string;
  onboardingResult: OnboardingResult | null;
}
