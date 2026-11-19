import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createRef } from 'react';
import ChatThreadView from '@/pages/chat/ChatThreadView';
import type { ChatEvent, ChatMessage } from '@/pages/chat/chatModel';
import { clearAuthToken, setAuthToken } from '@/lib/auth';

vi.mock('@/components/BottomNav', () => ({ default: () => null }));

const chat: ChatEvent = {
  id: 'evt-1', name: 'Sunset Picnic', avatar: '', lastMsg: '', time: '', unread: 0,
  isPast: false, eventDate: '2030-01-01', organizerId: 'organizer-1',
};

const msg = (over: Partial<ChatMessage>): ChatMessage => ({
  id: 'm1', from: 'them', text: 'Hello there', time: '10:00', dateKey: '2030-01-01', kind: 'user',
  messageType: 'text', senderId: 'u-jane', senderName: 'Jane Doe', ...over,
});

const MESSAGES: ChatMessage[] = [
  msg({ id: '101', text: 'Welcome to the chat!', kind: 'system', from: 'them', senderId: undefined, senderName: undefined }),
  msg({ id: '102', text: 'Keeps insulting everyone', senderName: 'Jane Doe' }),
  msg({ id: '103', text: 'This one is mine', from: 'me', senderId: 'me-1', senderName: 'Me' }),
];

function renderView(userId = 'me-1') {
  const noop = () => {};
  return render(
    <MemoryRouter>
      <ChatThreadView
        chat={chat}
        messages={MESSAGES}
        messagesLoading={false}
        chatUnavailable={false}
        chatApiMissing={false}
        sending={false}
        input=""
        onInputChange={noop}
        showEmoji={false}
        onToggleEmoji={noop}
        showPoll={false}
        onTogglePoll={noop}
        pollQuestion=""
        onPollQuestionChange={noop}
        pollOptions={['', '']}
        onPollOptionsChange={noop}
        search=""
        onSearchChange={noop}
        toast={{ show: false, message: '', type: 'success' }}
        onCloseToast={noop}
        onToast={noop}
        onBack={noop}
        onSend={noop}
        onOpenProfile={noop}
        resolveMeId={() => userId}
        user={{ id: userId, name: 'Me' }}
        scrollerRef={createRef<HTMLDivElement>()}
        messagesEndRef={createRef<HTMLDivElement>()}
        pinToBottomRef={{ current: true }}
      />
    </MemoryRouter>,
  );
}

const flagOf = (messageId: string) => {
  const holder = document.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement | null;
  return holder ? within(holder).queryByRole('button', { name: 'Report message' }) : null;
};

describe('Event chat reporting (#327)', () => {
  beforeEach(() => setAuthToken('mock-token'));
  afterEach(() => {
    clearAuthToken();
    vi.unstubAllGlobals();
  });

  it('offers "Report event" with the red flag at the top, next to the event name', () => {
    renderView();
    const header = screen.getByRole('banner');
    expect(within(header).getByText('Sunset Picnic')).toBeInTheDocument();
    const button = within(header).getByRole('button', { name: /report event/i });
    expect(button).toHaveTextContent('Report event');
    expect(within(button).getByTestId('report-flag')).toHaveClass('text-red-500');
  });

  it('does not offer "Report event" to the organizer', () => {
    renderView('organizer-1');
    expect(screen.queryByRole('button', { name: /report event/i })).not.toBeInTheDocument();
  });

  it("puts a red flag on another user's message, hidden until the mouse is over it or it is tapped", () => {
    renderView();
    const flag = flagOf('102') as HTMLElement;
    expect(flag).toBeInTheDocument();
    // Hidden at rest, shown on mouse-over (computer) through CSS.
    expect(flag).toHaveClass('opacity-0', 'group-hover:opacity-100');
    expect(within(flag).getByTestId('report-flag')).toHaveClass('text-red-500');
  });

  it('shows the flag when the message is tapped and hides it when tapping elsewhere', () => {
    renderView();
    const holder = document.querySelector('[data-message-id="102"]') as HTMLElement;
    fireEvent.click(holder);
    expect(flagOf('102')).toHaveClass('opacity-100');

    fireEvent.pointerDown(document.body);
    expect(flagOf('102')).toHaveClass('opacity-0');
  });

  it('has no flag on the user\'s own messages or on system messages', () => {
    renderView();
    expect(flagOf('103')).toBeNull();
    expect(flagOf('101')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Report message' })).toHaveLength(1);
  });

  it('opens the report window with the reported message and its sender at the top', () => {
    renderView();
    fireEvent.click(flagOf('102') as HTMLElement);
    expect(screen.getByText('Report this message')).toBeInTheDocument();
    const quote = screen.getByTestId('report-quote');
    expect(quote).toHaveTextContent('Jane Doe');
    expect(quote).toHaveTextContent('Keeps insulting everyone');
    // A message report has no "Misleading event".
    expect(screen.queryByLabelText('Misleading event')).not.toBeInTheDocument();
  });

  it('opens the event report window, with "Misleading event", from "Report event"', () => {
    renderView();
    fireEvent.click(screen.getByRole('button', { name: /report event/i }));
    expect(screen.getByText('Report this event')).toBeInTheDocument();
    expect(screen.getByLabelText('Misleading event')).toBeInTheDocument();
    expect(screen.queryByTestId('report-quote')).not.toBeInTheDocument();
  });
});
