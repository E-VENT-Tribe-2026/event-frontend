import { getApiUrl } from './api';
import { API_ENDPOINTS } from './apiUrls';
import { getAuthToken, notifyAuthExpired } from './auth';

export interface AssistantChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AssistantChatRequest {
  messages: AssistantChatMessage[];
}

export interface AssistantEventItem {
  id: string;
  title: string;
  description?: string;
  category?: string;
  start_datetime?: string;
  end_datetime?: string;
  location_name?: string;
  cost?: number;
  max_capacity?: number;
  status?: string;
  latitude?: number;
  longitude?: number;
  created_by?: string;
}

export interface AssistantDraftEvent {
  title?: string;
  description?: string;
  category?: string;
  cost?: number;
  max_capacity?: number;
  start_datetime?: string;
  end_datetime?: string;
  location_name?: string;
  latitude?: number;
  longitude?: number;
}

export type AssistantCardPayload =
  | { type: 'events'; events: AssistantEventItem[] }
  | { type: 'draft'; draft: AssistantDraftEvent; validation_issues?: string[] }
  | { type: 'event_detail'; event: AssistantEventItem };

export interface AssistantChatResponse {
  reply: string;
  request_id?: string;
  events?: AssistantEventItem[];
  event?: AssistantEventItem;
  draft?: AssistantDraftEvent;
  validation_issues?: string[];
  cards?: AssistantCardPayload[];
}

export interface AssistantSearchResponse {
  request_id?: string;
  success: boolean;
  events: AssistantEventItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    has_next: boolean;
  };
  error?: {
    code?: string;
    message?: string;
    field?: string;
  };
}

export interface AssistantEventDetailsResponse {
  request_id?: string;
  success: boolean;
  event: AssistantEventItem;
  error?: {
    code?: string;
    message?: string;
    field?: string;
  };
}

export interface AssistantDraftResponse {
  request_id?: string;
  success: boolean;
  draft: AssistantDraftEvent;
  validation_issues?: string[];
  error?: {
    code?: string;
    message?: string;
    field?: string;
  };
}

export class AssistantApiError extends Error {
  status?: number;
  code?: string;
  canRetry: boolean;

  constructor(message: string, status?: number, code?: string, canRetry = true) {
    super(message);
    this.name = 'AssistantApiError';
    this.status = status;
    this.code = code;
    this.canRetry = canRetry;
  }
}

/**
 * Parses assistant reply markdown for embedded structured cards
 * like ```json { "events": [...] } ``` or ```json { "draft": { ... } } ```
 * or extracts them when returned in the JSON response payload.
 */
export function extractCardsFromReply(
  replyText: string,
  responseObj?: Partial<AssistantChatResponse>
): {
  displayText: string;
  events?: AssistantEventItem[];
  draft?: AssistantDraftEvent;
  validationIssues?: string[];
} {
  let displayText = replyText || '';
  let events: AssistantEventItem[] | undefined = responseObj?.events;
  let draft: AssistantDraftEvent | undefined = responseObj?.draft;
  let validationIssues: string[] | undefined = responseObj?.validation_issues;

  // Check if cards array exists on response
  if (responseObj?.cards && Array.isArray(responseObj.cards)) {
    for (const card of responseObj.cards) {
      if (card.type === 'events' && Array.isArray(card.events)) {
        events = card.events;
      } else if (card.type === 'draft' && card.draft) {
        draft = card.draft;
        validationIssues = card.validation_issues;
      } else if (card.type === 'event_detail' && card.event) {
        events = [card.event];
      }
    }
  }

  // Scan for embedded JSON codeblocks if not already provided
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(displayText)) !== null) {
    const rawContent = match[1]?.trim();
    if (!rawContent || (!rawContent.startsWith('{') && !rawContent.startsWith('['))) {
      continue;
    }

    try {
      const parsed = JSON.parse(rawContent);
      let foundCard = false;

      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.events) && parsed.events.length > 0) {
          events = parsed.events;
          foundCard = true;
        } else if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.title && (parsed[0]?.start_datetime || parsed[0]?.location_name)) {
          events = parsed;
          foundCard = true;
        }

        if (parsed.draft && typeof parsed.draft === 'object') {
          draft = parsed.draft;
          if (Array.isArray(parsed.validation_issues)) {
            validationIssues = parsed.validation_issues;
          }
          foundCard = true;
        } else if (parsed.title && (parsed.cost !== undefined || parsed.max_capacity !== undefined) && !parsed.id) {
          draft = parsed;
          if (Array.isArray(parsed.validation_issues)) {
            validationIssues = parsed.validation_issues;
          }
          foundCard = true;
        }

        if (parsed.event && typeof parsed.event === 'object') {
          events = [parsed.event];
          foundCard = true;
        }
      }

      // If the codeblock was purely a card payload, we can clean it from the display text
      if (foundCard) {
        displayText = displayText.replace(match[0], '').trim();
      }
    } catch {
      // Not valid JSON or ordinary code snippet; keep as normal markdown
    }
  }

  return { displayText, events, draft, validationIssues };
}

