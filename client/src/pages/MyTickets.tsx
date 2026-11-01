import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import Badge, { type BadgeVariant } from '../components/Badge.js';
import LoadingSpinner from '../components/LoadingSpinner.js';
import EmptyState from '../components/EmptyState.js';
import ErrorState from '../components/ErrorState.js';
import Pagination from '../components/Pagination.js';
import '../features/my-tickets/my-tickets.css';

interface Ticket {
  id: number; ticketNumber: string; summary: string; categoryId: number; categoryName: string;
  requestedPriority: string; currentStatus: string; createdAt: string; updatedAt: string;
  resolvedAt?: string | null; resolutionTimeEstimated?: boolean;
}
interface PaginationMeta { page: number; pageSize: number; total: number; totalPages: number }
interface Category { id: number; name: string }
type SortField = 'ticketNumber' | 'createdAt' | 'updatedAt' | 'resolvedAt';
type Result = { status: 'loading'; query: string }
  | { status: 'error'; query: string; message: string; forbidden: boolean }
  | { status: 'ready'; query: string; tickets: Ticket[]; pagination: PaginationMeta; loadedAt: string };
const STATUSES = ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED'];
const REQUEST_FIELDS = ['search', 'categoryId', 'priority', 'status', 'dashboardFilter', 'from', 'to', 'page', 'pageSize'];
const DASHBOARD_LABELS: Record<string, string> = { open: 'Open tickets', waiting: 'Waiting for you', recentlyResolved: 'Recently resolved', recentlyUpdated: 'Recently updated' };
const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' });
function formatDate(instant: string | null | undefined): string {
  const value = new Date(instant ?? '');
  return Number.isNaN(value.getTime()) ? 'Unavailable' : `${DATE_FORMAT.format(value)} (Bangkok)`;
}
function StatusBadge({ value, testId }: { value: string; testId?: string }) {
  return <span className={value === 'CANCELLED' ? 'my-tickets__cancelled' : undefined}><Badge variant={value as BadgeVariant} data-testid={testId} /></span>;
}

