import { describe, it, expect } from 'vitest';
import { buildMapEventPopup } from '@/lib/mapEventPopup';

const base = {
  id: 'evt-1',
  title: 'Board games night',
  date: '2026-10-10',
  time: '18:00',
  location: 'Bremen',
  budget: 0,
  organizerFullName: 'Anna Schmidt',
  organizerUsername: '@anna',
  organizerAvatar: '',
};

const PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '" onmouseover="alert(1)',
  "' onfocus='alert(1)' autofocus='",
  'Tom\'s "Big" Party & BBQ',
];

function expectNoInjectedMarkup(popup: HTMLElement) {
  expect(popup.querySelector('script')).toBeNull();
  expect(popup.querySelector('img')).toBeNull();
  for (const node of popup.querySelectorAll('*')) {
    for (const attr of Array.from(node.attributes)) {
      expect(attr.name.startsWith('on')).toBe(false);
      expect(attr.name).not.toBe('autofocus');
    }
  }
}

describe('buildMapEventPopup', () => {
  it.each(PAYLOADS)('shows title, location, organizer name and username as plain text: %s', (payload) => {
    const popup = buildMapEventPopup({
      ...base,
      title: payload,
      location: payload,
      organizerFullName: payload,
      organizerUsername: payload,
    });

    // The exact text is visible, unchanged and not double-escaped.
    expect(popup.querySelector('h3')?.textContent).toBe(payload);
    const texts = Array.from(popup.querySelectorAll('p')).map((p) => p.textContent);
    expect(texts.filter((t) => t === payload)).toHaveLength(3); // location, full name, username
    expect(popup.textContent).not.toContain('&amp;');
    expect(popup.textContent).not.toContain('&quot;');

    // Nothing from the payload became a real element or attribute.
    expectNoInjectedMarkup(popup);
  });

  it('keeps a malicious event id as a plain attribute value', () => {
    const id = '"><img src=x onerror=alert(1)>';
    const popup = buildMapEventPopup({ ...base, id });
    const button = popup.querySelector('button[data-map-event-id]') as HTMLButtonElement;
    expect(button.getAttribute('data-map-event-id')).toBe(id);
    expectNoInjectedMarkup(popup);
  });

  it('only uses http(s) avatar URLs', () => {
    expect(buildMapEventPopup({ ...base, organizerAvatar: 'javascript:alert(1)' }).querySelector('img')).toBeNull();
    const img = buildMapEventPopup({ ...base, organizerAvatar: 'https://example.com/a.png' }).querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://example.com/a.png');
    expect(img?.getAttribute('onerror')).toBeNull();
  });

  it('handles missing fields without crashing', () => {
    const popup = buildMapEventPopup({
      ...base,
      location: null,
      organizerFullName: '',
      organizerUsername: null,
      budget: 12,
    });
    expect(popup.textContent).toContain('—');
    expect(popup.textContent).toContain('Organizer');
    expect(popup.textContent).toContain('€12');
    expect(popup.querySelectorAll('p')).toHaveLength(3); // date, location, organizer name
  });
});