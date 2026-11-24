import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppRoutes from '@/app/AppRoutes';
import { clearAuthToken } from '@/lib/auth';
import { logout } from '@/lib/storage';

function renderPath(path: string) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('signed-out visitors (12.2 authentication hardening)', () => {
  beforeEach(() => {
    clearAuthToken();
    logout();
    class FakeIntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  });

  afterEach(() => {
    clearAuthToken();
    logout();
    vi.unstubAllGlobals();
  });

  it.each([
    ['/home', 'home page'],
    ['/notifications', 'notifications page'],
    ['/event/evt-1', 'event details page'],
    ['/events/evt-1', 'event details alias'],
    ['/map', 'map page'],
    ['/create', 'create event page'],
    ['/friends', 'friends page'],
  ])('sends a signed-out user from %s (%s) to sign-in', async (path) => {
    renderPath(path);
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });

  it('keeps the welcome page open', async () => {
    renderPath('/');
    expect(await screen.findByRole('heading', { name: /find your people/i })).toBeInTheDocument();
  });

  it('keeps the sign-in page open', async () => {
    renderPath('/login');
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });

  it('keeps the sign-up page open', async () => {
    renderPath('/signup');
    expect(await screen.findByRole('heading', { name: /invitation required|create account/i })).toBeInTheDocument();
  });

  it('keeps the forgot-password page open', async () => {
    renderPath('/forgot-password');
    expect(await screen.findByRole('heading', { name: /reset password/i })).toBeInTheDocument();
  });

  it('keeps the reset-password page open', async () => {
    renderPath('/reset-password');
    expect(await screen.findByRole('heading', { name: /set new password/i })).toBeInTheDocument();
  });
});
