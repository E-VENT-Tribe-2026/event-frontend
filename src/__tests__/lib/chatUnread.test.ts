import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CHAT_UNREAD_CHANGED_EVENT,
  countUnreadChats,
  getViewingChatId,
  isChatUnread,
  markChatRead,
  markChatUnread,
  noteIncomingChatMessage,
  noteNewerChatMessage,
  setViewingChatId,
} from '@/lib/chatUnread';

describe('chatUnread', () => {
  beforeEach(() => {
    localStorage.clear();
    setViewingChatId(null);
  });

  afterEach(() => {
    setViewingChatId(null);
    localStorage.clear();
  });

  it('tracks unread chats per user and notifies listeners', () => {
    const onChange = vi.fn();
    window.addEventListener(CHAT_UNREAD_CHANGED_EVENT, onChange);

    markChatUnread('u-1', 'evt-a');
    markChatUnread('u-1', 'evt-b');
    markChatUnread('u-2', 'evt-a');

    expect(countUnreadChats('u-1')).toBe(2);
    expect(isChatUnread('u-1', 'evt-a')).toBe(true);
    expect(isChatUnread('u-2', 'evt-b')).toBe(false);
    expect(onChange).toHaveBeenCalled();

    markChatRead('u-1', 'evt-a');
    expect(isChatUnread('u-1', 'evt-a')).toBe(false);
    expect(countUnreadChats('u-1')).toBe(1);

    window.removeEventListener(CHAT_UNREAD_CHANGED_EVENT, onChange);
  });

  it('does not mark the chat the user is currently reading', () => {
    setViewingChatId('evt-open');
    expect(getViewingChatId()).toBe('evt-open');
    noteIncomingChatMessage('u-1', 'evt-open');
    noteIncomingChatMessage('u-1', 'evt-other');
    expect(isChatUnread('u-1', 'evt-open')).toBe(false);
    expect(isChatUnread('u-1', 'evt-other')).toBe(true);
  });

  it('ignores the sender\'s own incoming messages', () => {
    noteIncomingChatMessage('u-1', 'evt-own', 'u-1');
    expect(isChatUnread('u-1', 'evt-own')).toBe(false);
    noteIncomingChatMessage('u-1', 'evt-own', 'u-2');
    expect(isChatUnread('u-1', 'evt-own')).toBe(true);
  });

  it('marks a chat unread when a newer message appears after the baseline', () => {
    noteNewerChatMessage('u-1', 'evt-a', '2030-01-01T10:00:00.000Z', 'u-2', 'm1');
    expect(isChatUnread('u-1', 'evt-a')).toBe(false);
    noteNewerChatMessage('u-1', 'evt-a', '2030-01-01T10:05:00.000Z', 'u-2', 'm2');
    expect(isChatUnread('u-1', 'evt-a')).toBe(true);
  });

  it('still notifies after a chat was read when a new message id appears', () => {
    noteNewerChatMessage('u-1', 'evt-a', '2030-01-01T10:00:00.000Z', 'u-2', 'm1');
    markChatRead('u-1', 'evt-a', 'm1');
    expect(isChatUnread('u-1', 'evt-a')).toBe(false);
    noteNewerChatMessage('u-1', 'evt-a', '2030-01-01T10:01:00.000Z', 'u-2', 'm2');
    expect(isChatUnread('u-1', 'evt-a')).toBe(true);
  });

  it('still notifies after a chat was read even when the last message id was unknown', () => {
    markChatRead('u-1', 'evt-a');
    expect(isChatUnread('u-1', 'evt-a')).toBe(false);
    noteNewerChatMessage(
      'u-1',
      'evt-a',
      new Date(Date.now() + 60_000).toISOString(),
      'u-2',
      'm-later',
    );
    expect(isChatUnread('u-1', 'evt-a')).toBe(true);
  });
});
