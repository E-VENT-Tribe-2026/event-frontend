export const COLOR_SCHEME_STORAGE_KEY = 'event_color_scheme';
export const COLOR_SCHEME_CHANGED_EVENT = 'eventapp:color-scheme';

export const COLOR_SCHEMES = ['dark', 'light', 'system'] as const;
export type ColorScheme = (typeof COLOR_SCHEMES)[number];
export type ResolvedColorScheme = 'dark' | 'light';

const DEFAULT_SCHEME: ColorScheme = 'dark';

export function isColorScheme(value: unknown): value is ColorScheme {
  return typeof value === 'string' && (COLOR_SCHEMES as readonly string[]).includes(value);
}

export function getColorScheme(): ColorScheme {
  if (typeof window === 'undefined') return DEFAULT_SCHEME;
  try {
    const stored = window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
    return isColorScheme(stored) ? stored : DEFAULT_SCHEME;
  } catch {
    return DEFAULT_SCHEME;
  }
}

export function prefersDarkScheme(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveColorScheme(preference: ColorScheme = getColorScheme()): ResolvedColorScheme {
  if (preference === 'system') return prefersDarkScheme() ? 'dark' : 'light';
  return preference;
}

function applyResolved(resolved: ResolvedColorScheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.colorScheme = resolved;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
}

export function applyStoredColorScheme() {
  applyResolved(resolveColorScheme(getColorScheme()));
  watchSystemPreference();
}

export function setColorScheme(preference: ColorScheme) {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, preference);
    } catch {
      /* ignore quota / private mode */
    }
  }
  applyStoredColorScheme();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(COLOR_SCHEME_CHANGED_EVENT, { detail: preference }));
  }
}

let systemWatchStarted = false;

function watchSystemPreference() {
  if (systemWatchStarted || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  systemWatchStarted = true;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (getColorScheme() !== 'system') return;
    applyStoredColorScheme();
    window.dispatchEvent(new CustomEvent(COLOR_SCHEME_CHANGED_EVENT, { detail: 'system' }));
  };
  if (typeof media.addEventListener === 'function') media.addEventListener('change', onChange);
  else media.addListener(onChange);
}
