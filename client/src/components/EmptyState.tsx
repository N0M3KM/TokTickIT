import React from 'react';

/**
 * EmptyState — used for empty lists and no-results states.
 * ui-spec.md §5.7
 */
interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  'data-testid'?: string;
}

export default function EmptyState({ title, description, action, 'data-testid': testId }: EmptyStateProps) {
  return (
    <div
      data-testid={testId ?? 'empty-state'}
      style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--color-text-secondary)' }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">📭</div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8 }}>
        {title}
      </h3>
      {description && <p style={{ fontSize: 14, marginBottom: 16 }}>{description}</p>}
      {action}
    </div>
  );
}
