export default function ProfileLoadingRunner({
  compact = false,
  overlay = false,
  label = 'Loading profile…',
}: {
  compact?: boolean;
  overlay?: boolean;
  label?: string;
}) {
  const ariaLabel = label.replace(/[.…]+$/, '');
  return (
    <div
      className={
        overlay
          ? 'fixed inset-0 z-[1200] flex flex-col items-center justify-center bg-background/85 px-6 backdrop-blur-sm'
          : `flex flex-col items-center justify-center ${compact ? 'py-16' : 'min-h-screen'} bg-background px-6`
      }
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      data-testid="profile-loading-runner"
    >
      <svg
        viewBox="0 0 160 140"
        className={`profile-run-svg mx-auto ${overlay ? '' : 'mt-10'} h-52 w-64 overflow-visible text-primary`}
        aria-hidden
      >
        <g className="profile-run-ground" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity="0.32">
          <line x1="-20" y1="124" x2="8" y2="124" />
          <line x1="18" y1="124" x2="44" y2="124" />
          <line x1="56" y1="124" x2="84" y2="124" />
          <line x1="96" y1="124" x2="122" y2="124" />
          <line x1="134" y1="124" x2="162" y2="124" />
          <line x1="174" y1="124" x2="198" y2="124" />
        </g>

        <g className="profile-run-approach">
          <g className="profile-run-streaks" stroke="currentColor" strokeLinecap="round" opacity="0.28">
            <line x1="28" y1="44" x2="50" y2="44" strokeWidth="2.4" />
            <line x1="22" y1="58" x2="46" y2="58" strokeWidth="2" />
            <line x1="30" y1="72" x2="48" y2="72" strokeWidth="1.8" />
          </g>

          <g className="profile-run-body" fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <g className="profile-run-arm-far" opacity="0.42">
              <path d="M80 48 v22" strokeWidth="5.5" fill="none" />
              <g className="profile-run-forearm-far">
                <path d="M80 70 v20" strokeWidth="5" fill="none" />
              </g>
            </g>
            <g className="profile-run-leg-far" opacity="0.42">
              <path d="M80 72 v26" strokeWidth="6.5" fill="none" />
              <g className="profile-run-shin-far">
                <path d="M80 98 v24" strokeWidth="6" fill="none" />
                <ellipse cx="80" cy="123" rx="7" ry="2.6" />
              </g>
            </g>

            <circle cx="80" cy="28" r="11" />
            <path d="M80 38 L80 72" strokeWidth="7" fill="none" />

            <g className="profile-run-arm-near">
              <path d="M80 48 v22" strokeWidth="5.5" fill="none" />
              <g className="profile-run-forearm-near">
                <path d="M80 70 v20" strokeWidth="5" fill="none" />
              </g>
            </g>
            <g className="profile-run-leg-near">
              <path d="M80 72 v26" strokeWidth="6.5" fill="none" />
              <g className="profile-run-shin-near">
                <path d="M80 98 v24" strokeWidth="6" fill="none" />
                <ellipse cx="80" cy="123" rx="7" ry="2.6" />
              </g>
            </g>
          </g>
        </g>
      </svg>
      <p className="mt-3 text-center text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
