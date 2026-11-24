import { Monitor, Moon, Sun } from 'lucide-react';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { ColorScheme } from '@/lib/colorScheme';

const OPTIONS: Array<{ id: ColorScheme; label: string; Icon: typeof Sun }> = [
  { id: 'dark', label: 'Dark', Icon: Moon },
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'system', label: 'System', Icon: Monitor },
];

export default function ColorSchemePicker({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useColorScheme();

  return (
    <div>
      {compact && (
        <p className="px-0.5 pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Appearance
        </p>
      )}
      <div
        role="radiogroup"
        aria-label="Color scheme"
        className="grid grid-cols-3 gap-1 rounded-xl bg-secondary/70 p-1"
      >
        {OPTIONS.map(({ id, label, Icon }) => {
          const selected = preference === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={label}
              onClick={() => setPreference(id)}
              className={`flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-semibold transition-all active:scale-95 ${
                selected
                  ? 'gradient-primary text-primary-foreground shadow-glow'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
