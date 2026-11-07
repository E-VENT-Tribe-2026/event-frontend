import type { ReactNode } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { getCategoryBanner } from '@/lib/categoryBanners';
import { PROFILE_PHOTO_ACCEPT_ATTR, validateProfilePhotoFile } from '@/lib/profilePhoto';

export default function EventBannerField({
  category,
  customUrl,
  onCustomUrl,
  onCustomFile,
  onError,
  overlay,
}: {
  category: string;
  customUrl: string | null;
  onCustomUrl: (url: string | null) => void;
  onCustomFile?: (file: File | null) => void;
  onError?: (message: string) => void;
  overlay?: ReactNode;
}) {
  const src = customUrl || getCategoryBanner(category);

  const releasePreview = () => {
    if (customUrl?.startsWith('blob:')) URL.revokeObjectURL(customUrl);
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const check = validateProfilePhotoFile(file);
    if (!check.ok) {
      onError?.(check.message);
      return;
    }
    releasePreview();
    onCustomUrl(URL.createObjectURL(file));
    onCustomFile?.(file);
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
            onClick={() => {
              releasePreview();
              onCustomUrl(null);
              onCustomFile?.(null);
            }}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Use category image
          </button>
        ) : null}
      </div>
    </div>
  );
}
