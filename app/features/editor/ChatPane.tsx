import { useEffect, useRef, useState } from "react";
import { useVoiceRecorder } from "~/hooks/useVoiceRecorder";
import { MessageBubble } from "./MessageBubble";
import type { AppliedChange, ChatRole } from "./queries";

export interface UiMessage {
  key: string;
  role: ChatRole;
  content: string;
  changes: AppliedChange[];
  time: string;
}

interface ChatPaneProps {
  title: string;
  messages: UiMessage[];
  sending: boolean;
  userInitial: string;
  onSend: (text: string) => void;
}

const MicIdleIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="6" y="2" width="4" height="8" rx="2" />
    <path d="M3.5 8a4.5 4.5 0 009 0M8 12.5v2M5.5 14.5h5" />
  </svg>
);

const MicRecordingIcon = (
  <svg viewBox="0 0 16 16" fill="currentColor">
    <rect x="5" y="5" width="6" height="6" rx="1" />
  </svg>
);

const MicTranscribingIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    style={{ animation: "wts-spin 1s linear infinite" }}
  >
    <path d="M12 2a10 10 0 0 1 10 10" />
  </svg>
);

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function LevelBars({ level }: { level: number }) {
  const bars = [0, 1, 2, 3, 4];
  return (
    <span className="vc-level-bars">
      {bars.map((i) => {
        const offset = Math.abs(i - 2) * 0.18;
        const h = Math.max(4, Math.min(16, (level - offset) * 32));
        return (
          <span className="vc-level-bar" style={{ height: `${h}px` }} key={i} />
        );
      })}
    </span>
  );
}

export function ChatPane({
  title,
  messages,
  sending,
  userInitial,
  onSend,
}: ChatPaneProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const voice = useVoiceRecorder((transcript) => {
    const trimmed = transcript.trim();
    if (trimmed) onSend(trimmed);
  });

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  function autoGrow() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    onSend(trimmed);
    setText("");
    const el = inputRef.current;
    if (el) el.style.height = "auto";
  }

  function toggleVoice() {
    if (sending) return;
    if (voice.state === "recording") voice.stop();
    else if (voice.state === "idle") void voice.start();
  }

  const showWelcome = messages.length === 0;
  const micClass =
    voice.state === "recording"
      ? "btn-mic-primary recording"
      : voice.state === "transcribing"
        ? "btn-mic-primary transcribing"
        : "btn-mic-primary";

  return (
    <main className="chat-pane">
      <div className="chat-head">
        <div>
          <div className="chat-head-label">Conversation</div>
          <div className="chat-head-title">{title}</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="wts-btn ghost" style={{ height: 28, padding: "0 10px", fontSize: 12 }}>
            History
          </button>
        </div>
      </div>

      <div className="messages" ref={messagesRef}>
        {showWelcome ? (
          <div className="welcome-msg">
            <h2>Chat with your site.</h2>
            <p>
              Tap the mic and describe your changes, or type below. Try: "make the
              headline quieter and italicise Sunday."
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.key}
              role={m.role}
              content={m.content}
              changes={m.changes}
              userInitial={userInitial}
              time={m.time}
            />
          ))
        )}
      </div>

      <div className={sending ? "typing-indicator visible" : "typing-indicator"}>
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>

      <div className="chat-composer">
        <div className="composer-bar">
          <button
            className={micClass}
            title="Record voice message"
            aria-label="Record"
            onClick={toggleVoice}
            disabled={sending || voice.state === "transcribing"}
          >
            {voice.state === "recording"
              ? MicRecordingIcon
              : voice.state === "transcribing"
                ? MicTranscribingIcon
                : MicIdleIcon}
          </button>
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder="Or type your changes here…"
            rows={1}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              autoGrow();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <button
            className="btn-send"
            aria-label="Send"
            disabled={!text.trim() || sending}
            onClick={submit}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <div className="voice-status">
          {voice.state === "recording" ? (
            <>
              <span className="vc-dot" />
              <LevelBars level={voice.level} />
              <span className="vc-timer">{formatTime(voice.seconds)}</span>
              <span style={{ color: "var(--muted-2)" }}>tap to stop</span>
            </>
          ) : voice.state === "transcribing" ? (
            <span style={{ color: "var(--accent)" }}>Transcribing…</span>
          ) : voice.error ? (
            <span style={{ color: "var(--danger)" }}>{voice.error}</span>
          ) : null}
        </div>
        <div className="composer-hint">
          <span>
            Or type — <span className="wts-kbd">⌘ ↵</span> to send
          </span>
          <span>Voice and prompts welcome</span>
        </div>
      </div>
    </main>
  );
}
