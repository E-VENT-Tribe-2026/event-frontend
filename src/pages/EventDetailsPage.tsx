import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getEvents, getCurrentUser, addJoinRequest, getJoinRequests, joinEvent, leaveEvent, getUsers, updateEvent, cancelEvent, type EventItem } from '@/lib/storage';
import { ArrowLeft, MapPin, Clock, Users, ShieldCheck, Pencil, LogOut, UserPlus, ExternalLink, UserMinus, Ban, CalendarPlus, MapPinned } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo, useEffect, useCallback } from 'react';
import AppToast from '@/components/AppToast';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';
import { getAuthToken, setAuthToken } from '@/lib/auth';
import { mapApiEventToItem } from '@/lib/mapApiEvent';
import { UserAvatar } from '@/components/UserAvatar';
import { getApiUrl } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/apiUrls';
import { fetchAuthUserFromToken, sameAuthUserId } from '@/lib/authProfile';
import { formatPageTitle } from '@/lib/documentTitle';
import { openInGoogleMapsUrl } from '@/lib/mapsLinks';
import EventLocationMap from '@/components/EventLocationMap';
import { isEventUpcoming, isEventCancelled, eventStartMs } from '@/lib/eventTime';
import { getCategoryBanner } from '@/lib/categoryBanners';
import { invalidatePrefix } from '@/lib/queryCache';
import { formatUserIdentity } from '@/lib/userIdentity';
import InvitedByBanner from '@/components/InvitedByBanner';
import FriendsAttendingSection from '@/components/FriendsAttendingSection';
import { fetchFriendsAttending, fetchParticipantCount, fetchParticipantList, type ParticipantRow } from '@/lib/eventAttendeesApi';
import InviteFriendsDialog from '@/components/InviteFriendsDialog';
import type { EventInvitationSummary } from '@/lib/invitationsApi';
import FriendsGoing from '@/components/FriendsGoing';
import { fetchAllFriends, friendsGoingToEvent } from '@/lib/eventSocial';
import { type UserSummary } from '@/lib/friendsApi';
import { addCheckin, CHECKINS_CHANGED_EVENT, isCheckedIn, isCheckinWindow, listCheckins, parseTicketQr, type CheckinRecord } from '@/lib/checkin';
import { postEventChatMessage } from '@/lib/chatPayload';
import { downloadIcs, googleCalendarUrl } from '@/lib/calendar';

type ParticipationStatus = 'none' | 'going' | 'removed';

