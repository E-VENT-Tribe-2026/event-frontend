import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatTimeLabel, timeSlots } from '@/lib/dateTimeField';
import { cn } from '@/lib/utils';

type TimePickerFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  placeholder?: string;
  className?: string;
};

export default function TimePickerField({
  id,
  value,
  onChange,
  min,
  placeholder = 'Pick a time',
  className,
}: TimePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  const slots = useMemo(() => {
    const list = timeSlots(15);
    if (value && /^\d{1,2}:\d{2}$/.test(value) && !list.includes(value)) {
      return [...list, value].sort();
    }
    return list;
  }, [value]);

  useEffect(() => {
    if (!open) return;
    selectedRef.current?.scrollIntoView({ block: 'center' });
  }, [open, value]);

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="none"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-2 rounded-xl bg-secondary px-3 py-3 text-left text-sm text-foreground outline-none border border-border/50 focus:border-primary/40 focus:ring-2 focus:ring-primary/50 transition-all',
              !value && 'text-muted-foreground',
              className,
            )}
          >
            <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{value ? formatTimeLabel(value) : placeholder}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="z-[80] w-56 p-2" sideOffset={8}>
          <div className="max-h-64 overflow-y-auto pr-1" role="listbox" aria-label="Event times">
            {slots.map((slot) => {
              const disabled = Boolean(min && slot < min);
              const selected = slot === value;
              return (
                <button
                  key={slot}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={disabled}
                  ref={selected ? selectedRef : undefined}
                  onClick={() => {
                    onChange(slot);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center rounded-lg px-3 py-1.5 text-left text-sm transition-colors',
                    selected ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary',
                    disabled && 'pointer-events-none opacity-40',
                  )}
                >
                  {formatTimeLabel(slot)}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
