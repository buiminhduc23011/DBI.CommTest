import { isRecord } from './utils';

export interface ApiErrorPayload {
  code?: string;
  message?: string;
  details?: unknown;
}
import { FALLBACK_BACKEND_URL } from './constants';

export function getBackendUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('backendUrl') ?? FALLBACK_BACKEND_URL;
}

export function asApiError(payload: unknown): ApiErrorPayload {
  if (!isRecord(payload)) return {};
  return {
    code: typeof payload.code === 'string' ? payload.code : undefined,
    message: typeof payload.message === 'string' ? payload.message : undefined,
    details: payload.details,
  };
}

export function errorText(payload: ApiErrorPayload, fallback: string): string {
  if (payload.message && payload.message.trim().length > 0) return payload.message;
  return fallback;
}

export async function runtimeFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getBackendUrl()}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const raw = (await response.text()).trim();
  const data = raw.length > 0 ? (JSON.parse(raw) as unknown) : null;

  if (!response.ok) {
    throw asApiError(data);
  }

  return data as T;
}
