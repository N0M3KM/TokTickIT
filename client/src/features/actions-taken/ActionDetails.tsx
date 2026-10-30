import type { ActionDTO, RevisionPageState } from './types.js';
import { actionStatusLabels, formatActionTime } from './types.js';

interface Props {
  action: ActionDTO; history: RevisionPageState;
  onHistoryOpen: () => void; onHistoryPageChange: (page: number) => void;
}
// This component is deliberately read-only for every role.
export default function ActionDetails({ action, history, onHistoryOpen, onHistoryPageChange }: Props) {
  return <div className="actions-taken__detail">
    <dl>
      <dt>Action date/time</dt><dd><time dateTime={action.actionAt}>{formatActionTime(action.actionAt)}</time></dd>
      <dt>Description</dt><dd>{action.description}</dd>
      <dt>Result</dt><dd>{action.result ?? 'No result recorded'}</dd>
      <dt>Performed by</dt><dd>{action.performedBy.name}</dd>
      <dt>Assigned to</dt><dd>{action.assignee.name}{!action.assignee.isActive ? ' (Inactive)' : ''}</dd>
      <dt>Action status</dt><dd>{actionStatusLabels[action.status]}</dd>
      <dt>Follow-up required</dt><dd>{action.followUpRequired ? 'Yes' : 'No'}</dd>
      <dt>Follow-up note</dt><dd>{action.followUpNote ?? 'None'}</dd>
      <dt>Attachment notes</dt><dd>{action.attachmentNotes ?? 'None'}</dd>
      {action.cancellationReason !== null ? <><dt>Cancellation reason</dt><dd>{action.cancellationReason}</dd></> : null}
      <dt>Created</dt><dd><time dateTime={action.createdAt}>{formatActionTime(action.createdAt)}</time></dd>
      <dt>Last updated</dt><dd><time dateTime={action.updatedAt}>{formatActionTime(action.updatedAt)}</time> by {action.updatedBy.name}</dd>
    </dl>
    <details onToggle={event => { if (event.currentTarget.open && history.status === 'idle') onHistoryOpen(); }}>
      <summary>Revision history for action {action.id}</summary>
      {history.status === 'loading' || history.status === 'idle' ? <p role="status">Loading revision history...</p> : null}
      {history.status === 'error' ? <div role="alert"><p>Could not load revision history.</p><button type="button" onClick={onHistoryOpen}>Retry history</button></div> : null}
      {history.status === 'ready' ? <>
        {history.data.length === 0 ? <p>No recorded history</p> : <ol className="actions-taken__history">{history.data.map(revision => <li key={revision.id}>
          <p>Version {revision.version} · {revision.eventType === 'CREATE' ? 'Created' : revision.eventType === 'STATUS' ? 'Status changed' : 'Edited'} by {revision.editor.name} · <time dateTime={revision.createdAt}>{formatActionTime(revision.createdAt)}</time></p>
          <dl>{(['actionAt', 'description', 'result', 'status', 'followUpRequired', 'followUpNote', 'attachmentNotes', 'cancellationReason'] as const).map(field => {
            const value = revision.snapshot[field];
            if (value === undefined) return null;
            const label = { actionAt: 'Action date/time', description: 'Description', result: 'Result', status: 'Action status', followUpRequired: 'Follow-up required', followUpNote: 'Follow-up note', attachmentNotes: 'Attachment notes', cancellationReason: 'Cancellation reason' }[field];
            const text = value === null ? 'None' : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : typeof value === 'string' ? (field === 'actionAt' ? formatActionTime(value) : value) : 'Unavailable';
            return <div key={field}><dt>{label}</dt><dd>{text}</dd></div>;
          })}</dl>
        </li>)}</ol>}
        <nav aria-label={`Action ${action.id} history pages`}>
          <button type="button" disabled={history.pagination.page <= 1} onClick={() => onHistoryPageChange(history.pagination.page - 1)}>Previous history page</button>
          <span role="status">History page {history.pagination.page} of {history.pagination.totalPages}</span>
          <button type="button" disabled={history.pagination.page >= history.pagination.totalPages} onClick={() => onHistoryPageChange(history.pagination.page + 1)}>Next history page</button>
        </nav>
      </> : null}
    </details>
  </div>;
}
