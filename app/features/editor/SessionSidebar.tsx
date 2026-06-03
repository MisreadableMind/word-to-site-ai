import clsx from "clsx";
import { DateTime } from "luxon";
import type { ChatSession } from "./queries";

interface SessionSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onNew: () => void;
}

export function SessionSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
}: SessionSidebarProps) {
  return (
    <aside className="conversations-pane">
      <div className="conversations-head">
        <span className="conversations-head-label">Conversations</span>
        <button
          className="wts-btn ghost"
          style={{ height: 22, width: 22, padding: 0, justifyContent: "center" }}
          onClick={onNew}
          aria-label="New conversation"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </button>
      </div>
      <nav className="conversations-list">
        {sessions.map((s) => {
          const date = DateTime.fromISO(s.updated_at).toLocaleString({
            month: "short",
            day: "numeric",
          });
          return (
            <button
              key={s.id}
              className={clsx("session-item", s.id === activeSessionId && "active")}
              onClick={() => onSelect(s.id)}
            >
              <div className="session-item-title">{s.title}</div>
              <div className="session-date">{date}</div>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
