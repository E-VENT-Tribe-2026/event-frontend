import { Crown } from 'lucide-react';
import { accountPlanFrom, accountPlanLabel, type AccountPlan } from '@/lib/accountPlan';

export default function PlanBadge({
  plan,
  className = '',
}: {
  plan?: AccountPlan | unknown;
  className?: string;
}) {
  const resolved: AccountPlan = plan === 'pro' || plan === 'basic' ? plan : accountPlanFrom(plan);
  const pro = resolved === 'pro';

  return (
    <span
      data-testid="plan-badge"
      data-plan={resolved}
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        pro
          ? 'bg-[hsl(44_62%_46%)] text-[hsl(32_40%_12%)]'
          : 'border border-border/70 bg-secondary/80 text-muted-foreground'
      } ${className}`.trim()}
    >
      {pro ? <Crown className="h-3 w-3" aria-hidden="true" /> : null}
      {accountPlanLabel(resolved)}
    </span>
  );
}
