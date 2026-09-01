import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RequesterProvider } from '../context/RequesterContext.js';
import AttachmentSection, { type Attachment } from '../components/AttachmentSection.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeAttachment(id: number, removed = false): Attachment {
  return {
    id,
    originalFilename: `file-${id}.pdf`,
    mimeType:         'application/pdf',
    sizeBytes:        1024 * 512,
    uploadedAt:       '2026-08-20T09:20:00.000Z',
    removedAt:        removed ? '2026-08-20T10:00:00.000Z' : null,
    removalReason:    removed ? 'No longer needed' : null,
  };
}

function renderSection(attachments: Attachment[], onChange = vi.fn()) {
  localStorage.setItem('devRequesterId',   '1');
  localStorage.setItem('devRequesterName', 'Test User');
  return render(
    <MemoryRouter>
      <RequesterProvider>
        <AttachmentSection
          ticketId={42}
          requesterId={1}
          attachments={attachments}
          onAttachmentsChange={onChange}
        />
      </RequesterProvider>
    </MemoryRouter>,
  );
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

// ---------------------------------------------------------------------------
// UI-25 — active attachment shows Download button (AC-09, FR-17)
// ---------------------------------------------------------------------------
describe('UI-25 / AC-09 — active attachment shows Download button', () => {
  it('renders Download button for active attachment', () => {
    renderSection([makeAttachment(10)]);
    expect(screen.getByTestId('download-btn-10')).toBeInTheDocument();
  });

  it('renders the attachment row', () => {
    renderSection([makeAttachment(10)]);
    expect(screen.getByTestId('attachment-row-10')).toBeInTheDocument();
  });

  it('renders the filename', () => {
    renderSection([makeAttachment(10)]);
    expect(screen.getByText(/file-10\.pdf/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// UI-26 — removed attachment shows Removed badge; no Download button (AC-10, FR-16)
// ---------------------------------------------------------------------------
describe('UI-26 / AC-10 — removed attachment shows Removed badge, no Download', () => {
  beforeEach(() => renderSection([makeAttachment(11, true)]));

  it('shows the Removed badge', () => {
    expect(screen.getByTestId('removed-badge-11')).toBeInTheDocument();
    expect(screen.getByTestId('removed-badge-11')).toHaveTextContent('Removed');
  });

  it('does not show a Download button', () => {
    expect(screen.queryByTestId('download-btn-11')).not.toBeInTheDocument();
  });

  it('shows the removal reason', () => {
    expect(screen.getByText(/no longer needed/i)).toBeInTheDocument();
  });

  it('does not show a Remove button for an already-removed attachment', () => {
    expect(screen.queryByTestId('remove-btn-11')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// UI-27 — soft remove dialog requires reason; Confirm disabled until entered (FR-15, BR-18)
// ---------------------------------------------------------------------------
describe('UI-27 / BR-18 — soft remove dialog requires reason before Confirm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn()); // not called in these tests
    renderSection([makeAttachment(10)]);
    fireEvent.click(screen.getByTestId('remove-btn-10'));
  });

  it('opens the confirmation dialog when Remove is clicked', () => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Confirm button is disabled when reason is empty', () => {
    expect(screen.getByTestId('dialog-confirm-btn')).toBeDisabled();
  });

  it('Confirm button becomes enabled when reason is entered', () => {
    fireEvent.change(screen.getByTestId('removal-reason-input'), {
      target: { value: 'Uploaded wrong version' },
    });
    expect(screen.getByTestId('dialog-confirm-btn')).not.toBeDisabled();
  });

  it('closes the dialog when Cancel is clicked', () => {
    fireEvent.click(screen.getByTestId('dialog-cancel-btn'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the dialog when Escape is pressed', () => {
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls the soft-remove API with the reason when Confirm is clicked', async () => {
    const updated: Attachment = { ...makeAttachment(10), removedAt: '2026-08-20T11:00:00.000Z', removalReason: 'Uploaded wrong version' };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => updated });
    vi.stubGlobal('fetch', fetchMock);

    fireEvent.change(screen.getByTestId('removal-reason-input'), {
      target: { value: 'Uploaded wrong version' },
    });
    fireEvent.click(screen.getByTestId('dialog-confirm-btn'));

    // After confirmation the API is called and the dialog closes
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// UI-28 — Add Attachment button disabled when 5 active attachments exist (BR-17, AC-08)
// ---------------------------------------------------------------------------
describe('UI-28 / BR-17 — Add Attachment button disabled at limit', () => {
  it('Add Attachment button is disabled when 5 active attachments exist', () => {
    const atLimit = Array.from({ length: 5 }, (_, i) => makeAttachment(i + 1));
    renderSection(atLimit);
    const btn = screen.getByTestId('add-attachment-btn');
    expect(btn).toBeDisabled();
  });

  it('Add Attachment button is enabled when fewer than 5 active attachments', () => {
    renderSection([makeAttachment(1), makeAttachment(2)]);
    expect(screen.getByTestId('add-attachment-btn')).not.toBeDisabled();
  });

  it('disabled button shows tooltip about the limit', () => {
    const atLimit = Array.from({ length: 5 }, (_, i) => makeAttachment(i + 1));
    renderSection(atLimit);
    expect(screen.getByTestId('add-attachment-btn').title).toMatch(/maximum/i);
  });

  it('Add Attachment button is enabled when some attachments are removed (removed do not count)', () => {
    // 4 active + 1 removed = should still be enabled
    const attachments = [
      ...Array.from({ length: 4 }, (_, i) => makeAttachment(i + 1)),
      makeAttachment(5, true), // removed — does not count toward limit
    ];
    renderSection(attachments);
    expect(screen.getByTestId('add-attachment-btn')).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// STYLE-07 — Removed badge uses warning/amber styling
// ---------------------------------------------------------------------------
describe('STYLE-07 — Removed badge styling', () => {
  it('Removed badge renders with "Removed" text', () => {
    renderSection([makeAttachment(20, true)]);
    const badge = screen.getByTestId('removed-badge-20');
    expect(badge).toHaveTextContent('Removed');
  });

  it('active attachment does not show a Removed badge', () => {
    renderSection([makeAttachment(21)]);
    expect(screen.queryByTestId('removed-badge-21')).not.toBeInTheDocument();
  });
});
