import { sanitizeUrl } from '@/lib/sanitize';

/**
 * Builds the content of the event window shown when an event is selected on the map.
 *
 * Every piece of user text (title, location, organizer name, username, …) is set with
 * `textContent`, so it is always shown as plain text and can never be parsed as HTML or run
 * as script — regardless of quotation marks, markup or script in the value. Never switch this
 * back to an HTML string.
 */

export interface MapEventPopupData {
  id: string;
  title: string;
  date: string;
  time: string;
  location?: string | null;
  budget: number;
  organizerFullName: string;
  /** Already formatted for display, e.g. "@anna". Omitted when the organizer has no username. */
  organizerUsername?: string | null;
  organizerAvatar?: string | null;
}

const AVATAR_SIZE_STYLE = 'width:28px;height:28px;border-radius:50%;flex-shrink:0';
const INITIAL_STYLE = `${AVATAR_SIZE_STYLE};background:#6d28d9;color:#fff;font-size:11px;font-weight:700;align-items:center;justify-content:center`;

function asText(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  const text = String(value);
  return text === '' ? fallback : text;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.style.cssText = style;
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildAvatar(data: MapEventPopupData): HTMLElement[] {
  const initial = asText(data.organizerFullName, 'O').charAt(0).toUpperCase();
  const initialEl = el('span', `${INITIAL_STYLE};display:flex`, initial);

  // Only http(s) URLs are allowed as the avatar source.
  const avatarUrl = sanitizeUrl(asText(data.organizerAvatar));
  if (!avatarUrl) return [initialEl];

  const img = el('img', `${AVATAR_SIZE_STYLE};object-fit:cover;border:2px solid #6d28d9`);
  img.src = avatarUrl;
  img.alt = '';
  initialEl.style.display = 'none';
  img.addEventListener('error', () => {
    img.style.display = 'none';
    initialEl.style.display = 'flex';
  });
  return [img, initialEl];
}

function buildCostBadge(budget: unknown): HTMLElement {
  const base = 'display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700';
  if (budget === 0) {
    return el('span', `${base};background:#22c55e20;color:#16a34a`, 'Free');
  }
  return el('span', `${base};background:#6d28d920;color:#6d28d9`, `€${asText(budget)}`);
}

export function buildMapEventPopup(data: MapEventPopupData): HTMLElement {
  const root = el('div', 'font-family:system-ui,sans-serif;min-width:200px;max-width:260px');

  const title = el(
    'h3',
    'margin:0 0 6px;font-size:14px;font-weight:700;line-height:1.3;color:#0f172a',
    asText(data.title),
  );
  const when = el(
    'p',
    'margin:0 0 2px;font-size:11px;color:#64748b',
    `${asText(data.date)} · ${asText(data.time)}`,
  );
  const location = el('p', 'margin:0 0 10px;font-size:11px;color:#64748b', asText(data.location, '—'));

  const organizerRow = el(
    'div',
    'display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:8px;background:#f8fafc;border-radius:8px',
  );
  const organizerText = el('div', 'min-width:0;line-height:1.2');
  organizerText.append(
    el(
      'p',
      'margin:0;font-size:11px;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis',
      asText(data.organizerFullName, 'Organizer'),
    ),
  );
  const username = asText(data.organizerUsername);
  if (username) {
    organizerText.append(el('p', 'margin:0;font-size:10px;color:#64748b', username));
  }
  const costWrap = el('div', 'margin-left:auto');
  costWrap.append(buildCostBadge(data.budget));
  organizerRow.append(...buildAvatar(data), organizerText, costWrap);

  const button = el(
    'button',
    'width:100%;padding:8px 10px;border:none;border-radius:8px;background:#6d28d9;color:#fff;font-size:12px;font-weight:600;cursor:pointer',
    'View event details',
  );
  button.type = 'button';
  // dataset sets the attribute value directly; it is never parsed as HTML.
  button.dataset.mapEventId = asText(data.id);

  root.append(title, when, location, organizerRow, button);
  return root;
}