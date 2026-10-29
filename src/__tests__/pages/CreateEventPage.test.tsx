import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { User } from '@/lib/storage';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CreateEventPage from '@/pages/CreateEventPage';

const { addEventMock, mockNavigate, currentUser } = vi.hoisted(() => ({
  addEventMock: vi.fn(),
  mockNavigate: vi.fn(),
  currentUser: {
    id: 'u1',
    name: 'Organizer',
    email: 'o@example.com',
    role: 'organizer' as const,
    password: '',
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
  } satisfies User,
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/components/BottomNav', () => ({
  default: () => null,
}));

vi.mock('@/components/TopBar', () => ({
  default: () => null,
}));

vi.mock('@/components/LocationPickerMap', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/LocationPickerMap')>();
  return {
    ...actual,
    default: function MockLocationPicker({
      onLocationChange,
    }: {
      onLocationChange: (lat: number, lng: number) => void;
    }) {
      return (
        <button type="button" onClick={() => onLocationChange(40.7128, -74.006)}>
          set-map-pin
        </button>
      );
    },
  };
});

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...actual,
    getAuthToken: () => 'test-token',
    setAuthToken: vi.fn(),
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
  },
  syncSupabaseSession: vi.fn(() => Promise.resolve()),
  clearSupabaseSession: vi.fn(),
}));

vi.mock('@/lib/storage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/storage')>();
  return {
    ...mod,
    getCurrentUser: () => currentUser,
    addEvent: addEventMock,
  };
});

function tomorrowIsoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('CreateEventPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    addEventMock.mockClear();
    currentUser.isPremium = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}', { status: 500 }))),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderPage() {
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={['/create']}
      >
        <Routes>
          <Route path="/create" element={<CreateEventPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('lets you pick a category from the same pills as the homepage', () => {
    renderPage();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Music' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: 'Sports' }));
    expect(screen.getByRole('radio', { name: 'Sports' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Music' })).toHaveAttribute('aria-checked', 'false');
  });

  it('shows validation errors when publishing without required fields', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /publish event/i }));
    expect(await screen.findByText('Title is required')).toBeInTheDocument();
    expect(screen.getByText(/Search for a location or click the map to set the event pin/i)).toBeInTheDocument();
    expect(addEventMock).not.toHaveBeenCalled();
  });

  it('calls addEvent and navigates home after successful publish', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/api/events') && init?.method === 'POST') {
        return new Response(JSON.stringify({ id: 'evt-1', created_by: 'u1' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('not mocked', { status: 500 });
    });

    renderPage();

    fireEvent.change(screen.getByPlaceholderText('Event Title'), { target: { value: 'Meetup' } });
    fireEvent.change(screen.getByPlaceholderText('Description'), { target: { value: 'Details here' } });
    const dateInput = screen.getByLabelText(/event date/i) as HTMLInputElement;
    const timeInput = screen.getByLabelText(/event time/i) as HTMLInputElement;
    fireEvent.focus(dateInput);
    fireEvent.change(dateInput, { target: { value: tomorrowIsoDate() } });
    fireEvent.focus(timeInput);
    fireEvent.change(timeInput, { target: { value: '15:00' } });
    fireEvent.change(screen.getByPlaceholderText(/Search venue, address or city/i), { target: { value: 'Central Park' } });
    fireEvent.click(screen.getByRole('button', { name: /set-map-pin/i }));

    fireEvent.click(screen.getByRole('button', { name: /publish event/i }));

    await waitFor(() => {
      expect(addEventMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('Event Published Successfully!')).toBeInTheDocument();

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith('/home');
      },
      { timeout: 3000 },
    );
  });

  it('lets any account upload a custom banner and set recurrence', () => {
    renderPage();
    expect(screen.getByText('Custom banner')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Repeat' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Repeat this event/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Custom banner/i })).not.toBeInTheDocument();
  });

  it('lets you create a weekly series in one publish', async () => {
    let posts = 0;
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/api/events') && init?.method === 'POST') {
        posts += 1;
        return new Response(JSON.stringify({ id: `evt-${posts}`, created_by: 'u1' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('not mocked', { status: 500 });
    });

    renderPage();
    expect(screen.getByRole('radiogroup', { name: 'Repeat' })).toBeInTheDocument();
    expect(screen.getByText('Custom banner')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Repeat this event/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Event Title'), { target: { value: 'Weekly jam' } });
    fireEvent.change(screen.getByPlaceholderText('Description'), { target: { value: 'Bring a guitar' } });
    const dateInput = screen.getByLabelText(/event date/i) as HTMLInputElement;
    const timeInput = screen.getByLabelText(/event time/i) as HTMLInputElement;
    fireEvent.focus(dateInput);
    fireEvent.change(dateInput, { target: { value: tomorrowIsoDate() } });
    fireEvent.focus(timeInput);
    fireEvent.change(timeInput, { target: { value: '19:00' } });
    fireEvent.change(screen.getByPlaceholderText(/Search venue, address or city/i), { target: { value: 'Studio' } });
    fireEvent.click(screen.getByRole('button', { name: /set-map-pin/i }));
    fireEvent.click(screen.getByRole('radio', { name: 'Weekly' }));
    fireEvent.change(screen.getByLabelText(/How many times/i), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /publish event/i }));

    await waitFor(() => {
      expect(addEventMock).toHaveBeenCalledTimes(3);
    });
    expect(screen.getByText('Published 3 events in the series')).toBeInTheDocument();
  });
});
