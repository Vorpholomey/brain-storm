import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronRight, ChevronLeft } from 'lucide-react';
import type { SessionMode } from '@/types';
import { Button } from '@/components/ui/Button';
import { Step1TopicMode, validateStep1 } from '@/components/wizard/Step1TopicMode';
import { Step2Stages, validateStep2, defaultData as defaultStageData } from '@/components/wizard/Step2Stages';
import { Step3Voting, validateStep3 } from '@/components/wizard/Step3Voting';
import { Step4Invite, validateStep4 } from '@/components/wizard/Step4Invite';
import { createSession } from '@/api/sessions';

const STORAGE_KEY = 'brainstorm_session_draft';
const DEBOUNCE_MS = 500;

type Step1Data = { topic: string; mode: SessionMode | '' };
type Step2Data = {
  discussionMin: number;
  votingMin: number;
  refinementMin: number;
  startDate: string;
  startTime: string;
};
type Step3Data = { voteLimit: number; finalistsCount: number };
type Step4Data = { inviteLink: string };

interface WizardState {
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
  step4: Step4Data;
}

const initialWizardState: WizardState = {
  step1: { topic: '', mode: '' },
  step2: { ...defaultStageData },
  step3: { voteLimit: 5, finalistsCount: 3 },
  step4: { inviteLink: '' },
};

const stepTitles = ['Тема и режим', 'Этапы', 'Голосование', 'Готово'];

