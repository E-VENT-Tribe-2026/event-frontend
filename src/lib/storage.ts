// In-memory "database" helpers (no localStorage)

export type UserRole = 'participant' | 'organizer';

export interface User {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  password: string;
  avatar: string;
  profilePhoto: string;
  coverPhoto: string;
  bio?: string;
  interests: string[];
  dob: string;
  gender: string;
  isPremium: boolean;
  friends: string[];
  // organizer-only fields
  orgCategory?: string;
  createdAt: string;
}

export interface JoinRequest {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface Ticket {
  id: string;
  eventId: string;
  userId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  qrCode: string;
  purchasedAt: string;
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  category: string;
  date: string;
  time: string;
  location: string;
  lat: number;
  lng: number;
  budget: number;
  participantsLimit: number;
  participants: string[];
  image: string;
  organizer: string;
  organizerId: string;
  organizerAvatar: string;
  isPrivate: boolean;
  isDraft: boolean;
  requiresApproval: boolean;
  reviews: { userId: string; user: string; text: string; rating: number }[];
  reports: { userId: string; reason: string; time: string }[];
  collaborators: string[];
  survey?: { question: string; options: string[] }[];
}

export interface ChatMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  time: string;
  type?: 'text' | 'emoji' | 'voice' | 'attachment';
}

export interface Notification {
  id: string;
  type:
    | 'join'
    | 'reminder'
    | 'message'
    | 'trending'
    | 'approval'
    | 'payment'
    | 'update'
    | 'cancellation';
  title: string;
  description: string;
  time: string;
  read: boolean;
}

let USERS: User[] = [];
let CURRENT_USER_ID: string | null = null;
let EVENTS: EventItem[] = [];
let NOTIFICATIONS: Notification[] = [];
let DRAFTS: EventItem[] = [];
let JOIN_REQUESTS: JoinRequest[] = [];
let TICKETS: Ticket[] = [];

/** Persisted next to `event_auth_token` so refresh keeps you signed in in the UI. */
export const SESSION_USER_SNAPSHOT_KEY = 'event_session_user';
const AUTH_TOKEN_SESSION_KEY = 'event_auth_token';

function persistCurrentUserToSession(): void {
  if (typeof window === 'undefined') return;
  const u = getCurrentUser();
  if (u) {
    try {
      window.sessionStorage.setItem(SESSION_USER_SNAPSHOT_KEY, JSON.stringify(u));
    } catch {
      /* ignore quota / private mode */
    }
  }
}

/** Call when clearing the auth token (logout / invalid session). */
export function clearSessionUserSnapshot(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(SESSION_USER_SNAPSHOT_KEY);
}

function restorePersistedCurrentUser(): void {
  if (typeof window === 'undefined') return;
  try {
    if (!window.sessionStorage.getItem(AUTH_TOKEN_SESSION_KEY)) {
      window.sessionStorage.removeItem(SESSION_USER_SNAPSHOT_KEY);
      return;
    }
    const raw = window.sessionStorage.getItem(SESSION_USER_SNAPSHOT_KEY);
    if (!raw) return;
    const user = JSON.parse(raw) as User;
    if (!user?.id || !user?.email) return;
    const users = getUsers();
    const existingIdx = users.findIndex((u) => u.id === user.id);
    if (existingIdx >= 0) {
      const merged = { ...users[existingIdx], ...user };
      saveUsers(users.map((u, i) => (i === existingIdx ? merged : u)));
    } else {
      saveUsers([...users, user]);
    }
    setCurrentUser(user.id);
  } catch {
    window.sessionStorage.removeItem(SESSION_USER_SNAPSHOT_KEY);
  }
}

// Users
export function getUsers(): User[] {
  return USERS;
}

export function saveUsers(users: User[]) {
  USERS = users;
}

export function getCurrentUser(): User | null {
  if (!CURRENT_USER_ID) return null;
  return getUsers().find(u => u.id === CURRENT_USER_ID) || null;
}

export function setCurrentUser(id: string) {
  CURRENT_USER_ID = id;
}

/** Create or update a user from OAuth (e.g. Google) and set as current user. */
export function setCurrentUserFromOAuth(data: { 
  id: string; 
  email: string; 
  name?: string; 
  avatar?: string;
  bio?: string;    // Add this
  dob?: string;    // Add this
  gender?: string; // Add this
  role?: string;   // Add this
}): void {
  const users = getUsers();
  const existing = users.find((u) => u.email === data.email || u.id === data.id);
  const now = new Date().toISOString();
  
  const name = data.name || data.email?.split('@')[0] || 'User';
  const avatar = data.avatar || `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(data.id)}`;

  if (existing) {
    const updated: User = {
      ...existing,
      id: data.id,
      name,
      email: data.email,
      avatar,
      bio: data.bio ?? existing.bio, // Preserve bio if provided
      dob: data.dob ?? existing.dob,
      gender: data.gender ?? existing.gender,
      role: (data.role as UserRole) ?? existing.role,
      profilePhoto: data.avatar || existing.profilePhoto || avatar,
    };
    saveUsers(users.map((u) => (u.id === existing.id || u.email === data.email ? updated : u)));
  } else {
    const newUser: User = {
      id: data.id,
      role: (data.role as UserRole) || 'participant',
      name,
      email: data.email,
      password: '',
      avatar,
      profilePhoto: data.avatar || avatar,
      coverPhoto: '',
      bio: data.bio || 'Hey there! I love events.', // Use API bio if available
      interests: ['Music', 'Tech', 'Food'],
      dob: data.dob || '',
      gender: data.gender || '',
      isPremium: false,
      friends: [],
      createdAt: now,
    };
    saveUsers([...users, newUser]);
  }
  setCurrentUser(data.id);
  persistCurrentUserToSession();
}

