export default function ProfileLoadingRunner({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center ${compact ? 'py-16' : 'min-h-screen'} bg-background px-6`}
      role="status"
      aria-live="polite"
      aria-label="Loading profile"
      data-testid="profile-loading-runner"
    >
      <svg viewBox="0 0 80 100" className="h-28 w-28 text-primary" aria-hidden>
        <g className="profile-run-ground" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.35">
          <line x1="8" y1="90" x2="22" y2="90" />
          <line x1="32" y1="90" x2="44" y2="90" />
          <line x1="54" y1="90" x2="68" y2="90" />
          <line x1="78" y1="90" x2="92" y2="90" />
        </g>
        <g className="profile-run-bob" fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="40" cy="18" r="8" />
          <path d="M40 26 v26" strokeWidth="6" fill="none" />
          <g className="profile-run-arm-a">
            <path d="M40 34 l-16 16" strokeWidth="5" fill="none" />
          </g>
          <g className="profile-run-arm-b">
            <path d="M40 34 l14 16" strokeWidth="5" fill="none" />
          </g>
          <g className="profile-run-leg-a">
            <path d="M40 56 l-12 26" strokeWidth="6" fill="none" />
          </g>
          <g className="profile-run-leg-b">
            <path d="M40 56 l14 24" strokeWidth="6" fill="none" />
          </g>
        </g>
      </svg>
      <p className="mt-3 text-sm text-muted-foreground">Loading profile…</p>
    </div>
  );
}
