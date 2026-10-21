import { describe, it, expect } from 'vitest';
import { categoryCardStyle, categoryEmoji } from '@/lib/categoryStyle';

describe('categoryCardStyle', () => {
  it('tints Music like the welcome page', () => {
    expect(categoryCardStyle('Music')).toEqual({
      emoji: '🎵',
      color: 'from-purple-500/20 to-pink-500/20',
      border: 'border-purple-500/30',
    });
  });

  it('falls back when the category is unknown', () => {
    expect(categoryEmoji('Unknown')).toBe('✨');
    expect(categoryCardStyle().border).toBe('border-primary/30');
  });
});
