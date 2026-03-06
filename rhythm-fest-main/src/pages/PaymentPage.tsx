import { useState } from "react";
import { ArrowLeft, CreditCard, Smartphone, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { mockEvents } from "@/data/mockData";

type PayMethod = "card" | "apple" | "google";

const PaymentPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const event = mockEvents.find((e) => e.id === id) || mockEvents[0];
  const [method, setMethod] = useState<PayMethod>("card");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePay = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setSuccess(true);
    }, 2000);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="glass rounded-3xl p-10 text-center max-w-sm w-full shadow-elevated"
        >
          <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center mx-auto mb-5 shadow-glow">
            <Check className="w-10 h-10 text-primary-foreground" />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground">Payment Successful!</h2>
          <p className="text-sm text-muted-foreground mt-2">Your ticket has been generated</p>
          <button
            onClick={() => navigate(`/ticket/${event.id}`)}
            className="w-full mt-6 py-3 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm shadow-glow"
          >
            View My Ticket
          </button>
          <button
            onClick={() => navigate("/")}
            className="w-full mt-3 py-3 rounded-xl glass text-sm font-semibold text-foreground"
          >
            Back to Home
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 glass border-b border-border/30 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="font-display text-lg font-bold text-foreground">Payment</h1>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 max-w-lg mx-auto mt-5 space-y-5"
      >
        {/* Order Summary */}
        <div className="glass rounded-2xl p-4">
          <h2 className="font-display font-bold text-foreground mb-3">Order Summary</h2>
          <div className="flex gap-3">
            <img src={event.image} alt={event.title} className="w-16 h-16 rounded-xl object-cover" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{event.title}</p>
              <p className="text-xs text-muted-foreground">{event.date} • {event.time}</p>
              <p className="text-xs text-muted-foreground">{event.location}</p>
            </div>
          </div>
          <div className="border-t border-border/30 mt-3 pt-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Ticket (1x)</span>
              <span className="text-foreground">${event.price}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Service fee</span>
              <span className="text-foreground">$2.99</span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-2 border-t border-border/30">
              <span className="text-foreground">Total</span>
              <span className="gradient-text text-lg">${(event.price + 2.99).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div>
          <h2 className="font-display font-bold text-foreground mb-3">Payment Method</h2>
          <div className="grid grid-cols-3 gap-2">
            <MethodButton active={method === "card"} onClick={() => setMethod("card")} label="Card">
              <CreditCard className="w-5 h-5" />
            </MethodButton>
            <MethodButton active={method === "apple"} onClick={() => setMethod("apple")} label="Apple Pay">
              <Smartphone className="w-5 h-5" />
            </MethodButton>
            <MethodButton active={method === "google"} onClick={() => setMethod("google")} label="Google Pay">
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              </svg>
            </MethodButton>
          </div>
        </div>

        {/* Card Form */}
        <AnimatePresence mode="wait">
          {method === "card" && (
            <motion.div
              key="card"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <PayInput placeholder="Card Number" maxLength={19} />
              <div className="grid grid-cols-2 gap-3">
                <PayInput placeholder="MM/YY" maxLength={5} />
                <PayInput placeholder="CVC" maxLength={4} />
              </div>
              <PayInput placeholder="Cardholder Name" />
            </motion.div>
          )}
          {method === "apple" && (
            <motion.div key="apple" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass rounded-2xl p-6 text-center">
              <Smartphone className="w-10 h-10 text-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Confirm with Apple Pay on your device</p>
            </motion.div>
          )}
          {method === "google" && (
            <motion.div key="google" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass rounded-2xl p-6 text-center">
              <svg viewBox="0 0 24 24" className="w-10 h-10 mx-auto mb-3">
                <path fill="hsl(var(--primary))" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="hsl(var(--accent))" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              </svg>
              <p className="text-sm text-muted-foreground">Confirm with Google Pay</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pay Button */}
        <button
          onClick={handlePay}
          disabled={processing}
          className="w-full py-3.5 rounded-xl gradient-primary text-primary-foreground font-display font-bold text-sm shadow-glow hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {processing ? (
            <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
              Processing...
            </motion.span>
          ) : (
            `Pay $${(event.price + 2.99).toFixed(2)}`
          )}
        </button>
      </motion.div>
    </div>
  );
};

const PayInput = ({ placeholder, maxLength }: { placeholder: string; maxLength?: number }) => (
  <input
    placeholder={placeholder}
    maxLength={maxLength}
    className="w-full glass rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
  />
);

const MethodButton = ({
  active, onClick, label, children,
}: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`rounded-xl py-3 flex flex-col items-center gap-1.5 text-xs font-semibold transition-all ${
      active ? "gradient-primary text-primary-foreground shadow-glow" : "glass text-muted-foreground"
    }`}
  >
    {children}
    {label}
  </button>
);

export default PaymentPage;
