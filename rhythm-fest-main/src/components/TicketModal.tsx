import { motion, AnimatePresence } from "framer-motion";
import { X, Download } from "lucide-react";
import type { Event } from "@/data/mockData";

interface TicketModalProps {
  open: boolean;
  onClose: () => void;
  event: Event;
}

const TicketModal = ({ open, onClose, event }: TicketModalProps) => {
  const ticketId = `TKT-${event.id}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const qrData = encodeURIComponent(
    JSON.stringify({ name: "John", surname: "Doe", event: event.title, date: event.date, ticketId })
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-5 bg-background/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="glass rounded-3xl overflow-hidden max-w-sm w-full shadow-elevated"
          >
            <div className="relative h-28">
              <img src={event.image} alt={event.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
              <button onClick={onClose} className="absolute top-3 right-3 glass rounded-full p-1.5">
                <X className="w-4 h-4 text-foreground" />
              </button>
              <div className="absolute bottom-2 left-4">
                <h3 className="font-display font-bold text-foreground text-sm">{event.title}</h3>
              </div>
            </div>

            <div className="relative flex items-center px-2">
              <div className="w-4 h-4 rounded-full bg-background -ml-2" />
              <div className="flex-1 border-t-2 border-dashed border-border/50 mx-1" />
              <div className="w-4 h-4 rounded-full bg-background -mr-2" />
            </div>

            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground uppercase tracking-wider text-[9px]">Name</span>
                  <p className="font-semibold text-foreground">John Doe</p>
                </div>
                <div>
                  <span className="text-muted-foreground uppercase tracking-wider text-[9px]">Date</span>
                  <p className="font-semibold text-foreground">{event.date}</p>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="w-32 h-32 bg-foreground rounded-xl p-2">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrData}`}
                    alt="QR"
                    className="w-full h-full"
                  />
                </div>
              </div>

              <p className="text-[9px] text-muted-foreground text-center font-mono">{ticketId}</p>

              <button className="w-full py-2.5 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 shadow-glow">
                <Download className="w-4 h-4" /> Download Ticket
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TicketModal;
