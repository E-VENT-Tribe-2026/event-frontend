import { type EventItem, type Notification, getEvents, saveEvents, getNotifications, saveNotifications } from './storage';

const EVENT_IMAGES = [
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80',
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&q=80',
  'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=600&q=80',
  'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=600&q=80',
  'https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=600&q=80',
  'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600&q=80',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80',
  'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&q=80',
];

const CATEGORIES = ['Music', 'Tech', 'Food', 'Sports', 'Art', 'Networking', 'Gaming', 'Wellness'];

const seedEvents: EventItem[] = [
  {
    id: 'e1', title: 'Neon Nights Music Festival', description: 'An electrifying outdoor music festival featuring top DJs and live performances under neon lights.', category: 'Music',
    date: '2026-03-15', time: '20:00', location: 'Central Park, NYC', lat: 40.785091, lng: -73.968285, budget: 50, participantsLimit: 500, participants: ['u1','u2','u3'],
    image: EVENT_IMAGES[0], organizer: 'DJ Luna', organizerId: 'seed1', organizerAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna', isPrivate: false, isDraft: false,
    reviews: [{ userId: 'u1', user: 'Alex', text: 'Amazing vibes!', rating: 5 }], reports: [],
  },
  {
    id: 'e2', title: 'AI & Future Tech Summit', description: 'Explore the latest in artificial intelligence, robotics, and emerging technologies.', category: 'Tech',
    date: '2026-03-20', time: '09:00', location: 'Tech Hub, SF', lat: 37.7749, lng: -122.4194, budget: 100, participantsLimit: 200, participants: ['u1'],
    image: EVENT_IMAGES[1], organizer: 'TechCorp', organizerId: 'seed2', organizerAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TechCorp', isPrivate: false, isDraft: false,
    reviews: [{ userId: 'u2', user: 'Sam', text: 'Very insightful talks.', rating: 4 }], reports: [],
  },
  {
    id: 'e3', title: 'Street Food Carnival', description: 'Taste dishes from 30+ vendors from around the world in one epic food fest.', category: 'Food',
    date: '2026-04-01', time: '12:00', location: 'Brooklyn Bridge Park', lat: 40.7024, lng: -73.9969, budget: 25, participantsLimit: 1000, participants: ['u2','u3'],
    image: EVENT_IMAGES[2], organizer: 'FoodieClub', organizerId: 'seed3', organizerAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Foodie', isPrivate: false, isDraft: false,
    reviews: [], reports: [],
  },
  {
    id: 'e4', title: 'Sunset Yoga Retreat', description: 'Relax and rejuvenate with a beachside yoga session during golden hour.', category: 'Wellness',
    date: '2026-03-25', time: '17:30', location: 'Santa Monica Beach', lat: 34.0195, lng: -118.4912, budget: 15, participantsLimit: 50, participants: [],
    image: EVENT_IMAGES[3], organizer: 'ZenMaster', organizerId: 'seed4', organizerAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zen', isPrivate: false, isDraft: false,
    reviews: [{ userId: 'u3', user: 'Mia', text: 'So peaceful!', rating: 5 }], reports: [],
  },
  {
    id: 'e5', title: 'Urban Art Exhibition', description: 'Discover stunning street art and graffiti from local and international artists.', category: 'Art',
    date: '2026-04-05', time: '14:00', location: 'Wynwood Walls, Miami', lat: 25.7617, lng: -80.1918, budget: 10, participantsLimit: 300, participants: ['u1','u2'],
    image: EVENT_IMAGES[4], organizer: 'ArtCollective', organizerId: 'seed5', organizerAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Art', isPrivate: false, isDraft: false,
    reviews: [], reports: [],
  },
  {
    id: 'e6', title: 'EDM Beach Party', description: 'Dance the night away on the sand with world-class electronic music.', category: 'Music',
    date: '2026-04-10', time: '21:00', location: 'Venice Beach, LA', lat: 33.985, lng: -118.4695, budget: 40, participantsLimit: 800, participants: ['u3'],
    image: EVENT_IMAGES[5], organizer: 'BeatDrop', organizerId: 'seed6', organizerAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Beat', isPrivate: false, isDraft: false,
    reviews: [{ userId: 'u1', user: 'Jake', text: 'Best party ever!', rating: 5 }], reports: [],
  },
  {
    id: 'e7', title: 'Startup Networking Mixer', description: 'Connect with founders, investors, and innovators in a casual evening setting.', category: 'Networking',
    date: '2026-03-28', time: '18:00', location: 'WeWork, Austin', lat: 30.2672, lng: -97.7431, budget: 0, participantsLimit: 100, participants: [],
    image: EVENT_IMAGES[6], organizer: 'StartupHub', organizerId: 'seed7', organizerAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Startup', isPrivate: false, isDraft: false,
    reviews: [], reports: [],
  },
  {
    id: 'e8', title: 'Retro Gaming Tournament', description: 'Compete in classic arcade and console games for glory and prizes.', category: 'Gaming',
    date: '2026-04-12', time: '15:00', location: 'GameZone, Chicago', lat: 41.8781, lng: -87.6298, budget: 20, participantsLimit: 64, participants: ['u1'],
    image: EVENT_IMAGES[7], organizer: 'PixelKing', organizerId: 'seed8', organizerAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Pixel', isPrivate: false, isDraft: false,
    reviews: [{ userId: 'u2', user: 'Chris', text: 'Nostalgia overload!', rating: 4 }], reports: [],
  },
];

const seedNotifications: Notification[] = [
  { id: 'n1', type: 'join', title: 'New Joiner!', description: 'Alex joined your Neon Nights event', time: '2 min ago', read: false },
  { id: 'n2', type: 'reminder', title: 'Event Tomorrow', description: 'AI & Future Tech Summit starts tomorrow at 9 AM', time: '1 hour ago', read: false },
  { id: 'n3', type: 'trending', title: 'Trending Near You', description: 'Street Food Carnival is trending in your area!', time: '3 hours ago', read: true },
  { id: 'n4', type: 'message', title: 'New Message', description: 'DJ Luna sent you a message', time: '5 hours ago', read: true },
];

export function seedDatabase() {
  if (getEvents().length === 0) {
    saveEvents(seedEvents);
  }
  if (getNotifications().length === 0) {
    saveNotifications(seedNotifications);
  }
}

export { CATEGORIES };
