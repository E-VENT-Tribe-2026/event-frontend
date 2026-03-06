import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { FriendsProvider } from "@/contexts/FriendsContext";
import BottomNav from "@/components/BottomNav";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import EventDetails from "./pages/EventDetails";
import Profile from "./pages/Profile";
import MapPage from "./pages/MapPage";
import ChatPage from "./pages/ChatPage";
import CreateEvent from "./pages/CreateEvent";
import PaymentPage from "./pages/PaymentPage";
import TicketPage from "./pages/TicketPage";
import OrganizerDashboard from "./pages/OrganizerDashboard";
import NotificationsPage from "./pages/NotificationsPage";
import NotFound from "./pages/NotFound";
import PeoplePage from "./pages/PeoplePage";
import UserProfile from "./pages/UserProfile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <FriendsProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/event/:id" element={<EventDetails />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/people" element={<PeoplePage />} />
              <Route path="/user/:id" element={<UserProfile />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/create" element={<CreateEvent />} />
              <Route path="/payment/:id" element={<PaymentPage />} />
              <Route path="/ticket/:id" element={<TicketPage />} />
              <Route path="/dashboard" element={<OrganizerDashboard />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <BottomNav />
          </BrowserRouter>
        </FriendsProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
