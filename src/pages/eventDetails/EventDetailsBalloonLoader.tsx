import { useEffect, useId, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/** Confetti stays on screen at least this long after the event payload is ready. */
export const EVENT_BALLOON_CONFETTI_MS = 1100;
const CONFETTI_MS = EVENT_BALLOON_CONFETTI_MS;

const CONFETTI_COLORS = [
  'hsl(312 86% 62%)',
  'hsl(271 76% 58%)',
  'hsl(45 95% 58%)',
  'hsl(190 90% 55%)',
  'hsl(150 70% 48%)',
  'hsl(12 90% 62%)',
  'hsl(350 90% 65%)',
  'hsl(55 98% 62%)',
  'hsl(200 92% 62%)',
  'hsl(330 100% 72%)',
];

function makeConfetti(count = 56) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + ((i % 5) - 2) * 0.12;
    const speed = 160 + (i % 9) * 32;
    const drift = (i % 2 === 0 ? 1 : -1) * (18 + (i % 6) * 10);
    return {
      x: Math.cos(angle) * speed + drift,
      y: Math.sin(angle) * speed * 0.9 - 30 - (i % 7) * 10,
      fall: 90 + (i % 8) * 22,
      rotate: 160 + i * 41,
      delay: (i % 10) * 0.018,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      w: 5 + (i % 5) * 2,
      h: 9 + (i % 4) * 3,
      round: i % 6 === 0,
    };
  });
}

