/**
 * Pagination — page navigation controls with page-size selector.
 * ui-spec.md §9 (Pagination Controls)
 */
interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZES = [10, 25, 50];

export default function Pagination({
  page, pageSize, total, totalPages,
  onPageChange, onPageSizeChange,
}: PaginationProps) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end   = Math.min(page * pageSize, total);

  // Build visible page numbers (max 5 with ellipsis)
  function pageNumbers(): (number | '…')[] {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3) return [1, 2, 3, '…', totalPages];
    if (page >= totalPages - 2) return [1, '…', totalPages - 2, totalPages - 1, totalPages];
    return [1, '…', page - 1, page, page + 1, '…', totalPages];
  }

  const btnBase: React.CSSProperties = {
    minWidth: 32, height: 32,
    border: '1px solid var(--color-border)',
    borderRadius: 4,
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    fontSize: 13,
    padding: '0 6px',
  };

  return (
    <div
      data-testid="pagination"
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        flexWrap: 'wrap', marginTop: 'var(--space-lg)',
        fontSize: 13, color: 'var(--color-text-secondary)',
      }}
    >
      <span style={{ marginRight: 'var(--space-sm)' }}>
        Showing {start}–{end} of {total} tickets
      </span>

      {/* Previous */}
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        data-testid="pagination-prev"
        style={{ ...btnBase, cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}
      >
        ‹ Prev
      </button>

      {/* Page numbers */}
      {pageNumbers().map((n, i) =>
        n === '…' ? (
          <span key={`ellipsis-${i}`} style={{ padding: '0 4px' }}>…</span>
        ) : (
          <button
            key={n}
            onClick={() => onPageChange(n)}
            data-testid={`pagination-page-${n}`}
            style={{
              ...btnBase,
              backgroundColor: n === page ? 'var(--color-primary)' : 'var(--color-surface)',
              color:           n === page ? '#fff'                  : 'var(--color-text-primary)',
              borderColor:     n === page ? 'var(--color-primary)'  : 'var(--color-border)',
              fontWeight:      n === page ? 600                     : 400,
            }}
          >
            {n}
          </button>
        ),
      )}

      {/* Next */}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        data-testid="pagination-next"
        style={{ ...btnBase, cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}
      >
        Next ›
      </button>

      {/* Page size selector */}
      <select
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
        data-testid="page-size-select"
        style={{ ...btnBase, paddingLeft: 6, paddingRight: 6 }}
        aria-label="Items per page"
      >
        {PAGE_SIZES.map((s) => (
          <option key={s} value={s}>{s} / page</option>
        ))}
      </select>
    </div>
  );
}
