import { useEffect, useId, useRef, useState } from 'react';
import type { ActionDTO } from './types.js';
import { actionStatusLabels, formatActionTime } from './types.js';
import './action-form.css';

export interface ActionDraft {
  actionAt: string; description: string; result: string; assigneeId: string;
  followUpRequired: boolean; followUpNote: string; attachmentNotes: string; cancellationReason: string;
}
export type ActionIntent = 'save' | 'start' | 'complete' | 'cancel';
export interface ActionFormProps {
  initial: ActionDraft; action?: ActionDTO; actorName: string; ticketNumber: string; ticketCreatedAt: string;
  owners: { id: number; name: string }[]; busy: boolean; disabled?: boolean;
  error?: string; fieldErrors?: Record<string, string>;
  onSubmit: (draft: ActionDraft, intent: ActionIntent) => void;
  onCancel: () => void; onDirtyChange?: (dirty: boolean) => void;
}

function bangkokLocal(instant: string): string {
  const date = new Date(instant);
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 19) : '';
}
export function createInitialDraft(action?: ActionDTO, actorId?: number): ActionDraft {
  return {
    actionAt: bangkokLocal(action?.actionAt ?? new Date().toISOString()),
    description: action?.description ?? '', result: action?.result ?? '',
    assigneeId: String(action?.assignee.id ?? actorId ?? ''),
    followUpRequired: action?.followUpRequired ?? false, followUpNote: action?.followUpNote ?? '',
    attachmentNotes: action?.attachmentNotes ?? '', cancellationReason: action?.cancellationReason ?? '',
  };
}

