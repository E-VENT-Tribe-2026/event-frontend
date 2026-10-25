import { type RefObject } from 'react';
import { AlertTriangle, ArrowLeft, ListChecks, MapPinned, Send, Smile } from 'lucide-react';
import { motion } from 'framer-motion';
import AppToast from '@/components/AppToast';
import BottomNav from '@/components/BottomNav';
import EventPollCard from '@/components/EventPollCard';
import TopBar from '@/components/TopBar';
import { UserAvatar } from '@/components/UserAvatar';
import { encodeChatPayload } from '@/lib/chatPayload';
import { userProfilePath } from '@/lib/friendsApi';
import { formatDateSeparator, isNearBottom, type ChatEvent, type ChatMessage } from '@/pages/chat/chatModel';

type ChatThreadViewProps = {
  chat: ChatEvent;
  messages: ChatMessage[];
  messagesLoading: boolean;
  chatUnavailable: boolean;
  chatApiMissing: boolean;
  sending: boolean;
  input: string;
  onInputChange: (value: string) => void;
  showEmoji: boolean;
  onToggleEmoji: () => void;
  showPoll: boolean;
  onTogglePoll: () => void;
  pollQuestion: string;
  onPollQuestionChange: (value: string) => void;
  pollOptions: string[];
  onPollOptionsChange: (value: string[]) => void;
  search: string;
  onSearchChange: (value: string) => void;
  toast: { show: boolean; message: string; type: 'error' | 'success' };
  onCloseToast: () => void;
  onBack: () => void;
  onSend: (content?: string) => void;
  onOpenProfile: (path: string) => void;
  resolveMeId: () => string;
  user: { id: string; name: string; avatar?: string };
  scrollerRef: RefObject<HTMLDivElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  pinToBottomRef: RefObject<boolean>;
};

