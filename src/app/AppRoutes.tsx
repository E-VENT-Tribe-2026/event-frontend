import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AdminGuard from '@/components/AdminGuard';
import RequireAuth from '@/components/RequireAuth';
import RequireUsername from '@/components/RequireUsername';
import AppChrome from '@/app/AppChrome';
import RouteFallback from '@/app/RouteFallback';
import AdminVerifyPage from '@/pages/AdminVerifyPage';
import AuthCallbackPage from '@/pages/AuthCallbackPage';
import ChooseUsernamePage from '@/pages/ChooseUsernamePage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import LoginPage from '@/pages/LoginPage';
import NotFound from '@/pages/NotFound';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import SignupPage from '@/pages/SignupPage';
import WelcomePage from '@/pages/WelcomePage';

const AdminEventDetailsPage = lazy(() => import('@/pages/AdminEventDetailsPage'));
const AdminPanelPage = lazy(() => import('@/pages/AdminPanelPage'));
const ChatPage = lazy(() => import('@/pages/ChatPage'));
const CreateEventPage = lazy(() => import('@/pages/CreateEventPage'));
const EditEventPage = lazy(() => import('@/pages/EditEventPage'));
const EventDetailsPage = lazy(() => import('@/pages/EventDetailsPage'));
const FriendsPage = lazy(() => import('@/pages/FriendsPage'));
const HomePage = lazy(() => import('@/pages/HomePage'));
const ManageAccountPage = lazy(() => import('@/pages/ManageAccountPage'));
const MapPage = lazy(() => import('@/pages/MapPage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const OrganizerDashboardPage = lazy(() => import('@/pages/OrganizerDashboardPage'));
const PaymentPage = lazy(() => import('@/pages/PaymentPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const TicketPage = lazy(() => import('@/pages/TicketPage'));
const UserProfilePage = lazy(() => import('@/pages/UserProfilePage'));

function SignedIn({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <RequireUsername>
        <AppChrome>{children}</AppChrome>
      </RequireUsername>
    </RequireAuth>
  );
}

function AdminOnly({ children }: { children: ReactNode }) {
  return (
    <SignedIn>
      <AdminGuard>{children}</AdminGuard>
    </SignedIn>
  );
}

/** All screens, grouped by who can open them. Heavy pages load only when opened. */
export default function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Public — kept eager so sign-in stays instant */}
        <Route path="/" element={<WelcomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/choose-username" element={<ChooseUsernamePage />} />
        <Route path="/admin-verify" element={<AdminVerifyPage />} />

        {/* Signed-in app */}
        <Route path="/home" element={<SignedIn><HomePage /></SignedIn>} />
        <Route path="/event/:id/edit" element={<SignedIn><EditEventPage /></SignedIn>} />
        <Route path="/event/:id" element={<SignedIn><EventDetailsPage /></SignedIn>} />
        <Route path="/events/:id" element={<SignedIn><EventDetailsPage /></SignedIn>} />
        <Route path="/create" element={<SignedIn><CreateEventPage /></SignedIn>} />
        <Route path="/map" element={<SignedIn><MapPage /></SignedIn>} />
        <Route path="/profile" element={<SignedIn><ProfilePage /></SignedIn>} />
        <Route path="/account" element={<SignedIn><ManageAccountPage /></SignedIn>} />
        <Route path="/premium" element={<Navigate to="/account" replace />} />
        <Route path="/user/:userId" element={<SignedIn><UserProfilePage /></SignedIn>} />
        <Route path="/chat" element={<SignedIn><ChatPage /></SignedIn>} />
        <Route path="/friends" element={<SignedIn><FriendsPage /></SignedIn>} />
        <Route path="/notifications" element={<SignedIn><NotificationsPage /></SignedIn>} />
        <Route path="/payment/:eventId" element={<SignedIn><PaymentPage /></SignedIn>} />
        <Route path="/dashboard" element={<SignedIn><OrganizerDashboardPage /></SignedIn>} />
        <Route path="/ticket/:ticketId" element={<SignedIn><TicketPage /></SignedIn>} />

        {/* Administrator */}
        <Route path="/admin" element={<AdminOnly><AdminPanelPage /></AdminOnly>} />
        <Route path="/admin/events/:eventId" element={<AdminOnly><AdminEventDetailsPage /></AdminOnly>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
