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

export function useOnboardingStream() {
  const [events, setEvents] = useState<StreamProgress[]>([]);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const stop = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
  }, []);

  const start = useCallback(
    (path: string) => {
      stop();
      setEvents([]);
      setResult(null);
      setError(null);
      setStatus("streaming");

      const es = new EventSource(path);
      esRef.current = es;

      es.onmessage = (e) => {
        let data: StreamMessage;
        try {
          data = JSON.parse(e.data) as StreamMessage;
        } catch {
          return;
        }
        if (data.step === "result") {
          es.close();
          esRef.current = null;
          setResult(data.data ?? data);
          setStatus("done");
        } else if (data.step === "error") {
          es.close();
          esRef.current = null;
          setError(data.error || data.message || "Something went wrong.");
          setStatus("error");
        } else if (data.step) {
          setEvents((prev) => [...prev, { step: data.step as string, message: data.message, data }]);
        }
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        setStatus((s) => (s === "done" ? s : "error"));
        setError((prev) => prev ?? "Connection lost.");
      };
    },
    [stop],
  );

  useEffect(() => stop, [stop]);

  return { events, status, result, error, start, stop };
}
