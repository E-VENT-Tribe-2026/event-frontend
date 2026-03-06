import { useState } from "react";
import { motion } from "framer-motion";
import {
  Users, DollarSign, Ticket, TrendingUp, Check, X,
  MessageCircle, Plus, BarChart3, ChevronRight, Settings
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { mockEvents } from "@/data/mockData";

const mockRequests = [
  { id: "r1", name: "Alex Johnson", event: "Neon Nights Festival", avatar: "AJ", time: "2h ago" },
  { id: "r2", name: "Sarah Kim", event: "Neon Nights Festival", avatar: "SK", time: "4h ago" },
  { id: "r3", name: "Mike Torres", event: "Rooftop Food Festival", avatar: "MT", time: "6h ago" },
];

const OrganizerDashboard = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState(mockRequests);

  const handleRequest = (id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
          <div>
            <h1 className="font-display text-xl font-bold gradient-text">Dashboard</h1>
            <p className="text-xs text-muted-foreground">Neon Events Co.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/create")} className="gradient-primary rounded-full p-2 shadow-glow">
              <Plus className="w-4 h-4 text-primary-foreground" />
            </button>
            <button className="glass rounded-full p-2">
              <Settings className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 max-w-2xl mx-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mt-5">
          <StatCard icon={<Users className="w-5 h-5 text-primary" />} label="Participants" value="1,842" change="+12%" />
          <StatCard icon={<DollarSign className="w-5 h-5 text-accent" />} label="Revenue" value="$24,580" change="+8%" />
          <StatCard icon={<Ticket className="w-5 h-5 text-primary" />} label="Tickets Left" value="658" change="" />
          <StatCard icon={<TrendingUp className="w-5 h-5 text-accent" />} label="Views" value="12.4K" change="+23%" />
        </div>

        {/* Quick Analytics Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-6"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Analytics
            </h2>
            <span className="text-xs text-muted-foreground">Last 7 days</span>
          </div>
          <div className="glass rounded-2xl p-4">
            <div className="flex items-end gap-1.5 h-32">
              {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: i * 0.1, type: "spring" }}
                  className="flex-1 gradient-primary rounded-t-lg"
                />
              ))}
            </div>
            <div className="flex justify-between mt-2">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <span key={d} className="text-[9px] text-muted-foreground flex-1 text-center">{d}</span>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Join Requests */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-6"
        >
          <h2 className="font-display font-bold text-foreground mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" /> Join Requests
            <span className="ml-auto px-2 py-0.5 rounded-full gradient-primary text-[10px] text-primary-foreground font-bold">
              {requests.length}
            </span>
          </h2>
          <div className="space-y-2">
            {requests.map((req) => (
              <motion.div
                key={req.id}
                layout
                exit={{ opacity: 0, x: -100 }}
                className="glass rounded-xl p-3 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                  {req.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{req.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{req.event} • {req.time}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRequest(req.id)}
                    className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center shadow-glow"
                  >
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </button>
                  <button
                    onClick={() => handleRequest(req.id)}
                    className="w-8 h-8 rounded-full glass flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </motion.div>
            ))}
            {requests.length === 0 && (
              <div className="glass rounded-xl p-6 text-center">
                <Check className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">All requests handled!</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* My Events */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-6"
        >
          <h2 className="font-display font-bold text-foreground mb-3">My Events</h2>
          <div className="space-y-2">
            {mockEvents.slice(0, 3).map((event) => (
              <button
                key={event.id}
                onClick={() => navigate(`/event/${event.id}`)}
                className="w-full glass rounded-xl p-3 flex items-center gap-3 text-left"
              >
                <img src={event.image} alt={event.title} className="w-14 h-14 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{event.title}</p>
                  <p className="text-xs text-muted-foreground">{event.participants}/{event.maxParticipants} participants</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
        </motion.div>

        {/* Messages */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-6 mb-6"
        >
          <h2 className="font-display font-bold text-foreground mb-3 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" /> Messages
          </h2>
          <div className="space-y-2">
            {["Alex Johnson", "Sarah Kim"].map((name) => (
              <button
                key={name}
                onClick={() => navigate("/chat")}
                className="w-full glass rounded-xl p-3 flex items-center gap-3 text-left"
              >
                <div className="w-10 h-10 rounded-full gradient-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground truncate">Can I bring a friend?</p>
                </div>
                <span className="text-[10px] text-muted-foreground">5m</span>
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, change }: { icon: React.ReactNode; label: string; value: string; change: string }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="glass rounded-xl p-4 shadow-card"
  >
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
    <p className="font-display text-xl font-bold text-foreground">{value}</p>
    {change && <p className="text-[11px] text-accent mt-1">{change} this week</p>}
  </motion.div>
);

export default OrganizerDashboard;
