import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import MyTickets from '../../pages/MyTickets.js';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const ticket = {
  id: 42, ticketNumber: 'TT-42', summary: 'Adapter intermittently disconnects', categoryId: 1, categoryName: 'Network',
  requestedPriority: 'MEDIUM', currentStatus: 'WAITING_FOR_REQUESTER', createdAt: '2026-10-01T02:00:00Z',
  updatedAt: '2026-10-30T02:00:00Z', resolvedAt: '2026-10-30T02:00:00Z', resolutionTimeEstimated: true,
};
const from = '2026-10-24T00:00:00+07:00';
const to = '2026-10-31T02:15:00.123Z';
const NativeRequest = globalThis.Request;
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }
function page(data = [ticket], current = 1, pageSize = 10, total = 25) {
  return { data, pagination: { page: current, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
}
function setupFetch(handler?: (url: URL, init?: RequestInit) => Response | Promise<Response>) {
  const requests: { url: URL; init?: RequestInit }[] = [];
  const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname === '/api/categories') return Promise.resolve(json([{ id: 1, name: 'Network' }, { id: 2, name: 'Hardware' }]));
    requests.push({ url, init });
    return Promise.resolve(handler ? handler(url, init) : json(page([ticket], Number(url.searchParams.get('page') ?? '1'), Number(url.searchParams.get('pageSize') ?? '10'))));
  });
  vi.stubGlobal('fetch', fetch);
  return { fetch, requests };
}
function renderPage(entry = '/tickets') {
  // The router creates an internal Request for navigation. Node's Request does
  // not accept jsdom's different-realm AbortSignal; no network is involved here.
  vi.stubGlobal('Request', class extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) { super(input, { ...init, signal: undefined }); }
  });
  const router = createMemoryRouter([
    { path: '/tickets', element: <MyTickets /> },
    { path: '/tickets/:id', element: <div>Ticket detail page</div> },
    { path: '/tickets/new', element: <div>Create ticket page</div> },
    { path: '/change-password', element: <div>Password change page</div> },
  ], { initialEntries: [entry] });
  return { router, ...render(<RouterProvider router={router} />) };
}
const recentPath = () => `/tickets?${new URLSearchParams({ dashboardFilter: 'recentlyResolved', from, to, page: '2', pageSize: '10', search: 'adapter', categoryId: '1', priority: 'MEDIUM', status: 'RESOLVED', sort: 'ticketNumber', order: 'asc' })}`;

