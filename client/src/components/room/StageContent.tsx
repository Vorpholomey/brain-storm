import React, { useMemo, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import type { Idea, SessionMode, SessionStage } from '@/types';
import { Badge } from '../ui/Badge';
import { IdeaFeed } from './IdeaFeed';
import { IdeaCard } from './IdeaCard';
import { AddIdeaForm } from './AddIdeaForm';
import { IdeaEditor } from './IdeaEditor';
import type { CommentItem } from './CommentsThread';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IdeaVotesMap {
  [ideaId: string]: { count: number; userIds: string[] };
}

export interface StageContentProps {
  sessionId: string;
  currentStage: SessionStage;
  ideas: Idea[];
  currentUserId: string;
  isOrganizer: boolean;
  onAddIdea: (title: string, content: string) => void;
  onVote: (ideaId: string) => void;
  // Текущие голоса: ideaId -> { count, userIds }
  votes: IdeaVotesMap;
  // Кто сейчас редактирует (из WebSocket)
  presence?: { userId: string; userName: string } | null;
  // Лимит голосов на пользователя (для VOTING_ROUND_1)
  voteLimit?: number;
  ideaComments?: Record<string, CommentItem[]>;
  onAddComment?: (ideaId: string, text: string) => Promise<void>;
  // Уведомление родителя об обновлённой идее (REFINEMENT)
  onIdeaUpdated?: (idea: Idea) => void;
  // PERSONAL режим
  mode?: SessionMode;
  selectedIdeaId?: string | null;
  onSelectIdea?: (ideaId: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_VOTE_LIMIT = 3;

const STAGE_LABEL_MAP: Record<SessionStage, string> = {
  DISCUSSION: 'Обсуждение',
  VOTING_ROUND_1: 'Голосование',
  REFINEMENT: 'Доработка',
  FINAL_VOTE: 'Финальное голосование',
  COMPLETED: 'Завершено',
};

const STAGE_BADGE_MAP: Record<
  SessionStage,
  'discussion' | 'voting' | 'refinement' | 'final' | 'completed'
> = {
  DISCUSSION: 'discussion',
  VOTING_ROUND_1: 'voting',
  REFINEMENT: 'refinement',
  FINAL_VOTE: 'final',
  COMPLETED: 'completed',
};

const editButtonClass =
  'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-neutral-600 bg-white border border-neutral-200 rounded-sm shadow-card hover:text-neutral-800 hover:border-neutral-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const StageContent: React.FC<StageContentProps> = React.memo(
  function StageContent({
    sessionId,
    currentStage,
    ideas,
    currentUserId,
    isOrganizer,
    onAddIdea,
    onVote,
    votes,
    presence,
    voteLimit = DEFAULT_VOTE_LIMIT,
    ideaComments,
    onAddComment,
    onIdeaUpdated,
    mode,
    selectedIdeaId,
    onSelectIdea,
  }) {
    // Локальное состояние: открыт ли редактор и какие идеи отредактированы
    // оптимистично (пока серверное состояние не синхронизировалось)
    const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
    const [editedIdeas, setEditedIdeas] = useState<Record<string, Idea>>({});

    const handleIdeaSaved = useCallback(
      (updated: Idea) => {
        setEditedIdeas((prev) => ({ ...prev, [updated.id]: updated }));
        onIdeaUpdated?.(updated);
      },
      [onIdeaUpdated],
    );

    const handleCancelEdit = useCallback(() => {
      setEditingIdeaId(null);
    }, []);

    // Отображаемые идеи: base + оптимистичные правки
    const effectiveIdeas = useMemo(
      () => ideas.map((idea) => editedIdeas[idea.id] ?? idea),
      [ideas, editedIdeas],
    );

    const isRefinement = currentStage === 'REFINEMENT';
    const isFinalVote = currentStage === 'FINAL_VOTE';

    // REFINEMENT / FINAL_VOTE — только финалисты
    const displayedIdeas = useMemo(() => {
      if (isRefinement || isFinalVote) {
        return effectiveIdeas.filter((idea) => idea.status === 'FINALIST');
      }
      return effectiveIdeas;
    }, [effectiveIdeas, isRefinement, isFinalVote]);

    // Оставшиеся голоса текущего пользователя для отображаемых идей
    const remainingVotes = useMemo(() => {
      // DISCUSSION и REFINEMENT — голосование неактивно
      if (currentStage === 'DISCUSSION' || currentStage === 'REFINEMENT') {
        return 0;
      }
      const myVotesCount = displayedIdeas.filter(
        (idea) => (votes[idea.id]?.userIds ?? []).includes(currentUserId),
      ).length;
      // FINAL_VOTE — ровно 1 голос, второй блокируется
      if (currentStage === 'FINAL_VOTE') {
        return myVotesCount > 0 ? 0 : 1;
      }
      return Math.max(0, voteLimit - myVotesCount);
    }, [currentStage, displayedIdeas, votes, currentUserId, voteLimit]);

    // COMPLETED — редирект на страницу результата
    if (currentStage === 'COMPLETED') {
      return <Navigate to={`/sessions/${sessionId}/result`} replace />;
    }

    // В REFINEMENT редактирование доступно только автору и организатору
    const canEditIdea = (idea: Idea) =>
      isRefinement && (idea.authorId === currentUserId || isOrganizer);

    return (
      <div className="flex flex-col gap-3 sm:gap-4">
        {/* ——— Stage badge + presence ——— */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STAGE_BADGE_MAP[currentStage]}>
            {STAGE_LABEL_MAP[currentStage]}
          </Badge>
          {isFinalVote && (
            <span className="text-xs text-neutral-500">
              1 голос на пользователя
            </span>
          )}
          {presence && (
            <span className="text-xs text-neutral-500">
              {presence.userName} редактирует…
            </span>
          )}
        </div>

        {/* ——— Add Idea Form (неактивна вне DISCUSSION) ——— */}
        <AddIdeaForm currentStage={currentStage} onPublish={onAddIdea} />

        {/* ——— Ideas ——— */}
        {isRefinement ? (
          displayedIdeas.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {displayedIdeas.map((idea) => {
                const isEditing = editingIdeaId === idea.id;

                if (isEditing) {
                  return (
                    <IdeaEditor
                      key={idea.id}
                      idea={idea}
                      onSave={handleIdeaSaved}
                      onCancel={handleCancelEdit}
                      presence={presence ?? undefined}
                    />
                  );
                }

                const voteData = votes[idea.id];
                return (
                  <div key={idea.id} className="flex flex-col gap-2">
                    {canEditIdea(idea) && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          className={editButtonClass}
                          onClick={() => setEditingIdeaId(idea.id)}
                          aria-label={`Редактировать идею "${idea.title}"`}
                        >
                          <Pencil size={12} aria-hidden="true" />
                          Редактировать
                        </button>
                      </div>
                    )}
                    <IdeaCard
                      idea={idea}
                      currentStage={currentStage}
                      remainingVotes={0}
                      hasVoted={false}
                      voteCount={voteData?.count ?? 0}
                      votingUserIds={voteData?.userIds ?? []}
                      comments={ideaComments?.[idea.id]}
                      onVote={onVote}
                      onAddComment={onAddComment}
                      mode={mode}
                      selectedIdeaId={selectedIdeaId}
                      onSelectIdea={onSelectIdea}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <h3 className="text-lg font-semibold text-neutral-700 mb-1">
                Пока нет финалистов
              </h3>
              <p className="text-sm text-neutral-500 max-w-xs">
                Финалисты появятся после этапа голосования.
              </p>
            </div>
          )
        ) : (
          <IdeaFeed
            ideas={displayedIdeas}
            currentStage={currentStage}
            currentUserId={currentUserId}
            remainingVotes={remainingVotes}
            ideaVotes={votes}
            ideaComments={ideaComments}
            onVote={onVote}
            onAddComment={onAddComment}
            mode={mode}
            selectedIdeaId={selectedIdeaId}
            onSelectIdea={onSelectIdea}
          />
        )}
      </div>
    );
  },
);
