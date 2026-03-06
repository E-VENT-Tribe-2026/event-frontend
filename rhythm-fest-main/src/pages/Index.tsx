import { Search, Bell, Sparkles, Lock, TrendingUp, MapPin, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import EventCard from "@/components/EventCard";
import { mockEvents, categories } from "@/data/mockData";
import heroImage from "@/assets/hero-event.jpg";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import PremiumModal from "@/components/PremiumModal";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState("All");
  const [showPremium, setShowPremium] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = mockEvents.filter((e) => {
    const matchesCat = activeCategory === "All" || e.category === activeCategory;
    const matchesSearch = !searchQuery || e.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      <PremiumModal open={showPremium} onClose={() => setShowPremium(false)} />

      {/* Header */}
      <div className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
          <h1 className="font-display text-xl font-bold gradient-text">E-VENT</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/notifications")}
              className="relative p-2 rounded-full hover:bg-secondary transition-colors"
            >
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        {/* Search */}
        <div className="mt-4 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search events, organizers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl glass text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Hero Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 relative rounded-2xl overflow-hidden h-44"
        >
          <img src={heroImage} alt="Featured event" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full gradient-primary text-primary-foreground">
              Featured
            </span>
            <h2 className="font-display font-bold text-lg text-foreground mt-1">Discover Events Near You</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Find the best experiences in your city</p>
          </div>
        </motion.div>

        {/* Categories */}
        <div className="mt-5 flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? "gradient-primary text-primary-foreground shadow-glow"
                  : "glass text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Trending Events */}
        <Section icon={<TrendingUp className="w-4 h-4 text-accent" />} title="Trending Events">
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {mockEvents.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} variant="compact" />
            ))}
          </div>
        </Section>

        {/* Recommended */}
        <Section icon={<Sparkles className="w-4 h-4 text-primary" />} title="Recommended for You">
          <div className="space-y-4">
            {filtered.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="glass rounded-xl p-8 text-center">
              <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No events found</p>
            </div>
          )}
        </Section>

        {/* Nearby */}
        <Section icon={<MapPin className="w-4 h-4 text-accent" />} title="Nearby Events">
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {mockEvents.slice(2, 5).map((event) => (
              <EventCard key={event.id} event={event} variant="compact" />
            ))}
          </div>
        </Section>

        {/* Friend Activity */}
        <Section icon={<Heart className="w-4 h-4 text-accent" />} title="Friend Activity">
          {user?.isPremium ? (
            <div className="space-y-3">
              {mockEvents.filter(e => e.friendsJoined?.length).map((event) => (
                <div key={event.id} className="glass rounded-xl p-3 flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/event/${event.id}`)}>
                  <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                    {event.friendsJoined![0][0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{event.friendsJoined!.join(", ")} joined {event.title}</p>
                    <p className="text-xs text-muted-foreground">2 hours ago</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="relative">
              <div className="blur-sm pointer-events-none space-y-3">
                {mockEvents.slice(0, 2).map((event) => (
                  <div key={event.id} className="glass rounded-xl p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full gradient-primary" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Alex joined {event.title}</p>
                      <p className="text-xs text-muted-foreground">2 hours ago</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="glass rounded-2xl p-6 flex flex-col items-center gap-3 shadow-elevated">
                  <Lock className="w-8 h-8 text-primary" />
                  <p className="font-display font-semibold text-sm text-foreground">Premium Feature</p>
                  <p className="text-xs text-muted-foreground text-center">
                    Upgrade to see which friends joined events
                  </p>
                  <button
                    onClick={() => setShowPremium(true)}
                    className="px-6 py-2 rounded-full gradient-primary text-primary-foreground text-sm font-semibold shadow-glow"
                  >
                    Upgrade
                  </button>
                </div>
              </div>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
};

const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <motion.section
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="mt-7"
  >
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <h2 className="font-display font-bold text-base text-foreground">{title}</h2>
    </div>
    {children}
  </motion.section>
);

export default Index;
