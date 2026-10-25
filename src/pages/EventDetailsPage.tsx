import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getEvents, getCurrentUser, addJoinRequest, getJoinRequests, joinEvent, leaveEvent, getUsers, updateEvent, cancelEvent, type EventItem } from '@/lib/storage';
import { motion } from 'framer-motion';
import { useState, useMemo, useEffect, useCallback } from 'react';
import AppToast from '@/components/AppToast';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';
import { getAuthToken, setAuthToken } from '@/lib/auth';
import { mapApiEventToItem } from '@/lib/mapApiEvent';
import { getApiUrl } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/apiUrls';
import { fetchAuthUserFromToken, sameAuthUserId } from '@/lib/authProfile';
import { formatPageTitle } from '@/lib/documentTitle';
import { isEventUpcoming, isEventCancelled, eventStartMs } from '@/lib/eventTime';
import { cachedFetch, invalidatePrefix, peekCache, TTL } from '@/lib/queryCache';
import { fetchOrganizerProfile } from '@/lib/organizerProfile';
import { formatUserIdentity } from '@/lib/userIdentity';
import InvitedByBanner from '@/components/InvitedByBanner';
import { fetchFriendsAttending, fetchParticipantCount, fetchParticipantList, type ParticipantRow } from '@/lib/eventAttendeesApi';
import type { EventInvitationSummary } from '@/lib/invitationsApi';
import { fetchAllFriends, friendsGoingToEvent } from '@/lib/eventSocial';
import { type UserSummary } from '@/lib/friendsApi';
import { addCheckin, CHECKINS_CHANGED_EVENT, listCheckins, type CheckinRecord } from '@/lib/checkin';
import { postEventChatMessage } from '@/lib/chatPayload';
import EventDetailsActions from '@/pages/eventDetails/EventDetailsActions';
import EventDetailsAttendees from '@/pages/eventDetails/EventDetailsAttendees';
import EventDetailsBanner from '@/pages/eventDetails/EventDetailsBanner';
import EventDetailsCheckin from '@/pages/eventDetails/EventDetailsCheckin';
import EventDetailsHero from '@/pages/eventDetails/EventDetailsHero';
import EventDetailsMap from '@/pages/eventDetails/EventDetailsMap';
import EventDetailsRemoved from '@/pages/eventDetails/EventDetailsRemoved';
import EventDetailsStatus from '@/pages/eventDetails/EventDetailsStatus';
import EventDetailsVenueModal from '@/pages/eventDetails/EventDetailsVenueModal';
import {
  type AttendeeRow,
  type OrganizerProfile,
  type ParticipationStatus,
  isEventChatExpired,
  joinButtonText,
  readApiErrorMessage,
} from '@/pages/eventDetails/eventDetailsModel';

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
  const [organizerProfile, setOrganizerProfile] = useState<OrganizerProfile | null>(null);
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
      invalidatePrefix(`/api/events/${event.id}`);
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
    setApiNotFound(false);
    const eventKey = `/api/events/${id}`;
    const applyEvent = (data: Record<string, unknown>) => {
      const mapped = mapApiEventToItem(data);
      setApiEvent(mapped);
      setApiNotFound(false);
      setApiEventStatus(typeof data?.status === 'string' ? data.status : null);
      setInvitation((data?.invitation as EventInvitationSummary | null | undefined) ?? null);
      return mapped;
    };
    const cached = peekCache<Record<string, unknown>>(eventKey);
    if (cached?.id) {
      applyEvent(cached);
      setLoadingApi(false);
    } else {
      setLoadingApi(true);
    }

    (async () => {
      const token = await getApiToken();
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      try {
        const data = await cachedFetch(
          eventKey,
          async () => {
            const res = await fetch(getApiUrl(`/api/events/${id}`), { headers });
            if (!res.ok) {
              if (res.status === 404) {
                const err = new Error('Event not found') as Error & { status?: number };
                err.status = 404;
                throw err;
              }
              throw new Error();
            }
            return res.json() as Promise<Record<string, unknown>>;
          },
          TTL.MEDIUM,
        );
        if (cancelled) return;

        const mapped = applyEvent(data);
        setParticipationKnown(false);

        const creatorId = String(data.created_by || data.organizer_id || mapped.organizerId || '');
        if (creatorId) {
          const prof = await fetchOrganizerProfile(creatorId);
          if (prof && !cancelled) setOrganizerProfile(prof);
        }
      } catch (err) {
        if ((err as { status?: number })?.status === 404) {
          if (!cancelled) {
            setApiNotFound(true);
            setApiEvent(null);
            setApiEventStatus(null);
          }
          return;
        }
        if (!cancelled && !cached?.id) {
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
    return <EventDetailsStatus message="Loadingâ€¦" />;
  }
  if (!event) {
    return <EventDetailsStatus message="Event not found" />;
  }

  const isEventPassed = !isEventUpcoming(event);
  const isPastEvent = !isCancelledEvent && isEventPassed;
  const isUpcomingEvent = !isCancelledEvent && isEventUpcoming(event);
  const canInviteFriends = Boolean(user && useApiParticipation && isUpcomingEvent && (isEventOwner || hasJoined));
  const isChatExpired = isEventPassed && isEventChatExpired(event.date, event.time);

  if (wasRemovedFromEvent) {
    return (
      <EventDetailsRemoved
        title={event.title}
        onBack={() => navigate(-1)}
        onBrowse={() => navigate('/home')}
      />
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
          invalidatePrefix(`/api/events/${event.id}`);
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
      invalidatePrefix(`/api/events/${event.id}`);
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

  const joinLabel = joinButtonText({
    isCancelledEvent,
    isUpdatingParticipation,
    participationLoading,
    isPastEvent,
    isEventOwner,
    hasJoined,
    isAtCapacity,
    isOrganizer,
    requiresApproval: event.requiresApproval,
    requestStatus: existingRequest?.status,
    isFreeEvent,
    budget: event.budget,
  });

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

      <EventDetailsBanner
        title={event.title}
        image={event.image}
        category={event.category}
        isCancelledEvent={isCancelledEvent}
        requiresApproval={event.requiresApproval}
        onBack={() => navigate(-1)}
      />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg px-4 -mt-10 relative z-10 space-y-6">
        <InvitedByBanner invitation={invitation} />
        <EventDetailsHero
          event={event}
          isCancelledEvent={isCancelledEvent}
          isFreeEvent={isFreeEvent}
          organizerProfile={organizerProfile}
          organizerName={resolvedOrganizerName}
          organizerFullName={organizerProfile?.full_name || event.organizerFullName || (event.organizer !== 'Organizer' ? event.organizer : '') || 'Organizer'}
          organizerAvatar={resolvedOrganizerAvatar}
          attendeeDisplayCount={attendeeDisplayCount}
          friendsGoing={friendsGoing}
          canViewFullAttendeeList={canViewFullAttendeeList}
          participantPreview={participantUsers}
          userSignedIn={Boolean(user)}
        />

        <EventDetailsAttendees
          eventId={event.id}
          currentUserId={user?.id}
          canViewFullAttendeeList={canViewFullAttendeeList}
          canInviteFriends={canInviteFriends}
          showInviteDialog={showInviteDialog}
          onInviteDialogChange={setShowInviteDialog}
          participationKnown={participationKnown}
          useApiParticipation={useApiParticipation}
          apiParticipantsEmpty={apiParticipants.length === 0}
          fullAttendeeRows={fullAttendeeRows}
          attendingFriends={attendingFriends}
          attendeeDisplayCount={attendeeDisplayCount}
          isEventOwner={isEventOwner}
          isCancelledEvent={isCancelledEvent}
          isPastEvent={isPastEvent}
          checkinBusy={checkinBusy}
          removingParticipantId={removingParticipantId}
          onCheckin={(userId, name) => void recordCheckin(userId, name)}
          onRemove={(userId) => void handleRemoveAttendee(userId)}
        />

        {!isCancelledEvent && user && (isEventOwner || hasJoined) && (
          <EventDetailsCheckin
            eventId={event.id}
            eventStartMs={eventStartMs(event)}
            currentUserId={user.id}
            currentUserName={user.name || 'You'}
            isEventOwner={isEventOwner}
            hasJoined={hasJoined}
            checkins={checkins}
            checkinBusy={checkinBusy}
            ticketScan={ticketScan}
            onTicketScanChange={setTicketScan}
            onSelfCheckin={async () => {
              setCheckinBusy(true);
              await recordCheckin(user.id, user.name || 'You');
              setCheckinBusy(false);
              setToast({ show: true, message: "You're here. Enjoy the event!", type: 'success' });
            }}
            onTicketCheckin={async (userId, name, ticketId) => {
              setCheckinBusy(true);
              await recordCheckin(userId, name, ticketId);
              setTicketScan('');
              setCheckinBusy(false);
            }}
          />
        )}

        <EventDetailsMap location={event.location} lat={event.lat} lng={event.lng} />

        <EventDetailsActions
          signedIn={Boolean(user)}
          canAccessEventChat={canAccessEventChat}
          isCancelledEvent={isCancelledEvent}
          isChatExpired={isChatExpired}
          isEventOwner={isEventOwner}
          isEventPassed={isEventPassed}
          isPastEvent={isPastEvent}
          isAtCapacity={isAtCapacity}
          isOrganizer={isOrganizer}
          hasJoined={hasJoined}
          participationLoading={participationLoading}
          isUpdatingParticipation={isUpdatingParticipation}
          isCancellingEvent={isCancellingEvent}
          showSplitJoinLeave={showSplitJoinLeave}
          useApiParticipation={useApiParticipation}
          requiresApproval={event.requiresApproval}
          isFreeEvent={isFreeEvent}
          requestRejected={existingRequest?.status === 'rejected'}
          joinLabel={joinLabel}
          onOpenChat={() => navigate(`/chat?eventId=${event.id}`)}
          onEdit={() => navigate(`/event/${event.id}/edit`)}
          onCancelEvent={() => void handleCancelEvent()}
          onJoin={() => void handleJoinOrRequest()}
          onLeave={() => void handleJoinOrRequest()}
        />
      </motion.div>

      <EventDetailsVenueModal
        open={showVenuePaymentModal}
        budget={event.budget}
        onConfirm={() => void handleVenuePaymentConfirm()}
        onCancel={() => setShowVenuePaymentModal(false)}
      />

      <BottomNav />
    </div>
  );
}
