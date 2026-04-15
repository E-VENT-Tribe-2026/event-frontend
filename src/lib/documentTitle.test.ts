import { describe, it, expect } from 'vitest';
import { APP_NAME, DEFAULT_DOCUMENT_TITLE, formatPageTitle } from './documentTitle';

describe('formatPageTitle', () => {
  it('returns default title for empty or whitespace', () => {
    expect(formatPageTitle('')).toBe(DEFAULT_DOCUMENT_TITLE);
    expect(formatPageTitle('   ')).toBe(DEFAULT_DOCUMENT_TITLE);
  });

  it('formats non-empty page title with app suffix', () => {
    expect(formatPageTitle('Home')).toBe(`Home · ${APP_NAME}`);
    expect(formatPageTitle('  Events  ')).toBe(`Events · ${APP_NAME}`);
  });
});
