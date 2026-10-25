import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Sparkles,
  Send,
  X,
  Minus,
  RotateCcw,
  Bot,
  AlertCircle,
  RefreshCw,
  Search,
  CalendarPlus,
  Maximize2,
  ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { getAuthToken } from '@/lib/auth';
import { isAdministratorRole } from '@/lib/adminApi';
import { getCurrentUser } from '@/lib/storage';
import { assistantQuota, consumeAssistantAsk, BASIC_ASSISTANT_ASKS_PER_DAY } from '@/lib/assistantQuota';
import {
  sendAssistantChat,
  searchAssistantEvents,
  draftAssistantEvent,
  extractCardsFromReply,
  type AssistantChatMessage,
  type AssistantEventItem,
  type AssistantDraftEvent,
  AssistantApiError,
} from '@/lib/assistantApi';
import { AssistantMarkdown } from './AssistantMarkdown';
import { AssistantEventCard } from './AssistantEventCard';
import { AssistantEventDetailCard } from './AssistantEventDetailCard';
import { AssistantDraftCard } from './AssistantDraftCard';

export interface ChatThreadMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  status?: 'sending' | 'sent' | 'error';
  errorMessage?: string;
  events?: AssistantEventItem[];
  eventDetail?: AssistantEventItem;
  draft?: AssistantDraftEvent;
  validationIssues?: string[];
}

const STORAGE_KEY = 'event_assistant_chat_history_v1';
const MAX_CHAR_COUNT = 1000;

const SUGGESTED_PROMPTS = [
  'What is E-VENT and what can you help me with?',
  '🔍 Search upcoming music events',
  '✨ Draft a weekend tech meetup',
  '🎉 What events are happening this weekend?',
];

// Routes where the floating button shouldn't appear (unauthenticated/onboarding)
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/choose-username',
  '/admin-verify',
];

export function isHiddenAssistantRoute(pathname: string): boolean {
  const path = pathname.toLowerCase();
  if (PUBLIC_PATHS.includes(path) || PUBLIC_PATHS.includes(pathname)) return true;
  return path === '/admin' || path.startsWith('/admin');
}

