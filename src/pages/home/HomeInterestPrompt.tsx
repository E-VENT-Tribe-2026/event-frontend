import { Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ALL_INTERESTS } from '@/lib/interests';
import { categoryEmoji } from '@/lib/categoryStyle';

type HomeInterestPromptProps = {
  open: boolean;
  pickedInterests: string[];
  savingInterests: boolean;
  onToggleInterest: (interest: string) => void;
  onSkip: () => void;
  onSave: () => void;
};

export default function HomeInterestPrompt({
  open,
  pickedInterests,
  savingInterests,
  onToggleInterest,
  onSkip,
  onSave,
}: HomeInterestPromptProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm px-4 pb-4 sm:pb-0"
        >
          <motion.div
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 48 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            className="w-full max-w-sm rounded-3xl glass-card overflow-hidden"
          >
            <div className="px-6 pt-7 pb-5 text-center space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary shadow-glow">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <h2 className="text-lg font-bold text-foreground">What are you into?</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Pick a few interests so we can show you events you'll love.
              </p>
            </div>

            <div className="px-5 pb-2 grid grid-cols-3 gap-2.5">
              {ALL_INTERESTS.map((interest) => {
                const selected = pickedInterests.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => onToggleInterest(interest)}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl border py-3 px-2 text-center transition-all active:scale-95 ${
                      selected
                        ? 'gradient-primary border-transparent text-primary-foreground shadow-glow'
                        : 'border-border/40 bg-secondary/50 text-muted-foreground hover:border-border hover:text-foreground'
                    }`}
                  >
                    <span className="text-xl leading-none">{categoryEmoji(interest)}</span>
                    <span className="text-[11px] font-medium leading-tight">{interest}</span>
                  </button>
                );
              })}
            </div>

            <div className="px-5 pt-4 pb-6 flex gap-3">
              <button
                type="button"
                onClick={onSkip}
                className="flex-1 rounded-2xl border border-border bg-secondary py-3 text-sm font-semibold text-foreground hover:bg-secondary/80 transition-colors active:scale-[0.98]"
              >
                Skip
              </button>
              <button
                type="button"
                disabled={pickedInterests.length === 0 || savingInterests}
                onClick={onSave}
                className="flex-1 rounded-2xl gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
              >
                {savingInterests ? 'Saving…' : pickedInterests.length > 0 ? `Done (${pickedInterests.length})` : 'Done'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
