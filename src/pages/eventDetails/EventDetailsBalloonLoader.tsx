import { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

const SHARDS = [
  { x: -52, y: -70, rotate: -40, className: 'bg-rose-400' },
  { x: 48, y: -64, rotate: 35, className: 'bg-pink-300' },
  { x: -70, y: 8, rotate: -12, className: 'bg-red-400' },
  { x: 74, y: 4, rotate: 18, className: 'bg-rose-300' },
  { x: -36, y: 62, rotate: 50, className: 'bg-orange-300' },
  { x: 40, y: 68, rotate: -28, className: 'bg-fuchsia-400' },
  { x: 0, y: -88, rotate: 8, className: 'bg-rose-200' },
  { x: -18, y: 86, rotate: -55, className: 'bg-pink-400' },
];

type Phase = 'inflate' | 'burst';

export default function EventDetailsBalloonLoader({
  ready,
  onBurstDone,
}: {
  ready: boolean;
  onBurstDone: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const gradientId = `balloon-${useId().replace(/:/g, '')}`;
  const [phase, setPhase] = useState<Phase>('inflate');
  const [scale, setScale] = useState(0.32);

  useEffect(() => {
    if (reduceMotion && ready) {
      onBurstDone();
    }
  }, [reduceMotion, ready, onBurstDone]);

  useEffect(() => {
    if (phase !== 'inflate' || reduceMotion) return;
    const id = window.setInterval(() => {
      setScale((s) => Math.min(1.22, +(s + 0.08).toFixed(2)));
    }, 240);
    return () => window.clearInterval(id);
  }, [phase, reduceMotion]);

  useEffect(() => {
    if (!ready || phase !== 'inflate') return;
    if (reduceMotion) return;
    setPhase('burst');
  }, [ready, phase, reduceMotion]);

  useEffect(() => {
    if (phase !== 'burst') return;
    const t = window.setTimeout(() => onBurstDone(), 450);
    return () => window.clearTimeout(t);
  }, [phase, onBurstDone]);

  if (reduceMotion) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center bg-background px-6"
        role="status"
        aria-live="polite"
        aria-label="Loading event"
        data-testid="event-balloon-loader"
      >
        <p className="text-sm text-muted-foreground">Loading event…</p>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-background px-6"
      role="status"
      aria-live="polite"
      aria-label={phase === 'burst' ? 'Event loaded' : 'Loading event'}
      data-testid="event-balloon-loader"
    >
      <div className="relative flex h-48 w-40 items-center justify-center">
        <AnimatePresence>
          {phase === 'inflate' ? (
            <motion.div
              key="balloon"
              className="origin-bottom"
              initial={{ scale: 0.28, y: 12 }}
              animate={{ scale, y: [8, -6, 8] }}
              exit={{ scale: scale * 1.18, opacity: 0, filter: 'brightness(1.4)' }}
              transition={{
                scale: { type: 'spring', stiffness: 120, damping: 18 },
                y: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' },
                opacity: { duration: 0.12 },
              }}
            >
              <svg viewBox="0 0 80 140" className="h-44 w-auto drop-shadow-lg" aria-hidden>
                <defs>
                  <radialGradient id={gradientId} cx="35%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="hsl(350 95% 78%)" />
                    <stop offset="55%" stopColor="hsl(350 82% 58%)" />
                    <stop offset="100%" stopColor="hsl(350 78% 42%)" />
                  </radialGradient>
                </defs>
                <ellipse cx="40" cy="38" rx="28" ry="34" fill={`url(#${gradientId})`} />
                <ellipse cx="30" cy="24" rx="8" ry="12" fill="white" opacity="0.38" />
                <path d="M40 72 L33 82 L47 82 Z" fill="hsl(350 70% 40%)" />
                <path
                  d="M40 82 C40 96 26 102 32 114 C38 126 50 120 40 134"
                  fill="none"
                  stroke="hsl(220 10% 55%)"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </motion.div>
          ) : (
            <motion.div key="burst" className="absolute inset-0">
              {SHARDS.map((shard, i) => (
                <motion.span
                  key={i}
                  className={`absolute left-1/2 top-1/2 h-2.5 w-2.5 rounded-full ${shard.className}`}
                  initial={{ x: -5, y: -20, scale: 1, opacity: 1 }}
                  animate={{ x: shard.x, y: shard.y, scale: 0, opacity: 0, rotate: shard.rotate }}
                  transition={{ duration: 0.42, ease: 'easeOut' }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        {phase === 'burst' ? 'Pop!' : 'Inflating…'}
      </p>
    </div>
  );
}
