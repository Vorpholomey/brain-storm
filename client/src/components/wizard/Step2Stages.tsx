import React from 'react';
import type { SessionMode } from '@/types';

interface StageDuration {
  discussionMin: number;
  votingMin: number;
  refinementMin: number;
}

interface Step2Data extends StageDuration {
  startDate: string;
  startTime: string;
}

const defaultData: Step2Data = {
  discussionMin: 15,
  votingMin: 10,
  refinementMin: 10,
  startDate: '',
  startTime: '',
};

interface Step2StagesProps {
  mode: SessionMode;
  data: Step2Data;
  onChange: (data: Step2Data) => void;
}

const durationOptions = [5, 10, 15, 20, 30, 45, 60];

const stageDescriptions: Record<keyof StageDuration, { label: string; hint: string }> = {
  discussionMin: {
    label: 'Обсуждение',
    hint: 'Участники предлагают идеи',
  },
  votingMin: {
    label: 'Голосование',
    hint: 'Голосование с лимитом голосов',
  },
  refinementMin: {
    label: 'Доработка',
    hint: 'Улучшение финальных идей',
  },
};

export const Step2Stages: React.FC<Step2StagesProps> = ({ mode, data, onChange }) => {
  const isAsync = mode === 'ASYNC';

  const handleDurationChange = (key: keyof StageDuration, value: number) => {
    onChange({ ...data, [key]: value });
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...data, startDate: e.target.value });
  };

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...data, startTime: e.target.value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-neutral-900 mb-1">Длительность этапов</h2>
        <p className="text-sm text-neutral-500">
          {isAsync
            ? 'Укажите дедлайн начала и длительность каждого этапа'
            : 'Укажите длительность каждого этапа сессии'}
        </p>
      </div>

      {/* Асинхронный режим — дата и время начала */}
      {isAsync && (
        <div className="rounded-md bg-warning-soft p-4 border border-warning space-y-3">
          <h3 className="text-sm font-medium text-neutral-800">Начало сессии</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-neutral-700 mb-1">
                Дата начала
              </label>
              <input
                id="startDate"
                type="date"
                value={data.startDate}
                onChange={handleStartDateChange}
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label htmlFor="startTime" className="block text-sm font-medium text-neutral-700 mb-1">
                Время начала
              </label>
              <input
                id="startTime"
                type="time"
                value={data.startTime}
                onChange={handleStartTimeChange}
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      )}

      {/* Длительность этапов */}
      <div className="space-y-4">
        {(['discussionMin', 'votingMin', 'refinementMin'] as const).map((key) => {
          const { label, hint } = stageDescriptions[key];
          return (
            <div key={key}>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                {label}
              </label>
              <p className="text-xs text-neutral-500 mb-2">{hint}</p>
              <div className="flex flex-wrap gap-2">
                {durationOptions.map((minutes) => {
                  const isSelected = data[key] === minutes;
                  return (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => handleDurationChange(key, minutes)}
                      className={`px-3 py-1.5 text-sm rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                        isSelected
                          ? 'border-primary bg-primary text-white'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                      }`}
                    >
                      {minutes} мин
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Итоговая длительность */}
      <div className="rounded-md bg-neutral-50 p-3 border border-neutral-200">
        <p className="text-sm text-neutral-700">
          <span className="font-medium">Общая длительность:</span>
          {' '}
          {data.discussionMin + data.votingMin + data.refinementMin} мин
        </p>
      </div>
    </div>
  );
};

export function validateStep2(data: Step2Data, mode: SessionMode): boolean {
  if (mode === 'ASYNC') {
    return data.startDate !== '' && data.startTime !== '';
  }
  return (
    data.discussionMin > 0 &&
    data.votingMin > 0 &&
    data.refinementMin > 0
  );
}

export { defaultData };
