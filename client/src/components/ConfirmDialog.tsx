import React, { useEffect, useRef } from 'react';

/**
 * ConfirmDialog — modal with focus trap and Escape key handling.
 * ui-spec.md §5 (Soft-Remove Confirmation Dialog)
 */
interface ConfirmDialogProps {
  title: string;
  children: React.ReactNode;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  children,
  confirmLabel = 'Confirm',
  confirmDisabled = false,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus first focusable element when dialog opens
  useEffect(() => {
    const el = dialogRef.current?.querySelector<HTMLElement>('button, input, textarea, select');
    el?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          zIndex: 200,
        }}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 201,
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--border-radius-control)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          padding: 'var(--space-xl)',
          width: '100%',
          maxWidth: 440,
        }}
      >
        <h3
          id="confirm-dialog-title"
          style={{ margin: '0 0 var(--space-md)', fontSize: 16, fontWeight: 600 }}
        >
          {title}
        </h3>

        <div style={{ marginBottom: 'var(--space-lg)' }}>{children}</div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)' }}>
          <button
            onClick={onCancel}
            data-testid="dialog-cancel-btn"
            style={{
              height: 'var(--button-height)',
              padding: '0 var(--space-lg)',
              borderRadius: 'var(--border-radius-control)',
              border: '1px solid var(--color-primary)',
              backgroundColor: '#fff',
              color: 'var(--color-primary)',
              fontWeight: 500,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            data-testid="dialog-confirm-btn"
            style={{
              height: 'var(--button-height)',
              padding: '0 var(--space-lg)',
              borderRadius: 'var(--border-radius-control)',
              border: 'none',
              backgroundColor: confirmDisabled
                ? 'var(--color-disabled-bg)'
                : destructive ? '#DC2626' : 'var(--color-primary)',
              color: confirmDisabled ? 'var(--color-text-disabled)' : '#fff',
              fontWeight: 600,
              fontSize: 14,
              cursor: confirmDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
