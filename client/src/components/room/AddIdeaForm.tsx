import React, { useState, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';

const MIN_TITLE_LENGTH = 3;
const MAX_TITLE_LENGTH = 100;
const MIN_CONTENT_LENGTH = 10;
const MAX_CONTENT_LENGTH = 1000;

interface AddIdeaFormProps {
  currentStage: string;
  onPublish: (title: string, content: string) => void;
}

export const AddIdeaForm: React.FC<AddIdeaFormProps> = ({
  currentStage,
  onPublish,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [titleError, setTitleError] = useState('');
  const [contentError, setContentError] = useState('');

  const isDiscussion = currentStage === 'DISCUSSION';

  const validateTitle = useCallback((value: string) => {
    if (value.length === 0) return '';
    if (value.length < MIN_TITLE_LENGTH) {
      return `Минимум ${MIN_TITLE_LENGTH} символа`;
    }
    if (value.length > MAX_TITLE_LENGTH) {
      return `Максимум ${MAX_TITLE_LENGTH} символов`;
    }
    return '';
  }, []);

  const validateContent = useCallback((value: string) => {
    if (value.length === 0) return '';
    if (value.length < MIN_CONTENT_LENGTH) {
      return `Минимум ${MIN_CONTENT_LENGTH} символов`;
    }
    if (value.length > MAX_CONTENT_LENGTH) {
      return `Максимум ${MAX_CONTENT_LENGTH} символов`;
    }
    return '';
  }, []);

  const isFormValid =
    title.length >= MIN_TITLE_LENGTH &&
    title.length <= MAX_TITLE_LENGTH &&
    content.length >= MIN_CONTENT_LENGTH &&
    content.length <= MAX_CONTENT_LENGTH;

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

  const handleExpand = () => {
    if (isDiscussion) {
      setExpanded(true);
    }
  };

  const handleCancel = () => {
    setTitle('');
    setContent('');
    setTitleError('');
    setContentError('');
    setExpanded(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newTitleError = validateTitle(title);
    const newContentError = validateContent(content);
    setTitleError(newTitleError);
    setContentError(newContentError);

    if (newTitleError || newContentError) return;

    onPublish(title, content);

    setTitle('');
    setContent('');
    setTitleError('');
    setContentError('');
    setExpanded(false);
  };

  return (
    <div className="w-full">
      {!expanded ? (
        <div>
          <Button
            variant="secondary"
            fullWidth
            onClick={handleExpand}
            disabled={!isDiscussion}
            title={
              isDiscussion
                ? undefined
                : 'Добавление идей доступно только на этапе обсуждения'
            }
          >
            <Plus size={16} />
            Добавить идею
          </Button>
          {!isDiscussion && (
            <p className="text-sm text-neutral-500 mt-2 text-center">
              Добавление идей доступно только на этапе обсуждения
            </p>
          )}
        </div>
      ) : (
        <Card accentColor="discussion">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-medium text-neutral-800">
                Новая идея
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                type="button"
                aria-label="Отменить добавление идеи"
              >
                <X size={16} aria-hidden="true" />
              </Button>
            </div>

            <Input
              label="Заголовок"
              placeholder="Краткая суть идеи..."
              value={title}
              onChange={handleTitleChange}
              error={titleError}
              hint={`${title.length}/${MAX_TITLE_LENGTH}`}
            />

            <div className="w-full">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Описание
              </label>
              <textarea
                value={content}
                onChange={handleContentChange}
                placeholder="Подробное описание вашей идеи..."
                rows={4}
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed resize-y"
              />
              {contentError ? (
                <p className="text-sm text-danger mt-1">{contentError}</p>
              ) : (
                <p className="text-sm text-neutral-500 mt-1">
                  {content.length}/{MAX_CONTENT_LENGTH}
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="submit" variant="primary" disabled={!isFormValid}>
                Опубликовать
              </Button>
              <Button type="button" variant="ghost" onClick={handleCancel}>
                Отмена
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
};
