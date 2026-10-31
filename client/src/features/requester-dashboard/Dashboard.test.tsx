import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RequesterDashboard from './Dashboard.js';
import { parseRequesterDashboard } from './api.js';

const auth = vi.hoisted(() => ({ user: { id: 1, name: 'Requester A', role: 'REQUESTER' } as { id: number; name: string; role: string } | null }));
vi.mock('../../context/AuthContext.js', () => ({ useAuth: () => ({ user: auth.user }) }));
const from = '2026-10-23T17:00:00.000Z', to = '2026-10-30T12:00:00.000Z';
function fixture() {
  const metric = (key: string, count: number) => ({ count, href: `/tickets?dashboardFilter=${key}${key.startsWith('recently') ? `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : ''}` });
  const preview = { id: 42, ticketNumber: 'TT-42', summary: 'Adapter replaced', currentStatus: 'RESOLVED', itPriority: 'HIGH', ticketOwner: { id: 5, name: 'Staff A' }, updatedAt: to, resolvedAt: '2026-10-30T11:00:00.000Z', resolutionTimeEstimated: true, href: '/tickets/42' };
  return { asOf: to, timeZone: 'Asia/Bangkok', window: { from, to }, metrics: { open: metric('open', 3), waiting: metric('waiting', 1), recentlyResolved: metric('recentlyResolved', 1), recentlyUpdated: metric('recentlyUpdated', 1) }, recentTickets: [preview], recentResolvedTickets: [preview] };
}
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const fetchMock = vi.fn();
function setup() { return render(<MemoryRouter><RequesterDashboard /></MemoryRouter>); }
beforeEach(() => { auth.user = { id: 1, name: 'Requester A', role: 'REQUESTER' }; fetchMock.mockReset().mockResolvedValue(response(fixture())); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Requester Dashboard', () => {
  it('renders exact role-owned metrics and canonical card/list drill-downs from one bounded endpoint', async () => {
    setup();
    const open = await screen.findByRole('link', { name: 'View 3 open tickets' });
    expect(open).toHaveAttribute('href', '/tickets?dashboardFilter=open');
    expect(screen.getByRole('link', { name: 'View 1 tickets waiting for you' })).toHaveAttribute('href', '/tickets?dashboardFilter=waiting');
    expect(screen.getByRole('link', { name: 'View 1 recently resolved tickets' })).toHaveAttribute('href', fixture().metrics.recentlyResolved.href);
    expect(screen.getByRole('link', { name: 'View 1 recently updated tickets' })).toHaveAttribute('href', fixture().metrics.recentlyUpdated.href);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/dashboards/requester');
    expect(fetchMock.mock.calls[0][1].credentials).toBe('same-origin');
    expect(screen.getAllByRole('link', { name: 'View ticket TT-42: Adapter replaced' })).toHaveLength(2);
    expect(screen.getByText(/Estimated from legacy record/)).toBeInTheDocument();
    expect(screen.getAllByText(/19:00 \(Bangkok\)/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Create Ticket' })).toHaveAttribute('href', '/tickets/new');
  });

  it('shows loading without fabricated zero counts and all zero-card links on empty success', async () => {
    let resolve!: (value: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; }));
    setup();
    expect(screen.getByRole('status')).toHaveTextContent('Loading dashboard');
    expect(screen.queryByRole('region', { name: 'My ticket metrics' })).not.toBeInTheDocument();
    const empty = fixture(); empty.recentTickets = []; empty.recentResolvedTickets = [];
    Object.values(empty.metrics).forEach(metric => { metric.count = 0; });
    resolve(response(empty));
    expect(await screen.findByRole('link', { name: 'View 0 open tickets' })).toBeInTheDocument();
    expect(screen.getByText('No recently updated tickets')).toBeInTheDocument();
    expect(screen.getByText('No recently resolved tickets')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View 0 tickets waiting for you' })).toBeInTheDocument();
  });

  it.each([[403, 'You do not have access to this dashboard.'], [404, 'Dashboard not found.'], [401, 'Your session expired. Sign in again to view your dashboard.']] as const)('handles HTTP %i without leaking protected content', async (status, message) => {
    fetchMock.mockResolvedValueOnce(response({ error: { message: 'secret server payload' } }, status));
    setup();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByRole('link', { name: /View 3 open tickets/ })).not.toBeInTheDocument();
    expect(screen.queryByText('secret server payload')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: status === 401 ? 'Sign in' : 'My Tickets' })).toBeInTheDocument();
  });

  it('retries initial network failure', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('private network detail'));
    setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry dashboard' }));
    expect(await screen.findByRole('link', { name: 'View 3 open tickets' })).toBeInTheDocument();
    expect(screen.queryByText('private network detail')).not.toBeInTheDocument();
  });

  it('retains a visibly timestamped snapshot after refresh failure and recovers on retry', async () => {
    setup(); await screen.findByRole('link', { name: 'View 3 open tickets' });
    fetchMock.mockResolvedValueOnce(response({}, 500));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }));
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent(/Could not refresh; showing data from/);
    expect(error).toHaveTextContent('19:00 (Bangkok)');
    expect(screen.getByRole('link', { name: 'View 3 open tickets' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry dashboard' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('clears the prior snapshot when a refresh becomes forbidden', async () => {
    setup(); await screen.findByRole('link', { name: 'View 3 open tickets' });
    fetchMock.mockResolvedValueOnce(response({}, 403));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }));
    await screen.findByRole('alert');
    expect(screen.queryByRole('link', { name: 'View 3 open tickets' })).not.toBeInTheDocument();
  });

  it('clears cross-account content immediately and ignores late responses from an aborted account', async () => {
    let resolveOld!: (value: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { resolveOld = resolve; }));
    const view = setup();
    const oldSignal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    auth.user = { id: 2, name: 'Requester B', role: 'REQUESTER' };
    const next = fixture(); next.metrics.open.count = 8;
    fetchMock.mockResolvedValueOnce(response(next));
    view.rerender(<MemoryRouter><RequesterDashboard /></MemoryRouter>);
    expect(screen.queryByRole('link', { name: 'View 3 open tickets' })).not.toBeInTheDocument();
    await screen.findByRole('link', { name: 'View 8 open tickets' });
    expect(oldSignal.aborted).toBe(true);
    resolveOld(response(fixture()));
    await waitFor(() => expect(screen.getByRole('link', { name: 'View 8 open tickets' })).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'View 3 open tickets' })).not.toBeInTheDocument();
  });

  it('does not fetch requester metrics for staff or absent sessions', () => {
    auth.user = { id: 5, name: 'Staff A', role: 'IT_STAFF' }; const view = setup();
    expect(screen.getByRole('alert')).toHaveTextContent('requesters only'); expect(fetchMock).not.toHaveBeenCalled();
    auth.user = null; view.rerender(<MemoryRouter><RequesterDashboard /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('Sign in'); expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders supplied text escaped with one navigable link per ticket preview', async () => {
    const data = fixture(); data.recentTickets[0].summary = '<img src=x onerror=alert(1)>';
    fetchMock.mockResolvedValueOnce(response(data));
    const { container } = setup();
    const list = await screen.findByRole('region', { name: 'Recently updated tickets' });
    expect(within(list).getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(within(list).getAllByRole('link')).toHaveLength(2);
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('Requester dashboard DTO and destinations', () => {
  it.each(['https://evil.test', '//evil.test', 'javascript:alert(1)', '/tickets?dashboardFilter=open&requesterId=99', '/tickets?dashboardFilter=open&dashboardFilter=waiting', '/tickets?dashboardFilter=waiting'])('rejects unsafe or mismatched card href %s', href => {
    const data = fixture(); data.metrics.open.href = href;
    expect(() => parseRequesterDashboard(data)).toThrow();
  });
  it('rejects invalid numbers, unbounded lists and mismatched ticket destinations', () => {
    const data = fixture(); data.metrics.open.count = -1;
    expect(() => parseRequesterDashboard(data)).toThrow();
    const large = fixture(); large.recentTickets = Array.from({ length: 6 }, (_, i) => ({ ...large.recentTickets[0], id: i + 1, href: `/tickets/${i + 1}` }));
    expect(() => parseRequesterDashboard(large)).toThrow();
    const wrong = fixture(); wrong.recentTickets[0].href = '/tickets/99';
    expect(() => parseRequesterDashboard(wrong)).toThrow();
  });
  it('rejects mismatched snapshot boundaries and strips private fields', () => {
    const raw = fixture(); raw.metrics.recentlyUpdated.href = raw.metrics.recentlyUpdated.href.replace(encodeURIComponent(to), encodeURIComponent(from));
    expect(() => parseRequesterDashboard(raw)).toThrow();
    const safe = parseRequesterDashboard({ ...fixture(), internalNotes: 'not rendered', recentTickets: [{ ...fixture().recentTickets[0], password: 'secret' }] });
    expect(safe).not.toHaveProperty('internalNotes');
    expect(safe.recentTickets[0]).not.toHaveProperty('password');
  });
});
