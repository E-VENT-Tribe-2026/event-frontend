import { MapPin, Calendar, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import type { Event } from "@/data/mockData";

interface EventCardProps {
  event: Event;
  variant?: "default" | "compact";
}

const EventCard = ({ event, variant = "default" }: EventCardProps) => {
  const navigate = useNavigate();

  if (variant === "compact") {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate(`/event/${event.id}`)}
        className="glass rounded-xl overflow-hidden cursor-pointer shadow-card min-w-[200px] w-[200px] flex-shrink-0"
      >
        <div className="relative h-28">
          <img src={event.image} alt={event.title} className="w-full h-full object-cover" />
          <div className="absolute top-2 left-2">
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full gradient-primary text-primary-foreground">
              {event.category}
            </span>
          </div>
          {event.price === 0 && (
            <div className="absolute top-2 right-2">
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-accent text-accent-foreground">
                Free
              </span>
            </div>
          )}
        </div>
        <div className="p-3">
          <h3 className="font-display font-semibold text-sm text-foreground truncate">{event.title}</h3>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {event.date}
          </p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" />
              {event.participants}
            </span>
            {event.price > 0 && (
              <span className="text-xs font-semibold text-primary">${event.price}</span>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(`/event/${event.id}`)}
      className="glass rounded-2xl overflow-hidden cursor-pointer shadow-card"
    >
      <div className="relative h-44">
        <img src={event.image} alt={event.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        <div className="absolute top-3 left-3">
          <span className="px-3 py-1 text-xs font-semibold rounded-full gradient-primary text-primary-foreground">
            {event.category}
          </span>
        </div>
        {event.friendsJoined && event.friendsJoined.length > 0 && (
          <div className="absolute top-3 right-3 glass rounded-full px-2 py-1 flex items-center gap-1">
            <Users className="w-3 h-3 text-accent" />
            <span className="text-[10px] text-foreground font-medium">
              {event.friendsJoined.join(", ")}
            </span>
          </div>
        )}
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="font-display font-bold text-lg text-foreground">{event.title}</h3>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-primary" />
            {event.date}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-accent" />
            {event.location.split(",")[0]}
          </span>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {[...Array(Math.min(3, Math.floor(event.participants / 100)))].map((_, i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded-full border-2 border-card gradient-primary"
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {event.participants} going
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-display font-bold text-primary">
              {event.price === 0 ? "Free" : `$${event.price}`}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/event/${event.id}`);
              }}
              className="px-4 py-1.5 rounded-full gradient-primary text-primary-foreground text-sm font-semibold shadow-glow hover:opacity-90 transition-opacity"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default EventCard;
