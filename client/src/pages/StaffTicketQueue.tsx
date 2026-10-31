import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Badge, { type BadgeVariant } from '../components/Badge.js';
import { apiFetch } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';
import '../features/staff-queue/staff-queue.css';

interface Ticket {
  id: number; ticketNumber: string; summary: string; categoryName: string; requestedPriority: string;
  itPriority: string; currentStatus: string; ticketOwner: { id: number; name: string } | null; createdAt: string; updatedAt: string;
}
interface Page { page: number; pageSize: number; total: number; totalPages: number }
interface Category { id: number; name: string }
type Sort = 'ticketNumber' | 'createdAt' | 'updatedAt';
type Result = { status: 'loading'; key: string }
  | { status: 'error'; key: string; message: string; forbidden: boolean }
  | { status: 'ready'; key: string; data: Ticket[]; pagination: Page; loadedAt: string };
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUSES = ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED'];
const QUERY_FIELDS = ['search', 'categoryId', 'requestedPriority', 'itPriority', 'status', 'ownerId', 'dashboardFilter', 'from', 'to', 'page', 'pageSize'];
const DASHBOARD_LABELS: Record<string, string> = {
  open: 'Active tickets', unassigned: 'Unassigned tickets', ownedByMe: 'My active tickets',
  myActions: 'Tickets with my active actions', recentlyUpdated: 'Recently updated tickets',
};
const dateFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' });
function formatDate(instant: string | null) {
  const date = new Date(instant ?? '');
  return Number.isNaN(date.getTime()) ? 'Unavailable' : `${dateFormat.format(date)} (Bangkok)`;
}
function StatusBadge({ value }: { value: string }) {
  return <span className={value === 'CANCELLED' ? 'staff-queue__cancelled' : undefined}><Badge variant={value as BadgeVariant} /></span>;
}

