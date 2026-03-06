import eventConcert from "@/assets/event-concert.jpg";
import eventArt from "@/assets/event-art.jpg";
import eventTech from "@/assets/event-tech.jpg";
import eventFood from "@/assets/event-food.jpg";
import eventYoga from "@/assets/event-yoga.jpg";

export interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  price: number;
  image: string;
  category: string;
  participants: number;
  maxParticipants: number;
  description: string;
  organizer: string;
  friendsJoined?: string[];
}

export const mockEvents: Event[] = [
  {
    id: "1",
    title: "Neon Nights Festival",
    date: "Mar 15, 2026",
    time: "8:00 PM",
    location: "Downtown Arena, NYC",
    price: 45,
    image: eventConcert,
    category: "Music",
    participants: 1240,
    maxParticipants: 2000,
    description: "The biggest electronic music festival of the year featuring world-class DJs and immersive light shows.",
    organizer: "Neon Events Co.",
    friendsJoined: ["Alex", "Sarah"],
  },
  {
    id: "2",
    title: "Modern Art Exhibition",
    date: "Mar 20, 2026",
    time: "10:00 AM",
    location: "Gallery District, LA",
    price: 25,
    image: eventArt,
    category: "Art",
    participants: 340,
    maxParticipants: 500,
    description: "Explore contemporary masterpieces from emerging artists around the world.",
    organizer: "ArtSpace Gallery",
  },
  {
    id: "3",
    title: "Tech Startup Mixer",
    date: "Mar 22, 2026",
    time: "6:00 PM",
    location: "Innovation Hub, SF",
    price: 0,
    image: eventTech,
    category: "Tech",
    participants: 180,
    maxParticipants: 300,
    description: "Network with founders, investors, and tech enthusiasts at this exclusive mixer.",
    organizer: "TechConnect",
    friendsJoined: ["Mike"],
  },
  {
    id: "4",
    title: "Rooftop Food Festival",
    date: "Mar 28, 2026",
    time: "12:00 PM",
    location: "Sky Terrace, Chicago",
    price: 35,
    image: eventFood,
    category: "Food",
    participants: 520,
    maxParticipants: 800,
    description: "Taste cuisines from around the world with stunning city views.",
    organizer: "FoodieHub",
    friendsJoined: ["Emma", "Liam", "Olivia"],
  },
  {
    id: "5",
    title: "Sunrise Yoga Retreat",
    date: "Apr 2, 2026",
    time: "6:00 AM",
    location: "Mountain View, CO",
    price: 60,
    image: eventYoga,
    category: "Wellness",
    participants: 45,
    maxParticipants: 60,
    description: "Find your inner peace with a guided yoga session in the mountains.",
    organizer: "ZenFlow Studio",
  },
];

export const categories = ["All", "Music", "Art", "Tech", "Food", "Wellness", "Sports", "Business"];

export const interests = [
  "Music", "Art", "Technology", "Food & Drink", "Sports", "Wellness",
  "Business", "Photography", "Travel", "Gaming", "Fashion", "Film",
];
