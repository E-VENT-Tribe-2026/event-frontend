import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AIAssistantWidget from '@/components/assistant/AIAssistantWidget';
import { AssistantEventCard } from '@/components/assistant/AssistantEventCard';
import { AssistantEventDetailCard } from '@/components/assistant/AssistantEventDetailCard';
import { AssistantDraftCard } from '@/components/assistant/AssistantDraftCard';
import * as authModule from '@/lib/auth';
import * as assistantApiModule from '@/lib/assistantApi';

describe('AI Frontend — Ticket #199: Slick AI Agent Chat UI Components', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
    vi.spyOn(authModule, 'getAuthToken').mockReturnValue('mock-user-token');
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  describe('Task 1: Event List Cards (Search Results)', () => {
    it('renders responsive list of compact cards with title, category badge, date/time, location, and cost pill', () => {
      const mockEvent: assistantApiModule.AssistantEventItem = {
        id: 'evt-music-101',
        title: 'Berlin Indie Showcase',
        category: 'Music',
        description: 'Live performance by local indie artists.',
        location_name: 'SO36, Kreuzberg',
        cost: 15,
        max_capacity: 120,
        start_datetime: '2026-11-20T20:00:00Z',
        end_datetime: '2026-11-20T23:00:00Z',
      };

      render(
        <MemoryRouter>
          <AssistantEventCard event={mockEvent} />
        </MemoryRouter>
      );

      // Title
      expect(screen.getByText('Berlin Indie Showcase')).toBeInTheDocument();
      // Category badge
      expect(screen.getByText('Music')).toBeInTheDocument();
      // Cost pill
      expect(screen.getByText('$15')).toBeInTheDocument();
      // Location
      expect(screen.getByText('SO36, Kreuzberg')).toBeInTheDocument();
      // Capacity
      expect(screen.getByText('120 spots')).toBeInTheDocument();
      // Date text
      expect(screen.getByText(/Nov 20/)).toBeInTheDocument();
    });

    it('displays Free cost pill correctly for free events', () => {
      const freeEvent: assistantApiModule.AssistantEventItem = {
        id: 'evt-free-102',
        title: 'Open Source Jam',
        category: 'Tech',
        cost: 0,
      };

      render(
        <MemoryRouter>
          <AssistantEventCard event={freeEvent} />
        </MemoryRouter>
      );

      expect(screen.getByText('Free')).toBeInTheDocument();
    });

    it('includes a prominent "Open Event" button navigating to the event page', () => {
      const mockEvent: assistantApiModule.AssistantEventItem = {
        id: 'evt-nav-103',
        title: 'Sunset Acoustic Session',
        category: 'Music',
      };

      let currentPath = '';
      render(
        <MemoryRouter initialEntries={['/home']}>
          <Routes>
            <Route path="/home" element={<AssistantEventCard event={mockEvent} />} />
            <Route
              path="/events/:id"
              element={<div data-testid="event-page-target">Event Page ID: evt-nav-103</div>}
            />
          </Routes>
        </MemoryRouter>
      );

      const openBtn = screen.getByTestId('open-event-btn');
      expect(openBtn).toBeInTheDocument();
      expect(openBtn).toHaveTextContent('Open Event');

      fireEvent.click(openBtn);
      expect(screen.getByTestId('event-page-target')).toBeInTheDocument();
    });
  });

  describe('Task 2: Single Event Details Card (Expanded View)', () => {
    it('renders expanded card with full description, organizer info, and an "Open Event Page" button', () => {
      const detailedEvent: assistantApiModule.AssistantEventItem = {
        id: 'evt-detail-201',
        title: 'AI & Robotics Expo 2026',
        category: 'Technology',
        description:
          'Experience state-of-the-art autonomous robotics, interactive demonstrations, and keynote talks from global innovators.',
        created_by: 'Sarah Connor',
        location_name: 'Convention Hall Berlin',
        cost: 25,
        max_capacity: 500,
        start_datetime: '2026-12-10T10:00:00Z',
        end_datetime: '2026-12-10T18:00:00Z',
      };

      render(
        <MemoryRouter initialEntries={['/home']}>
          <Routes>
            <Route path="/home" element={<AssistantEventDetailCard event={detailedEvent} />} />
            <Route
              path="/events/:id"
              element={<div data-testid="event-full-page">Full Event Details View</div>}
            />
          </Routes>
        </MemoryRouter>
      );

      // Title & category
      expect(screen.getByText('AI & Robotics Expo 2026')).toBeInTheDocument();
      expect(screen.getByText('Technology')).toBeInTheDocument();
      // Description
      expect(screen.getByText(/Experience state-of-the-art autonomous robotics/)).toBeInTheDocument();
      // Organizer
      expect(screen.getByText(/Sarah Connor/)).toBeInTheDocument();
      // Location & capacity
      expect(screen.getByText('Convention Hall Berlin')).toBeInTheDocument();
      expect(screen.getByText('500 max capacity')).toBeInTheDocument();
      // Cost pill
      expect(screen.getByText('$25')).toBeInTheDocument();

      // Open Event Page button
      const openPageBtn = screen.getByTestId('open-event-page-btn');
      expect(openPageBtn).toBeInTheDocument();
      expect(openPageBtn).toHaveTextContent('Open Event Page');

      fireEvent.click(openPageBtn);
      expect(screen.getByTestId('event-full-page')).toBeInTheDocument();
    });
  });

  describe('Task 3: Draft Event Preview & Human-in-the-Loop Publishing', () => {
    it('renders structured preview with all drafted fields and Confirm & Publish button', () => {
      const mockDraft: assistantApiModule.AssistantDraftEvent = {
        title: 'React & TypeScript Hacknight',
        category: 'Technology',
        description: 'Bring your laptop and build collaborative web applications.',
        location_name: 'Factory Berlin Mitte',
        cost: 0,
        max_capacity: 40,
        start_datetime: '2026-11-25T18:30:00Z',
        end_datetime: '2026-11-25T21:30:00Z',
      };

      render(
        <MemoryRouter>
          <AssistantDraftCard
            draft={mockDraft}
            validationIssues={['Please bring an ID for building entry']}
          />
        </MemoryRouter>
      );

      // Card Header
      expect(screen.getByText('Draft Event Preview')).toBeInTheDocument();
      expect(screen.getByText('React & TypeScript Hacknight')).toBeInTheDocument();
      expect(screen.getByText('Technology')).toBeInTheDocument();
      expect(screen.getByText(/Bring your laptop and build collaborative/)).toBeInTheDocument();
      expect(screen.getByText('Factory Berlin Mitte')).toBeInTheDocument();
      expect(screen.getByText('Free admission')).toBeInTheDocument();
      expect(screen.getByText('40 capacity')).toBeInTheDocument();
      expect(screen.getByText('Please bring an ID for building entry')).toBeInTheDocument();

      // Buttons
      expect(screen.getByTestId('confirm-publish-btn')).toHaveTextContent('Confirm & Publish');
      expect(screen.getByTestId('use-draft-in-creator-btn')).toHaveTextContent('Edit in Creator');
    });

    it('publishes event via Confirm & Publish, shows loading state, then reveals Open New Event button', async () => {
      const publishSpy = vi.spyOn(assistantApiModule, 'publishDraftEvent').mockResolvedValue({
        success: true,
        eventId: 'published-evt-555',
      });

      const mockDraft: assistantApiModule.AssistantDraftEvent = {
        title: 'Next.js Workshop',
        category: 'Technology',
        cost: 0,
        max_capacity: 30,
      };

      render(
        <MemoryRouter initialEntries={['/home']}>
          <Routes>
            <Route path="/home" element={<AssistantDraftCard draft={mockDraft} />} />
            <Route
              path="/events/:id"
              element={<div data-testid="new-event-view">Welcome to published-evt-555!</div>}
            />
          </Routes>
        </MemoryRouter>
      );

      const publishBtn = screen.getByTestId('confirm-publish-btn');
      expect(publishBtn).toBeInTheDocument();

      fireEvent.click(publishBtn);

      // Verify API was called
      expect(publishSpy).toHaveBeenCalledWith(mockDraft);

      // Success state rendered
      const successBanner = await screen.findByTestId('publish-success-banner');
      expect(successBanner).toBeInTheDocument();
      expect(screen.getByText(/Event Published Successfully!/i)).toBeInTheDocument();

      // "Open New Event" button appears
      const openNewEventBtn = screen.getByTestId('open-new-event-btn');
      expect(openNewEventBtn).toBeInTheDocument();
      expect(openNewEventBtn).toHaveTextContent('Open New Event');

      // Clicking Open New Event navigates to created event
      fireEvent.click(openNewEventBtn);
      await waitFor(() => {
        expect(screen.getByTestId('new-event-view')).toBeInTheDocument();
      });
    });

    it('displays error alert on publish failure and allows retry', async () => {
      vi.spyOn(assistantApiModule, 'publishDraftEvent')
        .mockRejectedValueOnce(new Error('Network error: server unreachable'))
        .mockResolvedValueOnce({
          success: true,
          eventId: 'recovered-evt-999',
        });

      const mockDraft: assistantApiModule.AssistantDraftEvent = {
        title: 'Startup Pitch Night',
      };

      render(
        <MemoryRouter>
          <AssistantDraftCard draft={mockDraft} />
        </MemoryRouter>
      );

      const publishBtn = screen.getByTestId('confirm-publish-btn');
      fireEvent.click(publishBtn);

      // Error banner displayed
      const errorAlert = await screen.findByTestId('publish-error');
      expect(errorAlert).toBeInTheDocument();
      expect(screen.getByText(/server unreachable/i)).toBeInTheDocument();

      // Retry publishing
      fireEvent.click(screen.getByTestId('confirm-publish-btn'));

      // Succeeds on second try
      await screen.findByTestId('publish-success-banner');
      expect(screen.getByTestId('open-new-event-btn')).toBeInTheDocument();
    });
  });

  describe('Integration with AIAssistantWidget Chat Flow', () => {
    it('renders single event detail spotlight card when chat returns an event object', async () => {
      vi.spyOn(assistantApiModule, 'sendAssistantChat').mockResolvedValue({
        reply: 'Here are the details for the requested event:',
        event: {
          id: 'evt-spotlight-7',
          title: 'Full Moon Sound Bath',
          category: 'Wellness',
          description: 'A transformative sound meditation experience under the moonlight.',
          created_by: 'Maya Lin',
          cost: 20,
          max_capacity: 25,
          location_name: 'Peace Sanctuary',
        },
      });

      render(
        <MemoryRouter initialEntries={['/home']}>
          <AIAssistantWidget />
        </MemoryRouter>
      );

      // Open chat drawer
      fireEvent.click(screen.getByTestId('ai-assistant-fab'));
      await screen.findByTestId('ai-assistant-drawer');

      // Send query
      const input = screen.getByTestId('ai-chat-input');
      fireEvent.change(input, { target: { value: 'Tell me more about the Sound Bath event' } });
      fireEvent.click(screen.getByTestId('ai-chat-send'));

      // Single Event Detail card rendered
      const detailCard = await screen.findByTestId('assistant-event-detail-card-evt-spotlight-7');
      expect(detailCard).toBeInTheDocument();
      expect(screen.getByText('Full Moon Sound Bath')).toBeInTheDocument();
      expect(screen.getByText('Event Spotlight')).toBeInTheDocument();
      expect(screen.getByText(/transformative sound meditation/)).toBeInTheDocument();
      expect(screen.getByText(/Maya Lin/)).toBeInTheDocument();
      expect(screen.getByTestId('open-event-page-btn')).toBeInTheDocument();
    });

    it('renders typing indicator while awaiting assistant response', async () => {
      let resolveChat: (val: any) => void = () => {};
      const chatPromise = new Promise((resolve) => {
        resolveChat = resolve;
      });
      vi.spyOn(assistantApiModule, 'sendAssistantChat').mockReturnValue(chatPromise as any);

      render(
        <MemoryRouter initialEntries={['/home']}>
          <AIAssistantWidget />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('ai-assistant-fab'));
      await screen.findByTestId('ai-assistant-drawer');

      const input = screen.getByTestId('ai-chat-input');
      fireEvent.change(input, { target: { value: 'Suggest weekend events' } });
      fireEvent.click(screen.getByTestId('ai-chat-send'));

      // Animated typing indicator appears
      const typingIndicator = screen.getByTestId('ai-loading-indicator');
      expect(typingIndicator).toBeInTheDocument();
      expect(typingIndicator).toHaveTextContent(/E-VENT is thinking/i);

      // Resolve response
      resolveChat({ reply: 'Here are some events!' });

      await waitFor(() => {
        expect(screen.queryByTestId('ai-loading-indicator')).not.toBeInTheDocument();
      });
      expect(screen.getByText('Here are some events!')).toBeInTheDocument();
    });
  });
});
