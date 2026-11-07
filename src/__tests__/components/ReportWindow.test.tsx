import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReportContentDialog from '@/components/ReportContentDialog';
import ReportFlag from '@/components/ReportFlag';
import { REPORT_REASONS_BY_TARGET, reportReasonLabel } from '@/lib/reportsApi';
import { clearAuthToken, setAuthToken } from '@/lib/auth';

const labels = (target: 'event' | 'user' | 'message') => REPORT_REASONS_BY_TARGET[target].map(reportReasonLabel);

function mockReportApi(status: number, body: unknown) {
  const fn = vi.fn(async () => ({
    ok: status < 400,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  }) as unknown as Response);
  vi.stubGlobal('fetch', fn);
  return fn;
}

const open = (props: Partial<React.ComponentProps<typeof ReportContentDialog>> = {}) => {
  const onSuccess = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ReportContentDialog
      open
      onOpenChange={onOpenChange}
      targetType="event"
      targetId="e1"
      origin="event_details"
      onSuccess={onSuccess}
      {...props}
    />,
  );
  return { onSuccess, onOpenChange };
};

describe('report reasons (#327)', () => {
  it('lists the six reasons for an event, in the order of the ticket', () => {
    expect(labels('event')).toEqual([
      'Spam', 'Inappropriate content', 'Harassment or hate', 'Scam or fraud', 'Misleading event', 'Other',
    ]);
  });

  it('lists the five reasons for a user and for a message, without "Misleading event"', () => {
    const five = ['Spam', 'Inappropriate content', 'Harassment or hate', 'Scam or fraud', 'Other'];
    expect(labels('user')).toEqual(five);
    expect(labels('message')).toEqual(five);
  });
});

describe('ReportFlag', () => {
  it('is a red flag', () => {
    render(<ReportFlag />);
    expect(screen.getByTestId('report-flag')).toHaveClass('text-red-500');
  });
});

describe('ReportContentDialog (#327)', () => {
  beforeEach(() => setAuthToken('mock-token'));
  afterEach(() => {
    clearAuthToken();
    vi.unstubAllGlobals();
  });

  it('shows the reasons of what is reported: "Misleading event" only for an event', () => {
    open({ targetType: 'event' });
    expect(screen.getByLabelText('Misleading event')).toBeInTheDocument();
  });

  it('has no "Misleading event" when a user or a message is reported', () => {
    open({ targetType: 'user', origin: 'profile' });
    expect(screen.queryByLabelText('Misleading event')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Harassment or hate')).toBeInTheDocument();
  });

  it('shows the description box whatever the reason, and requires it only for Other', async () => {
    mockReportApi(201, { id: 1, message: 'Report sent.' });
    const { onSuccess } = open();
    expect(screen.getByLabelText(/details/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Other'));
    expect(screen.getByLabelText(/details \(required\)/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /submit report/i }));
    expect(await screen.findByText('Please describe what happened.')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Spam'));
    expect(screen.getByLabelText(/details \(optional\)/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /submit report/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('Report sent.'));
  });

  it('quotes the reported message with its sender at the top', () => {
    open({
      targetType: 'message', targetId: '42', origin: 'event_chat',
      quote: { text: 'Keeps insulting everyone', senderName: 'Jane Doe' },
    });
    const quote = screen.getByTestId('report-quote');
    expect(quote).toHaveTextContent('Jane Doe');
    expect(quote).toHaveTextContent('Keeps insulting everyone');
  });

  it('shows no quote for an event or a user report', () => {
    open();
    expect(screen.queryByTestId('report-quote')).not.toBeInTheDocument();
  });

  it('tells the user the report was sent', async () => {
    mockReportApi(201, { id: 17, message: 'Report sent. Thank you, an administrator will review it.' });
    const { onSuccess, onOpenChange } = open();
    fireEvent.click(screen.getByRole('button', { name: /submit report/i }));
    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith('Report sent. Thank you, an administrator will review it.'),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('says it was already reported when the backend refuses with 409', async () => {
    mockReportApi(409, { detail: { code: 'already_reported', message: 'You have already reported this.' } });
    open();
    fireEvent.click(screen.getByRole('button', { name: /submit report/i }));
    expect(await screen.findByText('You already have an open report about this.')).toBeInTheDocument();
  });

  it('says there were too many reports when the backend refuses with 429', async () => {
    mockReportApi(429, { detail: 'Too many requests.', code: 'rate_limit_exceeded', retry_after: 30 });
    open();
    fireEvent.click(screen.getByRole('button', { name: /submit report/i }));
    expect(await screen.findByText(/too many reports/i)).toBeInTheDocument();
  });
});
