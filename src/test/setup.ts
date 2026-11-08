import "@testing-library/jest-dom";
import { cleanup, configure } from "@testing-library/react";

configure({ asyncUtilTimeout: 5_000 });
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

import { clearCache } from "@/lib/queryCache";
import { queryClient } from "@/lib/queryClient";
import { COLOR_SCHEME_STORAGE_KEY } from "@/lib/colorScheme";

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
  try {
    window.localStorage.removeItem(COLOR_SCHEME_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.documentElement.removeAttribute("data-color-scheme");
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "";
  }
  clearCache();
  queryClient.clear();
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
