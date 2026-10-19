import { describe, it, expect } from 'vitest';
import { formatUserIdentity } from '@/lib/userIdentity';

describe('formatUserIdentity', () => {
  it('formats as "username (Full Name)" when a username exists', () => {
    expect(formatUserIdentity({ username: 'john_42', fullName: 'John Smith' })).toBe(
      'john_42 (John Smith)'
    );
  });

  it('falls back to full name alone when there is no username yet', () => {
    expect(formatUserIdentity({ username: undefined, fullName: 'John Smith' })).toBe('John Smith');
    expect(formatUserIdentity({ username: '', fullName: 'John Smith' })).toBe('John Smith');
  });

  it('trims whitespace on both fields', () => {
    expect(formatUserIdentity({ username: '  john_42  ', fullName: '  John Smith  ' })).toBe(
      'john_42 (John Smith)'
    );
  });
});