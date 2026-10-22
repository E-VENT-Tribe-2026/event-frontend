import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResetPasswordPage from '@/pages/ResetPasswordPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/reset-password');
  });

  it('hands an email confirmation link to auth callback instead of asking for a password', async () => {
    window.history.replaceState({}, '', '/reset-password#access_token=jwt-from-verify&type=signup');
    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <ResetPasswordPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/auth/callback#access_token=jwt-from-verify&type=signup',
        { replace: true },
      );
    });
  });
});
