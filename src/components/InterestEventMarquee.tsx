import { useMemo } from 'react';
import type { EventItem } from '@/lib/storage';
import InterestEventCard from '@/components/InterestEventCard';

/** Repeat the list until the strip is long enough, then duplicate it so -50% loops seamlessly. */
function loopForMarquee(events: EventItem[], minCards = 6): EventItem[] {
  if (events.length === 0) return [];
  const base: EventItem[] = [];
  while (base.length < minCards) base.push(...events);
  return [...base, ...base];
}

export default function InterestEventMarquee({ events }: { events: EventItem[] }) {
  const looped = useMemo(() => loopForMarquee(events), [events]);
  const durationSec = Math.max(24, Math.min(48, events.length * 5));

  return (
    <div className="group relative overflow-hidden py-1 motion-reduce:overflow-x-auto" data-testid="interest-marquee">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent" />
      <div
        className="flex w-max gap-4 animate-marquee-x group-hover:[animation-play-state:paused] motion-reduce:animate-none"
        style={{ animationDuration: `${durationSec}s` }}
      >
        {looped.map((event, i) => (
          <InterestEventCard key={`${event.id}-${i}`} event={event} />
        ))}
      </div>
    </div>
  );
}
