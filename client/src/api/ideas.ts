import type { Idea, Comment } from '@/types';

const BASE_URL = '/api';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      message = body.message || message;
    } catch {
      // не JSON
    }
    const error = new Error(message) as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  return response.json();
}

/**
 * Обновить идею (PATCH).
 * PATCH /api/ideas/:id
 */
export async function updateIdea(
  ideaId: string,
  data: { title?: string; content?: string },
): Promise<Idea> {
  const response = await fetch(`${BASE_URL}/ideas/${ideaId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return handleResponse<Idea>(response);
}

/**
 * Получить все идеи сессии.
 * GET /api/ideas?sessionId=...
 */
export async function getSessionIdeas(sessionId: string): Promise<Idea[]> {
  const response = await fetch(
    `${BASE_URL}/ideas?sessionId=${encodeURIComponent(sessionId)}`,
    {
      credentials: 'include',
    },
  );
  return handleResponse<Idea[]>(response);
}

/**
 * Добавить комментарий к идее.
 * POST /api/ideas/:id/comments
 */
export async function addCommentToIdea(
  ideaId: string,
  text: string,
): Promise<Comment> {
  const response = await fetch(`${BASE_URL}/ideas/${ideaId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ text }),
  });
  return handleResponse<Comment>(response);
}

/**
 * Выбрать идею (только в PERSONAL режиме, только владелец сессии).
 * POST /api/ideas/:id/select
 */
export async function selectIdea(ideaId: string): Promise<Idea> {
  const response = await fetch(`${BASE_URL}/ideas/${ideaId}/select`, {
    method: 'POST',
    credentials: 'include',
  });
  return handleResponse<Idea>(response);
}

/**
 * Структурировать идеи из текста чата через LLM.
 * POST /api/ideas/from-chat
 * Возвращает черновики идей {title, description}.
 */
export async function structureFromChat(
  sessionId: string,
  messages: string,
): Promise<Array<{ title: string; description: string }>> {
  const response = await fetch(`${BASE_URL}/ideas/from-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ sessionId, chatText: messages }),
  });
  const result = await handleResponse<{ title: string; content: string }>(response);
  // Адаптируем ответ бэкенда ({title, content}) к формату клиента ({title, description})
  return [{ title: result.title, description: result.content }];
}
