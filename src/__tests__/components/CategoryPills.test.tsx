import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CategoryPills from '@/components/CategoryPills';

describe('CategoryPills', () => {
  it('selects one category at a time', () => {
    const onChange = vi.fn();
    render(<CategoryPills value="Music" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Food' }));
    expect(onChange).toHaveBeenCalledWith('Food');
  });

  it('includes an All chip when asked', () => {
    render(<CategoryPills includeAll value="All" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'true');
  });
});
