import { useEffect, useState } from 'react';
import { formatActionTime } from '../actions-taken/types.js';
import { priorities, record, statuses, workflowJson } from './api.js';

interface EventDTO { id: number; kind: string; name: string; createdAt: string; before: string; after: string }
function displayValue(kind: string, value: unknown): string {
  const data = record(value);
  if (kind === 'STATUS') {
    const status = data?.currentStatus ?? data?.status ?? value;
    return typeof status === 'string' && statuses.includes(status) ? status.replace(/_/g, ' ') : 'Unavailable';
  }
  if (kind === 'PRIORITY') {
    const priority = data?.itPriority ?? value;
    return typeof priority === 'string' && priorities.includes(priority) ? priority : 'Unavailable';
  }
  if (kind === 'OWNER') {
    if (data && Object.prototype.hasOwnProperty.call(data, 'ticketOwner')) {
      if (data.ticketOwner === null) return 'Unassigned';
      const person = record(data.ticketOwner);
      return person && typeof person.id === 'number' && Number.isSafeInteger(person.id) && person.id > 0 && typeof person.name === 'string' ? person.name : 'Unavailable';
    }
    const owner = data?.ticketOwnerId ?? data?.ownerId ?? value;
    if (value === null || data?.ticketOwnerId === null || data?.ownerId === null) return 'Unassigned';
    return typeof owner === 'number' && Number.isSafeInteger(owner) && owner > 0 ? `Staff account ${owner}` : 'Unavailable';
  }
  const timestamp = data && Object.prototype.hasOwnProperty.call(data, 'requesterResolvedAt') ? data.requesterResolvedAt : value;
  if (timestamp === null) return 'Not indicated';
  return typeof timestamp === 'string' && Number.isFinite(new Date(timestamp).getTime()) ? formatActionTime(timestamp) : 'Unavailable';
}
export default function WorkflowHistory({ ticketId, refresh }: { ticketId: number; refresh: number }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(10);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ status: 'loading' | 'error' | 'ready'; events: EventDTO[]; pages: number; total: number }>({ status: 'loading', events: [], pages: 1, total: 0 });
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', events: [], pages: 1, total: 0 });
    workflowJson(`/api/tickets/${ticketId}/history?page=${page}&pageSize=${pageSize}`, { signal: controller.signal }).then(body => {
      if (controller.signal.aborted) return;
      const raw = record(body), pagination = record(raw?.pagination);
      if (!Array.isArray(raw?.data) || !pagination || !Number.isSafeInteger(pagination.totalPages) || Number(pagination.totalPages) < 1 || !Number.isSafeInteger(pagination.total) || Number(pagination.total) < 0) throw new Error('Invalid history');
      const events = raw.data.map(value => {
        const event = record(value), actor = record(event?.actor);
        if (!event || event.ticketId !== ticketId || !Number.isSafeInteger(event.id) || Number(event.id) <= 0 || !['OWNER', 'PRIORITY', 'STATUS', 'REQUESTER_INDICATION'].includes(String(event.kind)) || typeof actor?.name !== 'string' || typeof event.createdAt !== 'string' || !Number.isFinite(new Date(event.createdAt).getTime())) throw new Error('Invalid event');
        return { id: Number(event.id), kind: String(event.kind), name: actor.name, createdAt: event.createdAt, before: displayValue(String(event.kind), event.before), after: displayValue(String(event.kind), event.after) };
      });
      if (page > Number(pagination.totalPages)) { setPage(Number(pagination.totalPages)); return; }
      setState({ status: 'ready', events, pages: Number(pagination.totalPages), total: Number(pagination.total) });
    }).catch(() => { if (!controller.signal.aborted) setState({ status: 'error', events: [], pages: 1, total: 0 }); });
    return () => controller.abort();
  }, [ticketId, refresh, page, pageSize, retry]);
  return <section className="ticket-workflow__history" aria-label="Shared ticket workflow history" aria-busy={state.status === 'loading'}>
    <h3>Shared workflow history</h3>
    {state.status === 'loading' ? <p role="status">Loading workflow history...</p> : null}
    {state.status === 'error' ? <div role="alert"><p>Could not load workflow history.</p><button type="button" onClick={() => setRetry(value => value + 1)}>Retry workflow history</button></div> : null}
    {state.status === 'ready' ? <>
      {state.events.length === 0 ? <p>No recorded history</p> : <ol>{state.events.map(event => <li key={event.id}><p>{({ OWNER: 'Ticket Owner changed', PRIORITY: 'IT Priority changed', STATUS: 'Ticket status changed', REQUESTER_INDICATION: 'Requester advisory recorded' } as Record<string, string>)[event.kind]} by {event.name} · <time dateTime={event.createdAt}>{formatActionTime(event.createdAt)}</time></p><p>{event.before} → {event.after}</p></li>)}</ol>}
      <nav aria-label="Workflow history pages"><button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous workflow page</button><span role="status">History page {page} of {state.pages} · {state.total} events</span><button type="button" disabled={page >= state.pages} onClick={() => setPage(value => value + 1)}>Next workflow page</button><label>Workflow events per page<select value={pageSize} onChange={event => { setPageSize(Number(event.target.value) as 10 | 25 | 50); setPage(1); }}>{[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label></nav>
    </> : null}
  </section>;
}
