import React from 'react';
import { CheckCircle2, Clock, Hourglass, AlertTriangle } from 'lucide-react';
import { Card } from '../ui/Card';
import { SessionStage } from '../../types';

// ——— Constants ———

const STAGES: { key: SessionStage; label: string }[] = [
  { key: 'DISCUSSION', label: 'Обсуждение' },
  { key: 'VOTING_ROUND_1', label: 'Голосование' },
  { key: 'REFINEMENT', label: 'Доработка' },
  { key: 'FINAL_VOTE', label: 'Финал' },
];

type DeadlineStatus = 'completed' | 'current' | 'waiting';

interface StageDeadlineInfo {
  index: number;
  label: string;
  deadline: string | null;
  status: DeadlineStatus;
}

// ——— Helpers ———

function getStageIndex(stage: SessionStage): number {
  return STAGES.findIndex((s) => s.key === stage);
}

function isDeadlineExpired(deadline: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline).getTime() < Date.now();
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return 'TBD';
  return new Date(deadline).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ——— Props ———

interface DeadlinesBlockProps {
  currentStage: SessionStage;
  stageDeadline: string | null;
}

// ——— Sub-components ———

interface StageRowProps {
  info: StageDeadlineInfo;
}

const StageRow: React.FC<StageRowProps> = ({ info }) => {
  const statusConfig = {
    completed: {
      label: 'Завершён',
      className: 'bg-emerald-100 text-emerald-800',
      icon: <CheckCircle2 size={14} />,
    },
    current: {
      label: 'Текущий',
      className: 'bg-blue-100 text-blue-800',
      icon: <Clock size={14} />,
    },
    waiting: {
      label: 'Ожидание',
      className: 'bg-neutral-100 text-neutral-700',
      icon: <Hourglass size={14} />,
    },
  };

  const config = statusConfig[info.status];

  return (
    <div className="flex items-center gap-3 py-2 sm:py-2">
      {/* Stage number */}
      <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-neutral-100 text-xs font-medium text-neutral-700">
        {info.index + 1}
      </span>

      {/* Stage info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-neutral-800 truncate">
          {info.label}
        </div>
        <div className="text-xs text-neutral-600">
          {formatDeadline(info.deadline)}
        </div>
      </div>

      {/* Status badge */}
      <span
        className={`flex-shrink-0 inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium ${config.className}`}
        aria-label={`Статус этапа: ${config.label}`}
      >
        {config.icon}
        {config.label}
      </span>
    </div>
  );
};

// ——— Main Component ———

export const DeadlinesBlock: React.FC<DeadlinesBlockProps> = ({
  currentStage,
  stageDeadline,
}) => {
  const currentIndex = getStageIndex(currentStage);
  const expired = isDeadlineExpired(stageDeadline);

  // Build deadline info for each stage
  const stagesInfo: StageDeadlineInfo[] = STAGES.map((stage, i) => {
    let status: DeadlineStatus;
    let deadline: string | null = null;

    if (i < currentIndex) {
      status = 'completed';
    } else if (i === currentIndex) {
      status = 'current';
      deadline = stageDeadline;
    } else {
      status = 'waiting';
    }

    return {
      index: i,
      label: stage.label,
      deadline,
      status,
    };
  });

  return (
    <Card className="w-full">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-neutral-100">
        <Clock size={16} className="text-neutral-500" aria-hidden="true" />
        <h3 className="text-sm font-medium text-neutral-800">Дедлайны этапов</h3>
      </div>

      {/* Overflow warning */}
      {expired && (
        <div
          className="flex items-start gap-2 mb-3 p-2 bg-amber-50 border border-amber-200 rounded-md"
          role="alert"
          aria-live="assertive"
        >
          <AlertTriangle size={16} className="text-amber-700 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-amber-800">
            Вы просрочили этап, но можете оставить поздний голос
          </p>
        </div>
      )}

      {/* Stage list */}
      <div className="divide-y divide-neutral-100" role="list" aria-label="Список этапов и дедлайнов">
        {stagesInfo.map((info) => (
          <div role="listitem" key={info.label}>
            <StageRow info={info} />
          </div>
        ))}
      </div>
    </Card>
  );
};
