export type ProfileIcon = { id: string; url: string };
export type ProfileBanner = { id: string; label: string; url: string };

const ICON_SEEDS = [
  'sun', 'moon', 'star', 'comet', 'river', 'forest',
  'ember', 'ocean', 'breeze', 'pixel', 'maple', 'coral',
];

// DiceBear generates public SVG avatars from a seed, so no image files are needed.
export const PROFILE_ICONS: ProfileIcon[] = ICON_SEEDS.map((seed) => ({
  id: seed,
  url: `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${seed}`,
}));

const BANNER_SEEDS: Array<[string, string]> = [
  ['city', 'City lights'],
  ['forest', 'Forest'],
  ['ocean', 'Ocean'],
  ['desert', 'Desert'],
  ['mountain', 'Mountains'],
  ['night', 'Night sky'],
];

// Picsum returns the same public photo for the same seed.
export const PROFILE_BANNERS: ProfileBanner[] = BANNER_SEEDS.map(([id, label]) => ({
  id,
  label,
  url: `https://picsum.photos/seed/${id}/1200/400`,
}));

// Optional: use this in SignupPage so new users get an icon from the same catalog.
export const pickDefaultIcon = (): ProfileIcon =>
  PROFILE_ICONS[Math.floor(Math.random() * PROFILE_ICONS.length)];