export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type Json = Record<string, unknown>;

function isObject(v: unknown): v is Json {
  return typeof v === "object" && v !== null;
}

// Backend uses two error shapes: { success:false, error:"str" } (onboard/voice/
// legacy) and { error:{ message, type } } (domain/editor). Normalize both.
function extractError(body: unknown, status: number): string {
  if (isObject(body)) {
    const err = body.error;
    if (typeof err === "string") return err;
    if (isObject(err) && typeof err.message === "string") return err.message;
    if (typeof body.message === "string") return body.message;
  }
  return `Request failed (${status})`;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const res = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init?.body !== undefined && !isForm
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok || (isObject(body) && body.success === false)) {
    throw new ApiError(extractError(body, res.status), res.status, body);
  }
  return body as T;
}

export const apiGet = <T>(path: string): Promise<T> => api<T>(path);

export const apiSend = <T>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  data?: unknown,
): Promise<T> =>
  api<T>(path, {
    method,
    body: data === undefined ? undefined : JSON.stringify(data),
  });
