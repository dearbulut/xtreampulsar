'use client';

import { forwardRef } from 'react';
import { clsx } from 'clsx';

type Variant = 'primary' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 text-white font-semibold ' +
    'hover:opacity-90 active:scale-95 shadow-lg shadow-indigo-500/25',
  outline:
    'border border-border text-text-base hover:border-primary hover:text-primary ' +
    'hover:bg-primary/5 active:scale-95',
  ghost:
    'text-text-muted hover:text-text-base hover:bg-surface-2 active:scale-95',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-5 py-2.5 text-sm rounded-xl',
  lg: 'px-7 py-3.5 text-base rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
