import { useContext } from 'react';
import { SessionSocketContext } from '@/context/SessionSocketContext';
import type { SessionSocketValue } from '@/context/SessionSocketContext';

export function useSessionSocket(): SessionSocketValue {
  const context = useContext(SessionSocketContext);
  if (!context) {
    throw new Error('useSessionSocket must be used within SessionSocketProvider');
  }
  return context;
}
