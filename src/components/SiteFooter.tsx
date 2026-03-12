export default function SiteFooter() {
  return (
    <footer className="mt-16 bg-[#0b1b33] text-muted-foreground">
      <div className="mx-auto w-full max-w-6xl px-6 py-10 lg:py-12">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          {/* Brand + CTA */}
          <div className="space-y-3 max-w-sm">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-black">
                e
              </span>
              <span className="text-base font-semibold tracking-tight">
                e-vent
              </span>
              <span className="text-xs text-muted-foreground">The people platform</span>
            </div>
            <p className="text-sm text-white/80">
              Create your own E-VENT group. Bring people together around what you love.
            </p>
            <button className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 transition-colors">
              Get started
              <span className="text-base leading-none">→</span>
            </button>
          </div>

          {/* Links columns */}
          <div className="grid flex-1 gap-8 text-xs sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <div className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-white">
                Your account
              </h3>
              <ul className="space-y-1">
                <li>Sign up</li>
                <li>Log in</li>
                <li>Help</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-white">
                Discover
              </h3>
              <ul className="space-y-1">
                <li>Groups</li>
                <li>Events</li>
                <li>Topics</li>
                <li>Cities</li>
                <li>Online events</li>
                <li>Local guides</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-white">
                E-VENT
              </h3>
              <ul className="space-y-1">
                <li>About</li>
                <li>Blog</li>
                <li>Pricing</li>
                <li>Careers</li>
                <li>Apps</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-white">
                Follow us
              </h3>
              <ul className="space-y-1">
                <li>Twitter</li>
                <li>Instagram</li>
                <li>LinkedIn</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-4 text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2">
          <span>© {new Date().getFullYear()} E-VENT</span>
          <span>Terms of service</span>
          <span>Privacy policy</span>
          <span>Cookie policy</span>
        </div>
      </div>
    </footer>
  );
}

