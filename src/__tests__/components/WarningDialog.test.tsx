import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WarningDialog from '@/components/WarningDialog';

const warning = { id: 'w1', reason: 'Please keep event chats respectful.' };

function renderWithPage(ui: React.ReactElement) {
  return render(
    <>
      <button type="button">Page button</button>
      {ui}
    </>,
  );
}

describe('WarningDialog — acknowledge mode (ticket #294)', () => {
  it('shows the title, the reason, the note and the I understand button', () => {
    render(<WarningDialog warning={warning} />);
    expect(screen.getByRole('alertdialog', { name: 'Warning from an administrator' })).toBeInTheDocument();
    expect(screen.getByText('Reason')).toBeInTheDocument();
    expect(screen.getByText('Please keep event chats respectful.')).toBeInTheDocument();
    expect(screen.getByText('You can continue using E-VENT once you acknowledge this warning.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I understand' })).toBeInTheDocument();
  });

  it('renders nothing without a warning', () => {
    render(<WarningDialog warning={null} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('hides the counter for a single warning and shows it for several', () => {
    const { rerender } = render(<WarningDialog warning={warning} position={1} total={1} />);
    expect(screen.queryByText(/of 1/)).not.toBeInTheDocument();
    rerender(<WarningDialog warning={warning} position={2} total={3} />);
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
  });

  it('shows the reason as plain text, never as HTML', () => {
    render(<WarningDialog warning={{ ...warning, reason: '<img src=x onerror="alert(1)"><b>bold</b>' }} />);
    expect(screen.getByText('<img src=x onerror="alert(1)"><b>bold</b>')).toBeInTheDocument();
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.querySelector('img')).toBeNull();
    expect(dialog.querySelector('b')).toBeNull();
  });

  it('calls onAcknowledge, and not while submitting', () => {
    const onAcknowledge = vi.fn();
    const { rerender } = render(<WarningDialog warning={warning} onAcknowledge={onAcknowledge} />);
    fireEvent.click(screen.getByRole('button', { name: 'I understand' }));
    expect(onAcknowledge).toHaveBeenCalledTimes(1);

    rerender(<WarningDialog warning={warning} onAcknowledge={onAcknowledge} submitting />);
    fireEvent.click(screen.getByRole('button', { name: 'I understand' }));
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });

  it('shows an error message', () => {
    render(<WarningDialog warning={warning} error="Could not send." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not send.');
  });

  it('does not close on Escape or on a background click', () => {
    const onClose = vi.fn();
    const onKey = vi.fn();
    document.addEventListener('keydown', onKey);
    render(<WarningDialog warning={warning} onClose={onClose} />);

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('warning-dialog-overlay'));
    document.removeEventListener('keydown', onKey);

    expect(onClose).not.toHaveBeenCalled();
    expect(onKey).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('cycles Tab and Shift+Tab between the controls inside the dialog', () => {
    renderWithPage(<WarningDialog warning={warning} />);
    const action = screen.getByRole('button', { name: 'I understand' });
    expect(action).toHaveFocus();

    // Add a second control so cycling is observable (jsdom never moves focus on Tab by itself).
    const extra = document.createElement('button');
    extra.textContent = 'Extra control';
    screen.getByRole('alertdialog').appendChild(extra);

    // keyDown returns false when the browser's default Tab move was prevented.
    expect(fireEvent.keyDown(action, { key: 'Tab' })).toBe(false);
    expect(extra).toHaveFocus();
    expect(fireEvent.keyDown(extra, { key: 'Tab' })).toBe(false);
    expect(action).toHaveFocus();
    expect(fireEvent.keyDown(action, { key: 'Tab', shiftKey: true })).toBe(false);
    expect(extra).toHaveFocus();
  });

  it('pulls focus back when something behind the dialog receives it', () => {
    renderWithPage(<WarningDialog warning={warning} />);
    const action = screen.getByRole('button', { name: 'I understand' });
    screen.getByRole('button', { name: 'Page button' }).focus();
    expect(action).toHaveFocus();
  });

  it('gives focus back to the element focused before it opened', () => {
    const { rerender } = renderWithPage(<WarningDialog warning={null} />);
    const page = screen.getByRole('button', { name: 'Page button' });
    page.focus();

    rerender(<><button type="button">Page button</button><WarningDialog warning={warning} /></>);
    expect(screen.getByRole('button', { name: 'I understand' })).toHaveFocus();

    rerender(<><button type="button">Page button</button><WarningDialog warning={null} /></>);
    expect(screen.getByRole('button', { name: 'Page button' })).toHaveFocus();
  });

  it('takes the keyboard back when the trap resumes', () => {
    const { rerender } = renderWithPage(<WarningDialog warning={warning} trapFocus={false} />);
    const page = screen.getByRole('button', { name: 'Page button' });
    page.focus();
    expect(page).toHaveFocus();

    rerender(<><button type="button">Page button</button><WarningDialog warning={warning} trapFocus /></>);
    expect(screen.getByRole('button', { name: 'I understand' })).toHaveFocus();
  });

  it('shows a fallback when the reason is empty', () => {
    render(<WarningDialog warning={{ id: 'w1', reason: '   ' }} />);
    expect(screen.getByText('No reason was provided.')).toBeInTheDocument();
  });

  it('releases the focus trap when trapFocus is off', () => {
    renderWithPage(<WarningDialog warning={warning} trapFocus={false} />);
    const page = screen.getByRole('button', { name: 'Page button' });
    page.focus();
    expect(page).toHaveFocus();
  });

  it('locks page scrolling while shown', () => {
    const { unmount } = render(<WarningDialog warning={warning} />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});

describe('WarningDialog — review mode', () => {
  it('shows a Close button and no note', () => {
    render(<WarningDialog warning={warning} mode="review" />);
    expect(screen.getByRole('dialog', { name: 'Warning from an administrator' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'I understand' })).not.toBeInTheDocument();
    expect(screen.queryByText(/once you acknowledge/)).not.toBeInTheDocument();
  });

  it('closes with the button, Escape and the background', () => {
    const onClose = vi.fn();
    render(<WarningDialog warning={warning} mode="review" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByTestId('warning-dialog-overlay'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('does not close when clicking inside the card', () => {
    const onClose = vi.fn();
    render(<WarningDialog warning={warning} mode="review" onClose={onClose} />);
    fireEvent.click(screen.getByText(warning.reason));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not trap focus or lock scrolling', () => {
    renderWithPage(<WarningDialog warning={warning} mode="review" />);
    const page = screen.getByRole('button', { name: 'Page button' });
    page.focus();
    expect(page).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });
});
