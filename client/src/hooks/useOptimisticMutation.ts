import { useState, useCallback } from 'react';

export interface UseOptimisticMutationReturn {
  execute: (
    operation: () => Promise<void>,
    options?: { rollback?: () => void; onError?: (message: string) => void },
  ) => Promise<void>;
  isMutating: boolean;
  error: string | null;
  resetError: () => void;
}

/**
 * Хук для оптимистичных мутаций с откатом.
 *
 * @example
 *   const mutation = useOptimisticMutation();
 *
 *   const handleVote = async () => {
 *     // 1. Оптимистично обновить UI (снаружи)
 *     setVotes((v) => v + 1);
 *
 *     // 2. Вызвать mutation
 *     await mutation.execute(
 *       () => wsVote(ideaId),
 *       { rollback: () => setVotes((v) => v - 1) }
 *     );
 *   };
 */
export function useOptimisticMutation(): UseOptimisticMutationReturn {
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const execute = useCallback(
    async (
      operation: () => Promise<void>,
      options?: { rollback?: () => void; onError?: (message: string) => void },
    ) => {
      setIsMutating(true);
      setError(null);

      try {
        await operation();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred';

        // Откат
        if (options?.rollback) {
          try {
            options.rollback();
          } catch (rbErr) {
            console.error('Rollback failed:', rbErr);
          }
        }

        setError(message);

        // Уведомление
        if (options?.onError) {
          options.onError(message);
        } else if ('showToast' in window && typeof (window as any).showToast === 'function') {
          (window as any).showToast(message, 'error');
        } else {
          console.error('Mutation error:', message);
        }
      } finally {
        setIsMutating(false);
      }
    },
    [],
  );

  return { execute, isMutating, error, resetError };
}
