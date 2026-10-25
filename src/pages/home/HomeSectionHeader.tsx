import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

export default function HomeSectionHeader({
  icon: Icon, title, badge, collapsed, onToggle, iconClassName, iconWrapClassName,
}: {
  icon: LucideIcon;
  title: string;
  badge?: string;
  collapsed?: boolean;
  onToggle?: () => void;
  iconClassName?: string;
  iconWrapClassName?: string;
}) {
  return (
    <button type="button" onClick={onToggle} className="flex w-full items-center gap-2.5 pt-5 pb-3 group">
      <div className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors shrink-0 shadow-sm ${iconWrapClassName || 'bg-primary/15 group-hover:bg-primary/25'}`}>
        <Icon className={`h-4 w-4 ${iconClassName || 'text-primary'}`} />
      </div>
      <h2 className="text-base font-bold text-foreground tracking-tight">{title}</h2>
      {badge && <span className="ml-1.5 rounded-full gradient-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow-glow">{badge}</span>}
      {collapsed !== undefined && onToggle && (
        <motion.span className="ml-auto text-muted-foreground text-sm" animate={{ rotate: collapsed ? -90 : 0 }} transition={{ duration: 0.2 }}>▾</motion.span>
      )}
    </button>
  );
}
