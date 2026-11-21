import { useState, useEffect, useCallback, useRef } from 'react';
import { IdeaCard } from '../components/IdeaCard';
import { useSocket } from '../hooks/useSocket';
import { SessionStage } from '@brain-storm/shared';

interface Idea {
  id: string;
  title: string;
  content: string;
  voteCount: number;
  hasVoted: boolean;
}

interface SessionPageProps {
  sessionId: string;
  token: string;
  voteLimit?: number;
  onStageChange?: (stage: SessionStage) => void;
}

// Форматирование обратного отсчёта MM:SS или HH:MM:SS
function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export const SessionPage: React.FC<SessionPageProps> = ({
  sessionId,
  token,
  voteLimit = 10,
  onStageChange,
}) => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Форма добавления идеи
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  // Счётчик потраченных голосов
  const votesUsedRef = useRef(0);
  const isVoteDisabled = votesUsedRef.current >= voteLimit;

  // Оптимистичные обновления: храним временные изменения
  const optimisticVotes = useRef<Map<string, number>>(new Map());

  // API baseUrl
  const apiBase = '/api';

  // Состояние стадии и дедлайна
  const [currentStage, setCurrentStage] = useState<SessionStage | null>(null);
  const [stageDeadline, setStageDeadline] = useState<Date | null>(null);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  // Флаг чтобы не спамить запросами при истечении таймера
  const statusCheckInProgress = useRef(false);

  // Подключение к Socket.IO
  const { castVote, timeOffset } = useSocket({
    sessionId,
    token,
    onVoteUpdated: useCallback(
      (data: { ideaId: string; voteCount: number }) => {
        // Подтверждение голоса — устанавливаем реальное значение
        setIdeas((prev) =>
          prev.map((idea) =>
            idea.id === data.ideaId
              ? { ...idea, voteCount: data.voteCount, hasVoted: true }
              : idea
          )
        );
        // Очищаем оптимистичное значение
        optimisticVotes.current.delete(data.ideaId);
      },
      []
    ),
    onVoteRejected: useCallback(
      (reason: string) => {
        console.error('Голос отклонён:', reason);
        // Откат оптимистичного обновления
        const reverted = optimisticVotes.current.get(reason);
        if (reverted !== undefined) {
          setIdeas((prev) =>
            prev.map((idea) =>
              idea.id === reason ? { ...idea, voteCount: reverted } : idea
            )
          );
          optimisticVotes.current.delete(reason);
        }
        votesUsedRef.current = Math.max(0, votesUsedRef.current - 1);
        alert(`Голос отклонён: ${reason}`);
      },
      []
    ),
    onStageAdvanced: useCallback(
      (data: { stage: string; stageDeadline: Date | null }) => {
        console.log('[SessionPage] Стадия изменена:', data.stage, 'дедлайн:', data.stageDeadline);
        const newStage = data.stage as SessionStage;
        setCurrentStage(newStage);
        setStageDeadline(data.stageDeadline);
        // Сбрасываем флаг при смене стадии
        statusCheckInProgress.current = false;
        // Уведомляем родителя о смене стадии
        onStageChange?.(newStage);
      },
      [onStageChange]
    ),
  });

  // Загрузка статуса сессии при монтировании (currentStage + stageDeadline)
  useEffect(() => {
    const fetchSessionStatus = async () => {
      try {
        const response = await fetch(`${apiBase}/sessions/${sessionId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Ошибка загрузки статуса: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.currentStage) {
          setCurrentStage(data.currentStage as SessionStage);
        }
        if (data.stageDeadline) {
          setStageDeadline(new Date(data.stageDeadline));
        }
      } catch (err) {
        console.error('Failed to fetch session status:', err);
      }
    };

    fetchSessionStatus();
  }, [sessionId, token, apiBase]);

  // Обратный отсчёт — обновляется каждую секунду
  useEffect(() => {
    if (!stageDeadline) {
      setRemainingTime(null);
      return;
    }

    const updateRemaining = () => {
      const remaining = stageDeadline.getTime() - (Date.now() + timeOffset);
      setRemainingTime(Math.max(0, remaining));
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);

    return () => clearInterval(interval);
  }, [stageDeadline, timeOffset]);

  // Когда таймер доходит до нуля — запросить актуальный статус
  useEffect(() => {
    if (remainingTime !== null && remainingTime > 0) return;
    if (statusCheckInProgress.current) return;

    const fetchSessionStatus = async () => {
      statusCheckInProgress.current = true;
      try {
        const response = await fetch(`${apiBase}/sessions/${sessionId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Ошибка загрузки статуса: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.currentStage) {
          setCurrentStage(data.currentStage as SessionStage);
        }
        if (data.stageDeadline) {
          const newDeadline = new Date(data.stageDeadline);
          // Обновляем только если стадия или дедлайн изменились
          setStageDeadline((prev) => {
            if (
              !prev ||
              prev.getTime() !== newDeadline.getTime()
            ) {
              // Сбрасываем флаг если дедлайн обновился
              statusCheckInProgress.current = false;
              return newDeadline;
            }
            return prev;
          });
        } else {
          // stageDeadline стал null (например, DISCUSSION)
          setStageDeadline(null);
          statusCheckInProgress.current = false;
        }
      } catch (err) {
        console.error('Failed to refresh session status:', err);
        statusCheckInProgress.current = false;
      }
    };

    fetchSessionStatus();
  }, [remainingTime, sessionId, token, apiBase]);

  // Загрузка идей при монтировании
  useEffect(() => {
    const fetchIdeas = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${apiBase}/sessions/${sessionId}/ideas`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Ошибка загрузки: ${response.statusText}`);
        }

        const data = await response.json();
        const ideasData: Idea[] = (data.ideas || data).map((idea: { id: string; title: string; content?: string; description?: string; voteCount?: number; hasVoted?: boolean }) => ({
          id: idea.id,
          title: idea.title,
          content: idea.content || idea.description || '',
          voteCount: idea.voteCount || 0,
          hasVoted: idea.hasVoted || false,
        }));

        setIdeas(ideasData);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
        setError(message);
        console.error('Failed to fetch ideas:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchIdeas();
  }, [sessionId, token, apiBase]);

  // Голосование с оптимистичным обновлением
  const handleVote = useCallback(
    (ideaId: string) => {
      if (isVoteDisabled) return;

      const previousCount = ideas.find((i) => i.id === ideaId)?.voteCount ?? 0;
      optimisticVotes.current.set(ideaId, previousCount);

      // Оптимистично увеличиваем счётчик
      setIdeas((prev) =>
        prev.map((idea) =>
          idea.id === ideaId
            ? { ...idea, voteCount: idea.voteCount + 1, hasVoted: true }
            : idea
        )
      );

      votesUsedRef.current += 1;

      // Отправляем голос через Socket.IO с callback для обработки ошибок
      castVote(ideaId, (error?: string) => {
        if (error) {
          // Откат при ошибке
          const prevCount = optimisticVotes.current.get(ideaId);
          if (prevCount !== undefined) {
            setIdeas((prev) =>
              prev.map((idea) =>
                idea.id === ideaId
                  ? { ...idea, voteCount: prevCount, hasVoted: false }
                  : idea
              )
            );
            optimisticVotes.current.delete(ideaId);
          }
          votesUsedRef.current = Math.max(0, votesUsedRef.current - 1);
          console.error('Голос отклонён (callback):', error);
        }
      });
    },
    [ideas, isVoteDisabled, castVote]
  );

  // Добавление новой идеи
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!title.trim() || !content.trim()) {
        alert('Заполните заголовок и описание идеи');
        return;
      }

      try {
        const response = await fetch(
          `${apiBase}/sessions/${sessionId}/ideas`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ title: title.trim(), content: content.trim() }),
          }
        );

        if (!response.ok) {
          throw new Error(`Ошибка создания: ${response.statusText}`);
        }

        const newIdea = await response.json();
        setIdeas((prev) => [
          ...prev,
          {
            id: newIdea.id,
            title: newIdea.title,
            content: newIdea.content || '',
            voteCount: 0,
            hasVoted: false,
          },
        ]);

        // Очищаем форму
        setTitle('');
        setContent('');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
        console.error('Failed to create idea:', err);
        alert(`Ошибка создания идеи: ${message}`);
      }
    },
    [title, content, sessionId, token, apiBase]
  );

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <p>Загрузка идей...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <p style={{ color: '#ef4444' }}>Ошибка: {error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ color: '#1e293b' }}>Сессия: {sessionId}</h1>

      {/* Индикатор стадии и обратный отсчёт */}
      {currentStage && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            borderRadius: '8px',
            background: remainingTime !== null ? '#f0f9ff' : '#f8fafc',
            border: '1px solid #bae6fd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontWeight: 500, color: '#0c4a6e' }}>
            Стадия: {currentStage}
          </span>
          {remainingTime !== null && (
            <span
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: remainingTime <= 60000 ? '#dc2626' : '#0369a1',
                transition: 'color 0.3s',
              }}
            >
              {formatCountdown(remainingTime)}
            </span>
          )}
        </div>
      )}

      {/* Форма добавления идеи */}
      <form
        onSubmit={handleSubmit}
        style={{
          marginBottom: '24px',
          padding: '16px',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          background: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#334155' }}>
          Добавить идею
        </h2>

        <input
          type="text"
          placeholder="Заголовок идеи"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            fontSize: '1rem',
          }}
        />

        <textarea
          placeholder="Описание идеи"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            fontSize: '1rem',
            resize: 'vertical',
          }}
        />

        <button
          type="submit"
          style={{
            padding: '10px 20px',
            borderRadius: '6px',
            border: 'none',
            background: '#3b82f6',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 500,
            alignSelf: 'flex-start',
          }}
        >
          Добавить
        </button>
      </form>

      {/* Информация о голосах */}
      <div style={{ marginBottom: '16px', color: '#64748b' }}>
        Доступно голосов: {voteLimit - votesUsedRef.current} / {voteLimit}
      </div>

      {/* Grid карточек идей */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '16px',
        }}
      >
        {ideas.map((idea) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            onVote={handleVote}
            isVoteDisabled={isVoteDisabled}
          />
        ))}
      </div>

      {ideas.length === 0 && (
        <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '24px' }}>
          Пока нет идей. Будьте первым!
        </p>
      )}
    </div>
  );
};
