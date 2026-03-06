import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus, UserCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useFriends } from "@/contexts/FriendsContext";
import { mockEvents } from "@/data/mockData";
import { toast } from "@/hooks/use-toast";

const UserProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getUserById, isFriend, addFriend, removeFriend } = useFriends();
  const user = getUserById(id || "");

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">User not found</p>
      </div>
    );
  }

  const joined = mockEvents.filter((e) => user.eventsJoined.includes(e.id));
  const organized = mockEvents.filter((e) => user.eventsOrganized.includes(e.id));
  const isFriendAlready = isFriend(user.id);

  const handleToggle = () => {
    if (isFriendAlready) {
      removeFriend(user.id);
      toast({ title: "Removed", description: `${user.name} removed from friends` });
    } else {
      addFriend(user.id);
      toast({ title: "Friend Added! 🎉", description: `${user.name} is now your friend` });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="gradient-hero h-32 relative">
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 glass rounded-full p-2">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
      </div>

      <div className="px-4 max-w-2xl mx-auto -mt-12 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Avatar + Info */}
          <div className="flex items-end gap-4 mb-4">
            <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center text-2xl font-bold text-primary-foreground border-4 border-background shrink-0">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <h1 className="font-display text-xl font-bold text-foreground truncate">{user.name}</h1>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <button
              onClick={handleToggle}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors ${
                isFriendAlready
                  ? "glass text-primary"
                  : "gradient-primary text-primary-foreground shadow-glow"
              }`}
            >
              {isFriendAlready ? <><UserCheck className="w-4 h-4" /> Friends</> : <><UserPlus className="w-4 h-4" /> Add</>}
            </button>
          </div>

          {/* Bio */}
          <p className="text-sm text-muted-foreground mb-6">{user.bio}</p>

          {/* Events Joined */}
          {joined.length > 0 && (
            <div className="mb-6">
              <h2 className="font-display font-bold text-foreground mb-3">Events Joined</h2>
              <div className="space-y-2">
                {joined.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => navigate(`/event/${event.id}`)}
                    className="glass rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <img src={event.image} alt={event.title} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground">{event.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Events Organized */}
          {organized.length > 0 && (
            <div className="mb-6">
              <h2 className="font-display font-bold text-foreground mb-3">Events Organized</h2>
              <div className="space-y-2">
                {organized.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => navigate(`/event/${event.id}`)}
                    className="glass rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <img src={event.image} alt={event.title} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground">{event.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default UserProfile;
