import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { resolveAvatarDisplayUrl, getInitials } from '@/lib/avatars';

const sizeClasses = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-24 w-24 text-2xl',
} as const;

export type UserAvatarProps = {
  /** Profile / primary image */
  src?: string | null;
  /** Secondary (e.g. `avatar` field) */
  srcSecondary?: string | null;
  /** Stable id for generated avatar (user id is best) */
  seed: string;
  name?: string | null;
  email?: string | null;
  className?: string;
  size?: keyof typeof sizeClasses;
  /** Visually hidden label for screen readers */
  alt?: string;
};

/**
 * Radix Avatar: shows photo when loadable, otherwise initials on gradient.
 * Always has a valid `src` (generated SVG) so images rarely “disappear”.
 */
export function UserAvatar({
  src,
  srcSecondary,
  seed,
  name,
  email,
  className,
  size = 'md',
  alt = '',
}: UserAvatarProps) {
  const displayUrl = resolveAvatarDisplayUrl({
    photoUrl: src,
    altUrl: srcSecondary,
    seed: seed || name || email || 'user',
  });
  const initials = getInitials(name, email);

  return (
    <Avatar className={cn(sizeClasses[size], 'ring-2 ring-background shrink-0', className)}>
      <AvatarImage src={displayUrl} alt={alt || name || 'User'} className="object-cover" />
      <AvatarFallback
        delayMs={displayUrl.includes('dicebear.com') ? 0 : 600}
        className="bg-gradient-to-br from-primary/80 to-accent/80 text-primary-foreground font-semibold"
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
