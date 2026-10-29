import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AdminAuditTab from '@/components/admin/AdminAuditTab';
import * as adminApi from '@/lib/adminApi';
import type { AdminAuditEntry, AdminAuditResponse } from '@/lib/adminApi';

function entry(partial: Partial<AdminAuditEntry> & Pick<AdminAuditEntry, 'id' | 'action' | 'admin_name'>): AdminAuditEntry {
  return {
    admin_id: partial.admin_id ?? partial.admin_name,
    admin_username: partial.admin_username ?? null,
    created_at: partial.created_at ?? new Date(2026, 9, 25, 12, 0, 0).toISOString(),
    target_id: null,
    target_type: 'user',
    target_name: 'Alex',
    reason: 'Note',
    details: null,
    ...partial,
  };
}

function page(items: AdminAuditEntry[], more = false, next: string | null = null): AdminAuditResponse {
  return {
    items,
    total: items.length,
    page: 1,
    limit: 20,
    total_pages: 1,
    has_more: more,
    next_before: next,
  };
}

describe('AdminAuditTab filters', () => {
  beforeEach(() => {
    vi.spyOn(adminApi, 'fetchAdminAudit').mockResolvedValue(page([]));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('filters the log by administrator, action, and date', async () => {
    const ada = entry({
      id: 'a1',
      action: 'warn',
      admin_id: 'ada',
      admin_name: 'Ada Lovelace',
      admin_username: 'ada.admin',
    });
    const bob = entry({
      id: 'a2',
      action: 'suspend',
      admin_id: 'bob',
      admin_name: 'Bob Admin',
      admin_username: 'bob.admin',
      created_at: new Date(2026, 9, 24, 12, 0, 0).toISOString(),
    });
    vi.mocked(adminApi.fetchAdminAudit).mockResolvedValue(page([ada, bob]));

    render(<AdminAuditTab onErrorToast={() => {}} />);

    expect(await screen.findAllByText('Ada Lovelace')).not.toHaveLength(0);
    expect(screen.getAllByText('Bob Admin').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Filter by administrator'), { target: { value: 'Ada' } });
    expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
    expect(screen.queryByText('Bob Admin')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filter by administrator'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Filter by action'), { target: { value: 'suspend' } });
    expect(screen.getAllByText('Bob Admin').length).toBeGreaterThan(0);
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filter by action'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Filter by date'), { target: { value: '2026-10-25' } });
    expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
    expect(screen.queryByText('Bob Admin')).not.toBeInTheDocument();
  });

  it('loads later pages while a filter is active so matches are not missed', async () => {
    const ada = entry({ id: 'a1', action: 'warn', admin_id: 'ada', admin_name: 'Ada Lovelace' });
    const bob = entry({ id: 'a2', action: 'warn', admin_id: 'bob', admin_name: 'Bob Admin' });
    vi.mocked(adminApi.fetchAdminAudit).mockImplementation(async (_page, _limit, before) => {
      if (!before) return page([ada], true, 'cursor-2');
      return page([bob], false, null);
    });

    render(<AdminAuditTab onErrorToast={() => {}} />);
    expect(await screen.findAllByText('Ada Lovelace')).not.toHaveLength(0);

    fireEvent.change(screen.getByLabelText('Filter by administrator'), { target: { value: 'Bob' } });

    await waitFor(() => {
      expect(screen.getAllByText('Bob Admin').length).toBeGreaterThan(0);
    });
    expect(adminApi.fetchAdminAudit).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
  });
});
