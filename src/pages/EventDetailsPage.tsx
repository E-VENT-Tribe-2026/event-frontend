import { useParams, useNavigate } from 'react-router-dom';
import { getEvents, getCurrentUser, addReview, reportEvent, addJoinRequest, getJoinRequests, joinEvent, leaveEvent, getUsers, updateEvent, deleteEvent, type EventItem } from '@/lib/storage';
import { ArrowLeft, MapPin, Clock, Users, Star, Flag, Send, ShieldCheck, Pencil, LogOut, UserPlus, ExternalLink, UserMinus, Trash2 } from 'lucide-react';
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

type ParticipationStatus = 'none' | 'going' | 'removed';

async function readApiErrorMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { detail?: unknown };
  const d = body.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d) && d[0] && typeof (d[0] as { msg?: string }).msg === 'string') {
    return (d[0] as { msg: string }).msg;
  }
  return `Something went wrong (HTTP ${res.status})`;
}

export default function EventDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [events, setEventsState] = useState(getEvents());
  const [apiEvent, setApiEvent] = useState<EventItem | null>(null);
  const [loadingApi, setLoadingApi] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [showVenuePaymentModal, setShowVenuePaymentModal] = useState(false);
  const [apiParticipants, setApiParticipants] = useState<Array<{ user_id: string; status?: string; profiles?: { full_name?: string; avatar_url?: string } }>>([]);
  const [isUpdatingParticipation, setIsUpdatingParticipation] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState<number | null>(null);
  const [myParticipationStatus, setMyParticipationStatus] = useState<ParticipationStatus | null>(null);
  const [participationKnown, setParticipationKnown] = useState(false);
  const [removingParticipantId, setRemovingParticipantId] = useState<string | null>(null);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [backendAuthUserId, setBackendAuthUserId] = useState<string | null>(null);
  const user = getCurrentUser();
  const allUsers = getUsers();

  const localEvent = useMemo(() => events.find((e) => e.id === id) ?? null, [events, id]);
  const event = apiEvent ?? localEvent ?? null;
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

  // Hoisted so both handleJoinOrRequest and handleVenuePaymentConfirm can use it
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
        setToast({ show: true, message: await readApiErrorMessage(res), type: 'error' });
        return false;
      }
      await syncParticipationFromBackend();
      setToast({ show: true, message: 'Successfully joined!', type: 'success' });
      return true;
    } catch {
      setToast({ show: true, message: 'Server unavailable. Try again.', type: 'error' });
      return false;
    }
  };

  const syncParticipationFromBackend = useCallback(async () => {
    if (!id || !apiEvent) {
      setAttendeeCount(null);
      setMyParticipationStatus(null);
      setParticipationKnown(false);
      setApiParticipants([]);
      return;
    }

    try {
      const cRes = await fetch(getApiUrl(`/api/participants/${id}/participants/count`));
      if (cRes.ok) {
        const c = await cRes.json().catch(() => ({}));
        if (typeof c.count === 'number') setAttendeeCount(c.count);
        else setAttendeeCount(null);
      }
    } catch {
      setAttendeeCount(null);
    }

    const token = await getApiToken();
    if (!token || !user?.id) {
      setMyParticipationStatus('none');
      setParticipationKnown(true);
      setApiParticipants([]);
      return;
    }

    let status: ParticipationStatus = 'none';
    try {
      const sRes = await fetch(getApiUrl(`/api/participants/${id}/my-status`), {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (sRes.ok) {
        const data = await sRes.json().catch(() => ({}));
        if (data.status === 'going') status = 'going';
        else if (data.status === 'removed') status = 'removed';
      }
    } catch {
      status = 'none';
    }
    setMyParticipationStatus(status);

    const isOwner =
      sameAuthUserId(apiEvent.organizerId, backendAuthUserId) || sameAuthUserId(apiEvent.organizerId, user?.id);
    if (isOwner || status === 'going') {
      try {
        const pRes = await fetch(getApiUrl(`/api/participants/${id}/participants`), {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (pRes.ok) {
          const list = await pRes.json().catch(() => []);
          setApiParticipants(Array.isArray(list) ? list : []);
        } else {
          setApiParticipants([]);
        }
      } catch {
        setApiParticipants([]);
      }
    } else {
      setApiParticipants([]);
    }

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

  useEffect(() => {
    if (!id) {
      setLoadingApi(false);
      setApiEvent(null);
      return;
    }
    let cancelled = false;
    setLoadingApi(true);
    fetch(getApiUrl(`/api/events/${id}`))
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setApiEvent(mapApiEventToItem(data));
      })
      .catch(() => {
        if (!cancelled) setApiEvent(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingApi(false);
      });
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
        : participationKnown && (isEventOwner || hasJoined)),
  );

  const wasRemovedFromEvent = Boolean(
    useApiParticipation && user && participationKnown && myParticipationStatus === 'removed',
  );

  const alreadyReviewed = user && event ? (event.reviews || []).some(r => r.userId === user?.id) : false;
  const alreadyReported = user && event ? (event.reports || []).some(r => r.userId === user?.id) : false;
  const existingRequest = user && event ? getJoinRequests().find(r => r.eventId === event.id && r.userId === user.id) : null;

  const participantUsers = useMemo(() => {
    if (!event || !canViewFullAttendeeList) {
      return [] as Array<{ id: string; profilePhoto?: string; avatar?: string; name: string; email?: string }>;
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
        }));
    }
    return event.participants
      .map((pId) => {
        const u = allUsers.find((x) => x.id === pId);
        if (!u) return null;
        return { id: u.id, profilePhoto: u.profilePhoto, avatar: u.avatar, name: u.name, email: u.email };
      })
      .filter(Boolean)
      .slice(0, 6) as Array<{ id: string; profilePhoto?: string; avatar?: string; name: string; email?: string }>;
  }, [event, allUsers, apiParticipants, canViewFullAttendeeList, useApiParticipation]);

  const fullAttendeeRows = useMemo(() => {
    if (!event || !canViewFullAttendeeList) {
      return [] as Array<{ id: string; profilePhoto?: string; avatar?: string; name: string; email?: string }>;
    }
    if (useApiParticipation && apiParticipants.length > 0) {
      return apiParticipants
        .filter((p) => p?.user_id)
        .map((p) => ({
          id: p.user_id,
          profilePhoto: p.profiles?.avatar_url,
          avatar: p.profiles?.avatar_url,
          name: p.profiles?.full_name || 'Participant',
        }));
    }
    return event.participants
      .map((pId) => {
        const u = allUsers.find((x) => x.id === pId);
        if (!u) return null;
        return { id: u.id, profilePhoto: u.profilePhoto, avatar: u.avatar, name: u.name, email: u.email };
      })
      .filter(Boolean) as Array<{ id: string; profilePhoto?: string; avatar?: string; name: string; email?: string }>;
  }, [event, allUsers, apiParticipants, canViewFullAttendeeList, useApiParticipation]);

  useEffect(() => {
    if (loadingApi && !localEvent) return;
    const ev = apiEvent ?? localEvent ?? null;
    if (!ev?.title?.trim()) {
      if (!loadingApi && !ev) document.title = formatPageTitle('Event not found');
      return;
    }
    document.title = formatPageTitle(ev.title);
  }, [loadingApi, localEvent, apiEvent, apiEvent?.id, apiEvent?.title, localEvent?.id, localEvent?.title]);

  if (loadingApi && !localEvent) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Loading…</div>;
  }
  if (!event) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Event not found</div>;
  }

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

    if (hasJoined) {
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
          await syncParticipationFromBackend();
          setToast({ show: true, message: 'You left the event.', type: 'success' });
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
      setIsUpdatingParticipation(false);
      return;
    }

    if (event.requiresApproval) {
      if (existingRequest) {
        if (existingRequest.status === 'approved') {
          if (event.budget > 0) {
            // Show venue payment modal instead of navigating
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
        // Show venue payment modal instead of navigating
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
        await syncParticipationFromBackend();
        setToast({ show: true, message: 'Attendee removed.', type: 'success' });
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
  };

  const handleDeleteEvent = async () => {
    if (!isEventOwner || !event) return;
    if (!window.confirm(`Delete "${event.title}"? This cannot be undone.`)) return;
    setIsDeletingEvent(true);
    try {
      if (useApiParticipation) {
        const token = await getApiToken();
        if (!token) {
          setToast({ show: true, message: 'Sign in to delete this event.', type: 'error' });
          return;
        }
        const res = await fetch(getApiUrl(`${API_ENDPOINTS.EVENTS}/${event.id}`), {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!res.ok) {
          setToast({ show: true, message: await readApiErrorMessage(res), type: 'error' });
          return;
        }
      }
      deleteEvent(event.id);
      setEventsState(getEvents());
      setToast({ show: true, message: 'Event deleted.', type: 'success' });
      setTimeout(() => navigate('/home'), 600);
    } catch {
      setToast({ show: true, message: 'Could not delete the event.', type: 'error' });
    } finally {
      setIsDeletingEvent(false);
    }
  };

  const handleReview = () => {
    if (!user || !reviewText.trim()) return;
    addReview(event.id, { userId: user.id, user: user.name, text: reviewText, rating: reviewRating });
    setEventsState(getEvents());
    setReviewText('');
    setShowReviewForm(false);
    setToast({ show: true, message: 'Review submitted!', type: 'success' });
  };

  const handleReport = () => {
    if (!user || !reportReason.trim()) return;
    reportEvent(event.id, { userId: user.id, reason: reportReason, time: new Date().toISOString() });
    setEventsState(getEvents());
    setReportReason('');
    setShowReportModal(false);
    setToast({ show: true, message: 'Report submitted.', type: 'success' });
  };

  const reviews = event.reviews || [];

  const getJoinButtonText = () => {
    if (isUpdatingParticipation) return 'Please wait...';
    if (participationLoading) return 'Checking attendance…';
    if (isEventOwner) return "You're hosting";
    if (hasJoined) return 'Leave Event';
    if (isOrganizer) return "Organizers can't join";
    if (event.requiresApproval) {
      if (existingRequest?.status === 'pending') return 'Request Pending...';
      if (existingRequest?.status === 'approved') return event.budget > 0 ? 'Approved — Pay at Venue' : 'Approved — Join Now';
      if (existingRequest?.status === 'rejected') return 'Request Rejected';
      return 'Request to Join';
    }
    return event.budget > 0 ? `Join — Pay $${event.budget} at Venue` : 'Join Event';
  };

  const showSplitJoinLeave =
    useApiParticipation && !event.requiresApproval && event.budget === 0 && !isEventOwner && !isOrganizer;

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />

      {/* Banner */}
      <div className="relative h-60">
        <img src={event.image} alt={event.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 rounded-full glass-card p-2.5">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
          {isEventOwner && (
            <button
              type="button"
              onClick={() => navigate(`/event/${event.id}/edit`)}
              className="flex items-center gap-1.5 rounded-full glass-card px-3 py-2 text-xs font-semibold text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          )}
          {event.requiresApproval && (
            <div className="flex items-center gap-1 rounded-full bg-accent/90 px-3 py-1 text-xs font-semibold text-accent-foreground backdrop-blur-sm">
              <ShieldCheck className="h-3 w-3" /> Approval Required
            </div>
          )}
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg px-4 -mt-10 relative z-10 space-y-6">
        <div className="rounded-2xl glass-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-bold text-foreground">{event.title}</h1>
            <span className="shrink-0 rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary">{event.category}</span>
          </div>

          <div className="flex items-center gap-3">
            <img src={event.organizerAvatar} alt="" className="h-10 w-10 rounded-full bg-secondary ring-2 ring-primary/30" />
            <div>
              <p className="text-sm font-medium text-foreground">{event.organizer}</p>
              <p className="text-xs text-muted-foreground">Organizer</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4 text-primary" />{event.date} · {event.time}</div>
            <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4 text-accent" /><span className="truncate">{event.location}</span></div>
            <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4 text-primary" />{attendeeDisplayCount}/{event.participantsLimit}</div>
            <div className="flex items-center gap-2 text-foreground font-semibold">
              {event.budget === 0 ? 'Free' : `$${event.budget} at venue`}
            </div>
          </div>

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
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="h-4 w-4 text-primary" />
            Attendees
          </h2>
          {canViewFullAttendeeList ? (
            fullAttendeeRows.length === 0 ? (
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
                      <span className="truncate text-sm font-medium text-foreground">{row.name}</span>
                    </div>
                    {isEventOwner && user && String(row.id) !== String(user.id) && (
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
                  </li>
                ))}
              </ul>
            )
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              For privacy, only the count is shown here:{' '}
              <span className="font-semibold text-foreground">{attendeeDisplayCount}</span>{' '}
              {attendeeDisplayCount === 1 ? 'person is' : 'people are'} going.
            </p>
          )}
        </div>

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

        {/* Reviews */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Reviews ({reviews.length})</h2>
            {hasJoined && !alreadyReviewed && (
              <button onClick={() => setShowReviewForm(!showReviewForm)} className="text-xs text-primary font-medium">Write Review</button>
            )}
          </div>

          <AnimatePresence>
            {showReviewForm && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="rounded-2xl glass-card p-4 space-y-3">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button key={s} onClick={() => setReviewRating(s)}>
                      <Star className={`h-5 w-5 ${s <= reviewRating ? 'fill-accent text-accent' : 'text-muted-foreground'}`} />
                    </button>
                  ))}
                </div>
                <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} placeholder="Share your experience..." rows={2}
                  className="w-full rounded-lg bg-secondary p-3 text-sm text-foreground outline-none resize-none focus:ring-2 focus:ring-primary/50" />
                <button onClick={handleReview} className="flex items-center gap-2 gradient-primary rounded-lg px-4 py-2 text-xs font-semibold text-primary-foreground">
                  <Send className="h-3 w-3" /> Submit
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {reviews.length > 0 ? reviews.map((r, i) => (
            <div key={i} className="rounded-2xl glass-card p-4 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{r.user}</span>
                <div className="flex">{Array.from({ length: r.rating }, (_, j) => <Star key={j} className="h-3 w-3 fill-accent text-accent" />)}</div>
              </div>
              <p className="text-xs text-muted-foreground">{r.text}</p>
            </div>
          )) : (
            <p className="text-xs text-muted-foreground">No reviews yet.</p>
          )}
        </div>

        {/* Join / Leave */}
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">
            {isEventOwner ? 'Your event' : 'Join or leave'}
          </h2>
          {isEventOwner ? (
            <p className="text-xs text-muted-foreground">
              As the host you can edit or delete here. Join and Leave are only for guests — you can't join your own event.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {showSplitJoinLeave
                ? 'Use Join to attend or Leave to cancel your spot.'
                : 'One action below handles join, pay, approval, or leave depending on this event.'}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          {isEventOwner ? (
            <>
              <button
                type="button"
                onClick={() => navigate(`/event/${event.id}/edit`)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary/45 bg-primary/15 py-3.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/25 active:scale-[0.98]"
              >
                <Pencil className="h-4 w-4 shrink-0" />
                Edit event
              </button>
              <button
                type="button"
                disabled={isDeletingEvent}
                onClick={() => void handleDeleteEvent()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-destructive/45 bg-destructive/10 py-3.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-60 active:scale-[0.98]"
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                {isDeletingEvent ? 'Deleting…' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => alreadyReported ? setToast({ show: true, message: 'Already reported', type: 'error' }) : setShowReportModal(true)}
                className="rounded-xl glass-card px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-destructive"
                aria-label="Report event"
              >
                <Flag className="h-4 w-4" />
              </button>
            </>
          ) : showSplitJoinLeave ? (
            <>
              <button
                type="button"
                onClick={() => { if (!hasJoined && !participationLoading) void handleJoinOrRequest(); }}
                disabled={hasJoined || participationLoading || isUpdatingParticipation || existingRequest?.status === 'rejected'}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-transform active:scale-[0.98] ${
                  hasJoined || participationLoading || isUpdatingParticipation
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'gradient-primary text-primary-foreground shadow-glow ripple-container'
                }`}
              >
                <UserPlus className="h-4 w-4 shrink-0" />
                Join Event
              </button>
              <button
                type="button"
                onClick={() => { if (hasJoined && !isUpdatingParticipation) void handleJoinOrRequest(); }}
                disabled={!hasJoined || participationLoading || isUpdatingParticipation}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-3.5 text-sm font-semibold transition-transform active:scale-[0.98] ${
                  !hasJoined || participationLoading || isUpdatingParticipation
                    ? 'cursor-not-allowed bg-muted/50 text-muted-foreground'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Leave Event
              </button>
              <button
                type="button"
                onClick={() => alreadyReported ? setToast({ show: true, message: 'Already reported', type: 'error' }) : setShowReportModal(true)}
                className="rounded-xl glass-card px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-destructive"
                aria-label="Report event"
              >
                <Flag className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void handleJoinOrRequest()}
                disabled={isOrganizer || isEventOwner || existingRequest?.status === 'rejected' || isUpdatingParticipation || participationLoading}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-transform active:scale-[0.98] ${
                  isOrganizer || isEventOwner || existingRequest?.status === 'rejected' || isUpdatingParticipation || participationLoading
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : hasJoined
                      ? 'border border-border bg-secondary text-foreground hover:bg-secondary/80'
                      : 'gradient-primary text-primary-foreground shadow-glow ripple-container'
                }`}
              >
                {useApiParticipation && !event.requiresApproval && event.budget === 0 ? (
                  hasJoined ? <LogOut className="h-4 w-4 shrink-0" /> : <UserPlus className="h-4 w-4 shrink-0" />
                ) : null}
                {getJoinButtonText()}
              </button>
              <button
                type="button"
                onClick={() => alreadyReported ? setToast({ show: true, message: 'Already reported', type: 'error' }) : setShowReportModal(true)}
                className="rounded-xl glass-card px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-destructive"
                aria-label="Report event"
              >
                <Flag className="h-4 w-4" />
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
                <span className="font-semibold text-foreground">${event.budget}</span>. Payment is
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

        {showReportModal && (
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
              <h3 className="text-lg font-bold text-foreground">Report Event</h3>
              <textarea
                value={reportReason}
                onChange={e => setReportReason(e.target.value)}
                placeholder="Describe the issue..."
                rows={3}
                className="w-full rounded-lg bg-secondary p-3 text-sm text-foreground outline-none resize-none focus:ring-2 focus:ring-primary/50"
              />
              <div className="flex gap-3">
                <button onClick={handleReport} className="flex-1 gradient-primary rounded-xl py-2.5 text-sm font-semibold text-primary-foreground">Submit</button>
                <button onClick={() => setShowReportModal(false)} className="flex-1 rounded-xl bg-secondary py-2.5 text-sm text-muted-foreground">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}