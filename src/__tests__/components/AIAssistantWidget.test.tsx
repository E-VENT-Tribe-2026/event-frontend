import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AIAssistantWidget from '@/components/assistant/AIAssistantWidget';
import * as authModule from '@/lib/auth';
import * as assistantApiModule from '@/lib/assistantApi';
import * as storageModule from '@/lib/storage';
import type { User } from '@/lib/storage';
import { BASIC_ASSISTANT_ASKS_PER_DAY } from '@/lib/assistantQuota';

describe('AIAssistantWidget — Ticket #196', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
    vi.spyOn(authModule, 'getAuthToken').mockReturnValue('mock-user-token');
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('does not render FAB on public / unauthenticated routes', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AIAssistantWidget />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('ai-assistant-fab')).not.toBeInTheDocument();
  });

  it('renders FAB on authenticated routes when user has a token', () => {
    render(
      <MemoryRouter initialEntries={['/home']}>
        <AIAssistantWidget />
      </MemoryRouter>
    );

    const fab = screen.getByTestId('ai-assistant-fab');
    expect(fab).toBeInTheDocument();
    expect(fab).toHaveAttribute('aria-label', 'Open AI Assistant');
  });

  it('opens and closes the chat drawer smoothly via FAB and close button', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AIAssistantWidget />
      </MemoryRouter>
    );

    const fab = screen.getByTestId('ai-assistant-fab');
    fireEvent.click(fab);

    // Chat drawer appears
    const drawer = await screen.findByTestId('ai-assistant-drawer');
    expect(drawer).toBeInTheDocument();
    expect(screen.getByText('E-VENT Assistant')).toBeInTheDocument();
    expect(screen.getByText(`${BASIC_ASSISTANT_ASKS_PER_DAY} of ${BASIC_ASSISTANT_ASKS_PER_DAY} asks left today`)).toBeInTheDocument();

    // Close button
    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);

    // Drawer closes, FAB is visible again
    await waitFor(() => {
      expect(screen.queryByTestId('ai-assistant-drawer')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('ai-assistant-fab')).toBeInTheDocument();
  });

  it('sends a message, transmits full conversation turn history with JWT, and renders markdown response', async () => {
    const sendChatSpy = vi.spyOn(assistantApiModule, 'sendAssistantChat').mockResolvedValue({
      reply: 'E-VENT is an event management platform. You can:\n- Discover **local concerts**\n- Create events with [Event Creator](/create)',
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AIAssistantWidget />
      </MemoryRouter>
    );

    // Open chat
    fireEvent.click(screen.getByTestId('ai-assistant-fab'));
    await screen.findByTestId('ai-assistant-drawer');

    const input = screen.getByTestId('ai-chat-input');
    const sendBtn = screen.getByTestId('ai-chat-send');

    // Type prompt (as in verification steps)
    fireEvent.change(input, {
      target: { value: 'What is E-VENT and what can you help me with?' },
    });
    expect(input).toHaveValue('What is E-VENT and what can you help me with?');

    fireEvent.click(sendBtn);

    // Immediately shows user message
    expect(screen.getByText('What is E-VENT and what can you help me with?')).toBeInTheDocument();

    // API was called with the full history
    expect(sendChatSpy).toHaveBeenCalledWith([
      {
        role: 'user',
        content: 'What is E-VENT and what can you help me with?',
      },
    ]);

    // Assistant response renders with markdown
    await waitFor(() => {
      expect(screen.getByText(/E-VENT is an event management platform/i)).toBeInTheDocument();
    });
    expect(screen.getByText('local concerts')).toBeInTheDocument();
  });

  it('supports multi-turn dialogue with proper auto-scrolling context', async () => {
    let callCount = 0;
    const sendChatSpy = vi.spyOn(assistantApiModule, 'sendAssistantChat').mockImplementation(async (msgs) => {
      callCount++;
      if (callCount === 1) {
        return { reply: 'I can help you search for music events.' };
      }
      return { reply: 'Here are the upcoming jazz and rock shows in your city.' };
    });

    render(
      <MemoryRouter initialEntries={['/home']}>
        <AIAssistantWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('ai-assistant-fab'));
    await screen.findByTestId('ai-assistant-drawer');

    const input = screen.getByTestId('ai-chat-input');

    // Turn 1
    fireEvent.change(input, { target: { value: 'What can you do?' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('I can help you search for music events.')).toBeInTheDocument();
    });

    // Turn 2
    fireEvent.change(input, { target: { value: 'Show me rock shows' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/upcoming jazz and rock shows/i)).toBeInTheDocument();
    });

    // Verify turn 2 sent both previous turns and the new turn
    expect(sendChatSpy).toHaveBeenLastCalledWith([
      { role: 'user', content: 'What can you do?' },
      { role: 'assistant', content: 'I can help you search for music events.' },
      { role: 'user', content: 'Show me rock shows' },
    ]);
  });

  it('displays user-friendly non-blocking retry banner on network drop or 503, and allows retry', async () => {
    const sendChatSpy = vi
      .spyOn(assistantApiModule, 'sendAssistantChat')
      .mockRejectedValueOnce(
        new assistantApiModule.AssistantApiError(
          'Service Unavailable (503): The AI assistant is currently overloaded. Please try again.',
          503,
          'SERVICE_UNAVAILABLE',
          true
        )
      )
      .mockResolvedValueOnce({
        reply: 'Recovered response after retry!',
      });

    render(
      <MemoryRouter initialEntries={['/home']}>
        <AIAssistantWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('ai-assistant-fab'));
    await screen.findByTestId('ai-assistant-drawer');

    const input = screen.getByTestId('ai-chat-input');
    fireEvent.change(input, { target: { value: 'Tell me about festivals' } });
    fireEvent.click(screen.getByTestId('ai-chat-send'));

    // Error banner appears
    const retryBtn = await screen.findByTestId('ai-retry-button');
    expect(retryBtn).toBeInTheDocument();
    expect(screen.getByText(/503/)).toBeInTheDocument();

    // Click retry
    fireEvent.click(retryBtn);

    // Succeeded on retry
    await waitFor(() => {
      expect(screen.getByText('Recovered response after retry!')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('ai-retry-button')).not.toBeInTheDocument();
  });

  it('renders rich event cards when assistant response includes events', async () => {
    vi.spyOn(assistantApiModule, 'sendAssistantChat').mockResolvedValue({
      reply: 'Here are events matching your request:',
      events: [
        {
          id: 'evt-101',
          title: 'Sunset Rooftop Session',
          category: 'Music',
          location_name: 'Sky Lounge, Berlin',
          cost: 20,
          max_capacity: 80,
          start_datetime: '2026-11-15T18:00:00Z',
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/home']}>
        <AIAssistantWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('ai-assistant-fab'));
    await screen.findByTestId('ai-assistant-drawer');

    const input = screen.getByTestId('ai-chat-input');
    fireEvent.change(input, { target: { value: 'Find rooftop events' } });
    fireEvent.click(screen.getByTestId('ai-chat-send'));

    // Event card rendered
    const card = await screen.findByTestId('assistant-event-card-evt-101');
    expect(card).toBeInTheDocument();
    expect(screen.getByText('Sunset Rooftop Session')).toBeInTheDocument();
    expect(screen.getByText('Sky Lounge, Berlin')).toBeInTheDocument();
    expect(screen.getByText('$20')).toBeInTheDocument();
    expect(screen.getByText('80 spots')).toBeInTheDocument();
  });

  it('renders rich draft event card with Open in Event Creator action', async () => {
    vi.spyOn(assistantApiModule, 'sendAssistantChat').mockResolvedValue({
      reply: "I've drafted the meetup for you:",
      draft: {
        title: 'Open Source Community Night',
        category: 'Technology',
        location_name: 'Coworking Space Mitte',
        cost: 0,
        max_capacity: 50,
        start_datetime: '2026-12-01T18:30:00Z',
        description: 'Casual networking and lightning talks.',
      },
      validation_issues: ['Please confirm venue booking with host'],
    });

    render(
      <MemoryRouter initialEntries={['/home']}>
        <AIAssistantWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('ai-assistant-fab'));
    await screen.findByTestId('ai-assistant-drawer');

    const input = screen.getByTestId('ai-chat-input');
    fireEvent.change(input, { target: { value: 'Draft a tech meetup' } });
    fireEvent.click(screen.getByTestId('ai-chat-send'));

    // Draft card rendered
    const draftCard = await screen.findByTestId('assistant-draft-card');
    expect(draftCard).toBeInTheDocument();
    expect(screen.getByText('Open Source Community Night')).toBeInTheDocument();
    expect(screen.getByText('Please confirm venue booking with host')).toBeInTheDocument();

    const creatorBtn = screen.getByTestId('use-draft-in-creator-btn');
    expect(creatorBtn).toBeInTheDocument();

    fireEvent.click(creatorBtn);
    // Verifies draft is stored in sessionStorage for CreateEventPage
    expect(window.sessionStorage.getItem('event_assistant_draft_prefill')).toContain(
      'Open Source Community Night'
    );
  });

  it('blocks a 6th Basic ask and shows remaining count', async () => {
    window.localStorage.setItem(
      'event_assistant_quota:anon',
      JSON.stringify({ date: new Date().toISOString().slice(0, 10), used: 4 }),
    );
    const sendChatSpy = vi.spyOn(assistantApiModule, 'sendAssistantChat').mockResolvedValue({
      reply: 'This is ask number five.',
    });

    render(
      <MemoryRouter initialEntries={['/home']}>
        <AIAssistantWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('ai-assistant-fab'));
    await screen.findByTestId('ai-assistant-drawer');
    expect(screen.getByText('1 of 5 asks left today')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('ai-chat-input'), { target: { value: 'Fifth ask' } });
    fireEvent.click(screen.getByTestId('ai-chat-send'));

    await waitFor(() => {
      expect(screen.getByText('This is ask number five.')).toBeInTheDocument();
    });
    expect(sendChatSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText('0 of 5 asks left today')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('ai-chat-input'), { target: { value: 'Sixth ask' } });
    fireEvent.click(screen.getByTestId('ai-chat-send'));

    expect(sendChatSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('ai-chat-send')).toBeDisabled();
  });

  it('does not limit Pro accounts', async () => {
    vi.spyOn(storageModule, 'getCurrentUser').mockReturnValue({
      id: 'pro-1',
      isPremium: true,
    } as User);
    vi.spyOn(assistantApiModule, 'sendAssistantChat').mockResolvedValue({
      reply: 'Unlimited reply',
    });

    render(
      <MemoryRouter initialEntries={['/home']}>
        <AIAssistantWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('ai-assistant-fab'));
    await screen.findByTestId('ai-assistant-drawer');
    expect(screen.getByText('Pro · unlimited asks')).toBeInTheDocument();
  });
});
