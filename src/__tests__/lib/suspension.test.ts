import { describe, it, expect } from 'vitest';
import { readSuspension } from '@/lib/suspension';

describe('readSuspension — ticket #294 Part 5', () => {
  it('returns the notice with the reason for the suspended code', () => {
    expect(readSuspension({ code: 'account_suspended', message: 'Your account is suspended.', reason: 'Spam' }))
      .toEqual({ reason: 'Spam' });
  });

  it('keeps a null reason as null', () => {
    expect(readSuspension({ code: 'account_suspended', message: 'Your account is suspended.', reason: null }))
      .toEqual({ reason: null });
  });

  it('turns a blank or missing reason into null', () => {
    expect(readSuspension({ code: 'account_suspended', reason: '   ' })).toEqual({ reason: null });
    expect(readSuspension({ code: 'account_suspended' })).toEqual({ reason: null });
  });

  it('keeps the reason as raw text (no HTML handling)', () => {
    expect(readSuspension({ code: 'account_suspended', reason: '<b>bold</b>' })).toEqual({ reason: '<b>bold</b>' });
  });

  it('returns null for any other detail', () => {
    expect(readSuspension({ code: 'forbidden', reason: 'x' })).toBeNull();
    expect(readSuspension('Invalid credentials')).toBeNull();
    expect(readSuspension(null)).toBeNull();
    expect(readSuspension(undefined)).toBeNull();
  });
});
