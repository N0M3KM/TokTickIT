import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import TicketDetail from '../pages/TicketDetail.js';

// Session-owned identity replaces the removed Lab 2 manual requester selector.
vi.mock('../context/AuthContext.js', () => ({ useAuth: () => ({
  user: { id: 1, name: 'Somchai Jaidee', role: 'REQUESTER', mustChangePassword: false }, loading: false,
}) }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const mockTicket = {
  id: 42,
  ticketNumber:      'TKT-2026-000042',
  requesterId:       1,
  requesterName:     'Somchai Jaidee',
  categoryId:        2,
  categoryName:      'Hardware',
  relatedSystemId:   3,
  relatedSystemName: 'Corporate Laptop',
  summary:           'Laptop battery drains quickly',
  description:       'Battery drains faster than usual after a Windows update.',
  requestedPriority: 'MEDIUM',
  currentStatus:     'NEW',
  ticketDate:        '2026-08-20T09:14:00.000Z',
  createdAt:         '2026-08-20T09:14:00.000Z',
  updatedAt:         '2026-08-20T10:00:00.000Z',
  attachments:       [],
  ticketOwnerId: null, itPriority: 'MEDIUM', requesterResolvedAt: null, version: 1,
  resolvedAt: null, reopenedAt: null, resolutionTimeEstimated: false,
  allowedTransitions: [], resolutionGate: { reasons: ['OWNER_REQUIRED', 'NO_COMPLETED_ACTION'] },
};

function renderDetail(ticketId = '42') {
  // The real Feature 21 draft guard requires a data router; it is not mocked away.
  const router = createMemoryRouter([
    { path: '/tickets/:id', element: <TicketDetail /> },
    { path: '/tickets', element: <div data-testid="my-tickets-page" /> },
  ], { initialEntries: [`/tickets/${ticketId}`] });
  return render(<RouterProvider router={router} />);
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

// ---------------------------------------------------------------------------
// UI-24 — all ticket fields rendered read-only; no editable inputs (FR-13)
// ---------------------------------------------------------------------------
describe('UI-24 / FR-13 — Ticket Detail displays all fields as read-only', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/tickets/42') return Promise.resolve(new Response(JSON.stringify(mockTicket), { status: 200 }));
        if (url === '/api/tickets/42/comments') return Promise.resolve(new Response('[]', { status: 200 }));
        if (url.startsWith('/api/tickets/42/history?')) return Promise.resolve(new Response(JSON.stringify({ data: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } }), { status: 200 }));
        if (url.startsWith('/api/tickets/42/actions?')) return Promise.resolve(new Response(JSON.stringify({ data: [], ticketVersion: 1, pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } }), { status: 200 }));
        return Promise.reject(new Error(`Unexpected requester endpoint: ${url}`));
      }),
    );
  });

  it('displays the ticket number', async () => {
    renderDetail();
    expect(await screen.findByText('TKT-2026-000042')).toBeInTheDocument();
  });

  it('displays the summary', async () => {
    renderDetail();
    expect(await screen.findByTestId('ticket-summary')).toHaveTextContent('Laptop battery drains quickly');
  });

  it('displays the description', async () => {
    renderDetail();
    expect(await screen.findByTestId('ticket-description')).toHaveTextContent(
      'Battery drains faster than usual after a Windows update.',
    );
  });

  it('displays the category name', async () => {
    renderDetail();
    expect(await screen.findByText('Hardware')).toBeInTheDocument();
  });

  it('displays the related system name', async () => {
    renderDetail();
    expect(await screen.findByText('Corporate Laptop')).toBeInTheDocument();
  });

  it('displays the requester name', async () => {
    renderDetail();
    expect(await screen.findByText('Somchai Jaidee')).toBeInTheDocument();
  });

  it('displays the MEDIUM priority badge', async () => {
    renderDetail();
    expect(await screen.findByText('MEDIUM')).toBeInTheDocument();
  });

  it('displays the NEW status badge', async () => {
    renderDetail();
    expect(await screen.findByText('NEW')).toBeInTheDocument();
  });

  it('does not render any editable text inputs for ticket fields', async () => {
    renderDetail();
    await screen.findByTestId('ticket-summary');
    // Lab 3 adds an editable public-comment textarea; the ticket's own fields remain read-only.
    const summary = screen.getByTestId('ticket-summary'), description = screen.getByTestId('ticket-description');
    expect(summary.tagName).toBe('DIV'); expect(description.tagName).toBe('DIV');
    expect(summary.querySelector('input,textarea,[contenteditable="true"]')).toBeNull();
    expect(description.querySelector('input,textarea,[contenteditable="true"]')).toBeNull();
    expect(document.querySelector('input[type="text"]')).toBeNull();
    expect(screen.getByLabelText('New public comment')).toBeInTheDocument();
    expect(screen.queryByLabelText('New internal note')).not.toBeInTheDocument();
  });

  it('shows the Back to My Tickets button', async () => {
    renderDetail();
    expect(await screen.findByTestId('back-btn')).toBeInTheDocument();
  });

  // Error states
  it('shows forbidden error when API returns 403', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'FORBIDDEN' } }), { status: 403 })),
    );
    renderDetail();
    expect(await screen.findByTestId('forbidden-error')).toBeInTheDocument();
    expect(screen.getByText(/permission/i)).toBeInTheDocument();
    expect(screen.queryByTestId('ticket-summary')).not.toBeInTheDocument();
  });

  it('shows not-found error when API returns 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }),
    );
    renderDetail();
    expect(await screen.findByTestId('not-found-error')).toBeInTheDocument();
    expect(screen.getByText(/not found/i)).toBeInTheDocument();
    expect(screen.queryByTestId('ticket-summary')).not.toBeInTheDocument();
  });

  it('shows general error with retry for unexpected server error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    renderDetail();
    expect(await screen.findByTestId('general-error')).toBeInTheDocument();
    expect(screen.getByTestId('retry-btn')).toBeInTheDocument();
  });
});
