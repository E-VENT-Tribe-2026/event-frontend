import { supabase } from '@/lib/supabase';

const DEFAULT_ICON_SEEDS = [
  'aurora', 'blaze', 'coral', 'drift', 'ember', 'flint',
  'grove', 'haven', 'ivy', 'jade', 'kite', 'lunar',
];

export function pickDefaultIconUrl(): string {
  const seed = DEFAULT_ICON_SEEDS[Math.floor(Math.random() * DEFAULT_ICON_SEEDS.length)];
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;
}

/** Upload a profile photo to storage and return its public address. */
export async function uploadProfilePhotoToStorage(file: File, userId: string): Promise<string> {
  if (!supabase) throw new Error('Storage is not configured');
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Photo address could not be saved');
  return data.publicUrl;
}
