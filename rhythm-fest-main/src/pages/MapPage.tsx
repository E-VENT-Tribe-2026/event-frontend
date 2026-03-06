import { MapPin, Navigation, SlidersHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { mockEvents } from "@/data/mockData";

const MapPage = () => {
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Map placeholder */}
      <div className="relative h-[60vh] gradient-hero flex items-center justify-center">
        <div className="absolute inset-0 opacity-20">
          {/* Simulated map grid */}
          <div className="w-full h-full" style={{
            backgroundImage: "linear-gradient(hsl(230 20% 25% / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(230 20% 25% / 0.3) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }} />
        </div>

        {/* Event pins */}
        {mockEvents.map((event, i) => (
          <motion.div
            key={event.id}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="absolute"
            style={{
              left: `${20 + i * 15}%`,
              top: `${25 + (i % 3) * 20}%`,
            }}
          >
            <div className="relative group cursor-pointer">
              <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center shadow-glow animate-pulse-glow">
                <MapPin className="w-4 h-4 text-primary-foreground" />
              </div>
              {/* Popup */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 glass rounded-lg p-2 min-w-[140px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <p className="text-xs font-semibold text-foreground truncate">{event.title}</p>
                <p className="text-[10px] text-muted-foreground">{event.date}</p>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          <button className="glass rounded-full p-3 shadow-card">
            <Navigation className="w-5 h-5 text-primary" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mt-4">
          <button className="glass rounded-xl px-4 py-2 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-primary" />
            <span className="text-sm text-foreground font-semibold">Filters</span>
          </button>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Radius</label>
            <input
              type="range"
              min="1"
              max="50"
              defaultValue="10"
              className="w-full accent-primary"
            />
          </div>
        </div>

        {/* Nearby list */}
        <div className="mt-4 space-y-3">
          {mockEvents.slice(0, 3).map((event) => (
            <div key={event.id} className="glass rounded-xl p-3 flex items-center gap-3">
              <img src={event.image} alt={event.title} className="w-14 h-14 rounded-lg object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{event.title}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {event.location}
                </p>
              </div>
              <span className="text-xs font-semibold text-primary">{event.price === 0 ? "Free" : `$${event.price}`}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MapPage;
