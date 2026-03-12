import { useMemo } from 'react';
import type { EventItem } from '@/lib/storage';

interface CategoryFilterProps {
  events: EventItem[];
  value: string;
  onChange: (value: string) => void;
}

export default function CategoryFilter({ events, value, onChange }: CategoryFilterProps) {
  const categories = useMemo(() => {
    // Minimal, curated set of categories for the UI.
    // We intentionally do NOT derive from events to avoid duplicates / noise.
    return [
      'All',
      'Outdoors',
      'Music',
      'Tech',
      'Food',
      'Sports',
      'Business',
      'Online',
    ];
  }, []);

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
      {categories.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
            value === c
              ? 'gradient-primary text-primary-foreground shadow-glow'
              : 'glass-card text-secondary-foreground hover:text-foreground'
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

