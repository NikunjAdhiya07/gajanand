import type { ApiErrorBody } from "@/lib/daybook/types";

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message || "Request failed");
    this.status = status;
    this.body = body;
  }

  get code() {
    return this.body.code;
  }

  get field() {
    return this.body.field;
  }
}

export async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init?.method ?? "GET",
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, { message: "Network error. Check your connection and try again." });
  }

  const body = await res.json().catch(() => ({ message: `Unexpected response from server (${res.status})` }));
  if (!res.ok) throw new ApiError(res.status, body as ApiErrorBody);
  return body as T;
}
