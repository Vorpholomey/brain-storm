import React from 'react';
import { Copy, ExternalLink, ClipboardPaste, Users } from 'lucide-react';
import type { SessionListItem, SessionMode, SessionStatus, SessionStage } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const modeLabels: Record<SessionMode, string> = {
  QUICK: 'Быстрый',
  TEAM: 'Командный',
  ASYNC: 'Асинхронный',
  PERSONAL: 'Личный',
};

const stageLabels: Record<SessionStage, string> = {
  DISCUSSION: 'Обсуждение',
  VOTING_ROUND_1: 'Голосование',
  REFINEMENT: 'Доработка',
  FINAL_VOTE: 'Финал',
  COMPLETED: 'Завершён',
};

const statusLabels: Record<SessionStatus, string> = {
  ACTIVE: 'Активна',
  COMPLETED: 'Завершена',
  ARCHIVED: 'Архив',
};

const modeBadgeColors: Record<SessionMode, string> = {
  QUICK: 'bg-neutral-100 text-neutral-700',
  TEAM: 'bg-primary-soft text-primary',
  ASYNC: 'bg-warning-soft text-warning',
  PERSONAL: 'bg-success-soft text-success',
};

const stageBadgeMap: Record<SessionStage, 'discussion' | 'voting' | 'refinement' | 'final' | 'completed'> = {
  DISCUSSION: 'discussion',
  VOTING_ROUND_1: 'voting',
  REFINEMENT: 'refinement',
  FINAL_VOTE: 'final',
  COMPLETED: 'completed',
};

interface SessionCardProps {
  session: SessionListItem;
  onOpen: (id: string) => void;
  onCopyLink: (id: string) => void;
  onDuplicate: (session: SessionListItem) => void;
  onlineCount?: number;
  topIdea?: { title: string; votesCount: number };
}

export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  onOpen,
  onCopyLink,
  onDuplicate,
  onlineCount = 0,
  topIdea,
}) => {
  const { id, topic, mode, status, currentStage } = session;

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopyLink(id);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDuplicate(session);
  };

  const handleOpen = () => {
    onOpen(id);
  };

  return (
    <Card accentColor={status === 'COMPLETED' ? 'completed' : stageBadgeMap[currentStage]}>
      <div className="flex flex-col h-full">
        {/* Заголовок и бейджи */}
        <div className="mb-3">
          <h3 className="text-base font-medium text-neutral-900 mb-2 line-clamp-2">
            {topic}
          </h3>
          <div className="flex flex-wrap gap-1 mb-2">
            <span className={`inline-flex items-center rounded-sm px-2 py-1 text-xs font-medium ${modeBadgeColors[mode]}`}>
              {modeLabels[mode]}
            </span>
            <span className="inline-flex items-center rounded-sm px-2 py-1 text-xs font-medium bg-neutral-100 text-neutral-600">
              {statusLabels[status]}
            </span>
          </div>
        </div>

        {/* Контекстная информация */}
        <div className="flex-1 mb-3">
          {status === 'ACTIVE' && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-sm text-neutral-600">
                <Badge variant={stageBadgeMap[currentStage]}>
                  {stageLabels[currentStage]}
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-sm text-neutral-500">
                <Users size={14} />
                <span>{onlineCount} онлайн</span>
              </div>
            </div>
          )}

          {status === 'COMPLETED' && topIdea && (
            <div className="text-sm text-neutral-600">
              <p className="font-medium text-neutral-700 mb-1">Лучшая идея:</p>
              <p className="italic line-clamp-2">"{topIdea.title}"</p>
              <p className="text-neutral-500 mt-1">{topIdea.votesCount} голосов</p>
            </div>
          )}
        </div>

        {/* Действия */}
        <div className="flex gap-1 pt-3 border-t border-neutral-200">
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpen}
            className="flex-1"
          >
            <ExternalLink size={14} />
            Открыть
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyLink}
            title="Скопировать ссылку"
          >
            <Copy size={14} />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDuplicate}
            title="Дублировать"
          >
            <ClipboardPaste size={14} />
          </Button>
        </div>
      </div>
    </Card>
  );
};
