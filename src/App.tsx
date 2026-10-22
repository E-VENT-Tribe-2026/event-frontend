import { useEffect, useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from '@/lib/queryClient';
import { clearAllQueries } from '@/lib/queries';
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import WelcomePage from "./pages/WelcomePage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import HomePage from "./pages/HomePage";
import EventDetailsPage from "./pages/EventDetailsPage";
import EditEventPage from "./pages/EditEventPage";
import CreateEventPage from "./pages/CreateEventPage";
import MapPage from "./pages/MapPage";
import ProfilePage from "./pages/ProfilePage";
import UserProfilePage from "./pages/UserProfilePage";
import ChatPage from "./pages/ChatPage";
import FriendsPage from "./pages/FriendsPage";
import NotificationsPage from "./pages/NotificationsPage";
import PaymentPage from "./pages/PaymentPage";
import OrganizerDashboardPage from "./pages/OrganizerDashboardPage";
import TicketPage from "./pages/TicketPage";
import NotFound from "./pages/NotFound";
import RouteDocumentTitle from "./components/RouteDocumentTitle";
import AdminPanelPage from "./pages/AdminPanelPage";
import AdminEventDetailsPage from "./pages/AdminEventDetailsPage";
import AdminGuard from "@/components/AdminGuard";
import AuthCallbackPage from '@/pages/AuthCallbackPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import ChooseUsernamePage from '@/pages/ChooseUsernamePage';
import AdminVerifyPage from '@/pages/AdminVerifyPage';
import RequireUsername from '@/components/RequireUsername';
import ManageAccountPage from '@/pages/ManageAccountPage';
import PremiumPage from '@/pages/PremiumPage';
import SessionTimeoutModal from '@/components/SessionTimeoutModal';
import WarningsGate from '@/components/WarningsGate';
import AccountRefusalGate from '@/components/AccountRefusalGate';
import type { SuspensionNotice } from '@/lib/suspension';
import AIAssistantWidget from '@/components/assistant/AIAssistantWidget';
import RealtimeBridge from '@/components/RealtimeBridge';
import { getAuthToken, clearAuthToken, AUTH_EXPIRED_EVENT } from '@/lib/auth';
import { syncSupabaseSession } from '@/lib/supabase';
import { logout } from '@/lib/storage';
import { startSessionTimeout, stopSessionTimeout, extendSession } from '@/lib/sessionTimeout';
import { clearCache } from '@/lib/queryCache';
import { applyMyProfileToSession, fetchMyProfile } from '@/lib/profileMe';

const persister = typeof window !== 'undefined'
  ? createSyncStoragePersister({
    storage: window.localStorage,
    key: 'event-tribe-query-cache',
  })
  : undefined;


// ── Session timeout wrapper (needs to be inside BrowserRouter for useNavigate) ──
function SessionGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(120);

  // Fetch profile on app load to ensure avatar and user data are up to date
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    void syncSupabaseSession(token);
    void fetchMyProfile(token)
      .then((body) => {
        applyMyProfileToSession(body);
      })
      .catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // once on app mount

  useEffect(() => {
    // Only start the timer when a user is logged in
    if (!getAuthToken()) return;

    startSessionTimeout({
      onWarning: (secs) => {
        setSecondsLeft(secs);
        setShowWarning(true);
      },
      onLogout: () => {
        setShowWarning(false);
        handleLogout();
      },
    });

    return () => stopSessionTimeout();
  }, []);

  // Re-start timer whenever the auth token changes (login / logout)
  useEffect(() => {
    const interval = setInterval(() => {
      const hasToken = Boolean(getAuthToken());
      if (hasToken && !showWarning) {
        // Token just appeared (user logged in) — start timer
        startSessionTimeout({
          onWarning: (secs) => {
            setSecondsLeft(secs);
            setShowWarning(true);
          },
          onLogout: () => {
            setShowWarning(false);
            handleLogout();
          },
        });
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [showWarning]);

  const handleLogout = () => {
    stopSessionTimeout();
    logout();
    clearAuthToken();
    clearCache();
    clearAllQueries();
    navigate('/login', { replace: true });
  };

  // Same sign-out as handleLogout, for a request refused because the account is
  // suspended or became an administrator; the login page shows a suspension notice.
  const handleAccountRefused = (state?: { suspension: SuspensionNotice }) => {
    stopSessionTimeout();
    setShowWarning(false);
    logout();
    clearAuthToken();
    clearCache();
    clearAllQueries();
    navigate('/login', state ? { replace: true, state } : { replace: true });
  };

  // Kick the user out immediately whenever any API call receives a 401 (expired token)
  useEffect(() => {
    const onExpired = () => {
      setShowWarning(false);
      handleLogout();
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  // handleLogout is stable within the component lifetime
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStay = () => {
    setShowWarning(false);
    extendSession();
  };

  return (
    <>
      {children}
      <WarningsGate yieldFocus={showWarning} />
      <AccountRefusalGate onSignOut={handleAccountRefused} />
      <SessionTimeoutModal
        show={showWarning}
        secondsLeft={secondsLeft}
        onStay={handleStay}
        onLogout={handleLogout}
      />
    </>
  );
}

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{ persister: persister! }}
  >
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RouteDocumentTitle />
        <SessionGuard>
          <RealtimeBridge />
          <Routes>
            <Route path="/" element={<WelcomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/choose-username" element={<ChooseUsernamePage />} />
            <Route path="/admin-verify" element={<AdminVerifyPage />} />
            <Route path="/home" element={<RequireUsername><HomePage /></RequireUsername>} />
            <Route path="/event/:id/edit" element={<RequireUsername><EditEventPage /></RequireUsername>} />
            <Route path="/event/:id" element={<RequireUsername><EventDetailsPage /></RequireUsername>} />
            <Route path="/create" element={<RequireUsername><CreateEventPage /></RequireUsername>} />
            <Route path="/map" element={<RequireUsername><MapPage /></RequireUsername>} />
            <Route path="/profile" element={<RequireUsername><ProfilePage /></RequireUsername>} />
            <Route path="/account" element={<RequireUsername><ManageAccountPage /></RequireUsername>} />
            <Route path="/premium" element={<RequireUsername><PremiumPage /></RequireUsername>} />
            <Route path="/user/:userId" element={<RequireUsername><UserProfilePage /></RequireUsername>} />
            <Route path="/chat" element={<RequireUsername><ChatPage /></RequireUsername>} />
            <Route path="/friends" element={<RequireUsername><FriendsPage /></RequireUsername>} />
            <Route path="/notifications" element={<RequireUsername><NotificationsPage /></RequireUsername>} />
            <Route path="/payment/:eventId" element={<RequireUsername><PaymentPage /></RequireUsername>} />
            <Route path="/dashboard" element={<RequireUsername><OrganizerDashboardPage /></RequireUsername>} />
            <Route path="/admin" element={<RequireUsername><AdminGuard><AdminPanelPage /></AdminGuard></RequireUsername>} />
            <Route path="/admin/events/:eventId" element={<RequireUsername><AdminGuard><AdminEventDetailsPage /></AdminGuard></RequireUsername>} />
            <Route path="/ticket/:ticketId" element={<RequireUsername><TicketPage /></RequireUsername>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <AIAssistantWidget />
        </SessionGuard>
      </BrowserRouter>
    </TooltipProvider>
    {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />}
  </PersistQueryClientProvider>
);

export default App;
