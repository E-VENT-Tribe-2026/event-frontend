import { useState } from 'react';
import { ArrowLeft, Send, Smile, Paperclip, Mic, Lock, ScanFace, KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getCurrentUser } from '@/lib/storage';
import BottomNav from '@/components/BottomNav';

const MOCK_CHATS = [
  { id: '1', name: 'DJ Luna', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna', lastMsg: 'See you at the festival!', time: '2m', unread: 2 },
  { id: '2', name: 'TechCorp', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TechCorp', lastMsg: 'The summit starts at 9 AM', time: '1h', unread: 0 },
  { id: '3', name: 'FoodieClub', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Foodie', lastMsg: 'Vendor spots available!', time: '3h', unread: 1 },
  { id: '4', name: 'ArtCollective', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Art', lastMsg: 'Exhibition opens Friday', time: '5h', unread: 0 },
];

const MOCK_MESSAGES = [
  { id: '1', from: 'them', text: 'Hey! Are you coming to the event? 🎉', time: '10:30 AM' },
  { id: '2', from: 'me', text: 'Yes! I just registered', time: '10:31 AM' },
  { id: '3', from: 'them', text: 'Awesome! See you there!', time: '10:32 AM' },
];

const EMOJIS = ['😀', '😂', '❤️', '🔥', '🎉', '👏', '🙌', '💯', '✨', '🎶', '🤩', '😎', '🥳', '💜', '🎵', '⚡'];

export default function ChatPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [authenticated, setAuthenticated] = useState(false);
  const [authMethod, setAuthMethod] = useState<'password' | 'faceid' | null>(null);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [faceIdScanning, setFaceIdScanning] = useState(false);

  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);

  if (!user) {
    navigate('/login');
    return null;
  }

  // Chat authentication gate
  if (!authenticated) {
    const handlePasswordAuth = () => {
      if (authPassword === user.password) {
        setAuthenticated(true);
        setAuthError('');
      } else {
        setAuthError('Incorrect password');
      }
    };

    const handleFaceId = () => {
      setFaceIdScanning(true);
      // Simulate Face ID scanning
      setTimeout(() => {
        setFaceIdScanning(false);
        setAuthenticated(true);
      }, 2500);
    };

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 pb-20">
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-primary/10 blur-[100px]" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-8 text-center relative z-10">
          <div className="mx-auto h-20 w-20 rounded-full glass-card flex items-center justify-center">
            <Lock className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Chat Protected</h2>
            <p className="text-sm text-muted-foreground mt-1">Verify your identity to access conversations</p>
          </div>

          {!authMethod && (
            <div className="space-y-3">
              <button onClick={() => setAuthMethod('password')}
                className="w-full flex items-center gap-3 rounded-xl glass-card px-4 py-4 text-left hover:shadow-glow transition-shadow">
                <KeyRound className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Password</p>
                  <p className="text-xs text-muted-foreground">Enter your account password</p>
                </div>
              </button>
              <button onClick={() => { setAuthMethod('faceid'); handleFaceId(); }}
                className="w-full flex items-center gap-3 rounded-xl glass-card px-4 py-4 text-left hover:shadow-glow transition-shadow">
                <ScanFace className="h-5 w-5 text-accent" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Face ID</p>
                  <p className="text-xs text-muted-foreground">Use biometric authentication</p>
                </div>
              </button>
            </div>
          )}

          {authMethod === 'password' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <input type="password" placeholder="Enter your password" value={authPassword}
                onChange={e => { setAuthPassword(e.target.value); setAuthError(''); }}
                onKeyDown={e => e.key === 'Enter' && handlePasswordAuth()}
                className="w-full rounded-xl bg-secondary px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50" />
              {authError && <p className="text-xs text-destructive">{authError}</p>}
              <button onClick={handlePasswordAuth} className="w-full gradient-primary rounded-xl py-3 text-sm font-semibold text-primary-foreground shadow-glow">
                Unlock Chat
              </button>
              <button onClick={() => setAuthMethod(null)} className="text-xs text-muted-foreground hover:text-foreground">
                ← Choose another method
              </button>
            </motion.div>
          )}

          {authMethod === 'faceid' && faceIdScanning && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="mx-auto h-32 w-32 rounded-full border-4 border-primary/50 flex items-center justify-center relative">
                <ScanFace className="h-16 w-16 text-primary animate-pulse" />
                <motion.div className="absolute inset-0 rounded-full border-2 border-primary"
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }} />
              </div>
              <p className="text-sm text-muted-foreground animate-pulse">Scanning face...</p>
            </motion.div>
          )}
        </motion.div>
        <BottomNav />
      </div>
    );
  }

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { id: crypto.randomUUID(), from: 'me', text: input, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setInput('');
    setShowEmoji(false);

    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), from: 'them',
        text: ['Sounds great! 🎉', "Can't wait!", "That's awesome!", 'See you soon! 😄', 'Perfect! 💜'][Math.floor(Math.random() * 5)],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    }, 1500 + Math.random() * 1000);
  };

  if (activeChat) {
    const chat = MOCK_CHATS.find(c => c.id === activeChat)!;
    return (
      <div className="flex min-h-screen flex-col bg-background pb-20">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border glass-nav px-4 py-3">
          <button onClick={() => setActiveChat(null)}><ArrowLeft className="h-5 w-5 text-foreground" /></button>
          <img src={chat.avatar} alt="" className="h-9 w-9 rounded-full bg-secondary ring-2 ring-primary/30" />
          <div>
            <h1 className="text-sm font-semibold text-foreground">{chat.name}</h1>
            {isTyping && <p className="text-[10px] text-primary animate-pulse">typing...</p>}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar">
          {messages.map(m => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                m.from === 'me' ? 'gradient-primary text-primary-foreground' : 'glass-card text-foreground'
              }`}>
                <p>{m.text}</p>
                <p className={`text-[10px] mt-1 ${m.from === 'me' ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>{m.time}</p>
              </div>
            </motion.div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="rounded-2xl glass-card px-4 py-3 flex gap-1">
                <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>

        {/* Emoji picker */}
        <AnimatePresence>
          {showEmoji && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="border-t border-border bg-card px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {EMOJIS.map(emoji => (
                  <button key={emoji} onClick={() => setInput(prev => prev + emoji)} className="text-xl hover:scale-125 transition-transform">
                    {emoji}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="sticky bottom-16 border-t border-border glass-nav px-4 py-3 flex gap-2 items-center">
          <button onClick={() => setShowEmoji(!showEmoji)} className={`text-muted-foreground hover:text-foreground ${showEmoji ? 'text-primary' : ''}`}>
            <Smile className="h-5 w-5" />
          </button>
          <button className="text-muted-foreground hover:text-foreground"><Paperclip className="h-5 w-5" /></button>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..." className="flex-1 rounded-full bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50" />
          <button className="text-muted-foreground hover:text-foreground"><Mic className="h-5 w-5" /></button>
          <button onClick={sendMessage} className="rounded-full gradient-primary p-2.5 shadow-glow"><Send className="h-4 w-4 text-primary-foreground" /></button>
        </div>

        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 border-b border-border glass-nav px-4 py-3">
        <h1 className="text-lg font-bold text-gradient">Chats</h1>
      </header>

      <div className="mx-auto max-w-lg divide-y divide-border/50">
        {MOCK_CHATS.map(chat => (
          <button key={chat.id} onClick={() => setActiveChat(chat.id)}
            className="flex w-full items-center gap-3 px-4 py-4 hover:bg-secondary/30 transition-colors">
            <div className="relative">
              <img src={chat.avatar} alt="" className="h-12 w-12 rounded-full bg-secondary ring-2 ring-border" />
              <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-background" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-foreground">{chat.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">{chat.lastMsg}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] text-muted-foreground">{chat.time}</span>
              {chat.unread > 0 && (
                <span className="h-5 w-5 rounded-full gradient-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                  {chat.unread}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
