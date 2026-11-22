import React from 'react';
import { Loader2 } from 'lucide-react';

const btnBase =
  'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

const btnVariants = {
  primary:
    'bg-primary text-white hover:bg-primary-hover active:bg-primary-hover',
  secondary:
    'bg-neutral-100 text-neutral-800 hover:bg-neutral-200 active:bg-neutral-200',
  ghost: 'bg-transparent text-neutral-700 hover:bg-neutral-100 active:bg-neutral-100',
  danger: 'bg-danger text-white hover:opacity-90 active:opacity-80',
};

const btnSizes = {
  sm: 'text-xs px-2 py-1 gap-1',
  md: 'text-sm px-3 py-2 gap-2',
  lg: 'text-base px-4 py-3 gap-2',
};

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
  title?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: boolean | 'true' | 'false' | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit' | 'reset';
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  className = '',
  title,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedby,
  'aria-expanded': ariaExpanded,
  'aria-haspopup': ariaHaspopup,
  children,
  onClick,
  type = 'button',
}) => {
  return (
    <button
      type={type}
      title={title}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedby}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHaspopup}
      className={`${btnBase} ${btnVariants[variant]} ${btnSizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading && <Loader2 className="animate-spin" size={16} />}
      {children}
    </button>
  );
};
