import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Sparkles, UserPlus, Zap, Users, Calendar, ArrowRight, Music, Cpu, Utensils, Dumbbell, Palette, Gamepad2 } from 'lucide-react';
import { seedDatabase } from '@/lib/seedData';

const PREVIEW_EVENTS = [
  { title: 'Neon Nights Festival', category: 'Music', location: 'NYC', emoji: '🎵', color: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-500/30' },
  { title: 'AI & Tech Summit', category: 'Tech', location: 'San Francisco', emoji: '💻', color: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/30' },
  { title: 'Street Food Carnival', category: 'Food', location: 'Brooklyn', emoji: '🍕', color: 'from-orange-500/20 to-yellow-500/20', border: 'border-orange-500/30' },
  { title: 'Sunset Yoga Retreat', category: 'Wellness', location: 'Santa Monica', emoji: '🧘', color: 'from-green-500/20 to-teal-500/20', border: 'border-green-500/30' },
  { title: 'Urban Art Exhibition', category: 'Art', location: 'Miami', emoji: '🎨', color: 'from-pink-500/20 to-rose-500/20', border: 'border-pink-500/30' },
  { title: 'Retro Gaming Night', category: 'Gaming', location: 'Chicago', emoji: '🎮', color: 'from-indigo-500/20 to-violet-500/20', border: 'border-indigo-500/30' },
];

const FEATURES = [
  { icon: Sparkles, title: 'Personalised for you', desc: 'Events matched to your interests, not just your location.', color: 'text-primary' },
  { icon: MapPin, title: 'Discover nearby', desc: 'See what\'s happening around you on an interactive map.', color: 'text-accent' },
  { icon: Users, title: 'Meet your people', desc: 'Connect with attendees who share your passions.', color: 'text-green-400' },
  { icon: Zap, title: 'Instant joining', desc: 'One tap to join, pay at venue, or request approval.', color: 'text-yellow-400' },
];



const CATEGORY_ICONS = [
  { icon: Music, label: 'Music', color: 'text-purple-400 bg-purple-400/10' },
  { icon: Cpu, label: 'Tech', color: 'text-blue-400 bg-blue-400/10' },
  { icon: Utensils, label: 'Food', color: 'text-orange-400 bg-orange-400/10' },
  { icon: Dumbbell, label: 'Fitness', color: 'text-green-400 bg-green-400/10' },
  { icon: Palette, label: 'Art', color: 'text-pink-400 bg-pink-400/10' },
  { icon: Gamepad2, label: 'Gaming', color: 'text-indigo-400 bg-indigo-400/10' },
];

export default function WelcomePage() {
  const navigate = useNavigate();

  useEffect(() => {
    seedDatabase();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const isRecovery = (hashParams.get('type') || '').toLowerCase() === 'recovery';
    const accessToken = hashParams.get('access_token') || hashParams.get('token') || '';
    if (isRecovery && accessToken.trim()) {
      navigate(`/forgot-password?access_token=${encodeURIComponent(accessToken.trim())}`, { replace: true });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-x-hidden">

      {/* ── Ambient background ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-[600px] h-[600px] rounded-full bg-primary/15 blur-[160px]" />
        <div className="absolute top-1/2 -right-32 w-[400px] h-[400px] rounded-full bg-accent/10 blur-[140px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[400px] rounded-full bg-primary/10 blur-[180px]" />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(hsl(213 30% 60%) 1px, transparent 1px), linear-gradient(90deg, hsl(213 30% 60%) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      {/* ── Header ── */}
      <header className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-8">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2.5"
        >
          <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
            <span className="text-lg font-bold text-primary-foreground">E</span>
          </div>
          <span className="text-xl font-bold text-foreground tracking-tight">E-VENT</span>
        </motion.div>
        <motion.nav
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Log in
          </Link>
          <Link
            to="/signup"
            className="rounded-full gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90 transition-opacity"
          >
            Sign up free
          </Link>
        </motion.nav>
      </header>

      <main className="relative z-10 flex-1">

        {/* ── Hero ── */}
        <section className="px-5 pt-12 pb-16 sm:px-8 sm:pt-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-3xl space-y-6"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary"
            >
              <Sparkles className="h-3.5 w-3.5" />
              The social events platform
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]"
            >
              Find your{' '}
              <span className="text-gradient">people</span>
              <br />
              at every{' '}
              <span className="text-gradient">event</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed"
            >
              Discover tech talks, music festivals, food markets, game nights and more — all in one place, tailored to what you love.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2"
            >
              <Link
                to="/signup"
                className="w-full sm:w-auto rounded-2xl gradient-primary px-8 py-4 text-sm font-bold text-primary-foreground shadow-glow ripple-container hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Get started — it's free
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto rounded-2xl border border-border bg-secondary/50 px-8 py-4 text-sm font-semibold text-foreground hover:bg-secondary transition-colors flex items-center justify-center gap-2"
              >
                Log in
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>


          </motion.div>
        </section>

        {/* ── Scrolling event cards strip ── */}
        <section className="relative overflow-hidden py-4">
          <div className="absolute left-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-r from-background to-transparent pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-l from-background to-transparent pointer-events-none" />
          <motion.div
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
            className="flex gap-4 w-max"
          >
            {[...PREVIEW_EVENTS, ...PREVIEW_EVENTS].map((ev, i) => (
              <div
                key={i}
                className={`shrink-0 w-56 rounded-2xl border ${ev.border} bg-gradient-to-br ${ev.color} backdrop-blur-sm p-4 space-y-2`}
              >
                <span className="text-2xl">{ev.emoji}</span>
                <p className="text-sm font-semibold text-foreground line-clamp-1">{ev.title}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-primary rounded-full bg-primary/20 px-2 py-0.5">{ev.category}</span>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MapPin className="h-2.5 w-2.5" />{ev.location}
                  </span>
                </div>
              </div>
            ))}
          </motion.div>
        </section>

        {/* ── Category icons ── */}
        <section className="px-5 pb-14 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-3xl text-center space-y-8"
          >
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                Every interest, <span className="text-gradient">covered</span>
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">From niche hobbies to massive festivals</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {CATEGORY_ICONS.map((c, i) => (
                <motion.div
                  key={c.label}
                  initial={{ opacity: 0, scale: 0.85 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  className={`flex items-center gap-2 rounded-2xl border border-border/50 ${c.color} px-4 py-2.5`}
                >
                  <c.icon className="h-4 w-4" />
                  <span className="text-sm font-medium text-foreground">{c.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── Features ── */}
        <section className="px-5 pb-16 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-3xl space-y-8"
          >
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                Built for <span className="text-gradient">real connections</span>
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">Everything you need to find, join, and enjoy events</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="rounded-2xl glass-card p-5 flex gap-4 items-start"
                >
                  <div className={`shrink-0 rounded-xl p-2.5 bg-secondary/60 ${f.color}`}>
                    <f.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{f.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── Final CTA banner ── */}
        <section className="px-5 pb-20 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-3xl"
          >
            <div className="relative rounded-3xl overflow-hidden gradient-primary p-px shadow-glow">
              <div className="rounded-3xl bg-background/80 backdrop-blur-xl px-8 py-12 text-center space-y-5">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-glow">
                  <Calendar className="h-7 w-7 text-primary-foreground" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                  Your next favourite event<br />is waiting
                </h2>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Join thousands of people discovering events they love every day.
                </p>
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 rounded-2xl gradient-primary px-8 py-4 text-sm font-bold text-primary-foreground shadow-glow hover:opacity-90 transition-opacity ripple-container"
                >
                  <UserPlus className="h-4 w-4" />
                  Create your free account
                </Link>
                <p className="text-xs text-muted-foreground">
                  Already have an account?{' '}
                  <Link to="/login" className="text-primary font-medium hover:underline">Log in</Link>
                </p>
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-border">
        <div className="max-w-4xl mx-auto px-5 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
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
          </div>
        </div>
        <div className="border-t border-border/50">
          <p className="py-3 text-center text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} Event Tribe™. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
