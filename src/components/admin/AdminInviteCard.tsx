import { useState } from 'react';
import { Loader2, Mail, Copy, Check } from 'lucide-react';
import { sendSignupInvite } from '@/lib/adminApi';
import { sanitizeEmail } from '@/lib/sanitize';

interface AdminInviteCardProps {
  onErrorToast: (msg: string) => void;
  onSuccessToast?: (msg: string) => void;
}

export default function AdminInviteCard({ onErrorToast, onSuccessToast }: AdminInviteCardProps) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sanitizeEmail(email);
    if (!cleaned || !/\S+@\S+\.\S+/.test(cleaned)) {
      onErrorToast('Enter a valid email address.');
      return;
    }
    if (sending) return;
    setSending(true);
    setCopied(false);
    try {
      const result = await sendSignupInvite(cleaned);
      setEmail('');
      setLastCode(result.code?.trim() || null);
      onSuccessToast?.(result.message || `Invitation sent to ${result.email}.`);
    } catch (err) {
      setLastCode(null);
      onErrorToast(err instanceof Error ? err.message : 'Could not send invitation.');
    } finally {
      setSending(false);
    }
  };

  const copyCode = async () => {
    if (!lastCode) return;
    try {
      await navigator.clipboard.writeText(lastCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      onErrorToast('Could not copy the code.');
    }
  };

  return (
    <div
      className="rounded-2xl border p-4 space-y-3"
      style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'hsl(271 76% 53% / .15)', color: 'hsl(271 76% 53%)' }}
        >
          <Mail className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--adm-fg)' }}>
            Invite user
          </h3>
          <p className="mt-0.5 text-xs leading-snug" style={{ color: 'var(--adm-muted-fg)' }}>
            Send an invitation email with a code (ABCD-2345). It expires in 7 days.
          </p>
        </div>
      </div>

      <form onSubmit={handleSend} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="admin-invite-email" className="sr-only">
          Invite user
        </label>
        <input
          id="admin-invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          autoComplete="email"
          className="min-w-0 flex-1 rounded-[14px] border px-3 text-sm outline-none"
          style={{
            background: 'var(--adm-secondary, var(--adm-card))',
            borderColor: 'var(--adm-border)',
            color: 'var(--adm-fg)',
            height: 40,
          }}
        />
        <button
          type="submit"
          disabled={sending}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold text-white disabled:opacity-70"
          style={{ background: 'hsl(271 76% 53%)' }}
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
          {sending ? 'Sending…' : 'Send invitation'}
        </button>
      </form>

      {lastCode && (
        <div
          className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2"
          style={{ borderColor: 'var(--adm-border)' }}
        >
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--adm-muted-fg)' }}>
              Registration code
            </p>
            <p className="truncate font-mono text-sm tracking-wide" style={{ color: 'var(--adm-fg)' }}>
              {lastCode}
            </p>
          </div>
          <button
            type="button"
            onClick={copyCode}
            aria-label="Copy registration code"
            className="inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium"
            style={{ borderColor: 'var(--adm-border)', color: 'var(--adm-fg)' }}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
}