export const AIAssistantWidget: React.FC = () => {
  const location = useLocation();
  const token = getAuthToken();
  const reduceMotion = useReducedMotion();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatThreadMessage[]>(() => {
    try {
      const saved = window.sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignore parse errors
    }
    return [];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [bannerError, setBannerError] = useState<{
    message: string;
    status?: number;
    canRetry: boolean;
  } | null>(null);
  const [quotaTick, setQuotaTick] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastFailedPromptRef = useRef<string | null>(null);

  // Sync messages to sessionStorage
  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // Storage unavailable
    }
  }, [messages]);

  // Scroll to bottom on new messages or loading state change
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom(false);
    }
  }, [isOpen, isMinimized, messages.length, isLoading, scrollToBottom]);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.min(Math.max(el.scrollHeight, 40), 120);
    el.style.height = `${newHeight}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  const viewer = getCurrentUser();

  // Never show on public routes, administrator screens, or administrator sessions.
  if (!token || isHiddenAssistantRoute(location.pathname) || isAdministratorRole(viewer?.role)) {
    return null;
  }
  const quota = assistantQuota(viewer?.id);
  const outOfAsks = quota.remaining <= 0;
  void quotaTick;

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    setTimeout(() => {
      textareaRef.current?.focus();
      scrollToBottom(false);
    }, 150);
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  const handleToggleMinimize = () => {
    setIsMinimized((prev) => !prev);
  };

  const handleResetConversation = () => {
    setMessages([]);
    setBannerError(null);
    lastFailedPromptRef.current = null;
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  const sendMessage = async (rawContent: string) => {
    const trimmed = rawContent.trim();
    if (!trimmed || isLoading) return;

    if (trimmed.length > MAX_CHAR_COUNT) {
      setBannerError({
        message: `Message is too long. Please limit to ${MAX_CHAR_COUNT} characters.`,
        canRetry: false,
      });
      return;
    }

    const viewer = getCurrentUser();
    if (assistantQuota(viewer?.id).remaining <= 0) {
      setBannerError({
        message: `You've used your ${BASIC_ASSISTANT_ASKS_PER_DAY} AI asks today. Come back tomorrow.`,
        canRetry: false,
      });
      setQuotaTick((n) => n + 1);
      return;
    }

    setBannerError(null);
    lastFailedPromptRef.current = trimmed;

    const userMsg: ChatThreadMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
    }
    setIsLoading(true);

    // Prepare full conversation turn history
    const apiHistory: AssistantChatMessage[] = nextMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    let charged = false;
    try {
      // If user specifically clicks quick search chip
      if (trimmed.startsWith('🔍 Search upcoming') || trimmed.toLowerCase().startsWith('/search ')) {
        const rawQuery = trimmed
          .replace(/^🔍\s*Search\s*upcoming\s*/i, '')
          .replace(/^\/search\s*/i, '')
          .trim();
        const cleanQuery = rawQuery.replace(/\bevents?\b/gi, '').replace(/\bupcoming\b/gi, '').trim();
        const queryToSearch = cleanQuery || 'music';

        const searchRes = await searchAssistantEvents(queryToSearch);
        const hasEvents = searchRes.events && searchRes.events.length > 0;
        const displayTerm = rawQuery || queryToSearch;

        const assistantMsg: ChatThreadMessage = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: hasEvents
            ? `Here are the matching events for **"${displayTerm}"**:`
            : `No events found matching **"${displayTerm}"**.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          events: searchRes.events,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        lastFailedPromptRef.current = null;
        charged = true;
        return;
      }

      // If user clicks draft event chip
      if (trimmed.startsWith('✨ Draft a') || trimmed.toLowerCase().startsWith('/draft ')) {
        const draftPrompt = trimmed.replace(/^✨\s*Draft\s*a\s*/i, '').replace(/^\/draft\s*/i, '').trim();
        const draftRes = await draftAssistantEvent(draftPrompt || 'Tech meetup this Friday at 6pm');
        const assistantMsg: ChatThreadMessage = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: `I've prepared a draft event for **"${draftPrompt || 'Tech Meetup'}"**:`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          draft: draftRes.draft,
          validationIssues: draftRes.validation_issues,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        lastFailedPromptRef.current = null;
        charged = true;
        return;
      }

      // Standard multi-turn chat API
      const res = await sendAssistantChat(apiHistory);
      const parsed = extractCardsFromReply(res.reply || '', res);

      const assistantMsg: ChatThreadMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: parsed.displayText || res.reply || '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        events: parsed.events,
        eventDetail: parsed.eventDetail,
        draft: parsed.draft,
        validationIssues: parsed.validationIssues,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      lastFailedPromptRef.current = null;
      charged = true;
    } catch (err: unknown) {
      let errorMsg = 'Failed to get a response from the AI assistant.';
      let status: number | undefined;
      let canRetry = true;

      if (err instanceof AssistantApiError) {
        errorMsg = err.message;
        status = err.status;
        canRetry = err.canRetry;
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }

      setBannerError({
        message: errorMsg,
        status,
        canRetry,
      });
    } finally {
      if (charged) {
        consumeAssistantAsk(viewer?.id);
        setQuotaTick((n) => n + 1);
      }
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    if (lastFailedPromptRef.current) {
      const promptToRetry = lastFailedPromptRef.current;
      sendMessage(promptToRetry);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            key="ai-assistant-fab-wrap"
            className="fixed top-40 right-4 sm:top-40 sm:right-6 md:right-8 z-40 h-14 w-14"
            initial={{ scale: 0, opacity: 0 }}
            animate={
              reduceMotion
                ? { scale: 1, opacity: 1 }
                : { scale: 1, opacity: 1, y: [0, -8, 0] }
            }
            exit={{ scale: 0, opacity: 0 }}
            transition={
              reduceMotion
                ? { duration: 0.2 }
                : {
                    scale: { type: 'spring', stiffness: 280, damping: 18 },
                    opacity: { duration: 0.2 },
                    y: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' },
                  }
            }
          >
            {!reduceMotion && (
              <>
                <span
                  aria-hidden
                  className="pointer-events-none absolute -inset-1 rounded-full bg-cyan-300/40 animate-assistant-ring"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute -inset-1 rounded-full bg-cyan-300/25 animate-assistant-ring [animation-delay:1.2s]"
                />
              </>
            )}
            <motion.button
              id="ai-assistant-fab"
              data-testid="ai-assistant-fab"
              aria-label="Open AI Assistant"
              onClick={handleOpen}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              className="group relative flex h-14 w-14 items-center justify-center rounded-full gradient-assistant text-white shadow-assistant animate-assistant-glow focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-background"
            >
              <motion.div
                className="relative flex items-center justify-center"
                animate={reduceMotion ? undefined : { rotate: [0, 10, -8, 0] }}
                transition={
                  reduceMotion
                    ? undefined
                    : { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }
                }
              >
                <Bot className="h-6 w-6" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-200 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-200" />
                </span>
              </motion.div>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimized Floating Pill */}
      {isOpen && isMinimized && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          className="fixed top-40 right-4 sm:top-40 sm:right-6 z-40 flex items-center gap-2 rounded-full border border-primary/40 bg-card/95 backdrop-blur-md px-3.5 py-2 shadow-xl"
        >
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsMinimized(false)}>
            <div className="flex h-6 w-6 items-center justify-center rounded-full gradient-assistant text-white text-xs">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-semibold text-foreground">E-VENT Assistant</span>
            {isLoading ? (
              <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
            ) : (
              <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
            )}
          </div>
          <button
            type="button"
            aria-label="Maximize Assistant"
            onClick={() => setIsMinimized(false)}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Close Assistant"
            onClick={handleClose}
            className="p-1 text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}

      {/* Main Slide-Out / Modal Chat Container */}
      <AnimatePresence>
        {isOpen && !isMinimized && (
          <motion.div
            id="ai-assistant-container"
            data-testid="ai-assistant-drawer"
            role="dialog"
            aria-label="AI Event Assistant"
            initial={{ opacity: 0, y: -24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.96 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed top-40 right-2 sm:right-6 z-40 flex h-[600px] max-h-[calc(100vh-12rem)] w-[calc(100vw-1rem)] sm:w-[420px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-2xl backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/70 bg-card/80 px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative flex h-8 w-8 items-center justify-center rounded-xl gradient-assistant text-white shadow-sm">
                  <Bot className="h-4 w-4" />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${
                      isLoading ? 'bg-accent animate-pulse' : 'bg-emerald-400'
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="truncate text-sm font-bold text-foreground">
                      E-VENT Assistant
                    </h3>
                    <span className="rounded-full bg-primary/20 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-primary">
                      AI
                    </span>
                  </div>
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isLoading ? 'bg-accent animate-ping' : 'bg-emerald-400'
                      }`}
                    />
                    <span>
                      {isLoading
                        ? 'Thinking...'
                        : `${quota.remaining} of ${quota.limit} asks left today`}
                    </span>
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetConversation}
                    aria-label="Reset conversation"
                    title="Clear history"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleToggleMinimize}
                  aria-label="Minimize"
                  title="Minimize window"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close"
                  title="Close assistant"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {bannerError && (
              <div
                data-testid="ai-error-banner"
                className="flex items-start justify-between gap-2 border-b border-destructive/30 bg-destructive/15 px-3 py-2 text-xs text-destructive-foreground animate-fadeIn"
              >
                <div className="flex items-start gap-1.5 min-w-0">
                  <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                  <p className="text-xs leading-snug">
                    {bannerError.message}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {bannerError.canRetry && (
                    <button
                      type="button"
                      data-testid="ai-retry-button"
                      onClick={handleRetry}
                      className="inline-flex items-center gap-1 rounded bg-destructive px-2 py-0.5 text-[11px] font-bold text-white hover:bg-destructive/90 transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Retry</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setBannerError(null)}
                    aria-label="Dismiss error"
                    className="p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Message Thread Area */}
            <div
              data-testid="ai-chat-messages"
              className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
            >
              {messages.length === 0 ? (
                /* Welcome / Orientation Guidance */
                <div className="flex h-full flex-col justify-center text-center px-2 py-6">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-assistant text-white shadow-assistant mb-3">
                    <Sparkles className="h-7 w-7" />
                  </div>
                  <h4 className="text-base font-bold text-foreground">
                    Welcome to E-VENT AI
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                    Ask me anything about local events, discovering music & tech gatherings,
                    or drafting your next big event!
                  </p>

                  <div className="mt-5 space-y-2 text-left">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Suggested Prompts:
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {SUGGESTED_PROMPTS.map((promptText, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => sendMessage(promptText)}
                          disabled={outOfAsks}
                          className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-left text-xs font-medium text-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all text-ellipsis overflow-hidden disabled:opacity-50"
                        >
                          {promptText}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Chat Messages */
                messages.map((msg) => {
                  const isUser = msg.role === 'user';

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
                    >
                      <div className={`flex items-end gap-2 max-w-[88%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                        {!isUser && (
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full gradient-assistant text-white text-[10px]">
                            <Bot className="h-3.5 w-3.5" />
                          </div>
                        )}

                        <div
                          className={`rounded-2xl px-3.5 py-2.5 text-sm shadow-sm leading-relaxed ${
                            isUser
                              ? 'gradient-primary text-white rounded-br-xs'
                              : 'border border-border/60 bg-card text-foreground rounded-bl-xs'
                          }`}
                        >
                          {isUser ? (
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          ) : (
                            <AssistantMarkdown content={msg.content} />
                          )}
                        </div>
                      </div>

                      {/* Rich Cards (Single Event Detail View) */}
                      {!isUser && msg.eventDetail && (
                        <div className="mt-1 w-full pl-8 max-w-[95%]">
                          <AssistantEventDetailCard event={msg.eventDetail} />
                        </div>
                      )}

                      {/* Rich Cards (Event Results List) */}
                      {!isUser && !msg.eventDetail && msg.events && msg.events.length > 0 && (
                        <div className="mt-1 space-y-2 w-full pl-8 max-w-[95%]">
                          {msg.events.map((evt) => (
                            <AssistantEventCard key={evt.id} event={evt} />
                          ))}
                        </div>
                      )}

                      {/* Rich Cards (Draft Event Preview) */}
                      {!isUser && msg.draft && (
                        <div className="mt-1 w-full pl-8 max-w-[95%]">
                          <AssistantDraftCard
                            draft={msg.draft}
                            validationIssues={msg.validationIssues}
                          />
                        </div>
                      )}

                      {/* Timestamp */}
                      <span
                        className={`text-[10px] text-muted-foreground px-1 ${
                          isUser ? 'text-right' : 'pl-8'
                        }`}
                      >
                        {msg.timestamp}
                      </span>
                    </div>
                  );
                })
              )}

              {/* Loading Skeleton Indicator */}
              {isLoading && (
                <div className="flex items-end gap-2 max-w-[88%]">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full gradient-assistant text-white text-[10px]">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                  <div
                    data-testid="ai-loading-indicator"
                    className="flex items-center gap-1.5 rounded-2xl rounded-bl-xs border border-border/60 bg-card px-4 py-3 shadow-sm"
                  >
                    <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 rounded-full bg-primary animate-bounce" />
                    <span className="ml-2 text-xs text-muted-foreground">E-VENT is thinking...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Tools Bar */}
            <div className="flex items-center gap-1.5 border-t border-border/40 bg-card/50 px-3 py-1.5 text-[11px] text-muted-foreground">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Quick:</span>
              <button
                type="button"
                onClick={() => sendMessage('🔍 Search upcoming events')}
                disabled={isLoading || outOfAsks}
                className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-50"
              >
                <Search className="h-3 w-3" />
                <span>Search Events</span>
              </button>
              <button
                type="button"
                onClick={() => sendMessage('✨ Draft a new event')}
                disabled={isLoading || outOfAsks}
                className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-50"
              >
                <CalendarPlus className="h-3 w-3" />
                <span>Draft Event</span>
              </button>
            </div>

            {/* Text Input Area */}
            <div className="border-t border-border/70 bg-card/95 p-3 backdrop-blur-sm">
              <div className="relative flex items-end gap-2 rounded-xl border border-border/70 bg-muted/40 p-1.5 focus-within:border-primary/80 focus-within:ring-1 focus-within:ring-primary/80 transition-all">
                <textarea
                  ref={textareaRef}
                  data-testid="ai-chat-input"
                  rows={1}
                  value={input}
                  disabled={isLoading || outOfAsks}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isLoading ? 'Waiting for assistant reply...' : 'Ask assistant... (Enter to send, Shift+Enter for newline)'
                  }
                  className="max-h-[120px] min-h-[38px] w-full resize-none bg-transparent px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60 leading-relaxed"
                />

                <button
                  type="button"
                  data-testid="ai-chat-send"
                  aria-label="Send message"
                  disabled={!input.trim() || isLoading || outOfAsks}
                  onClick={() => sendMessage(input)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary text-white shadow-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>

              {/* Character counter & info */}
              <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
                <span>Enter to send · Shift+Enter for new line</span>
                <span
                  className={
                    input.length > MAX_CHAR_COUNT * 0.9
                      ? 'text-destructive font-semibold'
                      : ''
                  }
                >
                  {input.length} / {MAX_CHAR_COUNT}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIAssistantWidget;
