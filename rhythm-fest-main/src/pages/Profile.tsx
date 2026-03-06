import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Edit, Crown, Calendar, Ticket, Star, Users, ChevronRight, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-event.jpg";
import { useAuth } from "@/contexts/AuthContext";
import { mockEvents } from "@/data/mockData";
import PremiumModal from "@/components/PremiumModal";
import TicketModal from "@/components/TicketModal";

const Profile = () => {
  const navigate = useNavigate();
  const { user, logout, togglePremium } = useAuth();
  const [showPremium, setShowPremium] = useState(false);
  const [ticketEvent, setTicketEvent] = useState<typeof mockEvents[0] | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  const joinedEvents = mockEvents.slice(0, 3);
  const ticketEvents = mockEvents.slice(0, 2);

  return (
    <div className="min-h-screen bg-background pb-24">
      <PremiumModal open={showPremium} onClose={() => setShowPremium(false)} />
      {ticketEvent && (
        <TicketModal open={!!ticketEvent} onClose={() => setTicketEvent(null)} event={ticketEvent} />
      )}

      {/* Cover + Avatar */}
      <div className="relative h-40">
        <img src={heroImage} alt="Cover" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute top-4 right-4 flex gap-2">
          <button onClick={handleLogout} className="glass rounded-full p-2">
            <LogOut className="w-5 h-5 text-foreground" />
          </button>
          <button className="glass rounded-full p-2">
            <Settings className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </div>

      <div className="px-4 max-w-2xl mx-auto">
        <div className="flex items-end gap-4 -mt-12 relative z-10">
          <div className="w-24 h-24 rounded-2xl gradient-primary border-4 border-background flex items-center justify-center">
            <span className="font-display text-2xl font-bold text-primary-foreground">
              {user?.name?.slice(0, 2).toUpperCase() || "JD"}
            </span>
          </div>
          <div className="flex-1 mb-1">
            <h1 className="font-display text-xl font-bold text-foreground">{user?.name || "John Doe"}</h1>
            <p className="text-xs text-muted-foreground">
              @{user?.name?.toLowerCase().replace(/\s/g, "") || "johndoe"} • {user?.role === "organizer" ? "Organizer" : "Participant"}
              {user?.isPremium && <span className="text-accent ml-1">★ Premium</span>}
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mt-4">
          {user?.role === "organizer" ? "Creating unforgettable experiences 🎪" : "Music lover 🎵 | Foodie 🍕 | Always exploring"}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <StatCard value="12" label="Events" />
          <StatCard value="48" label="Friends" />
          <StatCard value="4.8" label="Rating" />
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-5">
          <button className="flex-1 py-2.5 rounded-xl glass text-sm font-semibold text-foreground flex items-center justify-center gap-2">
            <Edit className="w-4 h-4" /> Edit Profile
          </button>
          {!user?.isPremium ? (
            <button
              onClick={() => setShowPremium(true)}
              className="flex-1 py-2.5 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 shadow-glow"
            >
              <Crown className="w-4 h-4" /> Go Premium
            </button>
          ) : (
            <div className="flex-1 py-2.5 rounded-xl glass text-sm font-semibold text-accent flex items-center justify-center gap-2">
              <Crown className="w-4 h-4" /> Premium Active
            </div>
          )}
        </div>

        {/* Interests */}
        <div className="mt-6">
          <h2 className="font-display font-bold text-foreground mb-3">Interests</h2>
          <div className="flex flex-wrap gap-2">
            {["Music", "Technology", "Food & Drink", "Wellness"].map((interest) => (
              <span key={interest} className="px-3 py-1 rounded-full glass text-xs text-muted-foreground">
                {interest}
              </span>
            ))}
          </div>
        </div>

        {/* Menu items */}
        <div className="mt-6 space-y-2">
          <MenuItem
            icon={<Calendar className="w-5 h-5 text-primary" />}
            label="Joined Events"
            badge="12"
            onClick={() => setActiveSection(activeSection === "events" ? null : "events")}
          />
          {activeSection === "events" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-2 pl-2">
              {joinedEvents.map((event) => (
                <button key={event.id} onClick={() => navigate(`/event/${event.id}`)} className="w-full glass rounded-xl p-3 flex items-center gap-3 text-left">
                  <img src={event.image} alt={event.title} className="w-12 h-12 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.date}</p>
                  </div>
                </button>
              ))}
            </motion.div>
          )}

          <MenuItem
            icon={<Ticket className="w-5 h-5 text-accent" />}
            label="My Tickets"
            badge="5"
            onClick={() => setActiveSection(activeSection === "tickets" ? null : "tickets")}
          />
          {activeSection === "tickets" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-2 pl-2">
              {ticketEvents.map((event) => (
                <button key={event.id} onClick={() => setTicketEvent(event)} className="w-full glass rounded-xl p-3 flex items-center gap-3 text-left">
                  <img src={event.image} alt={event.title} className="w-12 h-12 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.date}</p>
                  </div>
                  <span className="text-xs font-semibold text-primary">View QR</span>
                </button>
              ))}
            </motion.div>
          )}

          <MenuItem icon={<Star className="w-5 h-5 text-accent" />} label="Reviews" badge="8" onClick={() => {}} />
          <MenuItem icon={<Users className="w-5 h-5 text-primary" />} label="Friends" badge="48" onClick={() => {}} />
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ value, label }: { value: string; label: string }) => (
  <div className="glass rounded-xl p-3 text-center">
    <p className="font-display text-lg font-bold text-foreground">{value}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
);

const MenuItem = ({ icon, label, badge, onClick }: { icon: React.ReactNode; label: string; badge?: string; onClick?: () => void }) => (
  <motion.button
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className="w-full glass rounded-xl p-4 flex items-center gap-3"
  >
    {icon}
    <span className="flex-1 text-sm font-semibold text-foreground text-left">{label}</span>
    {badge && (
      <span className="px-2 py-0.5 rounded-full bg-secondary text-xs text-muted-foreground">
        {badge}
      </span>
    )}
    <ChevronRight className="w-4 h-4 text-muted-foreground" />
  </motion.button>
);

export default Profile;
