import React from 'react';

/**
 * Badge — priority, status, and attachment state labels.
 * ui-spec.md §5.5
 */
export type BadgeVariant =
  | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  | 'NEW' | 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_REQUESTER' | 'RESOLVED' | 'CLOSED' | 'REOPENED' | 'CANCELLED'
  | 'Active' | 'Removed';

const BADGE_STYLES: Record<BadgeVariant, React.CSSProperties> = {
  LOW:      { backgroundColor: '#DBEAFE', color: '#1D4ED8' },
  MEDIUM:   { backgroundColor: '#FEF3C7', color: '#92400E' },
  HIGH:     { backgroundColor: '#FEE2E2', color: '#991B1B' },
  CRITICAL: { backgroundColor: '#F3E8FF', color: '#6B21A8' },
  NEW:      { backgroundColor: '#E0F2FE', color: '#0369A1' },
  OPEN: { backgroundColor: 'var(--badge-open-bg)', color: 'var(--badge-open-text)' },
  IN_PROGRESS: { backgroundColor: 'var(--badge-progress-bg)', color: 'var(--badge-progress-text)' },
  WAITING_FOR_REQUESTER: { backgroundColor: 'var(--badge-admin-bg)', color: 'var(--badge-admin-text)' },
  RESOLVED: { backgroundColor: 'var(--badge-staff-bg)', color: 'var(--badge-staff-text)' },
  CLOSED: { backgroundColor: 'var(--badge-closed-bg)', color: 'var(--badge-closed-text)' },
  REOPENED: { backgroundColor: 'var(--badge-reopened-bg)', color: 'var(--badge-reopened-text)' },
  CANCELLED: { backgroundColor: 'var(--badge-closed-bg)', color: 'var(--badge-cancelled-text)' },
  Active:   { backgroundColor: 'var(--color-pale-green)', color: 'var(--color-success-text)' },
  Removed:  { backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
};

interface BadgeProps {
  variant: BadgeVariant;
  label?: string;
  'data-testid'?: string;
}

export default function Badge({ variant, label, 'data-testid': testId }: BadgeProps) {
  return (
    <span
      data-testid={testId}
      style={{
        ...BADGE_STYLES[variant],
        borderRadius: 12,
        padding: '2px 8px',
        fontSize: 12,
        fontWeight: 500,
        display: 'inline-block',
        whiteSpace: 'nowrap',
      }}
    >
      {label ?? variant.replace(/_/g, ' ')}
    </span>
  );
}
