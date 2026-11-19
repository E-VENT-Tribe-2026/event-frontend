import { describe, it, expect } from 'vitest';
import { GERMANY_MAP_CENTER, hasValidEventCoordinates } from '@/components/LocationPickerMap';

describe('hasValidEventCoordinates', () => {
  it('rejects null, NaN, and 0,0 placeholder', () => {
    expect(hasValidEventCoordinates(null, 1)).toBe(false);
    expect(hasValidEventCoordinates(1, null)).toBe(false);
    expect(hasValidEventCoordinates(NaN, 1)).toBe(false);
    expect(hasValidEventCoordinates(0, 0)).toBe(false);
  });

  it('defaults the empty map to Germany rather than New York', () => {
    expect(GERMANY_MAP_CENTER[0]).toBeCloseTo(51.1657, 3);
    expect(GERMANY_MAP_CENTER[1]).toBeCloseTo(10.4515, 3);
    expect(GERMANY_MAP_CENTER[1]).not.toBeCloseTo(-74.006, 1);
  });

  it('accepts finite non-zero coordinates', () => {
    expect(hasValidEventCoordinates(40.7128, -74.006)).toBe(true);
    expect(hasValidEventCoordinates(-0.001, 12.3)).toBe(true);
    expect(hasValidEventCoordinates('53.107601', '8.848829')).toBe(true);
  });
});
