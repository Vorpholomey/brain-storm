import React from 'react';
import { Card } from '../ui/Card';
import { TrendingUp } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeaderIdea {
  id: string;
  title: string;
  votesCount: number;
  authorName?: string;
}

export interface LeadersPanelProps {
  /** Список идей для отображения (уже отсортированный или сырой) */
  ideas: LeaderIdea[];
  /** Клик на идею — скролл к карточке */
  onIdeaClick: (ideaId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MEDALS: Record<number, string> = {
  0: '🥇',
  1: '🥈',
  2: '🥉',
};

function positionBadge(index: number): React.ReactNode {
  if (index in MEDALS) return <span aria-hidden="true">{MEDALS[index]}</span>;
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full bg-neutral-100 text-neutral-600">
      {index + 1}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const LeadersPanel: React.FC<LeadersPanelProps> = React.memo(function LeadersPanel({
  ideas,
  onIdeaClick,
}) {
  // Топ-5 по голосам
  const topIdeas = React.useMemo(() => {
    return [...ideas]
      .sort((a, b) => b.votesCount - a.votesCount)
      .slice(0, 5);
  }, [ideas]);

  const handleIdeaClick = React.useCallback(
    (ideaId: string) => {
      onIdeaClick(ideaId);
    },
    [onIdeaClick],
  );

  if (topIdeas.length === 0) {
    return (
      <Card title="Топ идей">
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <TrendingUp size={24} className="text-neutral-300 mb-2" aria-hidden="true" />
          <p className="text-sm text-neutral-500">Пока нет идей</p>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Топ идей">
      <ul className="flex flex-col gap-2" role="list" aria-label="Топ идей по голосам">
        {topIdeas.map((idea, index) => (
          <li key={idea.id}>
            <button
              type="button"
              onClick={() => handleIdeaClick(idea.id)}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              aria-label={`Идея "${idea.title}", ${idea.votesCount} голосов`}
            >
              {/* Позиция */}
              <span className="flex-shrink-0" aria-hidden="true">
                {positionBadge(index)}
              </span>

              {/* Информация об идее */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-800 truncate">
                  {idea.title}
                </p>
                {idea.authorName && (
                  <p className="text-xs text-neutral-500 truncate">
                    {idea.authorName}
                  </p>
                )}
              </div>

              {/* Количество голосов */}
              <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {idea.votesCount}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
});
