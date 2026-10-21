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
    <div className={compact ? 'px-1.5 py-1.5' : ''}>
      {compact && (
        <p className="px-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Color scheme
        </p>
      )}
      <div
        role="radiogroup"
        aria-label="Color scheme"
        className={`grid grid-cols-3 gap-1 ${compact ? '' : 'rounded-xl bg-secondary/70 p-1'}`}
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
              className={`flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors ${
                selected
                  ? 'bg-primary text-primary-foreground shadow-glow'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
