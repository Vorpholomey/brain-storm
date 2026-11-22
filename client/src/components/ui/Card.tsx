import React from 'react';

const cardBase =
  'rounded-md border border-neutral-200 bg-white shadow-card transition-colors';

const cardHeader = 'px-4 py-3 border-b border-neutral-200';

const cardTitle = 'text-base font-medium text-neutral-800';

const cardBody = 'px-4 py-3';

const accentBorderMap: Record<string, string> = {
  discussion: 'border-stage-discussion',
  voting: 'border-stage-voting',
  refinement: 'border-stage-refinement',
  final: 'border-stage-final',
  completed: 'border-stage-completed',
};

export type CardAccentColor = 'discussion' | 'voting' | 'refinement' | 'final' | 'completed';

export interface CardProps {
  children: React.ReactNode;
  title?: string;
  accentColor?: CardAccentColor;
  className?: string;
  id?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  accentColor,
  className = '',
  id,
}) => {
  const accentClass = accentColor
    ? `${accentBorderMap[accentColor]} border-2`
    : '';

  return (
    <div id={id} className={`${cardBase} ${accentClass} ${className}`}>
      {title && (
        <div className={cardHeader}>
          <h3 className={cardTitle}>{title}</h3>
        </div>
      )}
      <div className={cardBody}>{children}</div>
    </div>
  );
};
