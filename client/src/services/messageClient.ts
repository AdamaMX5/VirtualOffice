import { useAuthStore } from '../model/stores/authStore';
import { MESSAGE_URL } from '../model/constants';
import type { Message } from '../model/stores/messageStore';

function getJwt(): string {
  const jwt = useAuthStore.getState().jwt;
  if (!jwt) throw new Error('Nicht eingeloggt');
  return jwt;
}

async function msgFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const jwt = getJwt();
  const res = await fetch(`${MESSAGE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
      ...(options.headers as Record<string, string> | undefined),
    },
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error(String(data.error ?? data.detail ?? 'MessageService-Fehler'));
  return data as T;
}

export async function getUnreadCount(): Promise<number> {
  const data = await msgFetch<{ count: number }>('/messages/unread-count');
  return data.count;
}

export async function getInbox(page = 1, limit = 50): Promise<Message[]> {
  const data = await msgFetch<{ messages: Message[] }>(
    `/messages/inbox?page=${page}&limit=${limit}`,
  );
  return data.messages ?? [];
}

export async function getConversation(userId: string, page = 1, limit = 100): Promise<Message[]> {
  const data = await msgFetch<{ messages: Message[] }>(
    `/messages/conversation/${userId}?page=${page}&limit=${limit}`,
  );
  return data.messages ?? [];
}

export async function sendMessage(recipientId: string, body: string): Promise<Message> {
  return msgFetch<Message>('/messages', {
    method: 'POST',
    body: JSON.stringify({ recipientId, body }),
  });
}

export async function markAllRead(senderId: string): Promise<void> {
  await msgFetch('/messages/read-all', {
    method: 'PATCH',
    body: JSON.stringify({ senderId }),
  });
}

export async function deleteMessage(id: string): Promise<void> {
  await msgFetch(`/messages/${id}`, { method: 'DELETE' });
}
