const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');

export function getApiUrl(path: string): string {
  if (!path.startsWith('/')) {
    // Normalize so all callers can pass paths with or without leading slash
    path = `/${path}`;
  }
  return `${API_BASE_URL}${path}`;
}

export { API_BASE_URL };

