import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import WarningDialog from '@/components/WarningDialog';

const first = { id: 'w1', reason: 'First reason' };
const second = { id: 'w2', reason: 'Second reason' };

// jsdom reports errors thrown inside event listeners (for example a focus
// ping-pong overflowing the stack) as window "error" events, not to the caller.
let reported: unknown[] = [];
const onError = (e: ErrorEvent) => {
  reported.push(e.error ?? e.message);
  e.preventDefault();
};

beforeEach(() => {
  reported = [];
  window.addEventListener('error', onError);
});

afterEach(() => {
  window.removeEventListener('error', onError);
});

function renderTwo() {
  render(
    <>
      <button type="button">Page button</button>
      <WarningDialog warning={first} />
      <WarningDialog warning={second} />
    </>,
  );
  const [dialogA, dialogB] = screen.getAllByRole('alertdialog');
  return {
    dialogA,
    dialogB,
    buttonA: within(dialogA).getByRole('button', { name: 'I understand' }),
    buttonB: within(dialogB).getByRole('button', { name: 'I understand' }),
  };
}

describe('WarningDialog — two dialogs at once', () => {
  it('marks each card with data-warning-dialog', () => {
    const { dialogA, dialogB } = renderTwo();
    expect(dialogA).toHaveAttribute('data-warning-dialog');
    expect(dialogB).toHaveAttribute('data-warning-dialog');
  });

  it('leaves focus in the second dialog when the user moves it there', () => {
    const { buttonB } = renderTwo();
    expect(() => buttonB.focus()).not.toThrow();
    expect(reported).toEqual([]);
    expect(buttonB).toHaveFocus();
  });

  it('leaves focus in the first dialog when the user moves it back', () => {
    const { buttonA, buttonB } = renderTwo();
    expect(() => {
      buttonB.focus();
      buttonA.focus();
      buttonB.focus();
      buttonA.focus();
    }).not.toThrow();
    expect(reported).toEqual([]);
    expect(buttonA).toHaveFocus();
  });

  it('lets Tab inside one dialog stay in that dialog', () => {
    const { dialogB, buttonB } = renderTwo();
    buttonB.focus();

    // Add a second control so the cycling is observable.
    const extra = document.createElement('button');
    extra.textContent = 'Extra control';
    dialogB.appendChild(extra);

    expect(() => fireEvent.keyDown(buttonB, { key: 'Tab' })).not.toThrow();
    expect(extra).toHaveFocus();
    fireEvent.keyDown(extra, { key: 'Tab' });
    expect(buttonB).toHaveFocus();
    expect(reported).toEqual([]);
  });

  it('still pulls focus back from the page behind both dialogs', () => {
    const { buttonA, buttonB } = renderTwo();
    buttonA.focus();
    screen.getByRole('button', { name: 'Page button' }).focus();
    // Focus ends in one of the dialogs, never on the page.
    expect(screen.getByRole('button', { name: 'Page button' })).not.toHaveFocus();
    expect([buttonA, buttonB]).toContain(document.activeElement);
    expect(reported).toEqual([]);
  });
});
