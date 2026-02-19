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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex flex-col items-center gap-6"
      >
        <div className="relative">
          <div className="h-24 w-24 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
            <span className="text-4xl font-bold text-primary-foreground">E</span>
          </div>
          <motion.div
            className="absolute inset-0 rounded-2xl border-2 border-primary/50"
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
        <h1 className="text-3xl font-bold text-gradient">E-VENT</h1>
        <p className="text-sm text-muted-foreground">Discover amazing events near you</p>
        <div className="w-48 h-1 rounded-full bg-secondary overflow-hidden mt-4">
          <motion.div
            className="h-full gradient-primary rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </motion.div>
    </div>
  );
}
