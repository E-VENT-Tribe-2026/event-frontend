import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  show: boolean;
  onClose: () => void;
}

export default function AppToast({ message, type = 'success', show, onClose }: ToastProps) {
  useEffect(() => {
    if (show) {
      const t = setTimeout(onClose, 3000);
      return () => clearTimeout(t);
    }
  }, [show, onClose]);

  const colors = {
    success: 'bg-primary text-primary-foreground',
    error: 'bg-destructive text-destructive-foreground',
    info: 'bg-secondary text-secondary-foreground',
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] rounded-xl px-6 py-3 text-sm font-medium shadow-glow ${colors[type]}`}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
