import React, { useState } from 'react';
import {
  Sparkles,
  Calendar,
  MapPin,
  DollarSign,
  Users,
  ArrowRight,
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { publishDraftEvent, type AssistantDraftEvent } from '@/lib/assistantApi';

interface AssistantDraftCardProps {
  draft: AssistantDraftEvent;
  validationIssues?: string[];
  onApplyDraft?: (draft: AssistantDraftEvent) => void;
  onPublishSuccess?: (eventId: string) => void;
}

export const AssistantDraftCard: React.FC<AssistantDraftCardProps> = ({
  draft,
  validationIssues = [],
  onApplyDraft,
  onPublishSuccess,
}) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedEventId, setPublishedEventId] = useState<string | null>(null);

  const formatDateTime = (startStr?: string, endStr?: string) => {
    if (!startStr) return null;
    try {
      const start = new Date(startStr);
      const datePart = start.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const timePart = start.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });

      if (endStr) {
        const end = new Date(endStr);
        const endTimePart = end.toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        });
        return `${datePart} · ${timePart} - ${endTimePart}`;
      }
      return `${datePart} · ${timePart}`;
    } catch {
      return startStr;
    }
  };

  const handleUseInCreator = () => {
    if (onApplyDraft) {
      onApplyDraft(draft);
      return;
    }

    try {
      window.sessionStorage.setItem('event_assistant_draft_prefill', JSON.stringify(draft));
    } catch {
      // Storage unavailable
    }

    navigate('/create', { state: { draft } });
  };

  const handlePublish = async () => {
    if (isPublishing) return;
    setIsPublishing(true);
    setPublishError(null);

    try {
      const res = await publishDraftEvent(draft);
      if (res.success && res.eventId) {
        setPublishedEventId(res.eventId);
        if (onPublishSuccess) {
          onPublishSuccess(res.eventId);
        }
      } else {
        setPublishError(res.error || 'Failed to publish event. Please try again.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to publish event. Please check required fields.';
      setPublishError(msg);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleOpenPublishedEvent = () => {
    if (publishedEventId) {
      navigate(`/events/${publishedEventId}`);
    }
  };

  const handleCopy = () => {
    const summary = [
      `Event Title: ${draft.title || 'Untitled'}`,
      draft.category ? `Category: ${draft.category}` : null,
      draft.start_datetime ? `Date & Time: ${draft.start_datetime}` : null,
      draft.location_name ? `Location: ${draft.location_name}` : null,
      draft.cost !== undefined ? `Cost: ${draft.cost === 0 ? 'Free' : `$${draft.cost}`}` : null,
      draft.max_capacity ? `Capacity: ${draft.max_capacity}` : null,
      draft.description ? `\nDescription:\n${draft.description}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard?.writeText(summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const dateText = formatDateTime(draft.start_datetime, draft.end_datetime);
  const isFree = draft.cost === 0 || draft.cost === undefined;

  return (
    <div
      data-testid="assistant-draft-card"
      className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-card/95 via-card/85 to-primary/10 p-4 shadow-xl backdrop-blur-md transition-all duration-200 hover:border-primary/60 hover:shadow-glow"
    >
      {/* Top Banner */}
      <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2.5">
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Sparkles className="h-3 w-3" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Draft Event Preview
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          title="Copy draft summary"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Main Content */}
      <div className="mt-3">
        <div className="flex flex-wrap items-center gap-2">
          {draft.category && (
            <span className="rounded-full bg-accent/15 border border-accent/25 px-2 py-0.5 text-[10px] font-semibold text-accent">
              {draft.category}
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              isFree
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-primary/15 text-primary border border-primary/30'
            }`}
          >
            {isFree ? 'Free' : `$${draft.cost}`}
          </span>
          <h4 className="truncate text-sm font-bold text-foreground w-full sm:w-auto">
            {draft.title || 'Untitled Draft Event'}
          </h4>
        </div>

        {draft.description && (
          <p className="mt-2 line-clamp-3 text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/20 pl-2">
            {draft.description}
          </p>
        )}

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground bg-muted/30 rounded-xl p-2.5">
          {dateText && (
            <div className="flex items-center gap-1.5 truncate">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{dateText}</span>
            </div>
          )}
          {draft.location_name && (
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="truncate">{draft.location_name}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span className={`font-semibold ${isFree ? 'text-emerald-400' : 'text-foreground'}`}>
              {isFree ? 'Free admission' : `$${draft.cost} ticket`}
            </span>
          </div>
          {draft.max_capacity !== undefined && draft.max_capacity > 0 && (
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{draft.max_capacity} capacity</span>
            </div>
          )}
        </div>
      </div>

      {/* Validation Issues if any */}
      {validationIssues.length > 0 && !publishedEventId && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-300">
          <div className="flex items-center gap-1 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>Items to review before publishing:</span>
          </div>
          <ul className="mt-1 list-disc list-inside space-y-0.5 text-[11px] opacity-90 pl-1">
            {validationIssues.map((issue, idx) => (
              <li key={idx}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Error state */}
      {publishError && (
        <div
          data-testid="publish-error"
          className="mt-3 flex items-start gap-1.5 rounded-lg border border-destructive/40 bg-destructive/15 p-2 text-xs text-destructive-foreground animate-fadeIn"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold">Publishing failed</p>
            <p className="text-[11px] opacity-90">{publishError}</p>
          </div>
        </div>
      )}

      {/* Published Success Banner */}
      {publishedEventId && (
        <div
          data-testid="publish-success-banner"
          className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-3 text-xs text-emerald-300 animate-fadeIn"
        >
          <div className="flex items-center gap-2 font-bold text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Event Published Successfully! 🎉</span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-200/90 leading-relaxed">
            Your event has been created and is now live for attendees to discover and join.
          </p>
        </div>
      )}

      {/* Action Footer */}
      <div className="mt-4 border-t border-border/40 pt-3">
        {publishedEventId ? (
          /* One-click Open New Event Button */
          <button
            type="button"
            data-testid="open-new-event-btn"
            onClick={handleOpenPublishedEvent}
            className="flex w-full items-center justify-center gap-2 rounded-xl gradient-primary px-4 py-2.5 text-xs font-bold text-white shadow-md hover:opacity-95 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <span>Open New Event</span>
            <ExternalLink className="h-4 w-4" />
          </button>
        ) : (
          /* Confirm & Publish and Open in Creator actions */
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <button
              type="button"
              data-testid="confirm-publish-btn"
              disabled={isPublishing}
              onClick={handlePublish}
              className="flex w-full sm:flex-1 items-center justify-center gap-2 rounded-xl gradient-primary px-3 py-2.5 text-xs font-bold text-white shadow-md hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Publishing Event...</span>
                </>
              ) : (
                <>
                  <span>Confirm & Publish</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>

            <button
              type="button"
              data-testid="use-draft-in-creator-btn"
              disabled={isPublishing}
              onClick={handleUseInCreator}
              className="flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-muted/40 hover:bg-muted px-3 py-2.5 text-xs font-semibold text-foreground hover:text-primary transition-all disabled:opacity-50"
              title="Open full editor with this draft"
            >
              <span>Edit in Creator</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssistantDraftCard;
