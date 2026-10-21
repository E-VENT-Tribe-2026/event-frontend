import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlanBadge from '@/components/PlanBadge';

describe('PlanBadge', () => {
  it('shows Basic for the default account', () => {
    render(<PlanBadge plan={{ isPremium: false }} />);
    expect(screen.getByTestId('plan-badge')).toHaveTextContent('Basic');
    expect(screen.getByTestId('plan-badge')).toHaveAttribute('data-plan', 'basic');
  });

  it('shows Pro when the account is upgraded', () => {
    render(<PlanBadge plan={{ isPremium: true }} />);
    const badge = screen.getByTestId('plan-badge');
    expect(badge).toHaveTextContent('Pro');
    expect(badge).toHaveAttribute('data-plan', 'pro');
    expect(badge.className).toContain('bg-[hsl(44_62%_46%)]');
  });
});
