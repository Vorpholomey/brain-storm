import React from 'react';
import type { SessionMode } from '@/types';

interface Step3Data {
  voteLimit: number;
  finalistsCount: number;
}

interface Step3VotingProps {
  mode: SessionMode;
  data: Step3Data;
  onChange: (data: Step3Data) => void;
}

const voteLimitOptions = [3, 5, 7, 10, 15];
const finalistsOptions = [2, 3, 5];

interface ScenarioStep {
  stage: string;
  color: string;
  description: string;
  duration: string;
}

interface Step3VotingInternalProps extends Step3VotingProps {
  stageDuration?: {
    discussionMin: number;
    votingMin: number;
    refinementMin: number;
  };
}

export const Step3Voting: React.FC<Step3VotingInternalProps> = ({
  mode,
  data,
  onChange,
  stageDuration,
}) => {
  const handleVoteLimitChange = (value: number) => {
    onChange({ ...data, voteLimit: value });
  };

  const handleFinalistsChange = (value: number) => {
    onChange({ ...data, finalistsCount: value });
  };

  const buildScenario = (): ScenarioStep[] => {
    const steps: ScenarioStep[] = [];

    steps.push({
      stage: '1. Обсуждение',
      color: 'bg-stage-discussion',
      description: 'Участники предлагают идеи',
      duration: stageDuration ? `${stageDuration.discussionMin} мин` : '—',
    });

    steps.push({
      stage: '2. Голосование',
      color: 'bg-stage-voting',
      description: `Каждый голосует ${data.voteLimit} раз`,
      duration: stageDuration ? `${stageDuration.votingMin} мин` : '—',
    });

    if (mode === 'TEAM') {
      steps.push({
        stage: '3. Доработка',
        color: 'bg-stage-refinement',
        description: `Топ-${data.finalistsCount} идей на улучшение`,
        duration: stageDuration ? `${stageDuration.refinementMin} мин` : '—',
      });

      steps.push({
        stage: '4. Финальное голосование',
        color: 'bg-stage-final',
        description: 'Выбор одной лучшей идеи',
        duration: stageDuration ? `${stageDuration.votingMin} мин` : '—',
      });
    }

    steps.push({
      stage: mode === 'TEAM' ? '5. Результат' : `${mode === 'QUICK' ? '3' : '3'}. Результат`,
      color: 'bg-stage-completed',
      description: 'Победившая идея с планом действий',
      duration: '',
    });

    return steps;
  };

  const scenario = buildScenario();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-neutral-900 mb-1">Голосование</h2>
        <p className="text-sm text-neutral-500">
          Настройте лимит голосов и количество финалистов
        </p>
      </div>

      {/* Лимит голосов */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          Лимит голосов на участника
        </label>
        <p className="text-xs text-neutral-500 mb-2">
          Сколько раз каждый участник может проголосовать
        </p>
        <div className="flex flex-wrap gap-2">
          {voteLimitOptions.map((value) => {
            const isSelected = data.voteLimit === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => handleVoteLimitChange(value)}
                className={`px-4 py-2 text-sm rounded-md border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  isSelected
                    ? 'border-primary bg-primary text-white'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                }`}
              >
                {value} голосов
              </button>
            );
          })}
        </div>
      </div>

      {/* Количество финалистов */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          Количество финалистов
        </label>
        <p className="text-xs text-neutral-500 mb-2">
          Сколько идей пройдут в финал после первого голосования
        </p>
        <div className="flex flex-wrap gap-2">
          {finalistsOptions.map((value) => {
            const isSelected = data.finalistsCount === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => handleFinalistsChange(value)}
                className={`px-4 py-2 text-sm rounded-md border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  isSelected
                    ? 'border-primary bg-primary text-white'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                }`}
              >
                {value} {value === 2 ? 'идеи' : value < 5 ? 'идеи' : 'идей'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Предпросмотр сценария */}
      <div>
        <h3 className="text-sm font-medium text-neutral-700 mb-3">Сценарий сессии</h3>
        <div className="space-y-2">
          {scenario.map((step, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 rounded-md bg-neutral-50 border border-neutral-200"
            >
              <div className={`w-1 self-stretch rounded-full ${step.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-neutral-800">
                    {step.stage}
                  </span>
                  {step.duration && (
                    <span className="text-xs text-neutral-500 whitespace-nowrap">
                      {step.duration}
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export function validateStep3(data: Step3Data): boolean {
  return data.voteLimit > 0 && data.finalistsCount > 0;
}
