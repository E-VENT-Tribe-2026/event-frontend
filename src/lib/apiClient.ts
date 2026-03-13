import { getApiUrl } from './api';

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await res.json().catch(() => undefined) : await res.text().catch(() => undefined);

  if (!res.ok) {
    const msg =
      (isJson && body && (body.detail || body.message || body.error)) ||
      (typeof body === 'string' && body) ||
      `Request failed with status ${res.status}`;
    throw new ApiError(msg, res.status);
  }

  return (body ?? ({} as T)) as T;
}

export const apiClient = {
  async get<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(getApiUrl(path), {
      method: 'GET',
      credentials: 'include',
      ...init,
    });
    return handleResponse<T>(res);
  },

  async post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    const res = await fetch(getApiUrl(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include',
      ...init,
    });
    return handleResponse<T>(res);
  },

  async put<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    const res = await fetch(getApiUrl(path), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include',
      ...init,
    });
    return handleResponse<T>(res);
  },
};

