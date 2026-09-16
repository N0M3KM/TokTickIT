import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api.js';

interface Entry { id: number; content: string; createdAt: string; author: { name: string; role: string } }

export default function TicketDiscussion({ ticketId, internal = false }: { ticketId: number; internal?: boolean }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const path = `/api/tickets/${ticketId}/${internal ? 'notes' : 'comments'}`;
  const title = internal ? 'Internal Notes' : 'Public Comments';
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await apiFetch(path);
      if (!response.ok) throw new Error('Could not load this discussion. Please try again.');
      setEntries(await response.json());
    } catch (reason) { setError((reason as Error).message); }
    finally { setLoading(false); }
  }, [path]);
  useEffect(() => { void load(); }, [load]);

  async function post(event: React.FormEvent) {
    event.preventDefault();
    if (!content.trim()) { setError('Enter a message before posting.'); return; }
    setBusy(true); setError(''); setSuccess('');
    try {
      const response = await apiFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: content.trim() }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? 'Could not post your message.');
      setEntries((current) => [...current, body]); setContent(''); setSuccess(internal ? 'Internal note saved.' : 'Public comment posted.');
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  return <section className={`lab3-panel ${internal ? 'lab3-private' : ''}`} aria-label={title}>
    <h2>{title}</h2><p className="text-secondary">{internal ? 'Private to IT Staff and Administrators. Requesters cannot see these notes.' : 'Visible to the requester and the support team.'}</p>
    {loading ? <p role="status">Loading discussion...</p> : entries.length ? entries.map((entry) => <article key={entry.id} className="lab3-entry"><strong>{entry.author.name}</strong> <small>{new Date(entry.createdAt).toLocaleString()}</small><p>{entry.content}</p></article>) : <p>No {internal ? 'internal notes' : 'comments'} yet.</p>}
    {error && <div role="alert" className="alert alert-danger">{error} <button className="btn btn-sm btn-outline-danger" onClick={() => void load()}>Retry loading</button></div>}
    {success && <p role="status" className="text-success">{success}</p>}
    <form onSubmit={post}><label className="d-block fw-semibold mb-2" htmlFor={internal ? 'internal-note' : 'public-comment'}>{internal ? 'New internal note' : 'New public comment'}</label>
      <textarea id={internal ? 'internal-note' : 'public-comment'} rows={3} maxLength={2000} value={content} onChange={(e) => setContent(e.target.value)} disabled={busy} />
      <div className="d-flex justify-content-between align-items-center mt-2"><small>{content.length}/2000</small><button className="btn btn-primary" disabled={busy || !content.trim()}>{busy ? 'Posting...' : internal ? 'Save Internal Note' : 'Post Comment'}</button></div>
    </form>
  </section>;
}
