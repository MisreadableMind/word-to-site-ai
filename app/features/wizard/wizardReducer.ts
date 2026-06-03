import type {
  InterviewAnswers,
  OnboardingResult,
  WizardField,
  WizardFlow,
  WizardState,
} from "./types";

export type ReviewView =
  | "deploying"
  | "success"
  | "error"
  | "owned-domain"
  | "domain-decision"
  | "resume";

export interface WizardData {
  flow: WizardFlow | null;
  stateName: WizardState;
  interviewAnswers: InterviewAnswers;
  onboardingResult: OnboardingResult | null;
  selectedSkin: string | null;
  selectedEditor: string;
  domain: string;
  registerNewDomain: boolean;
  acceptOwnedDomain: boolean;
  deployRetryCount: number;
  tagline: string;
  reviewView: ReviewView;
  decisionDomain: string;
  decisionCname: string;
  deployNonce: number;
}

export const EMPTY_ANSWERS: InterviewAnswers = {
  email: "",
  companyName: "",
  industry: "",
  services: "",
  aboutUs: "",
  tagline: "",
  address: "",
  phone: "",
  team: "",
  advantages: "",
};

export const initialWizardData: WizardData = {
  flow: "voice",
  stateName: "path",
  interviewAnswers: EMPTY_ANSWERS,
  onboardingResult: null,
  selectedSkin: null,
  selectedEditor: "light",
  domain: "",
  registerNewDomain: false,
  acceptOwnedDomain: false,
  deployRetryCount: 0,
  tagline: "",
  reviewView: "deploying",
  decisionDomain: "",
  decisionCname: "",
  deployNonce: 0,
};

export type WizardAction =
  | { type: "SELECT_FLOW"; flow: WizardFlow }
  | { type: "BACK_TO_PATH" }
  | { type: "GO_STATE"; state: WizardState }
  | { type: "SET_FIELD"; field: WizardField; value: string }
  | { type: "PATCH_ANSWERS"; patch: Partial<InterviewAnswers> }
  | { type: "SET_TAGLINE"; tagline: string }
  | { type: "SET_ONBOARDING_RESULT"; result: OnboardingResult }
  | { type: "SELECT_SKIN"; slug: string }
  | { type: "SET_DOMAIN"; domain: string }
  | { type: "SET_REGISTER_NEW_DOMAIN"; value: boolean }
  | { type: "SET_ACCEPT_OWNED_DOMAIN"; value: boolean }
  | { type: "SET_REVIEW_VIEW"; view: ReviewView }
  | { type: "START_DEPLOY" }
  | { type: "SHOW_DOMAIN_DECISION"; domain: string; cname: string }
  | { type: "SHOW_OWNED_DOMAIN"; domain: string }
  | { type: "RESET_RETRIES" }
  | { type: "INCREMENT_RETRY" }
  | { type: "RESTORE"; data: Partial<WizardData> };

function withSkinSlug(result: OnboardingResult, slug: string): OnboardingResult {
  return {
    ...result,
    templateMatch: { ...(result.templateMatch ?? { slug }), slug },
  };
}

export function wizardReducer(state: WizardData, action: WizardAction): WizardData {
  switch (action.type) {
    case "SELECT_FLOW":
      return { ...state, flow: action.flow };
    case "BACK_TO_PATH":
      return { ...state, flow: null, stateName: "path" };
    case "GO_STATE":
      return { ...state, stateName: action.state };
    case "SET_FIELD":
      return {
        ...state,
        interviewAnswers: { ...state.interviewAnswers, [action.field]: action.value },
      };
    case "PATCH_ANSWERS":
      return {
        ...state,
        interviewAnswers: { ...state.interviewAnswers, ...action.patch },
      };
    case "SET_TAGLINE":
      return { ...state, tagline: action.tagline };
    case "SET_ONBOARDING_RESULT":
      return { ...state, onboardingResult: action.result };
    case "SELECT_SKIN":
      return {
        ...state,
        selectedSkin: action.slug,
        onboardingResult: state.onboardingResult
          ? withSkinSlug(state.onboardingResult, action.slug)
          : state.onboardingResult,
      };
    case "SET_DOMAIN":
      return { ...state, domain: action.domain };
    case "SET_REGISTER_NEW_DOMAIN":
      return { ...state, registerNewDomain: action.value };
    case "SET_ACCEPT_OWNED_DOMAIN":
      return { ...state, acceptOwnedDomain: action.value };
    case "SET_REVIEW_VIEW":
      return { ...state, stateName: "review", reviewView: action.view };
    case "START_DEPLOY":
      return {
        ...state,
        stateName: "review",
        reviewView: "deploying",
        deployNonce: state.deployNonce + 1,
      };
    case "SHOW_DOMAIN_DECISION":
      return {
        ...state,
        stateName: "review",
        reviewView: "domain-decision",
        decisionDomain: action.domain,
        decisionCname: action.cname,
      };
    case "SHOW_OWNED_DOMAIN":
      return {
        ...state,
        stateName: "review",
        reviewView: "owned-domain",
        decisionDomain: action.domain,
      };
    case "RESET_RETRIES":
      return { ...state, deployRetryCount: 0, acceptOwnedDomain: false };
    case "INCREMENT_RETRY":
      return { ...state, deployRetryCount: state.deployRetryCount + 1 };
    case "RESTORE":
      return { ...state, ...action.data };
    default:
      return state;
  }
}
