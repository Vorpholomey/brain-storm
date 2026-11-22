import React, { useMemo, useCallback } from 'react';
import {
  Lightbulb,
  ArrowDownUp,
  Clock,
  User,
  Star,
} from 'lucide-react';
import { IdeaCard } from './IdeaCard';
import type { CommentItem } from './CommentsThread';
import { Idea, SessionMode, SessionStage } from '../../types';

// ——— Types ———

export type SortMode = 'votes' | 'time' | 'mine' | 'finalists';

interface IdeaFeedProps {
  ideas: Idea[];
  currentStage: SessionStage;
  currentUserId: string;
  remainingVotes: number;
  ideaVotes: Record<string, { count: number; userIds: string[] }>;
  ideaComments?: Record<string, CommentItem[]>;
  onVote: (ideaId: string) => void;
  onAddComment?: (ideaId: string, text: string) => Promise<void>;
  // PERSONAL режим
  mode?: SessionMode;
  selectedIdeaId?: string | null;
  onSelectIdea?: (ideaId: string) => void;
}

const SORT_OPTIONS: { key: SortMode; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { key: 'votes', label: 'По голосам', Icon: ArrowDownUp },
  { key: 'time', label: 'По времени', Icon: Clock },
  { key: 'mine', label: 'Мои', Icon: User },
  { key: 'finalists', label: 'Финалисты', Icon: Star },
];

// ——— Component ———

export const IdeaFeed: React.FC<IdeaFeedProps> = React.memo(function IdeaFeed({
  ideas,
  currentStage,
  currentUserId,
  remainingVotes,
  ideaVotes,
  ideaComments,
  onVote,
  onAddComment,
  mode,
  selectedIdeaId,
  onSelectIdea,
}) {
  const [sortMode, setSortMode] = React.useState<SortMode>('time');

  const handleSortChange = useCallback((mode: SortMode) => {
    setSortMode(mode);
  }, []);

  const displayedIdeas = useMemo(() => {
    let filtered = ideas;

    // Фильтрация
    if (sortMode === 'mine') {
      filtered = ideas.filter((idea) => idea.authorId === currentUserId);
    } else if (sortMode === 'finalists') {
      filtered = ideas.filter((idea) => idea.status === 'FINALIST');
    }

    // Сортировка
    const sorted = [...filtered].sort((a, b) => {
      if (sortMode === 'votes') {
        const aCount = ideaVotes[a.id]?.count ?? 0;
        const bCount = ideaVotes[b.id]?.count ?? 0;
        return bCount - aCount;
      }
      // По времени (новые сверху) — дефолт
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return sorted;
  }, [ideas, sortMode, currentUserId, ideaVotes]);

  return (
    <section aria-label="Список идей" className="flex flex-col gap-4">
      {/* ——— Sort bar ——— */}
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Сортировка идей">
        {SORT_OPTIONS.map(({ key, label, Icon }) => {
          const isActive = sortMode === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => handleSortChange(key)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium
                transition-colors border-b-2
                ${
                  isActive
                    ? 'border-b-2 border-primary text-neutral-800 bg-neutral-100'
                    : 'border-b-2 border-transparent text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
                }
              `}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      {/* ——— Ideas grid ——— */}
      {displayedIdeas.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4" role="tabpanel">
          {displayedIdeas.map((idea) => {
            const voteData = ideaVotes[idea.id];
            const voteCount = voteData?.count ?? 0;
            const votingUserIds = voteData?.userIds ?? [];
            const hasVoted = votingUserIds.includes(currentUserId);
            const comments = ideaComments?.[idea.id];

            return (
              <IdeaCard
                key={idea.id}
                idea={idea}
                currentStage={currentStage}
                remainingVotes={remainingVotes}
                hasVoted={hasVoted}
                voteCount={voteCount}
                votingUserIds={votingUserIds}
                comments={comments}
                onVote={onVote}
                onAddComment={onAddComment}
                mode={mode}
                selectedIdeaId={selectedIdeaId}
                onSelectIdea={onSelectIdea}
              />
            );
          })}
        </div>
      ) : (
        /* ——— Empty state ——— */
        <div className="flex flex-col items-center justify-center py-12 text-center" role="tabpanel">
          <div className="flex items-center justify-center w-16 h-16 mb-4 bg-neutral-100 rounded-md">
            <Lightbulb className="w-8 h-8 text-neutral-400" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-700 mb-1">
            Пока нет идей
          </h3>
          <p className="text-sm text-neutral-500 max-w-xs">
            Будьте первым — поделитесь своей идеей с остальными участниками.
          </p>
        </div>
      )}
    </section>
  );
});
