import { useState, useEffect } from 'react';

export interface UseServerTimerResult {
  remainingMs: number;
  formatted: string; // "MM:SS"
  isExpired: boolean;
}

function formatMMSS(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function computeRemaining(deadline: string, serverOffset: number): number {
  const deadlineMs = new Date(deadline).getTime();
  const adjustedDeadline = deadlineMs + serverOffset;
  const remaining = adjustedDeadline - Date.now();
  return Math.max(0, remaining);
}

export function useServerTimer(
  deadline: string | null,
  serverOffset: number,
  onExpire?: () => void,
): UseServerTimerResult {
  const [tick, setTick] = useState(0);

  const expired = deadline !== null && computeRemaining(deadline, serverOffset) === 0;

  // Вызываем onExpire один раз, когда таймер истёк
  const handledRef = useState({ current: false });
  const [handled] = handledRef;

  useEffect(() => {
    if (expired && !handled.current && onExpire) {
      handled.current = true;
      onExpire();
    }
    if (!expired) {
      handled.current = false;
    }
  }, [expired, onExpire, handled]);

  // Обновляем каждую секунду
  useEffect(() => {
    if (!deadline) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  // Реактивная пересчитка при изменении deadline / serverOffset
  useEffect(() => {
    setTick(0);
  }, [deadline, serverOffset]);

  // Вычисляем remainingMs «лениво» — при каждом рендере
  const remainingMs =
    deadline !== null ? computeRemaining(deadline, serverOffset) : 0;
  const isExpired = deadline !== null && remainingMs === 0;
  const formatted = deadline !== null ? formatMMSS(remainingMs) : '--:--';

  // tick используется как триггер перерендера каждую секунду
  void tick;

  return { remainingMs, formatted, isExpired };
}
