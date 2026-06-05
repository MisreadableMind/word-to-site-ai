import { useCallback, useEffect, useRef, useState } from "react";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function useOnboardingStream() {
  const [events, setEvents] = useState<StreamProgress[]>([]);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<unknown>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const start = useCallback(
    (path: string) => {
      stop();
      setEvents([]);
      setResult(null);
      setError(null);
      setStatus("streaming");

      const controller = new AbortController();
      abortRef.current = controller;

      const handle = (raw: string): boolean => {
        let data: StreamMessage;
        try {
          data = JSON.parse(raw) as StreamMessage;
        } catch {
          return false;
        }
        if (data.step === "result") {
          setResult(data.data ?? data);
          setStatus("done");
          return true;
        }
        if (data.step === "error") {
          setError(data.error || data.message || "Something went wrong.");
          setStatus("error");
          return true;
        }
        if (data.step) {
          setEvents((prev) => [...prev, { step: data.step as string, message: data.message, data }]);
        }
        return false;
      };

      void (async () => {
        try {
          const res = await fetch(path, {
            headers: { Accept: "text/event-stream" },
            signal: controller.signal,
          });

          if (!res.ok || !res.body) {
            const payload = await res.json().catch(() => null);
            setError((isRecord(payload) ? payload.error : null) ?? "Connection lost.");
            setStatus("error");
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
              if (payload && handle(payload)) {
                controller.abort();
                return;
              }
              sep = buffer.indexOf("\n\n");
            }
          }

          setStatus((s) => (s === "done" ? s : "error"));
          setError((prev: unknown) => prev ?? "Connection lost.");
        } catch {
          if (controller.signal.aborted) return;
          setStatus((s) => (s === "done" ? s : "error"));
          setError((prev: unknown) => prev ?? "Connection lost.");
        }
      })();
    },
    [stop],
  );

  useEffect(() => stop, [stop]);

  return { events, status, result, error, start, stop };
}
