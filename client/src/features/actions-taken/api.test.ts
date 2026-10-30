import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActionApiError, createAction, fetchAction, fetchActionHistory, fetchActionOwners, fetchActions, updateAction, type CreateActionBody } from './api.js';

afterEach(() => vi.unstubAllGlobals());
function respond(body: unknown, status = 200) {
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
const input: CreateActionBody = {
  expectedTicketVersion: 7, actionAt: '2026-10-30T05:00:00.000Z', description: 'Inspect adapter',
  result: null, assigneeId: 5, followUpRequired: false, followUpNote: null, attachmentNotes: null,
};

describe('Actions API contract adapter', () => {
  it('passes list pagination, cancellation and same-origin credentials through', async () => {
    const envelope = { data: [], pagination: { page: 2, pageSize: 25, total: 0, totalPages: 1 }, ticketVersion: 7 };
    const fetch = respond(envelope);
    const signal = new AbortController().signal;
    expect(await fetchActions(42, 2, 25, signal)).toEqual(envelope);
    expect(fetch).toHaveBeenCalledWith('/api/tickets/42/actions?page=2&pageSize=25', expect.objectContaining({ credentials: 'same-origin', cache: 'no-store', signal }));
  });
  it('fetches nested detail and history, retaining raw envelope shape', async () => {
    const fetch = respond({ data: [], pagination: { page: 3, pageSize: 10, total: 0, totalPages: 1 } });
    await fetchAction(42, 101);
    await fetchActionHistory(42, 101, 3);
    expect(fetch.mock.calls.map(call => call[0])).toEqual(['/api/tickets/42/actions/101', '/api/tickets/42/actions/101/history?page=3&pageSize=10']);
  });
  it('reads active staff assignment choices from the existing raw owners array', async () => {
    const owners = [{ id: 5, name: 'Staff A' }];
    const fetch = respond(owners);
    expect(await fetchActionOwners()).toEqual(owners);
    expect(fetch.mock.calls[0][0]).toBe('/api/queue/owners');
  });
  it('preserves versions and the same idempotency key across create retries', async () => {
    const fetch = respond({ data: { id: 101 }, ticketVersion: 8 }, 201);
    await createAction(42, input, 'original-key');
    await createAction(42, input, 'original-key');
    for (const [url, init] of fetch.mock.calls) {
      expect(url).toBe('/api/tickets/42/actions');
      expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'original-key' }, body: JSON.stringify(input), credentials: 'same-origin' });
    }
  });
  it('sends both optimistic versions and atomic completion fields in PATCH', async () => {
    const fetch = respond({ data: { id: 101 }, ticketVersion: 9 });
    const body = { expectedTicketVersion: 8, expectedVersion: 2, status: 'COMPLETED' as const, result: 'Fixed', followUpRequired: false, followUpNote: null };
    await updateAction(42, 101, body);
    expect(fetch).toHaveBeenCalledWith('/api/tickets/42/actions/101', expect.objectContaining({ method: 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }));
  });
  it('retains known conflict code but never server text/details', async () => {
    respond({ error: { code: 'STALE_UPDATE', message: 'SECRET SQL', details: { currentTicketVersion: 99, fields: { description: 'SECRET HTML', password: 'SECRET PASSWORD', __proto__: 'secret' } } } }, 409);
    const error = await fetchAction(42, 101).catch(error => error);
    expect(error).toBeInstanceOf(ActionApiError);
    expect(error.status).toBe(409);
    expect(error.code).toBe('STALE_UPDATE');
    expect(Object.keys(error.fields)).toEqual(['description']);
    expect(`${error.message}${JSON.stringify(error)}`).not.toContain('SECRET');
    expect(error).not.toHaveProperty('currentTicketVersion');
  });
  it('does not trust unknown error codes or malformed field maps', async () => {
    respond({ error: { code: '<script>secret</script>', message: 'secret', details: { fields: ['secret'] } } }, 400);
    await expect(fetchAction(42, 101)).rejects.toMatchObject({ code: 'INTERNAL_ERROR', fields: {}, message: 'Please check the action fields.' });
  });
  it.each([401, 403, 404, 413, 429, 500])('has a safe status-specific error for HTTP %s', async status => {
    respond({ error: { code: 'INTERNAL_ERROR', message: 'sensitive response' } }, status);
    const error = await fetchAction(42, 101).catch(error => error);
    expect(error).toBeInstanceOf(ActionApiError);
    expect(error.status).toBe(status);
    expect(error.message).not.toContain('sensitive');
  });
  it('handles non-JSON errors safely', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>private error</html>', { status: 500 })));
    await expect(fetchAction(42, 101)).rejects.toMatchObject({ status: 500, code: 'INTERNAL_ERROR' });
  });
  it('rejects malformed success JSON with a safe error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('broken json', { status: 200 })));
    await expect(fetchAction(42, 101)).rejects.toMatchObject({ status: 502, code: 'INTERNAL_ERROR' });
  });
  it('keeps network errors safe and allows AbortError cancellation to propagate', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('private network detail')).mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));
    vi.stubGlobal('fetch', fetch);
    await expect(fetchAction(42, 101)).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    await expect(fetchAction(42, 101)).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('preserves cancellation while reading the response body', async () => {
    const response = new Response('{}', { status: 200 });
    vi.spyOn(response, 'json').mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(fetchAction(42, 101)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