export default function ChatThreadView({
  chat,
  messages,
  messagesLoading,
  chatUnavailable,
  chatApiMissing,
  sending,
  input,
  onInputChange,
  showEmoji,
  onToggleEmoji,
  showPoll,
  onTogglePoll,
  pollQuestion,
  onPollQuestionChange,
  pollOptions,
  onPollOptionsChange,
  search,
  onSearchChange,
  toast,
  onCloseToast,
  onBack,
  onSend,
  onOpenProfile,
  resolveMeId,
  user,
  scrollerRef,
  messagesEndRef,
  pinToBottomRef,
}: ChatThreadViewProps) {
  const isReadOnly = Boolean(chat.isPast || chat.isCancelled);

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={onCloseToast} />

      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg">
        <TopBar
          search={search}
          onSearchChange={onSearchChange}
          searchPlaceholder="Search chats..."
        />
        <header className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Back to chats"
              onClick={onBack}
              className="rounded-full glass-card p-2 hover:bg-secondary/80 transition-colors active:scale-90 shrink-0"
            >
              <ArrowLeft className="h-4 w-4 text-foreground" />
            </button>

            <div className="relative shrink-0">
              <UserAvatar src={chat.avatar} seed={chat.id} name={chat.name} size="sm" className="ring-2 ring-primary/30" />
              <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background ${isReadOnly || chatUnavailable ? 'bg-muted-foreground' : 'bg-green-500'}`} />
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-bold text-foreground">{chat.name}</h1>
              <p className={`text-[10px] ${chatUnavailable ? 'text-destructive' : chat.isCancelled ? 'text-amber-500 font-medium' : chat.isPast ? 'text-muted-foreground' : 'text-green-500'}`}>
                {chatUnavailable ? 'Chat unavailable' : chat.isCancelled ? 'Cancelled event · read-only' : chat.isPast ? 'Past event · read-only' : chatApiMissing ? 'Offline preview' : 'Active'}
                {!chatUnavailable && messages.filter((m) => m.messageType === 'checkin').length > 0 && (
                  <span className="ml-2 inline-flex items-center gap-0.5 text-primary">
                    <MapPinned className="h-3 w-3" />
                    {new Set(messages.filter((m) => m.messageType === 'checkin' && m.senderId).map((m) => m.senderId)).size} here
                  </span>
                )}
              </p>
            </div>
          </div>
        </header>
      </div>

      {chat.isCancelled && !chatUnavailable && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>This event was cancelled. The chat is read-only.</p>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          ref={scrollerRef}
          onScroll={() => {
            const el = scrollerRef.current;
            if (el) pinToBottomRef.current = isNearBottom(el);
          }}
          className="flex-1 space-y-1 overflow-y-auto px-4 py-4 custom-scrollbar"
        >
          {messagesLoading && messages.length === 0 && (
            <div className="space-y-3 pt-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`flex items-end gap-2 ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                  {i % 2 === 0 && <div className="h-8 w-8 shrink-0 rounded-full shimmer" />}
                  <div className={`h-10 rounded-2xl shimmer ${i % 2 === 0 ? 'w-48' : 'w-36'}`} />
                </div>
              ))}
            </div>
          )}
          {!messagesLoading && messages.length === 0 && !chatUnavailable && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Send className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">No messages yet</p>
              <p className="text-xs text-muted-foreground">History is empty for this chat</p>
            </div>
          )}
          {messages.filter((m) => m.messageType !== 'poll_vote').map((m, i, visible) => {
            const showDateSep = i === 0 || visible[i - 1].dateKey !== m.dateKey;
            return (
              <div key={m.id}>
                {showDateSep && (
                  <div className="flex items-center gap-3 py-3">
                    <div className="flex-1 border-t border-border/40" />
                    <span className="shrink-0 rounded-full bg-secondary/80 px-3 py-1 text-[10px] font-semibold text-muted-foreground">
                      {formatDateSeparator(m.dateKey)}
                    </span>
                    <div className="flex-1 border-t border-border/40" />
                  </div>
                )}
                {m.kind === 'system' ? (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center py-1">
                    <span className="rounded-full bg-secondary/60 px-3 py-1 text-[10px] text-muted-foreground">
                      {m.text}
                      <span className="ml-1.5 opacity-60">{m.time}</span>
                    </span>
                  </motion.div>
                ) : (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex items-end gap-2 mb-1 ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                    {m.from === 'them' && (
                      m.senderId ? (
                        <button
                          type="button"
                          onClick={() => onOpenProfile(userProfilePath(m.senderId as string, resolveMeId()))}
                          aria-label={`Open ${m.senderName || 'this user'}'s profile`}
                          className="shrink-0 mb-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <UserAvatar src={m.senderAvatar} seed={m.senderId} name={m.senderName || '?'} size="sm" />
                        </button>
                      ) : (
                        <UserAvatar src={m.senderAvatar} seed={m.id} name={m.senderName || '?'} size="sm" className="shrink-0 mb-1" />
                      )
                    )}
                    <div className={`max-w-[72%] flex flex-col gap-1 ${m.from === 'me' ? 'items-end' : 'items-start'}`}>
                      {m.from === 'them' && (
                        <div className="flex items-center gap-1.5 px-1">
                          <span className="text-[11px] font-semibold text-foreground">
                            {m.senderName || 'Unknown'}
                          </span>
                        </div>
                      )}
                      <div className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                        m.from === 'me'
                          ? 'gradient-primary text-primary-foreground rounded-br-sm'
                          : 'glass-card text-foreground rounded-bl-sm'
                      }`}>
                        {m.messageType === 'poll' && m.pollId && (m.options?.length || 0) > 1 ? (
                          <EventPollCard
                            question={m.question || m.text}
                            options={m.options || []}
                            votesByUser={Object.fromEntries(
                              messages
                                .filter((vote) => vote.messageType === 'poll_vote' && vote.pollId === m.pollId && vote.senderId && vote.optionIndex != null)
                                .map((vote) => [vote.senderId as string, vote.optionIndex as number]),
                            )}
                            myId={resolveMeId()}
                            disabled={chatUnavailable || isReadOnly || sending}
                            onVote={(optionIndex) => {
                              void onSend(encodeChatPayload({
                                v: 1,
                                type: 'poll_vote',
                                pollId: m.pollId,
                                optionIndex,
                                text: `vote:${optionIndex}`,
                              }));
                            }}
                          />
                        ) : (
                          <p className="whitespace-pre-wrap break-words leading-relaxed">{m.text}</p>
                        )}
                        <p className={`mt-1 text-[10px] ${m.from === 'me' ? 'text-primary-foreground/60 text-right' : 'text-muted-foreground'}`}>{m.time}</p>
                      </div>
                    </div>
                    {m.from === 'me' && (
                      <UserAvatar src={user.avatar} seed={user.id} name={user.name} size="sm" className="shrink-0 mb-1" />
                    )}
                  </motion.div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {showPoll && !isReadOnly && !chatUnavailable && (
        <div className="border-t border-border bg-background px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">New poll</p>
          <input
            value={pollQuestion}
            onChange={(e) => onPollQuestionChange(e.target.value)}
            placeholder="Ask a question…"
            aria-label="Poll question"
            className="w-full rounded-xl border border-border/50 bg-secondary px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          {pollOptions.map((opt, i) => (
            <input
              key={i}
              value={opt}
              onChange={(e) => onPollOptionsChange(pollOptions.map((item, idx) => (idx === i ? e.target.value : item)))}
              placeholder={`Option ${i + 1}`}
              aria-label={`Poll option ${i + 1}`}
              className="w-full rounded-xl border border-border/50 bg-secondary px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          ))}
          {pollOptions.length < 4 && (
            <button
              type="button"
              onClick={() => onPollOptionsChange([...pollOptions, ''])}
              className="text-[11px] font-semibold text-primary"
            >
              Add option
            </button>
          )}
          <button
            type="button"
            disabled={sending || !pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2}
            onClick={() => {
              const options = pollOptions.map((o) => o.trim()).filter(Boolean);
              void onSend(encodeChatPayload({
                v: 1,
                type: 'poll',
                pollId: crypto.randomUUID(),
                question: pollQuestion.trim(),
                options,
                text: pollQuestion.trim(),
              }));
              onPollQuestionChange('');
              onPollOptionsChange(['', '']);
              onTogglePoll();
            }}
            className="w-full rounded-xl gradient-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
          >
            Post poll
          </button>
        </div>
      )}

      <div className="sticky bottom-16 border-t border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={chatUnavailable || isReadOnly}
            onClick={onToggleEmoji}
            className={`shrink-0 rounded-full p-2 transition-all disabled:opacity-40 ${showEmoji ? 'gradient-primary text-primary-foreground shadow-glow' : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'}`}
            aria-label="Emoji"
          >
            <Smile className="h-5 w-5" />
          </button>
          <button
            type="button"
            disabled={chatUnavailable || isReadOnly}
            onClick={onTogglePoll}
            className={`shrink-0 rounded-full p-2 transition-all disabled:opacity-40 ${showPoll ? 'gradient-primary text-primary-foreground shadow-glow' : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'}`}
            aria-label="Create poll"
          >
            <ListChecks className="h-5 w-5" />
          </button>
          <input
            value={input}
            disabled={chatUnavailable || isReadOnly}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void onSend(); } }}
            placeholder={
              chat.isCancelled
                ? 'Cancelled event chat is read-only'
                : chat.isPast
                  ? 'Past event chat is read-only'
                  : 'Type a message…'
            }
            className="flex-1 rounded-full border border-border/50 bg-secondary px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            disabled={chatUnavailable || sending || !input.trim() || isReadOnly}
            onClick={() => void onSend()}
            className="shrink-0 rounded-full gradient-primary p-2.5 shadow-glow disabled:opacity-40 active:scale-90 transition-transform"
            aria-label="Send message"
          >
            <Send className="h-4 w-4 text-primary-foreground" />
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
