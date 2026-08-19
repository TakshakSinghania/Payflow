import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'default';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', className, children, ...props }) => {
  const variants = {
    success: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
    danger: 'bg-red-500/10 text-red-500 border border-red-500/20',
    warning: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
    info: 'bg-blue-500/10 text-blue-500 border border-blue-500/20',
    default: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
