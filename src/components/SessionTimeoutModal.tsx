import { motion, AnimatePresence } from 'framer-motion';
import { Clock, LogOut, RefreshCw } from 'lucide-react';

interface SessionTimeoutModalProps {
  show: boolean;
  secondsLeft: number;
  onStay: () => void;
  onLogout: () => void;
}

export default function SessionTimeoutModal({
  show,
  secondsLeft,
  onStay,
  onLogout,
}: SessionTimeoutModalProps) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeStr = minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, '0')}`
    : `${seconds}s`;

  // Progress 0→1 as time runs out (over 120 s)
  const progress = Math.max(0, Math.min(1, secondsLeft / 120));
  const circumference = 2 * Math.PI * 20; // r=20
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm px-6"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="w-full max-w-sm rounded-3xl glass-card p-7 space-y-6 text-center"
          >
            {/* Countdown ring */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative flex h-20 w-20 items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" width="80" height="80" viewBox="0 0 48 48">
                  {/* Track */}
                  <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--secondary))" strokeWidth="3" />
                  {/* Progress */}
                  <circle
                    cx="24" cy="24" r="20"
                    fill="none"
                    stroke={secondsLeft <= 30 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
                  />
                </svg>
                <div className="flex flex-col items-center">
                  <Clock className={`h-4 w-4 mb-0.5 ${secondsLeft <= 30 ? 'text-destructive' : 'text-primary'}`} />
                  <span className={`text-sm font-bold tabular-nums ${secondsLeft <= 30 ? 'text-destructive' : 'text-foreground'}`}>
                    {timeStr}
                  </span>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-bold text-foreground">Still there?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your session will expire in{' '}
                  <span className={`font-semibold ${secondsLeft <= 30 ? 'text-destructive' : 'text-foreground'}`}>
                    {timeStr}
                  </span>{' '}
                  due to inactivity.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onLogout}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-secondary py-3 text-sm font-semibold text-foreground hover:bg-secondary/80 transition-colors active:scale-[0.98]"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
              <button
                type="button"
                onClick={onStay}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow ripple-container active:scale-[0.98] transition-transform"
              >
                <RefreshCw className="h-4 w-4" />
                Stay logged in
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
