import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRequester } from '../context/RequesterContext.js';
import Badge, { type BadgeVariant } from '../components/Badge.js';
import LoadingSpinner from '../components/LoadingSpinner.js';
import ErrorState from '../components/ErrorState.js';
import AttachmentSection, { type Attachment } from '../components/AttachmentSection.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TicketDetail {
  id: number;
  ticketNumber: string;
  requesterId: number;
  requesterName: string;
  categoryId: number;
  categoryName: string;
  relatedSystemId: number | null;
  relatedSystemName: string | null;
  summary: string;
  description: string;
  requestedPriority: string;
  currentStatus: string;
  ticketDate: string;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function TicketDetail() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedRequesterId } = useRequester();

  const [ticket,  setTicket]  = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<'not-found' | 'forbidden' | 'general' | null>(null);

  async function fetchTicket() {
    if (!selectedRequesterId || !id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${id}?requesterId=${selectedRequesterId}`);
      if (res.status === 403) { setError('forbidden'); return; }
      if (res.status === 404) { setError('not-found'); return; }
      if (!res.ok)            { setError('general');   return; }
      setTicket(await res.json() as TicketDetail);
    } catch {
      setError('general');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchTicket(); }, [id, selectedRequesterId]);

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------
  if (loading) return <LoadingSpinner label="Loading ticket…" />;

  if (error === 'forbidden') {
    return (
      <div>
        <BackBtn onBack={() => navigate('/tickets')} />
        <ErrorState
          data-testid="forbidden-error"
          message="You do not have permission to view this ticket."
        />
      </div>
    );
  }

  if (error === 'not-found') {
    return (
      <div>
        <BackBtn onBack={() => navigate('/tickets')} />
        <ErrorState data-testid="not-found-error" message="Ticket not found." />
      </div>
    );
  }

  if (error === 'general' || !ticket) {
    return (
      <div>
        <BackBtn onBack={() => navigate('/tickets')} />
        <ErrorState
          data-testid="general-error"
          message="Could not load ticket. Please try again."
          onRetry={() => void fetchTicket()}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render ticket
  // ---------------------------------------------------------------------------
  return (
    <div>
      {/* Breadcrumb + back */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
        <nav aria-label="Breadcrumb" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <button onClick={() => navigate('/tickets')} style={ghostBtn}>My Tickets</button>
          {' > Ticket Details'}
        </nav>
        <button onClick={() => navigate('/tickets')} style={secondaryBtn} data-testid="back-btn">
          ← Back to My Tickets
        </button>
      </div>

      {/* Ticket header */}
      <div style={card}>
        <div style={grid4}>
          <ReadOnly label="Ticket No."       value={<strong style={{ color: 'var(--color-primary)' }}>{ticket.ticketNumber}</strong>} />
          <ReadOnly label="Ticket Date"      value={fmtDate(ticket.ticketDate)} />
          <ReadOnly label="Category"         value={ticket.categoryName} />
          <ReadOnly label="Related System"   value={ticket.relatedSystemName ?? '—'} />
          <ReadOnly label="Requester"        value={ticket.requesterName} />
          <ReadOnly label="Req. Priority"    value={<Badge variant={ticket.requestedPriority as BadgeVariant} />} />
          <ReadOnly label="Current Status"   value={<Badge variant={ticket.currentStatus as BadgeVariant} />} />
        </div>
      </div>

      {/* Summary */}
      <div style={card}>
        <label style={labelStyle}>Summary</label>
        <div
          data-testid="ticket-summary"
          style={readOnlyField}
        >
          {ticket.summary}
        </div>
      </div>

      {/* Description */}
      <div style={card}>
        <label style={labelStyle}>Description</label>
        <div
          data-testid="ticket-description"
          style={{ ...readOnlyField, height: 'auto', minHeight: 80, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
        >
          {ticket.description}
        </div>
      </div>

      {/* Attachments */}
      <div style={card}>
        <AttachmentSection
          ticketId={ticket.id}
          requesterId={selectedRequesterId!}
          attachments={ticket.attachments}
          onAttachmentsChange={(updated) => setTicket((t) => t ? { ...t, attachments: updated } : t)}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function BackBtn({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} style={{ ...secondaryBtn, marginBottom: 16 }}>
      ← Back to My Tickets
    </button>
  );
}

function ReadOnly({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <div style={readOnlyField}>{value}</div>
    </div>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
import React from 'react';

const card: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--border-radius-control)',
  padding: 'var(--space-lg)',
  marginBottom: 'var(--space-md)',
};

const grid4: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 'var(--space-md)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 500,
  fontSize: 13,
  color: 'var(--color-text-secondary)',
  marginBottom: 4,
};

const readOnlyField: React.CSSProperties = {
  backgroundColor: 'var(--color-readonly-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--border-radius-control)',
  padding: '8px var(--space-sm)',
  fontSize: 14,
  minHeight: 40,
  display: 'flex',
  alignItems: 'center',
};

const ghostBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--color-secondary)',
  fontSize: 'inherit',
  padding: 0,
};

const secondaryBtn: React.CSSProperties = {
  height: 36,
  padding: '0 14px',
  borderRadius: 'var(--border-radius-control)',
  border: '1px solid var(--color-primary)',
  backgroundColor: '#fff',
  color: 'var(--color-primary)',
  fontWeight: 500,
  fontSize: 13,
  cursor: 'pointer',
};
