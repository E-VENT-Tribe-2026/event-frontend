export type ParticipationStatus = 'none' | 'going' | 'removed';

export type OrganizerProfile = {
  full_name?: string;
  username?: string;
  avatar_url?: string;
};

export type AttendeeRow = {
  id: string;
  profilePhoto?: string;
  avatar?: string;
  name: string;
  email?: string;
  username?: string;
  isFriend?: boolean;
};

export async function readApiErrorMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { detail?: unknown };
  const d = body.detail;
  if (typeof d === 'string' && d.trim()) return d;
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    const msg = (d as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  if (Array.isArray(d) && d[0] && typeof (d[0] as { msg?: string }).msg === 'string') {
    return (d[0] as { msg: string }).msg;
  }
  if (res.status === 404) return 'Event not found';
  return `Something went wrong (HTTP ${res.status})`;
}

/** Chat is read-only once the event start is more than 48 hours in the past. */
export function isEventChatExpired(eventDate: string, eventTime?: string): boolean {
  const normalized = /[Zz]$\vert{}[+-]\d{2}:\d{2}$/.test(eventDate)
    ? eventDate
    : `${eventDate}T${eventTime || '00:00'}:00Z`;
  const ts = new Date(normalized).getTime();
  return !Number.isNaN(ts) && Date.now() - ts > 48 * 60 * 60 * 1000;
}

export function joinButtonText(opts: {
  isCancelledEvent: boolean;
  isUpdatingParticipation: boolean;
  participationLoading: boolean;
  isPastEvent: boolean;
  isEventOwner: boolean;
  hasJoined: boolean;
  isAtCapacity: boolean;
  isOrganizer: boolean;
  requiresApproval: boolean;
  requestStatus?: string;
  isFreeEvent: boolean;
  budget: number;
}): string {
  if (opts.isCancelledEvent) return 'Event Cancelled';
  if (opts.isUpdatingParticipation) return 'Please wait...';
  if (opts.participationLoading) return 'Checking attendance…';
  if (opts.isPastEvent) return 'Event Ended';
  if (opts.isEventOwner) return "You're hosting";
  if (opts.hasJoined) return 'Leave Event';
  if (opts.isAtCapacity) return 'Event Full';
  if (opts.isOrganizer) return "Organizers can't join";
  if (opts.requiresApproval) {
    if (opts.requestStatus === 'pending') return 'Request Pending...';
    if (opts.requestStatus === 'approved') return !opts.isFreeEvent ? 'Approved — Pay at Venue' : 'Approved — Join Now';
    if (opts.requestStatus === 'rejected') return 'Request Rejected';
    return 'Request to Join';
  }
  return !opts.isFreeEvent ? `Join — Pay €${opts.budget} at Venue` : 'Join Event';
}
