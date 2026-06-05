import { memo } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { ChipMode } from "../constants";

interface QuickChipsProps {
  options: string[];
  mode: ChipMode;
  value: string;
  loading: boolean;
  onToggle: (option: string) => void;
}

const SKELETON_WIDTHS = [70, 92, 64, 108, 80, 96, 72, 88];
const CHIP_TRANSITION = { duration: 0.16, ease: "easeOut" } as const;
const LAYOUT_TRANSITION = { duration: 0.28, ease: "easeOut" } as const;

function isSelected(value: string, option: string): boolean {
  return value.includes(option);
}

export const QuickChips = memo(function QuickChips({ options, value, loading, onToggle }: QuickChipsProps) {
  return (
    <motion.div layout transition={LAYOUT_TRANSITION} className="quick-options">
      <AnimatePresence mode="popLayout" initial={false}>
        {loading
          ? SKELETON_WIDTHS.map((w, i) => (
              <motion.span
                key={`sk-${i}`}
                layout
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={CHIP_TRANSITION}
                className="quick-chip quick-chip-skeleton"
                style={{ width: w }}
                aria-hidden="true"
              />
            ))
          : options.map((option) => (
              <motion.button
                key={option}
                layout
                type="button"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={CHIP_TRANSITION}
                className={`quick-chip${isSelected(value, option) ? " selected" : ""}`}
                onClick={() => onToggle(option)}
              >
                {option}
              </motion.button>
            ))}
      </AnimatePresence>
    </motion.div>
  );
});
