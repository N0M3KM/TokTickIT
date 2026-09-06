import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequesterProvider } from '../context/RequesterContext.js';
import MyTickets from '../pages/MyTickets.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTicket(id: number, overrides: object = {}) {
  return {
    id,
    ticketNumber:      `TKT-2026-0000${id.toString().padStart(2, '0')}`,
    summary:           `Issue number ${id}`,
    categoryId:        1,
    categoryName:      'Hardware',
    requestedPriority: 'MEDIUM',
    currentStatus:     'NEW',
    createdAt:         '2026-08-20T09:00:00.000Z',
    updatedAt:         '2026-08-20T10:00:00.000Z',
    ...overrides,
  };
}

function mockList(tickets: object[], total?: number) {
  const pagination = { page: 1, pageSize: 10, total: total ?? tickets.length, totalPages: Math.ceil((total ?? tickets.length) / 10) || 1 };
  vi.stubGlobal(
    'fetch',
    vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })                          // /api/categories
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: tickets, pagination }) }), // /api/tickets
  );
}

function renderMyTickets() {
  localStorage.setItem('devRequesterId',   '1');
  localStorage.setItem('devRequesterName', 'Somchai Jaidee');
  return render(
    <MemoryRouter initialEntries={['/tickets']}>
      <RequesterProvider>
        <Routes>
          <Route path="/tickets"     element={<MyTickets />} />
          <Route path="/tickets/new" element={<div data-testid="create-ticket-page" />} />
          <Route path="/tickets/:id" element={<div data-testid="ticket-detail-page" />} />
        </Routes>
      </RequesterProvider>
    </MemoryRouter>,
  );
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

// ---------------------------------------------------------------------------
// UI-15 — displays list for selected requester (AC-05)
// ---------------------------------------------------------------------------
describe('UI-15 / AC-05 — ticket list renders for selected requester', () => {
  beforeEach(() => mockList([makeTicket(1), makeTicket(2)]));

  it('renders the tickets table', async () => {
    renderMyTickets();
    expect(await screen.findByTestId('tickets-table')).toBeInTheDocument();
  });

  it('renders the correct ticket numbers', async () => {
    renderMyTickets();
    expect(await screen.findByText('TKT-2026-000001')).toBeInTheDocument();
    expect(screen.getByText('TKT-2026-000002')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// UI-16 — loading state shown while fetching
// ---------------------------------------------------------------------------
describe('UI-16 — loading state', () => {
  it('shows loading spinner while tickets are fetching', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockImplementationOnce(() => new Promise(() => {})), // never resolves
    );
    renderMyTickets();
    expect(await screen.findByRole('status')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// UI-17 — empty state when no tickets (AC-14 — no filters active)
// ---------------------------------------------------------------------------
describe('UI-17 — empty state when no tickets', () => {
  it('shows empty state message when ticket list is empty and no filters active', async () => {
    mockList([]);
    renderMyTickets();
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText(/you have no tickets yet/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// UI-18 — no-results state when search active but no matches (AC-14)
// ---------------------------------------------------------------------------
describe('UI-18 / AC-14 — no-results state with active filters', () => {
  it('shows no-results state and Clear Filters button when search yields no results', async () => {
    const emptyTickets = { ok: true, json: async () => ({ data: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } }) };
    const catResp      = { ok: true, json: async () => [] };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('/api/categories')) return Promise.resolve(catResp);
        return Promise.resolve(emptyTickets);
      }),
    );
    renderMyTickets();

    const searchInput = await screen.findByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'zzznomatch' } });

    expect(await screen.findByTestId('no-results-state')).toBeInTheDocument();
    expect(screen.getByText(/no tickets match/i)).toBeInTheDocument();
    expect(screen.getByTestId('clear-filters-empty-btn')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// UI-19 — API failure state
// ---------------------------------------------------------------------------
describe('UI-19 — API failure state', () => {
  it('shows error state with retry when API fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: false, json: async () => ({}) }),
    );
    renderMyTickets();
    expect(await screen.findByTestId('tickets-error')).toBeInTheDocument();
    expect(screen.getByTestId('retry-btn')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// UI-20 — search triggers API call with search param (AC-12)
// ---------------------------------------------------------------------------
describe('UI-20 / AC-12 — search input triggers filtered API call', () => {
  it('passes search param to the tickets API', async () => {
    const emptyPagination = { page: 1, pageSize: 10, total: 0, totalPages: 1 };
    const fetchMock = vi.fn()
      // First call = categories (returns array)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      // All subsequent calls = tickets endpoint
      .mockResolvedValue({ ok: true, json: async () => ({ data: [], pagination: emptyPagination }) });
    vi.stubGlobal('fetch', fetchMock);

    renderMyTickets();
    const searchInput = await screen.findByTestId('search-input');

    fireEvent.change(searchInput, { target: { value: 'laptop' } });

    await waitFor(() => {
      const ticketCalls = fetchMock.mock.calls.filter((c) =>
        typeof c[0] === 'string' && c[0].includes('/api/tickets') && c[0].includes('search=laptop'),
      );
      expect(ticketCalls.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// UI-21 — category filter calls API with categoryId (AC-13)
// ---------------------------------------------------------------------------
describe('UI-21 / AC-13 — category filter triggers API call', () => {
  it('passes categoryId param to the tickets API', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 2, name: 'Hardware' }] })
      .mockResolvedValue({ ok: true, json: async () => ({ data: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } }) });
    vi.stubGlobal('fetch', fetchMock);

    renderMyTickets();
    await waitFor(() => screen.getByTestId('category-filter'));

    fireEvent.change(screen.getByTestId('category-filter'), { target: { value: '2' } });

    await waitFor(() => {
      const ticketCalls = fetchMock.mock.calls.filter((c) =>
        typeof c[0] === 'string' && c[0].includes('/api/tickets') && c[0].includes('categoryId=2'),
      );
      expect(ticketCalls.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// UI-22 — pagination: clicking page 2 calls API with page=2 (AC-15)
// ---------------------------------------------------------------------------
describe('UI-22 / AC-15 — pagination navigates pages', () => {
  it('calls API with page=2 when page 2 button is clicked', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          data: Array.from({ length: 10 }, (_, i) => makeTicket(i + 1)),
          pagination: { page: 1, pageSize: 10, total: 25, totalPages: 3 },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    renderMyTickets();
    await screen.findByTestId('pagination');

    fireEvent.click(await screen.findByTestId('pagination-page-2'));

    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter((c) =>
        typeof c[0] === 'string' && c[0].includes('page=2'),
      );
      expect(calls.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// UI-23 — clicking ticket row navigates to Ticket Detail (FR-12)
// ---------------------------------------------------------------------------
describe('UI-23 / FR-12 — clicking a ticket row navigates to Ticket Detail', () => {
  it('navigates to /tickets/:id when row is clicked', async () => {
    mockList([makeTicket(42)]);
    renderMyTickets();
    const row = await screen.findByTestId('ticket-row-42');
    fireEvent.click(row);
    expect(await screen.findByTestId('ticket-detail-page')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// STYLE-05 — priority badges render with correct variants
// ---------------------------------------------------------------------------
describe('STYLE-05 — priority badges have correct variant', () => {
  it('renders MEDIUM priority badge', async () => {
    mockList([makeTicket(1, { requestedPriority: 'MEDIUM' })]);
    renderMyTickets();
    expect(await screen.findByTestId('priority-badge-1')).toHaveTextContent('MEDIUM');
  });

  it('renders HIGH priority badge', async () => {
    mockList([makeTicket(2, { requestedPriority: 'HIGH' })]);
    renderMyTickets();
    expect(await screen.findByTestId('priority-badge-2')).toHaveTextContent('HIGH');
  });

  it('renders LOW priority badge', async () => {
    mockList([makeTicket(3, { requestedPriority: 'LOW' })]);
    renderMyTickets();
    expect(await screen.findByTestId('priority-badge-3')).toHaveTextContent('LOW');
  });

  it('renders CRITICAL priority badge', async () => {
    mockList([makeTicket(4, { requestedPriority: 'CRITICAL' })]);
    renderMyTickets();
    expect(await screen.findByTestId('priority-badge-4')).toHaveTextContent('CRITICAL');
  });
});

// ---------------------------------------------------------------------------
// STYLE-06 — status badge renders correctly
// ---------------------------------------------------------------------------
describe('STYLE-06 — status badge renders correctly', () => {
  it('renders NEW status badge', async () => {
    mockList([makeTicket(1, { currentStatus: 'NEW' })]);
    renderMyTickets();
    expect(await screen.findByTestId('status-badge-1')).toHaveTextContent('NEW');
  });
});
