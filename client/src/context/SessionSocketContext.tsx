import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useState,
} from 'react';
import type {
  SessionStage,
  SessionStatePayload,
  OnlineUsersPayload,
  StageChangedPayload,
  ErrorPayload,
  IdeaCreatedPayload,
  VoteRejectedPayload,
  VoteUpdatedPayload,
} from '@/types';

// ---------------------------------------------------------------------------
// Event emitter types
// ---------------------------------------------------------------------------

type WsEventHandler = (payload: unknown) => void;

const WS_EVENT_TYPES = [
  'vote_updated',
  'vote_rejected',
  'idea_created',
  'stage_changed',
  'online_users',
  'error',
] as const;
type WsEventType = (typeof WS_EVENT_TYPES)[number];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionSocketValue {
  socket: WebSocket | null;
  isConnected: boolean;
  onlineUsers: string[];
  currentStage: SessionStage | null;
  stageDeadline: string | null;
  serverOffset: number; // сервер-клиент в мс
  sessionId: string | null;

  // Состояние сессии (полное)
  sessionState: SessionStatePayload | null;

  // Методы
  joinSession: (sessionId: string) => Promise<void>;
  leaveSession: () => void;
  send: (type: string, payload?: unknown) => void;

  // Event subscriptions
  on: (event: WsEventType, handler: WsEventHandler) => () => void;
}

