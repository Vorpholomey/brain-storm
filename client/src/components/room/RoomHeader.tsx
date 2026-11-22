import React, { useState, useRef, useEffect } from 'react';
import { Share, Clock, ChevronDown } from 'lucide-react';
import { useServerTimer } from '../../hooks/useServerTimer';
import { AvatarGroup } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { DeadlinesBlock } from './DeadlinesBlock';
import { SessionMode, SessionStage } from '../../types';

// ——— Constants ———

const STAGES: { key: SessionStage; label: string; variant: BadgeVariantMapKey }[] = [
  { key: 'DISCUSSION', label: 'Обсуждение', variant: 'discussion' },
  { key: 'VOTING_ROUND_1', label: 'Голосование', variant: 'voting' },
  { key: 'REFINEMENT', label: 'Доработка', variant: 'refinement' },
  { key: 'FINAL_VOTE', label: 'Финал', variant: 'final' },
  { key: 'COMPLETED', label: 'Завершено', variant: 'completed' },
];

type BadgeVariantMapKey = 'discussion' | 'voting' | 'refinement' | 'final' | 'completed';

const STAGE_COLOR_MAP: Record<BadgeVariantMapKey, string> = {
  discussion: 'bg-stage-discussion',
  voting: 'bg-stage-voting',
  refinement: 'bg-stage-refinement',
  final: 'bg-stage-final',
  completed: 'bg-stage-completed',
};

const STAGE_RING_MAP: Record<BadgeVariantMapKey, string> = {
  discussion: 'ring-stage-discussion',
  voting: 'ring-stage-voting',
  refinement: 'ring-stage-refinement',
  final: 'ring-stage-final',
  completed: 'ring-stage-completed',
};

// ——— Helpers ———

function getStageIndex(stage: SessionStage): number {
  return STAGES.findIndex((s) => s.key === stage);
}

// ——— Props ———

interface RoomHeaderProps {
  topic: string;
  currentStage: SessionStage;
  stageDeadline: string | null;
  serverOffset: number;
  onlineUsers: string[];
  isOrganizer: boolean;
  mode?: SessionMode;
  onStageChange?: (newStage: SessionStage) => void;
}

// ——— Sub-components ———

interface StageProgressBarProps {
  currentStage: SessionStage;
}

const StageProgressBar: React.FC<StageProgressBarProps> = ({ currentStage }) => {
  const currentIndex = getStageIndex(currentStage);

  return (
    <nav aria-label="Прогресс этапа" className="flex items-center gap-0">
      {STAGES.map((stage, i) => {
        const isPast = i < currentIndex;
        const isCurrent = i === currentIndex;
        const colorClass = STAGE_COLOR_MAP[stage.variant];
        const ringClass = STAGE_RING_MAP[stage.variant];

        return (
          <React.Fragment key={stage.key}>
            {/* Connector line */}
            {i > 0 && (
              <span
                className={`w-4 h-0.5 ${
                  isPast || isCurrent ? colorClass : 'bg-neutral-300'
                }`}
                aria-hidden="true"
              />
            )}
            {/* Step dot */}
            <span
              className={`
                inline-flex items-center justify-center w-4 h-4 rounded-sm
                ${
                  isCurrent
                    ? `${colorClass} ring-2 ring-offset-1 ${ringClass}`
                    : isPast
                      ? colorClass
                      : 'bg-neutral-300'
                }
              `}
              title={stage.label}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`${stage.label}${isCurrent ? ' (текущий)' : ''}`}
            />
          </React.Fragment>
        );
      })}
    </nav>
  );
};

interface TimerDisplayProps {
  stageDeadline: string | null;
  serverOffset: number;
}

const TimerDisplay: React.FC<TimerDisplayProps> = ({ stageDeadline, serverOffset }) => {
  const { formatted, isExpired } = useServerTimer(stageDeadline, serverOffset);

  return (
    <div className="flex items-center gap-1 text-sm text-neutral-600" aria-live="polite" aria-atomic="true">
      <Clock size={16} aria-hidden="true" />
      <span>{isExpired ? 'Завершено' : formatted}</span>
    </div>
  );
};

interface OnlineUsersDisplayProps {
  onlineUsers: string[];
}

const OnlineUsersDisplay: React.FC<OnlineUsersDisplayProps> = ({ onlineUsers }) => {
  const avatarItems = onlineUsers.map((uid) => ({
    userId: uid,
    name: uid,
  }));

  return (
    <div className="flex items-center gap-2">
      <AvatarGroup avatars={avatarItems} max={4} />
      <span className="text-xs text-neutral-500">{onlineUsers.length} онлайн</span>
    </div>
  );
};

interface StageDropdownProps {
  currentStage: SessionStage;
  onStageChange: (newStage: SessionStage) => void;
}

