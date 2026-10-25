import { useEffect, useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  createReport,
  REPORT_REASONS_BY_TARGET,
  reportReasonLabel,
  type ReportOrigin,
  type ReportReason,
  type ReportTargetType,
} from '@/lib/reportsApi';

type ReportContentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: ReportTargetType;
  targetId: string;
  origin: ReportOrigin;
  title?: string;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
};

export default function ReportContentDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  origin,
  title,
  onSuccess,
  onError,
}: ReportContentDialogProps) {
  const reasons = REPORT_REASONS_BY_TARGET[targetType];
  const [reason, setReason] = useState<ReportReason>(reasons[0]);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) return;
    setReason(reasons[0]);
    setDescription('');
    setFormError('');
    setSubmitting(false);
  }, [open, reasons, targetId, targetType]);

  const heading =
    title ||
    (targetType === 'event' ? 'Report this event' : targetType === 'user' ? 'Report this user' : 'Report this message');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (reason === 'other' && !description.trim()) {
      setFormError('Please describe what happened.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const result = await createReport({
        target_type: targetType,
        target_id: targetId,
        reason,
        origin,
        description: description.trim() || null,
      });
      onOpenChange(false);
      onSuccess?.(result.message || 'Thanks. We received your report.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not send the report.';
      setFormError(message);
      onError?.(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-destructive" />
              {heading}
            </DialogTitle>
            <DialogDescription>
              Moderators will review this. False reports may lead to a warning.
            </DialogDescription>
          </DialogHeader>

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reason</legend>
            {reasons.map((value) => (
              <label key={value} className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
                <input
                  type="radio"
                  name="report-reason"
                  value={value}
                  checked={reason === value}
                  onChange={() => {
                    setReason(value);
                    setFormError('');
                  }}
                  className="accent-primary"
                />
                {reportReasonLabel(value)}
              </label>
            ))}
          </fieldset>

          <div className="space-y-1.5">
            <label htmlFor="report-description" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {reason === 'other' ? 'Details (required)' : 'Details (optional)'}
            </label>
            <textarea
              id="report-description"
              value={description}
              maxLength={1000}
              rows={4}
              onChange={(e) => {
                setDescription(e.target.value);
                if (formError) setFormError('');
              }}
              placeholder={reason === 'other' ? 'Tell us what happened…' : 'Anything else we should know?'}
              className="w-full resize-none rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className="text-right text-[10px] text-muted-foreground">{description.length}/1000</p>
          </div>

          {formError && <p className="text-xs text-destructive">{formError}</p>}

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-70"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />}
              {submitting ? 'Sending…' : 'Submit report'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
