import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { SessionCard } from '@/components/sessions/SessionCard';
import { getSessionList } from '@/api/sessions';
import type { SessionListItem, SessionStatus } from '@/types';

type FilterTab = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

const tabLabels: Record<FilterTab, string> = {
  ACTIVE: 'Активные',
  COMPLETED: 'Завершённые',
  ARCHIVED: 'Черновики',
};

const statusToTab: Record<SessionStatus, FilterTab> = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('ACTIVE');

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSessionList();
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить сессии');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const filteredSessions = sessions.filter(
    (s) => statusToTab[s.status] === activeTab
  );

  const handleOpenSession = (id: string) => {
    navigate(`/session/${id}`);
  };

  const handleCopyLink = async (id: string) => {
    const url = `${window.location.origin}/session/${id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback для старых браузеров
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  const handleDuplicate = (session: SessionListItem) => {
    // Переход на визард с предзаполненными данными
    const draft = JSON.stringify(session);
    navigate(`/create-session?draft=${encodeURIComponent(draft)}`);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleCreateNew = () => {
    navigate('/create-session');
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Шапка */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold text-neutral-900">Мои сессии</h1>
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm text-neutral-500">{user.email}</span>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Выйти
            </Button>
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <main className="max-w-6xl mx-auto px-6 py-6">
        {/* Табы и кнопка создания */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1 bg-neutral-100 rounded-md p-1">
            {(Object.keys(tabLabels) as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-sm font-medium rounded-sm transition-colors ${
                  activeTab === tab
                    ? 'bg-white text-neutral-900 shadow-card'
                    : 'text-neutral-600 hover:text-neutral-800'
                }`}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </div>
          <Button onClick={handleCreateNew}>
            <Plus size={16} />
            Создать сессию
          </Button>
        </div>

        {/* Состояние загрузки */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-md border border-neutral-200 bg-white px-4 py-3 animate-pulse"
              >
                <div className="h-4 bg-neutral-100 rounded-sm w-3/4 mb-2" />
                <div className="h-3 bg-neutral-100 rounded-sm w-1/2 mb-3" />
                <div className="h-3 bg-neutral-100 rounded-sm w-full" />
              </div>
            ))}
          </div>
        )}

        {/* Состояние ошибки */}
        {error && !loading && (
          <div className="text-center py-12">
            <p className="text-neutral-600 mb-3">{error}</p>
            <Button variant="secondary" onClick={loadSessions}>
              Повторить
            </Button>
          </div>
        )}

        {/* Пустое состояние */}
        {!loading && !error && filteredSessions.length === 0 && (
          <div className="text-center py-16">
            <Lightbulb size={48} className="mx-auto text-neutral-300 mb-4" />
            <p className="text-neutral-600 mb-1">
              {activeTab === 'ACTIVE'
                ? 'Нет активных сессий'
                : activeTab === 'COMPLETED'
                ? 'Нет завершённых сессий'
                : 'Нет черновиков'}
            </p>
            <p className="text-sm text-neutral-400 mb-4">
              {activeTab === 'ACTIVE'
                ? 'Создайте новую сессию, чтобы начать мозговой штурм'
                : 'Созданные сессии появятся здесь'}
            </p>
            <Button onClick={handleCreateNew}>
              <Plus size={16} />
              Создать сессию
            </Button>
          </div>
        )}

        {/* Сетка карточек */}
        {!loading && !error && filteredSessions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onOpen={handleOpenSession}
                onCopyLink={handleCopyLink}
                onDuplicate={handleDuplicate}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
