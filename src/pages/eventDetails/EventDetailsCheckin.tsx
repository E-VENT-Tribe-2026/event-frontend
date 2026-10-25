import { useEffect, useRef, useState } from 'react';
import { Camera, Info, MapPinned, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { extractCheckinCode, isCheckinWindow } from '@/lib/checkin';
import type { EventCheckinSummary } from '@/lib/checkinsApi';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type EventDetailsCheckinProps = {
  eventStartMs: number;
  currentUserId: string;
  isEventOwner: boolean;
  hasJoined: boolean;
  summary: EventCheckinSummary;
  checkinBusy: boolean;
  error?: string;
  onSubmitCode: (value: string, via: 'code' | 'qr_content') => void | Promise<void>;
};

function personLabel(p: EventCheckinSummary['checkins'][number]): string {
  return p.full_name?.trim() || (p.username ? `@${p.username}` : 'Participant');
}

function formatWhen(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function EventDetailsCheckin({
  eventStartMs,
  currentUserId,
  isEventOwner,
  hasJoined,
  summary,
  checkinBusy,
  error,
  onSubmitCode,
}: EventDetailsCheckinProps) {
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanHint, setScanHint] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onSubmitRef = useRef(onSubmitCode);
  onSubmitRef.current = onSubmitCode;
  const inWindow = isCheckinWindow(eventStartMs);
  const qrValue = (summary.qr_content || summary.code || '').trim();
  const doorCode = (summary.code || '').trim();
  const countLabel = `${summary.checked_in_count} of ${summary.participant_count}`;
  const alreadyHere = summary.viewer_checked_in || summary.checkins.some((c) => c.user_id === currentUserId);
  const participantCheckinLocked = hasJoined && !isEventOwner && !alreadyHere && !inWindow;

  const stopScan = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  };

  useEffect(() => () => stopScan(), []);

  useEffect(() => {
    if (participantCheckinLocked) stopScan();
  }, [participantCheckinLocked]);

  useEffect(() => {
    if (!scanning || !videoRef.current) return;
    const video = videoRef.current;
    let cancelled = false;
    const Detector = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
    if (!Detector) {
      setScanHint('This browser cannot scan QR codes. Type the six-digit code instead.');
      stopScan();
      return;
    }
    const detector = new Detector({ formats: ['qr_code'] });
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        video.srcObject = stream;
        await video.play();
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const found = await detector.detect(video);
            const raw = found[0]?.rawValue;
            const parsed = raw ? extractCheckinCode(raw) : null;
            if (parsed) {
              setCode(parsed);
              stopScan();
              await onSubmitRef.current(parsed, 'qr_content');
              return;
            }
          } catch {
            /* keep scanning */
          }
          requestAnimationFrame(() => void tick());
        };
        requestAnimationFrame(() => void tick());
      } catch {
        if (!cancelled) {
          setScanHint('Camera permission was denied. Type the six-digit code instead.');
          stopScan();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scanning]);

  return (
    <div className="rounded-2xl glass-card space-y-3 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <MapPinned className="h-4 w-4 text-primary" />
        Door check-in
        {hasJoined && !isEventOwner && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Check-in opens 2 hours before the event"
                  className="inline-flex rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-[220px] text-xs">
                Check-in opens 2 hours before the event starts.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
          {countLabel} here
        </span>
      </h2>

      {isEventOwner && (qrValue || doorCode) && (
        <div className="space-y-2 rounded-xl bg-secondary/40 p-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Show this at the door
          </p>
          {qrValue && (
            <div className="mx-auto w-fit rounded-xl bg-white p-3" role="img" aria-label="Event check-in QR code">
              <QRCodeSVG value={qrValue} size={168} />
            </div>
          )}
          {doorCode && (
            <p className="font-mono text-2xl font-bold tracking-[0.35em] text-foreground" data-testid="checkin-code">
              {doorCode}
            </p>
          )}
        </div>
      )}

      {summary.checkins.length > 0 && (
        <ul className="space-y-1.5">
          {summary.checkins.map((c) => {
            const when = summary.include_times ? formatWhen(c.checked_in_at) : null;
            return (
              <li key={c.user_id} className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{personLabel(c)}</span>
                {when ? ` · ${when}` : ' checked in'}
              </li>
            );
          })}
        </ul>
      )}

      {hasJoined && alreadyHere && (
        <p className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">You're checked in.</p>
      )}

      {hasJoined && !alreadyHere && (
        <form
          className={`space-y-2 ${participantCheckinLocked ? 'pointer-events-none opacity-50' : ''}`}
          onSubmit={(e) => {
            e.preventDefault();
            if (participantCheckinLocked) return;
            const parsed = extractCheckinCode(code);
            if (!parsed) return;
            void onSubmitCode(parsed, 'code');
          }}
        >
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Six-digit code
          </label>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              aria-label="Check-in code"
              disabled={participantCheckinLocked}
              className="flex-1 rounded-xl border border-border/50 bg-secondary px-3 py-2 font-mono text-sm tracking-[0.3em] outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={participantCheckinLocked || checkinBusy || code.replace(/\D/g, '').length !== 6}
              className="rounded-xl gradient-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              Check in
            </button>
          </div>
          <button
            type="button"
            disabled={participantCheckinLocked}
            onClick={() => {
              setScanHint('');
              setScanning((v) => !v);
            }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border/60 py-2 text-xs font-semibold text-foreground disabled:cursor-not-allowed"
          >
            {scanning ? <QrCode className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
            {scanning ? 'Stop camera' : 'Scan QR code'}
          </button>
          {scanning && (
            <video ref={videoRef} className="h-40 w-full rounded-xl bg-black object-cover" muted playsInline />
          )}
          {scanHint && <p className="text-[11px] text-muted-foreground">{scanHint}</p>}
        </form>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
