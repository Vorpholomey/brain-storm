import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket';
import { SessionStage } from '@brain-storm/shared';

interface FinalistIdea {
  id: string;
  title: string;
  content: string;
  voteCount: number;
  hasVoted: boolean;
}

interface FinalVotePageProps {
  sessionId: string;
  token: string;
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

export const FinalVotePage: React.FC<FinalVotePageProps> = ({
  sessionId,
  token,
}) => {
  const [finalists, setFinalists] = useState<FinalistIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Состояние стадии и дедлайна
  const [, setCurrentStage] = useState<SessionStage | null>(null);
  const [stageDeadline, setStageDeadline] = useState<Date | null>(null);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);

  // Состояние загрузки при голосовании
  const [votingIdeaId, setVotingIdeaId] = useState<string | null>(null);

  // API baseUrl
  const apiBase = '/api';

  // Проверка: проголосовал ли пользователь
  const hasVoted = finalists.some((f) => f.hasVoted);

  // Подключение к Socket.IO
  const { timeOffset } = useSocket({
    sessionId,
    token,
    onStageAdvanced: useCallback(
      (data: { stage: string; stageDeadline: Date | null }) => {
        console.log('[FinalVotePage] Стадия изменена:', data.stage, 'дедлайн:', data.stageDeadline);
        setCurrentStage(data.stage as SessionStage);
        setStageDeadline(data.stageDeadline);

        // При переходе к COMPLETED — показать уведомление
        if (data.stage === SessionStage.COMPLETED) {
          setSuccessMessage('Голосование завершено!');
        }
      },
      []
    ),
  });

  // Загрузка данных сессии (currentStage + stageDeadline)
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

  // Загрузка финалистов при монтировании
  useEffect(() => {
    const fetchFinalists = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${apiBase}/sessions/${sessionId}/finalists`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Ошибка загрузки: ${response.statusText}`);
        }

        const data = await response.json();
        const allFinalists = data.finalists || data;

        const finalistsData: FinalistIdea[] = allFinalists.map(
          (idea: { id: string; title: string; content?: string; description?: string; voteCount?: number; hasVoted?: boolean }) => ({
            id: idea.id,
            title: idea.title,
            content: idea.content || idea.description || '',
            voteCount: idea.voteCount || 0,
            hasVoted: idea.hasVoted || false,
          })
        );

