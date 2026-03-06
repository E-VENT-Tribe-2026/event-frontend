import { useState } from "react";
import { X, Send, UserPlus, Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";

interface InviteFriendsModalProps {
  open: boolean;
  onClose: () => void;
  eventTitle: string;
}

const InviteFriendsModal = ({ open, onClose, eventTitle }: InviteFriendsModalProps) => {
  const [friends, setFriends] = useState([{ name: "", email: "" }]);

  const updateFriend = (index: number, field: "name" | "email", value: string) => {
    setFriends((prev) => prev.map((f, i) => (i === index ? { ...f, [field]: value } : f)));
  };

  const addRow = () => {
    if (friends.length < 5) setFriends((prev) => [...prev, { name: "", email: "" }]);
  };

  const removeRow = (index: number) => {
    if (friends.length > 1) setFriends((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = () => {
    const valid = friends.filter((f) => f.name.trim() && f.email.trim());
    if (valid.length === 0) {
      toast({ title: "Missing info", description: "Add at least one friend with name and email.", variant: "destructive" });
      return;
    }
    toast({
      title: "Invites Sent! 🎉",
      description: `${valid.length} invite${valid.length > 1 ? "s" : ""} sent for "${eventTitle}"`,
    });
    setFriends([{ name: "", email: "" }]);
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
                <UserPlus className="w-5 h-5 text-primary" />
                <h2 className="font-display font-bold text-foreground">Invite Friends</h2>
              </div>
              <button onClick={onClose} className="p-1 rounded-full hover:bg-muted transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Send email invitations to friends for <span className="font-semibold text-foreground">{eventTitle}</span>
            </p>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {friends.map((friend, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      placeholder="Name"
                      value={friend.name}
                      onChange={(e) => updateFriend(i, "name", e.target.value)}
                      className="flex-1 bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={friend.email}
                      onChange={(e) => updateFriend(i, "email", e.target.value)}
                      className="flex-1 bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  {friends.length > 1 && (
                    <button onClick={() => removeRow(i)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {friends.length < 5 && (
              <button onClick={addRow} className="mt-3 text-xs text-primary font-medium flex items-center gap-1 hover:opacity-80 transition-opacity">
                <UserPlus className="w-3 h-3" /> Add another friend
              </button>
            )}

            <button
              onClick={handleSend}
              className="w-full mt-5 py-3 rounded-xl gradient-primary text-primary-foreground font-display font-bold text-sm shadow-glow hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send Invites
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InviteFriendsModal;
