import { createContext, useContext, useState, ReactNode } from "react";
import { mockUsers, type MockUser } from "@/data/mockUsers";

interface FriendsContextType {
  friends: string[]; // user IDs
  addFriend: (userId: string) => void;
  removeFriend: (userId: string) => void;
  isFriend: (userId: string) => boolean;
  searchUsers: (query: string) => MockUser[];
  getUserById: (id: string) => MockUser | undefined;
  allUsers: MockUser[];
}

const FriendsContext = createContext<FriendsContextType | undefined>(undefined);

export const FriendsProvider = ({ children }: { children: ReactNode }) => {
  // Pre-seed with a couple of friends
  const [friends, setFriends] = useState<string[]>(["u1", "u2", "u3"]);

  const addFriend = (userId: string) => {
    setFriends((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
  };

  const removeFriend = (userId: string) => {
    setFriends((prev) => prev.filter((id) => id !== userId));
  };

  const isFriend = (userId: string) => friends.includes(userId);

  const searchUsers = (query: string) => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return mockUsers.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  };

  const getUserById = (id: string) => mockUsers.find((u) => u.id === id);

  return (
    <FriendsContext.Provider value={{ friends, addFriend, removeFriend, isFriend, searchUsers, getUserById, allUsers: mockUsers }}>
      {children}
    </FriendsContext.Provider>
  );
};

export const useFriends = () => {
  const ctx = useContext(FriendsContext);
  if (!ctx) throw new Error("useFriends must be used within FriendsProvider");
  return ctx;
};
