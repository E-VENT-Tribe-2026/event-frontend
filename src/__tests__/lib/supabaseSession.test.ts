import { describe, it, expect } from 'vitest';
import { clearSupabaseSession, syncSupabaseSession } from '@/lib/supabase';

describe('supabase session helpers', () => {
  it('skips sync when there is no access token', async () => {
    await expect(syncSupabaseSession('')).resolves.toBeUndefined();
    await expect(clearSupabaseSession()).resolves.toBeUndefined();
  });
});
