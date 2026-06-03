import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiSend } from "~/lib/api";

export type ChatRole = "system" | "user" | "assistant";

export interface AppliedChange {
  type: string;
  success: boolean;
  error: string | null;
}

export interface MessageMetadata {
  changes: AppliedChange[];
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  metadata: MessageMetadata | null;
  created_at: string;
}

export interface ChatSession {
  id: string;
  site_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatSessionDetail extends ChatSession {
  messages: ChatMessage[];
}

interface SessionsResponse {
  success: boolean;
  sessions: ChatSession[];
}

interface SessionResponse {
  success: boolean;
  session: ChatSession;
}

interface SessionDetailResponse {
  success: boolean;
  session: ChatSessionDetail;
}

export interface SendMessageResponse {
  success: boolean;
  message: string;
  changes: AppliedChange[];
}

export const sessionsKey = (siteId: string) =>
  ["editor", "sessions", siteId] as const;
export const sessionKey = (sessionId: string) =>
  ["editor", "session", sessionId] as const;

export function useSessions(siteId: string | null) {
  return useQuery({
    queryKey: sessionsKey(siteId ?? ""),
    queryFn: () =>
      api<SessionsResponse>(
        `/api/editor/chat/sessions?siteId=${encodeURIComponent(siteId ?? "")}`,
      ).then((r) => r.sessions),
    enabled: !!siteId,
  });
}

export function useSession(sessionId: string | null) {
  return useQuery({
    queryKey: sessionKey(sessionId ?? ""),
    queryFn: () =>
      api<SessionDetailResponse>(
        `/api/editor/chat/sessions/${sessionId}`,
      ).then((r) => r.session),
    enabled: !!sessionId,
  });
}

export function useCreateSession(siteId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiSend<SessionResponse>("/api/editor/chat/sessions", "POST", {
        siteId,
      }).then((r) => r.session),
    onSuccess: () => {
      if (siteId) qc.invalidateQueries({ queryKey: sessionsKey(siteId) });
    },
  });
}

export function useDeleteSession(siteId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiSend<{ success: boolean }>(
        `/api/editor/chat/sessions/${sessionId}`,
        "DELETE",
      ),
    onSuccess: () => {
      if (siteId) qc.invalidateQueries({ queryKey: sessionsKey(siteId) });
    },
  });
}

export function useSendMessage() {
  return useMutation({
    mutationFn: (vars: { sessionId: string; message: string }) =>
      apiSend<SendMessageResponse>(
        `/api/editor/chat/sessions/${vars.sessionId}/messages`,
        "POST",
        { message: vars.message },
      ),
  });
}
