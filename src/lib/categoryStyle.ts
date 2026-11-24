/** Welcome-page card tints: gradient, border and emoji per event category. */
export type CategoryCardStyle = {
  emoji: string;
  color: string;
  border: string;
};

const CATEGORY_CARD_STYLES: Record<string, CategoryCardStyle> = {
  Music: { emoji: '🎵', color: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-500/30' },
  Tech: { emoji: '💻', color: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/30' },
  Food: { emoji: '🍕', color: 'from-orange-500/20 to-yellow-500/20', border: 'border-orange-500/30' },
  Wellness: { emoji: '🧘', color: 'from-green-500/20 to-teal-500/20', border: 'border-green-500/30' },
  Art: { emoji: '🎨', color: 'from-pink-500/20 to-rose-500/20', border: 'border-pink-500/30' },
  Gaming: { emoji: '🎮', color: 'from-indigo-500/20 to-violet-500/20', border: 'border-indigo-500/30' },
  Sports: { emoji: '⚽', color: 'from-emerald-500/20 to-lime-500/20', border: 'border-emerald-500/30' },
  Movies: { emoji: '🎬', color: 'from-red-500/20 to-orange-500/20', border: 'border-red-500/30' },
  Study: { emoji: '📚', color: 'from-yellow-500/20 to-amber-500/20', border: 'border-yellow-500/30' },
  Travel: { emoji: '✈️', color: 'from-sky-500/20 to-blue-500/20', border: 'border-sky-500/30' },
  Coffee: { emoji: '☕', color: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-500/30' },
  Networking: { emoji: '🤝', color: 'from-cyan-500/20 to-teal-500/20', border: 'border-cyan-500/30' },
  Fitness: { emoji: '💪', color: 'from-green-500/20 to-emerald-500/20', border: 'border-green-500/30' },
};

const FALLBACK: CategoryCardStyle = {
  emoji: '✨',
  color: 'from-primary/20 to-accent/20',
  border: 'border-primary/30',
};

export function categoryCardStyle(category?: string | null): CategoryCardStyle {
  if (!category) return FALLBACK;
  return CATEGORY_CARD_STYLES[category] ?? FALLBACK;
}

export function categoryEmoji(category?: string | null): string {
  return categoryCardStyle(category).emoji;
}
