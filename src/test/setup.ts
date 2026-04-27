import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { clearAuthToken } from "@/lib/auth";
import {
  logout,
  saveEvents,
  saveJoinRequests,
  saveNotifications,
  saveTickets,
  saveUsers,
} from "@/lib/storage";

afterEach(() => {
  cleanup();
  clearAuthToken();
  logout();
  saveUsers([]);
  saveEvents([]);
  saveJoinRequests([]);
  saveTickets([]);
  saveNotifications([]);
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
  vi.clearAllMocks();
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
