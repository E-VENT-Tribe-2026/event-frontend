import { useState } from 'react';
import { ArrowLeft, Lock, Trash2, Shield, Loader2 } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  personDisplayName,
  removeChatMessage,
  type AdminChatMessage,
  type AdminRemoveContentResponse,
} from '@/lib/adminApi';

interface AdminEventChatProps {
  eventId: string;
  eventTitle: string;
  /** The event's chat, from the panel's event details (GET /api/admin/events/{id}). */
  messages: AdminChatMessage[];
  /** A message was removed here; the parent keeps its copy of the chat in step. */
  onMessageRemoved: (messageId: string, removal: AdminRemoveContentResponse) => void;
  onBack: () => void;
  onErrorToast: (msg: string) => void;
  onSuccessToast: (msg: string) => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (!iso || isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminEventChat({
  eventId,
  eventTitle,
  messages,
  onMessageRemoved,
  onBack,
  onErrorToast,
  onSuccessToast,
}: AdminEventChatProps) {
  const [pending, setPending] = useState<AdminChatMessage | null>(null);
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    if (!pending || removing) return;
    setRemoving(true);
    try {
      const removal = await removeChatMessage(eventId, pending.id);
      onMessageRemoved(pending.id, removal);
      onSuccessToast('Message removed.');
      setPending(null);
    } catch (err) {
      onErrorToast(err instanceof Error ? err.message : 'Failed to remove the message.');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors"
        style={{ color: 'var(--adm-muted-fg)', background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {eventTitle}
      </button>

      <div
        className="flex items-center justify-between rounded-xl border px-4 py-3"
        style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: 'var(--adm-grad)' }}
          >
            <Shield className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold" style={{ color: 'var(--adm-fg)' }}>
              {eventTitle}
            </h2>
            <div className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
              Administrator view · read-only
            </div>
          </div>
        </div>
      </div>

      <div
        className="rounded-2xl border p-5 space-y-4 min-h-[360px] flex flex-col justify-between"
        style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
      >
        {messages.length === 0 ? (
          <p className="py-12 text-center text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
            No messages in this chat yet.
          </p>
        ) : (
          <ul className="space-y-4" aria-label="Event chat">
            {messages.map((m) => {
              if (m.is_system_message) {
                return (
                  <li key={m.id} className="text-center">
                    <span
                      className="inline-block rounded-full px-4 py-1.5 text-xs"
                      style={{ background: 'hsl(213 50% 16% / .6)', color: 'var(--adm-muted-fg)', border: '1px solid var(--adm-border)' }}
                    >
                      {m.content}
                    </span>
                  </li>
                );
              }
              const senderName = personDisplayName(m.sender) || 'Unknown user';
              return (
                <li key={m.id} className="space-y-1" data-removed={m.is_removed ? 'true' : undefined}>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold" style={{ color: 'var(--adm-fg)' }}>{senderName}</span>
                    {m.sender?.username && <span style={{ color: 'var(--adm-muted-fg)' }}>@{m.sender.username}</span>}
                  </div>

                  <div className="flex items-end gap-3">
                    <UserAvatar
                      src={m.sender?.avatar_url ?? undefined}
                      seed={m.sender?.id || senderName}
                      name={senderName}
                      size="sm"
                    />
                    <div
                      className="max-w-md rounded-2xl p-3.5 space-y-1"
                      style={{
                        background: m.is_removed ? 'hsl(0 84% 60% / .08)' : 'hsl(213 50% 18%)',
                        border: m.is_removed ? '1px dashed hsl(0 84% 60% / .45)' : '1px solid var(--adm-border)',
                      }}
                    >
                      <p
                        className="text-sm leading-relaxed"
                        style={{ color: m.is_removed ? 'var(--adm-muted-fg)' : 'var(--adm-fg)', textDecoration: m.is_removed ? 'line-through' : undefined }}
                      >
                        {m.content}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--adm-muted-fg)' }}>
                        {formatTime(m.created_at)}
                      </p>
                      {m.is_removed && (
                        <p className="text-[11px] font-semibold" style={{ color: 'var(--adm-danger-text)' }}>
                          Removed by an administrator
                          {m.removed_by ? ` (${personDisplayName(m.removed_by)})` : ''}
                          {m.removed_at ? ` on ${formatTime(m.removed_at)}` : ''}
                        </p>
                      )}
                    </div>

                    {!m.is_removed && (
                      <button
                        type="button"
                        onClick={() => setPending(m)}
                        aria-label={`Remove message by ${senderName}`}
                        className="inline-flex shrink-0 items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-90"
                        style={{ borderColor: 'hsl(0 84% 60% / .4)', background: 'hsl(0 84% 60% / .1)', color: 'hsl(0 84% 75%)' }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove message
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div
          className="mt-6 flex items-center justify-center gap-2 rounded-xl border py-3 text-xs font-medium"
          style={{ background: 'hsl(213 50% 13% / .8)', borderColor: 'var(--adm-border)', color: 'var(--adm-muted-fg)' }}
        >
          <Lock className="h-4 w-4" />
          <span>Read-only. Administrators cannot post messages in event chats.</span>
        </div>
      </div>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && !removing && setPending(null)}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">Remove this message?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              The message is marked as removed, not deleted. The chat shows it as removed by an administrator,
              and its sender is notified and receives a warning.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 justify-end">
            <AlertDialogCancel disabled={removing} className="rounded-lg text-xs mt-0">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              onClick={(e) => {
                e.preventDefault();
                void handleRemove();
              }}
              className="rounded-lg text-xs font-semibold text-white"
              style={{ background: 'var(--adm-danger)' }}
            >
              {removing ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove message'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
