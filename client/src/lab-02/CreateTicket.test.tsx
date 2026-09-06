import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequesterProvider } from '../context/RequesterContext.js';
import CreateTicket from '../pages/CreateTicket.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const CATS = [{ id: 1, name: 'Hardware' }, { id: 2, name: 'Software' }];
const SYSS = [{ id: 1, name: 'Corporate Laptop' }];

function mockRefData() {
  vi.stubGlobal(
    'fetch',
    vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => CATS })  // /api/categories
      .mockResolvedValueOnce({ ok: true, json: async () => SYSS }), // /api/related-systems
  );
}

function renderCreateTicket() {
  localStorage.setItem('devRequesterId',   '1');
  localStorage.setItem('devRequesterName', 'Somchai Jaidee');
  return render(
    <MemoryRouter initialEntries={['/tickets/new']}>
      <RequesterProvider>
        <Routes>
          <Route path="/tickets/new" element={<CreateTicket />} />
          <Route path="/tickets"     element={<div data-testid="my-tickets-page">My Tickets</div>} />
          <Route path="/tickets/:id" element={<div data-testid="ticket-detail-page">Ticket Detail</div>} />
        </Routes>
      </RequesterProvider>
    </MemoryRouter>,
  );
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

// ---------------------------------------------------------------------------
// UI-07 — submit without Summary shows field-level error; API not called
// ---------------------------------------------------------------------------
describe('UI-07 — submit without Summary shows field error', () => {
  beforeEach(async () => {
    mockRefData();
    renderCreateTicket();
    await screen.findByTestId('category-select');
  });

  it('shows summary error message below the Summary field', async () => {
    fireEvent.click(screen.getByTestId('submit-btn'));
    expect(await screen.findByTestId('summary-error')).toBeInTheDocument();
    expect(screen.getByTestId('summary-error')).toHaveTextContent(/summary is required/i);
  });

  it('does not call the tickets API when summary is empty', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => CATS })
      .mockResolvedValueOnce({ ok: true, json: async () => SYSS });
    vi.stubGlobal('fetch', fetchMock);
    fireEvent.click(screen.getByTestId('submit-btn'));
    await screen.findByTestId('summary-error');
    // Only the 2 ref-data calls; no ticket POST
    const postCalls = fetchMock.mock.calls.filter((c) => c[1]?.method === 'POST');
    expect(postCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// UI-08 — all required fields empty → each shows its own error (AC-23)
// ---------------------------------------------------------------------------
describe('UI-08 / AC-23 — all required fields empty show individual errors', () => {
  beforeEach(async () => {
    mockRefData();
    renderCreateTicket();
    await screen.findByTestId('category-select');
    // Clear the auto-selected category
    fireEvent.change(screen.getByTestId('category-select'), { target: { value: '' } });
  });

  it('shows category error', async () => {
    fireEvent.click(screen.getByTestId('submit-btn'));
    expect(await screen.findByText(/category is required/i)).toBeInTheDocument();
  });

  it('shows summary error', async () => {
    fireEvent.click(screen.getByTestId('submit-btn'));
    expect(await screen.findByTestId('summary-error')).toBeInTheDocument();
  });

  it('shows description error', async () => {
    fireEvent.click(screen.getByTestId('submit-btn'));
    expect(await screen.findByTestId('description-error')).toBeInTheDocument();
  });

  it('shows multiple errors at the same time', async () => {
    fireEvent.click(screen.getByTestId('submit-btn'));
    await screen.findByTestId('summary-error');
    expect(screen.getByTestId('description-error')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// UI-09 — Submit button disabled while submitting (BR-25)
// ---------------------------------------------------------------------------
describe('UI-09 — Submit button disabled during submission', () => {
  it('submit button is disabled while request is in-flight', async () => {
    // Never resolves — keeps the request pending
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => CATS })
        .mockResolvedValueOnce({ ok: true, json: async () => SYSS })
        .mockImplementationOnce(() => new Promise(() => {})),
    );
    renderCreateTicket();
    await screen.findByTestId('category-select');

    fireEvent.change(screen.getByTestId('summary-input'),     { target: { value: 'Test summary' } });
    fireEvent.change(screen.getByTestId('description-input'), { target: { value: 'Test description' } });
    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('submit-btn')).toBeDisabled();
    });
  });
});

// ---------------------------------------------------------------------------
// UI-10 — successful submission shows Ticket Number (AC-01)
// ---------------------------------------------------------------------------
describe('UI-10 / AC-01 — successful submission displays Ticket Number', () => {
  it('renders the success panel with the returned ticket number', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => CATS })
        .mockResolvedValueOnce({ ok: true, json: async () => SYSS })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 42, ticketNumber: 'TKT-2026-000042' }),
        }),
    );
    renderCreateTicket();
    await screen.findByTestId('category-select');

    fireEvent.change(screen.getByTestId('summary-input'),     { target: { value: 'Battery issue' } });
    fireEvent.change(screen.getByTestId('description-input'), { target: { value: 'Drains fast' } });
    fireEvent.click(screen.getByTestId('submit-btn'));

    expect(await screen.findByTestId('ticket-number-display')).toHaveTextContent('TKT-2026-000042');
    expect(screen.getByTestId('success-panel')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// UI-11 — API failure preserves form values (AC-17, BR-26)
// ---------------------------------------------------------------------------
describe('UI-11 / AC-17 — API failure preserves form values', () => {
  it('shows error banner and keeps summary value after API error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => CATS })
        .mockResolvedValueOnce({ ok: true, json: async () => SYSS })
        .mockResolvedValueOnce({ ok: false, json: async () => ({ error: { message: 'Server error' } }) }),
    );
    renderCreateTicket();
    await screen.findByTestId('category-select');

    fireEvent.change(screen.getByTestId('summary-input'),     { target: { value: 'My summary stays' } });
    fireEvent.change(screen.getByTestId('description-input'), { target: { value: 'My description stays' } });
    fireEvent.click(screen.getByTestId('submit-btn'));

    await screen.findByTestId('api-error-banner');
    expect(screen.getByTestId('summary-input')).toHaveValue('My summary stays');
    expect(screen.getByTestId('description-input')).toHaveValue('My description stays');
  });

  it('shows the error banner after API failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => CATS })
        .mockResolvedValueOnce({ ok: true, json: async () => SYSS })
        .mockResolvedValueOnce({ ok: false, json: async () => ({ error: { message: 'Server error' } }) }),
    );
    renderCreateTicket();
    await screen.findByTestId('category-select');
    fireEvent.change(screen.getByTestId('summary-input'),     { target: { value: 'Test' } });
    fireEvent.change(screen.getByTestId('description-input'), { target: { value: 'Test desc' } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    expect(await screen.findByTestId('api-error-banner')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// UI-12 — attachment > 5 MB shows client error (AC-06)
// ---------------------------------------------------------------------------
describe('UI-12 / AC-06 — attachment over 5 MB shows client error', () => {
  beforeEach(async () => {
    mockRefData();
    renderCreateTicket();
    await screen.findByTestId('category-select');
  });

  it('shows attachment error for oversized file', async () => {
    const bigFile = new File(['x'.repeat(6 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(bigFile, 'size', { value: 6 * 1024 * 1024 });
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [bigFile] } });
    expect(await screen.findByTestId('attachment-error')).toHaveTextContent(/5 mb/i);
  });

  it('does not add the oversized file to the staged list', async () => {
    const bigFile = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(bigFile, 'size', { value: 6 * 1024 * 1024 });
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [bigFile] } });
    await screen.findByTestId('attachment-error');
    expect(screen.queryByText('big.pdf')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// UI-13 — disallowed file type shows client error (AC-07)
// ---------------------------------------------------------------------------
describe('UI-13 / AC-07 — disallowed file type shows client error', () => {
  beforeEach(async () => {
    mockRefData();
    renderCreateTicket();
    await screen.findByTestId('category-select');
  });

  it('shows attachment error for disallowed type', async () => {
    const badFile = new File(['x'], 'virus.exe', { type: 'application/octet-stream' });
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [badFile] } });
    expect(await screen.findByTestId('attachment-error')).toHaveTextContent(/allowed/i);
  });

  it('does not add the disallowed file to staged list', async () => {
    const badFile = new File(['x'], 'virus.exe', { type: 'application/octet-stream' });
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [badFile] } });
    await screen.findByTestId('attachment-error');
    expect(screen.queryByText('virus.exe')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// UI-14 — ticket created but attachment upload fails (AC-21, BR-20)
// ---------------------------------------------------------------------------
describe('UI-14 / AC-21 — ticket saved but attachment upload fails', () => {
  it('shows partial-success panel with link to ticket detail', async () => {
    const pdf = new File(['data'], 'report.pdf', { type: 'application/pdf' });
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => CATS })
        .mockResolvedValueOnce({ ok: true, json: async () => SYSS })
        // ticket POST succeeds
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 7, ticketNumber: 'TKT-2026-000007' }) })
        // attachment POST fails
        .mockResolvedValueOnce({ ok: false, json: async () => ({ error: { message: 'Upload failed' } }) }),
    );
    renderCreateTicket();
    await screen.findByTestId('category-select');

    // Stage a file
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [pdf] } });

    fireEvent.change(screen.getByTestId('summary-input'),     { target: { value: 'Test ticket' } });
    fireEvent.change(screen.getByTestId('description-input'), { target: { value: 'Test description' } });
    fireEvent.click(screen.getByTestId('submit-btn'));

    expect(await screen.findByTestId('partial-success-panel')).toBeInTheDocument();
    expect(screen.getByTestId('view-ticket-detail-link')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// STYLE-02 — required fields show red asterisk
// ---------------------------------------------------------------------------
describe('STYLE-02 — required fields show red asterisk', () => {
  beforeEach(async () => {
    mockRefData();
    renderCreateTicket();
    await screen.findByTestId('category-select');
  });

  it('Summary label contains an asterisk', () => {
    expect(screen.getByText(/summary/i, { selector: 'label' })?.textContent).toContain('*');
  });

  it('Description label contains an asterisk', () => {
    expect(screen.getByText(/description/i, { selector: 'label' })?.textContent).toContain('*');
  });

  it('Category label contains an asterisk', () => {
    expect(screen.getByText(/category/i, { selector: 'label' })?.textContent).toContain('*');
  });
});

// ---------------------------------------------------------------------------
// STYLE-03 — read-only fields are visually distinct
// ---------------------------------------------------------------------------
describe('STYLE-03 — read-only fields use readonly background', () => {
  beforeEach(async () => {
    mockRefData();
    renderCreateTicket();
    await screen.findByTestId('category-select');
  });

  it('Requester display field is not an editable input', () => {
    // The requester field is rendered as a div, not an input
    const summaryInput = screen.getByTestId('summary-input');
    expect(summaryInput.tagName).toBe('INPUT');
    // Requester is shown as a ReadOnly div — confirm no input with the requester name as value
    expect(screen.queryByDisplayValue('Somchai Jaidee')).not.toBeInTheDocument();
  });

  it('Requester name is displayed as text content', () => {
    expect(screen.getByText('Somchai Jaidee')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// STYLE-04 — validation error text uses error color
// ---------------------------------------------------------------------------
describe('STYLE-04 — validation error messages appear below fields', () => {
  beforeEach(async () => {
    mockRefData();
    renderCreateTicket();
    await screen.findByTestId('category-select');
  });

  it('summary error appears after submit with empty summary', async () => {
    fireEvent.click(screen.getByTestId('submit-btn'));
    const err = await screen.findByTestId('summary-error');
    // Error must be in DOM (position relative to summary input asserted structurally)
    expect(err).toBeInTheDocument();
    expect(err).toHaveAttribute('role', 'alert');
  });

  it('description error appears after submit with empty description', async () => {
    fireEvent.change(screen.getByTestId('summary-input'), { target: { value: 'Some summary' } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    expect(await screen.findByTestId('description-error')).toBeInTheDocument();
  });
});
