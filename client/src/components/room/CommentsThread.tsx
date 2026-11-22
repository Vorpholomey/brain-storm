import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Send } from 'lucide-react';
import { Button } from '../ui/Button';
import { useOptimisticMutation } from '../../hooks/useOptimisticMutation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommentItem {
  id: string;
  text: string;
  createdAt: string;
  authorName: string;
}

export interface CommentsThreadProps {
  ideaId: string;
  comments: CommentItem[];
  onAddComment: (text: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_COMMENT_LENGTH = 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'только что';
  if (diffMin < 60) return `${diffMin} мин. назад`;
  if (diffHour < 24) return `${diffHour} ч. назад`;
  if (diffDay < 7) return `${diffDay} дн. назад`;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function showToast(message: string, type: 'success' | 'error' = 'error') {
  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-success' : 'bg-danger';
  toast.className = `fixed bottom-4 right-4 z-50 ${bgClass} text-white text-sm px-4 py-2 rounded-md shadow-card`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ---------------------------------------------------------------------------
// Comment Row
// ---------------------------------------------------------------------------

interface CommentRowProps {
  comment: CommentItem;
  pending?: boolean;
}

const CommentRow: React.FC<CommentRowProps> = React.memo(function CommentRow({
  comment,
  pending,
}) {
  const initials = comment.authorName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={`flex gap-2 ${pending ? 'opacity-60' : ''}`}
      data-pending={pending ? 'true' : undefined}
    >
      {/* Аватар */}
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
        {initials}
      </div>

      {/* Контент */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-neutral-700">
            {comment.authorName}
          </span>
          <span className="text-xs text-neutral-500">
            {formatRelativeTime(comment.createdAt)}
          </span>
        </div>
        <p className="text-sm text-neutral-600 whitespace-pre-wrap break-words">
          {comment.text}
        </p>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// CommentsThread
// ---------------------------------------------------------------------------

export const CommentsThread: React.FC<CommentsThreadProps> = React.memo(function CommentsThread({
  comments,
  onAddComment,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [localComments, setLocalComments] = useState<CommentItem[]>(comments);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mutation = useOptimisticMutation();

  // Синхронизация с внешними комментариями
  useEffect(() => {
    setLocalComments(comments);
  }, [comments]);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_COMMENT_LENGTH) {
      setText(value);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const now = new Date().toISOString();
    const tempComment: CommentItem = {
      id: `temp-${Date.now()}`,
      text: trimmed,
      createdAt: now,
      authorName: 'Вы',
    };

    // Оптимистичное добавление
    setLocalComments((prev) => [...prev, tempComment]);
    setText('');

    try {
      await mutation.execute(
        async () => {
          await onAddComment(trimmed);
        },
        {
          rollback: () => {
            // Удаляем временный комментарий при откате
            setLocalComments((prev) => prev.filter((c) => c.id !== tempComment.id));
          },
          onError: (message: string) => {
            showToast(message);
          },
        },
      );
    } catch {
      // mutation.execute уже обрабатывает ошибку и делает rollback
    }

    // Фокус обратно на textarea
    textareaRef.current?.focus();
  }, [text, onAddComment, mutation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void handleSubmit();
      }
    },
    [handleSubmit],
  );

  const remaining = MAX_COMMENT_LENGTH - text.length;
  const canSend = text.trim().length > 0 && remaining >= 0;

  return (
    <div className="border-t border-neutral-200">
      {/* Кнопка раскрытия */}
      <button
        type="button"
        onClick={toggleOpen}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="font-medium">
          Комментарии ({localComments.length})
        </span>
        {isOpen ? (
          <ChevronUp size={16} />
        ) : (
          <ChevronDown size={16} />
        )}
      </button>

      {/* Контент аккордеона */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-4">
          {/* Список комментариев */}
          <div className="flex flex-col gap-3 mb-4 max-h-60 overflow-y-auto pr-1">
            {localComments.length === 0 ? (
              <p className="text-sm text-neutral-400 text-center py-4">
                Пока нет комментариев
              </p>
            ) : (
              localComments.map((comment) => (
                <CommentRow
                  key={comment.id}
                  comment={comment}
                  pending={comment.id.startsWith('temp-')}
                />
              ))
            )}
          </div>

          {/* Форма ввода */}
          <div className="flex flex-col gap-2">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                placeholder="Написать комментарий…"
                rows={2}
                maxLength={MAX_COMMENT_LENGTH + 50}
                className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 resize-none transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              />
            </div>

            <div className="flex items-center justify-between">
              <span
                className={`text-xs ${
                  remaining < 100 ? 'text-danger' : 'text-neutral-400'
                }`}
              >
                {remaining} симв.
              </span>
              <Button
                size="sm"
                disabled={!canSend}
                onClick={handleSubmit}
                className="gap-1"
              >
                <Send size={14} />
                Отправить
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
