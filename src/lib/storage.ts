// localStorage database helpers

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  avatar: string;
  bio: string;
  interests: string[];
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
  organizerAvatar: string;
  isPrivate: boolean;
  reviews: { user: string; text: string; rating: number }[];
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

export function signup(name: string, email: string, password: string): { success: boolean; error?: string } {
  const users = getUsers();
  if (users.find(u => u.email === email)) {
    return { success: false, error: 'Email already registered' };
  }
  const user: User = {
    id: crypto.randomUUID(),
    name,
    email,
    password,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
    bio: 'Hey there! I love events.',
    interests: ['Music', 'Tech', 'Food'],
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
