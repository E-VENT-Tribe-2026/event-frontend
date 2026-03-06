import { motion, AnimatePresence } from "framer-motion";
import { Crown, X, Check, Sparkles, Users, BarChart3, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface PremiumModalProps {
  open: boolean;
  onClose: () => void;
}

const features = [
  { icon: <Users className="w-4 h-4" />, label: "See which friends joined events" },
  { icon: <Zap className="w-4 h-4" />, label: "Boost event visibility" },
  { icon: <BarChart3 className="w-4 h-4" />, label: "Advanced analytics" },
  { icon: <Sparkles className="w-4 h-4" />, label: "Priority listing & larger reach" },
  { icon: <Users className="w-4 h-4" />, label: "Contact people with similar interests" },
];

const PremiumModal = ({ open, onClose }: PremiumModalProps) => {
  const { togglePremium } = useAuth();

  const handleUpgrade = () => {
    togglePremium();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-5 bg-background/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="glass rounded-3xl p-6 max-w-sm w-full shadow-elevated relative"
          >
            <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground">
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mx-auto mb-3 shadow-glow animate-pulse-glow">
                <Crown className="w-8 h-8 text-primary-foreground" />
              </div>
              <h2 className="font-display text-xl font-bold gradient-text">Go Premium</h2>
              <p className="text-sm text-muted-foreground mt-1">Unlock the full E-VENT experience</p>
            </div>

            <div className="space-y-3 mb-6">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground flex-shrink-0">
                    {f.icon}
                  </div>
                  <span className="text-sm text-foreground">{f.label}</span>
                </div>
              ))}
            </div>

            <div className="glass rounded-xl p-4 text-center mb-4">
              <span className="text-xs text-muted-foreground line-through">$19.99/mo</span>
              <p className="font-display text-2xl font-bold gradient-text">$9.99<span className="text-sm text-muted-foreground">/mo</span></p>
              <p className="text-[10px] text-muted-foreground mt-1">Early bird pricing</p>
            </div>

            <button
              onClick={handleUpgrade}
              className="w-full py-3.5 rounded-xl gradient-primary text-primary-foreground font-display font-bold text-sm shadow-glow hover:opacity-90 transition-opacity"
            >
              Upgrade Now
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PremiumModal;
