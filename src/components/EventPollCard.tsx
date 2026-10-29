import { useMemo } from 'react';

export default function EventPollCard({
  question,
  options,
  votesByUser,
  myId,
  disabled,
  onVote,
}: {
  question: string;
  options: string[];
  votesByUser: Record<string, number>;
  myId?: string | null;
  disabled?: boolean;
  onVote: (optionIndex: number) => void;
}) {
  const counts = useMemo(() => {
    const next = options.map(() => 0);
    for (const idx of Object.values(votesByUser)) {
      if (typeof idx === 'number' && idx >= 0 && idx < next.length) next[idx] += 1;
    }
    return next;
  }, [options, votesByUser]);
  const total = counts.reduce((sum, n) => sum + n, 0);
  const mine = myId ? votesByUser[myId] : undefined;

  return (
    <div className="min-w-[180px] space-y-2">
      <p className="text-sm font-semibold leading-snug">{question}</p>
      <div className="space-y-1.5">
        {options.map((option, index) => {
          const count = counts[index] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const selected = mine === index;
          return (
            <button
              key={`${option}-${index}`}
              type="button"
              disabled={disabled}
              onClick={() => onVote(index)}
              className={`relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors disabled:opacity-60 ${
                selected ? 'border-primary bg-primary/15' : 'border-border/50 bg-background/40 hover:bg-secondary/60'
              }`}
            >
              <span
                className="absolute inset-y-0 left-0 bg-primary/20"
                style={{ width: `${pct}%` }}
              />
              <span className="relative z-10 flex items-center justify-between gap-2">
                <span className="truncate">{option}</span>
                <span className="shrink-0 tabular-nums text-[10px] opacity-80">
                  {count} · {pct}%
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] opacity-70">{total} vote{total === 1 ? '' : 's'}</p>
    </div>
  );
}
