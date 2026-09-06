/**
 * ErrorState — full-panel error display with optional retry.
 * ui-spec.md §5.8
 */
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  'data-testid'?: string;
}

export default function ErrorState({ message, onRetry, 'data-testid': testId }: ErrorStateProps) {
  return (
    <div
      role="alert"
      data-testid={testId ?? 'error-state'}
      style={{
        backgroundColor: 'var(--color-error-bg)',
        border: '1px solid var(--color-error)',
        borderRadius: 'var(--border-radius-control)',
        padding: 'var(--space-lg)',
        textAlign: 'center',
        color: 'var(--color-error)',
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 8 }} aria-hidden="true">⚠️</div>
      <p style={{ margin: '0 0 12px', fontSize: 14 }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          data-testid="retry-btn"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--border-radius-control)',
            padding: '8px 20px',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
