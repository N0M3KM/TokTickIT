import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequester } from '../context/RequesterContext.js';

interface DevRequester {
  id: number;
  name: string;
  email: string;
}

type LoadState = 'loading' | 'loaded' | 'empty' | 'error';

/**
 * Development Requester Selection screen.
 * This is NOT a login screen — it is a Lab 2 testing mechanism only.
 * ui-spec.md §7, BR-03, BR-04, BR-05, AC-19, AC-20, FR-01
 */
export default function RequesterSelector() {
  const { setRequester } = useRequester();
  const navigate = useNavigate();

  const [loadState, setLoadState]     = useState<LoadState>('loading');
  const [requesters, setRequesters]   = useState<DevRequester[]>([]);
  const [selectedId, setSelectedId]   = useState<number | null>(null);
  const [errorMsg, setErrorMsg]       = useState('');

  async function fetchRequesters() {
    setLoadState('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/requesters');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as DevRequester[];
      if (data.length === 0) {
        setLoadState('empty');
      } else {
        setRequesters(data);
        setSelectedId(data[0].id);   // auto-select first item
        setLoadState('loaded');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setLoadState('error');
    }
  }

  useEffect(() => { void fetchRequesters(); }, []);

  function handleContinue() {
    const requester = requesters.find((r) => r.id === selectedId);
    if (!requester) return;
    setRequester(requester.id, requester.name);
    navigate('/tickets', { replace: true });
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-page-bg)',
        padding: 'var(--space-xl) var(--space-lg)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--border-radius-control)',
          boxShadow: '0 4px 16px var(--color-shadow)',
          padding: 'var(--space-xl)',
        }}
      >
        {/* Icon */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-md)' }}>
          <span
            style={{ fontSize: 48, color: 'var(--color-primary)', lineHeight: 1 }}
            role="img"
            aria-label="Development requester settings"
          >
            👤
          </span>
        </div>

        {/* Title */}
        <h2
          style={{
            textAlign: 'center',
            color: 'var(--color-text-primary)',
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 'var(--space-sm)',
          }}
        >
          Select Development Requester
        </h2>

        {/* Explanation */}
        <p
          style={{
            textAlign: 'center',
            color: 'var(--color-text-secondary)',
            fontSize: 13,
            marginBottom: 'var(--space-lg)',
          }}
        >
          Choose a development requester to simulate the current requester context
          for Lab 2. <strong>This is not a login screen.</strong> Authentication and
          role-based access will be introduced in Lab 3.
        </p>

        {/* Loading state */}
        {loadState === 'loading' && (
          <div
            role="status"
            aria-live="polite"
            style={{ textAlign: 'center', padding: 'var(--space-lg) 0', color: 'var(--color-text-secondary)' }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 20,
                height: 20,
                border: '2px solid var(--color-border)',
                borderTopColor: 'var(--color-primary)',
                borderRadius: '50%',
                animation: 'tkt-spin 0.7s linear infinite',
                marginBottom: 'var(--space-sm)',
              }}
              aria-hidden="true"
            />
            <p style={{ margin: 0, fontSize: 13 }}>Loading requesters…</p>
          </div>
        )}

        {/* Error state */}
        {loadState === 'error' && (
          <div
            role="alert"
            data-testid="selector-error"
            style={{
              backgroundColor: 'var(--color-error-bg)',
              border: '1px solid var(--color-error)',
              borderRadius: 'var(--border-radius-control)',
              padding: 'var(--space-md)',
              marginBottom: 'var(--space-md)',
              color: 'var(--color-error)',
              fontSize: 13,
            }}
          >
            <strong>Could not load requesters.</strong>{' '}
            {errorMsg && <span>({errorMsg})</span>}
            <div style={{ marginTop: 'var(--space-sm)' }}>
              <button
                onClick={() => void fetchRequesters()}
                data-testid="retry-btn"
                style={primaryBtnStyle(false)}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {loadState === 'empty' && (
          <div
            role="status"
            data-testid="selector-empty"
            style={{
              backgroundColor: 'var(--color-readonly-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--border-radius-control)',
              padding: 'var(--space-md)',
              marginBottom: 'var(--space-md)',
              color: 'var(--color-text-secondary)',
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            No active requesters found. Please contact your administrator.
          </div>
        )}

        {/* Loaded state — dropdown */}
        {loadState === 'loaded' && (
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <label
              htmlFor="requester-select"
              style={{ display: 'block', fontWeight: 500, marginBottom: 'var(--space-xs)', fontSize: 14 }}
            >
              Development Requester{' '}
              <span style={{ color: 'var(--color-error)', marginLeft: 2 }} aria-hidden="true">*</span>
            </label>
            <select
              id="requester-select"
              data-testid="requester-dropdown"
              value={selectedId ?? ''}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              aria-required="true"
              style={{
                width: '100%',
                height: 'var(--input-height)',
                borderRadius: 'var(--border-radius-control)',
                border: '1px solid var(--color-editable-border)',
                backgroundColor: 'var(--color-editable-bg)',
                padding: '0 var(--space-sm)',
                fontSize: 14,
                color: 'var(--color-text-primary)',
              }}
            >
              {requesters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            {/* Info note */}
            <p style={{ marginTop: 'var(--space-xs)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
              ⓘ Only active development requesters are shown.
            </p>
          </div>
        )}

        {/* Lab 3 notice box */}
        <div
          style={{
            backgroundColor: 'var(--color-pale-green)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--border-radius-control)',
            padding: 'var(--space-sm) var(--space-md)',
            marginBottom: 'var(--space-lg)',
            fontSize: 12,
            color: 'var(--color-text-secondary)',
          }}
        >
          🔒 <strong>Authentication coming in Lab 3.</strong> In Lab 3, this selector
          will be replaced with secure authentication so you can access the system with
          your own account.
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)' }}>
          <button
            onClick={() => navigate(-1)}
            style={secondaryBtnStyle}
          >
            Cancel
          </button>
          <button
            onClick={handleContinue}
            data-testid="continue-btn"
            disabled={loadState !== 'loaded' || selectedId === null}
            aria-disabled={loadState !== 'loaded' || selectedId === null}
            style={primaryBtnStyle(loadState !== 'loaded' || selectedId === null)}
          >
            Continue →
          </button>
        </div>
      </div>

      {/* Keyframe for spinner */}
      <style>{`
        @keyframes tkt-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Button style helpers
// ---------------------------------------------------------------------------
function primaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    height: 'var(--button-height)',
    padding: '0 var(--space-lg)',
    borderRadius: 'var(--border-radius-control)',
    border: 'none',
    backgroundColor: disabled ? 'var(--color-disabled-bg)' : 'var(--color-primary)',
    color: disabled ? 'var(--color-text-disabled)' : '#fff',
    fontWeight: 600,
    fontSize: 14,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

const secondaryBtnStyle: React.CSSProperties = {
  height: 'var(--button-height)',
  padding: '0 var(--space-lg)',
  borderRadius: 'var(--border-radius-control)',
  border: '1px solid var(--color-primary)',
  backgroundColor: '#fff',
  color: 'var(--color-primary)',
  fontWeight: 500,
  fontSize: 14,
  cursor: 'pointer',
};
