import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useSearch } from "@tanstack/react-router";
import { DateTime } from "luxon";
import { useMe } from "~/lib/auth";
import { useSite } from "~/features/dashboard/queries";
import type { Site } from "~/features/dashboard/queries";
import { SessionSidebar } from "./SessionSidebar";
import { ChatPane } from "./ChatPane";
import type { UiMessage } from "./ChatPane";
import { PreviewPane } from "./PreviewPane";
import {
  useCreateSession,
  useSendMessage,
  useSession,
  useSessions,
} from "./queries";
import type { AppliedChange } from "./queries";
import "~/styles/editor.css";

const MOCK_SITE: Site = {
  id: "",
  site_name: "My Awesome Site",
  domain: null,
  wp_url: "https://example.com",
  status: "active",
  template_slug: null,
  onboard_type: null,
  created_at: new Date().toISOString(),
  expires_at: null,
  bought_out_at: null,
};

interface SiteWithCreds extends Site {
  wp_username: string | null;
  wp_password: string | null;
}

function nowTime(): string {
  return DateTime.now().toLocaleString({
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

function buildAutoLoginUrl(site: SiteWithCreds): string {
  if (!site.wp_url || !site.wp_username || !site.wp_password) return "";
  const url = encodeURIComponent(site.wp_url);
  const u = encodeURIComponent(site.wp_username);
  const p = encodeURIComponent(site.wp_password);
  return `/api/wp-auto-login?url=${url}&u=${u}&p=${p}`;
}

interface PendingMessage extends UiMessage {
  pending: true;
}

function EditorView({ site, siteId }: { site: SiteWithCreds; siteId: string | null }) {
  const { data: user } = useMe();
  const sessionsQuery = useSessions(siteId);
  const createSession = useCreateSession(siteId);
  const sendMessage = useSendMessage();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingMessage[]>([]);

  const sessionDetail = useSession(activeSessionId);

  const isMock = !siteId;

  useEffect(() => {
    if (isMock || activeSessionId) return;
    if (createSession.isPending || createSession.isSuccess) return;
    createSession.mutate(undefined, {
      onSuccess: (session) => setActiveSessionId(session.id),
    });
  }, [isMock, activeSessionId, createSession]);

  const persistedMessages = useMemo<UiMessage[]>(() => {
    const messages = sessionDetail.data?.messages ?? [];
    return messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        key: m.id,
        role: m.role,
        content: m.content,
        changes: m.metadata?.changes ?? [],
        time: DateTime.fromISO(m.created_at).toLocaleString({
          hour: "numeric",
          minute: "2-digit",
          hourCycle: "h23",
        }),
      }));
  }, [sessionDetail.data]);

  const uiMessages = useMemo<UiMessage[]>(
    () => [...persistedMessages, ...pending],
    [persistedMessages, pending],
  );

  const stagedChanges = useMemo(() => {
    let count = 0;
    for (const m of uiMessages) {
      count += m.changes.filter((c) => c.success).length;
    }
    return count;
  }, [uiMessages]);

  function handleSend(message: string) {
    if (!activeSessionId || sendMessage.isPending) return;
    setPending([
      {
        key: `pending-${Date.now()}`,
        role: "user",
        content: message,
        changes: [],
        time: nowTime(),
        pending: true,
      },
    ]);
    sendMessage.mutate(
      { sessionId: activeSessionId, message },
      {
        onSettled: () => {
          setPending([]);
          void sessionDetail.refetch();
          void sessionsQuery.refetch();
        },
      },
    );
  }

  function handleSelectSession(sessionId: string) {
    setActiveSessionId(sessionId);
    setPending([]);
  }

  function handleNewSession() {
    setPending([]);
    createSession.mutate(undefined, {
      onSuccess: (session) => setActiveSessionId(session.id),
    });
  }

  const wpUrl = site.wp_url ?? "";
  const displayUrl = wpUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const adminUrl = buildAutoLoginUrl(site);
  const title = sessionDetail.data?.title ?? "New conversation";
  const userInitial = user?.displayName?.[0]?.toUpperCase() ?? "Y";

  return (
    <div className="editor-shell">
      <div className="editor-topbar">
        <div className="editor-topbar-left">
          <Link className="wordmark-link" to="/dashboard">
            <div className="wts-mark">w</div>
            <span className="wts-wordmark">
              word<span className="arrow">→</span>site
            </span>
          </Link>
          <div className="editor-divider" />
          <Link
            className="wts-btn ghost"
            to="/dashboard"
            style={{ height: 30, padding: "0 10px", fontSize: 12.5 }}
          >
            <span style={{ color: "var(--muted)" }}>Site:</span>
            <b style={{ fontWeight: 500 }}>{site.site_name ?? "Untitled site"}</b>
            <span style={{ color: "var(--muted-2)" }}>▾</span>
          </Link>
          <div className="editor-divider" />
          <div className="wts-tabs">
            <button className="wts-tab active">Editor</button>
            <Link className="wts-tab" to="/dashboard">
              Sites
            </Link>
          </div>
        </div>
        <div className="editor-topbar-right">
          {stagedChanges > 0 ? (
            <span className="wts-badge">
              <span className="dot" />
              {stagedChanges} unpublished change{stagedChanges !== 1 ? "s" : ""}
            </span>
          ) : null}
          {adminUrl ? (
            <a className="wts-btn" href={adminUrl} target="_blank" rel="noopener">
              WP Admin ↗
            </a>
          ) : null}
          {wpUrl ? (
            <a className="wts-btn" href={wpUrl} target="_blank" rel="noopener">
              View live ↗
            </a>
          ) : null}
        </div>
      </div>

      <div className="editor-body">
        <SessionSidebar
          sessions={sessionsQuery.data ?? []}
          activeSessionId={activeSessionId}
          onSelect={handleSelectSession}
          onNew={handleNewSession}
        />
        <ChatPane
          title={title}
          messages={uiMessages}
          sending={sendMessage.isPending}
          userInitial={userInitial}
          onSend={handleSend}
        />
        <PreviewPane
          wpUrl={wpUrl}
          displayUrl={displayUrl}
          visitUrl={wpUrl}
          adminUrl={adminUrl}
          changesCount={stagedChanges}
        />
      </div>
    </div>
  );
}

export function Editor() {
  const search = useSearch({ strict: false }) as Record<string, string | undefined>;
  const loc = useLocation();
  const siteId = search.site ?? null;
  const isMock = !siteId;

  const me = useMe();
  const siteQuery = useSite(siteId ?? undefined);

  useEffect(() => {
    document.documentElement.dataset.theme = "platform";
  }, []);

  useEffect(() => {
    const base = isMock ? "word→site" : siteQuery.data?.site_name ?? "word→site";
    document.title = `${base} | Editor`;
  }, [isMock, siteQuery.data]);

  if (isMock) {
    return (
      <div className="wts">
        <EditorView site={MOCK_SITE as SiteWithCreds} siteId={null} />
      </div>
    );
  }

  if (me.isLoading) {
    return <div className="wts" />;
  }

  if (me.isError || !me.data) {
    return <Navigate to="/login" search={{ redirect: loc.href }} replace />;
  }

  if (siteQuery.isLoading) {
    return (
      <div className="wts">
        <div className="loading-screen">Loading editor…</div>
      </div>
    );
  }

  if (siteQuery.isError || !siteQuery.data) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="wts">
      <EditorView site={siteQuery.data as SiteWithCreds} siteId={siteId} />
    </div>
  );
}
