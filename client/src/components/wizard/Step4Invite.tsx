import React from 'react';
import { Copy, Check, Link } from 'lucide-react';
import type { SessionMode } from '@/types';
import { Button } from '@/components/ui/Button';

interface Step4Data {
  inviteLink: string;
}

interface Step4InviteProps {
  topic: string;
  mode: SessionMode;
  data: Step4Data;
  onChange: (data: Step4Data) => void;
  stageDuration?: {
    discussionMin: number;
    votingMin: number;
    refinementMin: number;
  };
  votingConfig?: {
    voteLimit: number;
    finalistsCount: number;
  };
}

const modeLabels: Record<SessionMode, string> = {
  QUICK: 'Быстрый',
  TEAM: 'Командный',
  ASYNC: 'Асинхронный',
  PERSONAL: 'Личный',
};

export const Step4Invite: React.FC<Step4InviteProps> = ({
  topic,
  mode,
  data,
  stageDuration,
  votingConfig,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyLink = async () => {
    if (!data.inviteLink) return;
    try {
      await navigator.clipboard.writeText(data.inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = data.inviteLink;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const totalDuration = stageDuration
    ? stageDuration.discussionMin + stageDuration.votingMin + stageDuration.refinementMin
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-neutral-900 mb-1">Почти готово!</h2>
        <p className="text-sm text-neutral-500">
          Проверьте настройки и скопируйте ссылку для приглашения
        </p>
      </div>

      {/* Сводка */}
      <div className="rounded-md border border-neutral-200 bg-white p-4 space-y-3">
        <h3 className="text-sm font-medium text-neutral-800">Сводка настроек</h3>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-neutral-500">Тема:</span>
            <p className="font-medium text-neutral-900 line-clamp-1">{topic}</p>
          </div>
          <div>
            <span className="text-neutral-500">Режим:</span>
            <p className="font-medium text-neutral-900">{modeLabels[mode]}</p>
          </div>
        </div>

        {stageDuration && (
          <div className="grid grid-cols-3 gap-3 text-sm pt-2 border-t border-neutral-200">
            <div>
              <span className="text-neutral-500">Обсуждение:</span>
              <p className="font-medium text-neutral-900">{stageDuration.discussionMin} мин</p>
            </div>
            <div>
              <span className="text-neutral-500">Голосование:</span>
              <p className="font-medium text-neutral-900">{stageDuration.votingMin} мин</p>
            </div>
            <div>
              <span className="text-neutral-500">Доработка:</span>
              <p className="font-medium text-neutral-900">{stageDuration.refinementMin} мин</p>
            </div>
          </div>
        )}

        {votingConfig && (
          <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-neutral-200">
            <div>
              <span className="text-neutral-500">Лимит голосов:</span>
              <p className="font-medium text-neutral-900">{votingConfig.voteLimit}</p>
            </div>
            <div>
              <span className="text-neutral-500">Финалистов:</span>
              <p className="font-medium text-neutral-900">{votingConfig.finalistsCount}</p>
            </div>
          </div>
        )}

        {totalDuration && (
          <div className="text-sm pt-2 border-t border-neutral-200">
            <span className="text-neutral-500">Общая длительность:</span>
            {' '}
            <span className="font-medium text-neutral-900">{totalDuration} мин</span>
          </div>
        )}
      </div>

      {/* Ссылка для приглашения */}
      {mode !== 'PERSONAL' && (
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Ссылка для приглашения
          </label>
          <p className="text-xs text-neutral-500 mb-2">
            Отправьте эту ссылку участникам сессии
          </p>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
              <Link size={14} className="text-neutral-400 flex-shrink-0" />
              <span className="text-sm text-neutral-600 truncate">{data.inviteLink || 'Ссылка будет создана после сохранения'}</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyLink}
              disabled={!data.inviteLink}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Скопировано' : 'Копировать'}
            </Button>
          </div>
        </div>
      )}

      {mode === 'PERSONAL' && (
        <div className="rounded-md bg-neutral-50 p-3 border border-neutral-200">
          <p className="text-sm text-neutral-600">
            <span className="font-medium">Личный режим:</span>
            {' '}Сессия создана только для вас. Приглашать участников не нужно.
          </p>
        </div>
      )}
    </div>
  );
};

export function validateStep4(): boolean {
  return true;
}
