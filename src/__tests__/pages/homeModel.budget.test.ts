import { describe, expect, it } from 'vitest';
import {
  BUDGET_SLIDER_FALLBACK,
  budgetSliderMax,
  clampBudgetMax,
  clampBudgetMin,
  eventBudgetAmount,
  isBudgetInRange,
} from '@/pages/home/homeModel';

describe('event budget filter', () => {
  it('treats 0, empty, and invalid values as free', () => {
    expect(eventBudgetAmount(0)).toBe(0);
    expect(eventBudgetAmount('0')).toBe(0);
    expect(eventBudgetAmount(null)).toBe(0);
    expect(eventBudgetAmount(undefined)).toBe(0);
    expect(eventBudgetAmount(Number.NaN)).toBe(0);
    expect(eventBudgetAmount(12)).toBe(12);
  });

  it('includes free events when the range starts at €0', () => {
    expect(isBudgetInRange(0, 0, 500)).toBe(true);
    expect(isBudgetInRange(0, 0, 0)).toBe(true);
    expect(isBudgetInRange(null, 0, 40)).toBe(true);
    expect(isBudgetInRange(25, 0, 40)).toBe(true);
  });

  it('excludes free events once the minimum is above €0', () => {
    expect(isBudgetInRange(0, 1, 500)).toBe(false);
    expect(isBudgetInRange(10, 0, 5)).toBe(false);
  });

  it('lets both thumbs sit at €0 instead of forcing a €1 gap', () => {
    expect(clampBudgetMin(0, 500)).toBe(0);
    expect(clampBudgetMin(0, 0)).toBe(0);
    expect(clampBudgetMax(0, 0, 500)).toBe(0);
    expect(clampBudgetMax(0, 0, 0)).toBe(0);
    expect(clampBudgetMax(1, 0, 0)).toBe(0);
  });

  it('keeps a dragable slider max when the catalogue max is €0', () => {
    expect(budgetSliderMax(0)).toBe(BUDGET_SLIDER_FALLBACK);
    expect(budgetSliderMax(80)).toBe(80);
    expect(budgetSliderMax(undefined)).toBe(BUDGET_SLIDER_FALLBACK);
  });
});
