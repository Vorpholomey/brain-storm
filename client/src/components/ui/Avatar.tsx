import React from 'react';

const avatarBase =
  'inline-flex items-center justify-center rounded-md font-medium text-white flex-shrink-0';

const avatarSizes: Record<string, { className: string; textSize: string }> = {
  sm: { className: 'w-8 h-8', textSize: 'text-xs' },
  md: { className: 'w-10 h-10', textSize: 'text-sm' },
  lg: { className: 'w-12 h-12', textSize: 'text-base' },
};

const avatarColors = [
  'bg-stage-discussion',
  'bg-stage-voting',
  'bg-stage-refinement',
  'bg-stage-final',
  'bg-stage-completed',
  'bg-neutral-600',
  'bg-neutral-700',
  'bg-neutral-800',
];

const overflowBadge =
  'inline-flex items-center justify-center rounded-md bg-neutral-400 text-white text-xs font-medium w-8 h-8 -ml-2 first:ml-0';

function getColorIndex(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % avatarColors.length;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0]?.slice(0, 2).toUpperCase() ?? '?';
}

export interface AvatarProps {
  userId: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Avatar: React.FC<AvatarProps> = ({
  userId,
  name,
  size = 'md',
}) => {
  const colorClass = avatarColors[getColorIndex(userId)];
  const { className: sizeClass, textSize } = avatarSizes[size];

  return (
    <span
      className={`${avatarBase} ${sizeClass} ${textSize} ${colorClass}`}
      title={name}
    >
      {getInitials(name)}
    </span>
  );
};

export interface AvatarItem {
  userId: string;
  name: string;
}

export interface AvatarGroupProps {
  avatars: AvatarItem[];
  max?: number;
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  avatars,
  max = 4,
}) => {
  const visible = avatars.slice(0, max);
  const overflow = avatars.length - max;

  return (
    <div className="flex items-center -ml-2">
      {visible.map((item) => (
        <Avatar key={item.userId} userId={item.userId} name={item.name} size="sm" />
      ))}
      {overflow > 0 && (
        <span className={overflowBadge}>+{overflow}</span>
      )}
    </div>
  );
};
