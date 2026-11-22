import React from 'react';
import { Input } from '@/components/ui/Input';
import type { SessionMode } from '@/types';
import { Lightbulb, Users, Clock, User } from 'lucide-react';

const modeOptions: { value: SessionMode; label: string; description: string; icon: React.ElementType }[] = [
  {
    value: 'QUICK',
    label: 'Быстрый',
    description: 'Одно голосование, быстрый результат',
    icon: Lightbulb,
  },
  {
    value: 'TEAM',
    label: 'Командный',
    description: 'Раунды с доработкой идей',
    icon: Users,
  },
  {
    value: 'ASYNC',
    label: 'Асинхронный',
    description: 'Дедлайны этапов, работа в своём темпе',
    icon: Clock,
  },
  {
    value: 'PERSONAL',
    label: 'Личный',
    description: 'Одиночный мозговой штурм',
    icon: User,
  },
];

interface Step1Data {
  topic: string;
  mode: SessionMode | '';
}

interface Step1TopicModeProps {
  data: Step1Data;
  onChange: (data: Step1Data) => void;
}

export const Step1TopicMode: React.FC<Step1TopicModeProps> = ({ data, onChange }) => {
  const handleTopicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onChange({ ...data, topic: value });
  };

  const handleModeChange = (mode: SessionMode) => {
    onChange({ ...data, mode });
  };

  const topicValid = data.topic.trim().length >= 3;
  const modeValid = data.mode !== '';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-neutral-900 mb-1">Тема и режим</h2>
        <p className="text-sm text-neutral-500">
          Укажите тему мозгового штурма и выберите режим сессии
        </p>
      </div>

      <Input
        label="Тема сессии"
        id="topic"
        name="topic"
        value={data.topic}
        onChange={handleTopicChange}
        placeholder="Например: Как улучшить онбординг пользователей?"
        error={data.topic.trim().length > 0 && !topicValid ? 'Минимум 3 символа' : undefined}
        hint="Минимум 3 символа"
      />

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Режим сессии
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {modeOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = data.mode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleModeChange(option.value)}
                className={`text-left p-3 rounded-md border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  isSelected
                    ? 'border-primary bg-primary-soft'
                    : 'border-neutral-200 hover:border-neutral-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={16} className={isSelected ? 'text-primary' : 'text-neutral-500'} />
                  <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-neutral-800'}`}>
                    {option.label}
                  </span>
                </div>
                <p className="text-xs text-neutral-500">{option.description}</p>
              </button>
            );
          })}
        </div>
        {!modeValid && (
          <p className="text-sm text-danger mt-1">Выберите режим</p>
        )}
      </div>

      <div className="rounded-md bg-neutral-50 p-3 border border-neutral-200">
        <p className="text-xs text-neutral-500">
          <span className="font-medium text-neutral-700">Совет:</span>
          {' '}Чем конкретнее тема — тем лучше идеи. Вместо «Маркетинг» попробуйте «Идеи для увеличения конверсии в подписку».
        </p>
      </div>
    </div>
  );
};

export function validateStep1(data: Step1Data): boolean {
  return data.topic.trim().length >= 3 && data.mode !== '';
}
