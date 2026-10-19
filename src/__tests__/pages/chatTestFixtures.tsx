import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { User } from '@/lib/storage';
import ChatPage from '@/pages/ChatPage';

/**
 * Shared fixtures for ChatPage tests, kept in one place to avoid duplicating
 * the mock user, render helper, and event-response shape across test files
 * (flagged by SonarQube duplication analysis on #215).
 */

export const chatUser = {
  id: 'u-chat',
  name: 'Chatter',
  email: 'c@test.com',
  role: 'participant' as const,
  password: 'secret123',
  avatar: '',
  profilePhoto: '',
  coverPhoto: '',
  bio: '',
  interests: [],
  dob: '',
  gender: '',
  isPremium: false,
  friends: [],
  createdAt: '',
} satisfies User;

export function renderChat() {
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/chat']}>
      <Routes>
        <Route path="/chat" element={<ChatPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

interface EventFixtureOptions {
  id: string;
  title: string;
  createdBy?: string;
  status?: string;
}

/** Builds the raw "/api/participants/my/events" response shape for one event. */
export function buildMyEventsResponse(event: EventFixtureOptions) {
  return new Response(
    JSON.stringify([
      {
        events: {
          id: event.id,
          title: event.title,
          description: 'desc',
          category: 'Music',
          start_datetime: '2030-05-01T12:00:00.000Z',
          end_datetime: '2030-06-01T12:00:00.000Z',
          cost: 10,
          max_capacity: 20,
          location_name: 'Paris',
          latitude: 0,
          longitude: 0,
          created_by: event.createdBy ?? 'org-1',
          status: event.status ?? 'active',
        },
      },
    ]),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

export function emptyMyEventsResponse() {
  return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
}

export function unhandledResponse() {
  return new Response('{}', { status: 500 });
}