export function logout() {
  CURRENT_USER_ID = null;
  clearSessionUserSnapshot();
}

function generateId() {
  if (typeof window !== 'undefined' && window.crypto && 'randomUUID' in window.crypto) {
    return window.crypto.randomUUID();
  }
  return `user_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function signup(data: {
  role: UserRole;
  name: string;
  email: string;
  password: string;
  profilePhoto: string;
  dob: string;
  gender: string;
  interests: string[];
  orgCategory?: string;
}): { success: boolean; error?: string } {
  const users = getUsers();
  if (users.find(u => u.email === data.email)) {
    return { success: false, error: 'Email already registered' };
  }
  const user: User = {
    id: generateId(),
    role: data.role,
    name: data.name,
    email: data.email,
    password: data.password,
    avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(data.name)}`,
    profilePhoto: data.profilePhoto || '',
    coverPhoto: '',
    bio: data.role === 'organizer' ? 'Event organizer on E-VENT' : 'Hey there! I love events.',
    interests: data.interests.length > 0 ? data.interests : ['Music', 'Tech', 'Food'],
    dob: data.dob,
    gender: data.gender,
    isPremium: false,
    friends: [],
    orgCategory: data.orgCategory,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);
  setCurrentUser(user.id);
  persistCurrentUserToSession();
  return { success: true };
}

export function login(email: string, password: string): { success: boolean; error?: string } {
  const users = getUsers();
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) return { success: false, error: 'Invalid email or password' };
  setCurrentUser(user.id);
  persistCurrentUserToSession();
  return { success: true };
}

export function updateUser(updates: Partial<User>) {
  const current = getCurrentUser();
  if (!current) return;
  const users = getUsers().map(u => u.id === current.id ? { ...u, ...updates } : u);
  saveUsers(users);
  persistCurrentUserToSession();
}

// Events
export function getEvents(): EventItem[] {
  return EVENTS;
}

export function saveEvents(events: EventItem[]) {
  EVENTS = events;
}

export function addEvent(event: EventItem) {
  const events = getEvents();
  events.unshift(event);
  saveEvents(events);
}

export function upsertEvent(event: EventItem) {
  const events = getEvents();
  const idx = events.findIndex((e) => e.id === event.id);
  if (idx >= 0) {
    events[idx] = { ...events[idx], ...event };
  } else {
    events.unshift(event);
  }
  saveEvents(events);
}

export function updateEvent(id: string, updates: Partial<EventItem>) {
  const events = getEvents().map(e => e.id === id ? { ...e, ...updates } : e);
  saveEvents(events);
}

export function deleteEvent(id: string) {
  const events = getEvents().filter(e => e.id !== id);
  saveEvents(events);
}

export function joinEvent(eventId: string, userId: string) {
  const events = getEvents().map(e => {
    if (e.id === eventId && !e.participants.includes(userId)) {
      return { ...e, participants: [...e.participants, userId] };
    }
    return e;
  });
  saveEvents(events);
}

export function leaveEvent(eventId: string, userId: string) {
  const events = getEvents().map(e => {
    if (e.id === eventId) {
      return { ...e, participants: e.participants.filter((id) => id !== userId) };
    }
    return e;
  });
  saveEvents(events);
}

export function addReview(eventId: string, review: { userId: string; user: string; text: string; rating: number }) {
  const events = getEvents().map(e => {
    if (e.id === eventId) {
      const existing = e.reviews || [];
      if (existing.find(r => r.userId === review.userId)) return e;
      return { ...e, reviews: [...existing, review] };
    }
    return e;
  });
  saveEvents(events);
}

export function reportEvent(eventId: string, report: { userId: string; reason: string; time: string }) {
  const events = getEvents().map(e => {
    if (e.id === eventId) {
      const existing = e.reports || [];
      if (existing.find(r => r.userId === report.userId)) return e;
      return { ...e, reports: [...existing, report] };
    }
    return e;
  });
  saveEvents(events);
}

// Drafts
export function getDrafts(): EventItem[] {
  return DRAFTS;
}

export function saveDraft(event: EventItem) {
  DRAFTS = [event, ...DRAFTS];
}

// Join Requests
export function getJoinRequests(): JoinRequest[] {
  return JOIN_REQUESTS;
}

export function saveJoinRequests(reqs: JoinRequest[]) {
  JOIN_REQUESTS = reqs;
}

export function addJoinRequest(req: JoinRequest) {
  const reqs = getJoinRequests();
  // prevent duplicate
  if (reqs.find(r => r.eventId === req.eventId && r.userId === req.userId)) return;
  reqs.unshift(req);
  saveJoinRequests(reqs);
}

export function updateJoinRequest(id: string, status: 'approved' | 'rejected') {
  const reqs = getJoinRequests().map(r => r.id === id ? { ...r, status } : r);
  saveJoinRequests(reqs);
}

// Tickets
export function getTickets(): Ticket[] {
  return TICKETS;
}

export function saveTickets(tickets: Ticket[]) {
  TICKETS = tickets;
}

export function addTicket(ticket: Ticket) {
  const tickets = getTickets();
  tickets.unshift(ticket);
  saveTickets(tickets);
}

// Notifications
export function getNotifications(): Notification[] {
  return NOTIFICATIONS;
}

export function saveNotifications(notifs: Notification[]) {
  NOTIFICATIONS = notifs;
}

export function addNotification(notif: Notification) {
  const notifs = getNotifications();
  notifs.unshift(notif);
  saveNotifications(notifs);
}

restorePersistedCurrentUser();
