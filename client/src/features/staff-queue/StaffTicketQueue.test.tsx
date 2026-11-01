import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import StaffTicketQueue from '../../pages/StaffTicketQueue.js';
import type { AuthUser } from '../../context/AuthContext.js';

const session = vi.hoisted(() => ({ user: { id: 5, name: 'Staff A', role: 'IT_STAFF', mustChangePassword: false } as AuthUser }));
vi.mock('../../context/AuthContext.js', () => ({ useAuth: () => ({ user: session.user }) }));
beforeEach(() => { session.user = { id: 5, name: 'Staff A', role: 'IT_STAFF', mustChangePassword: false }; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const ticket = {
  id: 42, ticketNumber: 'STAFF-42', summary: 'Network connection drops', categoryName: 'Network',
  requestedPriority: 'HIGH', itPriority: 'MEDIUM', currentStatus: 'IN_PROGRESS', ticketOwner: { id: 5, name: 'Staff A' },
  createdAt: '2026-10-01T02:00:00Z', updatedAt: '2026-10-31T02:00:00Z',
};
const from = '2026-10-25T00:00:00+07:00';
const to = '2026-10-31T04:15:20.123Z';
const NativeRequest = globalThis.Request;
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }
function page(data = [ticket], current = 1, pageSize = 10, total = 35) {
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
  vi.stubGlobal('fetch', fetch); return { fetch, requests };
}
function renderQueue(entry = '/queue') {
  // Node's navigation Request rejects jsdom's different-realm AbortSignal.
  // Queue transport still receives and tests its real AbortController signal.
  vi.stubGlobal('Request', class extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) { super(input, { ...init, signal: undefined }); }
  });
  const router = createMemoryRouter([
    { path: '/queue', element: <StaffTicketQueue /> },
    { path: '/tickets/:id', element: <div>Ticket detail page</div> },
    { path: '/change-password', element: <div>Password change page</div> },
  ], { initialEntries: [entry] });
  return { router, ...render(<RouterProvider router={router} />) };
}
const recentPath = () => `/queue?${new URLSearchParams({ dashboardFilter: 'recentlyUpdated', from, to, page: '2', pageSize: '10', search: 'network', categoryId: '1', requestedPriority: 'HIGH', itPriority: 'MEDIUM', status: 'IN_PROGRESS', ownerId: 'me', sort: 'ticketNumber', order: 'asc', userId: '999' })}`;

