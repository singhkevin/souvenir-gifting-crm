import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'accent';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  default:
    'bg-primary text-primary-fg hover:bg-primary-light hover:text-primary-fg active:bg-[#1A130B] active:text-primary-fg',
  accent:
    'bg-accent text-accent-fg hover:bg-accent-hover hover:text-accent-fg active:bg-[#1a130b] active:text-accent-fg',
  outline:
    'border border-border bg-white text-text hover:bg-surface-subtle hover:text-text active:bg-muted',
  ghost:
    'bg-transparent text-text hover:bg-surface-subtle hover:text-text active:bg-muted',
  secondary:
    'bg-muted text-text hover:bg-[#DDD6CB] hover:text-text active:bg-[#d0c8bb]',
  destructive:
    'bg-red-600 text-white hover:bg-red-700 hover:text-white active:bg-red-800 active:text-white',
  link:
    'bg-transparent text-primary underline-offset-4 hover:underline hover:text-primary-light',
}

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  default: 'h-9 px-4 py-2 text-sm',
  sm: 'h-8 px-3 text-xs',
  lg: 'h-10 px-8 text-base',
  icon: 'h-9 w-9 p-0',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', loading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:pointer-events-none',
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <>
            <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
            <span className="sr-only">Loading</span>
            {children}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);
Button.displayName = "Button";
