import { useState, useEffect } from 'react';
import { ArrowLeft, Send, Smile } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';

const MOCK_CHATS = [
  { id: '1', name: 'DJ Luna', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna', lastMsg: 'See you at the festival!', time: '2m' },
  { id: '2', name: 'TechCorp', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TechCorp', lastMsg: 'The summit starts at 9 AM', time: '1h' },
  { id: '3', name: 'FoodieClub', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Foodie', lastMsg: 'Vendor spots available!', time: '3h' },
];

const MOCK_MESSAGES = [
  { id: '1', from: 'them', text: 'Hey! Are you coming to the event?', time: '10:30 AM' },
  { id: '2', from: 'me', text: 'Yes! I just registered 🎉', time: '10:31 AM' },
  { id: '3', from: 'them', text: 'Awesome! See you there!', time: '10:32 AM' },
];

export default function ChatPage() {
  const navigate = useNavigate();
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { id: crypto.randomUUID(), from: 'me', text: input, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setInput('');

    // Simulate typing indicator + reply
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), from: 'them',
        text: ['Sounds great! 🎉', 'Can\'t wait!', 'That\'s awesome!', 'See you soon! 😄'][Math.floor(Math.random() * 4)],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    }, 1500 + Math.random() * 1000);
  };

  if (activeChat) {
    const chat = MOCK_CHATS.find(c => c.id === activeChat)!;
    return (
      <div className="flex min-h-screen flex-col bg-background pb-20">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
          <button onClick={() => setActiveChat(null)}><ArrowLeft className="h-5 w-5 text-foreground" /></button>
          <img src={chat.avatar} alt="" className="h-8 w-8 rounded-full bg-secondary" />
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
                m.from === 'me' ? 'gradient-primary text-primary-foreground' : 'bg-secondary text-foreground'
              }`}>
                <p>{m.text}</p>
                <p className={`text-[10px] mt-1 ${m.from === 'me' ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>{m.time}</p>
              </div>
            </motion.div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-secondary px-4 py-3 flex gap-1">
                <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-16 border-t border-border bg-background/95 backdrop-blur-lg px-4 py-3 flex gap-2">
          <button className="text-muted-foreground hover:text-foreground"><Smile className="h-5 w-5" /></button>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..." className="flex-1 rounded-full bg-secondary px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50" />
          <button onClick={sendMessage} className="rounded-full gradient-primary p-2 shadow-glow"><Send className="h-4 w-4 text-primary-foreground" /></button>
        </div>

        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <h1 className="text-lg font-bold text-foreground">Chats</h1>
      </header>

      <div className="mx-auto max-w-lg divide-y divide-border">
        {MOCK_CHATS.map(chat => (
          <button key={chat.id} onClick={() => setActiveChat(chat.id)}
            className="flex w-full items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors">
            <img src={chat.avatar} alt="" className="h-12 w-12 rounded-full bg-secondary" />
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-foreground">{chat.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">{chat.lastMsg}</p>
            </div>
            <span className="text-xs text-muted-foreground">{chat.time}</span>
          </button>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
