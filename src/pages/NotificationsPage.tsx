import { getNotifications } from '@/lib/storage';
import { ArrowLeft, UserPlus, Bell, MessageCircle, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';

const iconMap = {
  join: UserPlus,
  reminder: Bell,
  message: MessageCircle,
  trending: TrendingUp,
};

const colorMap = {
  join: 'text-primary bg-primary/20',
  reminder: 'text-accent bg-accent/20',
  message: 'text-foreground bg-secondary',
  trending: 'text-primary bg-primary/20',
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const notifications = getNotifications();

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5 text-foreground" /></button>
        <h1 className="text-lg font-bold text-foreground">Notifications</h1>
      </header>

      <div className="mx-auto max-w-lg divide-y divide-border">
        {notifications.map((n, i) => {
          const Icon = iconMap[n.type];
          return (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-start gap-3 px-4 py-4 ${n.read ? 'opacity-60' : ''}`}
            >
              <div className={`shrink-0 rounded-full p-2.5 ${colorMap[n.type]}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.description}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{n.time}</span>
            </motion.div>
          );
        })}
        {notifications.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">No notifications yet</div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
