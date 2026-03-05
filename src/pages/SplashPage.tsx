import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getCurrentUser } from '@/lib/storage';
import { seedDatabase } from '@/lib/seedData';

export default function SplashPage() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    seedDatabase();
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            navigate(getCurrentUser() ? '/home' : '/login');
          }, 300);
          return 100;
        }
        return p + 4;
      });
    }, 60);
    return () => clearInterval(interval);
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/15 blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-accent/15 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex flex-col items-center gap-6 relative z-10"
      >
        <div className="relative">
          <motion.div
            className="h-28 w-28 rounded-3xl gradient-primary flex items-center justify-center shadow-glow"
            style={{ animation: 'glow-pulse 2s ease-in-out infinite' }}>
            <span className="text-5xl font-bold text-primary-foreground">E</span>
          </motion.div>
          <motion.div
            className="absolute inset-0 rounded-3xl border-2 border-primary/50"
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
        <h1 className="text-4xl font-bold text-gradient">E-VENT</h1>
        <p className="text-sm text-muted-foreground">Discover amazing events near you</p>
        <div className="w-52 h-1.5 rounded-full bg-secondary overflow-hidden mt-4">
          <motion.div
            className="h-full gradient-primary rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </motion.div>
    </div>
  );
}