export default function StaffTicketQueue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [parameters, setParameters] = useSearchParams();
  const queryString = parameters.toString();
  const latestParameters = useRef(parameters); latestParameters.current = parameters;
  const authorized = user?.role === 'IT_STAFF' || user?.role === 'ADMINISTRATOR';
  const key = `${user?.id ?? ''}:${user?.role ?? ''}:${queryString}`;
  const [searchInput, setSearchInput] = useState(() => parameters.get('search') ?? '');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [result, setResult] = useState<Result>({ status: 'loading', key: '' });
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryError, setCategoryError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const generation = useRef(0);
  const dashboardFilter = parameters.get('dashboardFilter') ?? '';
  const canonicalSort = dashboardFilter === 'recentlyUpdated';
  const requestedSort = parameters.get('sort');
  const sort: Sort = canonicalSort ? 'updatedAt' : requestedSort === 'ticketNumber' || requestedSort === 'updatedAt' ? requestedSort : 'createdAt';
  const order = canonicalSort ? 'desc' : parameters.get('order') === 'asc' ? 'asc' : 'desc';
  const ownerId = parameters.get('ownerId') ?? '';

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearchInput(parameters.get('search') ?? '');
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [queryString, user?.id, user?.role]);

  function patchQuery(changes: Record<string, string | null>, resetPage = true, replace = false) {
    const next = new URLSearchParams(latestParameters.current);
    Object.entries(changes).forEach(([field, value]) => value === null || value === '' ? next.delete(field) : next.set(field, value));
    if (resetPage) next.set('page', '1');
    setParameters(next, { replace });
  }
  function filter(changes: Record<string, string | null>) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    patchQuery({ search: searchInput, ...changes });
  }
  function search(value: string) {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => patchQuery({ search: value }, true, true), 300);
  }
  function clearFilters() {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearchInput(''); setParameters(new URLSearchParams());
  }
  function changeSort(field: Sort) {
    if (!canonicalSort) filter({ sort: field, order: field === sort && order === 'desc' ? 'asc' : 'desc' });
  }

  useEffect(() => {
    if (!authorized || !user) return;
    const controller = new AbortController();
    const current = ++generation.current;
    const request = new URLSearchParams();
    QUERY_FIELDS.forEach(field => { const value = parameters.get(field); if (value !== null) request.set(field, value); });
    if (request.get('ownerId') === 'me') request.set('ownerId', String(user.id));
    if (!request.has('page')) request.set('page', '1');
    if (!request.has('pageSize')) request.set('pageSize', '10');
    request.set('sort', sort); request.set('order', order);
    setResult({ status: 'loading', key });
    (async () => {
      try {
        const response = await apiFetch(`/api/queue?${request}`, { signal: controller.signal, cache: 'no-store' });
        if (controller.signal.aborted || current !== generation.current) return;
        if (response.status === 401) throw new Error('Sign in again to view the ticket queue.');
        if (response.status === 403) {
          const body = await response.json().catch(() => null);
          if (controller.signal.aborted || current !== generation.current) return;
          if (body?.error?.code === 'PASSWORD_CHANGE_REQUIRED') { navigate('/change-password', { replace: true }); return; }
          setResult({ status: 'error', key, forbidden: true, message: 'You do not have permission to view the ticket queue.' }); return;
        }
        if (!response.ok) throw new Error(response.status === 400 ? 'The queue filters or date window are invalid. Clear the filters and try again.' : 'Could not load the ticket queue. Please try again.');
        const body = await response.json() as { data: Ticket[]; pagination: Page };
        if (controller.signal.aborted || current !== generation.current) return;
        if (!Array.isArray(body.data) || !body.pagination || !Number.isSafeInteger(body.pagination.total)) throw new Error('Invalid queue response');
        setResult({ status: 'ready', key, data: body.data, pagination: body.pagination, loadedAt: new Date().toISOString() });
      } catch (error) {
        if (controller.signal.aborted || current !== generation.current) return;
        const message = error instanceof Error && ['Sign in again to view the ticket queue.', 'The queue filters or date window are invalid. Clear the filters and try again.'].includes(error.message)
          ? error.message : 'Could not load the ticket queue. Please try again.';
        setResult({ status: 'error', key, forbidden: false, message });
      }
    })();
    return () => controller.abort();
  }, [key, authorized, user?.id, user?.role, sort, order, refresh, navigate]);

  useEffect(() => {
    if (!authorized) return;
    const controller = new AbortController(); setCategoryError(false); setCategories([]);
    apiFetch('/api/categories', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('categories');
      const data = await response.json(); if (!Array.isArray(data)) throw new Error('categories');
      if (!controller.signal.aborted) setCategories(data);
    }).catch(() => { if (!controller.signal.aborted) setCategoryError(true); });
    return () => controller.abort();
  }, [authorized, user?.id, user?.role, refresh]);

  if (!authorized) return <p role="alert">You do not have permission to view the ticket queue.</p>;
  const ready = result.status === 'ready' && result.key === key ? result : null;
  const loading = result.status === 'loading' || result.key !== key;
  const columns: { field: string; label: string; sort?: Sort }[] = [
    { field: 'ticketNumber', label: 'Ticket No.', sort: 'ticketNumber' }, { field: 'createdAt', label: 'Created', sort: 'createdAt' },
    { field: 'summary', label: 'Summary' }, { field: 'category', label: 'Category' }, { field: 'requested', label: 'Req. Priority' },
    { field: 'it', label: 'IT Priority' }, { field: 'status', label: 'Status' }, { field: 'owner', label: 'Owner' }, { field: 'updatedAt', label: 'Updated', sort: 'updatedAt' },
  ];
  return <section className="staff-queue">
    <div className="staff-queue__header"><div><h1>My Queue</h1><p>View and prioritize all IT support requests.</p></div><button type="button" onClick={clearFilters}>Clear Filters</button></div>
    {dashboardFilter ? <section className="staff-queue__dashboard" aria-label="Dashboard queue filter"><strong>{DASHBOARD_LABELS[dashboardFilter] ?? 'Dashboard queue filter'}</strong>
      {parameters.get('from') || parameters.get('to') ? <p>Window: {formatDate(parameters.get('from'))} to {formatDate(parameters.get('to'))} (end excluded).</p> : null}
      <p>Counts reflect the latest matching tickets. New work may change totals after the dashboard was loaded.</p>
      {dashboardFilter === 'myActions' ? <p>Each ticket appears once, even when several active actions are assigned to you.</p> : null}
    </section> : null}
    <form className="staff-queue__filters" aria-label="Queue filters" onSubmit={event => { event.preventDefault(); filter({ search: searchInput }); }}>
      <label>Search queue<input type="search" placeholder="Ticket number or summary" value={searchInput} onChange={event => search(event.target.value)} /></label>
      <label>Filter category<select value={parameters.get('categoryId') ?? ''} onChange={event => filter({ categoryId: event.target.value })}><option value="">All Categories</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <Filter label="Filter Requested priority" all="All Requested priorities" value={parameters.get('requestedPriority') ?? ''} onChange={value => filter({ requestedPriority: value })} options={PRIORITIES} />
      <Filter label="Filter IT priority" all="All IT priorities" value={parameters.get('itPriority') ?? ''} onChange={value => filter({ itPriority: value })} options={PRIORITIES} />
      <Filter label="Filter Current status" all="All Current statuses" value={parameters.get('status') ?? ''} onChange={value => filter({ status: value })} options={STATUSES} />
      <label>Filter owner<select value={ownerId} onChange={event => filter({ ownerId: event.target.value })}><option value="">All Owners</option><option value="unassigned">Unassigned</option><option value="me">Me</option>{ownerId && !['unassigned', 'me'].includes(ownerId) ? <option value={ownerId}>Selected owner filter</option> : null}</select></label>
    </form>
    {categoryError ? <p role="alert">Could not load categories. <button type="button" onClick={() => setRefresh(value => value + 1)}>Retry categories</button></p> : null}
    <div className="staff-queue__sort"><label>Sort queue<select value={sort} disabled={canonicalSort} onChange={event => filter({ sort: event.target.value, order: 'desc' })}><option value="createdAt">Created</option><option value="ticketNumber">Ticket number</option><option value="updatedAt">Updated</option></select></label>
      <button type="button" disabled={canonicalSort} onClick={() => filter({ order: order === 'asc' ? 'desc' : 'asc' })}>Sort {order === 'asc' ? 'ascending' : 'descending'}</button>
      {canonicalSort ? <p>Dashboard order: newest update first.</p> : null}<button type="button" onClick={() => setRefresh(value => value + 1)}>Refresh queue</button>
    </div>
    {loading ? <p role="status">Loading ticket queue...</p> : result.status === 'error' ? <div role="alert"><p>{result.message}</p>{!result.forbidden ? <button type="button" onClick={() => setRefresh(value => value + 1)}>Retry</button> : null}</div> : ready ? <>
      <p role="status" className="staff-queue__notice">{ready.pagination.total} matching tickets. Updated at {formatDate(ready.loadedAt)}.</p>
      {ready.data.length === 0 ? <p>No tickets match the current filters.</p> : <>
        <div className="staff-queue__table" data-testid="queue-table"><table><caption className="visually-hidden">Matching support tickets</caption><thead><tr>{columns.map(column => <th key={column.field} scope="col" aria-sort={column.sort === sort ? order === 'asc' ? 'ascending' : 'descending' : undefined}>{column.sort ? <button type="button" disabled={canonicalSort} onClick={() => changeSort(column.sort!)}>{column.label}{column.sort === sort ? order === 'asc' ? ' (ascending)' : ' (descending)' : ''}</button> : column.label}</th>)}</tr></thead>
          <tbody>{ready.data.map(ticket => <tr key={ticket.id}><td><Link to={`/tickets/${ticket.id}`}>{ticket.ticketNumber}</Link></td><td>{formatDate(ticket.createdAt)}</td><td>{ticket.summary}</td><td>{ticket.categoryName}</td><td><Badge variant={ticket.requestedPriority as BadgeVariant} /></td><td><Badge variant={ticket.itPriority as BadgeVariant} /></td><td><StatusBadge value={ticket.currentStatus} /></td><td>{ticket.ticketOwner?.name ?? 'Unassigned'}</td><td>{formatDate(ticket.updatedAt)}</td></tr>)}</tbody>
        </table></div>
        <ul className="staff-queue__cards" aria-label="Queue ticket cards" data-testid="queue-cards">{ready.data.map(ticket => <li key={ticket.id}><article><h2><Link to={`/tickets/${ticket.id}`}>{ticket.ticketNumber}</Link></h2><p>{ticket.summary}</p><dl><dt>Category</dt><dd>{ticket.categoryName}</dd><dt>Owner</dt><dd>{ticket.ticketOwner?.name ?? 'Unassigned'}</dd><dt>Requested priority</dt><dd><Badge variant={ticket.requestedPriority as BadgeVariant} /></dd><dt>IT priority</dt><dd><Badge variant={ticket.itPriority as BadgeVariant} /></dd><dt>Status</dt><dd><StatusBadge value={ticket.currentStatus} /></dd><dt>Created</dt><dd>{formatDate(ticket.createdAt)}</dd><dt>Updated</dt><dd>{formatDate(ticket.updatedAt)}</dd></dl></article></li>)}</ul>
      </>}
      <nav className="staff-queue__pagination" aria-label="Queue pages"><span>Showing {ready.pagination.total === 0 ? 0 : (ready.pagination.page - 1) * ready.pagination.pageSize + 1}-{Math.min(ready.pagination.page * ready.pagination.pageSize, ready.pagination.total)} of {ready.pagination.total} tickets</span><button type="button" disabled={ready.pagination.page <= 1} onClick={() => patchQuery({ page: String(ready.pagination.page - 1) }, false)}>Previous</button><button type="button" disabled={ready.pagination.page >= ready.pagination.totalPages} onClick={() => patchQuery({ page: String(ready.pagination.page + 1) }, false)}>Next</button><label>Items per page<select value={ready.pagination.pageSize} onChange={event => filter({ pageSize: event.target.value })}>{[10, 25, 50].map(size => <option key={size} value={size}>{size} / page</option>)}</select></label></nav>
    </> : null}
  </section>;
}

function Filter({ label, all, value, onChange, options }: { label: string; all: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label>{label}<select value={value} onChange={event => onChange(event.target.value)}><option value="">{all}</option>{options.map(option => <option key={option} value={option}>{option.replace(/_/g, ' ')}</option>)}</select></label>;
}
