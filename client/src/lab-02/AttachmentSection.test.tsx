import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth, type AuthUser, type UserRole } from '../context/AuthContext.js';
import RequireAuth from '../components/RequireAuth.js';
import AttachmentSection, { type Attachment } from '../components/AttachmentSection.js';

// Attachment behavior survives the removal of DevRequester selection. Identity
// comes from AuthProvider's cookie-session endpoint, just as in Ticket Detail.
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function makeAttachment(id: number, removed = false): Attachment {
  return { id, originalFilename: `file-${id}.pdf`, mimeType: 'application/pdf', sizeBytes: 512 * 1024,
    uploadedAt: '2026-08-20T09:20:00.000Z', removedAt: removed ? '2026-08-20T10:00:00.000Z' : null,
    removalReason: removed ? 'No longer needed' : null };
}
function AuthenticatedSection({ attachments, onChange }: { attachments: Attachment[]; onChange: (attachments: Attachment[]) => void }) {
  const { user } = useAuth();
  return <RequireAuth><AttachmentSection ticketId={42} readOnly={user?.role !== 'REQUESTER'} attachments={attachments} onAttachmentsChange={onChange} /></RequireAuth>;
}
async function setup(attachments: Attachment[], options: { role?: UserRole; mutation?: (url: string, init: RequestInit) => Promise<Response> | Response } = {}) {
  const user: AuthUser = { id: 1, name: 'Authenticated user', role: options.role ?? 'REQUESTER', mustChangePassword: false };
  const fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    if (url === '/api/auth/me') return json(user);
    if (options.mutation) return options.mutation(url, init);
    throw new Error('Unexpected attachment mutation');
  });
  vi.stubGlobal('fetch', fetch); const onChange = vi.fn();
  render(<MemoryRouter><AuthProvider><AuthenticatedSection attachments={attachments} onChange={onChange} /></AuthProvider></MemoryRouter>);
  await screen.findByRole('heading', { name: /^Attachments/ });
  return { fetch, onChange };
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('UI-25 active attachment download and metadata', () => {
  it('renders the active row, filename, size and named Download control', async () => {
    await setup([makeAttachment(10)]);
    expect(screen.getByTestId('attachment-row-10')).toBeInTheDocument();
    expect(screen.getByText(/file-10\.pdf/)).toBeInTheDocument(); expect(screen.getByText(/0.5 MB/)).toBeInTheDocument();
    expect(screen.getByTestId('download-btn-10')).toHaveAccessibleName('Download file-10.pdf');
  });
  it('opens only the authorized nested download URL with a safe new-window policy', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { fetch } = await setup([makeAttachment(10)]); fireEvent.click(screen.getByTestId('download-btn-10'));
    expect(open).toHaveBeenCalledWith('/api/tickets/42/attachments/10/download', '_blank', 'noopener,noreferrer');
    expect(fetch.mock.calls.filter(([url]) => url !== '/api/auth/me')).toHaveLength(0);
  });
});

describe('UI-26 / STYLE-07 removed attachments retain history without file controls', () => {
  it('shows the Removed badge and reason with warning styling', async () => {
    await setup([makeAttachment(11, true)]);
    expect(screen.getByTestId('removed-badge-11')).toHaveTextContent('Removed');
    expect(screen.getByTestId('removed-badge-11').getAttribute('style')).toContain('--color-warning');
    expect(screen.getByText(/No longer needed/)).toBeInTheDocument();
  });
  it('exposes neither Download nor Remove for an already removed attachment', async () => {
    await setup([makeAttachment(11, true)]);
    expect(screen.queryByTestId('download-btn-11')).not.toBeInTheDocument(); expect(screen.queryByTestId('remove-btn-11')).not.toBeInTheDocument();
  });
  it('does not mark an active attachment as removed', async () => {
    await setup([makeAttachment(21)]); expect(screen.queryByTestId('removed-badge-21')).not.toBeInTheDocument();
  });
});

