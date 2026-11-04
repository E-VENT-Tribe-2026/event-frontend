import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import AdminReportsTab from '@/components/admin/AdminReportsTab';
import * as adminApi from '@/lib/adminApi';

describe('AdminReportsTab', () => {
  beforeEach(() => {
    vi.spyOn(adminApi, 'fetchAdminReports').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      total_pages: 1,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the open list once, even when the toast callback is a new function', async () => {
    const { rerender } = render(
      <AdminReportsTab onOpenReport={() => {}} onErrorToast={() => {}} />,
    );

    await waitFor(() => {
      expect(adminApi.fetchAdminReports).toHaveBeenCalledTimes(1);
    });
    expect(adminApi.fetchAdminReports).toHaveBeenCalledWith(1, 20, 'open');

    rerender(<AdminReportsTab onOpenReport={() => {}} onErrorToast={() => {}} />);
    rerender(<AdminReportsTab onOpenReport={() => {}} onErrorToast={(msg) => void msg} />);

    await waitFor(() => {
      expect(adminApi.fetchAdminReports).toHaveBeenCalledTimes(1);
    });
  });

  it('does not refetch when the first load fails and the parent re-renders', async () => {
    vi.mocked(adminApi.fetchAdminReports).mockRejectedValue(new Error('nope'));
    const { rerender } = render(
      <AdminReportsTab onOpenReport={() => {}} onErrorToast={() => {}} />,
    );

    await waitFor(() => {
      expect(adminApi.fetchAdminReports).toHaveBeenCalledTimes(1);
    });

    rerender(<AdminReportsTab onOpenReport={() => {}} onErrorToast={() => {}} />);

    await waitFor(() => {
      expect(adminApi.fetchAdminReports).toHaveBeenCalledTimes(1);
    });
  });
});
