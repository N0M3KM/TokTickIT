import React, { useRef, useState } from 'react';
import Badge from './Badge.js';
import ConfirmDialog from './ConfirmDialog.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface Attachment {
  id: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  removedAt: string | null;
  removalReason: string | null;
}

interface AttachmentSectionProps {
  ticketId: number;
  requesterId: number;
  attachments: Attachment[];
  onAttachmentsChange: (updated: Attachment[]) => void;
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_SIZE      = 5 * 1024 * 1024;
const MAX_ACTIVE    = 5;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AttachmentSection({
  ticketId, requesterId, attachments, onAttachmentsChange,
}: AttachmentSectionProps) {
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [removeTarget, setRemoveTarget] = useState<Attachment | null>(null);
  const [removalReason, setRemovalReason] = useState('');
  const [removeError,   setRemoveError]   = useState('');

  const active  = attachments.filter((a) => !a.removedAt);
  const atLimit = active.length >= MAX_ACTIVE;

  // ---------------------------------------------------------------------------
  // Upload
  // ---------------------------------------------------------------------------
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    setUploadError('');

    if (!ALLOWED_TYPES.has(file.type)) {
      setUploadError(`"${file.name}" is not an allowed file type. Allowed: JPG, PNG, WEBP, PDF.`);
      return;
    }
    if (file.size > MAX_SIZE) {
      setUploadError(`"${file.name}" exceeds the 5 MB size limit.`);
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('requesterId', String(requesterId));
      fd.append('file', file);
      const res = await fetch(`/api/tickets/${ticketId}/attachments`, { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json() as { error?: { message?: string } };
        throw new Error(data.error?.message ?? 'Upload failed.');
      }
      const newAttachment = await res.json() as Attachment;
      onAttachmentsChange([...attachments, newAttachment]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Download
  // ---------------------------------------------------------------------------
  function handleDownload(attachment: Attachment) {
    const url = `/api/tickets/${ticketId}/attachments/${attachment.id}/download?requesterId=${requesterId}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // ---------------------------------------------------------------------------
  // Soft-remove
  // ---------------------------------------------------------------------------
  async function handleConfirmRemove() {
    if (!removeTarget || !removalReason.trim()) return;
    setRemoveError('');
    try {
      const res = await fetch(`/api/tickets/${ticketId}/attachments/${removeTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId, removalReason: removalReason.trim() }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: { message?: string } };
        throw new Error(data.error?.message ?? 'Removal failed.');
      }
      const updated = await res.json() as Attachment;
      onAttachmentsChange(attachments.map((a) => (a.id === updated.id ? updated : a)));
      setRemoveTarget(null);
      setRemovalReason('');
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Removal failed.');
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <section aria-labelledby="attachments-heading">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 id="attachments-heading" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
          Attachments ({active.length})
        </h3>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={atLimit || uploading}
          data-testid="add-attachment-btn"
          title={atLimit ? 'Maximum of 5 attachments reached' : 'Add attachment'}
          aria-label={atLimit ? 'Maximum of 5 attachments reached' : 'Add attachment'}
          style={{
            height: 36,
            padding: '0 16px',
            borderRadius: 6,
            border: 'none',
            backgroundColor: atLimit || uploading ? 'var(--color-disabled-bg)' : 'var(--color-primary)',
            color: atLimit || uploading ? 'var(--color-text-disabled)' : '#fff',
            fontWeight: 500,
            fontSize: 13,
            cursor: atLimit || uploading ? 'not-allowed' : 'pointer',
          }}
        >
          + Add Attachment
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          data-testid="attachment-file-input"
        />
      </div>

      {uploading && (
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
          Uploading…
        </p>
      )}

      {uploadError && (
        <p
          role="alert"
          data-testid="upload-error"
          style={{ color: 'var(--color-error)', fontSize: 13, marginBottom: 8 }}
        >
          {uploadError}
        </p>
      )}

      {/* Attachment list */}
      {attachments.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>No attachments yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {attachments.map((a) => (
            <li
              key={a.id}
              data-testid={`attachment-row-${a.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                marginBottom: 6,
                backgroundColor: 'var(--color-surface)',
                opacity: a.removedAt ? 0.6 : 1,
              }}
            >
              <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                📄 {a.originalFilename}
                <span style={{ color: 'var(--color-text-secondary)', marginLeft: 8 }}>
                  {(a.sizeBytes / 1024 / 1024).toFixed(1)} MB · {a.mimeType}
                </span>
              </span>

              {a.removedAt ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <Badge variant="Removed" data-testid={`removed-badge-${a.id}`} />
                  {a.removalReason && (
                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                      Reason: {a.removalReason}
                    </span>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleDownload(a)}
                    data-testid={`download-btn-${a.id}`}
                    aria-label={`Download ${a.originalFilename}`}
                    style={actionBtn}
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRemoveTarget(a); setRemovalReason(''); setRemoveError(''); }}
                    data-testid={`remove-btn-${a.id}`}
                    aria-label={`Remove ${a.originalFilename}`}
                    style={{ ...actionBtn, backgroundColor: '#DC2626', borderColor: '#DC2626' }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Soft-remove confirmation dialog */}
      {removeTarget && (
        <ConfirmDialog
          title="Remove Attachment"
          confirmLabel="Confirm Remove"
          confirmDisabled={!removalReason.trim()}
          destructive
          onConfirm={() => void handleConfirmRemove()}
          onCancel={() => { setRemoveTarget(null); setRemovalReason(''); setRemoveError(''); }}
        >
          <p style={{ marginBottom: 12, fontSize: 14 }}>
            Are you sure you want to remove <strong>"{removeTarget.originalFilename}"</strong>?
          </p>
          <label htmlFor="removal-reason" style={{ display: 'block', fontWeight: 500, fontSize: 14, marginBottom: 4 }}>
            Removal Reason <span style={{ color: 'var(--color-error)' }} aria-hidden="true">*</span>
          </label>
          <input
            id="removal-reason"
            type="text"
            value={removalReason}
            onChange={(e) => setRemovalReason(e.target.value)}
            placeholder="Enter reason for removal…"
            data-testid="removal-reason-input"
            aria-required="true"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              height: 40,
              border: '1px solid var(--color-editable-border)',
              borderRadius: 6,
              padding: '0 8px',
              fontSize: 14,
            }}
          />
          {removeError && (
            <p role="alert" style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 4 }}>{removeError}</p>
          )}
          <p style={{ fontSize: 12, color: 'var(--color-warning)', marginTop: 8 }}>
            ⚠ This action cannot be undone. The file will no longer be downloadable.
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}

const actionBtn: React.CSSProperties = {
  height: 30,
  padding: '0 10px',
  borderRadius: 4,
  border: '1px solid var(--color-primary)',
  backgroundColor: '#fff',
  color: 'var(--color-primary)',
  fontSize: 12,
  cursor: 'pointer',
};
