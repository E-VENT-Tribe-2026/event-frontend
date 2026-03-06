import { useState } from "react";
import { X, Share2, Send, UserCheck, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useFriends } from "@/contexts/FriendsContext";
import { toast } from "@/hooks/use-toast";

interface ShareEventModalProps {
  open: boolean;
  onClose: () => void;
  eventTitle: string;
  eventId: string;
}

const ShareEventModal = ({ open, onClose, eventTitle }: ShareEventModalProps) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const { friends, getUserById, searchUsers } = useFriends();

  const friendUsers = friends.map(getUserById).filter(Boolean);
  const filteredFriends = query.trim()
    ? friendUsers.filter(
        (u) =>
          u!.name.toLowerCase().includes(query.toLowerCase()) ||
          u!.email.toLowerCase().includes(query.toLowerCase())
      )
    : friendUsers;

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleShare = () => {
    if (selected.length === 0) {
      toast({ title: "Select friends", description: "Pick at least one friend to share with.", variant: "destructive" });
      return;
    }
    const names = selected.map((id) => getUserById(id)?.name).filter(Boolean);
    toast({ title: "Event Shared! 🎉", description: `Shared "${eventTitle}" with ${names.join(", ")}` });
    setSelected([]);
    setQuery("");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md mx-4 mb-4 glass rounded-2xl p-5 shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-primary" />
                <h2 className="font-display font-bold text-foreground">Share Event</h2>
              </div>
              <button onClick={onClose} className="p-1 rounded-full hover:bg-muted transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-3">
              Share <span className="font-semibold text-foreground">{eventTitle}</span> with your friends
            </p>

            {/* Search within friends */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter friends..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-muted/50 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Friends list */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {filteredFriends.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {friends.length === 0 ? "Add friends first from the People tab" : "No matches"}
                </p>
              ) : (
                filteredFriends.map((user) => {
                  if (!user) return null;
                  const isSelected = selected.includes(user.id);
                  return (
                    <button
                      key={user.id}
                      onClick={() => toggle(user.id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors ${
                        isSelected ? "bg-primary/15 ring-1 ring-primary/40" : "hover:bg-muted/30"
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">
                        {user.name.charAt(0)}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                      </div>
                      {isSelected && <UserCheck className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>

            <button
              onClick={handleShare}
              className="w-full mt-4 py-3 rounded-xl gradient-primary text-primary-foreground font-display font-bold text-sm shadow-glow hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              Share with {selected.length > 0 ? `${selected.length} friend${selected.length > 1 ? "s" : ""}` : "Friends"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShareEventModal;
