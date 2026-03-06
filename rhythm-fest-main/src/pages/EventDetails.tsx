import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Calendar, Clock, Users, Star, Flag, Share2, Check, Loader2, UserPlus } from "lucide-react";
import InviteFriendsModal from "@/components/InviteFriendsModal";
import ShareEventModal from "@/components/ShareEventModal";
import { motion, AnimatePresence } from "framer-motion";
import { mockEvents } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

type JoinState = "idle" | "pending" | "approved" | "rejected";

const EventDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const event = mockEvents.find((e) => e.id === id);
  const [joinState, setJoinState] = useState<JoinState>("idle");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const { user } = useAuth();
  const isOrganizer = user?.role === "organizer";

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Event not found</p>
      </div>
    );
  }

  const handleJoin = () => {
    if (isOrganizer) {
      toast({ title: "Organizers cannot join events", description: "Switch to participant mode", variant: "destructive" });
      return;
    }
    setJoinState("pending");
    toast({ title: "Request Sent!", description: "Waiting for organizer approval..." });
    setTimeout(() => {
      setJoinState("approved");
      toast({ title: "Request Approved! 🎉", description: "Proceed to payment to get your ticket" });
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Banner */}
      <div className="relative h-64">
        <img src={event.image} alt={event.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <div className="absolute top-4 left-4 right-4 flex justify-between">
          <button onClick={() => navigate(-1)} className="glass rounded-full p-2">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex gap-2">
            <button onClick={() => setShareOpen(true)} className="glass rounded-full p-2">
              <Share2 className="w-5 h-5 text-foreground" />
            </button>
            <button className="glass rounded-full p-2">
              <Flag className="w-5 h-5 text-foreground" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 max-w-2xl mx-auto -mt-8 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Category + Price */}
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 text-xs font-semibold rounded-full gradient-primary text-primary-foreground">
              {event.category}
            </span>
            <span className="font-display text-2xl font-bold text-primary">
              {event.price === 0 ? "Free" : `$${event.price}`}
            </span>
          </div>

          <h1 className="font-display text-2xl font-bold text-foreground mt-3">{event.title}</h1>

          {/* Organizer */}
          <div className="flex items-center gap-3 mt-4">
            <div className="w-10 h-10 rounded-full gradient-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">{event.organizer}</p>
              <p className="text-xs text-muted-foreground">Organizer</p>
            </div>
          </div>

          {/* Info cards */}
          <div className="grid grid-cols-2 gap-3 mt-5">
            <InfoCard icon={<Calendar className="w-4 h-4 text-primary" />} label="Date" value={event.date} />
            <InfoCard icon={<Clock className="w-4 h-4 text-accent" />} label="Time" value={event.time} />
            <InfoCard icon={<MapPin className="w-4 h-4 text-accent" />} label="Location" value={event.location} />
            <InfoCard icon={<Users className="w-4 h-4 text-primary" />} label="Going" value={`${event.participants}/${event.maxParticipants}`} />
          </div>

          {/* Description */}
          <div className="mt-6">
            <h2 className="font-display font-bold text-foreground mb-2">About</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>
          </div>

          {/* Friends Attending */}
          {event.friendsJoined && event.friendsJoined.length > 0 && (
            <div className="mt-6">
              <h2 className="font-display font-bold text-foreground mb-3">Friends Attending</h2>
              <div className="flex flex-wrap gap-2">
                {event.friendsJoined.map((friend) => (
                  <div key={friend} className="glass rounded-full px-3 py-2 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                      {friend.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-foreground">{friend}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Participants */}
          <div className="mt-6">
            <h2 className="font-display font-bold text-foreground mb-3">Participants</h2>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-9 h-9 rounded-full border-2 border-card gradient-primary" />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                +{event.participants - 5} others
              </span>
            </div>
          </div>

          {/* Map preview */}
          <div className="mt-6">
            <h2 className="font-display font-bold text-foreground mb-3">Location</h2>
            <div className="glass rounded-2xl h-40 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{event.location}</p>
              </div>
            </div>
          </div>

          {/* Reviews */}
          <div className="mt-6 mb-6">
            <h2 className="font-display font-bold text-foreground mb-3">Reviews</h2>
            <div className="space-y-3">
              {[
                { name: "Alex M.", rating: 5, text: "Amazing event! Totally worth it." },
                { name: "Sarah K.", rating: 4, text: "Great organization, loved the atmosphere." },
              ].map((review, i) => (
                <div key={i} className="glass rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full gradient-primary" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{review.name}</p>
                      <div className="flex gap-0.5">
                        {[...Array(review.rating)].map((_, j) => (
                          <Star key={j} className="w-3 h-3 text-accent fill-accent" />
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{review.text}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom CTA - Join Flow */}
      {!isOrganizer && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
          <div className="max-w-2xl mx-auto">
            <AnimatePresence mode="wait">
              {joinState === "idle" && (
                <motion.button
                  key="join"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={handleJoin}
                  className="w-full py-3.5 rounded-xl gradient-primary text-primary-foreground font-display font-bold text-sm shadow-glow hover:opacity-90 transition-opacity"
                >
                  Request to Join
                </motion.button>
              )}
              {joinState === "pending" && (
                <motion.div
                  key="pending"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full py-3.5 rounded-xl glass text-center flex items-center justify-center gap-2"
                >
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  <span className="font-display font-bold text-sm text-muted-foreground">Request Pending...</span>
                </motion.div>
              )}
              {joinState === "approved" && (
                <div className="flex gap-2">
                  <motion.button
                    key="approved"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => navigate(`/payment/${event.id}`)}
                    className="flex-1 py-3.5 rounded-xl gradient-primary text-primary-foreground font-display font-bold text-sm shadow-glow animate-pulse-glow"
                  >
                    ✓ Approved — Proceed to Payment
                  </motion.button>
                  <motion.button
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => setInviteOpen(true)}
                    className="py-3.5 px-4 rounded-xl glass font-display font-bold text-sm text-primary hover:bg-muted/50 transition-colors"
                  >
                    <UserPlus className="w-5 h-5" />
                  </motion.button>
                </div>
              )}
              {joinState === "rejected" && (
                <motion.div
                  key="rejected"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full py-3.5 rounded-xl glass text-center"
                >
                  <span className="font-display font-bold text-sm text-destructive">Request Rejected</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
      <InviteFriendsModal open={inviteOpen} onClose={() => setInviteOpen(false)} eventTitle={event.title} />
      <ShareEventModal open={shareOpen} onClose={() => setShareOpen(false)} eventTitle={event.title} eventId={event.id} />
    </div>
  );
};

const InfoCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="glass rounded-xl p-3">
    <div className="flex items-center gap-2 mb-1">
      {icon}
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
    <p className="text-sm font-semibold text-foreground truncate">{value}</p>
  </div>
);

export default EventDetails;
