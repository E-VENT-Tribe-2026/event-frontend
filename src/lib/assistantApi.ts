import { getApiUrl } from './api';
import { API_ENDPOINTS } from './apiUrls';
import { getAuthToken, notifyAuthExpired } from './auth';
import { addEvent, getCurrentUser } from './storage';
import { getCategoryBanner } from './categoryBanners';
import { getGeneratedAvatarUrl } from './avatars';
import { invalidateEvents } from './queries';

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
  eventDetail?: AssistantEventItem;
  draft?: AssistantDraftEvent;
  validationIssues?: string[];
} {
  let displayText = replyText || '';
  let events: AssistantEventItem[] | undefined = responseObj?.events;
  let eventDetail: AssistantEventItem | undefined = responseObj?.event;
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
        eventDetail = card.event;
        // Also keep events as [card.event] for backwards compatibility
        if (!events) {
          events = [card.event];
        }
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
          eventDetail = parsed.event;
          if (!events) {
            events = [parsed.event];
          }
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

  return { displayText, events, eventDetail, draft, validationIssues };
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
 * Includes fallback to standard /api/events/?search= so events from database are always found.
 */
export async function searchAssistantEvents(
  query: string,
  signal?: AbortSignal
): Promise<AssistantSearchResponse> {
  const url = getApiUrl(API_ENDPOINTS.ASSISTANT_TOOL_SEARCH);

  let res: Response | null = null;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(query),
      credentials: 'include',
      signal,
    });
  } catch {
    // If orchestrator tool endpoint is offline or fails, continue to fallback below
  }

  if (res && res.ok) {
    const data = (await res.json()) as AssistantSearchResponse;
    if (data && Array.isArray(data.events) && data.events.length > 0) {
      return data;
    }
  }

  // Robust fallback: Query /api/events/ directly with search parameter
  try {
    const cleanTerm = query.replace(/\bevents?\b/gi, '').replace(/\bupcoming\b/gi, '').trim();
    const fallbackUrl = getApiUrl(
      cleanTerm
        ? `${API_ENDPOINTS.EVENTS}/?search=${encodeURIComponent(cleanTerm)}&limit=10`
        : `${API_ENDPOINTS.EVENTS}/?limit=10`
    );
    const fallbackRes = await fetch(fallbackUrl, {
      headers: getAuthHeaders(),
      signal,
    });
    if (fallbackRes.ok) {
      const fbData = await fallbackRes.json();
      const rawEvents = Array.isArray(fbData) ? fbData : fbData?.data || fbData?.events || [];
      const events: AssistantEventItem[] = rawEvents.map((e: any) => ({
        id: String(e.id || crypto.randomUUID()),
        title: String(e.title || 'Untitled Event'),
        description: e.description ? String(e.description) : undefined,
        category: e.category ? String(e.category) : undefined,
        cost: typeof e.cost === 'number' ? e.cost : undefined,
        max_capacity: typeof e.max_capacity === 'number' ? e.max_capacity : undefined,
        status: e.status ? String(e.status) : 'active',
        start_datetime: e.start_datetime ? String(e.start_datetime) : undefined,
        end_datetime: e.end_datetime ? String(e.end_datetime) : undefined,
        location_name: e.location_name ? String(e.location_name) : undefined,
        latitude: typeof e.latitude === 'number' ? e.latitude : undefined,
        longitude: typeof e.longitude === 'number' ? e.longitude : undefined,
        created_by: e.created_by ? String(e.created_by) : undefined,
      }));

      if (events.length > 0) {
        return {
          success: true,
          events,
        };
      }
    }
  } catch {
    // Fallback failed
  }

  return {
    success: true,
    events: [],
  };
}

/**
 * Call tool: Event Details
 * POST /api/assistant/tools/event-details
 * Includes fallback to GET /api/events/{event_id}.
 */
export async function getAssistantEventDetails(
  eventId: string,
  signal?: AbortSignal
): Promise<AssistantEventDetailsResponse> {
  const url = getApiUrl(API_ENDPOINTS.ASSISTANT_TOOL_EVENT_DETAILS);

  let res: Response | null = null;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(eventId),
      credentials: 'include',
      signal,
    });
  } catch {
    // Fallback to /api/events/{event_id}
  }

  if (res && res.ok) {
    const data = await res.json();
    if (data && data.event) {
      return data as AssistantEventDetailsResponse;
    }
  }

  // Fallback to GET /api/events/{eventId}
  try {
    const fallbackUrl = getApiUrl(`${API_ENDPOINTS.EVENTS}/${encodeURIComponent(eventId)}`);
    const fbRes = await fetch(fallbackUrl, {
      headers: getAuthHeaders(),
      signal,
    });
    if (fbRes.ok) {
      const fbData = await fbRes.json();
      const raw = fbData?.event || fbData?.data || fbData;
      if (raw && raw.title) {
        return {
          success: true,
          event: {
            id: String(raw.id || eventId),
            title: String(raw.title),
            description: raw.description ? String(raw.description) : undefined,
            category: raw.category ? String(raw.category) : undefined,
            cost: typeof raw.cost === 'number' ? raw.cost : undefined,
            max_capacity: typeof raw.max_capacity === 'number' ? raw.max_capacity : undefined,
            status: raw.status ? String(raw.status) : 'active',
            start_datetime: raw.start_datetime ? String(raw.start_datetime) : undefined,
            end_datetime: raw.end_datetime ? String(raw.end_datetime) : undefined,
            location_name: raw.location_name ? String(raw.location_name) : undefined,
            latitude: typeof raw.latitude === 'number' ? raw.latitude : undefined,
            longitude: typeof raw.longitude === 'number' ? raw.longitude : undefined,
            created_by: raw.created_by ? String(raw.created_by) : undefined,
          },
        };
      }
    }
  } catch {
    // Fallback failed
  }

  return {
    success: false,
    event: { id: eventId, title: 'Event' },
  };
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

