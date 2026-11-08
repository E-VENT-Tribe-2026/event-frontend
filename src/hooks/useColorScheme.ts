import { useEffect, useState } from 'react';
import {
  COLOR_SCHEME_CHANGED_EVENT,
  applyStoredColorScheme,
  getColorScheme,
  resolveColorScheme,
  setColorScheme,
  type ColorScheme,
  type ResolvedColorScheme,
} from '@/lib/colorScheme';

export function useColorScheme() {
  const [preference, setPreference] = useState<ColorScheme>(getColorScheme);
  const [resolved, setResolved] = useState<ResolvedColorScheme>(() => resolveColorScheme(preference));

  useEffect(() => {
    applyStoredColorScheme();
    const sync = () => {
      const next = getColorScheme();
      setPreference(next);
      setResolved(resolveColorScheme(next));
    };
    window.addEventListener(COLOR_SCHEME_CHANGED_EVENT, sync);
    return () => window.removeEventListener(COLOR_SCHEME_CHANGED_EVENT, sync);
  }, []);

  return {
    preference,
    resolved,
    setPreference: setColorScheme,
  };
}
