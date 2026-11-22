import React from 'react';
import { Card } from '../ui/Card';
import { Vote } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VotesPanelProps {
  /** Сколько голосов осталось у пользователя */
  votesRemaining: number;
  /** Общее количество доступных голосов */
  votesTotal: number;
  /** Коллбэк при голосовании (опционально) */
  onVote?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const VotesPanel: React.FC<VotesPanelProps> = React.memo(function VotesPanel({
  votesRemaining,
  votesTotal,
}) {
  const used = votesTotal - votesRemaining;
  const isEmpty = votesRemaining === 0;

  return (
    <Card title="Ваши голоса">
      <div className="flex flex-col items-center gap-3">
        {/* Счётчик */}
        <div className="flex items-center gap-2 text-sm text-neutral-600" aria-live="polite" aria-atomic="true">
          <Vote size={16} className="text-neutral-400" aria-hidden="true" />
          <span>
            Осталось <span className="font-semibold text-neutral-800">{votesRemaining}</span>{' '}
            из <span className="font-semibold text-neutral-800">{votesTotal}</span>
          </span>
        </div>

        {/* Индикатор точек */}
        <div className="flex items-center gap-1.5" role="progressbar" aria-valuenow={votesRemaining} aria-valuemin={0} aria-valuemax={votesTotal} aria-label={`Осталось ${votesRemaining} из ${votesTotal} голосов`}>
          {Array.from({ length: votesTotal }, (_, i) => {
            const isUsed = i < used;
            return (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-colors ${
                  isUsed
                    ? 'bg-primary border-primary'
                    : isEmpty
                      ? 'bg-neutral-200 border-neutral-300'
                      : 'bg-white border-neutral-300'
                }`}
                aria-hidden="true"
              />
            );
          })}
        </div>

        {/* Подсказка при исчерпании */}
        {isEmpty && (
          <p className="text-xs text-neutral-500">Голосы закончились</p>
        )}
      </div>
    </Card>
  );
});
