import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { notifyChatMessagesChanged } from '@/lib/realtimeEvents';

export type ChatPayloadType = 'text' | 'file' | 'voice' | 'poll' | 'poll_vote' | 'checkin';

export type EncodedChatPayload = {
  v: 1;
  type: ChatPayloadType;
  text?: string;
  fileName?: string;
  mimeType?: string;
  dataUrl?: string;
  pollId?: string;
  question?: string;
  options?: string[];
  optionIndex?: number;
};

export function chatMessagesPath(eventId: string) {
  return `/api/chats/${eventId}/messages`;
}

export function encodeChatPayload(payload: EncodedChatPayload): string {
  return JSON.stringify(payload);
}

export function parseChatPayload(raw: string): EncodedChatPayload | null {
  try {
    const parsed = JSON.parse(raw) as EncodedChatPayload;
    if (!parsed || parsed.v !== 1 || typeof parsed.type !== 'string') return null;
    if (
      parsed.type === 'text' ||
      parsed.type === 'file' ||
      parsed.type === 'voice' ||
      parsed.type === 'poll' ||
      parsed.type === 'poll_vote' ||
      parsed.type === 'checkin'
    ) {
      return parsed;
    }
  } catch {
    /* plain text */
  }
  return null;
}

export async function postEventChatMessage(eventId: string, payload: EncodedChatPayload): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;
  try {
    const res = await fetch(getApiUrl(chatMessagesPath(eventId)), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ content: encodeChatPayload(payload) }),
    });
    if (!res.ok) return false;
    notifyChatMessagesChanged(eventId);
    return true;
  } catch {
    return false;
  }
}
