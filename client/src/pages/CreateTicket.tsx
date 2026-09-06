import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequester } from '../context/RequesterContext.js';
import LoadingSpinner from '../components/LoadingSpinner.js';
import ErrorState from '../components/ErrorState.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Category     { id: number; name: string }
interface RelatedSystem{ id: number; name: string }

interface StagedFile {
  file: File;
  error: string | null;
}

interface FormValues {
  categoryId:        string;
  relatedSystemId:   string;
  requestedPriority: string;
  summary:           string;
  description:       string;
}

interface FieldErrors {
  categoryId?:        string;
  requestedPriority?: string;
  summary?:           string;
  description?:       string;
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_SIZE      = 5 * 1024 * 1024;
const PRIORITIES    = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CreateTicket() {
  const { selectedRequesterId, selectedRequesterName } = useRequester();
  const navigate = useNavigate();

  // Reference data
  const [categories,     setCategories]     = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);
  const [refLoading,     setRefLoading]     = useState(true);
  const [refError,       setRefError]       = useState(false);

  // Form state
  const [values, setValues] = useState<FormValues>({
    categoryId: '', relatedSystemId: '', requestedPriority: 'MEDIUM', summary: '', description: '',
  });
  const [errors,      setErrors]      = useState<FieldErrors>({});
  const [staged,      setStaged]      = useState<StagedFile[]>([]);
  const [attachError, setAttachError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submission state
  type SubmitState = 'idle' | 'submitting' | 'success' | 'api-error' | 'partial-success';
  const [submitState,    setSubmitState]    = useState<SubmitState>('idle');
  const [apiError,       setApiError]       = useState('');
  const [ticketNumber,   setTicketNumber]   = useState('');
  const [ticketId,       setTicketId]       = useState<number | null>(null);
  const [failedFileName, setFailedFileName] = useState('');

  // Load reference data
  async function loadRefData() {
    setRefLoading(true);
    setRefError(false);
    try {
      const [catRes, sysRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/related-systems'),
      ]);
      if (!catRes.ok || !sysRes.ok) throw new Error();
      const [cats, syss] = await Promise.all([
        catRes.json() as Promise<Category[]>,
        sysRes.json() as Promise<RelatedSystem[]>,
      ]);
      setCategories(cats);
      setRelatedSystems(syss);
      if (cats.length > 0) setValues((v) => ({ ...v, categoryId: String(cats[0].id) }));
    } catch {
      setRefError(true);
    } finally {
      setRefLoading(false);
    }
  }

  useEffect(() => { void loadRefData(); }, []);

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------
  function validate(): boolean {
    const errs: FieldErrors = {};
    if (!values.categoryId)                    errs.categoryId        = 'Category is required.';
    if (!values.requestedPriority)             errs.requestedPriority = 'Priority is required.';
    if (!values.summary.trim())                errs.summary           = 'Summary is required.';
    else if (values.summary.trim().length > 200) errs.summary         = 'Summary must not exceed 200 characters.';
    if (!values.description.trim())            errs.description       = 'Description is required.';
    else if (values.description.trim().length > 2000) errs.description = 'Description must not exceed 2000 characters.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ---------------------------------------------------------------------------
  // Attachment staging
  // ---------------------------------------------------------------------------
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (!ALLOWED_TYPES.has(file.type)) {
      setAttachError(`"${file.name}" is not an allowed file type. Allowed: JPG, PNG, WEBP, PDF.`);
      return;
    }
    if (file.size > MAX_SIZE) {
      setAttachError(`"${file.name}" exceeds the 5 MB size limit.`);
      return;
    }
    setAttachError('');
    setStaged((prev) => [...prev, { file, error: null }]);
  }

  function removeStaged(index: number) {
    setStaged((prev) => prev.filter((_, i) => i !== index));
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitState('submitting');
    setApiError('');

    try {
      const body = {
        requesterId:       selectedRequesterId,
        categoryId:        Number(values.categoryId),
        relatedSystemId:   values.relatedSystemId ? Number(values.relatedSystemId) : undefined,
        summary:           values.summary.trim(),
        description:       values.description.trim(),
        requestedPriority: values.requestedPriority,
      };

      const res  = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: { message?: string } };
        throw new Error(data.error?.message ?? 'Submission failed.');
      }

