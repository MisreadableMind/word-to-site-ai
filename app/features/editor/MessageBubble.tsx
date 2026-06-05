import { memo, useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { AppliedChange, ChatRole } from "./queries";

interface MessageBubbleProps {
  role: ChatRole;
  content: string;
  changes: AppliedChange[];
  userInitial: string;
  time: string;
}

function ChangesBadge({ changes }: { changes: AppliedChange[] }) {
  const successCount = changes.filter((c) => c.success).length;
  return (
    <div className="changes-badge">
      <div className="changes-badge-label">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        {successCount} change{successCount !== 1 ? "s" : ""} applied
      </div>
      {changes.map((change, i) => {
        const label = change.type.replace(/_/g, " ");
        const status = change.success ? "applied" : `failed: ${change.error ?? ""}`;
        return (
          <div className="change-detail" key={i}>
            {label} — {status}
          </div>
        );
      })}
    </div>
  );
}

export const MessageBubble = memo(function MessageBubble({
  role,
  content,
  changes,
  userInitial,
  time,
}: MessageBubbleProps) {
  const isUser = role === "user";

  const html = useMemo(() => {
    if (isUser) return null;
    return DOMPurify.sanitize(marked.parse(content) as string);
  }, [isUser, content]);

  return (
    <div className={`message ${role}`}>
      <div className="message-header">
        <div className="message-avatar">{isUser ? userInitial : "w"}</div>
        <span className="message-author">{isUser ? "You" : "word→site"}</span>
        <span className="message-time">{time}</span>
      </div>
      {isUser ? (
        <div className="message-bubble">{content}</div>
      ) : (
        <div
          className="message-bubble"
          dangerouslySetInnerHTML={{ __html: html ?? "" }}
        />
      )}
      {changes.length > 0 ? <ChangesBadge changes={changes} /> : null}
    </div>
  );
});
