import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { dateFromIso, formatIsoDateLabel, isoFromDate } from '@/lib/dateTimeField';
import { cn } from '@/lib/utils';

type DatePickerFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  allowEmpty?: boolean;
};

export default function DatePickerField({
  id,
  value,
  onChange,
  min,
  max,
  placeholder = 'Pick a date',
  className,
  allowEmpty = false,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? dateFromIso(value) : undefined;
  const minDate = min ? dateFromIso(min) : undefined;
  const maxDate = max ? dateFromIso(max) : undefined;

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
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{value ? formatIsoDateLabel(value) : placeholder}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="z-[80] w-auto p-0" sideOffset={8}>
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              if (!date) {
                if (allowEmpty) onChange('');
                return;
              }
              onChange(isoFromDate(date));
              setOpen(false);
            }}
            disabled={[
              ...(minDate ? [{ before: minDate }] : []),
              ...(maxDate ? [{ after: maxDate }] : []),
            ]}
            initialFocus
          />
          {allowEmpty && value ? (
            <div className="border-t border-border p-2">
              <button
                type="button"
                className="w-full rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                Clear date
              </button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
