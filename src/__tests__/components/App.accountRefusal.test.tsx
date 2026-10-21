import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import App from '@/App';
import { ACCOUNT_REFUSED_EVENT, type AccountRefusal } from '@/lib/accountRefusal';
import { setAuthToken, getAuthToken } from '@/lib/auth';

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/lib/supabase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase')>()),
  supabase: null,
  syncSupabaseSession: vi.fn(() => Promise.resolve()),
  clearSupabaseSession: vi.fn(),
}));

function refuse(detail: AccountRefusal) {
  act(() => {
    window.dispatchEvent(new CustomEvent(ACCOUNT_REFUSED_EVENT, { detail }));
  });
}

describe('App — sign-out on account refusal (ticket #294 Part 6)', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 500 }))));
    // A plain page (NotFound): the welcome page needs browser APIs jsdom lacks.
    window.history.replaceState(null, '', '/no-such-page');
    setAuthToken('token-abc');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('signs out a user who became an administrator and sends them to /login with no state', () => {
    render(<App />);
    mockNavigate.mockClear();

    refuse({ kind: 'administrator' });

    expect(getAuthToken()).toBeNull();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('signs out a suspended user and sends them to /login with the suspension', () => {
    render(<App />);
    mockNavigate.mockClear();

    refuse({ kind: 'suspended', reason: 'Spam in event chats.' });

    expect(getAuthToken()).toBeNull();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/login', {
      replace: true,
      state: { suspension: { reason: 'Spam in event chats.' } },
    });
  });
});