describe('My Tickets dashboard drill-down and URL state', () => {
  it('forwards exact dashboard instants and restores URL filters with canonical recent ordering', async () => {
    const { requests } = setupFetch(); renderPage(recentPath());
    await screen.findByText(/25 matching tickets/);
    const query = requests.at(-1)!.url.searchParams;
    expect(query.get('dashboardFilter')).toBe('recentlyResolved');
    expect(query.get('from')).toBe(from); expect(query.get('to')).toBe(to);
    expect(query.get('sort')).toBe('resolvedAt'); expect(query.get('order')).toBe('desc'); expect(query.get('page')).toBe('2');
    expect(screen.getByRole('searchbox', { name: 'Search tickets' })).toHaveValue('adapter');
    expect(screen.getByRole('combobox', { name: 'Filter by category' })).toHaveValue('1');
    expect(screen.getByRole('combobox', { name: 'Filter by priority' })).toHaveValue('MEDIUM');
    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toHaveValue('RESOLVED');
    expect(screen.getByRole('combobox', { name: 'Sort tickets' })).toBeDisabled();
    expect(screen.getByText('Dashboard order: newest resolution first.')).toBeInTheDocument();
    expect(screen.getByText(/New work may change totals/)).toBeInTheDocument();
    expect(screen.getAllByText(/Estimated/).length).toBeGreaterThan(0);
  });

  it('keeps range/filter state through paging, detail navigation, Back and a fresh mount', async () => {
    const { requests } = setupFetch(); const view = renderPage(recentPath());
    await screen.findByText(/25 matching tickets/);
    fireEvent.click(screen.getByTestId('pagination-next'));
    await waitFor(() => expect(new URLSearchParams(view.router.state.location.search).get('page')).toBe('3'));
    await waitFor(() => expect(requests.at(-1)!.url.searchParams.get('page')).toBe('3'));
    const savedSearch = view.router.state.location.search;
    fireEvent.click(within(screen.getByTestId('tickets-table')).getByRole('link', { name: 'TT-42' }));
    await screen.findByText('Ticket detail page');
    await act(async () => { await view.router.navigate(-1); });
    await screen.findByText(/25 matching tickets/);
    expect(view.router.state.location.search).toBe(savedSearch);
    expect(screen.getByRole('searchbox', { name: 'Search tickets' })).toHaveValue('adapter');
    view.unmount(); renderPage(`/tickets${savedSearch}`);
    await screen.findByText(/25 matching tickets/);
    expect(requests.at(-1)!.url.searchParams.get('from')).toBe(from);
    expect(requests.at(-1)!.url.searchParams.get('to')).toBe(to);
    expect(requests.at(-1)!.url.searchParams.get('page')).toBe('3');
  });

  it('combines debounced search, category, all status choices and page size without losing the window', async () => {
    const { requests } = setupFetch(); const { router } = renderPage(recentPath());
    await screen.findByText(/25 matching tickets/);
    const statuses = within(screen.getByRole('combobox', { name: 'Filter by status' })).getAllByRole('option').map(option => (option as HTMLOptionElement).value);
    expect(statuses).toEqual(['', 'NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED']);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search tickets' }), { target: { value: 'new adapter' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by category' }), { target: { value: '2' } });
    await waitFor(() => expect(requests.at(-1)!.url.searchParams.get('categoryId')).toBe('2'));
    expect(requests.at(-1)!.url.searchParams.get('search')).toBe('new adapter');
    await screen.findByText(/25 matching tickets/);
    fireEvent.change(screen.getByRole('combobox', { name: 'Items per page' }), { target: { value: '25' } });
    await waitFor(() => expect(requests.at(-1)!.url.searchParams.get('pageSize')).toBe('25'));
    const query = new URLSearchParams(router.state.location.search);
    expect(query.get('from')).toBe(from); expect(query.get('to')).toBe(to); expect(query.get('page')).toBe('1');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search tickets' }), { target: { value: 'final search' } });
    await waitFor(() => expect(requests.at(-1)!.url.searchParams.get('search')).toBe('final search'));
    expect(requests.at(-1)!.url.searchParams.get('from')).toBe(from);
  });

  it('supports keyboard-operable normal sort controls and preserves ordinary list behavior', async () => {
    const { requests } = setupFetch(); const { router } = renderPage('/tickets?status=OPEN&sort=updatedAt&order=asc');
    await screen.findByText(/25 matching tickets/);
    const column = within(screen.getByTestId('col-header-ticketNumber'));
    const button = column.getByRole('button', { name: /Ticket No/ }); button.focus();
    expect(button).toHaveFocus(); fireEvent.click(button);
    await waitFor(() => expect(requests.at(-1)!.url.searchParams.get('sort')).toBe('ticketNumber'));
    expect(requests.at(-1)!.url.searchParams.get('order')).toBe('desc');
    expect(new URLSearchParams(router.state.location.search).get('status')).toBe('OPEN');
    expect(screen.getByRole('combobox', { name: 'Sort tickets' })).not.toBeDisabled();
  });

  it('clears the entire dashboard filter and window deliberately', async () => {
    const { requests } = setupFetch(); const { router } = renderPage(recentPath());
    await screen.findByText(/25 matching tickets/);
    fireEvent.click(screen.getByTestId('clear-filters-btn'));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    await waitFor(() => expect(requests.at(-1)!.url.searchParams.has('dashboardFilter')).toBe(false));
    expect(requests.at(-1)!.url.searchParams.has('from')).toBe(false); expect(requests.at(-1)!.url.searchParams.has('to')).toBe(false);
    expect(screen.getByRole('searchbox', { name: 'Search tickets' })).toHaveValue('');
  });

  it('aborts a superseded request and ignores a late response even if fetch ignores cancellation', async () => {
    let finishOld!: (response: Response) => void;
    const { requests } = setupFetch(url => url.searchParams.get('status') === 'NEW'
      ? new Promise(resolve => { finishOld = resolve; })
      : json(page([{ ...ticket, summary: 'Latest result' }])));
    renderPage('/tickets?status=NEW');
    await waitFor(() => expect(requests).toHaveLength(1));
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), { target: { value: 'OPEN' } });
    await screen.findAllByText('Latest result');
    expect(requests[0].init?.signal?.aborted).toBe(true);
    await act(async () => { finishOld(json(page([{ ...ticket, summary: 'Stale private result' }]))); });
    expect(screen.queryByText('Stale private result')).not.toBeInTheDocument();
    expect(screen.getAllByText('Latest result').length).toBeGreaterThan(0);
  });

  it('renders mobile ticket cards with escaped content and semantic detail links', async () => {
    const injected = '<img src=x onerror=alert(1)>';
    setupFetch(() => json(page([{ ...ticket, summary: injected }])));
    const { container } = renderPage();
    const cards = await screen.findByTestId('tickets-cards');
    expect(within(cards).getByRole('link', { name: 'TT-42' })).toHaveAttribute('href', '/tickets/42');
    expect(within(cards).getByText('WAITING FOR REQUESTER')).toBeInTheDocument();
    expect(within(cards).getByText(injected)).toBeInTheDocument(); expect(container.querySelector('img')).toBeNull();
    expect(cards).toHaveClass('my-tickets__cards');
  });

  it('distinguishes no tickets from zero matching dashboard tickets', async () => {
    setupFetch(() => json(page([], 1, 10, 0)));
    const first = renderPage();
    expect(await screen.findByText('You have no tickets yet.')).toBeInTheDocument();
    first.unmount(); renderPage('/tickets?dashboardFilter=waiting');
    expect(await screen.findByText('No tickets match your filters.')).toBeInTheDocument();
    expect(screen.getByTestId('clear-filters-empty-btn')).toBeInTheDocument();
  });

  it('keeps URL state and safe messages after failure and retries the same query', async () => {
    let fail = true;
    const { requests } = setupFetch(() => fail ? json({ error: { message: 'Private SQL connection error' } }, 500) : json(page()));
    const { router } = renderPage(recentPath());
    await screen.findByText('Could not load tickets. Please try again.');
    expect(screen.queryByText('Private SQL connection error')).not.toBeInTheDocument();
    const retained = router.state.location.search; fail = false;
    fireEvent.click(screen.getByTestId('retry-btn'));
    await screen.findByText(/25 matching tickets/);
    expect(router.state.location.search).toBe(retained); expect(requests.at(-1)!.url.searchParams.get('from')).toBe(from);
  });

  it('rejects forbidden results without exposing cards or stale content', async () => {
    setupFetch(() => json({ error: { code: 'FORBIDDEN', message: 'Private forbidden content' } }, 403));
    renderPage('/tickets?dashboardFilter=open');
    await screen.findByText('You do not have permission to view these tickets.');
    expect(screen.queryByTestId('tickets-cards')).not.toBeInTheDocument(); expect(screen.queryByTestId('retry-btn')).not.toBeInTheDocument();
    expect(screen.queryByText('Private forbidden content')).not.toBeInTheDocument();
  });
});
