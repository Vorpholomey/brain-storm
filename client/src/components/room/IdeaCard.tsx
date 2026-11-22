import React, { useState, useCallback } from 'react';
import { ThumbsUp, MessageSquare, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { Card } from '../ui/Card';
import { Avatar, AvatarGroup, type AvatarItem } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { CommentsThread, type CommentItem } from './CommentsThread';
import { Idea, SessionMode, SessionStage } from '../../types';

// ——— Types ———

export interface IdeaCardProps {
  idea: Idea;
  currentStage: SessionStage;
  remainingVotes: number;
  hasVoted: boolean;
  voteCount: number;
  votingUserIds: string[];
  comments?: CommentItem[];
  onVote: (ideaId: string) => void;
  onAddComment?: (ideaId: string, text: string) => Promise<void>;
  // PERSONAL режим
  mode?: SessionMode;
  selectedIdeaId?: string | null;
  onSelectIdea?: (ideaId: string) => void;
}

const STATUS_BADGE_MAP: Record<string, 'refinement' | 'completed'> = {
  FINALIST: 'refinement',
  SELECTED: 'completed',
};

const STATUS_LABEL_MAP: Record<string, string> = {
  FINALIST: 'Финалист',
  SELECTED: 'Выбрана',
};

const COLLAPSE_LINE_THRESHOLD = 4;

// ——— Component ———

export const IdeaCard = React.memo<IdeaCardProps>(function IdeaCard({
  idea,
  currentStage,
  remainingVotes,
  hasVoted,
  voteCount,
  votingUserIds,
  comments,
  onVote,
  onAddComment,
  mode,
  selectedIdeaId,
  onSelectIdea,
}) {
  const [expanded, setExpanded] = useState(false);

  const isPersonal = mode === 'PERSONAL';
  const isSelected = selectedIdeaId === idea.id;

  const lineCount = idea.content.split('\n').filter(Boolean).length;
  const needsCollapse = lineCount > COLLAPSE_LINE_THRESHOLD;

  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleVote = useCallback(() => {
    onVote(idea.id);
  }, [onVote, idea.id]);

  const isFinalVote = currentStage === 'FINAL_VOTE';
  const isDisabled = hasVoted || remainingVotes === 0;

  const statusBadgeVariant = STATUS_BADGE_MAP[idea.status];
  const statusBadgeLabel = STATUS_LABEL_MAP[idea.status];

  const votingAvatars: AvatarItem[] = votingUserIds.map((userId) => ({
    userId,
    name: `User ${userId.slice(0, 4)}`,
  }));

  const authorName = idea.author?.email ?? 'Аноним';
  const authorId = idea.authorId;

  return (
    <Card id={`idea-card-${idea.id}`} className="flex flex-col">
      {/* ——— Header: title + status badge ——— */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-lg font-semibold text-neutral-800 leading-snug">
          {idea.title}
        </h3>
        {statusBadgeVariant && statusBadgeLabel && (
          <Badge variant={statusBadgeVariant}>{statusBadgeLabel}</Badge>
        )}
      </div>

      {/* ——— Content ——— */}
      <div className="text-sm text-neutral-600 mb-3">
        <p
          className={
 needsCollapse && !expanded ? 'line-clamp-4' : ''
          }
        >
          {idea.content}
        </p>
        {needsCollapse && (
          <button
            type="button"
            onClick={handleToggleExpand}
            className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-neutral-500 hover:text-neutral-700 transition-colors"
            aria-expanded={expanded}
          >
            {expanded ? (
              <>
                <ChevronUp size={14} />
                Свернуть
              </>
            ) : (
              <>
                <ChevronDown size={14} />
                Развернуть
              </>
            )}
          </button>
        )}
      </div>

      {/* ——— Footer ——— */}
      <div className="mt-auto pt-3 border-t border-neutral-200">
        {/* Author row */}
        <div className="flex items-center gap-2 mb-3">
          <Avatar userId={authorId} name={authorName} size="sm" />
          <span className="text-xs text-neutral-500">{authorName}</span>
        </div>

        {/* Votes + comments row */}
        <div className="flex items-center justify-between mb-3">
          {/* Votes */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <ThumbsUp size={14} className="text-neutral-400" aria-hidden="true" />
              <span
                className="text-sm font-medium text-neutral-700"
                aria-label={`Голосов: ${voteCount}`}
              >
                {voteCount}
              </span>
            </div>
            {votingAvatars.length > 0 && (
              <AvatarGroup avatars={votingAvatars} max={3} />
            )}
          </div>

          {/* Comments indicator */}
          {(comments?.length ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-neutral-400" aria-label={`Комментариев: ${comments?.length ?? 0}`}>
              <MessageSquare size={14} aria-hidden="true" />
              <span className="text-xs font-medium">{comments?.length ?? 0}</span>
            </div>
          )}
        </div>

        {/* Vote button (standard modes) / Select button (PERSONAL mode) */}
        {isPersonal ? (
          isSelected ? (
            <div className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-stage-completed/10 border border-stage-completed/30" role="status" aria-label="Идея выбрана">
              <Check size={16} className="text-stage-completed" aria-hidden="true" />
              <span className="text-sm font-medium text-stage-completed">Выбрано</span>
            </div>
          ) : (
            <Button
              variant="primary"
              fullWidth
              onClick={() => onSelectIdea?.(idea.id)}
              aria-label={`Выбрать идею "${idea.title}"`}
            >
              Выбрать
            </Button>
          )
        ) : (
          <Button
            variant={isFinalVote ? 'primary' : 'secondary'}
            fullWidth
            disabled={isDisabled}
            onClick={handleVote}
            title={
              isDisabled
                ? hasVoted
                  ? 'Вы уже проголосовали за эту идею'
                  : 'Голоса исчерпаны'
                : undefined
            }
            aria-label={
              isDisabled
                ? hasVoted
                  ? 'Вы уже проголосовали за эту идею'
                  : 'Голоса исчерпаны'
                : hasVoted
                  ? 'Проголосовано'
                  : isFinalVote
                    ? `Выбрать идею "${idea.title}"`
                    : `Голосовать за идею "${idea.title}"`
            }
          >
            {hasVoted
              ? 'Проголосовано'
              : isFinalVote
                ? 'Выбрать'
                : 'Голосовать'}
          </Button>
        )}
      </div>

      {/* ——— Comments Thread ——— */}
      {onAddComment && (
        <CommentsThread
          ideaId={idea.id}
          comments={comments ?? []}
          onAddComment={async (text: string) => {
            await onAddComment(idea.id, text);
          }}
        />
      )}
    </Card>
  );
});
