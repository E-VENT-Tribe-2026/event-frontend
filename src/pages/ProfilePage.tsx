import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  getCurrentUser, 
  setCurrentUserFromOAuth,
  updateUser, 
  getEvents, 
  getUsers, 
  getJoinRequests, 
  leaveEvent, 
  upsertEvent, 
  type EventItem 
} from '@/lib/storage';
import { logout } from '@/lib/storage';
import { useNavigate } from 'react-router-dom';
import { LogOut, Edit2, Check, Star, UserPlus, CreditCard, Heart, Trash2, Lock, Eye, EyeOff, ChevronDown } from 'lucide-react';
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
import { FULL_NAME_RULES_HINT, fullNameError } from '@/lib/username';
import { profilePhotoError } from '@/lib/profilePhoto';
import { uploadProfilePhotoToStorage } from '@/lib/uploadAvatar';

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
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '');
  const [avatarKind, setAvatarKind] = useState<'photo' | 'icon'>('icon');
  const [iconId, setIconId] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [savedName, setSavedName] = useState(user?.name || '');
  const [nameError, setNameError] = useState('');
  const [icons, setIcons] = useState<Array<{ id: string; url: string }>>([]);
  const [banners, setBanners] = useState<Array<{ id: string; label: string; url: string }>>([]);
  const photoRef = useRef<HTMLInputElement>(null);
  const [bio, setBio] = useState(user?.bio || '');
  const [interests, setInterests] = useState<string[]>(user?.interests || []);
  const [showInterests, setShowInterests] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [activeTab, setActiveTab] = useState<'events' | 'favorites'>('events');
  const [visibleUpcoming, setVisibleUpcoming] = useState(3);
  const [visiblePast, setVisiblePast] = useState(3);
  const [visibleFavorites, setVisibleFavorites] = useState(3);

  // Password State
  const [showPasswordSection, setShowPasswordSection] = useState(false);
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
  const [loadingCreatedEvents, setLoadingCreatedEvents] = useState(false);
  const [localEventsEpoch, setLocalEventsEpoch] = useState(0);
  const [leavingEventId, setLeavingEventId] = useState<string | null>(null);

  // Memoized Data
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
    events.filter((e) => !e.isDraft && sameUserId(e.organizerId, user.id) && isEventUpcoming(e)).forEach((e) => m.set(e.id, e));
    return Array.from(m.values()).sort((a, b) => eventStartMs(a) - eventStartMs(b));
  }, [remoteCreatedUpcoming, events, user]);

  const displayCreatedPast = useMemo(() => {
    if (!user) return [];
    const m = new Map<string, EventItem>();
    remoteCreatedPast.forEach((e) => m.set(e.id, e));
    events.filter((e) => !e.isDraft && sameUserId(e.organizerId, user.id) && !isEventUpcoming(e)).forEach((e) => m.set(e.id, e));
    return Array.from(m.values()).sort((a, b) => eventStartMs(b) - eventStartMs(a));
  }, [remoteCreatedPast, events, user]);

  const createdIds = useMemo(() => new Set([...displayCreatedUpcoming, ...displayCreatedPast].map(e => e.id)), [displayCreatedUpcoming, displayCreatedPast]);
  const joinedEventsOnly = useMemo(() => allJoinedEvents.filter(e => !createdIds.has(e.id)), [allJoinedEvents, createdIds]);

  const displayJoinedUpcoming = useMemo(() => joinedEventsOnly.filter(isEventUpcoming).sort((a, b) => eventStartMs(a) - eventStartMs(b)), [joinedEventsOnly]);
  const displayJoinedPast = useMemo(() => joinedEventsOnly.filter(e => !isEventUpcoming(e)).sort((a, b) => eventStartMs(b) - eventStartMs(a)), [joinedEventsOnly]);

  const approvedRequests = useMemo(() => {
    if (!user) return [];
    return getJoinRequests().filter(r => r.userId === user.id && r.status === 'approved').map(r => {
      const evt = events.find(e => e.id === r.eventId);
      return evt && !evt.participants.includes(user.id) ? { request: r, event: evt } : null;
    }).filter(Boolean);
  }, [user, events]);

  // Initial Load: Profile & Favorites
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
              bio: String(data.bio || ""),
              avatar: data.avatar_url,
              interests: Array.isArray(data.interests) ? data.interests : [],
            });
            const loadedName = String(data.full_name || data.name || "");
            setName(loadedName);
            setSavedName(loadedName);
            setUsername(typeof data.username === 'string' ? data.username : '');
            setAvatarUrl(typeof data.avatar_url === 'string' ? data.avatar_url : '');
            setAvatarKind(data.avatar_kind === 'photo' ? 'photo' : 'icon');
            setIconId(typeof data.icon_id === 'string' ? data.icon_id : '');
            setBannerUrl(typeof data.banner_url === 'string' ? data.banner_url : '');
            setBio(data.bio || "");
            setInterests(Array.isArray(data.interests) ? data.interests : []);
          }
        }

        const assetsRes = await fetch(getApiUrl('/api/profile/assets'));
        if (assetsRes.ok && !cancelled) {
          const catalog = await assetsRes.json();
          if (Array.isArray(catalog.icons)) setIcons(catalog.icons);
          if (Array.isArray(catalog.banners)) setBanners(catalog.banners);
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
      setLoadingCreatedEvents(true);
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
      } catch (err) { console.error(err); } finally { setLoadingCreatedEvents(false); }
    })();
  }, [user?.id]);

  const handleLeaveFromProfile = async (eventId: string) => {
    const token = getAuthToken();
    setLeavingEventId(eventId);
    if (token) {
      try {
        await fetch(getApiUrl(`/api/participants/${eventId}/leave`), { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      } catch (err) { console.error(err); }
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

  const persistPicture = async (next: { avatar_url?: string; banner_url?: string | null }) => {
    const token = getAuthToken();
    if (!token) return false;
    const res = await fetch(getApiUrl(API_ENDPOINTS.PROFILE_ME), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(next),
    });
    return res.ok;
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    const problem = profilePhotoError(file);
    if (problem) {
      setToast({ show: true, message: problem, type: 'error' });
      return;
    }
    try {
      const url = await uploadProfilePhotoToStorage(file, user.id);
      const ok = await persistPicture({ avatar_url: url });
      if (!ok) {
        setToast({ show: true, message: 'Photo could not be saved on your profile.', type: 'error' });
        return;
      }
      setAvatarUrl(url);
      setAvatarKind('photo');
      setIconId('');
      updateUser({ avatar: url });
      setToast({ show: true, message: 'Photo uploaded.', type: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Photo was refused by storage';
      const lowered = message.toLowerCase();
      const reason = lowered.includes('size') || lowered.includes('large') || lowered.includes('payload')
        ? 'Photo must be 5 MB or smaller'
        : lowered.includes('mime') || lowered.includes('type') || lowered.includes('format')
          ? 'Photo must be a JPEG, PNG or WebP image'
          : message;
      setToast({ show: true, message: reason, type: 'error' });
    }
  };

  const handlePickIcon = async (icon: { id: string; url: string }) => {
    const ok = await persistPicture({ avatar_url: icon.url });
    if (!ok) {
      setToast({ show: true, message: 'Icon could not be saved.', type: 'error' });
      return;
    }
    setAvatarUrl(icon.url);
    setAvatarKind('icon');
    setIconId(icon.id);
    updateUser({ avatar: icon.url });
  };

  const handlePickBanner = async (url: string | null) => {
    const ok = await persistPicture({ banner_url: url });
    if (!ok) {
      setToast({ show: true, message: 'Banner could not be saved.', type: 'error' });
      return;
    }
    setBannerUrl(url || '');
  };

  const handleSave = async () => {
    const nameProblem = fullNameError(name);
    if (nameProblem) {
      setNameError(nameProblem);
      setToast({ show: true, message: nameProblem, type: 'error' });
      return;
    }
    setNameError('');
    const token = getAuthToken();
    if (!token) return;
    try {
      const saved = await fetch(getApiUrl(API_ENDPOINTS.PROFILE_ME), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          full_name: name.trim(),
          bio,
          interests,
          avatar_url: avatarUrl || null,
          banner_url: bannerUrl || null,
        }),
      });
      const savedBody = await saved.json().catch(() => ({} as { detail?: string; full_name?: string }));
      if (!saved.ok) {
        const detail = String(savedBody.detail || 'Profile could not be saved');
        setNameError(detail);
        setToast({ show: true, message: detail, type: 'error' });
        return;
      }
      const keptName = typeof savedBody.full_name === 'string' ? savedBody.full_name : name.trim();
      setName(keptName);
      setSavedName(keptName);
      updateUser({ name: keptName, bio, interests, avatar: avatarUrl });
      window.dispatchEvent(new CustomEvent('eventapp:user-updated'));
      setEditing(false);
      setToast({ show: true, message: 'Profile updated!', type: 'success' });
    } catch {
      setToast({ show: true, message: 'Connection failed', type: 'error' });
    }
  };

  const toggleInterest = (interest: string) => {
    setInterests((prev) => (
      prev.includes(interest)
        ? prev.filter((entry) => entry !== interest)
        : [...prev, interest]
    ));
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      setToast({ show: true, message: 'Please enter your current password.', type: 'error' });
      return;
    }
    if (newPassword.length < 8) {
      setToast({ show: true, message: 'Password must be at least 8 characters.', type: 'error' });
      return;
    }
    if (newPassword === currentPassword) {
      setToast({ show: true, message: 'New password must be different from current password.', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setToast({ show: true, message: 'Passwords do not match.', type: 'error' });
      return;
    }

    const token = getAuthToken();
    if (!token) return;

    setPasswordLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          access_token: token,
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setToast({ show: true, message: 'Password updated successfully.', type: 'success' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordSection(false);
      } else {
        setToast({ show: true, message: data.detail || 'Failed to update password.', type: 'error' });
      }
    } catch {
      setToast({ show: true, message: 'Something went wrong. Please try again.', type: 'error' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = () => { logout(); clearAuthToken(); navigate('/login'); };

  if (profileLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" /></div>;
  if (!user) { navigate('/login'); return null; }

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />

      <div
        data-testid="profile-banner"
        className={`relative h-36 bg-gradient-to-r from-primary/30 to-accent/30 ${bannerUrl ? 'bg-cover bg-center' : ''}`}
        style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : undefined}
      >
        <button onClick={handleLogout} className="absolute top-3 right-3 z-10 flex items-center gap-1 text-xs text-foreground/80 glass-card rounded-full px-3 py-1.5 transition-transform active:scale-95"><LogOut className="h-3 w-3" /> Logout</button>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg px-4 -mt-14 relative z-10 space-y-5">
        <div className="flex flex-col items-center gap-2">
          <span data-testid="profile-picture" data-avatar-kind={avatarKind} data-icon-id={iconId}>
            <UserAvatar
              src={avatarUrl || user.avatar}
              seed={iconId || user.id}
              name={name}
              size="xl"
              alt={avatarKind === 'photo' ? 'Profile photo' : `Profile icon${iconId ? ` ${iconId}` : ''}`}
              className="ring-4 ring-background shadow-glow"
            />
          </span>
          {editing ? (
            <div className="w-full space-y-1">
              <input value={name} onChange={e => { setName(e.target.value); setNameError(''); }} aria-label="Full name" className="w-full rounded-xl bg-secondary px-4 py-2 text-center outline-none focus:ring-2 focus:ring-primary/50 font-bold" aria-describedby="edit-full-name-rules" />
              <p id="edit-full-name-rules" className="text-[11px] text-muted-foreground text-center">{FULL_NAME_RULES_HINT}</p>
              {nameError && <p className="text-xs text-destructive text-center">{nameError}</p>}
            </div>
          ) : <h2 className="text-xl font-bold" data-testid="profile-full-name">{name}</h2>}
          <p className="text-sm text-muted-foreground" data-testid="profile-username">{username}</p>
          {editing && <p className="text-[11px] text-muted-foreground">Username cannot be changed</p>}
          {editing ? (
            <div className="w-full space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-center">Profile photo</p>
                <button type="button" onClick={() => photoRef.current?.click()} className="mx-auto block rounded-full border border-border px-4 py-1.5 text-xs font-semibold">
                  Upload photo
                </button>
                <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} className="hidden" />
                <p className="text-[11px] text-muted-foreground text-center">JPEG, PNG or WebP, up to 5 MB.</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-center">Icon</p>
                <div className="grid grid-cols-6 gap-2">
                  {icons.map((icon) => (
                    <button key={icon.id} type="button" onClick={() => handlePickIcon(icon)} aria-label={`Icon ${icon.id}`} className={`rounded-full ring-2 ${iconId === icon.id && avatarKind === 'icon' ? 'ring-primary' : 'ring-transparent'}`}>
                      <img src={icon.url} alt="" className="h-10 w-10 rounded-full" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-center">Banner</p>
                <button type="button" onClick={() => handlePickBanner(null)} className={`rounded-lg px-3 py-1 text-xs ${bannerUrl ? 'bg-secondary' : 'ring-2 ring-primary'}`}>
                  No banner
                </button>
                <div className="grid grid-cols-3 gap-2">
                  {banners.map((banner) => (
                    <button key={banner.id} type="button" onClick={() => handlePickBanner(banner.url)} aria-label={`Banner ${banner.label}`} className={`h-12 rounded-lg bg-cover bg-center ring-2 ${bannerUrl === banner.url ? 'ring-primary' : 'ring-transparent'}`} style={{ backgroundImage: `url(${banner.url})` }} />
                  ))}
                </div>
              </div>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => {
                  setName(savedName);
                  setNameError('');
                  setBio(user.bio || '');
                  setInterests(user.interests || []);
                  setEditing(false);
                }}
                className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 rounded-full gradient-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow"
              >
                <Check className="h-3.5 w-3.5" /> Save
              </button>
            </div>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-full glass-card border border-border px-4 py-1.5 text-xs font-semibold text-foreground hover:border-primary/50 transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5" /> Edit Profile
            </button>
          )}
        </div>

        {/* Bio */}
        <div className="rounded-2xl glass-card p-4 space-y-2">
          <h3 className="text-sm font-semibold">Bio</h3>
          {editing ? <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className="w-full rounded-lg bg-secondary p-3 text-sm resize-none outline-none" /> : <p className="text-sm text-muted-foreground">{bio || 'No bio yet.'}</p>}
        </div>

        {/* Interests */}
        <div className="rounded-2xl glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Interests</h3>
            {interests.length > 0 && (
              <span className="text-[10px] text-muted-foreground">{interests.length} selected</span>
            )}
          </div>

          {editing ? (
            <div className="grid grid-cols-3 gap-2">
              {ALL_INTERESTS.map((interest) => {
                const emoji: Record<string, string> = {
                  Music: '🎵', Sports: '⚽', Gaming: '🎮', Movies: '🎬',
                  Study: '📚', Travel: '✈️', Tech: '💻', Art: '🎨',
                  Fitness: '💪', Coffee: '☕', Networking: '🤝', Food: '🍕', Wellness: '🧘',
                };
                const selected = interests.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-center transition-all active:scale-95 ${
                      selected
                        ? 'bg-primary/20 border border-primary/50 shadow-sm'
                        : 'bg-secondary/60 border border-transparent hover:border-border'
                    }`}
                  >
                    <span className="text-xl">{emoji[interest] ?? '✨'}</span>
                    <span className={`text-[10px] font-medium leading-tight ${selected ? 'text-primary' : 'text-muted-foreground'}`}>
                      {interest}
                    </span>
                    {selected && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                  </button>
                );
              })}
            </div>
          ) : interests.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {interests.map((interest) => {
                const emoji: Record<string, string> = {
                  Music: '🎵', Sports: '⚽', Gaming: '🎮', Movies: '🎬',
                  Study: '📚', Travel: '✈️', Tech: '💻', Art: '🎨',
                  Fitness: '💪', Coffee: '☕', Networking: '🤝', Food: '🍕', Wellness: '🧘',
                };
                return (
                  <span key={interest} className="flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-medium text-primary">
                    <span>{emoji[interest] ?? '✨'}</span>
                    {interest}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">No interests selected yet. Tap Edit Profile to add some.</p>
          )}
        </div>

        {/* Change Password */}
        <div className="rounded-2xl glass-card p-4 space-y-3">
          <button
            onClick={() => setShowPasswordSection(v => !v)}
            className="flex w-full items-center justify-between"
          >
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Lock className="h-4 w-4 text-primary" /> Change Password
            </h3>
            <span className="text-xs text-muted-foreground">{showPasswordSection ? 'Cancel' : 'Update'}</span>
          </button>

          {showPasswordSection && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 pt-1"
            >
              {/* Current Password */}
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Current Password</span>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full rounded-lg bg-secondary/80 px-3 py-2 pr-9 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button type="button" onClick={() => setShowCurrentPassword(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showCurrentPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </label>

              {/* New Password */}
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">New Password</span>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="w-full rounded-lg bg-secondary/80 px-3 py-2 pr-9 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button type="button" onClick={() => setShowNewPassword(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showNewPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </label>

              {/* Confirm Password */}
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Confirm Password</span>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full rounded-lg bg-secondary/80 px-3 py-2 pr-9 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </label>

              {/* Strength indicator */}
              {newPassword.length > 0 && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map(level => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          newPassword.length >= level * 3
                            ? level <= 1 ? 'bg-destructive'
                              : level === 2 ? 'bg-yellow-500'
                              : level === 3 ? 'bg-blue-500'
                              : 'bg-green-500'
                            : 'bg-secondary'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {newPassword.length < 4 ? 'Too short' : newPassword.length < 7 ? 'Weak' : newPassword.length < 10 ? 'Fair' : 'Strong'}
                  </p>
                </div>
              )}

              <button
                onClick={handleChangePassword}
                disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                className="w-full gradient-primary rounded-xl py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {passwordLoading ? 'Updating…' : 'Update Password'}
              </button>
            </motion.div>
          )}
        </div>

        {/* Pending Payments */}
        {approvedRequests.length > 0 && (
          <div className="rounded-2xl glass-card p-4 space-y-3 glow-border">
            <h3 className="text-sm font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4 text-accent" /> Pending Payments</h3>
            {approvedRequests.map((item: any) => (
              <div key={item.request.id} className="flex items-center gap-3 rounded-xl bg-secondary/50 p-3">
                <img src={item.event.image} className="h-10 w-10 rounded-lg object-cover" />
                <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{item.event.title}</p><p className="text-[10px] text-accent">Approved — Pay to join</p></div>
                <button onClick={() => navigate(`/payment/${item.event.id}`)} className="gradient-primary rounded-full px-3 py-1 text-xs font-semibold text-primary-foreground shadow-glow">Pay ${item.event.budget}</button>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex rounded-xl glass-card p-1">
          {[{ id: 'events', label: 'Events', icon: Star }, { id: 'favorites', label: 'Favorites', icon: Heart }].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium transition-all ${activeTab === tab.id ? 'gradient-primary text-primary-foreground shadow-glow' : 'text-muted-foreground'}`}><tab.icon className="h-3.5 w-3.5" />{tab.label}</button>
          ))}
        </div>

        <div className="space-y-4 min-h-[300px]">
          {activeTab === 'events' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold px-1">Upcoming</h3>
                {[...displayCreatedUpcoming, ...displayJoinedUpcoming].length === 0 && <p className="text-center py-4 text-xs text-muted-foreground">No upcoming events.</p>}
                
                {[...displayCreatedUpcoming.map(e => ({ e, isCreated: true })), ...displayJoinedUpcoming.map(e => ({ e, isCreated: false }))].slice(0, visibleUpcoming).map(({ e, isCreated }) =>
                  isCreated ? (
                    <div key={e.id} className="flex items-center gap-3 rounded-xl glass-card p-3 border border-primary/20 cursor-pointer" onClick={() => navigate(`/event/${e.id}`)}>
                      <img src={e.image} className="h-10 w-10 rounded-lg object-cover" />
                      <div className="flex-1">
                        <p className="text-xs font-bold line-clamp-1">{e.title}</p>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold uppercase">Created</span>
                      </div>
                      <div className="text-right"><p className="text-[10px] text-muted-foreground">{e.date}</p></div>
                    </div>
                  ) : (
                    <div key={e.id} className="flex items-center gap-3 rounded-xl glass-card p-3">
                      <img src={e.image} className="h-10 w-10 rounded-lg object-cover" />
                      <div className="flex-1 cursor-pointer" onClick={() => navigate(`/event/${e.id}`)}>
                        <p className="text-xs font-bold line-clamp-1">{e.title}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-bold uppercase">Joined</span>
                          <p className="text-[10px] text-muted-foreground">{e.date}</p>
                        </div>
                      </div>
                      <button onClick={() => handleLeaveFromProfile(e.id)} disabled={leavingEventId === e.id} className="text-[10px] text-muted-foreground hover:text-destructive bg-secondary/50 px-3 py-1 rounded-full transition-colors">{leavingEventId === e.id ? '...' : 'Leave'}</button>
                    </div>
                  )
                )}
                {(() => {
                  const total = displayCreatedUpcoming.length + displayJoinedUpcoming.length;
                  return (
                    <div className="flex gap-2">
                      {visibleUpcoming < total && (
                        <button type="button" onClick={() => setVisibleUpcoming(v => v + 3)} className="flex-1 rounded-xl border border-border py-2 text-xs font-medium text-primary hover:bg-secondary/50 transition-colors">
                          View more · {total - visibleUpcoming} remaining
                        </button>
                      )}
                      {visibleUpcoming > 3 && (
                        <button type="button" onClick={() => setVisibleUpcoming(3)} className="flex-1 rounded-xl py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                          Show less
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-semibold opacity-70 px-1">Past Events</h3>
                {[...displayCreatedPast, ...displayJoinedPast].length === 0 && <p className="text-center py-4 text-xs text-muted-foreground">No past events recorded.</p>}
                {[...displayCreatedPast, ...displayJoinedPast].slice(0, visiblePast).map(e => {
                  const isCreated = createdIds.has(e.id);
                  return (
                    <div key={e.id} className="flex items-center gap-3 rounded-xl glass-card p-3 opacity-60 grayscale-[0.5] cursor-pointer" onClick={() => navigate(`/event/${e.id}`)}>
                      <img src={e.image} className="h-10 w-10 rounded-lg object-cover" />
                      <div className="flex-1">
                        <p className="text-xs font-bold line-clamp-1">{e.title}</p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${isCreated ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'}`}>
                          {isCreated ? 'Created' : 'Joined'}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{e.date}</p>
                    </div>
                  );
                })}
                {(() => {
                  const total = displayCreatedPast.length + displayJoinedPast.length;
                  return (
                    <div className="flex gap-2">
                      {visiblePast < total && (
                        <button type="button" onClick={() => setVisiblePast(v => v + 3)} className="flex-1 rounded-xl border border-border py-2 text-xs font-medium text-primary hover:bg-secondary/50 transition-colors">
                          View more · {total - visiblePast} remaining
                        </button>
                      )}
                      {visiblePast > 3 && (
                        <button type="button" onClick={() => setVisiblePast(3)} className="flex-1 rounded-xl py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                          Show less
                        </button>
                      )}
                    </div>
                  );
                })()}
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
                  {favorites.slice(0, visibleFavorites).map(e => (
                    <div key={e.id} className="flex items-center gap-3 rounded-xl glass-card p-3">
                      <img src={e.image} className="h-10 w-10 rounded-lg object-cover cursor-pointer" onClick={() => navigate(`/event/${e.id}`)} />
                      <div className="flex-1 cursor-pointer" onClick={() => navigate(`/event/${e.id}`)}>
                        <p className="text-xs font-bold line-clamp-1">{e.title}</p>
                        <p className="text-[10px] text-muted-foreground">{e.date} · {e.location}</p>
                      </div>
                      <button onClick={() => handleRemoveFavorite(e.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    {visibleFavorites < favorites.length && (
                      <button type="button" onClick={() => setVisibleFavorites(v => v + 3)} className="flex-1 rounded-xl border border-border py-2 text-xs font-medium text-primary hover:bg-secondary/50 transition-colors">
                        View more · {favorites.length - visibleFavorites} remaining
                      </button>
                    )}
                    {visibleFavorites > 3 && (
                      <button type="button" onClick={() => setVisibleFavorites(3)} className="flex-1 rounded-xl py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
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