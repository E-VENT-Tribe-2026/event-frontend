export const APP_NAME = 'E-VENT';

/** Default tab title (matches `index.html` first paint). */
export const DEFAULT_DOCUMENT_TITLE = `${APP_NAME} — Discover events`;

/** e.g. "Home · E-VENT" */
export function formatPageTitle(pageTitle: string): string {
  const t = pageTitle.trim();
  if (!t) return DEFAULT_DOCUMENT_TITLE;
  return `${t} · ${APP_NAME}`;
}
