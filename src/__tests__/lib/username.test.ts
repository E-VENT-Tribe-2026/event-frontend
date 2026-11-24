import { describe, it, expect } from 'vitest';
import { destinationAfterSignIn, hasChosenUsername, profileFromMeResponse } from '@/lib/username';

describe('profileFromMeResponse', () => {
  it('reads a flat profile', () => {
    expect(profileFromMeResponse({ username: 'alex', role: 'participant' }).username).toBe('alex');
  });

  it('unwraps data, user, and profile envelopes', () => {
    expect(profileFromMeResponse({ data: { username: 'maya' } }).username).toBe('maya');
    expect(profileFromMeResponse({ user: { username: 'sam' } }).username).toBe('sam');
    expect(profileFromMeResponse({ profile: { username: 'lee' } }).username).toBe('lee');
  });

  it('returns an empty object for garbage', () => {
    expect(profileFromMeResponse(null)).toEqual({});
    expect(profileFromMeResponse('nope')).toEqual({});
  });
});

describe('hasChosenUsername', () => {
  it('treats blank values as not chosen', () => {
    expect(hasChosenUsername('maya')).toBe(true);
    expect(hasChosenUsername('  ')).toBe(false);
    expect(hasChosenUsername(null)).toBe(false);
  });
});

describe('destinationAfterSignIn', () => {
  it('sends a verified administrator to /admin even without a username', () => {
    expect(destinationAfterSignIn(null, 'administrator')).toBe('/admin');
    expect(destinationAfterSignIn('', 'admin')).toBe('/admin');
  });

  it('sends accounts without a username to choose-username', () => {
    expect(destinationAfterSignIn(null, 'participant')).toBe('/choose-username');
  });

  it('sends everyone else with a username home', () => {
    expect(destinationAfterSignIn('maya', 'participant')).toBe('/home');
  });
});
