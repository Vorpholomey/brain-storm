import React from 'react';
import type { LucideIcon } from 'lucide-react';

const inputBase =
  'w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

const inputWithError = 'border-danger focus-visible:border-danger focus-visible:ring-danger';

const inputWithIcon = 'pl-4';

const labelBase = 'block text-sm font-medium text-neutral-700 mb-1';

const errorText = 'text-sm text-danger mt-1';

const hintText = 'text-sm text-neutral-500 mt-1';

export interface InputProps {
  label?: string;
  error?: string;
  hint?: string;
  icon?: LucideIcon;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  disabled?: boolean;
  name?: string;
  id?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  icon: Icon,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  name,
  id,
}) => {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className={labelBase}>
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            <Icon size={16} />
          </div>
        )}
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`${inputBase} ${error ? inputWithError : ''} ${Icon ? inputWithIcon : ''}`}
        />
      </div>
      {error && <p className={errorText}>{error}</p>}
      {!error && hint && <p className={hintText}>{hint}</p>}
    </div>
  );
};
