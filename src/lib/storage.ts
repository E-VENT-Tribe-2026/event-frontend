// localStorage database helpers

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  avatar: string;
  profilePhoto: string; // base64 or URL
  bio: string;
  interests: string[];
  dob: string; // date of birth ISO
  gender: string;
  createdAt: string;
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
  reviews: { userId: string; user: string; text: string; rating: number }[];
  reports: { userId: string; reason: string; time: string }[];
}

export interface ChatMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  time: string;
}

export interface Notification {
  id: string;
  type: 'join' | 'reminder' | 'message' | 'trending';
  title: string;
  description: string;
  time: string;
  read: boolean;
}

const USERS_KEY = 'event_users';
const CURRENT_USER_KEY = 'event_current_user';
const EVENTS_KEY = 'event_events';
const NOTIFICATIONS_KEY = 'event_notifications';
const DRAFTS_KEY = 'event_drafts';

// Users
export function getUsers(): User[] {
  return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
}

export function saveUsers(users: User[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getCurrentUser(): User | null {
  const id = localStorage.getItem(CURRENT_USER_KEY);
  if (!id) return null;
  return getUsers().find(u => u.id === id) || null;
}

export function setCurrentUser(id: string) {
  localStorage.setItem(CURRENT_USER_KEY, id);
}

export function logout() {
  localStorage.removeItem(CURRENT_USER_KEY);
}

export function signup(data: {
  name: string;
  email: string;
  password: string;
  profilePhoto: string;
  dob: string;
  gender: string;
  interests: string[];
}): { success: boolean; error?: string } {
  const users = getUsers();
  if (users.find(u => u.email === data.email)) {
    return { success: false, error: 'Email already registered' };
  }
  const user: User = {
    id: crypto.randomUUID(),
    name: data.name,
    email: data.email,
    password: data.password,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.name)}`,
    profilePhoto: data.profilePhoto || '',
    bio: 'Hey there! I love events.',
    interests: data.interests.length > 0 ? data.interests : ['Music', 'Tech', 'Food'],
    dob: data.dob,
    gender: data.gender,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);
  setCurrentUser(user.id);
  return { success: true };
}

export function login(email: string, password: string): { success: boolean; error?: string } {
  const users = getUsers();
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) return { success: false, error: 'Invalid email or password' };
  setCurrentUser(user.id);
  return { success: true };
}

export function updateUser(updates: Partial<User>) {
  const current = getCurrentUser();
  if (!current) return;
  const users = getUsers().map(u => u.id === current.id ? { ...u, ...updates } : u);
  saveUsers(users);
}

// Events
export function getEvents(): EventItem[] {
  return JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]');
}

export function saveEvents(events: EventItem[]) {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
}

export function addEvent(event: EventItem) {
  const events = getEvents();
  events.unshift(event);
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
  return JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]');
}

export function saveDraft(event: EventItem) {
  const drafts = getDrafts();
  drafts.unshift(event);
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

// Notifications
export function getNotifications(): Notification[] {
  return JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]');
}

export function saveNotifications(notifs: Notification[]) {
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifs));
}

export function addNotification(notif: Notification) {
  const notifs = getNotifications();
  notifs.unshift(notif);
  saveNotifications(notifs);
}
