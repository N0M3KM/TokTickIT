import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequesterProvider } from '../context/RequesterContext.js';
import TicketDetail from '../pages/TicketDetail.js';

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
};

function renderDetail(ticketId = '42') {
  localStorage.setItem('devRequesterId',   '1');
  localStorage.setItem('devRequesterName', 'Somchai Jaidee');
  return render(
    <MemoryRouter initialEntries={[`/tickets/${ticketId}`]}>
      <RequesterProvider>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="/tickets"     element={<div data-testid="my-tickets-page" />} />
        </Routes>
      </RequesterProvider>
    </MemoryRouter>,
  );
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

// ---------------------------------------------------------------------------
// UI-24 — all ticket fields rendered read-only; no editable inputs (FR-13)
// ---------------------------------------------------------------------------
describe('UI-24 / FR-13 — Ticket Detail displays all fields as read-only', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => mockTicket }),
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
    // There should be no form inputs for ticket fields (only AttachmentSection has file input)
    const inputs = document.querySelectorAll('input[type="text"], textarea');
    expect(inputs.length).toBe(0);
  });

  it('shows the Back to My Tickets button', async () => {
    renderDetail();
    expect(await screen.findByTestId('back-btn')).toBeInTheDocument();
  });

  // Error states
  it('shows forbidden error when API returns 403', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }),
    );
    renderDetail();
    expect(await screen.findByTestId('forbidden-error')).toBeInTheDocument();
    expect(screen.getByText(/permission/i)).toBeInTheDocument();
  });

  it('shows not-found error when API returns 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }),
    );
    renderDetail();
    expect(await screen.findByTestId('not-found-error')).toBeInTheDocument();
    expect(screen.getByText(/not found/i)).toBeInTheDocument();
  });

  it('shows general error with retry for unexpected server error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    renderDetail();
    expect(await screen.findByTestId('general-error')).toBeInTheDocument();
    expect(screen.getByTestId('retry-btn')).toBeInTheDocument();
  });
});
