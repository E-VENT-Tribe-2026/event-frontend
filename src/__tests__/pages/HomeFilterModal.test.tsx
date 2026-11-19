import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import HomeFilterModal from '@/pages/home/HomeFilterModal';

describe('HomeFilterModal budget range', () => {
  it('keeps the selected max when the minimum is set to €0', () => {
    const onBudgetMinChange = vi.fn();
    const onBudgetMaxChange = vi.fn();

    render(
      <HomeFilterModal
        open
        onClose={() => {}}
        filterDate=""
        minDate="2026-11-19"
        onFilterDateChange={() => {}}
        selectedCity=""
        onSelectedCityChange={() => {}}
        availableCities={[]}
        budgetMin={10}
        budgetMax={80}
        maxPrice={200}
        onBudgetMinChange={onBudgetMinChange}
        onBudgetMaxChange={onBudgetMaxChange}
        onClearFilters={() => {}}
      />,
    );

    expect(screen.getByText('€10 to €80')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Minimum budget'), { target: { value: '0' } });
    expect(onBudgetMinChange).toHaveBeenCalledWith(0);
    expect(onBudgetMaxChange).not.toHaveBeenCalled();
  });

  it('allows a free-only range of €0 to €0', () => {
    const onBudgetMaxChange = vi.fn();

    render(
      <HomeFilterModal
        open
        onClose={() => {}}
        filterDate=""
        minDate="2026-11-19"
        onFilterDateChange={() => {}}
        selectedCity=""
        onSelectedCityChange={() => {}}
        availableCities={[]}
        budgetMin={0}
        budgetMax={40}
        maxPrice={200}
        onBudgetMinChange={() => {}}
        onBudgetMaxChange={onBudgetMaxChange}
        onClearFilters={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText('Maximum budget'), { target: { value: '0' } });
    expect(onBudgetMaxChange).toHaveBeenCalledWith(0);
    expect(onBudgetMaxChange).not.toHaveBeenCalledWith(1);
  });

  it('lets the maximum thumb move up from a €0 to €0 range', () => {
    const onBudgetMaxChange = vi.fn();

    render(
      <HomeFilterModal
        open
        onClose={() => {}}
        filterDate=""
        minDate="2026-11-19"
        onFilterDateChange={() => {}}
        selectedCity=""
        onSelectedCityChange={() => {}}
        availableCities={[]}
        budgetMin={0}
        budgetMax={0}
        maxPrice={200}
        onBudgetMinChange={() => {}}
        onBudgetMaxChange={onBudgetMaxChange}
        onClearFilters={() => {}}
      />,
    );

    const min = screen.getByLabelText('Minimum budget');
    const max = screen.getByLabelText('Maximum budget');
    expect(min.className).toContain('is-inert');
    expect(max.className).not.toContain('is-inert');

    fireEvent.change(max, { target: { value: '80' } });
    expect(onBudgetMaxChange).toHaveBeenCalledWith(80);
  });
});
