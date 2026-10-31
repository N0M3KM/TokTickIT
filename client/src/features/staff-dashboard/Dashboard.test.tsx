import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StaffDashboard from './Dashboard.js';
import { parseStaffDashboard, PRIORITY_ORDER, STATUS_ORDER } from './api.js';

const auth = vi.hoisted(() => ({ user: { id: 5, name: 'Staff A', role: 'IT_STAFF' } as { id: number; name: string; role: string } | null }));
vi.mock('../../context/AuthContext.js', () => ({ useAuth: () => ({ user: auth.user }) }));
const from = '2026-10-24T17:00:00.000Z', to = '2026-10-31T12:00:00.000Z';
const recentHref = `/queue?dashboardFilter=recentlyUpdated&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
function fixture() {
  return {
    asOf: to, timeZone: 'Asia/Bangkok', window: { from, to }, metrics: {
      unassigned: { count: 4, href: '/queue?dashboardFilter=unassigned' }, ownedByMe: { count: 7, href: '/queue?dashboardFilter=ownedByMe' }, recentlyUpdated: { count: 9, href: recentHref },
      byStatus: STATUS_ORDER.map((status, i) => ({ status, count: i, href: `/queue?status=${status}` })),
      byPriority: PRIORITY_ORDER.map((itPriority, i) => ({ itPriority, count: i, href: `/queue?dashboardFilter=open&itPriority=${itPriority}` })),
    },
    myActions: { actionCount: 3, ticketCount: 2, href: '/queue?dashboardFilter=myActions', items: [
      { id: 101, ticketId: 42, ticketNumber: 'TT-42', description: 'Inspect adapter', status: 'PLANNED', actionAt: to, followUpRequired: true, href: '/tickets/42#action-101' },
      { id: 102, ticketId: 42, ticketNumber: 'TT-42', description: 'Replace adapter', status: 'IN_PROGRESS', actionAt: to, followUpRequired: false, href: '/tickets/42#action-102' },
    ] },
    recentTickets: [{ id: 42, ticketNumber: 'TT-42', summary: 'Network problem', currentStatus: 'IN_PROGRESS', itPriority: 'HIGH', ticketOwner: { id: 6, name: 'Different Ticket Owner' }, updatedAt: to, resolvedAt: null, resolutionTimeEstimated: false, href: '/tickets/42' }],
  };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const fetchMock = vi.fn();
const setup = () => render(<MemoryRouter><StaffDashboard /></MemoryRouter>);
beforeEach(() => { auth.user = { id: 5, name: 'Staff A', role: 'IT_STAFF' }; fetchMock.mockReset().mockResolvedValue(json(fixture())); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Staff and Administrator Dashboard', () => {
  it('renders operational metrics, exact buckets and distinct action/ticket destinations from one endpoint', async () => {
    setup();
    expect(await screen.findByRole('link', { name: 'View 4 unassigned tickets' })).toHaveAttribute('href', '/queue?dashboardFilter=unassigned');
    expect(screen.getByRole('link', { name: 'View 7 active tickets assigned to me' })).toHaveAttribute('href', '/queue?dashboardFilter=ownedByMe');
    expect(screen.getByRole('link', { name: 'View 2 related tickets for my 3 active actions' })).toHaveAttribute('href', '/queue?dashboardFilter=myActions');
    expect(screen.getByRole('link', { name: 'View 9 recently updated tickets' })).toHaveAttribute('href', recentHref);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Operational overview')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Tickets by status' })).getAllByRole('link')).toHaveLength(8);
    expect(within(screen.getByRole('region', { name: 'Active tickets by IT priority' })).getAllByRole('link')).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'View 2 in progress tickets' })).toHaveAttribute('href', '/queue?status=IN_PROGRESS');
    expect(screen.getByRole('link', { name: 'View 3 active critical priority tickets' })).toHaveAttribute('href', '/queue?dashboardFilter=open&itPriority=CRITICAL');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/dashboards/staff');
    expect(fetchMock.mock.calls[0][1].credentials).toBe('same-origin');
  });
  it('distinguishes individual assigned action anchors from the related-ticket queue', async () => {
    setup();
    const actions = await screen.findByRole('region', { name: 'My active actions' });
    expect(within(actions).getByRole('link', { name: 'View 2 related tickets' })).toHaveAttribute('href', '/queue?dashboardFilter=myActions');
    expect(within(actions).getByRole('link', { name: 'View action 101 on ticket TT-42: Inspect adapter' })).toHaveAttribute('href', '/tickets/42#action-101');
    expect(within(actions).getByRole('link', { name: 'View action 102 on ticket TT-42: Replace adapter' })).toHaveAttribute('href', '/tickets/42#action-102');
    expect(within(actions).getByText(/3 active actions assigned to you across 2 related tickets/)).toBeInTheDocument();
    expect(screen.getByText('Different Ticket Owner')).toBeInTheDocument();
    expect(within(actions).getByText('Planned')).toBeInTheDocument(); expect(within(actions).getByText('In progress')).toBeInTheDocument();
    expect(screen.getAllByText(/19:00 \(Bangkok\)/).length).toBeGreaterThan(0);
  });
  it('reuses staff scope for the signed-in Administrator without adding unrelated widgets', async () => {
    auth.user = { id: 9, name: 'Administrator', role: 'ADMINISTRATOR' }; setup();
    await screen.findByRole('link', { name: 'View 7 active tickets assigned to me' });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/dashboards/staff');
    expect(screen.queryByRole('link', { name: 'Create Ticket' })).not.toBeInTheDocument();
    expect(screen.queryByText(/SLA|account count/i)).not.toBeInTheDocument();
  });
  it('shows loading without invented metrics, then all zero status and priority buckets', async () => {
    let resolve!: (value: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; }));
    setup(); expect(screen.getByRole('status')).toHaveTextContent('Loading dashboard');
    expect(screen.queryByRole('region', { name: 'Operational metrics' })).not.toBeInTheDocument();
    const data = fixture(); data.metrics.unassigned.count = 0; data.metrics.ownedByMe.count = 0; data.metrics.recentlyUpdated.count = 0;
    data.metrics.byStatus.forEach(bucket => { bucket.count = 0; }); data.metrics.byPriority.forEach(bucket => { bucket.count = 0; });
    data.myActions = { actionCount: 0, ticketCount: 0, href: '/queue?dashboardFilter=myActions', items: [] }; data.recentTickets = [];
    resolve(json(data));
    await screen.findByText('No actions assigned to you'); expect(screen.getByText('No recently updated tickets')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Tickets by status' })).getAllByRole('link', { name: /^View 0 / })).toHaveLength(8);
    expect(within(screen.getByRole('region', { name: 'Active tickets by IT priority' })).getAllByRole('link', { name: /^View 0 / })).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'View 0 related tickets for my 0 active actions' })).toBeInTheDocument();
  });
  it.each([[403, 'You do not have access to this dashboard.'], [404, 'Dashboard not found.'], [401, 'Your session expired. Sign in again to view your dashboard.']] as const)('handles HTTP %i with a safe state and no protected cards', async (status, message) => {
    fetchMock.mockResolvedValueOnce(json({ error: { message: 'raw secret details' } }, status)); setup();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByRole('region', { name: 'Operational metrics' })).not.toBeInTheDocument();
    expect(screen.queryByText('raw secret details')).not.toBeInTheDocument();
  });
  it('retries initial failure and retains a dated snapshot after failed refresh', async () => {
    fetchMock.mockRejectedValueOnce(new Error('private network info')); setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry dashboard' }));
    await screen.findByRole('link', { name: 'View 4 unassigned tickets' });
    fetchMock.mockResolvedValueOnce(json({}, 500));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not refresh; showing data from.*19:00 \(Bangkok\)/);
    expect(screen.getByRole('link', { name: 'View 4 unassigned tickets' })).toBeInTheDocument();
    expect(screen.queryByText('private network info')).not.toBeInTheDocument();
  });
  it('clears a saved snapshot after authorization fails', async () => {
    setup(); await screen.findByRole('link', { name: 'View 4 unassigned tickets' });
    fetchMock.mockResolvedValueOnce(json({}, 403)); fireEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }));
    await screen.findByRole('alert'); expect(screen.queryByRole('link', { name: 'View 4 unassigned tickets' })).not.toBeInTheDocument();
  });
  it('clears account and role-specific snapshots immediately and ignores late aborted responses', async () => {
    const view = setup(); await screen.findByRole('link', { name: 'View 4 unassigned tickets' });
    let resolveOld!: (value: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { resolveOld = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }));
    const signal = fetchMock.mock.calls[1][1].signal as AbortSignal;
    auth.user = { id: 5, name: 'Administrator', role: 'ADMINISTRATOR' };
    const next = fixture(); next.metrics.ownedByMe.count = 12; fetchMock.mockResolvedValueOnce(json(next));
    view.rerender(<MemoryRouter><StaffDashboard /></MemoryRouter>);
    expect(screen.queryByRole('link', { name: 'View 7 active tickets assigned to me' })).not.toBeInTheDocument();
    await screen.findByRole('link', { name: 'View 12 active tickets assigned to me' }); expect(signal.aborted).toBe(true);
    resolveOld(json(fixture()));
    await waitFor(() => expect(screen.getByRole('link', { name: 'View 12 active tickets assigned to me' })).toBeInTheDocument());
    auth.user = { id: 6, name: 'Another staff', role: 'IT_STAFF' }; const another = fixture(); another.metrics.ownedByMe.count = 0; fetchMock.mockResolvedValueOnce(json(another));
    view.rerender(<MemoryRouter><StaffDashboard /></MemoryRouter>);
    expect(screen.queryByRole('link', { name: 'View 12 active tickets assigned to me' })).not.toBeInTheDocument();
    await screen.findByRole('link', { name: 'View 0 active tickets assigned to me' });
  });
  it('does not request data for requesters or absent sessions', () => {
    auth.user = { id: 1, name: 'Requester', role: 'REQUESTER' }; const view = setup();
    expect(screen.getByRole('alert')).toHaveTextContent('IT Staff and Administrators only'); expect(fetchMock).not.toHaveBeenCalled();
    auth.user = null; view.rerender(<MemoryRouter><StaffDashboard /></MemoryRouter>); expect(screen.getByRole('alert')).toHaveTextContent('Sign in'); expect(fetchMock).not.toHaveBeenCalled();
  });
  it('escapes action/ticket content and exposes one action-detail link per preview', async () => {
    const data = fixture(); data.myActions.items[0].description = '<img src=x onerror=alert(1)>'; data.recentTickets[0].summary = '<script>danger</script>';
    fetchMock.mockResolvedValueOnce(json(data)); const { container } = setup();
    const actions = await screen.findByRole('region', { name: 'My active actions' });
    expect(within(actions).getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(within(actions).getAllByRole('link')).toHaveLength(3);
    expect(screen.getByText('<script>danger</script>')).toBeInTheDocument(); expect(container.querySelector('img,script')).toBeNull();
  });
});

describe('Staff dashboard DTO and safe navigation', () => {
  it.each(['https://evil.test/queue', '//evil.test', 'javascript:alert(1)', '/queue?dashboardFilter=unassigned&userId=6', '/queue?dashboardFilter=ownedByMe', '/queue?dashboardFilter=unassigned&dashboardFilter=ownedByMe'])('rejects unsafe or identity-bearing href %s', href => {
    const data = fixture(); data.metrics.unassigned.href = href; expect(() => parseStaffDashboard(data)).toThrow();
  });
  it('requires all unique status and priority buckets and normalizes enum order', () => {
    const missing = fixture(); missing.metrics.byStatus.pop(); expect(() => parseStaffDashboard(missing)).toThrow();
    const duplicate = fixture(); duplicate.metrics.byPriority[1] = duplicate.metrics.byPriority[0]; expect(() => parseStaffDashboard(duplicate)).toThrow();
    const reversed = fixture(); reversed.metrics.byStatus.reverse(); expect(parseStaffDashboard(reversed).metrics.byStatus.map(bucket => bucket.status)).toEqual([...STATUS_ORDER]);
  });
  it('rejects wrong action anchors, excessive preview text, invalid counts and unbounded arrays', () => {
    const wrong = fixture(); wrong.myActions.items[0].href = '/tickets/42#action-102'; expect(() => parseStaffDashboard(wrong)).toThrow();
    const long = fixture(); long.myActions.items[0].description = 'x'.repeat(121); expect(() => parseStaffDashboard(long)).toThrow();
    const negative = fixture(); negative.myActions.actionCount = -1; expect(() => parseStaffDashboard(negative)).toThrow();
    const many = fixture(); many.recentTickets = Array.from({ length: 6 }, (_, i) => ({ ...many.recentTickets[0], id: i + 1, href: `/tickets/${i + 1}` })); expect(() => parseStaffDashboard(many)).toThrow();
  });
  it('rejects mismatched recent windows and hidden priority scope overrides', () => {
    const dates = fixture(); dates.metrics.recentlyUpdated.href = '/queue?dashboardFilter=recentlyUpdated&from=bad&to=bad'; expect(() => parseStaffDashboard(dates)).toThrow();
    const priority = fixture(); priority.metrics.byPriority[0].href = '/queue?itPriority=LOW'; expect(() => parseStaffDashboard(priority)).toThrow();
  });
  it('strips private metadata rather than forwarding it to the rendered DTO', () => {
    const data = fixture();
    const parsed = parseStaffDashboard({ ...data, internalNotes: 'secret', myActions: { ...data.myActions, items: [{ ...data.myActions.items[0], password: 'secret' }] }, recentTickets: [{ ...data.recentTickets[0], requesterEmail: 'private@example.test' }] });
    expect(parsed).not.toHaveProperty('internalNotes'); expect(parsed.myActions.items[0]).not.toHaveProperty('password'); expect(parsed.recentTickets[0]).not.toHaveProperty('requesterEmail');
  });
  it('accepts the backend 120-code-point preview cap including non-BMP characters', () => {
    const data = fixture(); data.myActions.items[0].description = '😀'.repeat(120);
    expect(parseStaffDashboard(data).myActions.items[0].description).toBe(data.myActions.items[0].description);
    data.myActions.items[0].description += 'x'; expect(() => parseStaffDashboard(data)).toThrow();
  });
});
