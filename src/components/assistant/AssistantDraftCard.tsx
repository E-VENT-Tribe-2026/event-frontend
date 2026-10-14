import React, { useState } from 'react';
import { Sparkles, Calendar, MapPin, DollarSign, Users, ArrowRight, AlertTriangle, Check, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AssistantDraftEvent } from '@/lib/assistantApi';

interface AssistantDraftCardProps {
  draft: AssistantDraftEvent;
  validationIssues?: string[];
  onApplyDraft?: (draft: AssistantDraftEvent) => void;
}

export const AssistantDraftCard: React.FC<AssistantDraftCardProps> = ({
  draft,
  validationIssues = [],
  onApplyDraft,
}) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

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

    // Save to sessionStorage for CreateEventPage to pick up
    try {
      window.sessionStorage.setItem('event_assistant_draft_prefill', JSON.stringify(draft));
    } catch {
      // Storage full or unavailable
    }

    navigate('/create', { state: { draft } });
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
      className="relative overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-br from-card/95 via-card/85 to-primary/10 p-3.5 shadow-lg"
    >
      {/* Top Banner */}
      <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
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
      <div className="mt-2.5">
        <div className="flex items-center gap-2">
          {draft.category && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
              {draft.category}
            </span>
          )}
          <h4 className="truncate text-sm font-bold text-foreground">
            {draft.title || 'Untitled Draft Event'}
          </h4>
        </div>

        {draft.description && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
            {draft.description}
          </p>
        )}

        <div className="mt-2.5 space-y-1 text-xs text-muted-foreground">
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
          <div className="flex items-center gap-3 pt-0.5">
            <div className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <span className={`font-semibold ${isFree ? 'text-emerald-400' : 'text-foreground'}`}>
                {isFree ? 'Free' : `$${draft.cost}`}
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
      </div>

      {/* Validation Issues if any */}
      {validationIssues.length > 0 && (
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

      {/* Action Footer */}
      <div className="mt-3.5 border-t border-border/40 pt-2.5">
        <button
          type="button"
          onClick={handleUseInCreator}
          data-testid="use-draft-in-creator-btn"
          className="flex w-full items-center justify-center gap-2 rounded-lg gradient-primary px-3 py-2 text-xs font-bold text-white shadow-sm hover:opacity-95 transition-opacity"
        >
          <span>Open in Event Creator</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
