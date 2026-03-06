import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, UserPlus, UserCheck, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useFriends } from "@/contexts/FriendsContext";
import { toast } from "@/hooks/use-toast";
import type { MockUser } from "@/data/mockUsers";

const PeoplePage = () => {
  const [query, setQuery] = useState("");
  const { searchUsers, friends, addFriend, removeFriend, isFriend, getUserById } = useFriends();
  const navigate = useNavigate();

  const results = query.trim() ? searchUsers(query) : [];
  const friendUsers = friends.map(getUserById).filter(Boolean) as MockUser[];

  const handleToggleFriend = (user: MockUser, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFriend(user.id)) {
      removeFriend(user.id);
      toast({ title: "Removed", description: `${user.name} removed from friends` });
    } else {
      addFriend(user.id);
      toast({ title: "Friend Added! 🎉", description: `${user.name} is now your friend` });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 px-4 pt-6 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-bold text-foreground mb-4">People</h1>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-muted/50 rounded-xl pl-10 pr-10 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Search Results */}
      {query.trim() && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Results ({results.length})
          </h2>
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No users found</p>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {results.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    isFriend={isFriend(user.id)}
                    onToggle={handleToggleFriend}
                    onTap={() => navigate(`/user/${user.id}`)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* Friends List */}
      {!query.trim() && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Your Friends ({friendUsers.length})
          </h2>
          {friendUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Search and add friends above</p>
          ) : (
            <div className="space-y-2">
              {friendUsers.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isFriend
                  onToggle={handleToggleFriend}
                  onTap={() => navigate(`/user/${user.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const UserRow = ({
  user,
  isFriend,
  onToggle,
  onTap,
}: {
  user: MockUser;
  isFriend: boolean;
  onToggle: (user: MockUser, e: React.MouseEvent) => void;
  onTap: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    onClick={onTap}
    className="glass rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
  >
    <div className="w-11 h-11 rounded-full gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0">
      {user.name.charAt(0)}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
      <p className="text-xs text-muted-foreground truncate">{user.bio}</p>
    </div>
    <button
      onClick={(e) => onToggle(user, e)}
      className={`shrink-0 p-2 rounded-full transition-colors ${
        isFriend
          ? "bg-primary/20 text-primary"
          : "bg-muted/50 text-muted-foreground hover:text-primary hover:bg-primary/10"
      }`}
    >
      {isFriend ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
    </button>
  </motion.div>
);

export default PeoplePage;
