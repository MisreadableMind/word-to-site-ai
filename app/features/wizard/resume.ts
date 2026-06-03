import { RESUME_STORAGE_KEY, RESUME_TTL_MS } from "./constants";
import type { ResumeSnapshot } from "./types";
import type { WizardData } from "./wizardReducer";

export function saveResumeSnapshot(state: WizardData, domain: string): boolean {
  const snapshot: ResumeSnapshot = {
    version: 1,
    savedAt: Date.now(),
    domain,
    selectedSkin: state.selectedSkin,
    selectedEditor: state.selectedEditor,
    onboardingResult: state.onboardingResult,
  };
  try {
    localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function readResumeSnapshot(): ResumeSnapshot | null {
  try {
    const raw = localStorage.getItem(RESUME_STORAGE_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as ResumeSnapshot;
    if (snap.version !== 1) return null;
    if (Date.now() - snap.savedAt > RESUME_TTL_MS) return null;
    return snap;
  } catch {
    return null;
  }
}

export function clearResumeSnapshot(): void {
  localStorage.removeItem(RESUME_STORAGE_KEY);
}
