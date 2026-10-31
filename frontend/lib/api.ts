/**
 * Same-origin Node API under Next.js `/api/v1`.
 * Old Python backends on :8000/:8001 are ignored so login doesn't hang on a dead host.
 */
function resolveApiBase() {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "").trim();
  if (!raw) return "/api/v1";
  if (/localhost:800[01]/i.test(raw) || /127\.0\.0\.1:800[01]/i.test(raw)) {
    return "/api/v1";
  }
  return raw.replace(/\/$/, "");
}

const API_BASE = resolveApiBase();

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("vyapaarai_token");
}

export function setToken(token: string) {
  localStorage.setItem("vyapaarai_token", token);
}

export function clearToken() {
  localStorage.removeItem("vyapaarai_token");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers, cache: "no-store" });
  } catch {
    throw new Error("Cannot reach API. Use /api/v1 (Next server) — do not point NEXT_PUBLIC_API_URL at :8000/:8001.");
  }
  if (!response.ok) {
    let detail = "Request failed";
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch {
      detail = await response.text();
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
