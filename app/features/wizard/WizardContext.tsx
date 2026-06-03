import { createContext, useContext, type Dispatch } from "react";
import type { WizardAction, WizardData } from "./wizardReducer";

interface WizardContextValue {
  state: WizardData;
  dispatch: Dispatch<WizardAction>;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export const WizardProvider = WizardContext.Provider;

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used within WizardProvider");
  return ctx;
}