describe('UI-27 removal confirmation and persistence callbacks', () => {
  it('opens a labelled confirmation dialog and disables confirm for empty or whitespace reason', async () => {
    await setup([makeAttachment(10)]); fireEvent.click(screen.getByTestId('remove-btn-10'));
    expect(screen.getByRole('dialog', { name: 'Remove Attachment' })).toBeInTheDocument();
    expect(screen.getByTestId('dialog-confirm-btn')).toBeDisabled();
    fireEvent.change(screen.getByTestId('removal-reason-input'), { target: { value: '   ' } });
    expect(screen.getByTestId('dialog-confirm-btn')).toBeDisabled();
  });
  it('enables confirm for a meaningful reason and cancels without a mutation', async () => {
    const { fetch } = await setup([makeAttachment(10)]); fireEvent.click(screen.getByTestId('remove-btn-10'));
    fireEvent.change(screen.getByTestId('removal-reason-input'), { target: { value: 'Wrong version' } });
    expect(screen.getByTestId('dialog-confirm-btn')).toBeEnabled();
    fireEvent.click(screen.getByTestId('dialog-cancel-btn')); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetch.mock.calls.filter(([url]) => url !== '/api/auth/me')).toHaveLength(0);
  });
  it('supports Escape without deleting the attachment', async () => {
    const { onChange } = await setup([makeAttachment(10)]); fireEvent.click(screen.getByTestId('remove-btn-10'));
    fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(onChange).not.toHaveBeenCalled();
  });
  it('sends the trimmed reason with cookie credentials and preserves other attachment entries', async () => {
    const updated = { ...makeAttachment(10), removedAt: '2026-08-20T11:00:00.000Z', removalReason: 'Wrong version' };
    const untouched = makeAttachment(12);
    const { fetch, onChange } = await setup([makeAttachment(10), untouched], { mutation: () => json(updated) });
    fireEvent.click(screen.getByTestId('remove-btn-10')); fireEvent.change(screen.getByTestId('removal-reason-input'), { target: { value: '  Wrong version  ' } });
    fireEvent.click(screen.getByTestId('dialog-confirm-btn'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([updated, untouched]));
    expect(fetch).toHaveBeenCalledWith('/api/tickets/42/attachments/10', expect.objectContaining({ method: 'DELETE', credentials: 'same-origin', body: JSON.stringify({ removalReason: 'Wrong version' }) }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('retains the reason and dialog when removal fails, without changing the list', async () => {
    const { onChange } = await setup([makeAttachment(10)], { mutation: () => json({ error: { message: 'Removal failed.' } }, 500) });
    fireEvent.click(screen.getByTestId('remove-btn-10')); fireEvent.change(screen.getByTestId('removal-reason-input'), { target: { value: 'Wrong version' } });
    fireEvent.click(screen.getByTestId('dialog-confirm-btn'));
    await screen.findByRole('alert'); expect(screen.getByTestId('removal-reason-input')).toHaveValue('Wrong version');
    expect(screen.getByRole('dialog')).toBeInTheDocument(); expect(onChange).not.toHaveBeenCalled();
  });
});

describe('UI-28 active-count upload limits and validation', () => {
  it('disables adding at five active attachments with an accessible maximum explanation', async () => {
    await setup(Array.from({ length: 5 }, (_, index) => makeAttachment(index + 1)));
    expect(screen.getByTestId('add-attachment-btn')).toBeDisabled();
    expect(screen.getByTestId('add-attachment-btn')).toHaveAttribute('title', expect.stringMatching(/maximum/i));
  });
  it('does not count removed attachments against the limit', async () => {
    await setup([...Array.from({ length: 4 }, (_, index) => makeAttachment(index + 1)), makeAttachment(5, true)]);
    expect(screen.getByTestId('add-attachment-btn')).toBeEnabled(); expect(screen.getByRole('heading', { name: 'Attachments (4)' })).toBeInTheDocument();
  });
  it('shows a clear empty state and allows the first attachment', async () => {
    await setup([]); expect(screen.getByText('No attachments yet.')).toBeInTheDocument(); expect(screen.getByTestId('add-attachment-btn')).toBeEnabled();
  });
  it('rejects unsupported file types before sending any upload', async () => {
    const { fetch, onChange } = await setup([]);
    fireEvent.change(screen.getByTestId('attachment-file-input'), { target: { files: [new File(['bad'], 'run.exe', { type: 'application/octet-stream' })] } });
    expect(await screen.findByTestId('upload-error')).toHaveTextContent(/not an allowed file type/);
    expect(fetch.mock.calls.filter(([url]) => url !== '/api/auth/me')).toHaveLength(0); expect(onChange).not.toHaveBeenCalled();
  });
  it('rejects files over five MB before sending any upload', async () => {
    const { fetch } = await setup([]);
    fireEvent.change(screen.getByTestId('attachment-file-input'), { target: { files: [new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.pdf', { type: 'application/pdf' })] } });
    expect(await screen.findByTestId('upload-error')).toHaveTextContent(/exceeds the 5 MB/);
    expect(fetch.mock.calls.filter(([url]) => url !== '/api/auth/me')).toHaveLength(0);
  });
  it('uploads multipart file data with cookie credentials and appends the server attachment', async () => {
    const added = makeAttachment(13); const existing = makeAttachment(10);
    const { fetch, onChange } = await setup([existing], { mutation: () => json(added, 201) });
    const file = new File(['pdf-content'], 'new.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByTestId('attachment-file-input'), { target: { files: [file] } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([existing, added]));
    const call = fetch.mock.calls.find(([url]) => url === '/api/tickets/42/attachments')!;
    expect(call[1]).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(call[1].body).toBeInstanceOf(FormData); expect((call[1].body as FormData).get('file')).toEqual(file);
  });
  it('keeps the existing list intact on an upload failure', async () => {
    const { onChange } = await setup([makeAttachment(10)], { mutation: () => json({ error: { message: 'Upload failed.' } }, 500) });
    fireEvent.change(screen.getByTestId('attachment-file-input'), { target: { files: [new File(['pdf'], 'new.pdf', { type: 'application/pdf' })] } });
    await screen.findByTestId('upload-error'); expect(screen.getByTestId('attachment-row-10')).toBeInTheDocument(); expect(onChange).not.toHaveBeenCalled();
  });
});

describe('authenticated staff/admin attachment access remains read-only', () => {
  it.each(['IT_STAFF', 'ADMINISTRATOR'] as const)('allows %s downloads without upload or remove controls', async role => {
    const { fetch } = await setup([makeAttachment(10), makeAttachment(11, true)], { role });
    expect(screen.getByTestId('download-btn-10')).toBeInTheDocument(); expect(screen.getByTestId('removed-badge-11')).toBeInTheDocument();
    expect(screen.queryByTestId('add-attachment-btn')).not.toBeInTheDocument(); expect(screen.queryByTestId('remove-btn-10')).not.toBeInTheDocument();
    expect(fetch.mock.calls.filter(([url]) => url !== '/api/auth/me')).toHaveLength(0);
  });
});
