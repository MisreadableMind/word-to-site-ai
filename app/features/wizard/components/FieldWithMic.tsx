import type { ReactNode } from "react";
import { motion } from "motion/react";
import { useMicControl } from "./MicField";

interface FieldWithMicProps {
  label: ReactNode;
  multiline: boolean;
  value: string;
  placeholder: string;
  required: boolean;
  rows: number;
  disabled: boolean;
  onChange: (value: string) => void;
  onTranscript: (text: string) => void;
  children?: ReactNode;
}

export function FieldWithMic({
  label,
  multiline,
  value,
  placeholder,
  required,
  rows,
  disabled,
  onChange,
  onTranscript,
  children,
}: FieldWithMicProps) {
  const { micButton, statusBar } = useMicControl({ onTranscript, disabled });

  return (
    <motion.div layout transition={{ duration: 0.28, ease: "easeOut" }} className="wts-field">
      <label className="wts-field-label">{label}</label>
      <div className="input-with-mic">
        {multiline ? (
          <textarea
            className="wts-textarea"
            value={value}
            placeholder={placeholder}
            required={required}
            rows={rows}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <input
            className="wts-input"
            type="text"
            value={value}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        {micButton}
      </div>
      {statusBar}
      {children}
    </motion.div>
  );
}
