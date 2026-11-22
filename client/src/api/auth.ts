import type { User } from '@/types';

const BASE_URL = '/api';

interface ApiUser {
  id: string;
  email: string;
  createdAt: string;
}

function mapUser(u: ApiUser): User {
  return { id: u.id, email: u.email, createdAt: u.createdAt };
}

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

export async function register(email: string, password: string, name?: string): Promise<{ user: User }> {
  const body: Record<string, string> = { email, password };
  if (name) body.name = name;

  const response = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await handleResponse<{ user: ApiUser }>(response);
  return { user: mapUser(data.user) };
}

export async function login(email: string, password: string): Promise<{ user: User }> {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  const data = await handleResponse<{ user: ApiUser }>(response);
  return { user: mapUser(data.user) };
}

export async function logout(): Promise<void> {
  const response = await fetch(`${BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  await handleResponse(response);
}

export async function getMe(): Promise<{ user: User }> {
  const response = await fetch(`${BASE_URL}/auth/me`, {
    credentials: 'include',
  });
  const data = await handleResponse<{ user: ApiUser }>(response);
  return { user: mapUser(data.user) };
}