export interface PublishDraftResult {
  success: boolean;
  eventId?: string;
  error?: string;
}

/**
 * Publish a drafted event directly from AI chat (Ticket #199).
 * Calls POST /api/v1/events/ (with fallback to /api/events/),
 * saves to local storage, and invalidates query cache so the new event
 * shows up everywhere immediately.
 */
export async function publishDraftEvent(
  draft: AssistantDraftEvent,
  signal?: AbortSignal
): Promise<PublishDraftResult> {
  const token = getAuthToken();
  if (!token) {
    throw new AssistantApiError('You must be logged in to publish an event.', 401, 'UNAUTHORIZED', false);
  }

  const now = new Date();
  const start = draft.start_datetime ? new Date(draft.start_datetime) : new Date(now.getTime() + 86400000);
  const end = draft.end_datetime ? new Date(draft.end_datetime) : new Date(start.getTime() + 2 * 3600 * 1000);
  const safeISO = (d: Date) => (Number.isNaN(d.getTime()) ? now.toISOString() : d.toISOString());

  const category = draft.category || 'Other';
  const banner = getCategoryBanner(category);

  const payload = {
    title: (draft.title || 'Untitled Event').trim(),
    description: draft.description?.trim() || '',
    category,
    cost: typeof draft.cost === 'number' ? Math.max(0, Math.round(draft.cost)) : 0,
    max_capacity: typeof draft.max_capacity === 'number' && draft.max_capacity > 0 ? Math.floor(draft.max_capacity) : 50,
    start_datetime: safeISO(start),
    end_datetime: safeISO(end),
    location_name: (draft.location_name || 'TBD').trim(),
    latitude: typeof draft.latitude === 'number' ? draft.latitude : 51.1657,
    longitude: typeof draft.longitude === 'number' ? draft.longitude : 10.4515,
  };

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${token.trim()}`,
  };

  let res: Response;
  const primaryUrl = getApiUrl('/api/v1/events/');
  try {
    res = await fetch(primaryUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      credentials: 'include',
      signal,
    });

    if (res.status === 404) {
      // Fallback to /api/events/
      const fallbackUrl = getApiUrl(`${API_ENDPOINTS.EVENTS}/`);
      res = await fetch(fallbackUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        credentials: 'include',
        signal,
      });
    }
  } catch (err: unknown) {
    if (signal?.aborted) {
      throw new AssistantApiError('Publishing request was cancelled.', 0, 'ABORTED', false);
    }
    const msg = err instanceof Error ? err.message : 'Network error';
    throw new AssistantApiError(`Failed to publish event (${msg}).`, 0, 'NETWORK_ERROR', true);
  }

  if (!res.ok) {
    let errorDetail = `Failed to publish event (HTTP ${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson?.detail) {
        errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      } else if (errJson?.message) {
        errorDetail = errJson.message;
      }
    } catch {
      // non-JSON response
    }
    throw new AssistantApiError(errorDetail, res.status, 'PUBLISH_FAILED', true);
  }

  const data = await res.json().catch(() => ({}));
  const eventId =
    data?.id ||
    data?.event?.id ||
    data?.data?.id ||
    (typeof data === 'string' ? data : undefined);

  const user = getCurrentUser();
  const createdDate = start.toISOString().slice(0, 10);
  const createdTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
  const finalId = eventId || crypto.randomUUID();

  try {
    addEvent({
      id: finalId,
      title: payload.title,
      description: payload.description,
      category: payload.category,
      date: createdDate,
      time: createdTime,
      location: payload.location_name,
      lat: payload.latitude,
      lng: payload.longitude,
      budget: payload.cost,
      participantsLimit: payload.max_capacity,
      participants: [],
      image: banner,
      organizer: user?.name || user?.username || 'Organizer',
      organizerId: user?.id || 'current_user',
      organizerAvatar: user?.avatar || getGeneratedAvatarUrl(user?.id || 'current_user'),
      isPrivate: false,
      requiresApproval: false,
      isDraft: false,
      reviews: [],
      reports: [],
      collaborators: [],
    });
  } catch {
    // Non-fatal if local storage fails
  }

  try {
    invalidateEvents();
  } catch {
    // Non-fatal if cache invalidation fails
  }

  return {
    success: true,
    eventId: finalId,
  };
}