/** URL state survives detail navigation, Back, reload and shared dashboard links. */
export default function MyTickets() {
  const navigate = useNavigate();
  const [parameters, setParameters] = useSearchParams();
  const queryString = parameters.toString();
  const latestParameters = useRef(parameters);
  latestParameters.current = parameters;
  const [searchInput, setSearchInput] = useState(() => parameters.get('search') ?? '');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [result, setResult] = useState<Result>({ status: 'loading', query: '' });
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryError, setCategoryError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const generation = useRef(0);
  const dashboardFilter = parameters.get('dashboardFilter') ?? '';
  const canonicalSort: SortField | null = dashboardFilter === 'recentlyResolved' ? 'resolvedAt' : dashboardFilter === 'recentlyUpdated' ? 'updatedAt' : null;
  const requestedSort = parameters.get('sort');
  const sortField: SortField = canonicalSort ?? (requestedSort === 'ticketNumber' || requestedSort === 'updatedAt' ? requestedSort : 'createdAt');
  const sortOrder = canonicalSort ? 'desc' : parameters.get('order') === 'asc' ? 'asc' : 'desc';
  const hasFilters = ['search', 'categoryId', 'priority', 'status', 'dashboardFilter', 'from', 'to'].some(field => Boolean(parameters.get(field)));

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearchInput(parameters.get('search') ?? '');
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [queryString]);

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
    // Clearing intentionally removes the dashboard predicate and its fixed window.
    setSearchInput(''); setParameters(new URLSearchParams());
  }
  function changeSort(field: SortField) {
    if (canonicalSort) return;
    filter({ sort: field, order: field === sortField && sortOrder === 'desc' ? 'asc' : 'desc' });
  }

  useEffect(() => {
    const controller = new AbortController();
    const current = ++generation.current;
    const request = new URLSearchParams();
    REQUEST_FIELDS.forEach(field => { const value = parameters.get(field); if (value !== null) request.set(field, value); });
    if (!request.has('page')) request.set('page', '1');
    if (!request.has('pageSize')) request.set('pageSize', '10');
    request.set('sort', sortField); request.set('order', sortOrder);
    setResult({ status: 'loading', query: queryString });
    (async () => {
      try {
        const response = await apiFetch(`/api/tickets?${request}`, { signal: controller.signal, cache: 'no-store' });
        if (controller.signal.aborted || current !== generation.current) return;
        if (response.status === 401) throw new Error('Sign in again to view your tickets.');
        if (response.status === 403) {
          const body = await response.json().catch(() => null);
          if (controller.signal.aborted || current !== generation.current) return;
          if (body?.error?.code === 'PASSWORD_CHANGE_REQUIRED') { navigate('/change-password', { replace: true }); return; }
          setResult({ status: 'error', query: queryString, forbidden: true, message: 'You do not have permission to view these tickets.' }); return;
        }
        if (!response.ok) throw new Error(response.status === 400 ? 'The ticket filters or date window are invalid. Clear the filters and try again.' : 'Could not load tickets. Please try again.');
        const body = await response.json() as { data: Ticket[]; pagination: PaginationMeta };
        if (controller.signal.aborted || current !== generation.current) return;
        if (!Array.isArray(body.data) || !body.pagination || !Number.isSafeInteger(body.pagination.total)) throw new Error('Could not load tickets. Please try again.');
        setResult({ status: 'ready', query: queryString, tickets: body.data, pagination: body.pagination, loadedAt: new Date().toISOString() });
      } catch (error) {
        if (controller.signal.aborted || current !== generation.current) return;
        const message = error instanceof Error && ['Sign in again to view your tickets.', 'The ticket filters or date window are invalid. Clear the filters and try again.'].includes(error.message)
          ? error.message : 'Could not load tickets. Please try again.';
        setResult({ status: 'error', query: queryString, forbidden: false, message });
      }
    })();
    return () => controller.abort();
  }, [queryString, sortField, sortOrder, refresh, navigate]);

  useEffect(() => {
    const controller = new AbortController(); setCategoryError(false);
    apiFetch('/api/categories', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('categories');
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('categories');
      if (!controller.signal.aborted) setCategories(data);
    }).catch(() => { if (!controller.signal.aborted) setCategoryError(true); });
    return () => controller.abort();
  }, [refresh]);

  const loading = result.status === 'loading' || result.query !== queryString;
  const ready = result.status === 'ready' && result.query === queryString ? result : null;
  const columns: { field: string; label: string; sort?: SortField }[] = [
    { field: 'ticketNumber', label: 'Ticket No.', sort: 'ticketNumber' }, { field: 'createdAt', label: 'Created', sort: 'createdAt' },
    { field: 'summary', label: 'Summary' }, { field: 'category', label: 'Category' }, { field: 'requestedPriority', label: 'Req. Priority' },
    { field: 'currentStatus', label: 'Status' }, { field: 'updatedAt', label: 'Last Updated', sort: 'updatedAt' },
    ...(canonicalSort === 'resolvedAt' ? [{ field: 'resolvedAt', label: 'Resolved', sort: 'resolvedAt' as const }] : []),
  ];
  return <div className="my-tickets">
    <div className="my-tickets__header"><div><h1>My Tickets</h1><p>View and track all of your support requests.</p></div>
      <div className="my-tickets__actions">{hasFilters ? <button type="button" onClick={clearFilters} data-testid="clear-filters-btn">Clear Filters</button> : null}<Link className="my-tickets__button my-tickets__button--primary" data-testid="create-ticket-btn" to="/tickets/new">+ Create Ticket</Link></div>
    </div>
    {dashboardFilter ? <section className="my-tickets__dashboard" aria-label="Dashboard ticket filter"><strong>{DASHBOARD_LABELS[dashboardFilter] ?? 'Dashboard filter'}</strong>
      {parameters.get('from') || parameters.get('to') ? <p>Window: {formatDate(parameters.get('from'))} to {formatDate(parameters.get('to'))} (end excluded).</p> : null}
      <p>Counts reflect the latest matching tickets. New work may change totals after the dashboard was loaded.</p>
    </section> : null}
    <form className="my-tickets__filters" aria-label="Ticket filters" onSubmit={event => { event.preventDefault(); filter({ search: searchInput }); }}>
      <label>Search tickets<input type="search" value={searchInput} onChange={event => search(event.target.value)} placeholder="Ticket number or summary" data-testid="search-input" /></label>
      <label>Filter by category<select value={parameters.get('categoryId') ?? ''} onChange={event => filter({ categoryId: event.target.value })} data-testid="category-filter"><option value="">All Categories</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label>Filter by priority<select value={parameters.get('priority') ?? ''} onChange={event => filter({ priority: event.target.value })} data-testid="priority-filter"><option value="">All Priorities</option>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Filter by status<select value={parameters.get('status') ?? ''} onChange={event => filter({ status: event.target.value })} data-testid="status-filter"><option value="">All Statuses</option>{STATUSES.map(value => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}</select></label>
    </form>
    {categoryError ? <p role="alert">Could not load categories. <button type="button" onClick={() => setRefresh(value => value + 1)}>Retry categories</button></p> : null}
    <div className="my-tickets__sort"><label>Sort tickets<select value={sortField} disabled={Boolean(canonicalSort)} onChange={event => filter({ sort: event.target.value, order: 'desc' })}><option value="createdAt">Created</option><option value="ticketNumber">Ticket number</option><option value="updatedAt">Last updated</option>{canonicalSort === 'resolvedAt' ? <option value="resolvedAt">Resolved</option> : null}</select></label>
      <button type="button" disabled={Boolean(canonicalSort)} onClick={() => filter({ order: sortOrder === 'asc' ? 'desc' : 'asc' })}>Sort {sortOrder === 'asc' ? 'ascending' : 'descending'}</button>
      {canonicalSort ? <p>Dashboard order: newest {canonicalSort === 'resolvedAt' ? 'resolution' : 'update'} first.</p> : null}
      <button type="button" onClick={() => setRefresh(value => value + 1)}>Refresh tickets</button>
    </div>
    {loading ? <LoadingSpinner label="Loading tickets..." /> : result.status === 'error' ? <ErrorState data-testid="tickets-error" message={result.message} onRetry={result.forbidden ? undefined : () => setRefresh(value => value + 1)} /> : ready?.tickets.length === 0 ? <EmptyState data-testid={hasFilters ? 'no-results-state' : 'empty-state'} title={hasFilters ? 'No tickets match your filters.' : 'You have no tickets yet.'} description={hasFilters ? 'Try adjusting your search or clearing your filters.' : 'Create your first IT support ticket.'} action={hasFilters ? <button type="button" onClick={clearFilters} data-testid="clear-filters-empty-btn">Clear Filters</button> : <Link className="my-tickets__button" to="/tickets/new">+ Create Ticket</Link>} /> : ready ? <>
      <p className="my-tickets__notice" role="status">{ready.pagination.total} matching tickets. Updated at {formatDate(ready.loadedAt)}.</p>
      <div className="my-tickets__table" data-testid="tickets-table"><table><caption className="visually-hidden">Your matching support tickets</caption><thead><tr>{columns.map(column => <th key={column.field} scope="col" data-testid={`col-header-${column.field}`} aria-sort={column.sort && column.sort === sortField ? sortOrder === 'asc' ? 'ascending' : 'descending' : undefined}>{column.sort ? <button type="button" disabled={Boolean(canonicalSort)} onClick={() => changeSort(column.sort!)}>{column.label}{column.sort === sortField ? sortOrder === 'asc' ? ' (asc)' : ' (desc)' : ''}</button> : column.label}</th>)}</tr></thead>
        <tbody>{ready.tickets.map(ticket => <tr key={ticket.id} data-testid={`ticket-row-${ticket.id}`}><td><Link to={`/tickets/${ticket.id}`}>{ticket.ticketNumber}</Link></td><td>{formatDate(ticket.createdAt)}</td><td>{ticket.summary}</td><td>{ticket.categoryName}</td><td><Badge variant={ticket.requestedPriority as BadgeVariant} data-testid={`priority-badge-${ticket.id}`} /></td><td><StatusBadge value={ticket.currentStatus} testId={`status-badge-${ticket.id}`} /></td><td>{formatDate(ticket.updatedAt)}</td>{canonicalSort === 'resolvedAt' ? <td>{formatDate(ticket.resolvedAt)}{ticket.resolutionTimeEstimated ? ' (Estimated)' : ''}</td> : null}</tr>)}</tbody>
      </table></div>
      <ul className="my-tickets__cards" aria-label="Ticket cards" data-testid="tickets-cards">{ready.tickets.map(ticket => <li key={ticket.id}><article><h2><Link to={`/tickets/${ticket.id}`}>{ticket.ticketNumber}</Link></h2><p>{ticket.summary}</p><dl><dt>Category</dt><dd>{ticket.categoryName}</dd><dt>Req. priority</dt><dd><Badge variant={ticket.requestedPriority as BadgeVariant} /></dd><dt>Status</dt><dd><StatusBadge value={ticket.currentStatus} /></dd><dt>Created</dt><dd>{formatDate(ticket.createdAt)}</dd><dt>Last updated</dt><dd>{formatDate(ticket.updatedAt)}</dd>{canonicalSort === 'resolvedAt' ? <><dt>Resolved</dt><dd>{formatDate(ticket.resolvedAt)}{ticket.resolutionTimeEstimated ? ' (Estimated)' : ''}</dd></> : null}</dl></article></li>)}</ul>
      <Pagination {...ready.pagination} onPageChange={value => patchQuery({ page: String(value) }, false)} onPageSizeChange={value => filter({ pageSize: String(value) })} />
    </> : null}
  </div>;
}
