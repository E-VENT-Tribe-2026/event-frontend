import { useState } from "react";
import { ArrowLeft, Download, Share2, Mail, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { mockEvents } from "@/data/mockData";

const TicketPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const event = mockEvents.find((e) => e.id === id) || mockEvents[0];
  const [emailSent, setEmailSent] = useState(false);

  const ticketId = `TKT-${event.id}-${Date.now().toString(36).toUpperCase()}`;
  const qrData = encodeURIComponent(
    JSON.stringify({ name: "John", surname: "Doe", event: event.title, date: event.date, ticketId })
  );

  const handleSendEmail = () => {
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 3000);
  };

  return (
    <div className="min-h-screen bg-background pb-24 flex flex-col">
      <div className="sticky top-0 z-40 glass border-b border-border/30 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="font-display text-lg font-bold text-foreground">My Ticket</h1>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 30, rotateX: 20 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ type: "spring", stiffness: 150 }}
          className="w-full max-w-sm"
        >
          <div className="glass rounded-3xl overflow-hidden shadow-elevated">
            <div className="relative h-36">
              <img src={event.image} alt={event.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
              <div className="absolute bottom-3 left-4 right-4">
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full gradient-primary text-primary-foreground">
                  {event.category}
                </span>
                <h2 className="font-display font-bold text-lg text-foreground mt-1">{event.title}</h2>
              </div>
            </div>

            <div className="relative flex items-center px-2">
              <div className="w-5 h-5 rounded-full bg-background -ml-2.5" />
              <div className="flex-1 border-t-2 border-dashed border-border/50 mx-1" />
              <div className="w-5 h-5 rounded-full bg-background -mr-2.5" />
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <TicketInfo label="Name" value="John Doe" />
                <TicketInfo label="Date" value={event.date} />
                <TicketInfo label="Time" value={event.time} />
                <TicketInfo label="Location" value={event.location.split(",")[0]} />
              </div>

              <div className="text-center">
                <p className="text-[10px] text-muted-foreground mb-2">TICKET ID</p>
                <p className="text-xs font-mono text-primary font-semibold tracking-wider">{ticketId}</p>
              </div>

              <div className="flex justify-center">
                <div className="w-40 h-40 bg-foreground rounded-xl flex items-center justify-center p-3">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}&bgcolor=FFFFFF&color=000000`}
                    alt="Ticket QR Code"
                    className="w-full h-full"
                  />
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground text-center">
                Scan this QR code at the event entrance
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mt-5">
            <button className="flex-1 py-3 rounded-xl glass text-sm font-semibold text-foreground flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> Save
            </button>
            <button className="flex-1 py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 shadow-glow">
              <Share2 className="w-4 h-4" /> Share
            </button>
          </div>

          {/* Email ticket */}
          <button
            onClick={handleSendEmail}
            disabled={emailSent}
            className="w-full mt-3 py-3 rounded-xl glass text-sm font-semibold text-foreground flex items-center justify-center gap-2"
          >
            {emailSent ? (
              <>
                <Check className="w-4 h-4 text-accent" /> Ticket sent to email!
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" /> Send Ticket to Email
              </>
            )}
          </button>
        </motion.div>
      </div>
    </div>
  );
};

const TicketInfo = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
    <p className="text-sm font-semibold text-foreground truncate">{value}</p>
  </div>
);

export default TicketPage;
