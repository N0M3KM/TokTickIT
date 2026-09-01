/**
 * LoadingSpinner — centered inline spinner.
 * ui-spec.md §5.6
 */
export default function LoadingSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 32 }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: 20,
          height: 20,
          border: '2px solid var(--color-border)',
          borderTopColor: 'var(--color-primary)',
          borderRadius: '50%',
          animation: 'tkt-spin 0.7s linear infinite',
        }}
      />
      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{label}</span>
      <style>{`@keyframes tkt-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
