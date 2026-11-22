import React from 'react';

const badgeBase =
  'inline-flex items-center rounded-sm px-2 py-1 text-xs font-medium';

const badgeVariants: Record<string, string> = {
  discussion: 'bg-stage-discussion text-white',
  voting: 'bg-stage-voting text-white',
  refinement: 'bg-stage-refinement text-white',
  final: 'bg-stage-final text-white',
  completed: 'bg-stage-completed text-white',
};

export type BadgeVariant = 'discussion' | 'voting' | 'refinement' | 'final' | 'completed';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'discussion',
}) => {
  return (
    <span className={`${badgeBase} ${badgeVariants[variant]}`}>
      {children}
    </span>
  );
};