const StageDropdown: React.FC<StageDropdownProps> = ({ currentStage, onStageChange }) => {
  const [open, setOpen] = useState(false);
  const [pendingStage, setPendingStage] = useState<SessionStage | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const currentLabel = STAGES.find((s) => s.key === currentStage)?.label ?? currentStage;

  return (
    <>
      {/* Dropdown trigger */}
      <div className="relative" ref={dropdownRef}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setOpen((p) => !p)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          Управление этапом
          <ChevronDown size={14} />
        </Button>

        {open && (
          <div
            className="absolute right-0 top-full mt-1 z-20 bg-white rounded-md shadow-dropdown border border-neutral-200 py-1 min-w-[180px]"
            role="listbox"
            aria-label="Выбор этапа"
          >
            {STAGES.filter((s) => s.key !== currentStage).map((stage) => (
              <button
                key={stage.key}
                role="option"
                className="w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
                onClick={() => {
                  setPendingStage(stage.key);
                  setOpen(false);
                }}
              >
                {stage.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {pendingStage && (
        <ConfirmStageModal
          currentLabel={currentLabel}
          targetStage={pendingStage}
          onConfirm={() => {
            onStageChange(pendingStage);
            setPendingStage(null);
          }}
          onCancel={() => setPendingStage(null)}
        />
      )}
    </>
  );
};

interface ConfirmStageModalProps {
  currentLabel: string;
  targetStage: SessionStage;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmStageModal: React.FC<ConfirmStageModalProps> = ({
  currentLabel,
  targetStage,
  onConfirm,
  onCancel,
}) => {
  const targetLabel = STAGES.find((s) => s.key === targetStage)?.label ?? targetStage;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-modal p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="modal-title" className="text-lg font-medium text-neutral-900 mb-2">
          Подтверждение смены этапа
        </h2>
        <p className="text-sm text-neutral-600 mb-4">
          Перейти с <strong>{currentLabel}</strong> на <strong>{targetLabel}</strong>?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Отмена
          </Button>
          <Button variant="primary" size="sm" onClick={onConfirm}>
            Перейти
          </Button>
        </div>
      </div>
    </div>
  );
};

// ——— Main Component ———

export const RoomHeader: React.FC<RoomHeaderProps> = ({
  topic,
  currentStage,
  stageDeadline,
  serverOffset,
  onlineUsers,
  isOrganizer,
  mode,
  onStageChange,
}) => {
  const isPersonal = mode === 'PERSONAL';
  const isAsync = mode === 'ASYNC';
  const currentStageInfo = STAGES.find((s) => s.key === currentStage);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      // Simple inline toast
      const toast = document.createElement('div');
      toast.className =
        'fixed bottom-4 right-4 z-50 bg-neutral-800 text-white text-sm px-3 py-2 rounded-md shadow-card';
      toast.textContent = 'Ссылка скопирована!';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    } catch {
      // Clipboard API may not be available
    }
  };

  return (
    <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-neutral-200" role="banner">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
        {/* Top row: topic + badge */}
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <h1 className="text-base sm:text-lg font-medium text-neutral-900 truncate">{topic}</h1>
              {currentStageInfo && (
                <Badge variant={currentStageInfo.variant}>
                  {currentStageInfo.label}
                </Badge>
              )}
            </div>
            <StageProgressBar currentStage={currentStage} />
          </div>

          {/* Right side actions — скрыты в PERSONAL режиме */}
          {!isPersonal && (
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {isAsync ? (
                <div className="hidden sm:flex items-center gap-1 text-sm text-neutral-600">
                  <Clock size={16} aria-hidden="true" />
                  <span>ASYNC</span>
                </div>
              ) : (
                <TimerDisplay stageDeadline={stageDeadline} serverOffset={serverOffset} />
              )}
              <OnlineUsersDisplay onlineUsers={onlineUsers} />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShare}
                aria-label="Поделиться ссылкой"
                title="Поделиться ссылкой"
                className="hidden sm:inline-flex"
              >
                <Share size={16} />
                <span className="hidden sm:inline">Поделиться</span>
              </Button>
              {/* Mobile-only share button (icon only) */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShare}
                aria-label="Поделиться ссылкой"
                title="Поделиться ссылкой"
                className="sm:hidden"
              >
                <Share size={16} />
              </Button>
              {isOrganizer && onStageChange && (
                <StageDropdown
                  currentStage={currentStage}
                  onStageChange={onStageChange}
                />
              )}
            </div>
          )}
        </div>

        {/* Deadlines block — показывается только в ASYNC режиме */}
        {isAsync && (
          <div className="max-w-2xl mt-2 sm:mt-3">
            <DeadlinesBlock
              currentStage={currentStage}
              stageDeadline={stageDeadline}
            />
          </div>
        )}
      </div>
    </header>
  );
};