function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Handle API HTTP response errors uniformly with user-friendly error messages
 */
async function handleAssistantError(res: Response): Promise<never> {
  const status = res.status;

  if (status === 401) {
    notifyAuthExpired();
    throw new AssistantApiError('Your session has expired. Please log in again.', 401, 'UNAUTHORIZED', false);
  }

  let errorMessage = '';
  let errorCode = '';

  try {
    const body = await res.json();
    if (body) {
      if (body.error && typeof body.error === 'object') {
        errorMessage = body.error.message || '';
        errorCode = body.error.code || '';
      } else if (typeof body.error === 'string') {
        errorMessage = body.error;
      }
      if (!errorMessage) {
        errorMessage = body.detail || body.message || body.reply || '';
      }
    }
  } catch {
    // Non-JSON error body
  }

  if (status === 502) {
    throw new AssistantApiError(
      errorMessage
        ? `Bad Gateway (502): ${errorMessage}`
        : 'Bad Gateway (502): The assistant server is temporarily unreachable. Please retry.',
      502,
      errorCode || 'BAD_GATEWAY',
      true
    );
  }

  if (status === 503) {
    throw new AssistantApiError(
      errorMessage
        ? `Service Unavailable (503): ${errorMessage}`
        : 'Service Unavailable (503): The AI assistant is currently overloaded. Please try again.',
      503,
      errorCode || 'SERVICE_UNAVAILABLE',
      true
    );
  }

  if (status === 422) {
    throw new AssistantApiError(
      errorMessage
        ? `Unprocessable Entity (422): ${errorMessage}`
        : 'Unprocessable Entity (422): The request was invalid or could not be processed.',
      422,
      errorCode || 'UNPROCESSABLE_ENTITY',
      true
    );
  }

  throw new AssistantApiError(
    errorMessage || `Assistant request failed with status ${status}.`,
    status,
    errorCode,
    true
  );
}

/**
 * Send full conversation turn history to backend AI Assistant
 * POST /api/assistant/chat
 */
export async function sendAssistantChat(
  messages: AssistantChatMessage[],
  signal?: AbortSignal
): Promise<AssistantChatResponse> {
  const url = getApiUrl(API_ENDPOINTS.ASSISTANT_CHAT);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ messages }),
      credentials: 'include',
      signal,
    });
  } catch (err: unknown) {
    if (signal?.aborted) {
      throw new AssistantApiError('Request cancelled.', 0, 'ABORTED', false);
    }
    const msg = err instanceof Error ? err.message : 'Network error';
    throw new AssistantApiError(
      `Network connection dropped (${msg}). Please check your connection and try again.`,
      0,
      'NETWORK_ERROR',
      true
    );
  }

  if (!res.ok) {
    return handleAssistantError(res);
  }

  const data = await res.json().catch(() => ({ reply: '' }));
  return data as AssistantChatResponse;
}

/**
 * Call tool: Search Events
 * POST /api/assistant/tools/search-events
 */
export async function searchAssistantEvents(
  query: string,
  signal?: AbortSignal
): Promise<AssistantSearchResponse> {
  const url = getApiUrl(API_ENDPOINTS.ASSISTANT_TOOL_SEARCH);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(query),
      credentials: 'include',
      signal,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network error';
    throw new AssistantApiError(`Failed to search events (${msg}).`, 0, 'NETWORK_ERROR', true);
  }

  if (!res.ok) {
    return handleAssistantError(res);
  }

  return (await res.json()) as AssistantSearchResponse;
}

/**
 * Call tool: Event Details
 * POST /api/assistant/tools/event-details
 */
export async function getAssistantEventDetails(
  eventId: string,
  signal?: AbortSignal
): Promise<AssistantEventDetailsResponse> {
  const url = getApiUrl(API_ENDPOINTS.ASSISTANT_TOOL_EVENT_DETAILS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(eventId),
      credentials: 'include',
      signal,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network error';
    throw new AssistantApiError(`Failed to fetch event details (${msg}).`, 0, 'NETWORK_ERROR', true);
  }

  if (!res.ok) {
    return handleAssistantError(res);
  }

  return (await res.json()) as AssistantEventDetailsResponse;
}

/**
 * Call tool: Draft Event
 * POST /api/assistant/tools/draft-event
 */
export async function draftAssistantEvent(
  promptText: string,
  signal?: AbortSignal
): Promise<AssistantDraftResponse> {
  const url = getApiUrl(API_ENDPOINTS.ASSISTANT_TOOL_DRAFT_EVENT);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(promptText),
      credentials: 'include',
      signal,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network error';
    throw new AssistantApiError(`Failed to draft event (${msg}).`, 0, 'NETWORK_ERROR', true);
  }

  if (!res.ok) {
    return handleAssistantError(res);
  }

  return (await res.json()) as AssistantDraftResponse;
}
