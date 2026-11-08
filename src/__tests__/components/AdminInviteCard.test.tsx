import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminInviteCard from '@/components/admin/AdminInviteCard';
import * as adminApi from '@/lib/adminApi';

describe('AdminInviteCard', () => {
  beforeEach(() => {
    vi.spyOn(adminApi, 'sendSignupInvite').mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends an invitation for a valid email', async () => {
    const onSuccess = vi.fn();
    vi.spyOn(adminApi, 'sendSignupInvite').mockResolvedValue({
      email: 'new@example.com',
      code: 'ABCD-2345',
      message: 'Invitation sent to new@example.com.',
    });

    render(<AdminInviteCard onErrorToast={vi.fn()} onSuccessToast={onSuccess} />);
    fireEvent.change(screen.getByLabelText('Invite user'), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send invitation/i }));

    await waitFor(() => {
      expect(adminApi.sendSignupInvite).toHaveBeenCalledWith('new@example.com');
      expect(onSuccess).toHaveBeenCalledWith('Invitation sent to new@example.com.');
    });
    expect(screen.getByText('ABCD-2345')).toBeInTheDocument();
  });

  it('rejects an empty email without calling the API', () => {
    const onError = vi.fn();
    render(<AdminInviteCard onErrorToast={onError} />);
    fireEvent.click(screen.getByRole('button', { name: /send invitation/i }));
    expect(onError).toHaveBeenCalledWith('Enter a valid email address.');
    expect(adminApi.sendSignupInvite).not.toHaveBeenCalled();
  });
});
