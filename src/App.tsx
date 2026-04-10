import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RouteDocumentTitle />
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
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
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