export const CreateSessionWizard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [currentStep, setCurrentStep] = useState(0);
  const [state, setState] = useState<WizardState>(() => {
    // Восстановление черновика из localStorage или URL
    try {
      const draft = searchParams.get('draft');
      if (draft) {
        const parsed = JSON.parse(decodeURIComponent(draft));
        return {
          ...initialWizardState,
          step1: { topic: parsed.topic || '', mode: parsed.mode || '' },
          step2: { ...defaultStageData },
          step3: { voteLimit: parsed.config?.voteLimit ?? 5, finalistsCount: parsed.config?.finalistsCount ?? 3 },
          step4: { inviteLink: '' },
        };
      }
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Игнорируем ошибки парсинга
    }
    return initialWizardState;
  });

  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Автосохранение черновика с debounce
  const saveDraft = useCallback((s: WizardState) => {
    setSaving(true);
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      } catch {
        // Хранилище переполнено — игнорируем
      }
      setSaving(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const cleanup = saveDraft(state);
    return cleanup;
  }, [state, saveDraft]);

  const mode = state.step1.mode as SessionMode | '';

  // Валидация текущего шага
  const isCurrentStepValid = useMemo(() => {
    switch (currentStep) {
      case 0:
        return validateStep1(state.step1);
      case 1:
        return mode ? validateStep2(state.step2, mode) : false;
      case 2:
        return validateStep3(state.step3);
      case 3:
        return validateStep4();
      default:
        return false;
    }
  }, [currentStep, state, mode]);

  const updateStep1 = (data: Step1Data) => {
    setState((prev) => ({ ...prev, step1: data }));
  };

  const updateStep2 = (data: Step2Data) => {
    setState((prev) => ({ ...prev, step2: data }));
  };

  const updateStep3 = (data: Step3Data) => {
    setState((prev) => ({ ...prev, step3: data }));
  };

  const updateStep4 = (data: Step4Data) => {
    setState((prev) => ({ ...prev, step4: data }));
  };

  const handleNext = () => {
    if (!isCurrentStepValid) return;
    if (currentStep < 3) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleCreateSession = async () => {
    if (!isCurrentStepValid || !mode) return;
    setCreating(true);
    setError(null);
    try {
      const result = await createSession({
        topic: state.step1.topic,
        mode,
        config: {
          voteLimit: state.step3.voteLimit,
          finalistsCount: state.step3.finalistsCount,
          discussionDurationMin: state.step2.discussionMin,
          votingDurationMin: state.step2.votingMin,
          refinementDurationMin: state.step2.refinementMin,
        },
        startDate: state.step2.startDate || undefined,
        startTime: state.step2.startTime || undefined,
      });
      // Очищаем черновик
      localStorage.removeItem(STORAGE_KEY);
      // Сохраняем ссылку для шага 4
      const inviteLink = `${window.location.origin}/session/${result.id}`;
      setState((prev) => ({
        ...prev,
        step4: { inviteLink },
      }));
      // Переходим на последний шаг
      setCurrentStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать сессию');
    } finally {
      setCreating(false);
    }
  };

  const handleGoToSession = () => {
    if (state.step4.inviteLink) {
      const sessionId = state.step4.inviteLink.split('/').pop();
      navigate(`/session/${sessionId}`);
    } else {
      handleCreateSession();
    }
  };

  const handleCancel = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Шапка */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <button
            type="button"
            onClick={handleCancel}
            className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800 transition-colors mb-4"
          >
            <ArrowLeft size={14} />
            Назад к дашборду
          </button>

          <h1 className="text-xl font-semibold text-neutral-900 mb-4">
            Создать сессию
          </h1>

          {/* Индикатор прогресса */}
          <div className="flex items-center gap-2">
            {stepTitles.map((title, index) => {
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;
              return (
                <React.Fragment key={index}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                        isCompleted
                          ? 'bg-success text-white'
                          : isCurrent
                          ? 'bg-primary text-white'
                          : 'bg-neutral-200 text-neutral-500'
                      }`}
                    >
                      {isCompleted ? <Check size={14} /> : index + 1}
                    </div>
                    <span
                      className={`text-sm font-medium hidden sm:block ${
                        isCurrent ? 'text-neutral-900' : 'text-neutral-500'
                      }`}
                    >
                      {title}
                    </span>
                  </div>
                  {index < stepTitles.length - 1 && (
                    <div className={`flex-1 h-0.5 rounded ${index < currentStep ? 'bg-success' : 'bg-neutral-200'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Индикатор сохранения */}
          {saving && (
            <p className="text-xs text-neutral-400 mt-2">Сохранение черновика...</p>
          )}
        </div>
      </header>

      {/* Основной контент */}
      <main className="max-w-3xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-4 rounded-md bg-danger-soft p-3 border border-danger">
            <p className="text-sm text-danger">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCreateSession}
              className="mt-2"
            >
              Повторить
            </Button>
          </div>
        )}

        {/* Шаг 1: Тема и режим */}
        {currentStep === 0 && (
          <Step1TopicMode data={state.step1} onChange={updateStep1} />
        )}

        {/* Шаг 2: Этапы */}
        {currentStep === 1 && mode && (
          <Step2Stages
            mode={mode}
            data={state.step2}
            onChange={updateStep2}
          />
        )}

        {/* Шаг 3: Голосование */}
        {currentStep === 2 && mode && (
          <Step3Voting
            mode={mode}
            data={state.step3}
            onChange={updateStep3}
            stageDuration={{
              discussionMin: state.step2.discussionMin,
              votingMin: state.step2.votingMin,
              refinementMin: state.step2.refinementMin,
            }}
          />
        )}

        {/* Шаг 4: Готово */}
        {currentStep === 3 && mode && (
          <Step4Invite
            topic={state.step1.topic}
            mode={mode}
            data={state.step4}
            onChange={updateStep4}
            stageDuration={{
              discussionMin: state.step2.discussionMin,
              votingMin: state.step2.votingMin,
              refinementMin: state.step2.refinementMin,
            }}
            votingConfig={{
              voteLimit: state.step3.voteLimit,
              finalistsCount: state.step3.finalistsCount,
            }}
          />
        )}

        {/* Навигация */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-neutral-200">
          <div>
            {currentStep > 0 && (
              <Button variant="secondary" onClick={handleBack}>
                <ChevronLeft size={16} />
                Назад
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {currentStep < 3 && (
              <Button
                onClick={handleNext}
                disabled={!isCurrentStepValid}
              >
                Далее
                <ChevronRight size={16} />
              </Button>
            )}
            {currentStep === 3 && !state.step4.inviteLink && (
              <Button
                onClick={handleCreateSession}
                loading={creating}
                disabled={creating}
              >
                Создать сессию
              </Button>
            )}
            {currentStep === 3 && state.step4.inviteLink && (
              <Button onClick={handleGoToSession}>
                Перейти к сессии
                <ChevronRight size={16} />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
