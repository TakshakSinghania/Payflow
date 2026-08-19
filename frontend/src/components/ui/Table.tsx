import React from 'react';

export const Table: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="w-full overflow-x-auto rounded-lg border border-border">
    <table className="w-full text-left border-collapse bg-surface">
      {children}
    </table>
  </div>
);

export const Th: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <th className={`px-6 py-3 border-b border-border bg-background/50 text-xs font-medium text-muted uppercase tracking-wider ${className}`}>
    {children}
  </th>
);

export const Td: React.FC<{ children: React.ReactNode; className?: string; colSpan?: number }> = ({ children, className = '', colSpan }) => (
  <td colSpan={colSpan} className={`px-6 py-4 border-b border-border text-sm text-text whitespace-nowrap ${className}`}>
    {children}
  </td>
);
