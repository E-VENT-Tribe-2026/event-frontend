import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Sparkles, UserPlus } from 'lucide-react';
import { seedDatabase, CATEGORIES } from '@/lib/seedData';

export default function WelcomePage() {
  useEffect(() => {
    seedDatabase();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] rounded-full bg-primary/20 blur-[140px]" />
        <div className="absolute bottom-0 right-1/4 w-[320px] h-[320px] rounded-full bg-accent/15 blur-[120px]" />
      </div>

      {/* Header — always show Log in and Sign up */}
      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
            <span className="text-lg font-bold text-primary-foreground">E</span>
          </div>
          <span className="text-xl font-bold text-foreground">E-VENT</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="rounded-full gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-95 transition-opacity"
          >
            Sign up
          </Link>
        </nav>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12 text-center max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            <span className="text-gradient">The people platform</span>
            <br />
            for events and meetups
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Whatever your interest — tech talks, coffee meetups, hikes, or game nights — E-VENT helps you find the people and events that fit your vibe.
          </p>

          {/* Search placeholder */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 rounded-2xl glass-card p-2 sm:p-1.5 max-w-xl mx-auto">
            <div className="flex-1 rounded-xl bg-secondary/50 px-4 py-3 text-left text-sm text-muted-foreground">
              Find events by topic and location
            </div>
            <Link
              to="/login"
              className="rounded-xl gradient-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow flex items-center justify-center gap-2 sm:ml-2"
            >
              Search
            </Link>
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {CATEGORIES.slice(0, 6).map((cat, i) => (
              <span
                key={cat}
                className="rounded-full glass-card px-3 py-1.5 text-xs font-medium text-secondary-foreground"
              >
                {cat}
              </span>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <Link
              to="/signup"
              className="w-full sm:w-auto rounded-xl gradient-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-glow ripple-container hover:opacity-95 transition-opacity flex items-center justify-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Join E-VENT — It's free
            </Link>
            <p className="text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/signup" className="text-primary font-medium hover:underline">
                Sign up
              </Link>
            </p>
          </div>

          {/* Feature links */}
          <div className="flex flex-wrap justify-center gap-6 pt-8 text-sm">
            <Link
              to="/login"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              Discover events tailored to your interests
            </Link>
            <Link
              to="/login"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <MapPin className="h-4 w-4 text-accent" />
              See what's happening around you
            </Link>
          </div>
        </motion.div>

        {/* Sidebar-style preview (events near you) */}
        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-12 w-full max-w-sm rounded-2xl glass-card p-5 text-left"
        >
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Events near you
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Join what's happening this week.
          </p>
          <div className="space-y-3">
            {['Neon Nights Music Festival', 'AI & Future Tech Summit', 'Street Food Carnival'].map((title, i) => (
              <div
                key={i}
                className="rounded-xl bg-secondary/50 p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {['Central Park, NYC', 'Tech Hub, SF', 'Brooklyn Bridge Park'][i]}
                  </p>
                </div>
                <span className="text-[10px] font-medium text-primary rounded-full bg-primary/20 px-2 py-1">
                  new
                </span>
              </div>
            ))}
          </div>
          <Link
            to="/signup"
            className="mt-4 block text-center rounded-xl border border-border py-2.5 text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors"
          >
            Get started →
          </Link>
        </motion.aside>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg gradient-primary flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">E</span>
            </div>
            <span className="text-sm font-semibold text-foreground">E-VENT</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">— The people platform</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <Link to="/login" className="hover:text-foreground transition-colors">Log in</Link>
            <Link to="/signup" className="hover:text-foreground transition-colors">Sign up</Link>
            <Link to="/signup" className="hover:text-foreground transition-colors">Help</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
