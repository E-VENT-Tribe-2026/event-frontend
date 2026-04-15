import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { User } from '@/lib/storage';
import ChatPage from '@/pages/ChatPage';

const { getCurrentUserMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn<[], User | null>(),
}));

vi.mock('@/lib/storage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/storage')>();
  return {
    ...mod,
    getCurrentUser: () => getCurrentUserMock(),
  };
});

vi.mock('@/components/BottomNav', () => ({
  default: () => null,
}));

const chatUser = {
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

describe('ChatPage', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReturnValue(chatUser);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}', { status: 500 }))),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderChat() {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/chat']}>
        <Routes>
          <Route path="/chat" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('unlocks chat with password and sends a message', async () => {
    renderChat();

    expect(screen.getByText(/Chat Protected/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Password/i }));

    const pw = screen.getByPlaceholderText(/Enter your password/i);
    fireEvent.change(pw, { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /Unlock Chat/i }));

    await waitFor(() => {
      expect(screen.getByText('Chats')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /DJ Luna/i }));

    const input = screen.getByPlaceholderText(/Type a message/i);
    fireEvent.change(input, { target: { value: 'Hello from test' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Hello from test')).toBeInTheDocument();
    });
  });

  it('shows error when unlock password is wrong', async () => {
    renderChat();
    fireEvent.click(screen.getByRole('button', { name: /Password/i }));
    fireEvent.change(screen.getByPlaceholderText(/Enter your password/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /Unlock Chat/i }));

    expect(await screen.findByText(/Incorrect password/i)).toBeInTheDocument();
  });
});
