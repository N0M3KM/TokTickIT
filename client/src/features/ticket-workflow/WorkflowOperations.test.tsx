import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import WorkflowOperations from './WorkflowOperations.js';
import type { OperationalTicket } from './api.js';

const auth = vi.hoisted(() => ({ user: { id: 5, name: 'Staff A', role: 'IT_STAFF' } as { id: number; name: string; role: string } | null }));
vi.mock('../../context/AuthContext.js', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('../../components/DraftNavigationGuard.js', () => ({ useUnsavedChanges: vi.fn() }));
const ticket: OperationalTicket = { id: 42, ticketOwnerId: 5, itPriority: 'LOW', currentStatus: 'OPEN', requesterResolvedAt: null, version: 7, resolvedAt: null, reopenedAt: null, resolutionTimeEstimated: false, allowedTransitions: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'CANCELLED'], resolutionGate: { reasons: [] } };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const fetchMock = vi.fn();
let handler: (url: string, init?: RequestInit) => Response | Promise<Response>;
function mutations() { return fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH' || init?.method === 'POST'); }
function setup(value: OperationalTicket = ticket) {
  const onSaved = vi.fn();
  const router = createMemoryRouter([{ path: '/', element: <WorkflowOperations ticket={value} onSaved={onSaved} /> }]);
  return { ...render(<RouterProvider router={router} />), onSaved, router };
}
beforeEach(() => {
  auth.user = { id: 5, name: 'Staff A', role: 'IT_STAFF' };
  handler = (url) => {
    if (url === '/api/queue/owners') return json([{ id: 5, name: 'Staff A' }, { id: 6, name: 'Staff B' }]);
    if (url.includes('/history?')) return json({ data: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } });
    return json(ticket);
  };
  fetchMock.mockReset().mockImplementation((input: string, init?: RequestInit) => handler(String(input), init));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('versioned ticket workflow', () => {
  it('chains each successful returned version across owner, priority and status writes', async () => {
    let current = { ...ticket };
    handler = (url, init) => {
      if (url === '/api/queue/owners') return json([{ id: 5, name: 'Staff A' }, { id: 6, name: 'Staff B' }]);
      if (url.includes('/history?')) return json({ data: [], pagination: { total: 0, totalPages: 1 } });
      const body = JSON.parse(String(init?.body));
      expect(body.expectedVersion).toBe(current.version);
      current = { ...current, version: current.version + 1, ...(url.endsWith('/owner') ? { ticketOwnerId: body.ownerId } : url.endsWith('/it-priority') ? { itPriority: body.itPriority } : { currentStatus: body.status }) };
      return json(current);
    };
    const { onSaved } = setup();
    await screen.findByRole('option', { name: 'Staff B' });
    fireEvent.change(screen.getByLabelText('Ticket Owner'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('IT Priority'), { target: { value: 'HIGH' } });
    fireEvent.change(screen.getByLabelText('Current Status'), { target: { value: 'IN_PROGRESS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await screen.findByText('Ticket updated.');
    expect(mutations().map(([url]) => url)).toEqual(['/api/tickets/42/owner', '/api/tickets/42/it-priority', '/api/tickets/42/status']);
    expect(mutations().map(([, init]) => JSON.parse(init.body).expectedVersion)).toEqual([7, 8, 9]);
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it('retains draft after a partial save and conflict; explicitly reconciles before retry', async () => {
    let savedOwner = false, reconciled = false;
    handler = (url, init) => {
      if (url === '/api/queue/owners') return json([{ id: 5, name: 'Staff A' }, { id: 6, name: 'Staff B' }]);
      if (url.includes('/history?')) return json({ data: [], pagination: { total: 0, totalPages: 1 } });
      if (url.endsWith('/owner')) { savedOwner = true; return json({ ...ticket, ticketOwnerId: 6, version: 8 }); }
      if (url === '/api/tickets/42') return json({ ...ticket, ticketOwnerId: 6, itPriority: 'MEDIUM', version: 10 });
      if (!reconciled) return json({ error: { code: 'STALE_UPDATE', message: 'raw private error ignored' } }, 409);
      expect(JSON.parse(String(init?.body)).expectedVersion).toBe(10);
      return json({ ...ticket, ticketOwnerId: 6, itPriority: 'HIGH', version: 11 });
    };
    setup(); await screen.findByRole('option', { name: 'Staff B' });
    fireEvent.change(screen.getByLabelText('Ticket Owner'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('IT Priority'), { target: { value: 'HIGH' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await screen.findByRole('button', { name: 'Reload latest ticket' });
    expect(savedOwner).toBe(true);
    expect(screen.getByLabelText('IT Priority')).toHaveValue('HIGH');
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
    expect(screen.queryByText('raw private error ignored')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reload latest ticket' }));
    const panel = await screen.findByRole('region', { name: 'Latest ticket values' });
    expect(within(panel).getByText('MEDIUM')).toBeInTheDocument();
    expect(screen.getByLabelText('IT Priority')).toHaveValue('HIGH');
    reconciled = true;
    fireEvent.click(screen.getByRole('button', { name: 'Use latest version and keep my draft' }));
    expect(mutations()).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await screen.findByText('Ticket updated.');
    expect(mutations()).toHaveLength(3);
  });

  it('limits status choices to returned transitions and explains impossible resolution', async () => {
    setup({ ...ticket, currentStatus: 'IN_PROGRESS', allowedTransitions: ['RESOLVED', 'CANCELLED'], resolutionGate: { reasons: ['OPEN_ACTIONS', 'FOLLOW_UP_OUTSTANDING'] } });
    await screen.findByText('No recorded history');
    const choices = within(screen.getByLabelText('Current Status'));
    expect(choices.getByRole('option', { name: 'RESOLVED' })).toBeDisabled();
    expect(choices.queryByRole('option', { name: 'CLOSED' })).not.toBeInTheDocument();
    expect(screen.getByText('Complete or cancel all open actions before resolving.')).toBeInTheDocument();
    expect(screen.getByText('Finish outstanding follow-up before resolving.')).toBeInTheDocument();
  });

  it('renders racing resolution gate failures as safe actionable reasons', async () => {
    handler = (url) => url.includes('/history?') ? json({ data: [], pagination: { total: 0, totalPages: 1 } }) : url === '/api/queue/owners' ? json([{ id: 5, name: 'Staff A' }]) : json({ error: { code: 'RESOLUTION_BLOCKED', details: { reasons: ['NO_COMPLETED_ACTION', 'secret note'] } } }, 409);
    setup({ ...ticket, currentStatus: 'IN_PROGRESS', allowedTransitions: ['RESOLVED'] });
    await screen.findByRole('option', { name: 'Staff A' });
    fireEvent.change(screen.getByLabelText('Current Status'), { target: { value: 'RESOLVED' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await screen.findByText('Complete an action before resolving.');
    expect(screen.queryByText('secret note')).not.toBeInTheDocument();
  });

  it('lets requesters reopen only permitted tickets with expectedVersion and no staff controls', async () => {
    auth.user = { id: 3, name: 'Requester', role: 'REQUESTER' };
    handler = (url, init) => url.includes('/history?') ? json({ data: [], pagination: { total: 0, totalPages: 1 } }) : json({ ...ticket, currentStatus: 'REOPENED', version: 8, allowedTransitions: [] });
    setup({ ...ticket, currentStatus: 'CLOSED', allowedTransitions: ['REOPENED'] });
    expect(screen.queryByLabelText('Ticket Owner')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reopen ticket' }));
    await screen.findByText(/Ticket reopened. Fresh completed work/);
    expect(JSON.parse(mutations()[0][1].body)).toEqual({ status: 'REOPENED', expectedVersion: 7 });
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/queue/owners')).toBe(false);
  });

  it('records requester advice with version while preserving its advisory wording', async () => {
    auth.user = { id: 3, name: 'Requester', role: 'REQUESTER' };
    handler = (url) => url.includes('/history?') ? json({ data: [], pagination: { total: 0, totalPages: 1 } }) : json({ requesterResolvedAt: '2026-10-30T12:00:00Z', version: 8 });
    setup();
    expect(screen.queryByRole('button', { name: 'Reopen ticket' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Problem Appears Resolved' }));
    await screen.findByText(/Problem-resolved advice recorded/);
    expect(JSON.parse(mutations()[0][1].body)).toEqual({ expectedVersion: 7 });
    expect(screen.getByRole('button', { name: 'Advice recorded' })).toBeDisabled();
    expect(screen.getByText(/This is not formal ticket resolution/)).toBeInTheDocument();
  });

  it('renders allowlisted paged shared history without secret payloads or mutation controls', async () => {
    handler = (url) => url === '/api/queue/owners' ? json([{ id: 5, name: 'Staff A' }]) : json({ data: [{ id: 1, ticketId: 42, kind: 'STATUS', actor: { id: 5, name: 'Staff A', role: 'IT_STAFF' }, before: { currentStatus: 'OPEN', internalNote: 'secret before' }, after: { currentStatus: 'IN_PROGRESS', password: 'secret password' }, createdAt: '2026-10-30T12:00:00Z' }], pagination: { total: 11, totalPages: 2 } });
    setup();
    await screen.findByText('OPEN → IN PROGRESS');
    expect(screen.queryByText(/secret before|secret password/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete.*history/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next workflow page' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('history?page=2&pageSize=10'))).toBe(true));
  });

  it('retries history failure without losing the dirty workflow draft', async () => {
    let broken = true;
    handler = (url) => url === '/api/queue/owners' ? json([{ id: 5, name: 'Staff A' }]) : broken ? json({}, 500) : json({ data: [], pagination: { total: 0, totalPages: 1 } });
    setup();
    await screen.findByRole('button', { name: 'Retry workflow history' });
    fireEvent.change(screen.getByLabelText('IT Priority'), { target: { value: 'CRITICAL' } });
    broken = false; fireEvent.click(screen.getByRole('button', { name: 'Retry workflow history' }));
    await screen.findByText('No recorded history');
    expect(screen.getByLabelText('IT Priority')).toHaveValue('CRITICAL');
  });

  it('retains a dirty draft when the parent receives a newer ticket', async () => {
    const onSaved = vi.fn();
    const view = render(<WorkflowOperations ticket={ticket} onSaved={onSaved} />);
    await screen.findByRole('option', { name: 'Staff B' });
    fireEvent.change(screen.getByLabelText('IT Priority'), { target: { value: 'CRITICAL' } });
    view.rerender(<WorkflowOperations ticket={{ ...ticket, version: 10, itPriority: 'MEDIUM' }} onSaved={onSaved} />);
    expect(screen.getByLabelText('IT Priority')).toHaveValue('CRITICAL');
  });

  it('pauses writes after an unknown network outcome and never blindly retries', async () => {
    handler = (url) => {
      if (url === '/api/queue/owners') return json([{ id: 5, name: 'Staff A' }]);
      if (url.includes('/history?')) return json({ data: [], pagination: { total: 0, totalPages: 1 } });
      throw new TypeError('connection dropped with private text');
    };
    setup(); await screen.findByRole('option', { name: 'Staff A' });
    fireEvent.change(screen.getByLabelText('IT Priority'), { target: { value: 'CRITICAL' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await screen.findByRole('button', { name: 'Reload latest ticket' });
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
    expect(screen.getByLabelText('IT Priority')).toHaveValue('CRITICAL');
    expect(mutations()).toHaveLength(1);
    expect(screen.queryByText('connection dropped with private text')).not.toBeInTheDocument();
  });

  it('renders safe nested owner attribution and an initially absent requester indication', async () => {
    handler = (url) => url === '/api/queue/owners' ? json([{ id: 5, name: 'Staff A' }]) : json({ data: [
      { id: 1, ticketId: 42, kind: 'OWNER', actor: { id: 5, name: 'Staff A', role: 'IT_STAFF' }, before: { ticketOwner: null }, after: { ticketOwner: { id: 6, name: 'Next Owner', email: 'secret@example.test' } }, createdAt: '2026-10-30T12:00:00Z' },
      { id: 2, ticketId: 42, kind: 'REQUESTER_INDICATION', actor: { id: 3, name: 'Requester', role: 'REQUESTER' }, before: { requesterResolvedAt: null }, after: { requesterResolvedAt: '2026-10-30T12:00:00Z' }, createdAt: '2026-10-30T12:00:00Z' },
    ], pagination: { total: 2, totalPages: 1 } });
    setup();
    await screen.findByText('Unassigned → Next Owner');
    expect(screen.getByText(/Not indicated →/)).toBeInTheDocument();
    expect(screen.queryByText('secret@example.test')).not.toBeInTheDocument();
  });

  it('hides all workflow content for an absent session', () => {
    auth.user = null; setup();
    expect(screen.queryByRole('region', { name: 'Ticket workflow' })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