      const ticket = await res.json() as { id: number; ticketNumber: string };
      setTicketId(ticket.id);
      setTicketNumber(ticket.ticketNumber);

      // Upload staged attachments sequentially
      for (const { file } of staged) {
        const fd = new FormData();
        fd.append('requesterId', String(selectedRequesterId));
        fd.append('file', file);
        const attachRes = await fetch(`/api/tickets/${ticket.id}/attachments`, {
          method: 'POST', body: fd,
        });
        if (!attachRes.ok) {
          setFailedFileName(file.name);
          setSubmitState('partial-success');
          return;
        }
      }

      setSubmitState('success');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setSubmitState('api-error');
    }
  }

  function resetForm() {
    setValues({ categoryId: categories[0] ? String(categories[0].id) : '', relatedSystemId: '', requestedPriority: 'MEDIUM', summary: '', description: '' });
    setErrors({}); setStaged([]); setAttachError('');
    setSubmitState('idle'); setApiError(''); setTicketNumber(''); setTicketId(null); setFailedFileName('');
  }

  // ---------------------------------------------------------------------------
  // Render: loading reference data
  // ---------------------------------------------------------------------------
  if (refLoading) {
    return (
      <div>
        <h1 style={h1}>Create Ticket</h1>
        <LoadingSpinner label="Loading reference data…" />
      </div>
    );
  }

  if (refError) {
    return (
      <div>
        <h1 style={h1}>Create Ticket</h1>
        <ErrorState
          data-testid="ref-data-error"
          message="Could not load required data. Please retry."
          onRetry={() => void loadRefData()}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: success
  // ---------------------------------------------------------------------------
  if (submitState === 'success') {
    return (
      <div>
        <h1 style={h1}>Create Ticket</h1>
        <div
          data-testid="success-panel"
          style={{
            backgroundColor: 'var(--color-success-bg)',
            border: '1px solid var(--color-secondary)',
            borderRadius: 'var(--border-radius-control)',
            padding: 'var(--space-xl)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <h2 style={{ color: 'var(--color-success-text)', marginBottom: 8 }}>Ticket Created Successfully</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16 }}>Your ticket number is:</p>
          <p
            data-testid="ticket-number-display"
            style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 24 }}
          >
            {ticketNumber}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate(`/tickets/${ticketId}`)} style={primaryBtn}>View Ticket Detail</button>
            <button onClick={resetForm} style={secondaryBtn}>Create Another Ticket</button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: partial success (ticket saved, attachment failed)
  // ---------------------------------------------------------------------------
  if (submitState === 'partial-success') {
    return (
      <div>
        <h1 style={h1}>Create Ticket</h1>
        <div
          data-testid="partial-success-panel"
          style={{
            backgroundColor: 'var(--color-warning-bg)',
            border: '1px solid var(--color-warning)',
            borderRadius: 'var(--border-radius-control)',
            padding: 'var(--space-xl)',
          }}
        >
          <h2 style={{ color: 'var(--color-warning)', marginBottom: 8 }}>Ticket Saved — Attachment Failed</h2>
          <p>
            Your ticket <strong>{ticketNumber}</strong> was created successfully, but the attachment{' '}
            <strong>"{failedFileName}"</strong> could not be uploaded.
          </p>
          <p>You can add the attachment from the Ticket Detail screen.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
            <button
              data-testid="view-ticket-detail-link"
              onClick={() => navigate(`/tickets/${ticketId}`)}
              style={primaryBtn}
            >
              Go to Ticket Detail
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: form
  // ---------------------------------------------------------------------------
  const isSubmitting = submitState === 'submitting';

  return (
    <div>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{ fontSize: 13, marginBottom: 'var(--space-md)', color: 'var(--color-text-secondary)' }}>
        <button onClick={() => navigate('/tickets')} style={ghostBtn}>My Tickets</button>
        {' > '}
        <span>Create Ticket</span>
      </nav>

      <h1 style={h1}>Create Ticket</h1>

      {/* API error banner */}
      {submitState === 'api-error' && (
        <div
          role="alert"
          data-testid="api-error-banner"
          aria-live="assertive"
          style={{ ...errorBanner, marginBottom: 'var(--space-md)' }}
        >
          {apiError || 'Submission failed. Please try again.'}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate data-testid="create-ticket-form">
        {/* Read-only system fields */}
        <div style={sectionCard}>
          <div style={grid3}>
            <ReadOnly label="Ticket Number" value="(auto-generated)" />
            <ReadOnly label="Ticket Date"   value="(auto)" />
            <ReadOnly label="Requester"     value={selectedRequesterName ?? ''} />
          </div>
        </div>

        {/* Classification */}
        <div style={sectionCard}>
          <div style={grid3}>
            {/* Category */}
            <div>
              <label htmlFor="categoryId" style={labelStyle}>
                Category <span style={asterisk} aria-hidden="true">*</span>
              </label>
              <select
                id="categoryId"
                data-testid="category-select"
                value={values.categoryId}
                onChange={(e) => setValues((v) => ({ ...v, categoryId: e.target.value }))}
                disabled={isSubmitting}
                aria-required="true"
                aria-describedby={errors.categoryId ? 'category-error' : undefined}
                style={{ ...inputStyle, borderColor: errors.categoryId ? 'var(--color-error)' : undefined }}
              >
                <option value="">Select category…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.categoryId && <p id="category-error" style={errorMsg} role="alert">{errors.categoryId}</p>}
            </div>

            {/* Related System */}
            <div>
              <label htmlFor="relatedSystemId" style={labelStyle}>Related System</label>
              <select
                id="relatedSystemId"
                data-testid="related-system-select"
                value={values.relatedSystemId}
                onChange={(e) => setValues((v) => ({ ...v, relatedSystemId: e.target.value }))}
                disabled={isSubmitting}
                style={inputStyle}
              >
                <option value="">None</option>
                {relatedSystems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label htmlFor="requestedPriority" style={labelStyle}>
                Requested Priority <span style={asterisk} aria-hidden="true">*</span>
              </label>
              <select
                id="requestedPriority"
                data-testid="priority-select"
                value={values.requestedPriority}
                onChange={(e) => setValues((v) => ({ ...v, requestedPriority: e.target.value }))}
                disabled={isSubmitting}
                aria-required="true"
                style={inputStyle}
              >
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div style={sectionCard}>
          <label htmlFor="summary" style={labelStyle}>
            Summary <span style={asterisk} aria-hidden="true">*</span>
          </label>
          <input
            id="summary"
            type="text"
            data-testid="summary-input"
            value={values.summary}
            onChange={(e) => setValues((v) => ({ ...v, summary: e.target.value }))}
            maxLength={210}
            disabled={isSubmitting}
            aria-required="true"
            aria-describedby={errors.summary ? 'summary-error' : undefined}
            style={{
              ...inputStyle, width: '100%', boxSizing: 'border-box',
              borderColor: errors.summary ? 'var(--color-error)' : undefined,
              backgroundColor: errors.summary ? 'var(--color-error-bg)' : undefined,
            }}
          />
          {errors.summary && (
            <p id="summary-error" data-testid="summary-error" style={errorMsg} role="alert">
              {errors.summary}
            </p>
          )}
        </div>

        {/* Description */}
        <div style={sectionCard}>
          <label htmlFor="description" style={labelStyle}>
            Description <span style={asterisk} aria-hidden="true">*</span>
          </label>
          <textarea
            id="description"
            data-testid="description-input"
            value={values.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            rows={5}
            disabled={isSubmitting}
            aria-required="true"
            aria-describedby={errors.description ? 'description-error' : undefined}
            style={{
              ...inputStyle, width: '100%', boxSizing: 'border-box', height: 'auto',
              minHeight: 120, resize: 'vertical',
              borderColor: errors.description ? 'var(--color-error)' : undefined,
              backgroundColor: errors.description ? 'var(--color-error-bg)' : undefined,
            }}
          />
          {errors.description && (
            <p id="description-error" data-testid="description-error" style={errorMsg} role="alert">
              {errors.description}
            </p>
          )}
        </div>

        {/* Attachments */}
        <div style={sectionCard}>
          <p style={{ ...labelStyle, marginBottom: 'var(--space-sm)' }}>Attachments</p>
          <div
            style={{
              border: '2px dashed var(--color-border)',
              borderRadius: 'var(--border-radius-control)',
              padding: 'var(--space-lg)',
              textAlign: 'center',
              backgroundColor: 'var(--color-page-bg)',
              marginBottom: 'var(--space-sm)',
            }}
          >
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, margin: '0 0 8px' }}>
              📎 Drag and drop files here, or{' '}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{ ...ghostBtn, textDecoration: 'underline' }}
              >
                Browse
              </button>
            </p>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 12, margin: 0 }}>
              Allowed: JPG, PNG, WEBP, PDF · Max 5 MB each
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            aria-label="Attach file"
            data-testid="file-input"
          />
          {attachError && (
            <p data-testid="attachment-error" style={errorMsg} role="alert">{attachError}</p>
          )}
          {staged.map(({ file }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13 }}>
              <span>📄 {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
              <button
                type="button"
                onClick={() => removeStaged(i)}
                aria-label={`Remove ${file.name}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', fontWeight: 700 }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 'var(--space-lg)' }}>
          <button type="button" onClick={() => navigate('/tickets')} style={secondaryBtn} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="submit"
            data-testid="submit-btn"
            disabled={isSubmitting}
            aria-disabled={isSubmitting}
            style={{ ...primaryBtn, opacity: isSubmitting ? 0.75 : 1 }}
          >
            {isSubmitting ? (
              <>
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block', width: 14, height: 14,
                    border: '2px solid rgba(255,255,255,0.4)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'tkt-spin 0.7s linear infinite',
                    marginRight: 6,
                    verticalAlign: 'middle',
                  }}
                />
                Submitting…
              </>
            ) : 'Submit Ticket →'}
          </button>
        </div>
        <style>{`@keyframes tkt-spin { to { transform: rotate(360deg); } }`}</style>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div
        style={{
          height: 'var(--input-height)',
          lineHeight: 'var(--input-height)',
          padding: '0 var(--space-sm)',
          borderRadius: 'var(--border-radius-control)',
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-readonly-bg)',
          fontSize: 14,
          color: 'var(--color-text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------
const h1: React.CSSProperties = { fontSize: 24, fontWeight: 700, marginBottom: 'var(--space-lg)' };

const sectionCard: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--border-radius-control)',
  padding: 'var(--space-lg)',
  marginBottom: 'var(--space-md)',
};

const grid3: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 'var(--space-md)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 500,
  fontSize: 14,
  marginBottom: 4,
  color: 'var(--color-text-primary)',
};

const asterisk: React.CSSProperties = { color: 'var(--color-error)', marginLeft: 2 };

const inputStyle: React.CSSProperties = {
  height: 'var(--input-height)',
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid var(--color-editable-border)',
  borderRadius: 'var(--border-radius-control)',
  backgroundColor: 'var(--color-editable-bg)',
  padding: '0 var(--space-sm)',
  fontSize: 14,
  color: 'var(--color-text-primary)',
};

const errorMsg: React.CSSProperties = {
  color: 'var(--color-error)',
  fontSize: 13,
  marginTop: 4,
  marginBottom: 0,
};

const errorBanner: React.CSSProperties = {
  backgroundColor: 'var(--color-error-bg)',
  border: '1px solid var(--color-error)',
  borderRadius: 'var(--border-radius-control)',
  padding: 'var(--space-md)',
  color: 'var(--color-error)',
  fontSize: 14,
};

const primaryBtn: React.CSSProperties = {
  height: 'var(--button-height)',
  padding: '0 var(--space-lg)',
  borderRadius: 'var(--border-radius-control)',
  border: 'none',
  backgroundColor: 'var(--color-primary)',
  color: '#fff',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
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

const ghostBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--color-secondary)',
  fontSize: 'inherit',
  padding: 0,
};
