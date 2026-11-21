import { useState, useEffect, useCallback, useRef } from 'react';
import { SessionPage } from './SessionPage';
import { RefinementPage } from './RefinementPage';
import { FinalVotePage } from './FinalVotePage';
import { SessionStage } from '@brain-storm/shared';

interface SessionContainerProps {
  sessionId: string;
  token: string;
  voteLimit?: number;
}

export const SessionContainer: React.FC<SessionContainerProps> = ({
  sessionId,
  token,
  voteLimit = 10,
}) => {
  const [currentStage, setCurrentStage] = useState<SessionStage | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const apiBase = '/api';

  // Загрузка currentStage при монтировании
  const fetchStage = useCallback(async () => {
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
    } catch (err) {
      console.error('[SessionContainer] Failed to fetch stage:', err);
    }
  }, [sessionId, token, apiBase]);

  // Начальная загрузка + polling каждые 5 секунд
  useEffect(() => {
    fetchStage();
    pollingIntervalRef.current = setInterval(fetchStage, 5000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [fetchStage]);

  // Обработчик смены стадии от дочерних компонентов (через Socket.IO события)
  const handleStageChange = useCallback((stage: SessionStage) => {
    console.log('[SessionContainer] Стадия изменена:', stage);
    setCurrentStage(stage);
  }, []);

  // Рендеринг страницы в зависимости от стадии
  const renderPage = () => {
    if (!currentStage) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <p>Загрузка сессии...</p>
        </div>
      );
    }

    switch (currentStage) {
      case SessionStage.DISCUSSION:
      case SessionStage.VOTING_ROUND_1:
        return (
          <SessionPage
            sessionId={sessionId}
            token={token}
            voteLimit={voteLimit}
            onStageChange={handleStageChange}
          />
        );

      case SessionStage.REFINEMENT:
        return <RefinementPage sessionId={sessionId} token={token} />;

      case SessionStage.FINAL_VOTE:
        return <FinalVotePage sessionId={sessionId} token={token} />;

      case SessionStage.COMPLETED:
        return (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            fontFamily: 'sans-serif',
            maxWidth: '600px',
            margin: '0 auto',
          }}>
            <div style={{
              padding: '32px',
              borderRadius: '12px',
              background: '#f0fdf4',
              border: '2px solid #86efac',
            }}>
              <h1 style={{
                color: '#166534',
                fontSize: '2rem',
                marginBottom: '16px',
                margin: '0 0 16px 0',
              }}>
                ✅ Голосование завершено!
              </h1>
              <p style={{
                color: '#15803d',
                fontSize: '1.125rem',
                lineHeight: 1.6,
              }}>
                Все этапы сессии&laquo;{sessionId}&raquo; успешно завершены.
                <br />
                Результаты будут доступны после анализа модератором.
              </p>
            </div>
          </div>
        );

      default:
        return (
          <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
            <p>Неизвестная стадия: {currentStage}</p>
          </div>
        );
    }
  };

  return renderPage();
};
