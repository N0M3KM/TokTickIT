import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useUnsavedChanges } from '../../components/DraftNavigationGuard.js';
import { formatActionTime } from '../actions-taken/types.js';
import { gateMessages, parseOperationalTicket, priorities, record, workflowJson, WorkflowError, type OperationalTicket } from './api.js';
import WorkflowHistory from './WorkflowHistory.js';
import './workflow.css';
export type { OperationalTicket } from './api.js';

export default function WorkflowOperations({ ticket, onSaved }: { ticket: OperationalTicket; onSaved: () => void }) {
  const { user } = useAuth();
  const staff = user?.role === 'IT_STAFF' || user?.role === 'ADMINISTRATOR';
  const [baseline, setBaseline] = useState(ticket);
  const [owners, setOwners] = useState<{ id: number; name: string }[]>([]);
  const [ownersFailed, setOwnersFailed] = useState(false);
  const [ownerRetry, setOwnerRetry] = useState(0);
  const [owner, setOwner] = useState(String(ticket.ticketOwnerId ?? ''));
  const [priority, setPriority] = useState(ticket.itPriority);
  const [status, setStatus] = useState(ticket.currentStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [latest, setLatest] = useState<OperationalTicket | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const writing = useRef(false);
  const dirty = owner !== String(baseline.ticketOwnerId ?? '') || priority !== baseline.itPriority || status !== baseline.currentStatus;
  useUnsavedChanges(dirty || busy || blocked);
  const knownReasons = baseline.resolutionGate?.reasons ?? [];
  const locked = busy || blocked || !user;
  useEffect(() => {
    const refreshedMetadata = ticket.version === baseline.version && (JSON.stringify(ticket.allowedTransitions) !== JSON.stringify(baseline.allowedTransitions) || JSON.stringify(ticket.resolutionGate) !== JSON.stringify(baseline.resolutionGate));
    if ((ticket.version > baseline.version || refreshedMetadata) && !dirty && !busy && !blocked) {
      setBaseline(ticket); setOwner(String(ticket.ticketOwnerId ?? '')); setPriority(ticket.itPriority); setStatus(ticket.currentStatus);
    }
  }, [ticket, baseline.version, baseline.allowedTransitions, baseline.resolutionGate, dirty, busy, blocked]);
  useEffect(() => {
    if (!staff) return;
    const controller = new AbortController(); setOwnersFailed(false);
    workflowJson('/api/queue/owners', { signal: controller.signal }).then(body => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(body) || !body.every(item => { const person = record(item); return person && Number.isSafeInteger(person.id) && Number(person.id) > 0 && typeof person.name === 'string'; })) throw new Error('Invalid owner list');
      setOwners(body.map(item => { const person = record(item)!; return { id: Number(person.id), name: String(person.name) }; }));
    }).catch(() => { if (!controller.signal.aborted) setOwnersFailed(true); });
    return () => controller.abort();
  }, [staff, ownerRetry]);
  function failed(reason: unknown) {
    const failure = reason instanceof WorkflowError ? reason : new WorkflowError(0, 'UNKNOWN_OUTCOME');
    setError(failure.message); setSuccess(''); setReasons(failure.reasons);
    if (failure.status === 0 || failure.status >= 500 || failure.status === 409 || failure.code === 'INVALID_TRANSITION') { setBlocked(true); setLatest(null); }
  }
  async function mutate(path: string, data: object, current: OperationalTicket) {
    const body = await workflowJson(`/api/tickets/${ticket.id}/${path}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, expectedVersion: current.version }) });
    const next = parseOperationalTicket(body, current);
    if (next.id !== ticket.id || next.version <= current.version) throw new WorkflowError(0, 'INVALID_RESPONSE');
    setBaseline(next); setHistoryRefresh(value => value + 1); return next;
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (locked || writing.current || !staff || !dirty) return;
    if (owner && !owners.some(person => String(person.id) === owner)) { setError('Choose an active Ticket Owner or Unassigned.'); return; }
    if (status !== baseline.currentStatus && !baseline.allowedTransitions.includes(status)) { setError('Select a permitted next ticket status.'); return; }
    if (status === 'RESOLVED' && status !== baseline.currentStatus && knownReasons.length) { setReasons(knownReasons); setError('This ticket cannot be resolved yet.'); return; }
    writing.current = true; setBusy(true); setError(''); setSuccess(''); setReasons([]);
    let current = baseline;
    try {
      if (owner !== String(current.ticketOwnerId ?? '')) current = await mutate('owner', { ownerId: owner ? Number(owner) : null }, current);
      if (priority !== current.itPriority) current = await mutate('it-priority', { itPriority: priority }, current);
      if (status !== current.currentStatus) current = await mutate('status', { status }, current);
      setOwner(String(current.ticketOwnerId ?? '')); setPriority(current.itPriority); setStatus(current.currentStatus);
      setSuccess('Ticket updated.'); onSaved();
    } catch (reason) { failed(reason); onSaved(); }
    finally { writing.current = false; setBusy(false); }
  }
  async function requesterWrite(kind: 'reopen' | 'advisory') {
    if (locked || writing.current || user?.role !== 'REQUESTER') return;
    writing.current = true; setBusy(true); setError(''); setSuccess(''); setReasons([]);
    try {
      if (kind === 'reopen') {
        if (!baseline.allowedTransitions.includes('REOPENED')) return;
        const next = await mutate('status', { status: 'REOPENED' }, baseline);
        setStatus(next.currentStatus); setOwner(String(next.ticketOwnerId ?? '')); setPriority(next.itPriority);
      } else {
        const body = record(await workflowJson(`/api/tickets/${ticket.id}/requester-resolved`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedVersion: baseline.version }) }));
        if (!body || !Number.isSafeInteger(body.version) || Number(body.version) <= baseline.version || typeof body.requesterResolvedAt !== 'string' || !Number.isFinite(new Date(body.requesterResolvedAt).getTime())) throw new WorkflowError(0, 'INVALID_RESPONSE');
        setBaseline(current => ({ ...current, version: Number(body.version), requesterResolvedAt: String(body.requesterResolvedAt) })); setHistoryRefresh(value => value + 1);
      }
      setSuccess(kind === 'reopen' ? 'Ticket reopened. Fresh completed work is required before resolving again.' : 'Problem-resolved advice recorded. The support team will formally resolve the ticket.'); onSaved();
    } catch (reason) { failed(reason); }
    finally { writing.current = false; setBusy(false); }
  }
  async function reloadLatest() {
    if (writing.current) return;
    setBusy(true);
    try {
      const fresh = parseOperationalTicket(await workflowJson(`/api/tickets/${ticket.id}`));
      if (fresh.id !== ticket.id) throw new WorkflowError(0, 'INVALID_RESPONSE');
      setLatest(fresh); setError('Review the latest values below. Your draft has been kept.');
    } catch { setError('Could not load the latest ticket. Your draft is kept; retry when available.'); }
    finally { setBusy(false); }
  }
  function adoptLatest() {
    if (!latest || busy) return;
    setBaseline(latest); setLatest(null); setBlocked(false); setError('Latest version adopted. Review your retained draft and explicitly save to retry.'); setReasons([]); setHistoryRefresh(value => value + 1);
  }
  function discard() {
    if (!dirty || window.confirm('Discard your unsaved ticket workflow changes?')) {
      const next = latest ?? baseline;
      setBaseline(next); setOwner(String(next.ticketOwnerId ?? '')); setPriority(next.itPriority); setStatus(next.currentStatus);
      setLatest(null); setBlocked(false); setError(''); setReasons([]); setSuccess('Draft discarded.');
    }
  }
  if (!user) return null;
  return <section className="lab3-panel ticket-workflow" aria-label="Ticket workflow" aria-busy={busy}>
    <h2>{staff ? 'Ticket workflow' : 'Problem resolution'}</h2>
    {baseline.requesterResolvedAt ? <p role="status">Requester advised that the problem appears fixed on {formatActionTime(baseline.requesterResolvedAt)}. This is not formal ticket resolution.</p> : null}
    {baseline.resolvedAt ? <p>Resolved: {formatActionTime(baseline.resolvedAt)}{baseline.resolutionTimeEstimated ? ' (estimated from the legacy record)' : ''}</p> : null}
    {baseline.reopenedAt ? <p>Reopened: {formatActionTime(baseline.reopenedAt)}</p> : null}
    {error ? <p role="alert" className="ticket-workflow__error">{error}</p> : null}{success ? <p role="status">{success}</p> : null}
    {reasons.length ? <ul aria-label="Workflow requirements">{reasons.map(reason => <li key={reason}>{gateMessages[reason]}</li>)}</ul> : null}
    {blocked ? <div className="ticket-workflow__conflict"><p>Saving is paused. Some earlier changes may already have been saved. Compare the latest ticket before retrying.</p><button type="button" disabled={busy} onClick={() => void reloadLatest()}>Reload latest ticket</button></div> : null}
    {latest ? <section aria-label="Latest ticket values"><h3>Latest saved values</h3><dl><dt>Version</dt><dd>{latest.version}</dd><dt>Ticket Owner</dt><dd>{latest.ticketOwnerId === null ? 'Unassigned' : `Staff account ${latest.ticketOwnerId}`}</dd><dt>IT Priority</dt><dd>{latest.itPriority}</dd><dt>Ticket status</dt><dd>{latest.currentStatus.replace(/_/g, ' ')}</dd></dl><button type="button" disabled={busy} onClick={adoptLatest}>Use latest version and keep my draft</button></section> : null}
    {staff ? <form onSubmit={save}>
      {ownersFailed ? <p role="alert">Could not load active Ticket Owners. <button type="button" onClick={() => setOwnerRetry(value => value + 1)}>Retry Ticket Owners</button></p> : null}
      <fieldset disabled={locked}><legend className="visually-hidden">Ticket workflow changes</legend><div className="lab3-fields">
        <label>Ticket Owner<select value={owner} onChange={event => setOwner(event.target.value)}><option value="">Unassigned</option>{owner && !owners.some(person => String(person.id) === owner) ? <option value={owner}>Current owner (inactive or unavailable)</option> : null}{owners.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        <label>IT Priority<select value={priority} onChange={event => setPriority(event.target.value)}>{priorities.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Current Status<select value={status} onChange={event => setStatus(event.target.value)}>{[...new Set([baseline.currentStatus, ...baseline.allowedTransitions, status])].map(value => <option key={value} value={value} disabled={value === 'RESOLVED' && baseline.currentStatus !== 'RESOLVED' && knownReasons.length > 0}>{value.replace(/_/g, ' ')}</option>)}</select></label>
      </div><p>Resolution requires an active Ticket Owner, completed work, no open actions or outstanding follow-up, and fresh work after reopening.</p>
      {knownReasons.length ? <ul aria-label="Resolution requirements">{knownReasons.map(reason => <li key={reason}>{gateMessages[reason]}</li>)}</ul> : null}
      <button type="button" onClick={() => setOwner(String(user.id))}>Assign to Me</button><button type="submit" disabled={!dirty}>{busy ? 'Saving...' : 'Save Changes'}</button></fieldset>
      <button type="button" disabled={busy} onClick={discard}>Discard workflow changes</button>
    </form> : <><p>You can let the support team know the problem appears fixed. The team will formally resolve or close the ticket.</p><button type="button" disabled={locked || Boolean(baseline.requesterResolvedAt)} onClick={() => void requesterWrite('advisory')}>{baseline.requesterResolvedAt ? 'Advice recorded' : 'Problem Appears Resolved'}</button>{baseline.allowedTransitions.includes('REOPENED') ? <button type="button" disabled={locked} onClick={() => void requesterWrite('reopen')}>Reopen ticket</button> : null}</>}
    <WorkflowHistory ticketId={ticket.id} refresh={ticket.version + historyRefresh} />
  </section>;
}
