import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy,
  Copy,
  CopyCheck,
  Plus,
  Users,
  Lightbulb,
  RotateCcw,
  CopyPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { getSessionDetails, duplicateSession } from '@/api/sessions';
import type { Idea, SessionDetailsResponse } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionResultProps {
  sessionId: string;
}

interface Step {
  id: string;
  text: string;
  done: boolean;
}

type LoadState = 'loading' | 'error' | 'ready';

// ---------------------------------------------------------------------------
// Steps persistence (клиентская — серверного эндпоинта для шагов нет)
// ---------------------------------------------------------------------------

function stepsKey(sessionId: string): string {
  return `brain-storm:result-steps:${sessionId}`;
}

function loadSteps(sessionId: string): Step[] {
  try {
    const raw = localStorage.getItem(stepsKey(sessionId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (s): s is Step =>
          typeof s === 'object' &&
          s !== null &&
          typeof (s as Step).id === 'string' &&
          typeof (s as Step).text === 'string' &&
          typeof (s as Step).done === 'boolean',
      )
      .map((s) => ({ id: s.id, text: s.text, done: s.done }));
  } catch {
    return [];
  }
}

function saveSteps(sessionId: string, steps: Step[]): void {
  try {
    localStorage.setItem(stepsKey(sessionId), JSON.stringify(steps));
  } catch {
    // localStorage недоступен — игнорируем
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function voteCountOf(idea: Idea): number {
  return idea.votes?.length ?? 0;
}

function getWinner(ideas: Idea[], selectedIdeaId: string | null): Idea | null {
  if (selectedIdeaId) {
    const selected = ideas.find((i) => i.id === selectedIdeaId);
    if (selected) return selected;
  }
  if (ideas.length === 0) return null;
  return [...ideas].sort((a, b) => voteCountOf(b) - voteCountOf(a))[0];
}

interface MarkdownParams {
  topic: string;
  winner: Idea | null;
  steps: Step[];
  membersCount: number;
  ideasCount: number;
  top3: { idea: Idea; count: number }[];
}

function buildMarkdown({
  topic,
  winner,
  steps,
  membersCount,
  ideasCount,
  top3,
}: MarkdownParams): string {
  const lines: string[] = [];
  lines.push(`# Результат сессии: ${topic}`);
  lines.push('');
  lines.push('## Победившая идея');
  if (winner) {
    lines.push(`**${winner.title}**`);
    lines.push(winner.content);
    lines.push(`Автор: ${winner.author?.email ?? 'Аноним'}`);
  } else {
    lines.push('Идея не выбрана.');
  }
  lines.push('');
  lines.push('## Первые шаги');
  if (steps.length > 0) {
    for (const step of steps) {
      lines.push(`- [${step.done ? 'x' : ' '}] ${step.text}`);
    }
  } else {
    lines.push('- Шагов пока нет');
  }
  lines.push('');
  lines.push('## Сводка');
  lines.push(`- Участников: ${membersCount}`);
  lines.push(`- Идей: ${ideasCount}`);
  lines.push(
    `- Топ-3: ${top3
      .map((t, i) => `${i + 1}. ${t.idea.title} (${t.count} голосов)`)
      .join(', ')}`,
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SessionResult: React.FC<SessionResultProps> = ({ sessionId }) => {
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [data, setData] = useState<SessionDetailsResponse | null>(null);
  const [steps, setSteps] = useState<Step[]>(() => loadSteps(sessionId));
  const [newStep, setNewStep] = useState('');
  const [copied, setCopied] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [actionError, setActionError] = useState('');

  // -----------------------------------------------------------------------
  // Data loading (GET /sessions/:id — включает идеи, голоса и участников)
  // -----------------------------------------------------------------------

  const loadResult = useCallback(async () => {
    setState('loading');
    setError('');
    setActionError('');
    try {
      const details = await getSessionDetails(sessionId);
      setData(details);
      setState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить результат');
      setState('error');
    }
  }, [sessionId]);

  useEffect(() => {
    void loadResult();
  }, [loadResult]);

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------

  const ideas: Idea[] = data?.ideas ?? [];

  const winner = useMemo(
    () => getWinner(ideas, data?.session.selectedIdeaId ?? null),
    [ideas, data?.session.selectedIdeaId],
  );

  const top3 = useMemo(
    () =>
      [...ideas]
        .sort((a, b) => voteCountOf(b) - voteCountOf(a))
        .slice(0, 3)
        .map((idea) => ({ idea, count: voteCountOf(idea) })),
    [ideas],
  );

  const maxVotes = top3[0]?.count ?? 1;
  const membersCount = data?.members.length ?? 0;

  const markdown = useMemo(
    () =>
      buildMarkdown({
        topic: data?.session.topic ?? '',
        winner,
        steps,
        membersCount,
        ideasCount: ideas.length,
        top3,
      }),
    [data?.session.topic, winner, steps, membersCount, ideas.length, top3],
  );

  // -----------------------------------------------------------------------
  // Steps
  // -----------------------------------------------------------------------

  const updateSteps = (next: Step[]) => {
    setSteps(next);
    saveSteps(sessionId, next);
  };

  const handleAddStep = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newStep.trim();
    if (!text) return;
    updateSteps([...steps, { id: `${Date.now()}`, text, done: false }]);
    setNewStep('');
  };

  const handleToggleStep = (id: string) => {
    updateSteps(steps.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));
  };

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      // Fallback для старых браузеров
      const textarea = document.createElement('textarea');
      textarea.value = markdown;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    setActionError('');
    try {
      const created = await duplicateSession(sessionId);
      navigate(`/session/${created.id}`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Не удалось дублировать сессию',
      );
      setDuplicating(false);
    }
  };

  // -----------------------------------------------------------------------
  // Loading / Error
  // -----------------------------------------------------------------------

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-4">
          <div className="h-8 w-64 rounded-md bg-neutral-100 animate-pulse" />
          <div className="h-48 rounded-md bg-neutral-100 animate-pulse" />
          <div className="h-36 rounded-md bg-neutral-100 animate-pulse" />
          <div className="h-48 rounded-md bg-neutral-100 animate-pulse" />
        </div>
      </div>
    );
  }

  if (state === 'error' || !data) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-sm text-neutral-600">{error || 'Результат недоступен'}</p>
            <Button variant="secondary" onClick={() => void loadResult()}>
              <RotateCcw size={14} />
              Повторить
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const { session } = data;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-4">
        {/* ——— Header ——— */}
        <header className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-neutral-500 mb-1">Результат сессии</p>
            <h1 className="text-xl font-semibold text-neutral-900">{session.topic}</h1>
          </div>
          <Badge variant="completed">Завершена</Badge>
        </header>

        {/* ——— Winning idea (крупная карточка) ——— */}
        <Card accentColor="completed" id="winner-card">
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-md bg-success-soft flex items-center justify-center flex-shrink-0">
                <Trophy size={20} className="text-success" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-neutral-900 leading-snug">
                  {winner ? winner.title : 'Идея не выбрана'}
                </h2>
                {winner && (
                  <p className="text-xs text-neutral-500 mt-1">
                    Автор: {winner.author?.email ?? 'Аноним'}
                  </p>
                )}
              </div>
            </div>
            {winner && (
              <p className="text-sm text-neutral-600 whitespace-pre-line">
                {winner.content}
              </p>
            )}
          </div>
        </Card>

        {/* ——— First steps checklist ——— */}
        <Card title="Первые шаги">
          <div className="flex flex-col gap-3">
            {steps.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {steps.map((step) => (
                  <li key={step.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`step-${step.id}`}
                      checked={step.done}
                      onChange={() => handleToggleStep(step.id)}
                      className="w-4 h-4 rounded-sm accent-primary"
                    />
                    <label
                      htmlFor={`step-${step.id}`}
                      className={`text-sm cursor-pointer ${
                        step.done
                          ? 'line-through text-neutral-400'
                          : 'text-neutral-700'
                      }`}
                    >
                      {step.text}
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-500">
                Добавьте первые шаги для реализации выбранной идеи.
              </p>
            )}
            <form onSubmit={handleAddStep} className="flex gap-2">
              <div className="flex-1">
                <Input
                  id={`new-step-${sessionId}`}
                  value={newStep}
                  onChange={(e) => setNewStep(e.target.value)}
                  placeholder="Новый шаг..."
                />
              </div>
              <Button type="submit" variant="secondary" disabled={!newStep.trim()}>
                <Plus size={14} />
                Добавить
              </Button>
            </form>
          </div>
        </Card>

        {/* ——— Summary ——— */}
        <Card title="Сводка">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-neutral-400" aria-hidden="true" />
                <span className="text-sm text-neutral-700">
                  Участников: {membersCount}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Lightbulb size={16} className="text-neutral-400" aria-hidden="true" />
                <span className="text-sm text-neutral-700">
                  Идей: {ideas.length}
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-neutral-800 mb-2">
                Топ-3 идеи
              </h3>
              {top3.length > 0 ? (
                <ul className="flex flex-col gap-3" aria-label="Топ-3 идеи по голосам">
                  {top3.map(({ idea, count }, index) => (
                    <li key={idea.id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-neutral-700 truncate">
                          {index + 1}. {idea.title}
                        </span>
                        <span className="text-xs text-neutral-500 flex-shrink-0">
                          {count} {count === 1 ? 'голос' : 'голосов'}
                        </span>
                      </div>
                      <div className="h-2 rounded-sm bg-neutral-100 overflow-hidden">
                        <div
                          className="h-full rounded-sm bg-stage-voting"
                          style={{
                            width: `${Math.round((count / Math.max(maxVotes, 1)) * 100)}%`,
                          }}
                          role="progressbar"
                          aria-valuenow={count}
                          aria-valuemin={0}
                          aria-valuemax={Math.max(maxVotes, 1)}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-500">Идей нет.</p>
              )}
            </div>
          </div>
        </Card>

        {/* ——— Actions ——— */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={() => void handleCopy()}>
            {copied ? (
              <CopyCheck size={14} aria-hidden="true" />
            ) : (
              <Copy size={14} aria-hidden="true" />
            )}
            {copied ? 'Скопировано' : 'Скопировать итог'}
          </Button>
          <Button
            variant="secondary"
            loading={duplicating}
            onClick={() => void handleDuplicate()}
          >
            <CopyPlus size={14} aria-hidden="true" />
            Дублировать сессию
          </Button>
          {actionError && (
            <p className="text-sm text-danger" role="alert">
              {actionError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
