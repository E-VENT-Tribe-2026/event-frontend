const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

export function getBaseUrl() {
  if (!RAW_API_BASE_URL) {
    return null;
  }
  // .env values sometimes include accidental whitespace (e.g. " https://...").
  return RAW_API_BASE_URL.trim().replace(/\/+$/, "");
}


export const API_ENDPOINTS = {
  LOGIN: "/api/auth/login",
  SIGNUP: "/api/auth/register",
  EVENTS: "/api/events/",
} as const;


