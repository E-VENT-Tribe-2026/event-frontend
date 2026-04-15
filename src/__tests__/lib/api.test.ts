import { describe, it, expect } from 'vitest';
import { getApiUrl, API_BASE_URL } from '@/lib/api';

describe('getApiUrl', () => {
  it('prepends slash when path omits it', () => {
    expect(getApiUrl('api/events')).toBe(`${API_BASE_URL}/api/events`);
  });

  it('does not duplicate slash when path starts with /', () => {
    expect(getApiUrl('/api/events')).toBe(`${API_BASE_URL}/api/events`);
  });
});