interface SessionSocketProviderProps {
  sessionId: string;
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const SessionSocketContext = createContext<SessionSocketValue | null>(null);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

function exponentialBackoff(attempt: number, maxMs = 30_000): number {
  const base = 1_000;
  return Math.min(base * Math.pow(2, attempt), maxMs);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const SessionSocketProvider: React.FC<SessionSocketProviderProps> = ({
  sessionId,
  children,
}) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [currentStage, setCurrentStage] = useState<SessionStage | null>(null);
  const [stageDeadline, setStageDeadline] = useState<string | null>(null);
  const [serverOffset, setServerOffset] = useState(0);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<SessionStatePayload | null>(null);

  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // Event emitter: eventType -> handlers[]
  const handlersRef = useRef<Map<WsEventType, Set<WsEventHandler>>>(new Map());

  const emit = useCallback((event: WsEventType, payload: unknown) => {
    const handlers = handlersRef.current.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(payload);
        } catch (err) {
          console.error('WS event handler error:', err);
        }
      }
    }
  }, []);

  const on = useCallback(
    (event: WsEventType, handler: WsEventHandler): (() => void) => {
      let handlers = handlersRef.current.get(event);
      if (!handlers) {
        handlers = new Set();
        handlersRef.current.set(event, handlers);
      }
      handlers.add(handler);
      return () => {
        handlers?.delete(handler);
      };
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    clearReconnectTimer();
    if (socketRef.current) {
      socketRef.current.onclose = null;
      socketRef.current.onerror = null;
      socketRef.current.onmessage = null;
      socketRef.current.close();
      socketRef.current = null;
    }
    setSocket(null);
    setIsConnected(false);
  }, [clearReconnectTimer]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // -----------------------------------------------------------------------
  // Message handler
  // -----------------------------------------------------------------------

  const handleServerMessage = useCallback(
    (msg: { type: string; payload?: unknown }) => {
      switch (msg.type) {
        case 'session_state': {
          const p = msg.payload as SessionStatePayload;
          setSessionState(p);
          setCurrentStage(p.currentStage);
          setStageDeadline(p.stageDeadline);
          setOnlineUsers(p.onlineUsers ?? []);
          // Вычисляем offset: серверное время - клиентское время
          const serverTime = Date.parse(p.createdAt || new Date().toISOString());
          // Используем текущий момент для offset
          setServerOffset(serverTime - Date.now());
          break;
        }
        case 'online_users': {
          const p = msg.payload as OnlineUsersPayload;
          setOnlineUsers(p.onlineUsers ?? []);
          break;
        }
        case 'stage_changed': {
          const p = msg.payload as StageChangedPayload;
          setCurrentStage(p.currentStage);
          setStageDeadline(p.stageDeadline);
          break;
        }
        case 'idea_created': {
          const p = msg.payload as IdeaCreatedPayload;
          // Обновляем ideas в sessionState
          setSessionState((prev) => {
            if (!prev) return prev;
            return { ...prev, ideas: [...prev.ideas, p.idea] };
          });
          emit('idea_created', p);
          break;
        }
        case 'vote_cast': {
          // Можно обновить votes на клиентах
          break;
        }
        case 'vote_updated': {
          const p = msg.payload as VoteUpdatedPayload;
          emit('vote_updated', p);
          break;
        }
        case 'vote_rejected': {
          const p = msg.payload as VoteRejectedPayload;
          emit('vote_rejected', p);
          break;
        }
        case 'left_session': {
          // Кто-то вышел — online_users придут отдельно
          break;
        }
        case 'error': {
          const p = msg.payload as ErrorPayload;
          console.error('WebSocket error:', p.message, p.code);
          break;
        }
      }
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Connect / Reconnect
  // -----------------------------------------------------------------------

  const connect = useCallback(
    async (targetSessionId: string) => {
      cleanup();
      reconnectAttemptRef.current = 0;

      try {
        const ws = new WebSocket(wsUrl());
        socketRef.current = ws;
        setSocket(ws);

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('WS timeout')), 5_000);

          ws.onopen = () => {
            clearTimeout(timeout);
            resolve();
          };

          ws.onerror = (e) => {
            clearTimeout(timeout);
            reject(e);
          };
        });

        setIsConnected(true);
        reconnectAttemptRef.current = 0;

        // Настройка обработчиков
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data as string);
            handleServerMessage(msg);
          } catch {
            console.error('Failed to parse WS message:', event.data);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          // Запускаем реконнект если всё ещё должны быть подключены
          if (activeSessionId) {
            scheduleReconnect(targetSessionId);
          }
        };

        ws.onerror = () => {
          setIsConnected(false);
        };

        // Отправляем join_session
        ws.send(
          JSON.stringify({
            type: 'join_session',
            payload: { sessionId: targetSessionId },
          })
        );
      } catch (error) {
        console.error('WebSocket connection failed:', error);
        setIsConnected(false);
        scheduleReconnect(targetSessionId);
      }
    },
    [cleanup, handleServerMessage, activeSessionId],
  );

  const scheduleReconnect = useCallback(
    (targetSessionId: string) => {
      const attempt = reconnectAttemptRef.current;
      const delay = exponentialBackoff(attempt);
      reconnectAttemptRef.current = attempt + 1;

      reconnectTimeoutRef.current = setTimeout(async () => {
        // Перед реконнектом синхронизируем состояние через REST
        try {
          await syncSessionState(targetSessionId);
        } catch {
          // Ошибка синхронизации — переподключимся всё равно
        }
        connect(targetSessionId);
      }, delay);
    },
    [connect],
  );

  // -----------------------------------------------------------------------
  // REST sync
  // -----------------------------------------------------------------------

  const syncSessionState = useCallback(async (sid: string) => {
    const resp = await fetch(`/api/sessions/${sid}/state`, {
      credentials: 'include',
    });
    if (!resp.ok) return;
    const data: SessionStatePayload = await resp.json();
    setSessionState(data);
    setCurrentStage(data.currentStage);
    setStageDeadline(data.stageDeadline);
    setOnlineUsers(data.onlineUsers ?? []);
  }, []);

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  const joinSession = useCallback(
    async (targetSessionId: string) => {
      setActiveSessionId(targetSessionId);
      await connect(targetSessionId);
    },
    [connect],
  );

  const leaveSession = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'leave_session',
          payload: { sessionId: activeSessionId },
        })
      );
    }
    setActiveSessionId(null);
    setSessionState(null);
    setCurrentStage(null);
    setStageDeadline(null);
    setOnlineUsers([]);
    cleanup();
  }, [activeSessionId, cleanup]);

  const send = useCallback((type: string, payload?: unknown) => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  }, []);

  // -----------------------------------------------------------------------
  // Auto-join при монтировании
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (sessionId) {
      joinSession(sessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // -----------------------------------------------------------------------
  // Context value
  // -----------------------------------------------------------------------

  const value: SessionSocketValue = {
    socket,
    isConnected,
    onlineUsers,
    currentStage,
    stageDeadline,
    serverOffset,
    sessionId: activeSessionId,
    sessionState,
    joinSession,
    leaveSession,
    send,
    on,
  };

  return (
    <SessionSocketContext.Provider value={value}>
      {children}
    </SessionSocketContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hook (конкретная реализация в useSessionSocket.ts, но экспорт для
// совместимости)
// ---------------------------------------------------------------------------

export function useSessionSocketContext(): SessionSocketValue {
  const context = useContext(SessionSocketContext);
  if (!context) {
    throw new Error(
      'useSessionSocketContext must be used within SessionSocketProvider'
    );
  }
  return context;
}

export { SessionSocketContext };
