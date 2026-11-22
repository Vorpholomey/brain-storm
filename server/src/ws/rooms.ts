import { WebSocket } from 'ws';
import { createLogger } from '@/lib/logger';

const logger = createLogger({ module: 'ws:rooms' });

// Карта: sessionId → Map<socketId, { userId, socket }>
interface SocketEntry {
  userId: string;
  socket: WebSocket;
}

const roomMap = new Map<string, Map<string, SocketEntry>>();

export function joinRoom(sessionId: string, socketId: string, userId: string, socket: WebSocket) {
  if (!roomMap.has(sessionId)) {
    roomMap.set(sessionId, new Map());
  }
  const room = roomMap.get(sessionId)!;
  room.set(socketId, { userId, socket });
  logger.info({ sessionId, socketId, userId, size: room.size }, 'Socket joined room');
}

export function leaveRoom(sessionId: string, socketId: string) {
  const room = roomMap.get(sessionId);
  if (room) {
    room.delete(socketId);
    logger.info({ sessionId, socketId, size: room.size }, 'Socket left room');
    if (room.size === 0) {
      roomMap.delete(sessionId);
    }
  }
}

export function getOnlineUsers(sessionId: string): string[] {
  const room = roomMap.get(sessionId);
  if (!room) {
    return [];
  }
  return Array.from(room.values()).map((e) => e.userId);
}

export function getRoomSize(sessionId: string): number {
  const room = roomMap.get(sessionId);
  return room ? room.size : 0;
}

export function broadcastToRoom(sessionId: string, message: unknown) {
  const room = roomMap.get(sessionId);
  if (!room) return;

  const data = JSON.stringify(message);
  for (const [, entry] of room) {
    if (entry.socket.readyState === 1) {
      entry.socket.send(data);
    }
  }
}
