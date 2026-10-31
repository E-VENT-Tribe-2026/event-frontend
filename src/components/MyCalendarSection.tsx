import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { EventItem } from '@/lib/storage';
import { eventStartMs } from '@/lib/eventTime';

function startDate(event: EventItem): Date | null {
  const ms = eventStartMs(event);
  if (Number.isNaN(ms)) return null;
  return new Date(ms);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDayHeading(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

type MyCalendarSectionProps = {
  events: EventItem[];
  onOpenEvent: (id: string) => void;
};

export default function MyCalendarSection({ events, onOpenEvent }: MyCalendarSectionProps) {
  const nextStart = events[0] ? startDate(events[0]) : null;
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [month, setMonth] = useState<Date>(nextStart ?? new Date());
  const [day, setDay] = useState<Date | null>(null);
  const didSyncMonth = useRef(false);

  useEffect(() => {
    if (didSyncMonth.current || !nextStart) return;
    setMonth(nextStart);
    didSyncMonth.current = true;
  }, [nextStart]);

  const busyDays = useMemo(
    () => events.map(startDate).filter((date): date is Date => Boolean(date)),
    [events],
  );

  const dayEvents = useMemo(() => {
    if (!day) return [];
    return events.filter((event) => {
      const date = startDate(event);
      return date ? sameDay(date, day) : false;
    });
  }, [events, day]);

  return (
    <>
      <button
        type="button"
        data-testid="my-calendar"
        onClick={() => setCalendarOpen(true)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl glass-card p-4 text-left transition-all hover:border-primary/40"
      >
        <span className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
            <CalendarDays className="h-4 w-4 text-primary" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground">My Calendar</span>
            <span className="block text-[11px] text-muted-foreground">See days you have events</span>
          </span>
        </span>
        <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-bold text-primary">
          {events.length}
        </span>
      </button>

      <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
        <DialogContent
          className="max-w-sm rounded-3xl border-border bg-background p-5"
          data-testid="my-calendar-dialog"
        >
          <DialogHeader>
            <DialogTitle>My Calendar</DialogTitle>
            <DialogDescription>Highlighted days have events you will attend.</DialogDescription>
          </DialogHeader>
          <Calendar
            mode="single"
            month={month}
            onMonthChange={setMonth}
            selected={day ?? undefined}
            onSelect={(next) => {
              if (next) setDay(next);
            }}
            modifiers={{ attending: busyDays }}
            modifiersClassNames={{
              attending:
                'bg-primary/25 text-primary font-semibold hover:bg-primary/35 hover:text-primary relative after:absolute after:bottom-1 after:left-1/2 after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-primary',
            }}
            showOutsideDays={false}
            className="mx-auto p-0"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(day)} onOpenChange={(open) => { if (!open) setDay(null); }}>
        <DialogContent
          className="z-[60] max-w-sm rounded-3xl border-border bg-background p-5"
          data-testid="my-calendar-day-events"
        >
          <DialogHeader>
            <DialogTitle>{day ? formatDayHeading(day) : 'Events'}</DialogTitle>
            <DialogDescription>
              {dayEvents.length === 0
                ? 'No events on this day.'
                : `${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'} to attend`}
            </DialogDescription>
          </DialogHeader>
          {dayEvents.length > 0 ? (
            <ul className="space-y-2">
              {dayEvents.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setDay(null);
                      setCalendarOpen(false);
                      onOpenEvent(event.id);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl bg-secondary/50 p-2.5 text-left transition-all hover:bg-secondary"
                  >
                    <img src={event.image} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-foreground">{event.title}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {event.time}
                        {event.location ? ` · ${event.location}` : ''}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