export default function ActionForm({ initial, action, actorName, ticketNumber, ticketCreatedAt, owners, busy, disabled = false, error, fieldErrors, onSubmit, onCancel, onDirtyChange }: ActionFormProps) {
  // Mount with a new key only after save/discard or switching the selected action.
  // Incoming latest server data must never overwrite a retained local draft.
  const [baseline] = useState(() => ({ ...initial }));
  const [draft, setDraft] = useState(() => ({ ...initial }));
  const [validation, setValidation] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<'complete' | 'cancel' | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const id = useId();
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const terminal = action?.status === 'COMPLETED' || action?.status === 'CANCELLED';
  const locked = disabled || terminal || busy;
  const errors = { ...fieldErrors, ...validation };
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (fieldErrors && Object.keys(fieldErrors).length) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [fieldErrors]);

  function change<K extends keyof ActionDraft>(field: K, value: ActionDraft[K]) {
    setDraft(previous => ({ ...previous, [field]: value, ...(field === 'followUpRequired' && value === false ? { followUpNote: '' } : {}) }));
    setValidation(previous => { const next = { ...previous }; delete next[field]; return next; });
  }
  function attempt(intent: ActionIntent) {
    if (locked) return;
    const next: Record<string, string> = {};
    // Parse Bangkok wall time independently of the browser's local timezone.
    const pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;
    const parsed = new Date(`${draft.actionAt}+07:00`);
    const roundTrip = Number.isFinite(parsed.getTime()) ? bangkokLocal(parsed.toISOString()) : '';
    if (!pattern.test(draft.actionAt) || !roundTrip.startsWith(draft.actionAt) || parsed.getTime() < new Date(ticketCreatedAt).getTime() || parsed.getTime() > Date.now() + 300_000) {
      next.actionAt = 'Choose a valid Bangkok time between ticket creation and five minutes from now.';
    }
    if (!draft.description.trim() || draft.description.trim().length > 2000) next.description = 'Enter an action description of 1–2000 characters.';
    if (draft.result.trim().length > 2000) next.result = 'Use no more than 2000 characters.';
    if (draft.attachmentNotes.trim().length > 1000) next.attachmentNotes = 'Use no more than 1000 characters.';
    if (draft.followUpRequired && (!draft.followUpNote.trim() || draft.followUpNote.trim().length > 2000)) next.followUpNote = 'Enter a follow-up note of 1–2000 characters.';
    const activeAssignee = owners.some(owner => String(owner.id) === draft.assigneeId);
    // Cancelling obsolete work may retain its inactive historical assignee.
    if (intent !== 'cancel' && !activeAssignee) next.assigneeId = 'Select an active IT Staff member or Administrator.';
    if (intent === 'complete') {
      if (action?.status !== 'IN_PROGRESS') return;
      if (!draft.result.trim()) next.result = 'Enter a result before completing the action.';
      if (draft.followUpRequired) next.followUpRequired = 'Complete the follow-up before completing this action.';
    }
    if (intent === 'start' && action?.status !== 'PLANNED') return;
    if (intent === 'cancel' && (!action || !draft.cancellationReason.trim() || draft.cancellationReason.trim().length > 500)) next.cancellationReason = 'Enter a cancellation reason of 1–500 characters.';
    setValidation(next);
    if (Object.keys(next).length) {
      // React flushes the field error attributes after this event.
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    onSubmit({ ...draft, followUpNote: draft.followUpRequired ? draft.followUpNote : '' }, intent);
  }
  function cancelEditing() {
    if (busy) return;
    if (!dirty || window.confirm('Discard your unsaved action changes?')) onCancel();
  }
  function attributes(field: keyof ActionDraft) {
    const labels = { actionAt: 'Action date/time (Bangkok)', description: 'Action description', result: 'Result', assigneeId: 'Assigned to', followUpRequired: 'Follow-up required?', followUpNote: 'Follow-up note', attachmentNotes: 'Attachment notes', cancellationReason: 'Cancellation reason' };
    return { id: `${id}-${field}`, 'aria-label': labels[field], 'aria-invalid': Boolean(errors[field]), 'aria-describedby': errors[field] ? `${id}-${field}-error` : undefined };
  }
  function fieldError(field: keyof ActionDraft) {
    return errors[field] ? <span className="action-form__error" id={`${id}-${field}-error`}>{errors[field]}</span> : null;
  }
  return <form className="action-form" ref={form} noValidate aria-busy={busy} onSubmit={event => { event.preventDefault(); attempt(confirmation ?? 'save'); }}>
    <h3>{action ? 'Edit action' : 'Add action'}</h3>
    <p>Actions and their history are visible to the requester. Put confidential information in Internal Notes.</p>
    <p>Your draft stays on this page after a failed save. Signing out or an expired session may clear it.</p>
    {error ? <p className="action-form__error" role="alert">{error}</p> : null}
    {disabled || terminal ? <p role="status">{terminal ? 'This action is read-only.' : 'Saving is paused. Review the message above before continuing.'}</p> : null}
    <fieldset disabled={locked}>
      <legend className="visually-hidden">Action details</legend>
      <div className="action-form__fields">
        <label>Ticket number<input readOnly value={ticketNumber} /></label>
        <label>Performed by<input readOnly value={action?.performedBy.name ?? actorName} /></label>
        <label>Action status<input readOnly value={actionStatusLabels[action?.status ?? 'PLANNED']} /></label>
        <label>Action date/time (Bangkok)<input {...attributes('actionAt')} type="datetime-local" step="1" value={draft.actionAt} onChange={event => change('actionAt', event.target.value)} required />{fieldError('actionAt')}</label>
        <label>Assigned to<select {...attributes('assigneeId')} value={draft.assigneeId} onChange={event => change('assigneeId', event.target.value)} required>
          <option value="">Select active staff</option>
          {draft.assigneeId && !owners.some(owner => String(owner.id) === draft.assigneeId) ? <option value={draft.assigneeId}>{action?.assignee.name ?? 'Current assignee'} (Inactive or unavailable)</option> : null}
          {owners.map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
        </select>{fieldError('assigneeId')}</label>
      </div>
      <label>Action description<textarea {...attributes('description')} value={draft.description} maxLength={2000} onChange={event => change('description', event.target.value)} required />{fieldError('description')}<span>{draft.description.length}/2000 characters</span></label>
      <label>Result<textarea {...attributes('result')} value={draft.result} maxLength={2000} required={confirmation === 'complete'} onChange={event => change('result', event.target.value)} />{fieldError('result')}<span>{draft.result.length}/2000 characters</span></label>
      <label className="action-form__check"><input {...attributes('followUpRequired')} type="checkbox" checked={draft.followUpRequired} onChange={event => change('followUpRequired', event.target.checked)} />Follow-up required? {draft.followUpRequired ? 'Yes' : 'No'}</label>
      {fieldError('followUpRequired')}
      {draft.followUpRequired ? <label>Follow-up note<textarea {...attributes('followUpNote')} value={draft.followUpNote} maxLength={2000} onChange={event => change('followUpNote', event.target.value)} required />{fieldError('followUpNote')}</label> : <p>When follow-up is set to No, the current follow-up note is cleared. Previous notes remain in history.</p>}
      <label>Attachment notes<textarea {...attributes('attachmentNotes')} value={draft.attachmentNotes} maxLength={1000} onChange={event => change('attachmentNotes', event.target.value)} />{fieldError('attachmentNotes')}<span>Reference existing ticket files. This does not upload files.</span></label>
      {action ? <p>Originally created: {formatActionTime(action.createdAt)}</p> : null}
      {confirmation === 'complete' ? <div className="action-form__confirmation"><p>Confirm the work is complete, a result is recorded, and no follow-up remains.</p><button type="submit">Confirm complete action</button><button type="button" onClick={() => setConfirmation(null)}>Keep editing</button></div> : null}
      {confirmation === 'cancel' ? <div className="action-form__confirmation"><label>Cancellation reason<textarea {...attributes('cancellationReason')} value={draft.cancellationReason} maxLength={500} onChange={event => change('cancellationReason', event.target.value)} required />{fieldError('cancellationReason')}</label><p>Confirm cancellation of this action. Its history will be retained.</p><button type="submit">Confirm cancel action</button><button type="button" onClick={() => setConfirmation(null)}>Keep editing</button></div> : null}
      {!confirmation && !terminal ? <div className="action-form__buttons">
        <button type="submit">{busy ? 'Saving...' : action ? 'Save changes' : 'Save action'}</button>
        {action?.status === 'PLANNED' ? <button type="button" onClick={() => attempt('start')}>Start action</button> : null}
        {action?.status === 'IN_PROGRESS' ? <button type="button" onClick={() => setConfirmation('complete')}>Complete action</button> : null}
        {action && !terminal ? <button type="button" onClick={() => setConfirmation('cancel')}>Cancel action</button> : null}
      </div> : null}
    </fieldset>
    <button type="button" disabled={busy} onClick={cancelEditing}>Cancel editing</button>
  </form>;
}
