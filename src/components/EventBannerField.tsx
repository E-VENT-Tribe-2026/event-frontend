import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Crown, ImagePlus, X } from 'lucide-react';
import { getCategoryBanner } from '@/lib/categoryBanners';
import { PROFILE_PHOTO_ACCEPT_ATTR, validateProfilePhotoFile } from '@/lib/profilePhoto';

export default function EventBannerField({
  category,
  customUrl,
  onCustomUrl,
  isPro,
  onError,
  overlay,
}: {
  category: string;
  customUrl: string | null;
  onCustomUrl: (url: string | null) => void;
  isPro: boolean;
  onError?: (message: string) => void;
  overlay?: ReactNode;
}) {
  const src = customUrl || getCategoryBanner(category);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const check = validateProfilePhotoFile(file);
    if (!check.ok) {
      onError?.(check.message);
      return;
    }
    onCustomUrl(URL.createObjectURL(file));
  };

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-2xl glass-card">
        <div className="relative h-32">
          <img src={src} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          {overlay}
        </div>
      </div>
      {isPro ? (
        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-secondary/80">
            <ImagePlus className="h-3.5 w-3.5" />
            Custom banner
            <input
              type="file"
              accept={PROFILE_PHOTO_ACCEPT_ATTR}
              className="sr-only"
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.currentTarget.value = '';
              }}
            />
          </label>
          {customUrl ? (
            <button
              type="button"
              onClick={() => onCustomUrl(null)}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Use category image
            </button>
          ) : null}
        </div>
      ) : (
        <Link
          to="/premium"
          className="flex items-center justify-between rounded-xl border border-primary/25 bg-primary/5 px-3 py-2"
        >
          <span className="text-xs font-medium text-foreground">Custom banner</span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-primary">
            <Crown className="h-3 w-3" />
            Pro
          </span>
        </Link>
      )}
    </div>
  );
}
