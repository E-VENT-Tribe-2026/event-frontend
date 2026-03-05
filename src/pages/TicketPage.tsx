import { useParams, useNavigate } from 'react-router-dom';
import { getTickets, getCurrentUser } from '@/lib/storage';
import { ArrowLeft, Download, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';

export default function TicketPage() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const ticket = getTickets().find(t => t.id === ticketId);

  if (!ticket || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold">Ticket not found</p>
          <button onClick={() => navigate('/profile')} className="gradient-primary rounded-xl px-6 py-2 text-sm text-primary-foreground">
            Go to Profile
          </button>
        </div>
      </div>
    );
  }

  // QR data: name + event name + event date + ticket id
  const qrData = JSON.stringify({
    name: user.name,
    event: ticket.eventTitle,
    date: ticket.eventDate,
    time: ticket.eventTime,
    ticketId: ticket.id,
  });

  const handleDownload = () => {
    // Create a downloadable SVG
    const svg = document.querySelector('#ticket-qr svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ticket-${ticket.id.slice(0, 8)}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEmailTicket = () => {
    const subject = encodeURIComponent(`Your E-VENT Ticket: ${ticket.eventTitle}`);
    const body = encodeURIComponent(
      `🎟️ E-VENT Ticket\n\nEvent: ${ticket.eventTitle}\nDate: ${ticket.eventDate}\nTime: ${ticket.eventTime}\nLocation: ${ticket.eventLocation}\nTicket ID: ${ticket.id}\nHolder: ${user.name}\n\nShow this ticket at the venue entrance.`
    );
    window.open(`mailto:${user.email}?subject=${subject}&body=${body}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border glass-nav px-4 py-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5 text-foreground" /></button>
        <h1 className="text-lg font-bold text-gradient">My Ticket</h1>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm">
          {/* Ticket card */}
          <div className="rounded-3xl overflow-hidden glass-card">
            {/* Top section */}
            <div className="gradient-primary p-6 text-center space-y-2">
              <p className="text-xs font-medium text-primary-foreground/70 uppercase tracking-wider">E-VENT Ticket</p>
              <h2 className="text-xl font-bold text-primary-foreground">{ticket.eventTitle}</h2>
              <p className="text-sm text-primary-foreground/80">{ticket.eventDate} · {ticket.eventTime}</p>
            </div>

            {/* Dotted separator */}
            <div className="relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 h-6 w-6 rounded-full bg-background" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-6 w-6 rounded-full bg-background" />
              <div className="border-t-2 border-dashed border-border mx-6" />
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Attendee</p>
                  <p className="font-semibold text-foreground">{user.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="font-semibold text-foreground truncate">{ticket.eventLocation}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ticket ID</p>
                  <p className="font-mono text-xs text-primary">{ticket.id.slice(0, 12)}...</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Purchased</p>
                  <p className="text-xs text-foreground">{new Date(ticket.purchasedAt).toLocaleDateString()}</p>
                </div>
              </div>

              {/* QR Code */}
              <div id="ticket-qr" className="flex justify-center py-4">
                <div className="rounded-2xl bg-foreground p-4">
                  <QRCodeSVG
                    value={qrData}
                    size={180}
                    bgColor="hsl(0, 0%, 100%)"
                    fgColor="hsl(213, 61%, 11%)"
                    level="H"
                    includeMargin={false}
                  />
                </div>
              </div>
              <p className="text-center text-[10px] text-muted-foreground">Scan this QR code at the venue entrance</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 gradient-primary rounded-xl py-3 text-sm font-semibold text-primary-foreground shadow-glow ripple-container">
              <Download className="h-4 w-4" /> Download
            </button>
            <button onClick={handleEmailTicket}
              className="flex-1 flex items-center justify-center gap-2 glass-card rounded-xl py-3 text-sm font-semibold text-foreground hover:shadow-glow transition-shadow">
              <Mail className="h-4 w-4" /> Email
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
