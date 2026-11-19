import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReportContentDialog from '@/components/ReportContentDialog';
import * as reportsApi from '@/lib/reportsApi';

describe('ReportContentDialog', () => {
  beforeEach(() => {
    vi.spyOn(reportsApi, 'createReport').mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('submits an event report from event details', async () => {
    const onSuccess = vi.fn();
    vi.spyOn(reportsApi, 'createReport').mockResolvedValue({
      id: 1,
      status: 'open',
      target_type: 'event',
      target_id: 'evt-1',
      reason: 'spam',
      origin: 'event_details',
      created_at: '2026-10-25T00:00:00Z',
      message: 'Thanks. We received your report.',
    });

    render(
      <ReportContentDialog
        open
        onOpenChange={vi.fn()}
        targetType="event"
        targetId="evt-1"
        origin="event_details"
        onSuccess={onSuccess}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Scam or fraud' }));
    fireEvent.click(screen.getByRole('button', { name: /submit report/i }));

    await waitFor(() => {
      expect(reportsApi.createReport).toHaveBeenCalledWith({
        target_type: 'event',
        target_id: 'evt-1',
        reason: 'scam_or_fraud',
        origin: 'event_details',
        description: null,
      });
      expect(onSuccess).toHaveBeenCalledWith('Thanks. We received your report.');
    });
  });

  it('blocks Other without a description', async () => {
    render(
      <ReportContentDialog
        open
        onOpenChange={vi.fn()}
        targetType="user"
        targetId="u1"
        origin="profile"
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Other' }));
    fireEvent.click(screen.getByRole('button', { name: /submit report/i }));
    expect(await screen.findByText('Please describe what happened.')).toBeInTheDocument();
    expect(reportsApi.createReport).not.toHaveBeenCalled();
  });
});
