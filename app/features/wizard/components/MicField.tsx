import type { ReactElement } from "react";
import { useVoiceRecorder } from "~/hooks/useVoiceRecorder";

function MicIcon() {
  return (
    <svg viewBox="0 0 16 16">
      <rect x="6" y="2" width="4" height="8" rx="2" />
      <path d="M3.5 8a4.5 4.5 0 009 0M8 12.5v2M5.5 14.5h5" />
    </svg>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

interface MicControlProps {
  onTranscript: (text: string) => void;
  disabled: boolean;
}

interface MicFieldRender {
  micButton: ReactElement;
  statusBar: ReactElement | null;
}

export function useMicControl({ onTranscript, disabled }: MicControlProps): MicFieldRender {
  const recorder = useVoiceRecorder(onTranscript);

  const onClick = () => {
    if (recorder.state === "recording") recorder.stop();
    else if (recorder.state === "idle") void recorder.start();
  };

  const micClass =
    recorder.state === "recording"
      ? "mic-btn recording"
      : recorder.state === "transcribing"
        ? "mic-btn transcribing"
        : "mic-btn";

  const micButton = (
    <button type="button" className={micClass} onClick={onClick} disabled={disabled} aria-label="Record">
      <MicIcon />
    </button>
  );

  const levelBars = [4, 8, 14, 22, 32].map((_, i) => (
    <span
      key={i}
      className="voice-level-bar"
      style={{ height: `${Math.max(3, recorder.level * 16 * (0.5 + i * 0.15))}px` }}
    />
  ));

  let statusBar: ReactElement | null = null;
  if (recorder.state === "recording") {
    statusBar = (
      <div className="voice-status recording">
        <span className="voice-status-dot" />
        <span className="voice-level">{levelBars}</span>
        <span className="voice-status-text">Listening…</span>
        <span className="voice-status-timer">{formatTime(recorder.seconds)}</span>
        <span className="voice-status-hint">tap mic to stop</span>
      </div>
    );
  } else if (recorder.state === "transcribing") {
    statusBar = (
      <div className="voice-status transcribing">
        <span className="voice-status-spinner" />
        <span className="voice-status-text">Transcribing audio…</span>
      </div>
    );
  } else if (recorder.error) {
    statusBar = (
      <div className="voice-status">
        <span className="voice-status-text">{recorder.error}</span>
      </div>
    );
  }

  return { micButton, statusBar };
}