async function readApiErrorMessage(res: Response): Promise<string> {
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

export default function EventDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [events, setEventsState] = useState(getEvents());
  const [apiEvent, setApiEvent] = useState<EventItem | null>(null);
  const [apiEventStatus, setApiEventStatus] = useState<string | null>(null);
  const [apiNotFound, setApiNotFound] = useState(false);
  const [loadingApi, setLoadingApi] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [showVenuePaymentModal, setShowVenuePaymentModal] = useState(false);
  const [apiParticipants, setApiParticipants] = useState<ParticipantRow[]>([]);
  // The user's friends who attend, for a user who has not joined (backend #187).
  const [attendingFriends, setAttendingFriends] = useState<ParticipantRow[]>([]);
  const [isUpdatingParticipation, setIsUpdatingParticipation] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState<number | null>(null);
  const [myParticipationStatus, setMyParticipationStatus] = useState<ParticipationStatus | null>(null);
  const [participationKnown, setParticipationKnown] = useState(false);
  const [organizerProfile, setOrganizerProfile] = useState<{ full_name?: string; username?: string; avatar_url?: string } | null>(null);
  const [removingParticipantId, setRemovingParticipantId] = useState<string | null>(null);
  const [isCancellingEvent, setIsCancellingEvent] = useState(false);
  const [backendAuthUserId, setBackendAuthUserId] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<EventInvitationSummary | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [friendSummaries, setFriendSummaries] = useState<UserSummary[]>([]);
  const [checkins, setCheckins] = useState<CheckinRecord[]>([]);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [ticketScan, setTicketScan] = useState('');
  const user = getCurrentUser();
  const allUsers = getUsers();

  const localEvent = useMemo(() => events.find((e) => e.id === id) ?? null, [events, id]);
  const routeEvent = useMemo(() => {
    const state = location.state as { event?: EventItem } | null;
    if (!state?.event || !id) return null;
    return state.event.id === id ? state.event : null;
  }, [location.state, id]);
  const event = apiNotFound ? null : (apiEvent ?? routeEvent ?? localEvent ?? null);
  const useApiParticipation = apiEvent !== null;

  const getApiToken = async (): Promise<string | null> => {
    const existing = getAuthToken();
    if (existing) return existing;
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) {
      setAuthToken(token);
      return token;
    }
    return null;
  };

  const tryJoinViaApi = async (): Promise<boolean> => {
    if (!event) return false;
    const token = await getApiToken();
    if (!token) {
      setToast({ show: true, message: 'Session missing. Please sign in again.', type: 'error' });
      return false;
    }
    try {
      const res = await fetch(getApiUrl(`/api/participants/${event.id}/join`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (!res.ok) {
        if (res.status === 404) setApiNotFound(true);
        setToast({ show: true, message: await readApiErrorMessage(res), type: 'error' });
        return false;
      }
      await syncParticipationFromBackend({ fresh: true });
      setInvitation(null); // joining removes the invitation
      setToast({ show: true, message: 'Successfully joined!', type: 'success' });
      invalidatePrefix(`/api/participants/${event.id}`);
      invalidatePrefix('/api/events?');
      invalidatePrefix('/api/participants/my/events');
      return true;
    } catch {
      setToast({ show: true, message: 'Server unavailable. Try again.', type: 'error' });
      return false;
    }
  };

  const syncParticipationFromBackend = useCallback(async (opts?: { fresh?: boolean }) => {
    if (!id || !apiEvent) {
      setAttendeeCount(null);
      setMyParticipationStatus(null);
      setParticipationKnown(false);
      setApiParticipants([]);
      setAttendingFriends([]);
      return;
    }
    // After a join, leave or removal the cached attendee data is stale: read it fresh.
    if (opts?.fresh) invalidatePrefix(`/api/participants/${id}`);

    const token = await getApiToken();

    let authUserId: string | null = backendAuthUserId;
    if (token && !authUserId) {
      const me = await fetchAuthUserFromToken(token);
      authUserId = me?.id ?? null;
    }
    if (!authUserId) authUserId = user?.id ?? null;

    if (!authUserId) {
      setMyParticipationStatus('none');
      setParticipationKnown(true);
      setApiParticipants([]);
      setAttendingFriends([]);
      return;
    }

    // Is the user going? (never cached: membership must be exact)
    let status: ParticipationStatus = 'none';
    let statusKnown = false;
    if (token) {
      try {
        const sRes = await fetch(getApiUrl(`/api/participants/${id}/my-status`), {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (sRes.ok) {
          const data = await sRes.json().catch(() => ({}));
          const st = typeof data?.status === 'string' ? data.status : '';
          if (st === 'going') status = 'going';
          else if (st === 'removed') status = 'removed';
          statusKnown = true;
        }
      } catch {
        // fall through: try to infer it from the attendee list below
      }
    }

    const isOwner =
      sameAuthUserId(apiEvent.organizerId, authUserId) || sameAuthUserId(apiEvent.organizerId, user?.id);

    // The full list is only for the organizer and participants; others would get a 403.
    let list: ParticipantRow[] = [];
    if (isOwner || status === 'going' || !statusKnown) {
      try {
        list = await fetchParticipantList(id, token);
        if (!statusKnown) {
          const inList = list.some(
            (p) => sameAuthUserId(p.user_id, authUserId) && String(p.status || 'going').toLowerCase() !== 'removed',
          );
          status = inList ? 'going' : 'none';
        }
      } catch {
        // not allowed to see the list (or a temporary failure): the count and friends below still show
      }
    }
    setMyParticipationStatus(status);

    // The number of attendees and the user's attending friends are open to every signed-in user.
    const [countRes, friendsRes] = await Promise.allSettled([
      fetchParticipantCount(id, token),
      fetchFriendsAttending(id, token),
    ]);
    if (countRes.status === 'fulfilled') setAttendeeCount(countRes.value);
    else if (list.length > 0) setAttendeeCount(list.length);
    // Otherwise keep the previous count if the backend temporarily fails.
    setAttendingFriends(friendsRes.status === 'fulfilled' ? friendsRes.value : []);

    setApiParticipants(isOwner || status === 'going' ? list : []);
    setParticipationKnown(true);
  }, [id, apiEvent, user?.id, backendAuthUserId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getApiToken();
      if (!token) {
        if (!cancelled) setBackendAuthUserId(null);
        return;
      }
      const me = await fetchAuthUserFromToken(token);
      if (!cancelled) setBackendAuthUserId(me?.id ?? null);
    })();
    return () => { cancelled = true; };
  }, [id, user?.id]);

  // Fetch event details and organizer profile referenced by created_by GUID with proper auth headers
  useEffect(() => {
    if (!id) {
      setLoadingApi(false);
      setApiEvent(null);
      setApiNotFound(false);
      return;
    }
    let cancelled = false;
    setLoadingApi(true);
    setApiNotFound(false);

    (async () => {
      const token = await getApiToken();
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      try {
        const res = await fetch(getApiUrl(`/api/events/${id}`), { headers });
        if (!res.ok) {
          if (res.status === 404) {
            if (!cancelled) {
              setApiNotFound(true);
              setApiEvent(null);
              setApiEventStatus(null);
            }
            return;
          }
          throw new Error();
        }
        const data = await res.json();
        if (cancelled) return;

        const mapped = mapApiEventToItem(data);
        setApiEvent(mapped);
        setApiNotFound(false);
        setApiEventStatus(typeof data?.status === 'string' ? data.status : null);
        setInvitation((data?.invitation as EventInvitationSummary | null | undefined) ?? null);
        setParticipationKnown(false);

        const creatorId = data.created_by || data.organizer_id || mapped.organizerId;
        if (creatorId) {
          try {
            const profRes = await fetch(getApiUrl(`/api/profile/${creatorId}`), { headers });
            if (profRes.ok) {
              const profData = await profRes.json().catch(() => null);
              const prof = profData?.data || profData?.profile || profData;
              if (prof && !cancelled) {
                setOrganizerProfile({
                  full_name: prof.full_name || prof.name || prof.username,
                  username: prof.username,
                  avatar_url: prof.avatar_url,
                });
              }
            }
          } catch {
            // ignore profile fetch failure
          }
        }
      } catch {
        if (!cancelled) {
          setApiEvent(null);
          setApiEventStatus(null);
        }
      } finally {
        if (!cancelled) setLoadingApi(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!useApiParticipation) {
      setAttendeeCount(null);
      setMyParticipationStatus(null);
      setParticipationKnown(true);
      setApiParticipants([]);
      return;
    }
    setParticipationKnown(false);
    syncParticipationFromBackend();
  }, [useApiParticipation, syncParticipationFromBackend]);

  const isOrganizer = user?.role === 'organizer';
  const isEventOwner = Boolean(
    event?.organizerId &&
      (sameAuthUserId(event.organizerId, backendAuthUserId) || sameAuthUserId(event.organizerId, user?.id)),
  );

  const participantIds = useMemo(() => {
    if (useApiParticipation) return apiParticipants.map((p) => p.user_id);
    return event?.participants ?? [];
  }, [useApiParticipation, apiParticipants, event?.participants]);

  const friendsGoing = useMemo(
    () => friendsGoingToEvent(friendSummaries, participantIds),
    [friendSummaries, participantIds],
  );

  useEffect(() => {
    let cancelled = false;
    void fetchAllFriends().then((list) => {
      if (!cancelled) setFriendSummaries(list);
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!id) {
      setCheckins([]);
      return;
    }
    const refresh = () => setCheckins(listCheckins(id));
    refresh();
    const onChange = (event: Event) => {
      const eventId = (event as CustomEvent<{ eventId?: string }>).detail?.eventId;
      if (!eventId || eventId === id) refresh();
    };
    window.addEventListener(CHECKINS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CHECKINS_CHANGED_EVENT, onChange);
  }, [id]);

  const attendeeDisplayCount =
    useApiParticipation && attendeeCount !== null ? attendeeCount : participantIds.length;

  const hasJoined = Boolean(
    user &&
      event &&
      (useApiParticipation
        ? participationKnown && myParticipationStatus === 'going'
        : event.participants.includes(user.id)),
  );

  const canViewFullAttendeeList = Boolean(
    event &&
      (!useApiParticipation
        ? isEventOwner || Boolean(user && event.participants.includes(user.id))
        : (isEventOwner || (participationKnown && hasJoined))),
  );

  const wasRemovedFromEvent = Boolean(
    useApiParticipation && user && participationKnown && myParticipationStatus === 'removed',
  );
  const isCancelledEvent =
    isEventCancelled(event) ||
    isEventCancelled(apiEvent) ||
    String(apiEventStatus || '').toLowerCase() === 'cancelled' ||
    String(apiEventStatus || '').toLowerCase() === 'canceled';
  const canAccessEventChat = Boolean(user && (isEventOwner || hasJoined));

  const existingRequest = user && event ? getJoinRequests().find(r => r.eventId === event.id && r.userId === user.id) : null;

  const participantUsers = useMemo(() => {
    if (!event || !canViewFullAttendeeList) {
      return [] as Array<{ id: string; profilePhoto?: string; avatar?: string; name: string; email?: string; username?: string }>;
    }
    if (useApiParticipation && apiParticipants.length > 0) {
      return apiParticipants
        .filter((p) => p?.user_id)
        .slice(0, 6)
        .map((p) => ({
          id: p.user_id,
          profilePhoto: p.profiles?.avatar_url,
          avatar: p.profiles?.avatar_url,
          name: p.profiles?.full_name || 'Participant',
          username: p.profiles?.username,
        
        }
      ));
    }

    return event.participants
      .map((pId) => {
        const u = allUsers.find((x) => x.id === pId);
        if (!u) return null;
        return { id: u.id, profilePhoto: u.profilePhoto, avatar: u.avatar, name: u.name, email: u.email, username: u.username };
      })
      .filter(Boolean)
      .slice(0, 6) as Array<{ id: string; profilePhoto?: string; avatar?: string; name: string; email?: string; username?: string }>;
  }, [event, allUsers, apiParticipants, canViewFullAttendeeList, useApiParticipation]);

  const fullAttendeeRows = useMemo(() => {
    type AttendeeRow = { id: string; profilePhoto?: string; avatar?: string; name: string; email?: string; username?: string; isFriend?: boolean };
    if (!event || !canViewFullAttendeeList) {
      return [] as AttendeeRow[];
    }
    if (useApiParticipation && apiParticipants.length > 0) {
      return apiParticipants
        .filter((p) => p?.user_id)
        .map((p): AttendeeRow => ({
          id: p.user_id,
          profilePhoto: p.profiles?.avatar_url || p.user?.avatar_url || undefined,
          avatar: p.profiles?.avatar_url || p.user?.avatar_url || undefined,
          name: p.profiles?.full_name || p.user?.full_name || p.user?.display_name || 'Participant',
          // Only a real username: an account without one shows its full name alone.
          username: p.user?.username || p.profiles?.username || undefined,
          isFriend: Boolean(p.is_friend),
        }));
    }
    return event.participants
      .map((pId) => {
        const u = allUsers.find((x) => x.id === pId);
        if (!u) return null;
        return { id: u.id, profilePhoto: u.profilePhoto, avatar: u.avatar, name: u.name, email: u.email, username: u.username };
      })
      .filter(Boolean) as AttendeeRow[];
  }, [event, allUsers, apiParticipants, canViewFullAttendeeList, useApiParticipation]);

  const recordCheckin = useCallback(async (userId: string, name: string, ticketId?: string) => {
    if (!event) return;
    addCheckin(event.id, { userId, name, ticketId });
    await postEventChatMessage(event.id, { v: 1, type: 'checkin', text: `${name} is here` });
  }, [event]);

  useEffect(() => {
    if (loadingApi && !localEvent) return;
    const ev = apiEvent ?? localEvent ?? null;
    if (!ev?.title?.trim()) {
      if (!loadingApi && !ev) document.title = formatPageTitle('Event not found');
      return;
    }
    document.title = formatPageTitle(ev.title);
  }, [loadingApi, localEvent, routeEvent, apiEvent]);

  if (loadingApi && !localEvent) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Loading…</div>;
  }
  if (!event) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Event not found</div>;
  }

  const isEventPassed = !isEventUpcoming(event);
  const isPastEvent = !isCancelledEvent && isEventPassed;
  const isUpcomingEvent = !isCancelledEvent && isEventUpcoming(event);
  const canInviteFriends = Boolean(user && useApiParticipation && isUpcomingEvent && (isEventOwner || hasJoined));
  const isChatExpired = isEventPassed && (() => {
    const normalized = /[Zz]$\vert{}[+-]\d{2}:\d{2}$/.test(event.date) ? event.date : `${event.date}T${event.time || '00:00'}:00Z`;
    const ts = new Date(normalized).getTime();
    return !Number.isNaN(ts) && Date.now() - ts > 48 * 60 * 60 * 1000;
  })();

  if (wasRemovedFromEvent) {
    return (
      <div className="min-h-screen bg-background pb-28">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-lg">
          <button type="button" onClick={() => navigate(-1)} className="rounded-full glass-card p-2.5" aria-label="Back">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Event</h1>
        </header>
        <div className="mx-auto max-w-lg space-y-4 px-4 pt-8">
          <div className="rounded-2xl glass-card p-6 space-y-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15">
              <UserMinus className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">You no longer have access</h2>
            <p className="text-sm text-muted-foreground">
              The organizer removed you from <span className="font-medium text-foreground">{event.title}</span>. You
              can't rejoin this event from the app.
            </p>
            <button
              type="button"
              onClick={() => navigate('/home')}
              className="mt-2 w-full rounded-xl gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow"
            >
              Browse events
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  const participationLoading = useApiParticipation && Boolean(user) && !participationKnown && !isEventOwner;

  const handleVenuePaymentConfirm = async () => {
    setShowVenuePaymentModal(false);
    if (!event || !user) return;
    if (isPastEvent) {
      setToast({ show: true, message: 'This event has already ended.', type: 'error' });
      return;
    }
    setIsUpdatingParticipation(true);
    if (useApiParticipation) {
      await tryJoinViaApi();
    } else {
      joinEvent(event.id, user.id);
      setEventsState(getEvents());
      setToast({ show: true, message: 'Successfully joined!', type: 'success' });
    }
    setIsUpdatingParticipation(false);
  };

  const handleJoinOrRequest = async () => {
    if (!user) { navigate('/login'); return; }
    if (!event) return;
    if (isPastEvent) {
      setToast({ show: true, message: 'You cannot join or leave a past event.', type: 'error' });
      return;
    }
    if (isAtCapacity) {
      setToast({ show: true, message: 'This event has reached its maximum capacity.', type: 'error' });
      return;
    }
    if (hasJoined) {
      if (isUpdatingParticipation) return;
      setIsUpdatingParticipation(true);
      if (useApiParticipation) {
        const token = await getApiToken();
        if (!token) {
          setToast({ show: true, message: 'Session missing. Please sign in again.', type: 'error' });
          setIsUpdatingParticipation(false);
          return;
        }
        try {
          const res = await fetch(getApiUrl(`/api/participants/${event.id}/leave`), {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          });
          if (!res.ok) {
            setToast({ show: true, message: await readApiErrorMessage(res), type: 'error' });
            setIsUpdatingParticipation(false);
            return;
          }
          await syncParticipationFromBackend({ fresh: true });
          leaveEvent(event.id, user.id);
          setEventsState(getEvents());
          setToast({ show: true, message: 'You left the event.', type: 'success' });
          invalidatePrefix(`/api/participants/${event.id}`);
          invalidatePrefix('/api/events?');
          invalidatePrefix('/api/participants/my/events');
        } catch {
          setToast({ show: true, message: 'Server unavailable. Try again.', type: 'error' });
        } finally {
          setIsUpdatingParticipation(false);
        }
        return;
      }
      leaveEvent(event.id, user.id);
      setEventsState(getEvents());
      setToast({ show: true, message: 'You left the event.', type: 'success' });
      invalidatePrefix(`/api/participants/${event.id}`);
      invalidatePrefix('/api/events?');
      invalidatePrefix('/api/participants/my/events');
      setIsUpdatingParticipation(false);
      return;
    }
    if (isEventOwner) {
      setToast({ show: true, message: 'You are hosting this event.', type: 'error' });
      return;
    }
    if (isOrganizer) {
      setToast({ show: true, message: 'Organizers cannot join events', type: 'error' });
      return;
    }
    if (isUpdatingParticipation) return;
    setIsUpdatingParticipation(true);

    if (event.requiresApproval) {
      if (existingRequest) {
        if (existingRequest.status === 'approved') {
          if (event.budget > 0) {
            setIsUpdatingParticipation(false);
            setShowVenuePaymentModal(true);
            return;
          } else if (useApiParticipation) {
            await tryJoinViaApi();
          } else {
            joinEvent(event.id, user.id);
            setEventsState(getEvents());
            setToast({ show: true, message: 'Successfully joined!', type: 'success' });
          }
          setIsUpdatingParticipation(false);
          return;
        }
        setToast({ show: true, message: `Request already ${existingRequest.status}`, type: 'error' });
        setIsUpdatingParticipation(false);
        return;
      }
      addJoinRequest({
        id: crypto.randomUUID(),
        eventId: event.id,
        userId: user.id,
        userName: user.name,
        userAvatar: user.profilePhoto || user.avatar,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      setToast({ show: true, message: 'Join request sent! Waiting for organizer approval.', type: 'success' });
      setIsUpdatingParticipation(false);
    } else {
      if (event.budget > 0) {
        setIsUpdatingParticipation(false);
        setShowVenuePaymentModal(true);
        return;
      } else {
        if (useApiParticipation) {
          await tryJoinViaApi();
          setIsUpdatingParticipation(false);
          return;
        }
        joinEvent(event.id, user.id);
        setEventsState(getEvents());
        setToast({ show: true, message: 'Successfully joined!', type: 'success' });
        setIsUpdatingParticipation(false);
      }
    }
  };

  const handleRemoveAttendee = async (participantId: string) => {
    if (!isEventOwner || !user || String(participantId) === String(user.id)) return;
    if (isPastEvent || isCancelledEvent) return;
    if (!window.confirm('Remove this person from the event? They will lose access.')) return;

    if (useApiParticipation) {
      setRemovingParticipantId(participantId);
      try {
        const token = await getApiToken();
        if (!token) {
          setToast({ show: true, message: 'Session missing. Please sign in again.', type: 'error' });
          return;
        }
        const res = await fetch(getApiUrl(`/api/participants/${event.id}/participants/${participantId}`), {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!res.ok) {
          setToast({ show: true, message: await readApiErrorMessage(res), type: 'error' });
          return;
        }
        await syncParticipationFromBackend({ fresh: true });
        setToast({ show: true, message: 'Attendee removed.', type: 'success' });
        invalidatePrefix(`/api/participants/${event.id}`);
      } catch {
        setToast({ show: true, message: 'Could not remove attendee. Try again.', type: 'error' });
      } finally {
        setRemovingParticipantId(null);
      }
      return;
    }

    const next = event.participants.filter((x) => String(x) !== String(participantId));
    updateEvent(event.id, { participants: next });
    setEventsState(getEvents());
    setToast({ show: true, message: 'Attendee removed.', type: 'success' });
    invalidatePrefix(`/api/participants/${event.id}`);
  };

  const handleCancelEvent = async () => {
    if (!isEventOwner || !event || isEventPassed || isCancelledEvent) return;
    if (!window.confirm(`Are you sure you want to cancel "${event.title}"? A cancellation cannot be undone.`)) return;
    setIsCancellingEvent(true);
    try {
      if (useApiParticipation) {
        const token = await getApiToken();
        if (!token) {
          setToast({ show: true, message: 'Sign in to cancel this event.', type: 'error' });
          return;
        }
        const res = await fetch(getApiUrl(`${API_ENDPOINTS.EVENTS}/${event.id}/cancel`), {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!res.ok) {
          if (res.status === 404 || res.status === 405) {
            const fallbackRes = await fetch(getApiUrl(`${API_ENDPOINTS.EVENTS}/${event.id}`), {
              method: 'PUT',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({ status: 'cancelled' }),
            });
            if (!fallbackRes.ok) {
              setToast({ show: true, message: await readApiErrorMessage(fallbackRes), type: 'error' });
              return;
            }
          } else {
            setToast({ show: true, message: await readApiErrorMessage(res), type: 'error' });
            return;
          }
        }
      }
      cancelEvent(event.id);
      setEventsState(getEvents());
      setApiEventStatus('cancelled');
      setApiEvent((prev) => (prev ? { ...prev, status: 'cancelled', isCancelled: true } : null));
      setToast({ show: true, message: 'Event has been cancelled.', type: 'success' });
      invalidatePrefix('/api/events?');
      invalidatePrefix(`/api/events/${event.id}`);
      invalidatePrefix(`/api/participants/${event.id}`);
      invalidatePrefix('/api/events/my-events');
      invalidatePrefix('/api/participants/my/events');
    } catch {
      setToast({ show: true, message: 'Could not cancel the event.', type: 'error' });
    } finally {
      setIsCancellingEvent(false);
    }
  };

  const isFreeEvent = !(Number(event.budget) > 0);
  const isAtCapacity = Boolean(
    event.participantsLimit > 0 &&
      attendeeDisplayCount >= event.participantsLimit &&
      !hasJoined &&
      !isEventOwner,
  );

  const getJoinButtonText = () => {
    if (isCancelledEvent) return 'Event Cancelled';
    if (isUpdatingParticipation) return 'Please wait...';
    if (participationLoading) return 'Checking attendance…';
    if (isPastEvent) return 'Event Ended';
    if (isEventOwner) return "You're hosting";
    if (hasJoined) return 'Leave Event';
    if (isAtCapacity) return 'Event Full';
    if (isOrganizer) return "Organizers can't join";
    if (event.requiresApproval) {
      if (existingRequest?.status === 'pending') return 'Request Pending...';
      if (existingRequest?.status === 'approved') return !isFreeEvent ? 'Approved — Pay at Venue' : 'Approved — Join Now';
      if (existingRequest?.status === 'rejected') return 'Request Rejected';
      return 'Request to Join';
    }
    return !isFreeEvent ? `Join — Pay €${event.budget} at Venue` : 'Join Event';
  };

  const showSplitJoinLeave =
    !event.requiresApproval && isFreeEvent && !isEventOwner && !isOrganizer && !isPastEvent && !isCancelledEvent;

  // Resolved organizer identity combining profile lookup and event data
  const resolvedOrganizerName = formatUserIdentity({
    username: organizerProfile?.username || event.organizerUsername,
    fullName: organizerProfile?.full_name || (event.organizer !== 'Organizer' ? event.organizer : '') || event.organizerFullName || 'Organizer',
  });

  const resolvedOrganizerAvatar = organizerProfile?.avatar_url || event.organizerAvatar;

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />

      {/* Banner */}
      <div className="relative h-60">
        <img src={event.image || getCategoryBanner(event.category)} alt={event.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 rounded-full glass-card p-2.5">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
          {isCancelledEvent && (
            <div className="flex items-center gap-1 rounded-full bg-destructive/90 px-3 py-1 text-xs font-semibold text-destructive-foreground backdrop-blur-sm shadow-md">
              <Ban className="h-3.5 w-3.5" /> Cancelled
            </div>
          )}
          {event.requiresApproval && !isCancelledEvent && (
            <div className="flex items-center gap-1 rounded-full bg-accent/90 px-3 py-1 text-xs font-semibold text-accent-foreground backdrop-blur-sm">
              <ShieldCheck className="h-3 w-3" /> Approval Required
            </div>
          )}
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg px-4 -mt-10 relative z-10 space-y-6">
        <InvitedByBanner invitation={invitation} />
        <div className="rounded-2xl glass-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{event.title}</h1>
              {isCancelledEvent && (
                <span
                  data-testid="cancelled-badge"
                  className="rounded-full bg-destructive/15 text-destructive border border-destructive/30 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide"
                >
                  Cancelled
                </span>
              )}
            </div>
            <span className="shrink-0 rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary">{event.category}</span>
          </div>

          <div className="flex items-center gap-3">
            <UserAvatar
              src={resolvedOrganizerAvatar}
              seed={event.organizerId || event.id}
              name={resolvedOrganizerName}
              size="md"
              className="h-10 w-10 ring-2 ring-primary/30"
            />
            <div>
              <p className="text-sm font-medium text-foreground" data-testid="organizer-full-name">
                {organizerProfile?.full_name || event.organizerFullName || (event.organizer !== 'Organizer' ? event.organizer : '') || 'Organizer'}
              </p>
              {(organizerProfile?.username || event.organizerUsername) ? (
                <p className="text-xs text-muted-foreground" data-testid="organizer-username">
                  @{(organizerProfile?.username || event.organizerUsername || '').replace(/^@/, '')}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">Organizer</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4 text-primary" />{event.date} · {event.time}</div>
            <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4 text-accent" /><span className="truncate">{event.location}</span></div>
            <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4 text-primary" />{attendeeDisplayCount}/{event.participantsLimit}</div>
            <div className="flex items-center gap-2 text-foreground font-semibold">
              {isFreeEvent ? 'Free' : `€${event.budget} at venue`}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={googleCalendarUrl(event)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/80"
            >
              <CalendarPlus className="h-3.5 w-3.5 text-primary" />
              Google Calendar
            </a>
            <button
              type="button"
              onClick={() => downloadIcs(event)}
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/80"
            >
              <CalendarPlus className="h-3.5 w-3.5 text-primary" />
              Download .ics
            </button>
          </div>

          <FriendsGoing friends={friendsGoing} />

          <div className="space-y-1">
            {canViewFullAttendeeList ? (
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {participantUsers.map((p) => (
                    <UserAvatar
                      key={p.id}
                      src={p.profilePhoto}
                      srcSecondary={p.avatar}
                      seed={p.id}
                      name={p.name}
                      email={p.email}
                      size="sm"
                      className="border-2 border-card"
                    />
                  ))}
                  {attendeeDisplayCount > 6 && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-secondary text-xs text-muted-foreground">
                      +{attendeeDisplayCount - 6}
                    </div>
                  )}
                </div>
                {attendeeDisplayCount > 0 && (
                  <p className="text-xs text-muted-foreground">{attendeeDisplayCount} attending</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{attendeeDisplayCount}</span>{' '}
                {attendeeDisplayCount === 1 ? 'person is' : 'people are'} attending.
                {user ? ' Join the event to see who is going.' : ' Sign in and join to see who is going.'}
              </p>
            )}
          </div>
        </div>

        {/* Full attendee list */}
        <div className="rounded-2xl glass-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Users className="h-4 w-4 text-primary" />
              Attendees
            </h2>
            {canInviteFriends && (
              <button
                type="button"
                onClick={() => setShowInviteDialog(true)}
                className="inline-flex items-center gap-1 rounded-full gradient-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-glow"
              >
                <UserPlus className="h-3.5 w-3.5" /> Invite friends
              </button>
            )}
          </div>
          {canViewFullAttendeeList ? (
            (!participationKnown || (useApiParticipation && apiParticipants.length === 0 && !participationKnown)) && useApiParticipation ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl bg-secondary/40 px-3 py-2.5">
                    <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-secondary" />
                    <div className="h-3 w-32 animate-pulse rounded bg-secondary" />
                  </div>
                ))}
              </div>
            ) : fullAttendeeRows.length === 0 ? (
              <p className="text-xs text-muted-foreground">No attendees yet.</p>
            ) : (
              <ul className="space-y-2">
                {fullAttendeeRows.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-secondary/40 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <UserAvatar
                        src={row.profilePhoto}
                        srcSecondary={row.avatar}
                        seed={row.id}
                        name={row.name}
                        email={row.email}
                        size="sm"
                        className="shrink-0 border border-border/50"
                      />
                      <span className="truncate text-sm font-medium text-foreground">
                        {formatUserIdentity({ fullName: row.name })}
                        {row.username && (
                          <p className="text-sm text-muted-foreground" data-testid="profile-username">@{row.username}</p>
                        )}
                      </span>
                      {row.isFriend && (
                        <span
                          data-testid="friend-label"
                          className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary"
                        >
                          Friend
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                    {isEventOwner && !isCancelledEvent && (
                      <button
                        type="button"
                        disabled={checkinBusy || isCheckedIn(event.id, row.id)}
                        onClick={() => void recordCheckin(row.id, row.name)}
                        className="inline-flex items-center gap-1 rounded-lg border border-primary/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <MapPinned className="h-3 w-3" />
                        {isCheckedIn(event.id, row.id) ? 'Here' : 'Mark here'}
                      </button>
                    )}
                    {isEventOwner && user && String(row.id) !== String(user.id) && !isPastEvent && !isCancelledEvent && (
                      <button
                        type="button"
                        disabled={removingParticipantId === row.id}
                        onClick={() => void handleRemoveAttendee(row.id)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-destructive/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <UserMinus className="h-3 w-3" />
                        {removingParticipantId === row.id ? '…' : 'Remove'}
                      </button>
                    )}
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : attendingFriends.length > 0 ? (
            <FriendsAttendingSection
              friends={attendingFriends}
              othersCount={Math.max(0, attendeeDisplayCount - attendingFriends.length)}
            />
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              For privacy, only the count is shown here:{' '}
              <span className="font-semibold text-foreground">{attendeeDisplayCount}</span>{' '}
              {attendeeDisplayCount === 1 ? 'person is' : 'people are'} going.
            </p>
          )}
        </div>

        {canInviteFriends && (
          <InviteFriendsDialog open={showInviteDialog} onOpenChange={setShowInviteDialog} eventId={event.id} />
        )}

        {!isCancelledEvent && user && (isEventOwner || hasJoined) && (
          <div className="rounded-2xl glass-card p-4 space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <MapPinned className="h-4 w-4 text-primary" />
              Door check-in
              <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                {checkins.length} here
              </span>
            </h2>
            {checkins.length > 0 && (
              <ul className="space-y-1.5">
                {checkins.map((c) => (
                  <li key={c.userId} className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{c.name}</span> checked in
                  </li>
                ))}
              </ul>
            )}
            {hasJoined && isCheckinWindow(eventStartMs(event)) && (
              <button
                type="button"
                disabled={checkinBusy || isCheckedIn(event.id, user.id)}
                onClick={async () => {
                  setCheckinBusy(true);
                  await recordCheckin(user.id, user.name || 'You');
                  setCheckinBusy(false);
                  setToast({ show: true, message: "You're here. Enjoy the event!", type: 'success' });
                }}
                className="w-full rounded-xl gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
              >
                {isCheckedIn(event.id, user.id) ? "You're here" : "I'm here"}
              </button>
            )}
            {isEventOwner && (
              <form
                className="flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const parsed = parseTicketQr(ticketScan);
                  if (!parsed?.ticketId && !parsed?.name) return;
                  setCheckinBusy(true);
                  await recordCheckin(
                    parsed.ticketId || `guest-${Date.now()}`,
                    parsed.name || 'Guest',
                    parsed.ticketId,
                  );
                  setTicketScan('');
                  setCheckinBusy(false);
                }}
              >
                <input
                  value={ticketScan}
                  onChange={(e) => setTicketScan(e.target.value)}
                  placeholder="Paste ticket QR or ID"
                  aria-label="Ticket QR or ID"
                  className="flex-1 rounded-xl border border-border/50 bg-secondary px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button
                  type="submit"
                  disabled={checkinBusy || !ticketScan.trim()}
                  className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  Check in
                </button>
              </form>
            )}
          </div>
        )}

        {/* Map */}
        <div className="rounded-2xl glass-card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <MapPin className="h-4 w-4 text-primary" /> Location
            </h2>
            <a
              href={openInGoogleMapsUrl({ lat: event.lat, lng: event.lng, placeName: event.location })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-secondary/80"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Google Maps
            </a>
          </div>
          <EventLocationMap latitude={event.lat} longitude={event.lng} className="h-52" />
          <p className="text-xs text-muted-foreground">{event.location}</p>
        </div>

        {/* Join / Leave */}
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">
            {isEventOwner ? 'Your event' : 'Join or leave'}
          </h2>
        </div>

        {/* Event Chat Access */}
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Event chat</h2>
          {!user ? (
            <p className="text-xs text-muted-foreground">Sign in and join this event to access the event chat.</p>
          ) : canAccessEventChat ? (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => navigate(`/chat?eventId=${event.id}`)}
                className="w-full rounded-xl bg-secondary/80 py-3 text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
              >
                Open Event Chat
              </button>
              {isCancelledEvent && (
                <p className="text-[11px] text-center text-muted-foreground">
                  This event is cancelled. Chat is read-only.
                </p>
              )}
              {isChatExpired && !isCancelledEvent && (
                <p className="text-[11px] text-center text-muted-foreground">
                  This event ended more than 48 hours ago. Chat is read-only.
                </p>
              )}
            </div>
          ) : isCancelledEvent ? (
            <p className="text-xs text-muted-foreground">This event is cancelled.</p>
          ) : (
            <p className="text-xs text-muted-foreground">Join this event to access its chat.</p>
          )}
        </div>

        <div className="flex gap-3">
          {isEventOwner ? (
            <>
              <button
                type="button"
                disabled={isPastEvent || isCancelledEvent}
                onClick={() => !isPastEvent && !isCancelledEvent && navigate(`/event/${event.id}/edit`)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-3.5 text-sm font-semibold transition-colors active:scale-[0.98] ${
                  isPastEvent || isCancelledEvent
                    ? 'border-border bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                    : 'border-primary/45 bg-primary/15 text-primary hover:bg-primary/25'
                }`}
              >
                <Pencil className="h-4 w-4 shrink-0" />
                Edit event
              </button>
              {!isEventPassed && (
                <button
                  type="button"
                  disabled={isCancellingEvent || isCancelledEvent}
                  onClick={() => void handleCancelEvent()}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-3.5 text-sm font-semibold transition-colors active:scale-[0.98] ${
                    isCancelledEvent
                      ? 'border-border bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                      : 'border-destructive/45 bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-60'
                  }`}
                >
                  <Ban className="h-4 w-4 shrink-0" />
                  {isCancellingEvent ? 'Cancelling…' : isCancelledEvent ? 'Cancelled' : 'Cancel event'}
                </button>
              )}
            </>
          ) : showSplitJoinLeave ? (
            <>
              <button
                type="button"
                onClick={() => { if (!hasJoined && !participationLoading && !isPastEvent && !isCancelledEvent && !isAtCapacity) void handleJoinOrRequest(); }}
                disabled={isPastEvent || isCancelledEvent || isAtCapacity || hasJoined || participationLoading || isUpdatingParticipation || existingRequest?.status === 'rejected'}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-transform active:scale-[0.98] ${
                  isPastEvent || isCancelledEvent || isAtCapacity || hasJoined || participationLoading || isUpdatingParticipation
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'gradient-primary text-primary-foreground shadow-glow ripple-container'
                }`}
              >
                <UserPlus className="h-4 w-4 shrink-0" />
                {isCancelledEvent ? 'Event Cancelled' : isPastEvent ? 'Event Ended' : isAtCapacity ? 'Event Full' : 'Join Event'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (hasJoined && !isUpdatingParticipation && !participationLoading && !isCancelledEvent) void handleJoinOrRequest();
                }}
                disabled={!hasJoined || participationLoading || isUpdatingParticipation || isCancelledEvent}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-3.5 text-sm font-semibold transition-transform active:scale-[0.98] ${
                  !hasJoined || participationLoading || isUpdatingParticipation || isCancelledEvent
                    ? 'cursor-not-allowed bg-muted/50 text-muted-foreground'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Leave Event
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { if (!isCancelledEvent) void handleJoinOrRequest(); }}
                disabled={isCancelledEvent || isPastEvent || isAtCapacity || isOrganizer || isEventOwner || existingRequest?.status === 'rejected' || isUpdatingParticipation || participationLoading}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-transform active:scale-[0.98] ${
                  isCancelledEvent || isPastEvent || isAtCapacity || isOrganizer || isEventOwner || existingRequest?.status === 'rejected' || isUpdatingParticipation || participationLoading
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : hasJoined
                      ? 'border border-border bg-secondary text-foreground hover:bg-secondary/80'
                      : 'gradient-primary text-primary-foreground shadow-glow ripple-container'
                }`}
              >
                {useApiParticipation && !event.requiresApproval && isFreeEvent && !isCancelledEvent ? (
                  hasJoined ? <LogOut className="h-4 w-4 shrink-0" /> : <UserPlus className="h-4 w-4 shrink-0" />
                ) : null}
                {getJoinButtonText()}
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* Modals */}
      <AnimatePresence>
        {showVenuePaymentModal && (
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
                <span className="font-semibold text-foreground">€{event.budget}</span>. Payment is
                collected at the venue on arrival. By joining, you agree to pay when you get there.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => void handleVenuePaymentConfirm()}
                  className="flex-1 gradient-primary rounded-xl py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  Okay, Join Event
                </button>
                <button
                  type="button"
                  onClick={() => setShowVenuePaymentModal(false)}
                  className="flex-1 rounded-xl bg-secondary py-2.5 text-sm text-muted-foreground"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}