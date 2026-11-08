/**
 * HTML for the map event window (a Leaflet popup is plain HTML): the Friends icon with a small
 * green number of the user's friends who attend. Empty when none do.
 * Only a whole number is ever written into the markup.
 */
export function friendsAttendingHtml(count: number | undefined): string {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return '';
  const whole = Math.floor(n);
  const label = `${whole} ${whole === 1 ? 'friend' : 'friends'} attending`;
  return (
    `<p data-testid="friends-attending-count" aria-label="${label}" title="${label}" ` +
    `style="margin:0 0 10px;display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:#0f172a">` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>` +
    `<path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>` +
    `<span style="color:#22c55e">${whole}</span></p>`
  );
}
