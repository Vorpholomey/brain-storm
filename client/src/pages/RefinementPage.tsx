import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket';
import { SessionStage } from '@brain-storm/shared';

interface FinalistIdea {
  id: string;
  title: string;
  content: string;
  voteCount: number;
}

interface RefinementPageProps {
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

export const RefinementPage: React.FC<RefinementPageProps> = ({
  sessionId,
  token,
}) => {
  const [finalists, setFinalists] = useState<FinalistIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Состояние стадии и дедлайна
  const [currentStage, setCurrentStage] = useState<SessionStage | null>(null);
  const [stageDeadline, setStageDeadline] = useState<Date | null>(null);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);

  // Состояние сохранения для каждой карточки
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [ideaErrors, setIdeaErrors] = useState<Map<string, string>>(new Map());

  // API baseUrl
  const apiBase = '/api';

  // Подключение к Socket.IO
  const { timeOffset } = useSocket({
    sessionId,
    token,
    onStageAdvanced: useCallback(
      (data: { stage: string; stageDeadline: Date | null }) => {
        console.log('[RefinementPage] Стадия изменена:', data.stage, 'дедлайн:', data.stageDeadline);
        setCurrentStage(data.stage as SessionStage);
        setStageDeadline(data.stageDeadline);

        // При переходе к FINAL_VOTE — показать уведомление
        if (data.stage === SessionStage.FINAL_VOTE) {
          alert('Начался финальный этап голосования!');
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
        const response = await fetch(`${apiBase}/sessions/${sessionId}/ideas`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Ошибка загрузки: ${response.statusText}`);
        }

        const data = await response.json();
        const allIdeas = data.ideas || data;

        // Фильтруем идеи со status === 'FINALIST'
        const finalistsData: FinalistIdea[] = allIdeas
          .filter((idea: { status: string }) => idea.status === 'FINALIST')
          .map((idea: { id: string; title: string; content?: string; description?: string; voteCount?: number }) => ({
            id: idea.id,
            title: idea.title,
            content: idea.content || idea.description || '',
            voteCount: idea.voteCount || 0,
          }));

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

  // Обработчик изменения полей
  const handleFieldChange = useCallback((ideaId: string, field: 'title' | 'content', value: string) => {
    setFinalists((prev) =>
      prev.map((idea) =>
        idea.id === ideaId ? { ...idea, [field]: value } : idea
      )
    );
    // Очищаем ошибку при изменении поля
    setIdeaErrors((prev) => {
      const next = new Map(prev);
      next.delete(ideaId);
      return next;
    });
  }, []);

  // Сохранение изменений для конкретной карточки
  const handleSave = useCallback(
    async (ideaId: string) => {
      const idea = finalists.find((i) => i.id === ideaId);
      if (!idea) return;

      setSavingIds((prev) => new Set(prev).add(ideaId));
      setIdeaErrors((prev) => {
        const next = new Map(prev);
        next.delete(ideaId);
        return next;
      });

      try {
        const response = await fetch(
          `${apiBase}/sessions/${sessionId}/ideas/${ideaId}`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: idea.title,
              content: idea.content,
            }),
          }
        );

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error('У вас нет прав для редактирования этой идеи');
          }
          throw new Error(`Ошибка сохранения: ${response.statusText}`);
        }

        console.log('[RefinementPage] Идея сохранена:', ideaId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
        console.error('Failed to save idea:', err);
        setIdeaErrors((prev) => {
          const next = new Map(prev);
          next.set(ideaId, message);
          return next;
        });
      } finally {
        setSavingIds((prev) => {
          const next = new Set(prev);
          next.delete(ideaId);
          return next;
        });
      }
    },
    [finalists, sessionId, token, apiBase]
  );

  // ===== Стили =====
  const containerStyle: React.CSSProperties = {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '24px',
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: '24px',
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '1.75rem',
    color: '#1e293b',
  };

  const timerContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '12px',
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

  const stageBadgeStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: '#ffffff',
    background: '#6366f1',
    padding: '4px 8px',
    borderRadius: '4px',
    fontWeight: 600,
    textTransform: 'uppercase',
  };

  const cardStyle: React.CSSProperties = {
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    marginBottom: '16px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '1rem',
    color: '#1e293b',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '0.875rem',
    color: '#1e293b',
    outline: 'none',
    resize: 'vertical',
    minHeight: '100px',
    fontFamily: 'inherit',
    lineHeight: 1.5,
    boxSizing: 'border-box',
  };

  const saveButtonStyle = (isSaving: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    background: isSaving ? '#94a3b8' : '#3b82f6',
    color: '#fff',
    cursor: isSaving ? 'not-allowed' : 'pointer',
    fontSize: '0.875rem',
    fontWeight: 500,
    transition: 'background 0.2s',
    alignSelf: 'flex-start',
  });

  const errorStyle: React.CSSProperties = {
    color: '#ef4444',
    fontSize: '0.875rem',
    marginTop: '4px',
  };

  const voteCountStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    color: '#64748b',
    fontWeight: 500,
  };

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

  if (error) {
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
        <h1 style={titleStyle}>Этап доработки идей</h1>

        {currentStage && (
          <span style={stageBadgeStyle}>{currentStage}</span>
        )}

        {remainingTime !== null && (
          <div style={timerContainerStyle}>
            <span style={timerLabelStyle}>Осталось времени:</span>
            <span style={timerValueStyle}>{formatCountdown(remainingTime)}</span>
          </div>
        )}
      </div>

      {finalists.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
          Нет финалистов для доработки.
        </div>
      ) : (
        <div>
          {finalists.map((idea) => (
            <div key={idea.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                  Идея #{idea.id.slice(0, 8)}
                </span>
                <span style={voteCountStyle}>
                  👍 {idea.voteCount}
                </span>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    color: '#475569',
                    fontWeight: 500,
                    marginBottom: '4px',
                  }}
                >
                  Заголовок
                </label>
                <input
                  type="text"
                  value={idea.title}
                  onChange={(e) => handleFieldChange(idea.id, 'title', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    color: '#475569',
                    fontWeight: 500,
                    marginBottom: '4px',
                  }}
                >
                  Описание
                </label>
                <textarea
                  value={idea.content}
                  onChange={(e) => handleFieldChange(idea.id, 'content', e.target.value)}
                  style={textareaStyle}
                />
              </div>

              {ideaErrors.get(idea.id) && (
                <div style={errorStyle}>
                  {ideaErrors.get(idea.id)}
                </div>
              )}

              <button
                onClick={() => handleSave(idea.id)}
                disabled={savingIds.has(idea.id)}
                style={saveButtonStyle(savingIds.has(idea.id))}
              >
                {savingIds.has(idea.id) ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
