import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Sparkles, Trash2, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { structureFromChat } from '@/api/ideas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DraftIdea {
  id: string;
  title: string;
  description: string;
}

type Step = 'input' | 'preview' | 'success';

export interface CollectFromChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  onIdeasAdded: () => void;
}

// ---------------------------------------------------------------------------
// CollectFromChatModal
// ---------------------------------------------------------------------------

export function CollectFromChatModal({
  isOpen,
  onClose,
  sessionId,
  onIdeasAdded,
}: CollectFromChatModalProps): JSX.Element | null {
  const [step, setStep] = useState<Step>('input');
  const [chatText, setChatText] = useState('');
  const [drafts, setDrafts] = useState<DraftIdea[]>([]);
  const [structuring, setStructuring] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Save previously focused element and reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setStep('input');
      setChatText('');
      setDrafts([]);
      setError(null);
      setStructuring(false);
      setPublishing(false);
    }
  }, [isOpen]);

  // Focus textarea on open
  useEffect(() => {
    if (isOpen && step === 'input') {
      textareaRef.current?.focus();
    }
  }, [isOpen, step]);

  // Restore focus on close
  useEffect(() => {
    if (!isOpen && previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [isOpen]);

  // Close on Escape + Focus trap
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
        return;
      }

      // Focus trap
      if (e.key === 'Tab' && isOpen) {
        const modal = modalRef.current;
        if (!modal) return;

        const focusableElements = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // -----------------------------------------------------------------------
  // Step 1 → Step 2: Structure chat text
  // -----------------------------------------------------------------------

  const handleStructure = useCallback(async () => {
    const trimmed = chatText.trim();
    if (!trimmed) return;

    setStructuring(true);
    setError(null);

    try {
      const result = await structureFromChat(sessionId, trimmed);
      const mapped: DraftIdea[] = result.map((item) => ({
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        title: item.title,
        description: item.description,
      }));
      setDrafts(mapped);
      setStep('preview');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Не удалось структурировать текст';
      setError(message);
    } finally {
      setStructuring(false);
    }
  }, [chatText, sessionId]);

  // -----------------------------------------------------------------------
  // Step 2 → Step 3: Publish ideas
  // -----------------------------------------------------------------------

  const handlePublish = useCallback(async () => {
    if (drafts.length === 0) return;

    setPublishing(true);
    setError(null);

    try {
      for (const draft of drafts) {
        const resp = await fetch('/api/ideas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            sessionId,
            title: draft.title,
            content: draft.description,
          }),
        });
        if (!resp.ok) {
          const errBody = await resp.json().catch(() => ({
            message: `Ошибка создания идеи «${draft.title}»`,
          }));
          throw new Error(errBody.message ?? `Ошибка создания идеи «${draft.title}»`);
        }
      }
      setStep('success');
      onIdeasAdded();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Ошибка публикации идей';
      setError(message);
    } finally {
      setPublishing(false);
    }
  }, [drafts, sessionId, onIdeasAdded]);

  // -----------------------------------------------------------------------
  // Draft editing helpers
  // -----------------------------------------------------------------------

  const updateDraft = useCallback(
    (id: string, field: 'title' | 'description', value: string) => {
      setDrafts((prev) =>
        prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)),
      );
    },
    [],
  );

  const removeDraft = useCallback((id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  }, []);

  // -----------------------------------------------------------------------
  // Hide when closed
  // -----------------------------------------------------------------------

  if (!isOpen) return null;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-modal-title"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card — fullscreen on mobile, centered on desktop */}
      <div
        ref={modalRef}
        className="relative w-full sm:max-w-2xl bg-white sm:rounded-lg shadow-2xl flex flex-col h-full sm:max-h-[90vh] overflow-hidden sm:my-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-neutral-200">
          <h2
            id="chat-modal-title"
            className="text-base sm:text-lg font-semibold text-neutral-800"
          >
            {step === 'input' && 'Структурировать из чата'}
            {step === 'preview' && 'Проверить идеи'}
            {step === 'success' && 'Готово'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Закрыть модальное окно"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
          {/* ===== Step 1: Input ===== */}
          {step === 'input' && (
            <div className="space-y-4">
              <p className="text-sm text-neutral-500">
                Вставьте текст чата или обсуждения — AI выделит идеи
              </p>
              <textarea
                ref={textareaRef}
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Пример:&#10;— Давай сделаем тёмную тему&#10;— А может добавить голосовое управление?&#10;— Нужно улучшить поиск..."
                className="w-full h-64 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 resize-y"
                disabled={structuring}
              />
              {error && (
                <p className="text-sm text-danger" role="alert">
                  {error}
                </p>
              )}
              <div className="flex justify-end">
                <Button
                  onClick={handleStructure}
                  loading={structuring}
                  disabled={!chatText.trim() || structuring}
                >
                  <Sparkles size={16} />
                  Структурировать
                </Button>
              </div>
            </div>
          )}

          {/* ===== Step 2: Preview ===== */}
          {step === 'preview' && (
            <div className="space-y-4">
              <p className="text-sm text-neutral-500">
                Найдено {drafts.length}{' '}
                {drafts.length === 1
                  ? 'идею'
                  : drafts.length < 5
                    ? 'идеи'
                    : 'идей'}
                . Отредактируйте или удалите лишнее, затем опубликуйте.
              </p>
              {drafts.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-8">
                  Все идеи удалены. Вернитесь и попробуйте другой текст.
                </p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {drafts.map((draft) => (
                    <Card key={draft.id} className="relative">
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <input
                            type="text"
                            value={draft.title}
                            onChange={(e) =>
                              updateDraft(draft.id, 'title', e.target.value)
                            }
                            className="flex-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm font-medium text-neutral-800 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="Заголовок идеи"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDraft(draft.id)}
                            className="text-neutral-400 hover:text-danger hover:bg-red-50 shrink-0"
                            title="Удалить идею"
                            aria-label={`Удалить идею "${draft.title}"`}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </Button>
                        </div>
                        <textarea
                          value={draft.description}
                          onChange={(e) =>
                            updateDraft(
                              draft.id,
                              'description',
                              e.target.value,
                            )
                          }
                          className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-700 resize-y min-h-[60px] focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                          placeholder="Описание идеи..."
                          rows={2}
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              )}
              {error && (
                <p className="text-sm text-danger" role="alert">
                  {error}
                </p>
              )}
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="secondary"
                  onClick={() => setStep('input')}
                  disabled={publishing}
                >
                  <ArrowLeft size={16} />
                  Назад
                </Button>
                <Button
                  onClick={handlePublish}
                  loading={publishing}
                  disabled={drafts.length === 0 || publishing}
                >
                  {publishing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Публикация...
                    </>
                  ) : (
                    'Опубликовать'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ===== Step 3: Success ===== */}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle size={32} className="text-success" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-neutral-800">
                  Идеи успешно добавлены
                </h3>
                <p className="text-sm text-neutral-500 mt-1">
                  {drafts.length}{' '}
                  {drafts.length === 1
                    ? 'идея'
                    : drafts.length < 5
                      ? 'идеи'
                      : 'идей'}
                  {' '}добавлено в сессию
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer — Close button on success step */}
        {step === 'success' && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-neutral-200 flex justify-end">
            <Button onClick={onClose}>Закрыть</Button>
          </div>
        )}
      </div>
    </div>
  );
}
