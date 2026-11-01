import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TicketActions from './TicketActions.js';
import type { AuthUser } from '../../context/AuthContext.js';
import type { ActionDTO } from './types.js';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const actor = { id: 5, name: 'Staff A', role: 'IT_STAFF' as const };
const staff: AuthUser = { ...actor, mustChangePassword: false };
const requester: AuthUser = { id: 2, name: 'Requester A', role: 'REQUESTER', mustChangePassword: false };
const ticket = { id: 42, ticketNumber: 'LAB4-42', createdAt: '2026-10-01T00:00:00Z', currentStatus: 'OPEN' };
const action: ActionDTO = {
  id: 101, ticketId: 42, actionAt: '2026-10-05T05:00:00Z', description: 'Inspect original adapter',
  result: null, performedBy: actor, assignee: { ...actor, isActive: true }, followUpRequired: false,
  followUpNote: null, attachmentNotes: null, status: 'PLANNED', cancellationReason: null,
  version: 2, updatedBy: actor, createdAt: '2026-10-05T05:00:00Z', updatedAt: '2026-10-05T05:00:00Z',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
type Mutation = (url: string, init: RequestInit) => Promise<Response> | Response;
function setup(options: { user?: AuthUser; status?: string; actions?: ActionDTO[]; hash?: string; mutation?: Mutation; latest?: ActionDTO } = {}) {
  const fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    if (init.method === 'POST' || init.method === 'PATCH') {
      return options.mutation ? options.mutation(url, init) : json({ data: action, ticketVersion: 8 }, init.method === 'POST' ? 201 : 200);
    }
    if (url === '/api/queue/owners') return json([{ id: 5, name: 'Staff A' }]);
    if (/\/actions\/\d+$/.test(url)) return json({ data: options.latest ?? { ...action, id: 999 }, ticketVersion: 11 });
    return json({ data: options.actions ?? [action], pagination: { page: 1, pageSize: 10, total: (options.actions ?? [action]).length, totalPages: 1 }, ticketVersion: 7 });
  });
  vi.stubGlobal('fetch', fetch);
  const onSaved = vi.fn();
  const router = createMemoryRouter([{ path: '/tickets/:id', element: <TicketActions ticket={{ ...ticket, currentStatus: options.status ?? 'OPEN' }} user={options.user ?? staff} onSaved={onSaved} /> }], { initialEntries: [`/tickets/42${options.hash ?? ''}`] });
  render(<RouterProvider router={router} />);
  const mutations = () => fetch.mock.calls.filter(([, init]) => init?.method === 'POST' || init?.method === 'PATCH');
  return { fetch, mutations, onSaved };
}
async function addDraft(description = 'Check new adapter') {
  const button = await screen.findByRole('button', { name: 'Add action' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  fireEvent.change(screen.getByLabelText('Action description'), { target: { value: description } });
}

describe('Ticket Actions real adapter integration', () => {
  it('keeps requester read-only and does not request staff assignment choices', async () => {
    const { fetch, mutations } = setup({ user: requester });
    expect(await screen.findByText('Inspect original adapter')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add action' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit action 101' })).not.toBeInTheDocument();
    expect(fetch.mock.calls.some(([url]) => url === '/api/queue/owners')).toBe(false);
    expect(mutations()).toHaveLength(0);
  });
  it('creates with ticket version, server-owned attribution omitted and successful refresh', async () => {
    const { mutations, onSaved } = setup({ actions: [] });
    await addDraft('  Check new adapter  ');
    fireEvent.click(screen.getByRole('button', { name: 'Save action' }));
    await screen.findByText('Action saved.');
    expect(onSaved).toHaveBeenCalledOnce();
    expect(mutations()).toHaveLength(1);
    const [url, init] = mutations()[0];
    expect(url).toBe('/api/tickets/42/actions');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ expectedTicketVersion: 7, description: 'Check new adapter', assigneeId: 5, followUpRequired: false });
    expect(body).not.toHaveProperty('performedById');
    expect(body).not.toHaveProperty('ticketId');
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/i);
  });
  it('retains unknown-outcome draft and retries the exact original body and key', async () => {
    let attempts = 0;
    const { mutations } = setup({ actions: [], mutation: () => {
      if (++attempts === 1) throw new TypeError('Connection closed after request');
      return json({ data: action, ticketVersion: 8 });
    } });
    await addDraft('Preserve this draft');
    fireEvent.click(screen.getByRole('button', { name: 'Save action' }));
    const retry = await screen.findByRole('button', { name: 'Retry original submission' });
    expect(screen.getByLabelText('Action description')).toHaveValue('Preserve this draft');
    expect(screen.getByLabelText('Action description')).toBeDisabled();
    fireEvent.click(retry);
    await screen.findByText('Action saved.');
    expect(mutations()).toHaveLength(2);
    expect(mutations()[0][1].body).toBe(mutations()[1][1].body);
    expect(mutations()[0][1].headers).toEqual(mutations()[1][1].headers);
  });
  it('requires explicit stale reconciliation and keeps draft while adopting latest versions', async () => {
    let attempts = 0;
    const latest = { ...action, version: 4, description: 'Concurrent server edit' };
    const { mutations } = setup({ latest, mutation: () => ++attempts === 1
      ? json({ error: { code: 'STALE_UPDATE', message: 'private detail' } }, 409)
      : json({ data: latest, ticketVersion: 12 }) });
    fireEvent.click(await screen.findByRole('button', { name: 'Edit action 101' }));
    fireEvent.change(screen.getByLabelText('Action description'), { target: { value: 'My retained edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reload latest values' }));
    const accept = await screen.findByRole('button', { name: 'Use latest versions and keep my draft' });
    expect(screen.getByLabelText('Action description')).toHaveValue('My retained edit');
    expect(screen.getByLabelText('Action description')).toBeDisabled();
    expect(screen.getByText('Concurrent server edit')).toBeInTheDocument();
    expect(mutations()).toHaveLength(1);
    fireEvent.click(accept);
    expect(screen.getByLabelText('Action description')).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('Action saved.');
    expect(JSON.parse(mutations()[1][1].body as string)).toMatchObject({ description: 'My retained edit', expectedVersion: 4, expectedTicketVersion: 11 });
  });
  it('keeps terminal tickets and terminal actions read-only', async () => {
    const first = setup({ status: 'RESOLVED' });
    await screen.findByText('Inspect original adapter');
    expect(screen.queryByRole('button', { name: 'Add action' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit action 101' })).not.toBeInTheDocument();
    expect(first.mutations()).toHaveLength(0);
    cleanup();
    const second = setup({ actions: [{ ...action, status: 'COMPLETED', result: 'Fixed' }] });
    await screen.findByText('Inspect original adapter');
    expect(screen.queryByRole('button', { name: 'Edit action 101' })).not.toBeInTheDocument();
    expect(second.mutations()).toHaveLength(0);
  });
  it('loads and focuses a linked action outside the current page', async () => {
    const { fetch } = setup({ user: requester, hash: '#action-999' });
    const linked = await screen.findByRole('region', { name: 'Linked action 999' });
    await waitFor(() => expect(linked).toHaveFocus());
    expect(linked).toHaveTextContent('This action is outside the current list page.');
    expect(fetch.mock.calls.some(([url]) => url === '/api/tickets/42/actions/999')).toBe(true);
  });
  it('locks duplicate submissions while a create is in flight', async () => {
    let finish: (response: Response) => void = () => undefined;
    const { mutations } = setup({ actions: [], mutation: () => new Promise(resolve => { finish = resolve; }) });
    await addDraft();
    const form = screen.getByRole('button', { name: 'Save action' }).closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(mutations()).toHaveLength(1);
    expect(screen.getByLabelText('Action description')).toBeDisabled();
    finish(json({ data: action, ticketVersion: 8 }));
    await screen.findByText('Action saved.');
    expect(mutations()).toHaveLength(1);
  });
});
