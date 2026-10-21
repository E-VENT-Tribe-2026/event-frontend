import { useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import type { UserWarning } from '@/lib/warningsApi';

// Amber palette and layout from the admin panel warning dialog mockup
// (same colours as --adm-warn / --adm-warn-text in index.css).
const AMBER = 'hsl(38 92% 52%)';
const AMBER_TEXT = 'hsl(38 95% 66%)';

const NO_REASON = 'No reason was provided.';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface WarningDialogProps {
  /** The warning to show; null hides the dialog. */
  warning: UserWarning | null;
  /**
   * acknowledge: blocking — only "I understand" leaves the dialog.
   * review: an already acknowledged warning shown again — Close, Escape or the background close it.
   *   Not mounted yet; reserved for a later stage of #294.
   */
  mode?: 'acknowledge' | 'review';
  /** 1-based position in the queue; the counter shows only when total > 1. */
  position?: number;
  total?: number;
  submitting?: boolean;
  error?: string | null;
  onAcknowledge?: () => void;
  onClose?: () => void;
  /**
   * Keep keyboard focus inside the dialog (acknowledge mode only). Turn off
   * while another modal on top (e.g. the session timeout) needs the keyboard.
   */
  trapFocus?: boolean;
}

export default function WarningDialog({
  warning,
  mode = 'acknowledge',
  position = 1,
  total = 1,
  submitting = false,
  error = null,
  onAcknowledge,
  onClose,
  trapFocus = true,
}: WarningDialogProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const reasonId = useId();
  const blocking = mode === 'acknowledge';
  const open = warning !== null;

  // Remember what had focus before the dialog opened (restored on close, below).
  useEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    returnFocusRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
  }, [open]);

  // Move focus into the dialog when it opens, shows the next warning, or gets
  // the keyboard back from a modal on top.
  useEffect(() => {
    if (open && trapFocus) actionRef.current?.focus();
  }, [open, warning?.id, trapFocus]);

  // Keyboard: Escape never closes a blocking warning; Tab cycles inside the card.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (!blocking) onClose?.();
        return;
      }
      if (e.key !== 'Tab' || !blocking || !trapFocus) return;
      const card = cardRef.current;
      if (!card) return;
      e.preventDefault();
      const items = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        card.focus();
        return;
      }
      const at = items.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey
        ? (at <= 0 ? items.length - 1 : at - 1)
        : (at + 1) % items.length;
      items[next].focus();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, blocking, trapFocus, onClose]);

  // Pull focus back if anything behind the dialog receives it.
  useEffect(() => {
    if (!open || !blocking || !trapFocus) return;
    const onFocusIn = (e: FocusEvent) => {
      const card = cardRef.current;
      if (card && e.target instanceof Node && !card.contains(e.target)) {
        (actionRef.current ?? card).focus();
      }
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, [open, blocking, trapFocus]);

  // Stop the page behind from scrolling while a blocking warning is up.
  useEffect(() => {
    if (!open || !blocking) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open, blocking]);

  // Give focus back on close. Declared last so its cleanup runs after the
  // focus guard above has been removed.
  useEffect(() => {
    if (!open) return;
    return () => {
      const target = returnFocusRef.current;
      returnFocusRef.current = null;
      if (target?.isConnected) target.focus();
    };
  }, [open]);

  const handleAction = () => {
    if (!blocking) {
      onClose?.();
      return;
    }
    if (submitting) return;
    onAcknowledge?.();
  };

  return (
    <AnimatePresence>
      {warning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          data-testid="warning-dialog-overlay"
          onClick={(e) => {
            if (!blocking && e.target === e.currentTarget) onClose?.();
          }}
          className="fixed inset-0 z-[9998] flex items-center justify-center px-6"
          style={{
            background: 'hsl(213 70% 4% / .72)',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
          }}
        >
          <motion.div
            ref={cardRef}
            role={blocking ? 'alertdialog' : 'dialog'}
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={reasonId}
            tabIndex={-1}
            initial={{ scale: 0.9, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="w-full glass-card space-y-4 outline-none"
            style={{
              maxWidth: 440,
              padding: 26,
              borderRadius: 20,
              border: '1px solid hsl(38 92% 52% / .4)',
              boxShadow: '0 20px 60px hsl(213 70% 3% / .7), 0 0 0 4px hsl(38 92% 52% / .08)',
            }}
          >
            <div className="flex flex-col items-center gap-3">
              <div
                className="flex items-center justify-center"
                style={{ width: 54, height: 54, borderRadius: 16, background: 'hsl(38 92% 52% / .15)', color: AMBER_TEXT }}
              >
                <AlertTriangle className="h-7 w-7" aria-hidden="true" />
              </div>
              {total > 1 && (
                <span
                  className="rounded-full border px-2.5 py-[3px] font-bold tabular-nums"
                  style={{
                    fontSize: 11,
                    background: 'hsl(38 92% 52% / .12)',
                    borderColor: 'hsl(38 92% 52% / .35)',
                    color: AMBER_TEXT,
                  }}
                >
                  {position} of {total}
                </span>
              )}
            </div>

            <h2 id={titleId} className="text-center font-bold text-foreground" style={{ fontSize: 20 }}>
              Warning from an administrator
            </h2>

            <div className="space-y-2 text-left">
              <p
                className="font-semibold uppercase text-muted-foreground"
                style={{ fontSize: 11, letterSpacing: '.06em' }}
              >
                Reason
              </p>
              {/* Plain text only: React escapes the reason; never use dangerouslySetInnerHTML here. */}
              <blockquote
                id={reasonId}
                className="whitespace-pre-wrap break-words text-left text-foreground"
                style={{
                  borderLeft: `3px solid ${AMBER}`,
                  background: 'hsl(213 61% 9% / .6)',
                  borderRadius: '0 12px 12px 0',
                  padding: '12px 14px',
                  fontSize: 14,
                }}
              >
                {warning.reason.trim() ? warning.reason : NO_REASON}
              </blockquote>
            </div>

            {blocking && (
              <p className="text-center text-muted-foreground" style={{ fontSize: 12.5 }}>
                You can continue using E-VENT once you acknowledge this warning.
              </p>
            )}

            {error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}

            <button
              ref={actionRef}
              type="button"
              onClick={handleAction}
              aria-disabled={submitting || undefined}
              className="flex w-full items-center justify-center gap-2 rounded-2xl gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow active:scale-[0.98] transition-transform aria-disabled:opacity-70"
            >
              {blocking ? (
                <>
                  {submitting
                    ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    : <Check className="h-4 w-4" aria-hidden="true" />}
                  I understand
                </>
              ) : (
                'Close'
              )}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
