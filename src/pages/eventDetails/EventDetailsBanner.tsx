import { ArrowLeft, Ban, ShieldCheck } from 'lucide-react';
import { getCategoryBanner } from '@/lib/categoryBanners';

type EventDetailsBannerProps = {
  title: string;
  image?: string;
  category: string;
  isCancelledEvent: boolean;
  requiresApproval: boolean;
  onBack: () => void;
};

export default function EventDetailsBanner({
  title,
  image,
  category,
  isCancelledEvent,
  requiresApproval,
  onBack,
}: EventDetailsBannerProps) {
  return (
    <div className="relative h-60">
      <img src={image || getCategoryBanner(category)} alt={title} className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
      <button onClick={onBack} className="absolute top-4 left-4 rounded-full glass-card p-2.5">
        <ArrowLeft className="h-5 w-5 text-foreground" />
      </button>
      <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
        {isCancelledEvent && (
          <div className="flex items-center gap-1 rounded-full bg-destructive/90 px-3 py-1 text-xs font-semibold text-destructive-foreground backdrop-blur-sm shadow-md">
            <Ban className="h-3.5 w-3.5" /> Cancelled
          </div>
        )}
        {requiresApproval && !isCancelledEvent && (
          <div className="flex items-center gap-1 rounded-full bg-accent/90 px-3 py-1 text-xs font-semibold text-accent-foreground backdrop-blur-sm">
            <ShieldCheck className="h-3 w-3" /> Approval Required
          </div>
        )}
      </div>
    </div>
  );
}
