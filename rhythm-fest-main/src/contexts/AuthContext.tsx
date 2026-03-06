import { createContext, useContext, useState, ReactNode } from "react";

export type Role = "participant" | "organizer";

interface User {
  name: string;
  email: string;
  role: Role;
  isPremium: boolean;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, role: Role) => void;
  signup: (data: Partial<User> & { role: Role }) => void;
  logout: () => void;
  togglePremium: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>({
    name: "John Doe",
    email: "john@example.com",
    role: "participant",
    isPremium: false,
  });

  const login = (_email: string, _password: string, role: Role) => {
    setUser({
      name: role === "organizer" ? "Neon Events Co." : "John Doe",
      email: _email || "john@example.com",
      role,
      isPremium: false,
    });
  };

  const signup = (data: Partial<User> & { role: Role }) => {
    setUser({
      name: data.name || "New User",
      email: data.email || "user@example.com",
      role: data.role,
      isPremium: false,
    });
  };

  const logout = () => setUser(null);

  const togglePremium = () => {
    if (user) setUser({ ...user, isPremium: !user.isPremium });
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, signup, logout, togglePremium }}>
      {children}
    </AuthContext.Provider>
  );
};
