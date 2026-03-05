import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, getEvents, getJoinRequests, updateJoinRequest, joinEvent, deleteEvent, addNotification } from '@/lib/storage';
import { BarChart3, Users, DollarSign, Ticket, Check, X, Trash2, Edit, Plus, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import AppToast from '@/components/AppToast';

export default function OrganizerDashboardPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [tab, setTab] = useState<'overview' | 'requests' | 'events'>('overview');

  const events = useMemo(() => user ? getEvents().filter(e => e.organizerId === user.id) : [], [user]);
  const allRequests = useMemo(() => getJoinRequests(), []);
  const myRequests = useMemo(() => allRequests.filter(r => events.some(e => e.id === r.eventId)), [allRequests, events]);
  const pendingRequests = myRequests.filter(r => r.status === 'pending');

  const totalParticipants = events.reduce((a, e) => a + e.participants.length, 0);
  const totalRevenue = events.reduce((a, e) => a + e.budget * e.participants.length, 0);
  const totalTicketsRemaining = events.reduce((a, e) => a + (e.participantsLimit - e.participants.length), 0);

  if (!user || user.role !== 'organizer') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold">Organizer Access Only</p>
          <button onClick={() => navigate('/home')} className="gradient-primary rounded-xl px-6 py-2 text-sm text-primary-foreground">Go Home</button>
        </div>
      </div>
    );
  }

  const handleApprove = (reqId: string, req: typeof myRequests[0]) => {
    updateJoinRequest(reqId, 'approved');
    joinEvent(req.eventId, req.userId);
    addNotification({
      id: crypto.randomUUID(),
      type: 'approval',
      title: 'Request Approved',
      description: `Your join request was approved`,
      time: 'Just now',
      read: false,
    });
    setToast({ show: true, message: 'Request approved!', type: 'success' });
  };

  const handleReject = (reqId: string) => {
    updateJoinRequest(reqId, 'rejected');
    setToast({ show: true, message: 'Request rejected', type: 'error' });
  };

  const handleDelete = (eventId: string) => {
    deleteEvent(eventId);
    setToast({ show: true, message: 'Event deleted', type: 'success' });
  };

  const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) => (
    <div className="rounded-xl gradient-card p-4 shadow-card border border-border/30 space-y-1">
      <Icon className={`h-5 w-5 ${color}`} />
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />

      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <h1 className="text-lg font-bold text-gradient">Dashboard</h1>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['overview', 'requests', 'events'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === t ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}>
            {t === 'overview' ? 'Overview' : t === 'requests' ? `Requests (${pendingRequests.length})` : 'My Events'}
          </button>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg px-4 pt-4 space-y-4">
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={Users} label="Total Participants" value={totalParticipants} color="text-primary" />
              <StatCard icon={DollarSign} label="Revenue" value={`$${totalRevenue}`} color="text-accent" />
              <StatCard icon={Ticket} label="Tickets Left" value={totalTicketsRemaining} color="text-primary" />
              <StatCard icon={BarChart3} label="Events" value={events.length} color="text-accent" />
            </div>

            <button onClick={() => navigate('/create')}
              className="w-full gradient-primary rounded-xl py-3 text-sm font-semibold text-primary-foreground shadow-glow ripple-container flex items-center justify-center gap-2">
              <Plus className="h-4 w-4" /> Create New Event
            </button>
          </>
        )}

        {tab === 'requests' && (
          <div className="space-y-3">
            {pendingRequests.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No pending requests</p>
            ) : (
              pendingRequests.map(req => {
                const evt = events.find(e => e.id === req.eventId);
                return (
                  <motion.div key={req.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl gradient-card p-4 shadow-card border border-border/30 flex items-center gap-3">
                    <img src={req.userAvatar} alt="" className="h-10 w-10 rounded-full bg-secondary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{req.userName}</p>
                      <p className="text-xs text-muted-foreground truncate">wants to join {evt?.title}</p>
                    </div>
                    <button onClick={() => handleApprove(req.id, req)} className="rounded-lg bg-primary/20 p-2 text-primary hover:bg-primary/30">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleReject(req.id)} className="rounded-lg bg-destructive/20 p-2 text-destructive hover:bg-destructive/30">
                      <X className="h-4 w-4" />
                    </button>
                  </motion.div>
                );
              })
            )}
          </div>
        )}

        {tab === 'events' && (
          <div className="space-y-3">
            {events.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No events created yet</p>
            ) : (
              events.map(e => (
                <motion.div key={e.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl gradient-card p-4 shadow-card border border-border/30 flex items-center gap-3">
                  <img src={e.image} alt="" className="h-14 w-14 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{e.participants.length}/{e.participantsLimit} joined · ${e.budget}</p>
                  </div>
                  <button onClick={() => navigate(`/event/${e.id}`)} className="p-2 text-muted-foreground hover:text-primary">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(e.id)} className="p-2 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </motion.div>
              ))
            )}
          </div>
        )}
      </motion.div>

      <BottomNav />
    </div>
  );
}
