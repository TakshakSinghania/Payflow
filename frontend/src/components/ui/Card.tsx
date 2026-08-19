import React from 'react';

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-surface rounded-lg border border-border overflow-hidden ${className}`}>
    {children}
  </div>
);
