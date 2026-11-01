import { useEffect, useId, useState } from 'react';
import ActionDetails from './ActionDetails.js';
import type { ActionDTO, ActionPageState, RevisionPageState } from './types.js';
import { actionStatusLabels, formatActionTime } from './types.js';
import './actions-taken.css';

interface Props {
  state: ActionPageState; historyByAction: Readonly<Record<number, RevisionPageState>>;
  onRetry: () => void; onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: 10 | 25 | 50) => void;
  onHistoryRequest: (actionId: number, page: number) => void;
  onEdit?: (action: ActionDTO) => void;
  focusActionId?: number;
}
const idleHistory: RevisionPageState = { status: 'idle' };

/** Standalone read-only preparation for #42; not yet connected to Ticket Detail. */
export default function ActionsTaken({ state, historyByAction, onRetry, onPageChange, onPageSizeChange, onHistoryRequest, onEdit, focusActionId }: Props) {
  const headingId = useId();
  const [expandedAction, setExpandedAction] = useState<number | null>(null);
  useEffect(() => {
    if (!focusActionId || state.status !== 'ready' || !state.data.some(action => action.id === focusActionId)) return;
    setExpandedAction(focusActionId);
    document.getElementById(`action-${focusActionId}`)?.focus();
  }, [focusActionId, state]);
  return <section className="actions-taken" aria-labelledby={headingId} aria-busy={state.status === 'loading'}>
    <h2 id={headingId}>Actions Taken</h2>
    <p>Actions and their history are visible to the requester. Put confidential information in Internal Notes.</p>
    {state.status === 'loading' ? <p role="status">Loading actions...</p> : null}
    {state.status === 'error' ? <div role="alert">
      <p>{state.reason === 'forbidden' ? 'You do not have access to these actions.' : state.reason === 'not-found' ? 'Ticket/action not found.' : 'Could not load actions. Please try again.'}</p>
      {state.reason === 'failure' ? <button type="button" onClick={onRetry}>Retry actions</button> : null}
    </div> : null}
    {state.status === 'ready' ? <>
      {state.data.length === 0 ? <p>No actions recorded for this ticket.</p> : <ol className="actions-taken__list">{state.data.map(action => {
        const expanded = action.id === expandedAction;
        return <li key={action.id} id={`action-${action.id}`} tabIndex={-1}>
          <article aria-label={`Action ${action.id}`}>
            <header><h3>Action {action.id}</h3><span className={`actions-taken__badge actions-taken__badge--${action.status.toLowerCase()}`}>{actionStatusLabels[action.status]}</span></header>
            <p><time dateTime={action.actionAt}>{formatActionTime(action.actionAt)}</time></p>
            <p>{action.description}</p>
            <dl className="actions-taken__summary">
              <div><dt>Result</dt><dd>{action.result ?? 'No result recorded'}</dd></div>
              <div><dt>Performed by</dt><dd>{action.performedBy.name}</dd></div>
              <div><dt>Assigned to</dt><dd>{action.assignee.name}{!action.assignee.isActive ? ' (Inactive)' : ''}</dd></div>
              <div><dt>Follow-up required</dt><dd>{action.followUpRequired ? 'Yes' : 'No'}</dd></div>
            </dl>
            <button type="button" aria-expanded={expanded} aria-controls={`${headingId}-detail-${action.id}`} onClick={() => setExpandedAction(expanded ? null : action.id)}>{expanded ? 'Hide' : 'View'} action {action.id}</button>
            {onEdit && (action.status === 'PLANNED' || action.status === 'IN_PROGRESS') ? <button type="button" onClick={() => onEdit(action)}>Edit action {action.id}</button> : null}
            <div id={`${headingId}-detail-${action.id}`} hidden={!expanded}>{expanded ? <ActionDetails action={action} history={historyByAction[action.id] ?? idleHistory} onHistoryOpen={() => onHistoryRequest(action.id, 1)} onHistoryPageChange={page => onHistoryRequest(action.id, page)} /> : null}</div>
          </article>
        </li>;
      })}</ol>}
      <nav aria-label="Actions pages">
        <button type="button" disabled={state.pagination.page <= 1} onClick={() => onPageChange(state.pagination.page - 1)}>Previous actions page</button>
        <span role="status">Actions page {state.pagination.page} of {state.pagination.totalPages} · {state.pagination.total} actions</span>
        <button type="button" disabled={state.pagination.page >= state.pagination.totalPages} onClick={() => onPageChange(state.pagination.page + 1)}>Next actions page</button>
        <label>Actions per page<select value={state.pagination.pageSize} onChange={event => onPageSizeChange(Number(event.target.value) as 10 | 25 | 50)}>{[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
      </nav>
    </> : null}
  </section>;
}
