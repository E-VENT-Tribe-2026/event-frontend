import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Crown, BarChart3, Zap, Star, Check, ImagePlus, Repeat, Sparkles } from 'lucide-react';
import { getCurrentUser, updateUser } from '@/lib/storage';
import { PRO_MONTHLY_EUR } from '@/lib/accountPlan';
import { motion } from 'framer-motion';
import AppToast from '@/components/AppToast';

const FEATURES = [
  { icon: ImagePlus, title: 'Custom banners', desc: 'Upload your own event image instead of the category default' },
  { icon: Repeat, title: 'Recurring events', desc: 'Publish a weekly or monthly series in one go' },
  { icon: Sparkles, title: 'Unlimited AI', desc: 'Ask the assistant as much as you want, every day' },
  { icon: Zap, title: 'Boost Events', desc: 'Increase your event visibility' },
  { icon: BarChart3, title: 'Analytics Access', desc: 'Deep insights on your events' },
  { icon: Star, title: 'Priority Listing', desc: 'Your events shown first' },
];

export default function PremiumPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as const });

  const handleUpgrade = () => {
    if (!user) { navigate('/login'); return; }
    updateUser({ isPremium: true });
    setToast({ show: true, message: 'Welcome to Pro!', type: 'success' });
    setTimeout(() => navigate('/account'), 1500);
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />

      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5 text-foreground" /></button>
        <h1 className="text-lg font-bold text-gradient">E-VENT Pro</h1>
      </header>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-sm px-4 pt-8 space-y-8">
        <div className="text-center space-y-3">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
            className="mx-auto h-20 w-20 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, hsl(271 76% 53%), hsl(330 100% 59%))' }}>
            <Crown className="h-10 w-10 text-primary-foreground" />
          </motion.div>
          <h2 className="text-2xl font-bold text-foreground">Upgrade to Pro</h2>
          <p className="text-sm text-muted-foreground">Custom banners, recurring events and unlimited AI</p>
        </div>

        <div className="space-y-3">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
              className="flex items-center gap-4 rounded-xl gradient-card p-4 shadow-card border border-border/30">
              <div className="rounded-lg gradient-primary p-2">
                <f.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{f.title}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
              <Check className="h-5 w-5 text-primary ml-auto" />
            </motion.div>
          ))}
        </div>

        <div className="rounded-xl gradient-card p-6 shadow-card text-center border border-border/30 space-y-3">
          <p className="text-3xl font-bold text-foreground">€{PRO_MONTHLY_EUR}<span className="text-sm font-normal text-muted-foreground">/month</span></p>
          <p className="text-xs text-muted-foreground">Cancel anytime</p>
        </div>

        <button onClick={handleUpgrade}
          className="w-full gradient-primary rounded-xl py-3.5 text-sm font-bold text-primary-foreground shadow-glow ripple-container transition-transform active:scale-[0.98]">
          {user?.isPremium ? 'Already on Pro ✓' : 'Upgrade to Pro'}
        </button>
        {user?.isPremium ? (
          <button
            type="button"
            onClick={() => navigate('/account')}
            className="w-full text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Cancel subscription
          </button>
        ) : null}
      </motion.div>
    </div>
  );
}
