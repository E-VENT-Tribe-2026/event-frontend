export interface MockUser {
  id: string;
  name: string;
  email: string;
  bio: string;
  avatar?: string;
  eventsJoined: string[];   // event IDs
  eventsOrganized: string[]; // event IDs
}

export const mockUsers: MockUser[] = [
  { id: "u1", name: "Alex Morgan", email: "alex@example.com", bio: "Music lover & festival enthusiast 🎶", eventsJoined: ["1", "4"], eventsOrganized: [] },
  { id: "u2", name: "Sarah Kim", email: "sarah@example.com", bio: "Art curator & gallery explorer 🎨", eventsJoined: ["1", "2"], eventsOrganized: [] },
  { id: "u3", name: "Mike Chen", email: "mike@example.com", bio: "Tech founder building the future 🚀", eventsJoined: ["3"], eventsOrganized: [] },
  { id: "u4", name: "Emma Wilson", email: "emma@example.com", bio: "Foodie on a mission to taste it all 🍜", eventsJoined: ["4"], eventsOrganized: [] },
  { id: "u5", name: "Liam Parker", email: "liam@example.com", bio: "Adventure seeker & yoga practitioner 🧘", eventsJoined: ["4", "5"], eventsOrganized: [] },
  { id: "u6", name: "Olivia Davis", email: "olivia@example.com", bio: "Creative director & design enthusiast ✨", eventsJoined: ["4"], eventsOrganized: [] },
  { id: "u7", name: "Noah Martinez", email: "noah@example.com", bio: "DJ & music producer 🎧", eventsJoined: [], eventsOrganized: ["1"] },
  { id: "u8", name: "Ava Thompson", email: "ava@example.com", bio: "Wellness coach & mindfulness advocate 🌿", eventsJoined: ["5"], eventsOrganized: ["5"] },
  { id: "u9", name: "Ethan Brown", email: "ethan@example.com", bio: "Sports fanatic & weekend warrior ⚽", eventsJoined: ["1", "3"], eventsOrganized: [] },
  { id: "u10", name: "Sophia Lee", email: "sophia@example.com", bio: "Photographer capturing life's moments 📸", eventsJoined: ["2", "4"], eventsOrganized: [] },
];
