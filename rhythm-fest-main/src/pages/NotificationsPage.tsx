import { ArrowLeft, Check, Ticket, Users, Crown, Bell } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const notifications = [
  { id: "1", type: "approved", title: "Join Request Approved!", desc: "Your request for Neon Nights Festival was approved.", time: "2m ago", action: "proceed" },
  { id: "2", type: "ticket", title: "Ticket Ready", desc: "Your ticket for Modern Art Exhibition is ready to view.", time: "1h ago", action: "view" },
  { id: "3", type: "friend", title: "Alex joined an event", desc: "Alex joined Rooftop Food Festival", time: "3h ago", action: null },
  { id: "4", type: "promo", title: "Go Premium 🎉", desc: "Unlock friend activity, advanced filters & more!", time: "1d ago", action: "upgrade" },
];

const iconMap = {
  approved: <Check className="w-4 h-4" />,
  ticket: <Ticket className="w-4 h-4" />,
  friend: <Users className="w-4 h-4" />,
  promo: <Crown className="w-4 h-4" />,
};

const NotificationsPage = () => {
  const navigate = useNavigate();

  const handleAction = (n: typeof notifications[0]) => {
    if (n.action === "proceed") navigate("/payment/1");
    if (n.action === "view") navigate("/ticket/2");
    if (n.action === "upgrade") navigate("/profile");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 glass border-b border-border/30 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="font-display text-lg font-bold text-foreground">Notifications</h1>
      </div>

      <div className="px-4 max-w-lg mx-auto mt-4 space-y-2">
        {notifications.map((n, i) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-4 flex gap-3 cursor-pointer"
            onClick={() => handleAction(n)}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              n.type === "approved" ? "gradient-primary text-primary-foreground" : "bg-secondary text-primary"
            }`}>
              {iconMap[n.type as keyof typeof iconMap] || <Bell className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{n.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{n.desc}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{n.time}</p>
            </div>
            {n.action === "proceed" && (
              <span className="px-3 py-1 rounded-full gradient-primary text-primary-foreground text-[10px] font-semibold self-center shadow-glow whitespace-nowrap">
                Pay Now
              </span>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default NotificationsPage;
