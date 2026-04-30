import { useEffect, useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import ChatPage from "./pages/ChatPage";
import NotificationsPage from "./pages/NotificationsPage";
import PaymentPage from "./pages/PaymentPage";
import OrganizerDashboardPage from "./pages/OrganizerDashboardPage";
import TicketPage from "./pages/TicketPage";
import NotFound from "./pages/NotFound";
import RouteDocumentTitle from "./components/RouteDocumentTitle";
import AuthCallbackPage from '@/pages/AuthCallbackPage';
import SessionTimeoutModal from '@/components/SessionTimeoutModal';
import { getAuthToken, clearAuthToken } from '@/lib/auth';
import { logout } from '@/lib/storage';
import { startSessionTimeout, stopSessionTimeout, extendSession } from '@/lib/sessionTimeout';
import { clearCache } from '@/lib/queryCache';

const queryClient = new QueryClient();

// ── Session timeout wrapper (needs to be inside BrowserRouter for useNavigate) ──
function SessionGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(120);

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
    navigate('/login', { replace: true });
  };

  const handleStay = () => {
    setShowWarning(false);
    extendSession();
  };

  return (
    <>
      {children}
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
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RouteDocumentTitle />
        <SessionGuard>
          <Routes>
            <Route path="/" element={<WelcomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/event/:id/edit" element={<EditEventPage />} />
            <Route path="/event/:id" element={<EventDetailsPage />} />
            <Route path="/create" element={<CreateEventPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/payment/:eventId" element={<PaymentPage />} />
            <Route path="/dashboard" element={<OrganizerDashboardPage />} />
            <Route path="/ticket/:ticketId" element={<TicketPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SessionGuard>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
