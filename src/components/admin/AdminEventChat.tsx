import { useEffect, useState } from 'react';
import { ArrowLeft, Lock, Trash2, Shield } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';

interface AdminEventChatProps {
  eventId: string;
  eventTitle: string;
  onBack: () => void;
  onErrorToast: (msg: string) => void;
  onSuccessToast: (msg: string) => void;
}

interface ChatMessage {
  id: string;
  sender_name: string;
  sender_username: string;
  sender_avatar?: string;
  is_pro?: boolean;
  content: string;
  timestamp: string;
  is_system?: boolean;
}

export default function AdminEventChat({
  eventId,
  eventTitle,
  onBack,
  onErrorToast: _onErrorToast,
  onSuccessToast: _onSuccessToast,
}: AdminEventChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch real chat messages for this event
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // Replace this fetch call with your actual API endpoint to retrieve event messages
    fetch(`/api/admin/events/${eventId}/chat`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        const fetchedMessages = (data.messages ?? data.data ?? []) as ChatMessage[];
        setMessages(fetchedMessages);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setMessages([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const handleRemoveMessage = (msgId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
  };

  // If loading, show loader
  if (loading) {
    return (
      <div className="py-12 text-center text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
        Loading event chat...
      </div>
    );
  }

  // If there are no messages / chats, do not return anything
  if (!messages || messages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors"
        style={{ color: 'var(--adm-muted-fg)', background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {eventTitle}
      </button>

      {/* Header card */}
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
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
              <span>Administrator view · read-only</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Messages Container */}
      <div
        className="rounded-2xl border p-5 space-y-4 min-h-[360px] flex flex-col justify-between"
        style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
      >
        <div className="space-y-4">
          {messages.map((m) => {
            if (m.is_system) {
              return (
                <div key={m.id} className="text-center">
                  <span
                    className="inline-block rounded-full px-4 py-1.5 text-xs"
                    style={{ background: 'hsl(213 50% 16% / .6)', color: 'var(--adm-muted-fg)', border: '1px solid var(--adm-border)' }}
                  >
                    {m.content}
                  </span>
                </div>
              );
            }

            return (
              <div key={m.id} className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold" style={{ color: 'var(--adm-fg)' }}>
                    {m.sender_name}
                  </span>
                  <span style={{ color: 'var(--adm-muted-fg)' }}>@{m.sender_username}</span>
                </div>

                <div className="flex items-end gap-3">
                  <UserAvatar seed={m.sender_username} name={m.sender_name} size="sm" />
                  <div
                    className="max-w-md rounded-2xl p-3.5 space-y-1"
                    style={{ background: 'hsl(213 50% 18%)', borderColor: 'var(--adm-border)', border: '1px solid var(--adm-border)' }}
                  >
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--adm-fg)' }}>
                      {m.content}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--adm-muted-fg)' }}>
                      {m.timestamp}
                    </p>
                  </div>

                  {/* Admin moderation action */}
                  <button
                    type="button"
                    onClick={() => handleRemoveMessage(m.id)}
                    className="inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-90"
                    style={{
                      borderColor: 'hsl(0 84% 60% / .4)',
                      background: 'hsl(0 84% 60% / .1)',
                      color: 'hsl(0 84% 75%)',
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove message
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Persistent bottom read-only notice */}
        <div
          className="mt-6 flex items-center justify-center gap-2 rounded-xl border py-3 text-xs font-medium"
          style={{ background: 'hsl(213 50% 13% / .8)', borderColor: 'var(--adm-border)', color: 'var(--adm-muted-fg)' }}
        >
          <Lock className="h-4 w-4" />
          <span>Read-only. Administrators cannot post messages in event chats.</span>
        </div>
      </div>
    </div>
  );
}