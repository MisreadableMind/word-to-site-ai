import { useCallback, useState, useSyncExternalStore } from "react";

export interface StreamProgress {
  step: string;
  message?: string;
  data?: unknown;
}

export type StreamStatus = "idle" | "streaming" | "done" | "error";

interface StreamMessage {
  step?: string;
  message?: string;
  error?: string;
  data?: unknown;
}

interface Snapshot {
  events: StreamProgress[];
  status: StreamStatus;
  result: unknown;
  error: unknown;
}

interface StreamEntry {
  snapshot: Snapshot;
  controller: AbortController;
  subscribers: Set<() => void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const IDLE: Snapshot = { events: [], status: "idle", result: null, error: null };
const streams = new Map<string, StreamEntry>();

function emit(entry: StreamEntry, patch: Partial<Snapshot>): void {
  entry.snapshot = { ...entry.snapshot, ...patch };
  entry.subscribers.forEach((fn) => fn());
}

function handleMessage(entry: StreamEntry, raw: string): boolean {
  let data: StreamMessage;
  try {
    data = JSON.parse(raw) as StreamMessage;
  } catch {
    return false;
  }
  if (data.step === "result") {
    emit(entry, { result: data.data ?? data, status: "done" });
    return true;
  }
  if (data.step === "error") {
    emit(entry, { error: data.error || data.message || "Something went wrong.", status: "error" });
    return true;
  }
  if (data.step) {
    emit(entry, { events: [...entry.snapshot.events, { step: data.step, message: data.message, data }] });
  }
  return false;
}

function startStream(key: string, path: string): void {
  if (streams.has(key)) return;

  const controller = new AbortController();
  const entry: StreamEntry = {
    snapshot: { events: [], status: "streaming", result: null, error: null },
    controller,
    subscribers: new Set(),
  };
  streams.set(key, entry);

  void (async () => {
    try {
      const res = await fetch(path, {
        headers: { Accept: "text/event-stream" },
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const payload = await res.json().catch(() => null);
        emit(entry, {
          status: "error",
          error: (isRecord(payload) ? payload.error : null) ?? "Connection lost.",
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep = buffer.indexOf("\n\n");
        while (sep !== -1) {
          const chunk = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const payload = chunk
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .join("");
          if (payload && handleMessage(entry, payload)) {
            controller.abort();
            return;
          }
          sep = buffer.indexOf("\n\n");
        }
      }

      if (entry.snapshot.status === "streaming") {
        emit(entry, { status: "error", error: entry.snapshot.error ?? "Connection lost." });
      }
    } catch {
      if (controller.signal.aborted) return;
      if (entry.snapshot.status === "streaming") {
        emit(entry, { status: "error", error: entry.snapshot.error ?? "Connection lost." });
      }
    }
  })();
}

function stopStream(key: string): void {
  const entry = streams.get(key);
  if (!entry) return;
  entry.controller.abort();
  streams.delete(key);
}

export function useOnboardingStream() {
  const [key, setKey] = useState<string | null>(null);

  const subscribe = useCallback(
    (cb: () => void) => {
      const entry = key ? streams.get(key) : null;
      if (!entry) return () => {};
      entry.subscribers.add(cb);
      return () => entry.subscribers.delete(cb);
    },
    [key],
  );

  const getSnapshot = useCallback(() => {
    const entry = key ? streams.get(key) : null;
    return entry ? entry.snapshot : IDLE;
  }, [key]);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => IDLE);

  const start = useCallback((streamKey: string, path: string) => {
    startStream(streamKey, path);
    setKey(streamKey);
  }, []);

  const stop = useCallback(() => {
    if (key) stopStream(key);
  }, [key]);

  return {
    events: snapshot.events,
    status: snapshot.status,
    result: snapshot.result,
    error: snapshot.error,
    start,
    stop,
  };
}
