import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequester } from '../context/RequesterContext.js';
import Badge, { type BadgeVariant } from '../components/Badge.js';
import LoadingSpinner from '../components/LoadingSpinner.js';
import EmptyState from '../components/EmptyState.js';
import ErrorState from '../components/ErrorState.js';
import Pagination from '../components/Pagination.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Ticket {
  id: number;
  ticketNumber: string;
  summary: string;
  categoryId: number;
  categoryName: string;
  requestedPriority: string;
  currentStatus: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface Category { id: number; name: string }

type SortField = 'ticketNumber' | 'createdAt' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function MyTickets() {
  const { selectedRequesterId } = useRequester();
  const navigate = useNavigate();

  const [tickets,    setTickets]    = useState<Ticket[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  const [search,     setSearch]     = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority,   setPriority]   = useState('');
  const [status,     setStatus]     = useState('');
  const [sortField,  setSortField]  = useState<SortField>('createdAt');
  const [sortOrder,  setSortOrder]  = useState<SortOrder>('desc');
  const [page,       setPage]       = useState(1);
  const [pageSize,   setPageSize]   = useState(10);

  const [categories, setCategories] = useState<Category[]>([]);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasFilters = !!(search || categoryId || priority || status);

  // ---------------------------------------------------------------------------
  // Fetch tickets
  // ---------------------------------------------------------------------------
  const fetchTickets = useCallback(async () => {
    if (!selectedRequesterId) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        requesterId: String(selectedRequesterId),
        page:        String(page),
        pageSize:    String(pageSize),
        sort:        sortField,
        order:       sortOrder,
      });
      if (search)     params.set('search',     search);
      if (categoryId) params.set('categoryId', categoryId);
      if (priority)   params.set('priority',   priority);
      if (status)     params.set('status',     status);

      const res = await fetch(`/api/tickets?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { data: Ticket[]; pagination: PaginationMeta };
      setTickets(data.data);
      setPagination(data.pagination);
    } catch {
      setError('Could not load tickets. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedRequesterId, page, pageSize, sortField, sortOrder, search, categoryId, priority, status]);

  useEffect(() => { void fetchTickets(); }, [fetchTickets]);

  // Load categories for filter dropdown
  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json() as Promise<Category[]>)
      .then(setCategories)
      .catch(() => {});
  }, []);

  // Debounce search input
  function handleSearchChange(val: string) {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
    }, 300);
  }

  function clearFilters() {
    setSearch(''); setCategoryId(''); setPriority(''); setStatus('');
    setPage(1);
  }

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setPage(1);
  }

  function sortIndicator(field: SortField) {
    if (field !== sortField) return ' ↕';
    return sortOrder === 'asc' ? ' ↑' : ' ↓';
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-lg)', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>My Tickets</h1>
          <p style={{ color: 'var(--color-text-secondary)', margin: '4px 0 0', fontSize: 14 }}>
            View and track all of your support requests.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {hasFilters && (
            <button
              onClick={clearFilters}
              data-testid="clear-filters-btn"
              style={secondaryBtn}
            >
              ↺ Clear Filters
            </button>
          )}
          <button
            onClick={() => navigate('/tickets/new')}
            data-testid="create-ticket-btn"
            style={primaryBtn}
          >
            + Create Ticket
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--border-radius-control)',
          padding: 'var(--space-md)',
          marginBottom: 'var(--space-md)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-sm)',
          alignItems: 'center',
        }}
      >
        <input
          type="search"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="🔍 Search by ticket number or summary…"
          data-testid="search-input"
          aria-label="Search tickets"
          style={{ ...filterInput, minWidth: 220, flex: '1 1 220px' }}
        />
        <select
          value={categoryId}
          onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
          data-testid="category-filter"
          aria-label="Filter by category"
          style={filterInput}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => { setPriority(e.target.value); setPage(1); }}
          data-testid="priority-filter"
          aria-label="Filter by priority"
          style={filterInput}
        >
          <option value="">All Priorities</option>
          {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          data-testid="status-filter"
          aria-label="Filter by status"
          style={filterInput}
        >
          <option value="">All Statuses</option>
          <option value="NEW">NEW</option>
        </select>
      </div>

      {/* Content area */}
      {loading ? (
        <LoadingSpinner label="Loading tickets…" />
      ) : error ? (
        <ErrorState
          data-testid="tickets-error"
          message={error}
          onRetry={() => void fetchTickets()}
        />
      ) : tickets.length === 0 && !hasFilters ? (
        <EmptyState
          data-testid="empty-state"
          title="You have no tickets yet."
          description="Create your first IT support ticket."
          action={
            <button onClick={() => navigate('/tickets/new')} style={primaryBtn}>
              + Create Ticket
            </button>
          }
        />
      ) : tickets.length === 0 && hasFilters ? (
        <EmptyState
          data-testid="no-results-state"
          title="No tickets match your filters."
          description="Try adjusting your search or clearing your filters."
          action={
            <button onClick={clearFilters} style={secondaryBtn} data-testid="clear-filters-empty-btn">
              Clear Filters
            </button>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div
            className="tickets-table-wrapper"
            style={{ overflowX: 'auto' }}
            data-testid="tickets-table"
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-page-bg)', borderBottom: '2px solid var(--color-border)' }}>
                  {(['ticketNumber', 'createdAt', 'summary', 'category', 'requestedPriority', 'currentStatus', 'updatedAt'] as const).map((col) => {
                    const sortable = col === 'ticketNumber' || col === 'createdAt' || col === 'updatedAt';
                    return (
                      <th
                        key={col}
                        onClick={sortable ? () => handleSort(col as SortField) : undefined}
                        style={{
                          padding: '10px 12px',
                          textAlign: 'left',
                          fontWeight: 600,
                          cursor: sortable ? 'pointer' : 'default',
                          userSelect: 'none',
                          whiteSpace: 'nowrap',
                          color: 'var(--color-text-primary)',
                        }}
                        data-testid={`col-header-${col}`}
                      >
                        {COL_LABELS[col]}{sortable && sortIndicator(col as SortField)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/tickets/${t.id}`)}
                    data-testid={`ticket-row-${t.id}`}
                    style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/tickets/${t.id}`)}
                  >
                    <td style={{ ...td, color: 'var(--color-secondary)', fontWeight: 500 }}>
                      {t.ticketNumber}
                    </td>
                    <td style={td}>{fmtDate(t.createdAt)}</td>
                    <td style={{ ...td, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.summary}
                    </td>
                    <td style={td}>{t.categoryName}</td>
                    <td style={td}>
                      <Badge variant={t.requestedPriority as BadgeVariant} data-testid={`priority-badge-${t.id}`} />
                    </td>
                    <td style={td}>
                      <Badge variant={t.currentStatus as BadgeVariant} data-testid={`status-badge-${t.id}`} />
                    </td>
                    <td style={td}>{fmtDate(t.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            totalPages={pagination.totalPages}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        </>
      )}

      {/* Mobile card styles */}
      <style>{`
        @media (max-width: 767px) {
          .tickets-table-wrapper table { display: none; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const COL_LABELS: Record<string, string> = {
  ticketNumber:      'Ticket No.',
  createdAt:         'Created',
  summary:           'Summary',
  category:          'Category',
  requestedPriority: 'Req. Priority',
  currentStatus:     'Status',
  updatedAt:         'Last Updated',
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const td: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'middle' };

const filterInput: React.CSSProperties = {
  height: 36,
  border: '1px solid var(--color-editable-border)',
  borderRadius: 6,
  padding: '0 8px',
  fontSize: 14,
  backgroundColor: 'var(--color-editable-bg)',
  color: 'var(--color-text-primary)',
};

const primaryBtn: React.CSSProperties = {
  height: 'var(--button-height)',
  padding: '0 var(--space-lg)',
  borderRadius: 'var(--border-radius-control)',
  border: 'none',
  backgroundColor: 'var(--color-primary)',
  color: '#fff',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
  height: 'var(--button-height)',
  padding: '0 var(--space-lg)',
  borderRadius: 'var(--border-radius-control)',
  border: '1px solid var(--color-primary)',
  backgroundColor: '#fff',
  color: 'var(--color-primary)',
  fontWeight: 500,
  fontSize: 14,
  cursor: 'pointer',
};
