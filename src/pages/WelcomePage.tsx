import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarHeart, Users, MapPin, Sparkles } from "lucide-react";
import SiteFooter from "@/components/SiteFooter";
import LoginPage from "./LoginPage";
import SignupPage from "./SignupPage";
import { getEvents, type EventItem } from "@/lib/storage";
import { seedDatabase } from "@/lib/seedData";

export default function WelcomePage() {
  const navigate = useNavigate();

  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);

  useEffect(() => {
    // Ensure seed events exist so "Events near you" always has content.
    seedDatabase();
  }, []);

  const eventsNear = useMemo<EventItem[]>(() => {
    const all = getEvents() || [];
    return all.filter(e => !e.isDraft).slice(0, 3);
  }, []);

  const handlePrimaryCta = () => setShowSignup(true);
  const handleSecondaryCta = () => setShowLogin(true);

  return (
    <div className="min-h-screen hero-surface text-foreground flex flex-col">
      {/* Top nav */}
      <header className="border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent shadow-glow">
              <MapPin className="h-5 w-5" />
            </div>
            <span className="brand-mark text-2xl md:text-3xl font-extrabold text-foreground">
              E-VENT
            </span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowLogin(true)}
              className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              Log in
            </button>
            <button
              onClick={() => setShowSignup(true)}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors shadow-card"
            >
              Sign up
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-14 lg:flex-row lg:items-start">
          {/* Left column */}
          <div className="flex-1 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              <Sparkles className="h-3 w-3 text-primary" />
              <span>Where interests become real-life connections</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-[3.2rem] lg:leading-[1.05]"
            >
              The people platform
              <span className="block text-primary">
                for events and meetups.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="max-w-xl text-base text-muted-foreground"
            >
              Whatever your interest—tech talks, coffee meetups, hikes, or
              game nights—E-VENT helps you find the people and events that fit
              your vibe.
            </motion.p>

            {/* Search panel */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12 }}
              className="mt-4 w-full max-w-xl rounded-2xl bg-card/90 shadow-card border border-border/80 p-3 sm:p-4 space-y-3"
            >
              <p className="text-xs font-medium text-muted-foreground">
                Find events by <span className="text-foreground">topic</span> and{" "}
                <span className="text-foreground">location</span>.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <input
                    className="w-full rounded-xl border border-input bg-secondary px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="What do you want to do?"
                  />
                </div>
                <div className="flex-1">
                  <input
                    className="w-full rounded-xl border border-input bg-secondary px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Where?"
                  />
                </div>
                <button
                  className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  type="button"
                  onClick={handlePrimaryCta}
                >
                  Search
                </button>
              </div>
            </motion.div>

            {/* Quick topic chips */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.18 }}
              className="flex flex-wrap gap-2 pt-1"
            >
              <span className="pill-chip--primary">🎮 Gaming nights</span>
              <span className="pill-chip--accent">☕ Coffee meetups</span>
              <span className="pill-chip--primary">🏃‍♀️ Fitness &amp; runs</span>
              <span className="pill-chip--accent">💼 Tech &amp; startups</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="flex flex-wrap items-center gap-3"
            >
              <button
                onClick={handlePrimaryCta}
                className="rounded-full px-7 py-3 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors shadow-glow"
              >
                Join E-VENT — it&apos;s free
              </button>
              <button
                onClick={handleSecondaryCta}
                className="rounded-full px-5 py-3 text-sm font-semibold text-foreground border border-border bg-card hover:bg-secondary transition-colors"
              >
                I already have an account
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-wrap gap-6 text-sm text-muted-foreground"
            >
              <div className="flex items-center gap-2">
                <CalendarHeart className="h-4 w-4 text-primary" />
                <span>Discover events tailored to your interests</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" />
                <span>Meet people you actually click with</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-accent" />
                <span>See what&apos;s happening around you</span>
              </div>
            </motion.div>
          </div>

          {/* Right column: events preview list */}
          <motion.div
            initial={{ opacity: 0, x: 120 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.1, type: "spring", stiffness: 80, damping: 18 }}
            className="relative mt-4 w-full max-w-md lg:mt-0 lg:w-96"
          >
            <div className="pointer-events-none absolute -top-10 -right-8 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-12 h-32 w-32 rounded-full bg-accent/10 blur-3xl" />

            <motion.div
              className="rounded-3xl events-near-you-card shadow-card border border-border p-4 space-y-4"
              animate={{
                y: [0, -6, 0],
                boxShadow: [
                  "0 12px 32px rgba(0,0,0,0.10)",
                  "0 22px 60px rgba(0,0,0,0.18)",
                  "0 12px 32px rgba(0,0,0,0.10)",
                ],
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              whileHover={{
                scale: 1.05,
                rotate: -0.75,
                boxShadow: "0 36px 90px rgba(0,0,0,0.32)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    Events near you
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Join what&apos;s happening this week
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {eventsNear.map(ev => (
                  <div
                    key={ev.id}
                    className="flex gap-3 rounded-2xl border border-border bg-card p-3"
                  >
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary uppercase">
                      {ev.category?.slice(0, 4) || "EVT"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {ev.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {ev.date} · {ev.time} · {ev.location}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ev.participants.length} going
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </main>
      {showLogin && <LoginPage onClose={() => setShowLogin(false)} />}
      {showSignup && <SignupPage onClose={() => setShowSignup(false)} />}

      <SiteFooter />
    </div>
  );
}

