import React, { useState, useCallback } from 'react';
import { Save, X, User } from 'lucide-react';
import type { Idea } from '@/types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';
import { updateIdea } from '@/api/ideas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IdeaEditorPresence {
  userId: string;
  userName: string;
}

export interface IdeaEditorProps {
  idea: Idea;
  onSave: (updatedIdea: Idea) => void;
  onCancel: () => void;
  presence?: IdeaEditorPresence;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_TITLE_LENGTH = 3;
const MAX_TITLE_LENGTH = 100;
const MIN_CONTENT_LENGTH = 10;
const MAX_CONTENT_LENGTH = 1000;

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateTitle(value: string): string {
  if (value.trim().length === 0) return 'Заголовок не может быть пустым';
  if (value.length < MIN_TITLE_LENGTH) {
    return `Минимум ${MIN_TITLE_LENGTH} символа`;
  }
  if (value.length > MAX_TITLE_LENGTH) {
    return `Максимум ${MAX_TITLE_LENGTH} символов`;
  }
  return '';
}

function validateContent(value: string): string {
  if (value.trim().length === 0) return 'Описание не может быть пустым';
  if (value.length < MIN_CONTENT_LENGTH) {
    return `Минимум ${MIN_CONTENT_LENGTH} символов`;
  }
  if (value.length > MAX_CONTENT_LENGTH) {
    return `Максимум ${MAX_CONTENT_LENGTH} символов`;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const IdeaEditor: React.FC<IdeaEditorProps> = React.memo(
  function IdeaEditor({ idea, onSave, onCancel, presence }) {
    const [title, setTitle] = useState(idea.title);
    const [content, setContent] = useState(idea.content);
    const [titleError, setTitleError] = useState('');
    const [contentError, setContentError] = useState('');
    const [saved, setSaved] = useState(false);
    const mutation = useOptimisticMutation();

    const hasChanges = title !== idea.title || content !== idea.content;

    const isFormValid =
      !validateTitle(title) && !validateContent(content);

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (value.length <= MAX_TITLE_LENGTH) {
        setTitle(value);
        setTitleError(validateTitle(value));
      }
    };

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (value.length <= MAX_CONTENT_LENGTH) {
        setContent(value);
        setContentError(validateContent(value));
      }
    };

    const handleSave = useCallback(async () => {
      const newTitleError = validateTitle(title);
      const newContentError = validateContent(content);
      setTitleError(newTitleError);
      setContentError(newContentError);
      if (newTitleError || newContentError) return;

      const previous = { title: idea.title, content: idea.content };

      // 1. Оптимистичное обновление — сразу показываем результат
      const optimistic: Idea = { ...idea, title, content };
      onSave(optimistic);
      setSaved(true);

      // 2. Сохранение на сервере
      await mutation.execute(
        async () => {
          const updated = await updateIdea(idea.id, { title, content });
          // Сервер может нормализовать данные — синхронизируем
          onSave({ ...idea, title: updated.title, content: updated.content });
        },
        {
          rollback: () => {
            // Откат к исходным значениям
            onSave({ ...idea, ...previous });
            setSaved(false);
          },
          onError: () => {
            // Сообщение об ошибке показывает useOptimisticMutation
          },
        },
      );
    }, [title, content, idea, mutation, onSave]);

    const handleCancel = useCallback(() => {
      setTitle(idea.title);
      setContent(idea.content);
      setTitleError('');
      setContentError('');
      setSaved(false);
      onCancel();
    }, [idea.title, idea.content, onCancel]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleCancel();
        } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          if (hasChanges && isFormValid && !mutation.isMutating) {
            void handleSave();
          }
        }
      },
      [hasChanges, isFormValid, mutation.isMutating, handleSave, handleCancel],
    );

    const showErrors = hasChanges;

    return (
      <Card accentColor="refinement">
        <div className="space-y-3" onKeyDown={handleKeyDown}>
          {/* ——— Presence indicator ——— */}
          {presence && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <User size={12} aria-hidden="true" />
              <span>{presence.userName} редактирует…</span>
            </div>
          )}

          {/* ——— Title ——— */}
          <Input
            id={`idea-editor-title-${idea.id}`}
            label="Заголовок"
            value={title}
            onChange={handleTitleChange}
            placeholder="Краткая суть идеи..."
            error={showErrors ? titleError : undefined}
            hint={`${title.length}/${MAX_TITLE_LENGTH}`}
          />

          {/* ——— Content ——— */}
          <div className="w-full">
            <label
              htmlFor={`idea-editor-content-${idea.id}`}
              className="block text-sm font-medium text-neutral-700 mb-1"
            >
              Описание
            </label>
            <textarea
              id={`idea-editor-content-${idea.id}`}
              value={content}
              onChange={handleContentChange}
              placeholder="Подробное описание вашей идеи..."
              rows={4}
              aria-invalid={showErrors ? Boolean(contentError) : undefined}
              className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 resize-y"
            />
            {showErrors && contentError ? (
              <p className="text-sm text-danger mt-1">{contentError}</p>
            ) : (
              <p className="text-sm text-neutral-500 mt-1">
                {content.length}/{MAX_CONTENT_LENGTH}
              </p>
            )}
          </div>

          {/* ——— Error from mutation ——— */}
          {mutation.error && (
            <p className="text-sm text-danger" role="alert">
              {mutation.error}
            </p>
          )}

          {/* ——— Actions ——— */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="primary"
              disabled={!hasChanges || !isFormValid}
              loading={mutation.isMutating}
              onClick={() => void handleSave()}
            >
              <Save size={14} aria-hidden="true" />
              Сохранить
            </Button>
            <Button variant="ghost" onClick={handleCancel}>
              <X size={14} aria-hidden="true" />
              Отмена
            </Button>
            {saved && (
              <span className="text-xs text-success" role="status">
                Сохранено
              </span>
            )}
          </div>

          {/* ——— Keyboard hint ——— */}
          <p className="text-xs text-neutral-500">
            Cmd/Ctrl+Enter — сохранить · Esc — отмена
          </p>
        </div>
      </Card>
    );
  },
);
