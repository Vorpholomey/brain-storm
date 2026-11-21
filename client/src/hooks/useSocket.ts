import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '@brain-storm/shared';

interface UseSocketOptions {
  sessionId: string;
  token: string;
  onVoteUpdated?: (data: { ideaId: string; voteCount: number }) => void;
  onVoteRejected?: (reason: string) => void;
  onJoined?: (data: { sessionId: string }) => void;
  onError?: (data: { message: string }) => void;
  onServerTime?: (serverTime: number) => void;
  onStageAdvanced?: (data: { stage: string; stageDeadline: Date | null }) => void;
}

export function useSocket({
  sessionId,
  token,
  onVoteUpdated,
  onVoteRejected,
  onJoined,
  onError,
  onServerTime,
  onStageAdvanced,
}: UseSocketOptions) {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const sessionIdRef = useRef(sessionId);
  const [timeOffset, setTimeOffset] = useState(0);

  useEffect(() => {
    const socket = io('http://localhost:3000', {
      auth: { token },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connected', () => {
      console.log('[Socket] Подключён к серверу');
      // Присоединяемся к сессии
      socket.emit('join_session', sessionIdRef.current);
    });

    socket.on('joined', (data) => {
      console.log('[Socket] Присоединился к сессии:', data.sessionId);
      onJoined?.(data);
    });

    socket.on('vote_updated', (data) => {
      console.log('[Socket] Голос подтверждён:', data);
      onVoteUpdated?.(data);
    });

    socket.on('vote_rejected', (reason) => {
      console.log('[Socket] Голос отклонён:', reason);
      onVoteRejected?.(reason);
    });

    socket.on('error', (data) => {
      console.error('[Socket] Ошибка:', data.message);
      onError?.(data);
    });

    socket.on('server_time', (data) => {
      const serverTime = data.serverTime;
      const offset = serverTime - Date.now();
      setTimeOffset(offset);
      console.log('[Socket] Серверное время получено, смещение:', offset, 'мс');
      onServerTime?.(serverTime);
    });

    socket.on('stage_advanced', (data) => {
      console.log('[Socket] Стадия изменена:', data.stage, 'дедлайн:', data.stageDeadline);
      onStageAdvanced?.({ stage: data.stage, stageDeadline: data.stageDeadline });
    });

    return () => {
      socket.emit('leave_session');
      socket.disconnect();
      socketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, token, onVoteUpdated, onVoteRejected, onJoined, onError, onServerTime, onStageAdvanced]);

  const castVote = useCallback(
    (ideaId: string, callback?: (error?: string) => void) => {
      if (socketRef.current) {
        socketRef.current.emit('cast_vote', ideaId, callback ?? (() => {}));
      }
    },
    []
  );

  return { castVote, socket: socketRef.current, timeOffset };
}
