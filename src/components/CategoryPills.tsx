import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Coffee,
  Cpu,
  Dumbbell,
  Film,
  Gamepad2,
  LayoutGrid,
  Leaf,
  Music,
  Network,
  Palette,
  Plane,
  Trophy,
  Utensils,
} from 'lucide-react';

export type CategoryPill = {
  id: string;
  icon: LucideIcon;
  iconColor: string;
  activeBg: string;
  activeBorderColor: string;
};

export const ALL_CATEGORY_PILL: CategoryPill = {
  id: 'All',
  icon: LayoutGrid,
  iconColor: '#94a3b8',
  activeBg: 'rgba(148,163,184,0.15)',
  activeBorderColor: 'rgba(148,163,184,0.5)',
};

/** Homepage / create-event category chips — same colors on every screen. */
export const EVENT_CATEGORY_PILLS: CategoryPill[] = [
  { id: 'Music', icon: Music, iconColor: '#a78bfa', activeBg: 'rgba(167,139,250,0.15)', activeBorderColor: 'rgba(167,139,250,0.5)' },
  { id: 'Tech', icon: Cpu, iconColor: '#60a5fa', activeBg: 'rgba(96,165,250,0.15)', activeBorderColor: 'rgba(96,165,250,0.5)' },
  { id: 'Food', icon: Utensils, iconColor: '#fb923c', activeBg: 'rgba(251,146,60,0.15)', activeBorderColor: 'rgba(251,146,60,0.5)' },
  { id: 'Fitness', icon: Dumbbell, iconColor: '#4ade80', activeBg: 'rgba(74,222,128,0.15)', activeBorderColor: 'rgba(74,222,128,0.5)' },
  { id: 'Art', icon: Palette, iconColor: '#f472b6', activeBg: 'rgba(244,114,182,0.15)', activeBorderColor: 'rgba(244,114,182,0.5)' },
  { id: 'Gaming', icon: Gamepad2, iconColor: '#818cf8', activeBg: 'rgba(129,140,248,0.15)', activeBorderColor: 'rgba(129,140,248,0.5)' },
  { id: 'Sports', icon: Trophy, iconColor: '#34d399', activeBg: 'rgba(52,211,153,0.15)', activeBorderColor: 'rgba(52,211,153,0.5)' },
  { id: 'Movies', icon: Film, iconColor: '#f87171', activeBg: 'rgba(248,113,113,0.15)', activeBorderColor: 'rgba(248,113,113,0.5)' },
  { id: 'Study', icon: BookOpen, iconColor: '#facc15', activeBg: 'rgba(250,204,21,0.15)', activeBorderColor: 'rgba(250,204,21,0.5)' },
  { id: 'Travel', icon: Plane, iconColor: '#38bdf8', activeBg: 'rgba(56,189,248,0.15)', activeBorderColor: 'rgba(56,189,248,0.5)' },
  { id: 'Coffee', icon: Coffee, iconColor: '#fbbf24', activeBg: 'rgba(251,191,36,0.15)', activeBorderColor: 'rgba(251,191,36,0.5)' },
  { id: 'Networking', icon: Network, iconColor: '#22d3ee', activeBg: 'rgba(34,211,238,0.15)', activeBorderColor: 'rgba(34,211,238,0.5)' },
  { id: 'Wellness', icon: Leaf, iconColor: '#2dd4bf', activeBg: 'rgba(45,212,191,0.15)', activeBorderColor: 'rgba(45,212,191,0.5)' },
];

export const HOME_CATEGORY_PILLS: CategoryPill[] = [ALL_CATEGORY_PILL, ...EVENT_CATEGORY_PILLS];

type CategoryPillsProps = {
  value: string;
  onChange: (id: string) => void;
  includeAll?: boolean;
  className?: string;
  'aria-label'?: string;
};

export default function CategoryPills({
  value,
  onChange,
  includeAll = false,
  className = '',
  'aria-label': ariaLabel = 'Category',
}: CategoryPillsProps) {
  const pills = includeAll ? HOME_CATEGORY_PILLS : EVENT_CATEGORY_PILLS;
  const extra =
    value && !pills.some((p) => p.id === value)
      ? [{ ...ALL_CATEGORY_PILL, id: value, iconColor: '#a78bfa', activeBg: 'rgba(167,139,250,0.15)', activeBorderColor: 'rgba(167,139,250,0.5)' }]
      : [];

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`flex flex-wrap gap-1.5 ${className}`.trim()}>
      {[...extra, ...pills].map((pill) => {
        const active = value === pill.id;
        const Icon = pill.icon;
        return (
          <button
            key={pill.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(pill.id)}
            style={
              active
                ? { background: pill.activeBg, borderColor: pill.activeBorderColor, color: pill.iconColor }
                : { background: pill.activeBg.replace('0.15', '0.08'), borderColor: pill.activeBorderColor.replace('0.5', '0.25') }
            }
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 ${
              active ? 'border-transparent shadow-sm' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: pill.iconColor }} />
            {pill.id}
          </button>
        );
      })}
    </div>
  );
}
