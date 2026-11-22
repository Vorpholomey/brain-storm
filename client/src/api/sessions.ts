import type {
  SessionConfig,
  SessionMode,
  SessionListItem,
  CreateSessionResponse,
  SessionDetailsResponse,
} from '@/types';

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

export interface CreateSessionPayload {
  topic: string;
  mode: SessionMode;
  config: SessionConfig;
  startDate?: string;
  startTime?: string;
}

export async function getSessionList(): Promise<SessionListItem[]> {
  const response = await fetch(`${BASE_URL}/sessions`, {
    credentials: 'include',
  });
  return handleResponse<SessionListItem[]>(response);
}

export async function createSession(
  payload: CreateSessionPayload,
): Promise<CreateSessionResponse> {
  const response = await fetch(`${BASE_URL}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return handleResponse<CreateSessionResponse>(response);
}

/**
 * Получить детали сессии (с участниками и идеями).
 * GET /api/sessions/:id
 */
export async function getSessionDetails(
  id: string,
): Promise<SessionDetailsResponse> {
  const response = await fetch(`${BASE_URL}/sessions/${id}`, {
    credentials: 'include',
  });
  return handleResponse<SessionDetailsResponse>(response);
}

/**
 * Дублировать сессию с теми же настройками.
 * Реализация: GET /api/sessions/:id + POST /api/sessions
 */
export async function duplicateSession(
  id: string,
): Promise<CreateSessionResponse> {
  const details = await getSessionDetails(id);
  const { session } = details;
  return createSession({
    topic: session.topic,
    mode: session.mode,
    config: session.config,
  });
}
