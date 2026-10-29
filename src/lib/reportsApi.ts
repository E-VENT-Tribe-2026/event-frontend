import { getApiUrl } from './api';
import { API_ENDPOINTS } from './apiUrls';
import { getAuthToken, notifyAuthExpired } from './auth';

export type ReportTargetType = 'event' | 'user' | 'message';
export type ReportOrigin = 'event_details' | 'profile' | 'event_chat';
export type ReportReason =
  | 'spam'
  | 'inappropriate_content'
  | 'harassment_or_hate'
  | 'scam_or_fraud'
  | 'misleading_event'
  | 'other';

export type CreateReportInput = {
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  origin: ReportOrigin;
  description?: string | null;
};

export type ReportConfirmation = {
  id: number;
  status: string;
  target_type: string;
  target_id: string;
  reason: string;
  origin: string;
  created_at: string;
  message: string;
};

export class ReportApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ReportApiError';
    this.status = status;
    this.code = code;
  }
}

const REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam',
  inappropriate_content: 'Inappropriate content',
  harassment_or_hate: 'Harassment or hate',
  scam_or_fraud: 'Scam or fraud',
  misleading_event: 'Misleading event',
  other: 'Other',
};

/** "Misleading event" is only for an event; users and messages have the other five. */
export const REPORT_REASONS_BY_TARGET: Record<ReportTargetType, ReportReason[]> = {
  event: ['spam', 'inappropriate_content', 'harassment_or_hate', 'scam_or_fraud', 'misleading_event', 'other'],
  user: ['spam', 'inappropriate_content', 'harassment_or_hate', 'scam_or_fraud', 'other'],
  message: ['spam', 'inappropriate_content', 'harassment_or_hate', 'scam_or_fraud', 'other'],
};

export function reportReasonLabel(reason: ReportReason): string {
  return REASON_LABELS[reason];
}

function detailText(body: unknown): { message: string; code?: string } {
  if (!body || typeof body !== 'object') return { message: '' };
  const row = body as Record<string, unknown>;
  const detail = row.detail ?? row.message ?? row.error;
  if (typeof detail === 'string') return { message: detail.trim() };
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const nested = detail as { message?: unknown; code?: unknown };
    return {
      message: typeof nested.message === 'string' ? nested.message.trim() : '',
      code: typeof nested.code === 'string' ? nested.code : undefined,
    };
  }
  if (Array.isArray(detail) && detail[0] && typeof detail[0] === 'object') {
    const first = detail[0] as { msg?: unknown };
    return { message: typeof first.msg === 'string' ? first.msg.trim() : '' };
  }
  return { message: '' };
}

export function messageForReportStatus(status: number, body?: unknown): string {
  const { message, code } = detailText(body);
  if (code === 'already_reported' || status === 409) {
    return 'You already have an open report about this.';
  }
  if (status === 429) return 'Too many reports. Please wait a little, then try again.';
  if (status === 400) return message || 'You cannot report your own content.';
  if (status === 403) return message || 'Join this event chat before reporting a message.';
  if (status === 404) return message || 'That item could not be found.';
  if (status === 422) return message || 'Choose a valid reason. Add details if you selected Other.';
  return message || 'Could not send the report. Please try again.';
}

export async function createReport(input: CreateReportInput): Promise<ReportConfirmation> {
  const description = input.description?.trim() || null;
  if (input.reason === 'other' && !description) {
    throw new ReportApiError('Please describe what happened.', 422);
  }
  if (description && description.length > 1000) {
    throw new ReportApiError('Description must be 1000 characters or fewer.', 422);
  }

  const token = getAuthToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(getApiUrl(API_ENDPOINTS.REPORTS), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      target_type: input.target_type,
      target_id: input.target_id,
      reason: input.reason,
      origin: input.origin,
      description,
    }),
  });
  const contentType = typeof res.headers?.get === 'function' ? res.headers.get('content-type') : '';
  const isJson = !contentType || contentType.includes('application/json');
  const body = isJson ? await res.json().catch(() => ({})) : await res.text().catch(() => '');

  if (!res.ok) {
    if (res.status === 401) notifyAuthExpired();
    const { code } = typeof body === 'object' ? detailText(body) : { code: undefined };
    throw new ReportApiError(messageForReportStatus(res.status, body), res.status, code);
  }

  return body as ReportConfirmation;
}