describe('Staff queue URL-preserved dashboard drill-down', () => {
  it('restores all URL filters, forwards exact instants and enforces canonical recent ordering', async () => {
    const { requests } = setupFetch(); const { router } = renderQueue(recentPath());
    await screen.findByText(/35 matching tickets/);
    const query = requests.at(-1)!.url.searchParams;
    expect(query.get('dashboardFilter')).toBe('recentlyUpdated'); expect(query.get('from')).toBe(from); expect(query.get('to')).toBe(to);
    expect(query.get('sort')).toBe('updatedAt'); expect(query.get('order')).toBe('desc'); expect(query.get('page')).toBe('2');
    expect(query.get('ownerId')).toBe('5'); expect(query.has('userId')).toBe(false);
    expect(new URLSearchParams(router.state.location.search).get('ownerId')).toBe('me');
    expect(screen.getByRole('searchbox', { name: 'Search queue' })).toHaveValue('network');
    expect(screen.getByRole('combobox', { name: 'Filter category' })).toHaveValue('1');
    expect(screen.getByRole('combobox', { name: 'Filter Requested priority' })).toHaveValue('HIGH');
    expect(screen.getByRole('combobox', { name: 'Filter IT priority' })).toHaveValue('MEDIUM');
    expect(screen.getByRole('combobox', { name: 'Filter Current status' })).toHaveValue('IN_PROGRESS');
    expect(screen.getByRole('combobox', { name: 'Filter owner' })).toHaveValue('me');
    expect(screen.getByRole('combobox', { name: 'Sort queue' })).toBeDisabled();
    expect(screen.getByText('Dashboard order: newest update first.')).toBeInTheDocument();
    expect(screen.getByText(/New work may change totals/)).toBeInTheDocument();
  });

  it('preserves range, filters and pagination through detail navigation, Back and a fresh mount', async () => {
    const { requests } = setupFetch(); const view = renderQueue(recentPath());
    await screen.findByText(/35 matching tickets/);
    fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
    await waitFor(() => expect(new URLSearchParams(view.router.state.location.search).get('page')).toBe('3'));
    await waitFor(() => expect(requests.at(-1)!.url.searchParams.get('page')).toBe('3'));
    const savedSearch = view.router.state.location.search;
    fireEvent.click(within(screen.getByTestId('queue-table')).getByRole('link', { name: 'STAFF-42' }));
    await screen.findByText('Ticket detail page');
    await act(async () => { await view.router.navigate(-1); });
    await screen.findByText(/35 matching tickets/);
    expect(view.router.state.location.search).toBe(savedSearch);
    view.unmount(); renderQueue(`/queue${savedSearch}`);
    await screen.findByText(/35 matching tickets/);
    expect(requests.at(-1)!.url.searchParams.get('from')).toBe(from); expect(requests.at(-1)!.url.searchParams.get('to')).toBe(to);
    expect(requests.at(-1)!.url.searchParams.get('page')).toBe('3');
  });

  it('combines search and all legacy filters with page sizes while preserving dashboard state', async () => {
    const { requests } = setupFetch(); const { router } = renderQueue(recentPath());
    await screen.findByText(/35 matching tickets/);
    const statusValues = within(screen.getByRole('combobox', { name: 'Filter Current status' })).getAllByRole('option').map(option => (option as HTMLOptionElement).value);
    expect(statusValues).toEqual(['', 'NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED']);
    const sizes = within(screen.getByRole('combobox', { name: 'Items per page' })).getAllByRole('option').map(option => (option as HTMLOptionElement).value);
    expect(sizes).toEqual(['10', '25', '50']);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search queue' }), { target: { value: 'new search' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter category' }), { target: { value: '2' } });
    await waitFor(() => expect(requests.at(-1)!.url.searchParams.get('categoryId')).toBe('2'));
    expect(requests.at(-1)!.url.searchParams.get('search')).toBe('new search');
    await screen.findByText(/35 matching tickets/);
    fireEvent.change(screen.getByRole('combobox', { name: 'Items per page' }), { target: { value: '25' } });
    await waitFor(() => expect(requests.at(-1)!.url.searchParams.get('pageSize')).toBe('25'));
    const query = new URLSearchParams(router.state.location.search);
    expect(query.get('dashboardFilter')).toBe('recentlyUpdated'); expect(query.get('from')).toBe(from); expect(query.get('to')).toBe(to); expect(query.get('page')).toBe('1');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search queue' }), { target: { value: 'debounced' } });
    await waitFor(() => expect(requests.at(-1)!.url.searchParams.get('search')).toBe('debounced'));
  });

  it('keeps normal sort controls keyboard-operable and retains a numeric owner filter', async () => {
    const { requests } = setupFetch(); const { router } = renderQueue('/queue?ownerId=6&status=OPEN&sort=createdAt&order=asc');
    await screen.findByText(/35 matching tickets/);
    expect(screen.getByRole('combobox', { name: 'Filter owner' })).toHaveValue('6');
    const button = screen.getByRole('button', { name: 'Ticket No.', exact: true }); button.focus();
    expect(button).toHaveFocus(); fireEvent.click(button);
    await waitFor(() => expect(requests.at(-1)!.url.searchParams.get('sort')).toBe('ticketNumber'));
    expect(requests.at(-1)!.url.searchParams.get('order')).toBe('desc'); expect(requests.at(-1)!.url.searchParams.get('ownerId')).toBe('6');
    expect(new URLSearchParams(router.state.location.search).get('status')).toBe('OPEN');
    expect(screen.getByRole('combobox', { name: 'Sort queue' })).not.toBeDisabled();
  });

  it('resolves Me from the current administrator session and explains distinct parent-ticket scope', async () => {
    session.user = { id: 19, name: 'Administrator A', role: 'ADMINISTRATOR', mustChangePassword: false };
    const { requests } = setupFetch(); renderQueue('/queue?dashboardFilter=myActions&ownerId=me');
    await screen.findByText(/35 matching tickets/);
    expect(requests.at(-1)!.url.searchParams.get('ownerId')).toBe('19');
    expect(requests.at(-1)!.url.searchParams.get('dashboardFilter')).toBe('myActions');
    expect(screen.getByText(/Each ticket appears once/)).toBeInTheDocument();
  });

  it('clears the full dashboard predicate/window and legacy filters deliberately', async () => {
    const { requests } = setupFetch(); const { router } = renderQueue(recentPath());
    await screen.findByText(/35 matching tickets/);
    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters', exact: true }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    await waitFor(() => expect(requests.at(-1)!.url.searchParams.has('dashboardFilter')).toBe(false));
    const query = requests.at(-1)!.url.searchParams;
    for (const key of ['from', 'to', 'ownerId', 'status', 'requestedPriority', 'itPriority', 'search']) expect(query.has(key)).toBe(false);
    expect(screen.getByRole('searchbox', { name: 'Search queue' })).toHaveValue('');
  });

  it('aborts superseded fetches and ignores late results even when fetch disregards cancellation', async () => {
    let finishOld!: (response: Response) => void;
    const { requests } = setupFetch(url => url.searchParams.get('status') === 'NEW'
      ? new Promise(resolve => { finishOld = resolve; }) : json(page([{ ...ticket, summary: 'Latest queue result' }])));
    renderQueue('/queue?status=NEW');
    await waitFor(() => expect(requests).toHaveLength(1));
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter Current status' }), { target: { value: 'OPEN' } });
    await screen.findAllByText('Latest queue result');
    expect(requests[0].init?.signal?.aborted).toBe(true);
    await act(async () => { finishOld(json(page([{ ...ticket, summary: 'Stale queue content' }]))); });
    expect(screen.queryByText('Stale queue content')).not.toBeInTheDocument();
  });

  it('renders semantic mobile cards and safely escapes full ticket and owner text', async () => {
    const injected = '<img src=x onerror=alert(1)>';
    setupFetch(() => json(page([{ ...ticket, summary: injected, currentStatus: 'CANCELLED' }])));
    const { container } = renderQueue();
    const cards = await screen.findByTestId('queue-cards');
    expect(within(cards).getByRole('link', { name: 'STAFF-42' })).toHaveAttribute('href', '/tickets/42');
    expect(within(cards).getByText(injected)).toBeInTheDocument(); expect(container.querySelector('img')).toBeNull();
    expect(within(cards).getByText('Staff A')).toBeInTheDocument(); expect(within(cards).getByText('CANCELLED').parentElement).toHaveClass('staff-queue__cancelled');
  });

  it('shows successful zero totals without fabricated ticket cards and keeps paging controls available', async () => {
    setupFetch(() => json(page([], 1, 10, 0))); renderQueue('/queue?dashboardFilter=ownedByMe');
    await screen.findByText('No tickets match the current filters.');
    expect(screen.getByText(/0 matching tickets/)).toBeInTheDocument();
    expect(screen.queryByTestId('queue-cards')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  });

  it('retains the URL and safe error text on failure, then retries the same query', async () => {
    let fail = true; const { requests } = setupFetch(() => fail ? json({ error: { message: 'Private SQL details' } }, 500) : json(page()));
    const { router } = renderQueue(recentPath());
    await screen.findByText('Could not load the ticket queue. Please try again.');
    expect(screen.queryByText('Private SQL details')).not.toBeInTheDocument();
    const retained = router.state.location.search; fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry', exact: true }));
    await screen.findByText(/35 matching tickets/);
    expect(router.state.location.search).toBe(retained); expect(requests.at(-1)!.url.searchParams.get('from')).toBe(from);
  });

  it('shows forbidden responses without leaking data or offering a retry', async () => {
    setupFetch(() => json({ error: { code: 'FORBIDDEN', message: 'Private error data' } }, 403));
    renderQueue('/queue?dashboardFilter=unassigned');
    await screen.findByText('You do not have permission to view the ticket queue.');
    expect(screen.queryByTestId('queue-cards')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Retry', exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText('Private error data')).not.toBeInTheDocument();
  });

  it('does not fetch privileged queue data when rendered for a requester', async () => {
    session.user = { id: 2, name: 'Requester A', role: 'REQUESTER', mustChangePassword: false };
    const { fetch } = setupFetch(); renderQueue();
    expect(screen.getByRole('alert')).toHaveTextContent('You do not have permission'); expect(fetch).not.toHaveBeenCalled();
  });

  it('respects the password-change guard before rendering queue content', async () => {
    setupFetch(() => json({ error: { code: 'PASSWORD_CHANGE_REQUIRED' } }, 403));
    renderQueue('/queue?dashboardFilter=ownedByMe');
    await screen.findByText('Password change page');
    expect(screen.queryByTestId('queue-cards')).not.toBeInTheDocument();
  });
});
