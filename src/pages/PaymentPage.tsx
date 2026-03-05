import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEvents, joinEvent, getCurrentUser, addTicket, addNotification } from '@/lib/storage';
import { ArrowLeft, CreditCard, Smartphone, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import AppToast from '@/components/AppToast';

export default function PaymentPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const event = getEvents().find(e => e.id === eventId);
  const user = getCurrentUser();
  const [method, setMethod] = useState<'card' | 'apple' | 'google'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [generatedTicket, setGeneratedTicket] = useState<any>(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' as 'success' | 'error' });

  if (!event || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Event not found</div>;
  }

  const handlePay = () => {
    if (method === 'card') {
      if (!cardNumber || !expiry || !cvv) {
        setToast({ show: true, message: 'Please fill all card details', type: 'error' });
        return;
      }
    }
    setProcessing(true);
    setTimeout(() => {
      joinEvent(event.id, user.id);
      const ticket = {
        id: crypto.randomUUID(),
        eventId: event.id,
        userId: user.id,
        eventTitle: event.title,
        eventDate: event.date,
        eventTime: event.time,
        eventLocation: event.location,
        qrCode: `EVENT-${event.id.slice(0, 8)}-${user.id.slice(0, 8)}-${Date.now()}`,
        purchasedAt: new Date().toISOString(),
      };
      addTicket(ticket);
      setGeneratedTicket(ticket);
      addNotification({
        id: crypto.randomUUID(),
        type: 'payment',
        title: 'Payment Successful',
        description: `You purchased a ticket for ${event.title}`,
        time: 'Just now',
        read: false,
      });
      setProcessing(false);
      setSuccess(true);
    }, 2000);
  };

  if (success && generatedTicket) {
    const qrData = JSON.stringify({
      name: user.name,
      event: event.title,
      date: event.date,
      ticketId: generatedTicket.id,
    });

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center space-y-6 w-full max-w-sm">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }}
            className="mx-auto h-20 w-20 rounded-full gradient-primary flex items-center justify-center shadow-glow">
            <Check className="h-10 w-10 text-primary-foreground" />
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground">Payment Successful!</h1>
          <p className="text-sm text-muted-foreground">Your ticket for <span className="text-primary font-semibold">{event.title}</span> is ready</p>

          {/* Ticket preview */}
          <div className="rounded-2xl glass-card p-6 space-y-4 text-left">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-muted-foreground">Event</p>
                <p className="text-sm font-semibold text-foreground">{event.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{event.date} · {event.time}</p>
              </div>
            </div>
            <div className="flex justify-center py-2">
              <div className="rounded-xl bg-foreground p-3">
                <QRCodeSVG
                  value={qrData}
                  size={120}
                  bgColor="hsl(0, 0%, 100%)"
                  fgColor="hsl(213, 61%, 11%)"
                  level="H"
                />
              </div>
            </div>
            <p className="text-center text-[10px] text-muted-foreground">Scan at venue entrance</p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => navigate(`/ticket/${generatedTicket.id}`)} className="flex-1 gradient-primary rounded-xl py-3 text-sm font-semibold text-primary-foreground shadow-glow">
              View Full Ticket
            </button>
            <button onClick={() => navigate('/home')} className="flex-1 rounded-xl glass-card py-3 text-sm font-semibold text-foreground">
              Go Home
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const inputCls = "w-full rounded-xl bg-secondary px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-shadow";

  return (
    <div className="min-h-screen bg-background pb-8">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />

      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border glass-nav px-4 py-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5 text-foreground" /></button>
        <h1 className="text-lg font-bold text-gradient">Payment</h1>
      </header>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-sm px-4 pt-6 space-y-6">
        {/* Order Summary */}
        <div className="rounded-2xl glass-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Order Summary</h3>
          <div className="flex items-center gap-3">
            <img src={event.image} alt="" className="h-14 w-14 rounded-xl object-cover" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{event.title}</p>
              <p className="text-xs text-muted-foreground">{event.date} · {event.time}</p>
            </div>
          </div>
          <div className="border-t border-border/50 pt-3 flex justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-bold text-foreground">${event.budget}</span>
          </div>
        </div>

        {/* Payment Method */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Payment Method</h3>
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: 'card' as const, label: 'Card', icon: CreditCard },
              { key: 'apple' as const, label: ' Pay', icon: Smartphone },
              { key: 'google' as const, label: 'G Pay', icon: Smartphone },
            ]).map(m => (
              <button key={m.key} onClick={() => setMethod(m.key)}
                className={`rounded-xl py-3 text-xs font-medium flex flex-col items-center gap-1 transition-all ${method === m.key ? 'gradient-primary text-primary-foreground shadow-glow' : 'glass-card text-muted-foreground hover:text-foreground'}`}>
                <m.icon className="h-5 w-5" />
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Card Form */}
        <AnimatePresence mode="wait">
          {method === 'card' && (
            <motion.div key="card" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3">
              <input placeholder="Card Number" value={cardNumber} onChange={e => setCardNumber(e.target.value)} className={inputCls} maxLength={19} />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="MM/YY" value={expiry} onChange={e => setExpiry(e.target.value)} className={inputCls} maxLength={5} />
                <input placeholder="CVV" value={cvv} onChange={e => setCvv(e.target.value)} className={inputCls} maxLength={4} type="password" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button onClick={handlePay} disabled={processing}
          className="w-full gradient-primary rounded-xl py-3.5 text-sm font-semibold text-primary-foreground shadow-glow ripple-container transition-transform active:scale-[0.98] disabled:opacity-50">
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            `Pay $${event.budget}`
          )}
        </button>
      </motion.div>
    </div>
  );
}
