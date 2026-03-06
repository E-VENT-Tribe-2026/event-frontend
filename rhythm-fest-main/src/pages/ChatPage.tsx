import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Fingerprint, Eye, EyeOff, Search, Send, Smile, Paperclip, Mic, ArrowLeft } from "lucide-react";

const ChatPage = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authMethod, setAuthMethod] = useState<"password" | "faceid">("password");
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-2xl p-8 max-w-sm w-full text-center shadow-elevated"
        >
          <Lock className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold text-foreground mb-1">Chat Protected</h2>
          <p className="text-sm text-muted-foreground mb-6">Verify your identity to access chats</p>

          <div className="flex gap-2 mb-5">
            <button
              onClick={() => setAuthMethod("password")}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${authMethod === "password" ? "gradient-primary text-primary-foreground" : "glass text-muted-foreground"}`}
            >
              Password
            </button>
            <button
              onClick={() => setAuthMethod("faceid")}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${authMethod === "faceid" ? "gradient-primary text-primary-foreground" : "glass text-muted-foreground"}`}
            >
              Face ID
            </button>
          </div>

          {authMethod === "password" ? (
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                className="w-full glass rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center gap-3">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-20 h-20 rounded-full glass flex items-center justify-center"
              >
                <Fingerprint className="w-10 h-10 text-primary" />
              </motion.div>
              <p className="text-xs text-muted-foreground">Scanning...</p>
            </div>
          )}

          <button
            onClick={() => setAuthenticated(true)}
            className="w-full mt-4 py-3 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm shadow-glow"
          >
            {authMethod === "password" ? "Verify" : "Authenticate"}
          </button>
        </motion.div>
      </div>
    );
  }

  if (selectedChat) {
    return (
      <div className="min-h-screen bg-background pb-24 flex flex-col">
        {/* Chat header */}
        <div className="glass border-b border-border/30 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSelectedChat(null)}>
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="w-9 h-9 rounded-full gradient-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">{selectedChat}</p>
            <p className="text-[10px] text-muted-foreground">Online</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 px-4 py-4 space-y-3 overflow-y-auto">
          <ChatBubble from="them" text="Hey! Are you going to the festival?" />
          <ChatBubble from="me" text="Yes! I just requested to join 🎉" />
          <ChatBubble from="them" text="Awesome, see you there!" />
          <div className="flex items-center gap-2 justify-center">
            <span className="text-[10px] text-muted-foreground italic">typing...</span>
          </div>
        </div>

        {/* Input */}
        <div className="glass border-t border-border/30 px-4 py-3 flex items-center gap-2">
          <button className="text-muted-foreground"><Paperclip className="w-5 h-5" /></button>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button className="text-muted-foreground"><Smile className="w-5 h-5" /></button>
          <button className="text-muted-foreground"><Mic className="w-5 h-5" /></button>
          <button className="gradient-primary rounded-full p-2"><Send className="w-4 h-4 text-primary-foreground" /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 glass border-b border-border/30 px-4 py-3">
        <h1 className="font-display text-xl font-bold text-foreground">Chats</h1>
      </div>
      <div className="px-4 mt-3">
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Search conversations..."
            className="w-full pl-11 pr-4 py-3 rounded-xl glass text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <div className="space-y-2">
          {["Sarah K.", "Mike T.", "Event Organizers", "Alex M."].map((name) => (
            <motion.button
              key={name}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedChat(name)}
              className="w-full glass rounded-xl p-3 flex items-center gap-3 text-left"
            >
              <div className="w-12 h-12 rounded-full gradient-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{name}</p>
                <p className="text-xs text-muted-foreground truncate">Hey, are you going?</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] text-muted-foreground">2m ago</p>
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full gradient-primary text-[10px] text-primary-foreground font-bold mt-1">
                  2
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

const ChatBubble = ({ from, text }: { from: "me" | "them"; text: string }) => (
  <div className={`flex ${from === "me" ? "justify-end" : "justify-start"}`}>
    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
      from === "me"
        ? "gradient-primary text-primary-foreground rounded-br-sm"
        : "glass text-foreground rounded-bl-sm"
    }`}>
      {text}
    </div>
  </div>
);

export default ChatPage;