        setFinalists(finalistsData);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
        setError(message);
        console.error('Failed to fetch finalists:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFinalists();
  }, [sessionId, token, apiBase]);

  // Обработчик голосования
  const handleVote = useCallback(
    async (ideaId: string) => {
      if (hasVoted) return;

      setVotingIdeaId(ideaId);
      setSuccessMessage(null);
      setError(null);

      try {
        const response = await fetch(
          `${apiBase}/sessions/${sessionId}/vote`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ideaId }),
          }
        );

        if (!response.ok) {
          if (response.status === 409) {
            throw new Error('Вы уже проголосовали');
          }
          throw new Error(`Ошибка голосования: ${response.statusText}`);
        }

        // Обновляем локальный state: hasVoted=true для выбранной идеи
        setFinalists((prev) =>
          prev.map((idea) =>
            idea.id === ideaId ? { ...idea, hasVoted: true, voteCount: idea.voteCount + 1 } : idea
          )
        );

        setSuccessMessage('Ваш голос принят!');
        console.log('[FinalVotePage] Голос принят для идеи:', ideaId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
        setError(message);
        console.error('Failed to vote:', err);
      } finally {
        setVotingIdeaId(null);
      }
    },
    [sessionId, token, apiBase, hasVoted]
  );

  // ===== Стили =====
  const containerStyle: React.CSSProperties = {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '24px',
    fontFamily: 'sans-serif',
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: '24px',
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '1.75rem',
    color: '#1e293b',
  };

  const subtitleStyle: React.CSSProperties = {
    margin: '8px 0 0 0',
    fontSize: '1rem',
    color: '#64748b',
  };

  const timerContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '16px',
    padding: '12px 16px',
    background: '#f1f5f9',
    borderRadius: '8px',
  };

  const timerLabelStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    color: '#64748b',
    fontWeight: 500,
  };

  const timerValueStyle: React.CSSProperties = {
    fontSize: '1.25rem',
    color: '#0f172a',
    fontWeight: 700,
    fontFamily: 'monospace',
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px',
  };

  const cardStyle = (isSelected: boolean): React.CSSProperties => ({
    border: isSelected ? '2px solid #22c55e' : '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    background: isSelected ? '#f0fdf4' : '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    transition: 'border 0.2s, background 0.2s',
  });

  const cardTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '1.125rem',
    color: '#1e293b',
  };

  const cardContentStyle: React.CSSProperties = {
    margin: 0,
    color: '#475569',
    lineHeight: 1.5,
    fontSize: '0.875rem',
    flex: 1,
  };

  const voteCountStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    color: '#64748b',
    fontWeight: 500,
  };

  const voteButtonStyle = (disabled: boolean, isVoting: boolean): React.CSSProperties => ({
    padding: '10px 20px',
    borderRadius: '6px',
    border: 'none',
    background: disabled ? '#94a3b8' : isVoting ? '#94a3b8' : '#3b82f6',
    color: '#fff',
    cursor: disabled ? 'not-allowed' : isVoting ? 'not-allowed' : 'pointer',
    fontSize: '0.875rem',
    fontWeight: 500,
    transition: 'background 0.2s',
    width: '100%',
    opacity: disabled ? 0.6 : 1,
  });

  const selectedBadgeStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: '#ffffff',
    background: '#22c55e',
    padding: '4px 8px',
    borderRadius: '4px',
    fontWeight: 600,
    alignSelf: 'flex-start',
  };

  const messageStyle = (type: 'success' | 'error'): React.CSSProperties => ({
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '20px',
    background: type === 'success' ? '#f0fdf4' : '#fef2f2',
    border: type === 'success' ? '1px solid #bbf7d0' : '1px solid #fecaca',
    color: type === 'success' ? '#166534' : '#991b1b',
    fontSize: '0.875rem',
    fontWeight: 500,
  });

  // ===== Рендер =====
  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
          Загрузка финалистов...
        </div>
      </div>
    );
  }

  if (error && finalists.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '48px', color: '#ef4444' }}>
          <p>Ошибка: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Финальное голосование</h1>
        <p style={subtitleStyle}>У вас 1 голос. Выберите лучшую идею!</p>

        {remainingTime !== null && (
          <div style={timerContainerStyle}>
            <span style={timerLabelStyle}>Осталось времени:</span>
            <span style={timerValueStyle}>{formatCountdown(remainingTime)}</span>
          </div>
        )}
      </div>

      {successMessage && (
        <div style={messageStyle('success')}>{successMessage}</div>
      )}

      {error && (
        <div style={messageStyle('error')}>{error}</div>
      )}

      {finalists.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
          Нет финалистов для голосования.
        </div>
      ) : (
        <div style={gridStyle}>
          {finalists.map((idea) => (
            <div key={idea.id} style={cardStyle(idea.hasVoted)}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                {idea.hasVoted && (
                  <span style={selectedBadgeStyle}>✓ Ваш выбор</span>
                )}
                <span style={voteCountStyle}>👍 {idea.voteCount}</span>
              </div>

              <h3 style={cardTitleStyle}>{idea.title}</h3>
              <p style={cardContentStyle}>{idea.content}</p>

              <button
                onClick={() => handleVote(idea.id)}
                disabled={hasVoted || votingIdeaId !== null}
                style={voteButtonStyle(
                  hasVoted,
                  votingIdeaId === idea.id
                )}
              >
                {idea.hasVoted
                  ? 'Голосовал'
                  : votingIdeaId === idea.id
                  ? 'Голосование...'
                  : 'Проголосовать'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
