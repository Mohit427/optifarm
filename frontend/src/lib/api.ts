/** Thin client for the OptiFarm FastAPI backend. All AI calls go through the backend. */
export const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...init, signal: ctrl.signal });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = (await res.json()) as { detail?: string };
        if (body.detail) detail = body.detail;
      } catch {
        /* not JSON */
      }
      throw new ApiError(res.status, detail);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const apiGet = <T>(path: string, timeoutMs = 8000) => request<T>(path, {}, timeoutMs);

export const apiPost = <T>(path: string, body: unknown, timeoutMs = 30000) =>
  request<T>(
    path,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    timeoutMs,
  );

export interface SeedMatch {
  crop_id: string;
  confidence: number;
}

export async function identifySeed(file: Blob): Promise<SeedMatch[]> {
  const form = new FormData();
  form.append('image', file, 'seed.jpg');
  const res = await request<{ top_matches: SeedMatch[] }>(
    '/seed/identify',
    { method: 'POST', body: form },
    45000,
  );
  return res.top_matches;
}

export async function checkHealth(): Promise<{ ok: boolean; ai: boolean }> {
  try {
    const r = await apiGet<{ status: string; ai_configured: boolean }>('/health', 4000);
    return { ok: r.status === 'ok', ai: r.ai_configured };
  } catch {
    return { ok: false, ai: false };
  }
}