const SPARKLES = [
  { x: -92, y: -28, delay: 0, size: 10 },
  { x: 98, y: -8, delay: 0.35, size: 8 },
  { x: -78, y: 56, delay: 0.7, size: 7 },
  { x: 86, y: 72, delay: 0.2, size: 9 },
  { x: 0, y: -108, delay: 0.55, size: 6 },
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
  const skipWait = import.meta.env.MODE === 'test' || reduceMotion;
  const uid = useId().replace(/:/g, '');
  const fillId = `balloon-fill-${uid}`;
  const shineId = `balloon-shine-${uid}`;
  const [phase, setPhase] = useState<Phase>('inflate');
  const [scale, setScale] = useState(0.42);
  const confetti = useMemo(() => makeConfetti(), []);

  useEffect(() => {
    if (skipWait && ready) {
      onBurstDone();
    }
  }, [skipWait, ready, onBurstDone]);

  useEffect(() => {
    if (phase !== 'inflate' || skipWait) return;
    const id = window.setInterval(() => {
      setScale((s) => Math.min(1.28, +(s + 0.07).toFixed(2)));
    }, 220);
    return () => window.clearInterval(id);
  }, [phase, skipWait]);

  useEffect(() => {
    if (!ready || phase !== 'inflate') return;
    if (skipWait) return;
    setPhase('burst');
  }, [ready, phase, skipWait]);

  useEffect(() => {
    if (phase !== 'burst') return;
    const t = window.setTimeout(() => onBurstDone(), CONFETTI_MS);
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
        <p className="text-base font-semibold text-foreground">Loading</p>
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6"
      role="status"
      aria-live="polite"
      aria-label={phase === 'burst' ? 'Event loaded' : 'Loading event'}
      data-testid="event-balloon-loader"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,hsl(271_76%_53%_/_0.18),transparent_58%)]" />

      <div className="relative flex h-[22rem] w-72 items-center justify-center">
        <motion.div
          className="absolute bottom-8 h-8 w-28 rounded-[100%] bg-primary/20 blur-md"
          animate={{ scaleX: [0.85, 1.05, 0.85], opacity: [0.35, 0.55, 0.35] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />

        {phase === 'inflate' &&
          SPARKLES.map((spark, i) => (
            <motion.span
              key={i}
              className="absolute left-1/2 top-[42%] text-primary"
              style={{ fontSize: spark.size }}
              initial={{ x: spark.x, y: spark.y, opacity: 0, scale: 0.4 }}
              animate={{
                y: [spark.y, spark.y - 14, spark.y],
                opacity: [0.15, 1, 0.15],
                scale: [0.7, 1.15, 0.7],
                rotate: [0, 20, 0],
              }}
              transition={{ duration: 1.8, delay: spark.delay, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden
            >
              ✦
            </motion.span>
          ))}

        <AnimatePresence>
          {phase === 'inflate' ? (
            <motion.div
              key="balloon"
              className="origin-bottom"
              initial={{ scale: 0.34, y: 18, rotate: -4 }}
              animate={{ scale, y: [14, -10, 14], rotate: [-5, 5, -5] }}
              exit={{ scale: scale * 1.22, opacity: 0, filter: 'brightness(1.55)' }}
              transition={{
                scale: { type: 'spring', stiffness: 90, damping: 16 },
                y: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' },
                rotate: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
                opacity: { duration: 0.14 },
              }}
            >
              <svg viewBox="0 0 120 210" className="h-72 w-auto drop-shadow-[0_18px_28px_hsl(330_80%_45%_/_0.35)]" aria-hidden>
                <defs>
                  <radialGradient id={fillId} cx="38%" cy="28%" r="72%">
                    <stop offset="0%" stopColor="hsl(320 100% 82%)" />
                    <stop offset="42%" stopColor="hsl(312 86% 62%)" />
                    <stop offset="78%" stopColor="hsl(271 76% 54%)" />
                    <stop offset="100%" stopColor="hsl(271 72% 38%)" />
                  </radialGradient>
                  <linearGradient id={shineId} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="white" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M60 8 C28 8 10 40 10 72 C10 108 32 138 54 148 L50 158 Q60 164 70 158 L66 148 C88 138 110 108 110 72 C110 40 92 8 60 8 Z"
                  fill={`url(#${fillId})`}
                />
                <ellipse cx="42" cy="48" rx="16" ry="24" fill={`url(#${shineId})`} />
                <circle cx="78" cy="40" r="7" fill="white" opacity="0.28" />
                <path d="M54 148 Q60 156 66 148 L62 162 H58 Z" fill="hsl(271 70% 36%)" />
                <path
                  d="M60 162 C60 176 42 182 48 196 C54 210 78 204 60 220"
                  fill="none"
                  stroke="hsl(271 30% 62%)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </svg>
            </motion.div>
          ) : (
            <motion.div
              key="burst"
              className="pointer-events-none fixed inset-0 z-20"
              aria-hidden
            >
              <div className="absolute left-1/2 top-[42%] h-0 w-0">
                {confetti.map((piece, i) => (
                  <motion.span
                    key={i}
                    data-testid="balloon-confetti"
                    className={piece.round ? 'absolute rounded-full' : 'absolute rounded-[1px]'}
                    style={{
                      width: piece.w,
                      height: piece.round ? piece.w : piece.h,
                      background: piece.color,
                      boxShadow: `0 0 0 1px ${piece.color}`,
                      marginLeft: -piece.w / 2,
                      marginTop: -(piece.round ? piece.w : piece.h) / 2,
                    }}
                    initial={{ x: 0, y: 0, scale: 0.4, opacity: 1, rotate: 0 }}
                    animate={{
                      x: piece.x,
                      y: [piece.y * 0.25, piece.y, piece.y + piece.fall],
                      rotate: piece.rotate,
                      opacity: [1, 1, 0],
                      scale: [0.85, 1.15, 0.7],
                    }}
                    transition={{
                      duration: CONFETTI_MS / 1000,
                      delay: piece.delay,
                      ease: [0.12, 0.7, 0.18, 1],
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="relative mt-2 flex items-center gap-0.5 text-lg font-bold tracking-wide text-foreground">
        Loading
        <span className="inline-flex w-6 justify-start" aria-hidden>
          <motion.span
            className="inline-block"
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
          >
            .
          </motion.span>
          <motion.span
            className="inline-block"
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
          >
            .
          </motion.span>
          <motion.span
            className="inline-block"
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
          >
            .
          </motion.span>
        </span>
      </p>
    </div>
  );
}
