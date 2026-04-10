import { useEffect } from 'react';
import { useLocation, matchPath } from 'react-router-dom';
import { DEFAULT_DOCUMENT_TITLE, formatPageTitle } from '@/lib/documentTitle';

/**
 * Sets `document.title` from the current path. Pages with dynamic titles
 * (e.g. event name) should override in a `useEffect` after data loads.
 */
const ROUTES: Array<{ pattern: string; title: string }> = [
  { pattern: '/event/:id/edit', title: 'Edit event' },
  { pattern: '/payment/:eventId', title: 'Checkout' },
  { pattern: '/ticket/:ticketId', title: 'Ticket' },
  { pattern: '/event/:id', title: 'Event' },
  { pattern: '/forgot-password', title: 'Reset password' },
  { pattern: '/signup', title: 'Create account' },
  { pattern: '/login', title: 'Sign in' },
  { pattern: '/create', title: 'Create event' },
  { pattern: '/dashboard', title: 'Organizer dashboard' },
  { pattern: '/notifications', title: 'Notifications' },
  { pattern: '/profile', title: 'Profile' },
  { pattern: '/chat', title: 'Messages' },
  { pattern: '/map', title: 'Map' },
  { pattern: '/home', title: 'Home' },
  { pattern: '/', title: 'Welcome' },
];

export default function RouteDocumentTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    for (const { pattern, title } of ROUTES) {
      if (matchPath({ path: pattern, end: true }, pathname)) {
        document.title = formatPageTitle(title);
        return;
      }
    }
    document.title = DEFAULT_DOCUMENT_TITLE;
  }, [pathname]);

  return null;
}
