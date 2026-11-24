import { AnimatePresence, motion } from 'framer-motion';

type EventDetailsVenueModalProps = {
  open: boolean;
  budget: number;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function EventDetailsVenueModal({
  open,
  budget,
  onConfirm,
  onCancel,
}: EventDetailsVenueModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-6"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="w-full max-w-sm rounded-2xl glass-card p-6 space-y-4"
          >
            <h3 className="text-lg font-bold text-foreground">Payment at Venue</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This event has a fee of{' '}
              <span className="font-semibold text-foreground">€{budget}</span>. Payment is
              collected at the venue on arrival. By joining, you agree to pay when you get there.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onConfirm}
                className="flex-1 gradient-primary rounded-xl py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Okay, Join Event
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-xl bg-secondary py-2.5 text-sm text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
