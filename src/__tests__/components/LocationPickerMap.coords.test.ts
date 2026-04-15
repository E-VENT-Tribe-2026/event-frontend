import { describe, it, expect } from 'vitest';
import { hasValidEventCoordinates } from '@/components/LocationPickerMap';

describe('hasValidEventCoordinates', () => {
  it('rejects null, NaN, and 0,0 placeholder', () => {
    expect(hasValidEventCoordinates(null, 1)).toBe(false);
    expect(hasValidEventCoordinates(1, null)).toBe(false);
    expect(hasValidEventCoordinates(NaN, 1)).toBe(false);
    expect(hasValidEventCoordinates(0, 0)).toBe(false);
  });

  it('accepts finite non-zero coordinates', () => {
    expect(hasValidEventCoordinates(40.7128, -74.006)).toBe(true);
    expect(hasValidEventCoordinates(-0.001, 12.3)).toBe(true);
  });
});
