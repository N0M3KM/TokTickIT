import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { apiFetch } from '../lib/api.js';

export interface OperationalTicket { id: number; ticketOwnerId: number | null; itPriority: string; currentStatus: string; requesterResolvedAt: string | null }
const transitions: Record<string, string[]> = {
  NEW: ['OPEN', 'CANCELLED'], OPEN: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'], WAITING_FOR_REQUESTER: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'REOPENED'], CLOSED: ['REOPENED'], REOPENED: ['IN_PROGRESS', 'CANCELLED'], CANCELLED: [],
};

export default function TicketOperations({ ticket, onSaved }: { ticket: OperationalTicket; onSaved: () => void }) {
  const { user } = useAuth();
  const staff = user?.role !== 'REQUESTER';
  const [owners, setOwners] = useState<{ id: number; name: string }[]>([]);
  const [owner, setOwner] = useState(String(ticket.ticketOwnerId ?? ''));
  const [priority, setPriority] = useState(ticket.itPriority);
  const [status, setStatus] = useState(ticket.currentStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => {
    setOwner(String(ticket.ticketOwnerId ?? '')); setPriority(ticket.itPriority); setStatus(ticket.currentStatus);
  }, [ticket]);
  useEffect(() => {
    if (!staff) return;
    apiFetch('/api/queue/owners').then(async (response) => {
      if (!response.ok) throw new Error('Could not load ticket owners. Reload the ticket to retry.');
      setOwners(await response.json());
    }).catch((reason) => setError(reason.message));
  }, [staff]);

  async function mutate(action: string, data: object, method = 'PATCH') {
    const response = await apiFetch(`/api/tickets/${ticket.id}/${action}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? 'Could not save the ticket.');
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try {
      if (owner !== String(ticket.ticketOwnerId ?? '')) await mutate('owner', { ownerId: owner ? Number(owner) : null });
      if (priority !== ticket.itPriority) await mutate('it-priority', { itPriority: priority });
      if (status !== ticket.currentStatus) await mutate('status', { status });
      setSuccess('Ticket updated.'); onSaved();
    } catch (reason) { setError((reason as Error).message + ' Reload the ticket to check any changes already saved.'); }
    finally { setBusy(false); }
  }
  async function resolve() {
    setBusy(true); setError('');
    try { await mutate('requester-resolved', {}, 'POST'); onSaved(); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="lab3-panel" aria-label="Ticket workflow">
    <h2>{staff ? 'Ticket workflow' : 'Problem resolution'}</h2>
    {ticket.requesterResolvedAt && <p role="status" className="alert alert-success">Requester marked the problem as resolved on {new Date(ticket.requesterResolvedAt).toLocaleString()}.</p>}
    {error && <p role="alert" className="alert alert-danger">{error}</p>}{success && <p role="status" className="text-success">{success}</p>}
    {staff ? <form onSubmit={save}>
      <div className="lab3-fields">
        <label>Ticket Owner<select disabled={busy} value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">Unassigned</option>{owner && !owners.some((person) => String(person.id) === owner) && <option value={owner}>Current owner (inactive or unavailable)</option>}{owners.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        <label>IT Priority<select disabled={busy} value={priority} onChange={(e) => setPriority(e.target.value)}>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Current Status<select disabled={busy} value={status} onChange={(e) => setStatus(e.target.value)}>{[ticket.currentStatus, ...(transitions[ticket.currentStatus] ?? [])].map((value) => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}</select></label>
      </div>
      <div className="d-flex gap-2 flex-wrap mt-3"><button type="button" className="btn btn-outline-primary" disabled={busy} onClick={() => setOwner(String(user!.id))}>Assign to Me</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save Changes'}</button></div>
    </form> : <><p>You can let the support team know the problem appears fixed. The team will formally resolve or close the ticket.</p><button className="btn btn-outline-primary" disabled={busy || Boolean(ticket.requesterResolvedAt)} onClick={() => void resolve()}>{ticket.requesterResolvedAt ? 'Marked as resolved' : busy ? 'Saving...' : 'Problem Appears Resolved'}</button></>}
  </section>;
}
