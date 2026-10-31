import { Ban, Calendar, Clock, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import AppToast from '@/components/AppToast';
import BottomNav from '@/components/BottomNav';
import { UserAvatar } from '@/components/UserAvatar';
import { isChatUnread } from '@/lib/chatUnread';
import { isExpiredOver48h, type ChatEvent } from '@/pages/chat/chatModel';

export type ChatTab = 'active' | 'past' | 'cancelled';

type ChatListViewProps = {
  chats: ChatEvent[];
  chatTab: ChatTab;
  onChatTabChange: (tab: ChatTab) => void;
  search: string;
  onSearchChange: (value: string) => void;
  loading: boolean;
  userId: string;
  onOpenChat: (chatId: string) => void;
  toast: { show: boolean; message: string; type: 'error' | 'success' };
  onCloseToast: () => void;
};

export default function ChatListView({
  chats,
  chatTab,
  onChatTabChange,
  search,
  onSearchChange,
  loading,
  userId,
  onOpenChat,
  toast,
  onCloseToast,
}: ChatListViewProps) {
  const activeChats = chats.filter((c) => !c.isPast && !c.isCancelled);
  const pastChats = chats.filter((c) => c.isPast && !c.isCancelled && !isExpiredOver48h(c.eventDate));
  const cancelledChats = chats.filter((c) => c.isCancelled);

  const currentTabChats =
    chatTab === 'active' ? activeChats : chatTab === 'past' ? pastChats : cancelledChats;

  const searchQuery = search.trim().toLowerCase();
  const visibleChats = searchQuery
    ? currentTabChats.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery) ||
          c.lastMsg.toLowerCase().includes(searchQuery),
      )
    : currentTabChats;

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={onCloseToast} />

      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg">
        <header className="mx-auto max-w-2xl border-b border-border px-4 py-3">
          <h1 className="text-xl font-bold text-gradient">Chats</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Your event conversations</p>
        </header>
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-4 space-y-4">
        <div className="flex rounded-xl glass-card p-1 gap-1" role="tablist">
          {[
            { id: 'active' as const, label: 'Active', count: activeChats.length, icon: Calendar },
            { id: 'past' as const, label: 'Past', count: pastChats.length, icon: Clock },
            { id: 'cancelled' as const, label: 'Cancelled', count: cancelledChats.length, icon: Ban },
          ].map((tab) => {
            const isActive = chatTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => onChatTabChange(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? tab.id === 'cancelled'
                      ? 'bg-destructive text-destructive-foreground shadow-sm'
                      : 'gradient-primary text-primary-foreground shadow-glow'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <tab.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
                <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                  isActive
                    ? 'bg-background/25 text-inherit'
                    : 'bg-secondary text-muted-foreground'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {loading && visibleChats.length === 0 && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl glass-card px-4 py-3.5">
                <div className="h-12 w-12 shrink-0 rounded-full shimmer" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-2/5 rounded-full shimmer" />
                  <div className="h-2.5 w-3/5 rounded-full shimmer" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && visibleChats.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Send className="h-7 w-7 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {searchQuery ? 'No matching conversations' : `No ${chatTab} conversations`}
            </p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {searchQuery
                ? 'Try a different search.'
                : chatTab === 'active'
                  ? "You don't have any active event chats right now."
                  : `No ${chatTab} event chats found.`}
            </p>
          </div>
        )}

        {visibleChats.length > 0 && (
          <div className="space-y-2.5">
            {visibleChats.map((chat) => (
              <motion.button
                key={chat.id}
                type="button"
                onClick={() => onOpenChat(chat.id)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex w-full items-center gap-3 rounded-2xl glass-card px-4 py-3.5 text-left transition-all hover:border-primary/30 active:scale-[0.98] ${chat.isPast || chat.isCancelled ? 'opacity-65' : ''}`}
              >
                <div className="relative shrink-0">
                  <UserAvatar src={chat.avatar} seed={chat.id} name={chat.name} size="lg" className="ring-2 ring-border" />
                  <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-background ${chat.isCancelled ? 'bg-amber-500' : chat.isPast ? 'bg-muted-foreground' : 'bg-green-500'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{chat.name}</p>
                    {(chat.unread > 0 || isChatUnread(userId, chat.id)) && (
                      <span
                        data-testid="new-messages-tag"
                        className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold leading-none text-accent-foreground animate-pulse"
                      >
                        New messages
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-1 text-xs text-muted-foreground mt-0.5">
                    {chat.isCancelled ? 'Cancelled · Read-only' : chat.isPast ? `Ended · ${chat.eventDate}` : chat.lastMsg}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
