import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COLOR_SCHEME_STORAGE_KEY,
  applyStoredColorScheme,
  getColorScheme,
  isColorScheme,
  resolveColorScheme,
  setColorScheme,
} from '@/lib/colorScheme';

function resetDom() {
  try {
    window.localStorage.removeItem(COLOR_SCHEME_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  document.documentElement.removeAttribute('data-color-scheme');
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = '';
}

describe('colorScheme', () => {
  beforeEach(() => {
    resetDom();
  });

  afterEach(() => {
    resetDom();
  });

  it('treats only dark, light and system as valid schemes', () => {
    expect(isColorScheme('dark')).toBe(true);
    expect(isColorScheme('light')).toBe(true);
    expect(isColorScheme('system')).toBe(true);
    expect(isColorScheme('sunset')).toBe(false);
  });

  it('defaults to dark when nothing is stored', () => {
    expect(getColorScheme()).toBe('dark');
    expect(resolveColorScheme()).toBe('dark');
  });

  it('applies light tokens on the document', () => {
    setColorScheme('light');
    expect(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.dataset.colorScheme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('applies dark tokens on the document', () => {
    setColorScheme('dark');
    expect(document.documentElement.dataset.colorScheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('resolves system from the OS preference', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-color-scheme: dark') ? false : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }));
    expect(resolveColorScheme('system')).toBe('light');
    applyStoredColorScheme();
    setColorScheme('system');
    expect(document.documentElement.dataset.colorScheme).toBe('light');
  });
});
