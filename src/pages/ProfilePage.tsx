import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  getCurrentUser, 
  setCurrentUserFromOAuth,
  updateUser, 
  getEvents, 
  getJoinRequests, 
  leaveEvent, 
  upsertEvent, 
  type EventItem 
} from '@/lib/storage';
import { logout } from '@/lib/storage';
import { useNavigate } from 'react-router-dom';
import { LogOut, Edit2, Check, X, Star, CreditCard, Heart, Trash2, Lock, Eye, EyeOff, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import AppToast from '@/components/AppToast';
import { getAuthToken, clearAuthToken } from '@/lib/auth';
import { getApiUrl } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/apiUrls';
import { mapApiEventToItem } from '@/lib/mapApiEvent';
import { UserAvatar } from '@/components/UserAvatar';
import { isEventUpcoming, eventStartMs } from '@/lib/eventTime';
import { ALL_INTERESTS } from '@/lib/interests';
import { invalidatePrefix, invalidate } from '@/lib/queryCache';
import { FULL_NAME_RULES_HINT, getFullNameValidationError, normalizeFullName } from '@/lib/username';
import { uploadProfilePhotoToStorage } from '@/lib/uploadAvatar';
import { storageRefusalMessage } from '@/lib/profilePhoto';
import { PROFILE_ICONS } from '@/lib/profileAssets';
import { resolveAvatarDisplayUrl, getGeneratedAvatarUrl } from '@/lib/avatars'; 
import { CATEGORY_BANNERS } from '@/lib/categoryBanners'; 

const PROFILE_BANNERS = Object.entries(CATEGORY_BANNERS).map(([label, url]) => ({
  id: label.toLowerCase(),
  label,
  url: url.replace('w=600', 'w=1200'),
}));

const AVATAR_SEEDS = [
  'alex', 'sam', 'jordan', 'taylor', 'casey', 'riley',
  'morgan', 'jamie', 'avery', 'quinn', 'drew', 'robin',
];
const PROFILE_AVATARS = AVATAR_SEEDS.map((seed) => ({
  id: seed,
  url: getGeneratedAvatarUrl(seed),
}));

function sameUserId(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  
  // UI State
  const [profileLoading, setProfileLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState('');
  
  // Saved database state
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '');
  const [avatarKind, setAvatarKind] = useState<'photo' | 'icon'>('icon');
  const [iconId, setIconId] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  
  // Staged preview state (for before "Save" is clicked)
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState(user?.avatar || '');
  const [previewBannerUrl, setPreviewBannerUrl] = useState('');
  const [previewAvatarKind, setPreviewAvatarKind] = useState<'photo' | 'icon'>('icon');
  
  const [savedName, setSavedName] = useState(user?.name || '');
  const [savedBio, setSavedBio] = useState(user?.bio || '');
  const [savedInterests, setSavedInterests] = useState<string[]>(user?.interests || []);
  const [nameError, setNameError] = useState('');
  const photoRef = useRef<HTMLInputElement>(null);
  const [bio, setBio] = useState(user?.bio || '');
  const [interests, setInterests] = useState<string[]>(user?.interests || []);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [activeTab, setActiveTab] = useState<'events' | 'favorites'>('events');
  const [eventSubFilter, setEventSubFilter] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');
  const [visibleEvents, setVisibleEvents] = useState(4);
  const [visibleFavorites, setVisibleFavorites] = useState(4);

  // Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  // Data State
  const [remoteJoinedEvents, setRemoteJoinedEvents] = useState<EventItem[]>([]);
  const [remoteCreatedUpcoming, setRemoteCreatedUpcoming] = useState<EventItem[]>([]);
  const [remoteCreatedPast, setRemoteCreatedPast] = useState<EventItem[]>([]);
  const [favorites, setFavorites] = useState<EventItem[]>([]);
  const [localEventsEpoch, setLocalEventsEpoch] = useState(0);
  const [leavingEventId, setLeavingEventId] = useState<string | null>(null);

  // Memoized Data Calculations
  const events = useMemo(() => getEvents(), [localEventsEpoch]);
  const joinedEvents = useMemo(() => user ? events.filter(e => e.participants.includes(user.id)) : [], [events, user]);
  
  const allJoinedEvents = useMemo(() => {
    const byId = new Map<string, EventItem>();
    [...joinedEvents, ...remoteJoinedEvents].forEach((e) => byId.set(e.id, e));
    return Array.from(byId.values());
  }, [joinedEvents, remoteJoinedEvents]);

  const displayCreatedUpcoming = useMemo(() => {
    if (!user) return [];
    const m = new Map<string, EventItem>();
    remoteCreatedUpcoming.forEach((e) => m.set(e.id, e));
    events.filter((e) => !e.isDraft && sameUserId(e.organizerId, user.id) && isEventUpcoming(e) && !e.isCancelled).forEach((e) => m.set(e.id, e));
    return Array.from(m.values()).sort((a, b) => eventStartMs(a) - eventStartMs(b));
  }, [remoteCreatedUpcoming, events, user]);

  const displayCreatedPast = useMemo(() => {
    if (!user) return [];
    const m = new Map<string, EventItem>();
    remoteCreatedPast.forEach((e) => m.set(e.id, e));
    events.filter((e) => !e.isDraft && sameUserId(e.organizerId, user.id) && !isEventUpcoming(e) && !e.isCancelled).forEach((e) => m.set(e.id, e));
    return Array.from(m.values()).sort((a, b) => eventStartMs(b) - eventStartMs(a));
  }, [remoteCreatedPast, events, user]);

  const displayCancelled = useMemo(() => {
    if (!user) return [];
    return events.filter((e) => (sameUserId(e.organizerId, user.id) || e.participants.includes(user.id)) && e.isCancelled);
  }, [events, user]);

  const createdIds = useMemo(() => new Set([...displayCreatedUpcoming, ...displayCreatedPast].map(e => e.id)), [displayCreatedUpcoming, displayCreatedPast]);
  const joinedEventsOnly = useMemo(() => allJoinedEvents.filter(e => !createdIds.has(e.id) && !e.isCancelled), [allJoinedEvents, createdIds]);

  const displayJoinedUpcoming = useMemo(() => joinedEventsOnly.filter(isEventUpcoming).sort((a, b) => eventStartMs(a) - eventStartMs(b)), [joinedEventsOnly]);
  const displayJoinedPast = useMemo(() => joinedEventsOnly.filter(e => !isEventUpcoming(e)).sort((a, b) => eventStartMs(b) - eventStartMs(a)), [joinedEventsOnly]);

  const unifiedUpcoming = useMemo(() => [...displayCreatedUpcoming.map(e => ({ e, isCreated: true })), ...displayJoinedUpcoming.map(e => ({ e, isCreated: false }))], [displayCreatedUpcoming, displayJoinedUpcoming]);
  const unifiedPast = useMemo(() => [...displayCreatedPast, ...displayJoinedPast].map(e => ({ e, isCreated: createdIds.has(e.id) })), [displayCreatedPast, displayJoinedPast, createdIds]);
  const unifiedCancelled = useMemo(() => displayCancelled.map(e => ({ e, isCreated: sameUserId(e.organizerId, user?.id || '') })), [displayCancelled, user?.id]);

  const approvedRequests = useMemo(() => {
    if (!user) return [];
    return getJoinRequests().filter(r => r.userId === user.id && r.status === 'approved').map(r => {
      const evt = events.find(e => e.id === r.eventId);
      return evt && !evt.participants.includes(user.id) ? { request: r, event: evt } : null;
    }).filter(Boolean);
  }, [user, events]);

  // Initial Load
  useEffect(() => {
    const token = getAuthToken();
    if (!token) { setProfileLoading(false); return; }
    
    let cancelled = false;
    (async () => {
      try {
        const [resProf, resFavs] = await Promise.all([
          fetch(getApiUrl(API_ENDPOINTS.PROFILE_ME), { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }),
          fetch(getApiUrl('/api/favorites/all'), { headers: { Authorization: `Bearer ${token}` } })
        ]);
        
        if (resProf.ok && !cancelled) {
          const raw = await resProf.json();
          const data = raw.data || raw.user || raw;
          if (data.id) {
            setCurrentUserFromOAuth({
              id: String(data.id),
              email: String(data.email || ""),
              name: String(data.full_name || data.name || ""),
              username: String(data.username),
              bio: String(data.bio || ""),
              avatar: data.avatar_url,
              interests: Array.isArray(data.interests) ? data.interests : [],
            });
            const loadedName = String(data.full_name || data.name || '');
            const loadedAvatar = typeof data.avatar_url === 'string' ? data.avatar_url : '';
            const loadedBanner = typeof data.banner_url === 'string' ? data.banner_url : '';
            setName(loadedName);
            setSavedName(loadedName);
            setSavedBio(String(data.bio || ''));
            setSavedInterests(Array.isArray(data.interests) ? data.interests : []);
            setUsername(typeof data.username === 'string' ? data.username : '');
            
            setAvatarUrl(loadedAvatar);
            setPreviewAvatarUrl(loadedAvatar);
            
            setBannerUrl(loadedBanner);
            setPreviewBannerUrl(loadedBanner);

            const kind = data.avatar_kind === 'photo' ? 'photo' : 'icon';
            setAvatarKind(kind);
            setPreviewAvatarKind(kind);

            setIconId(typeof data.icon_id === 'string' && data.icon_id ? data.icon_id : PROFILE_ICONS.find((i) => i.url === loadedAvatar)?.id ?? '');
            setBio(data.bio || "");
            setInterests(Array.isArray(data.interests) ? data.interests : []);
          }
        }

        if (resFavs.ok && !cancelled) {
          const favData = await resFavs.json();
          setFavorites((favData || []).map(mapApiEventToItem));
        }
      } catch (err) { console.error(err); } finally { if (!cancelled) setProfileLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  // Event Data Load
  useEffect(() => {
    if (!user) return;
    const token = getAuthToken();
    if (!token) return;

    (async () => {
      try {
        const [resJoined, resCreated] = await Promise.all([
          fetch(getApiUrl('/api/participants/my/events'), { headers: { Authorization: `Bearer ${token}` } }),
          fetch(getApiUrl(`${API_ENDPOINTS.EVENTS}/my-events`), { headers: { Authorization: `Bearer ${token}` } })
        ]);

        if (resJoined.ok) {
          const joinedBody = await resJoined.json();
          setRemoteJoinedEvents((joinedBody || []).map((row: any) => mapApiEventToItem(row.events)).filter(Boolean));
        }

        if (resCreated.ok) {
          const createdBody = await resCreated.json();
          const rows = createdBody.data || [];
          setRemoteCreatedUpcoming(rows.map(mapApiEventToItem).filter(isEventUpcoming));
          setRemoteCreatedPast(rows.map(mapApiEventToItem).filter((e: any) => !isEventUpcoming(e)));
          rows.forEach((evt: any) => upsertEvent(mapApiEventToItem(evt)));
        }
        setLocalEventsEpoch(n => n + 1);
      } catch (err) { console.error(err); }
    })();
  }, [user?.id]);

  const handleStartEditing = () => {
    setPreviewAvatarUrl(avatarUrl);
    setPreviewBannerUrl(bannerUrl);
    setPreviewAvatarKind(avatarKind);
    setEditing(true);
  };

  const handleCancelEditing = () => {
    setName(savedName);
    setBio(savedBio);
    setInterests(savedInterests);
    setPreviewAvatarUrl(avatarUrl);
    setPreviewBannerUrl(bannerUrl);
    setPreviewAvatarKind(avatarKind);
    setNameError('');
    setEditing(false);
  };

  // Carousel Component Helper with Smart Scroll Tracking (Disables Left Arrow at Start)
  const CarouselSection = ({ title, children }: { title: string; children: React.ReactNode }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    const checkScroll = () => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        setCanScrollLeft(scrollLeft > 5);
        setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
      }
    };

    useEffect(() => {
      checkScroll();
      const el = scrollRef.current;
      if (el) {
        el.addEventListener('scroll', checkScroll);
        window.addEventListener('resize', checkScroll);
        return () => {
          el.removeEventListener('scroll', checkScroll);
          window.removeEventListener('resize', checkScroll);
        };
      }
    }, [children]);

    const scroll = (direction: 'left' | 'right') => {
      if (scrollRef.current) {
        scrollRef.current.scrollBy({ left: direction === 'left' ? -220 : 220, behavior: 'smooth' });
      }
    };

    return (
      <div className="space-y-2">
        {title && <p className="text-xs font-semibold text-center">{title}</p>}
        <div className="relative flex items-center">
          {/* Left Arrow - hidden when at the start */}
          {canScrollLeft && (
            <button 
              type="button" 
              onClick={() => scroll('left')} 
              className="absolute -left-3 z-10 h-7 w-7 rounded-full bg-secondary/90 border border-border flex items-center justify-center text-foreground shadow-md hover:bg-secondary transition-transform active:scale-95"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}

          <div 
            ref={scrollRef} 
            className="flex gap-2 overflow-x-auto px-2 py-1 w-full scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] snap-x"
          >
            {children}
          </div>

          {/* Right Arrow - hidden when at the end */}
          {canScrollRight && (
            <button 
              type="button" 
              onClick={() => scroll('right')} 
              className="absolute -right-3 z-10 h-7 w-7 rounded-full bg-secondary/90 border border-border flex items-center justify-center text-foreground shadow-md hover:bg-secondary transition-transform active:scale-95"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const handlePhotoUploadPreview = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user) return;
    try {
      const url = await uploadProfilePhotoToStorage(user.id, file);
      setPreviewAvatarUrl(url);
      setPreviewAvatarKind('photo');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Photo upload failed.';
      setToast({ show: true, message: storageRefusalMessage(message) || message, type: 'error' });
    }
  };

  const handleSave = async () => {
    const problem = getFullNameValidationError(name);
    if (problem) {
      setNameError(problem);
      setToast({ show: true, message: problem, type: 'error' });
      return;
    }
    const cleaned = normalizeFullName(name);
    const token = getAuthToken();
    if (token) {
      try {
        const payload = {
          full_name: cleaned,
          bio,
          interests,
          avatar_url: previewAvatarUrl,
          banner_url: previewBannerUrl || null,
          avatar_kind: previewAvatarKind,
        };
        const saveRes = await fetch(getApiUrl(API_ENDPOINTS.PROFILE_ME), { 
          method: 'PUT', 
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
          body: JSON.stringify(payload) 
        });
        if (!saveRes.ok) {
          const failed = await saveRes.json().catch(() => ({} as { detail?: string }));
          const detail = String(failed.detail || 'Could not save profile');
          setNameError(detail);
          setToast({ show: true, message: detail, type: 'error' });
          return;
        }
        const saved = await saveRes.json().catch(() => ({} as Record<string, unknown>));
        const savedProfile = (saved as { data?: Record<string, unknown> }).data || saved;
        
        const nextName = savedProfile && typeof savedProfile.full_name === 'string' ? savedProfile.full_name : cleaned;
        setName(nextName);
        setSavedName(nextName);
        setSavedBio(bio);
        setSavedInterests(interests);
        
        setAvatarUrl(previewAvatarUrl);
        setBannerUrl(previewBannerUrl);
        setAvatarKind(previewAvatarKind);
        setNameError('');

        updateUser({ name: nextName, bio, interests, avatar: previewAvatarUrl });
        window.dispatchEvent(new CustomEvent('eventapp:user-updated'));
        setEditing(false);
        setToast({ show: true, message: 'Profile updated successfully!', type: 'success' });
      } catch (err) { console.error(err); }
    }
  };

  const toggleInterest = (interest: string) => {
    setInterests((prev) => (
      prev.includes(interest) ? prev.filter((entry) => entry !== interest) : [...prev, interest]
    ));
  };

  const handleLeaveFromProfile = async (eventId: string) => {
    const token = getAuthToken();
    setLeavingEventId(eventId);
    if (token) {
      try { await fetch(getApiUrl(`/api/participants/${eventId}/leave`), { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); } catch (err) { console.error(err); }
    }
    leaveEvent(eventId, user!.id);
    setRemoteJoinedEvents(prev => prev.filter(e => e.id !== eventId));
    setLeavingEventId(null);
    setToast({ show: true, message: 'Left event', type: 'success' });
    invalidatePrefix('/api/events?');
    invalidatePrefix(`/api/participants/${eventId}`);
  };

  const handleRemoveFavorite = async (eventId: string) => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(getApiUrl(`/api/favorites/unsave-events/${eventId}`), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        setFavorites(prev => prev.filter(e => e.id !== eventId));
        setToast({ show: true, message: 'Removed from favorites', type: 'success' });
        invalidate(`/api/favorites/all:${user?.id ?? ''}`);
      }
    } catch (err) { console.error(err); }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) { setToast({ show: true, message: 'Please enter current password.', type: 'error' }); return; }
    if (newPassword.length < 8) { setToast({ show: true, message: 'Password must be at least 8 chars.', type: 'error' }); return; }
    if (newPassword !== confirmPassword) { setToast({ show: true, message: 'Passwords do not match.', type: 'error' }); return; }

    const token = getAuthToken();
    if (!token) return;
    setPasswordLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ access_token: token, current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ show: true, message: 'Password updated successfully.', type: 'success' });
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setShowPasswordModal(false);
      } else {
        setToast({ show: true, message: data.detail || 'Failed to update password.', type: 'error' });
      }
    } catch { setToast({ show: true, message: 'Something went wrong.', type: 'error' }); } finally { setPasswordLoading(false); }
  };

  const handleLogout = () => { logout(); clearAuthToken(); navigate('/login'); };

  if (profileLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" /></div>;
  if (!user) { navigate('/login'); return null; }

  const currentDisplayBanner = editing ? previewBannerUrl : bannerUrl;
  const currentDisplayAvatar = editing ? previewAvatarUrl : avatarUrl;

  const interestEmojiMap: Record<string, string> = {
    Music: '🎵', Sports: '⚽', Gaming: '🎮', Movies: '🎬',
    Study: '📚', Travel: '✈️', Tech: '💻', Art: '🎨',
    Fitness: '💪', Coffee: '☕', Networking: '🤝', Food: '🍕', Wellness: '🧘',
  };

  const currentEventList = eventSubFilter === 'upcoming' ? unifiedUpcoming : eventSubFilter === 'past' ? unifiedPast : unifiedCancelled;

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />

      <div
        data-testid="profile-banner"
        className={`relative h-36 bg-gradient-to-r from-primary/30 to-accent/30 ${currentDisplayBanner ? 'bg-cover bg-center' : ''}`}
        style={currentDisplayBanner ? { backgroundImage: `url("${currentDisplayBanner}")` } : undefined}
      >
        <button onClick={handleLogout} className="absolute top-3 right-3 z-10 flex items-center gap-1 text-xs text-foreground/80 glass-card rounded-full px-3 py-1.5 transition-transform active:scale-95"><LogOut className="h-3 w-3" /> Logout</button>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg px-4 -mt-14 relative z-10 space-y-5">
        <div className="flex flex-col items-center gap-2">
          <span data-testid="profile-picture" data-avatar-kind={editing ? previewAvatarKind : avatarKind}>
            <UserAvatar
              src={resolveAvatarDisplayUrl({ photoUrl: currentDisplayAvatar, altUrl: user.avatar, seed: iconId || user.id })}
              seed={iconId || user.id}
              name={name}
              size="xl"
              className="ring-4 ring-background shadow-glow"
            />
          </span>

          <div className="flex items-center gap-2">
            {editing ? (
              <div className="space-y-1">
                <input value={name} onChange={e => { setName(e.target.value); setNameError(''); }} aria-label="Full name" className="w-full rounded-xl bg-secondary px-4 py-2 text-center outline-none focus:ring-2 focus:ring-primary/50 font-bold" />
                <p className="text-[11px] text-muted-foreground text-center">{FULL_NAME_RULES_HINT}</p>
                {nameError && <p className="text-xs text-destructive text-center">{nameError}</p>}
              </div>
            ) : (
              <h2 className="text-xl font-bold flex items-center gap-2" data-testid="profile-full-name">
                {name}
                <button onClick={handleStartEditing} className="p-1 rounded-full text-muted-foreground hover:text-foreground transition-colors" title="Edit Profile">
                  <Edit2 className="h-4 w-4" />
                </button>
              </h2>
            )}
          </div>

          <p className="text-sm text-muted-foreground" data-testid="profile-username">@{username}</p>

          {editing && (
            <div className="w-full space-y-5 pt-3 border-t border-border/40 mt-2 px-4">
              {/* Combined Avatars & Icons Carousel with Upload Button FIRST */}
            <CarouselSection title="Profile Picture">
              {/* 1. First item: Upload Button Circle with Tooltip */}
              <div className="relative group flex-shrink-0">
                <button
                  type="button"
                  onClick={() => photoRef.current?.click()}
                  className={`h-12 w-12 rounded-full bg-secondary flex items-center justify-center text-foreground hover:bg-secondary/80 ring-2 transition-transform active:scale-95 ${previewAvatarKind === 'photo' ? 'ring-primary bg-primary/10' : 'ring-border/40'}`}
                  title="Upload photo"
                >
                  <Upload className="h-5 w-5 text-primary" />
                </button>
                <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUploadPreview} className="hidden" />
                
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-40 p-2 rounded-xl bg-popover text-popover-foreground text-[10px] text-center shadow-xl border border-border pointer-events-none z-50">
                  Upload photo (JPEG, PNG, WebP · Max 5MB)
                </div>
              </div>

              {/* 2. Followed by all Avatars */}
              {PROFILE_AVATARS.map((avatar) => (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => { setPreviewAvatarUrl(avatar.url); setPreviewAvatarKind('icon'); }}
                  className={`snap-start flex-shrink-0 p-1 rounded-full ring-2 transition-transform active:scale-95 ${previewAvatarUrl === avatar.url && previewAvatarKind === 'icon' ? 'ring-primary bg-primary/10' : 'ring-border/40'}`}
                >
                  <img src={avatar.url} alt="" className="h-12 w-12 rounded-full bg-secondary object-cover" />
                </button>
              ))}

              {/* 3. Followed by Icons */}
              {PROFILE_ICONS.map((icon) => (
                <button
                  key={icon.id}
                  type="button"
                  onClick={() => { setPreviewAvatarUrl(icon.url); setPreviewAvatarKind('icon'); setIconId(icon.id); }}
                  className={`snap-start flex-shrink-0 p-1 rounded-full ring-2 transition-transform active:scale-95 ${previewAvatarUrl === icon.url && previewAvatarKind === 'icon' ? 'ring-primary bg-primary/10' : 'ring-border/40'}`}
                >
                  <img src={icon.url} alt="" className="h-12 w-12 rounded-full object-cover" />
                </button>
              ))}
            </CarouselSection>

              <CarouselSection title="Banner">
                <button
                  type="button"
                  onClick={() => setPreviewBannerUrl('')}
                  className={`snap-start flex-shrink-0 flex items-center justify-center h-16 w-28 rounded-xl text-xs font-medium border bg-secondary ${!previewBannerUrl ? 'border-primary ring-2 ring-primary' : 'border-border'}`}
                >
                  None
                </button>
                {PROFILE_BANNERS.map((banner) => (
                  <button
                    key={banner.id}
                    type="button"
                    onClick={() => setPreviewBannerUrl(banner.url)}
                    className={`snap-start flex-shrink-0 h-16 w-32 rounded-xl bg-cover bg-center ring-2 transition-transform active:scale-95 ${previewBannerUrl === banner.url ? 'ring-primary' : 'ring-border/40'}`}
                    style={{ backgroundImage: `url("${banner.url}")` }}
                  />
                ))}
              </CarouselSection>
            </div>
          )}
        </div>

        {/* Bio */}
        <div className="rounded-2xl glass-card p-4 space-y-2">
          <h3 className="text-sm font-semibold">Bio</h3>
          {editing ? <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className="w-full rounded-lg bg-secondary p-3 text-sm resize-none outline-none" /> : <p className="text-sm text-muted-foreground">{bio || 'No bio yet.'}</p>}
        </div>

        {/* Interests Carousel */}
        <div className="rounded-2xl glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Interests</h3>
            {interests.length > 0 && <span className="text-[10px] text-muted-foreground">{interests.length} selected</span>}
          </div>

          {editing ? (
            <CarouselSection title="">
              {ALL_INTERESTS.map((interest) => {
                const selected = interests.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className={`snap-start flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 border ${selected ? 'bg-primary/20 border-primary/50 text-primary shadow-sm' : 'bg-secondary/60 border-border/60 text-muted-foreground hover:border-border'}`}
                  >
                    <span>{interestEmojiMap[interest] ?? '✨'}</span>
                    <span>{interest}</span>
                  </button>
                );
              })}
            </CarouselSection>
          ) : interests.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {interests.map((interest) => (
                <span key={interest} className="flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-medium text-primary">
                  <span>{interestEmojiMap[interest] ?? '✨'}</span>{interest}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">No interests selected yet.</p>
          )}
        </div>

        {/* Save/Cancel Buttons */}
        {editing && (
          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={handleCancelEditing} className="rounded-full border border-border bg-secondary px-5 py-2 text-xs font-semibold text-foreground hover:bg-secondary/80">
              Cancel
            </button>
            <button onClick={handleSave} className="flex items-center gap-1.5 rounded-full gradient-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-glow">
              <Check className="h-3.5 w-3.5" /> Save Changes
            </button>
          </div>
        )}

        {/* Change Password Modal Trigger */}
        <div className="rounded-2xl glass-card p-4">
          <button onClick={() => setShowPasswordModal(true)} className="flex w-full items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4 text-primary" /> Change Password</h3>
            <span className="text-xs text-primary font-medium hover:underline">Update</span>
          </button>
        </div>

        {/* Password Popup Modal */}
        <AnimatePresence>
          {showPasswordModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-sm rounded-3xl glass-card p-6 space-y-4 border border-border bg-background shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold">Change Password</h3>
                  <button onClick={() => setShowPasswordModal(false)} className="p-1 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                
                <div className="space-y-3 pt-2">
                  <div className="relative">
                    <input type={showCurrentPassword ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Current password" className="w-full rounded-xl bg-secondary/80 px-4 py-3 pr-10 text-sm outline-none border border-border/50" />
                    <button type="button" onClick={() => setShowCurrentPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="relative">
                    <input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password (min 8 chars)" className="w-full rounded-xl bg-secondary/80 px-4 py-3 pr-10 text-sm outline-none border border-border/50" />
                    <button type="button" onClick={() => setShowNewPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="relative">
                    <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="w-full rounded-xl bg-secondary/80 px-4 py-3 pr-10 text-sm outline-none border border-border/50" />
                    <button type="button" onClick={() => setShowConfirmPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-3">
                  <button onClick={() => setShowPasswordModal(false)} className="flex-1 rounded-xl border border-border bg-secondary py-3 text-xs font-semibold hover:bg-secondary/80">
                    Cancel
                  </button>
                  <button onClick={handleChangePassword} disabled={passwordLoading} className="flex-1 gradient-primary rounded-xl py-3 text-xs font-semibold text-primary-foreground shadow-glow">
                    {passwordLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Pending Payments */}
        {approvedRequests.length > 0 && (
          <div className="rounded-2xl glass-card p-4 space-y-3 glow-border">
            <h3 className="text-sm font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4 text-accent" /> Pending Payments</h3>
            {approvedRequests.map((item: any) => (
              <div key={item.request.id} className="flex items-center gap-3 rounded-xl bg-secondary/50 p-3">
                <img src={item.event.image} className="h-10 w-10 rounded-lg object-cover" />
                <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{item.event.title}</p><p className="text-[10px] text-accent">Approved — Pay to join</p></div>
                <button onClick={() => navigate(`/payment/${item.event.id}`)} className="gradient-primary rounded-full px-3 py-1 text-xs font-semibold text-primary-foreground shadow-glow">Pay €{item.event.budget}</button>
              </div>
            ))}
          </div>
        )}

        {/* Main Tabs (Events vs Favorites) */}
        <div className="flex rounded-xl glass-card p-1">
          {[{ id: 'events', label: 'Events', icon: Star }, { id: 'favorites', label: 'Favorites', icon: Heart }].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium transition-all ${activeTab === tab.id ? 'gradient-primary text-primary-foreground shadow-glow' : 'text-muted-foreground'}`}><tab.icon className="h-3.5 w-3.5" />{tab.label}</button>
          ))}
        </div>

        {/* Content Section */}
        <div className="space-y-4 min-h-[300px]">
          {activeTab === 'events' && (
            <div className="space-y-4">
              {/* Compact Sub-filter Pills */}
              <div className="flex rounded-xl bg-secondary/60 p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setEventSubFilter('upcoming')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${eventSubFilter === 'upcoming' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Upcoming ({unifiedUpcoming.length})
                </button>
                <button
                  type="button"
                  onClick={() => setEventSubFilter('past')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${eventSubFilter === 'past' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Past ({unifiedPast.length})
                </button>
                <button
                  type="button"
                  onClick={() => setEventSubFilter('cancelled')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${eventSubFilter === 'cancelled' ? 'bg-destructive text-destructive-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Cancelled ({unifiedCancelled.length})
                </button>
              </div>

              {/* Compact Event List */}
              <div className="space-y-2.5">
                {currentEventList.length === 0 ? (
                  <p className="text-center py-8 text-xs text-muted-foreground">No {eventSubFilter} events found.</p>
                ) : (
                  currentEventList.slice(0, visibleEvents).map(({ e, isCreated }) => {
                    const isCancelled = eventSubFilter === 'cancelled';
                    const isPast = eventSubFilter === 'past';
                    return (
                      <div key={e.id} className={`flex items-center gap-3 rounded-2xl glass-card p-2.5 transition-all hover:border-primary/40 ${isCancelled ? 'opacity-60 bg-destructive/5' : isPast ? 'opacity-70' : ''}`}>
                        <img src={e.image} alt="" className="h-12 w-12 rounded-xl object-cover flex-shrink-0" />
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/event/${e.id}`)}>
                          <p className="text-xs font-bold line-clamp-1 text-foreground">{e.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              isCancelled ? 'bg-destructive/10 text-destructive' :
                              isCreated ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'
                            }`}>
                              {isCancelled ? 'Cancelled' : isCreated ? 'Created' : 'Joined'}
                            </span>
                            <p className="text-[10px] text-muted-foreground">{e.date}</p>
                          </div>
                        </div>

                        {!isCancelled && !isPast && !isCreated && (
                          <button onClick={() => handleLeaveFromProfile(e.id)} disabled={leavingEventId === e.id} className="text-[10px] text-muted-foreground hover:text-destructive bg-secondary/50 px-3 py-1 rounded-lg transition-colors">
                            {leavingEventId === e.id ? '...' : 'Leave'}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}

                {currentEventList.length > 4 && (
                  <div className="flex gap-2 pt-2">
                    {visibleEvents < currentEventList.length && (
                      <button type="button" onClick={() => setVisibleEvents(v => v + 4)} className="flex-1 rounded-xl border border-border py-2 text-xs font-medium text-primary hover:bg-secondary/50 transition-colors">
                        View more · {currentEventList.length - visibleEvents} remaining
                      </button>
                    )}
                    {visibleEvents > 4 && (
                      <button type="button" onClick={() => setVisibleEvents(4)} className="flex-1 rounded-xl py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                        Show less
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'favorites' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold px-1">Saved Events</h3>
              {favorites.length === 0 ? (
                <p className="text-center py-8 text-xs text-muted-foreground">You haven't saved any events yet.</p>
              ) : (
                <>
                  <div className="space-y-2.5">
                    {favorites.slice(0, visibleFavorites).map(e => (
                      <div key={e.id} className="flex items-center gap-3 rounded-2xl glass-card p-2.5 transition-all hover:border-primary/40">
                        <img src={e.image} alt="" className="h-12 w-12 rounded-xl object-cover flex-shrink-0 cursor-pointer" onClick={() => navigate(`/event/${e.id}`)} />
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/event/${e.id}`)}>
                          <p className="text-xs font-bold line-clamp-1">{e.title}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{e.date} · {e.location}</p>
                        </div>
                        <button onClick={() => handleRemoveFavorite(e.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-2">
                    {visibleFavorites < favorites.length && (
                      <button type="button" onClick={() => setVisibleFavorites(v => v + 4)} className="flex-1 rounded-xl border border-border py-2 text-xs font-medium text-primary hover:bg-secondary/50 transition-colors">
                        View more · {favorites.length - visibleFavorites} remaining
                      </button>
                    )}
                    {visibleFavorites > 4 && (
                      <button type="button" onClick={() => setVisibleFavorites(4)} className="flex-1 rounded-xl py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                        Show less
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
      <BottomNav />
    </div>
  );
}