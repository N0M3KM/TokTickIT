import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker, useLocation } from 'react-router-dom';
import type { AuthUser } from '../../context/AuthContext.js';
import ActionDetails from './ActionDetails.js';
import ActionForm, { createInitialDraft, type ActionDraft, type ActionIntent } from './ActionForm.js';
import ActionsTaken from './ActionsTaken.js';
import { ActionApiError, createAction, fetchAction, fetchActionHistory, fetchActionOwners, fetchActions, updateAction, type ActionBusinessInput, type ActionOwner, type CreateActionBody } from './api.js';
import type { ActionDTO, ActionPageState, RevisionPageState } from './types.js';

interface Props {
  ticket: { id: number; ticketNumber: string; createdAt: string; currentStatus: string };
  user: AuthUser;
  onSaved: () => void;
}
interface Editor {
  key: number; action?: ActionDTO; initial: ActionDraft; ticketVersion: number;
  error?: string; fields?: Record<string, string>; conflict?: boolean;
}
const isActive = (status: string) => ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED'].includes(status);

/** Keyed by ticket and authenticated user at the call site: no cross-account drafts. */
export default function TicketActions({ ticket, user, onSaved }: Props) {
  const location = useLocation();
  const [state, setState] = useState<ActionPageState>({ status: 'loading' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(10);
  const [refresh, setRefresh] = useState(0);
  const [history, setHistory] = useState<Record<number, RevisionPageState>>({});
  const [owners, setOwners] = useState<ActionOwner[]>([]);
  const [ownersError, setOwnersError] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState('');
  const [linked, setLinked] = useState<ActionDTO | null>(null);
  const [linkError, setLinkError] = useState('');
  const [latest, setLatest] = useState<{ ticketVersion: number; action?: ActionDTO } | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const saving = useRef(false);
  const mounted = useRef(true);
  const listGeneration = useRef(0);
  const historyControllers = useRef(new Map<number, AbortController>());
  const pendingCreate = useRef<{ signature: string; key: string; body: CreateActionBody } | null>(null);
  const blocker = useBlocker(dirty || uncertain || busy);
  const canWrite = user.role !== 'REQUESTER' && isActive(ticket.currentStatus);
  const hashMatch = /^#action-([1-9]\d*)$/.exec(location.hash);
  const focusActionId = hashMatch && Number.isSafeInteger(Number(hashMatch[1])) ? Number(hashMatch[1]) : undefined;

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm('Leave this page and discard the unsaved action draft?')) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; historyControllers.current.forEach(controller => controller.abort()); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const generation = ++listGeneration.current;
    setState({ status: 'loading' });
    fetchActions(ticket.id, page, pageSize, controller.signal).then(data => {
      if (controller.signal.aborted || generation !== listGeneration.current) return;
      if (page > data.pagination.totalPages) { setPage(data.pagination.totalPages); return; }
      setState({ status: 'ready', ...data });
    }).catch(error => {
      if (controller.signal.aborted || generation !== listGeneration.current) return;
      const reason = error instanceof ActionApiError && error.status === 403 ? 'forbidden'
        : error instanceof ActionApiError && error.status === 404 ? 'not-found' : 'failure';
      setState({ status: 'error', reason });
    });
    return () => controller.abort();
  }, [ticket.id, page, pageSize, refresh]);

  useEffect(() => {
    if (user.role === 'REQUESTER') return;
    const controller = new AbortController();
    setOwnersError(false);
    fetchActionOwners(controller.signal).then(data => { if (!controller.signal.aborted) setOwners(data); })
      .catch(() => { if (!controller.signal.aborted) setOwnersError(true); });
    return () => controller.abort();
  }, [user.role, refresh]);

  useEffect(() => {
    const controller = new AbortController();
    setLinked(null); setLinkError('');
    if (focusActionId) {
      fetchAction(ticket.id, focusActionId, controller.signal).then(data => {
        if (!controller.signal.aborted) setLinked(data.data);
      }).catch(() => { if (!controller.signal.aborted) setLinkError('Could not load the linked action. Check access or retry.'); });
    }
    return () => controller.abort();
  }, [ticket.id, focusActionId, refresh]);

  const linkedOutsidePage = linked && state.status === 'ready' && !state.data.some(action => action.id === linked.id);
  useEffect(() => {
    if (linkedOutsidePage) document.getElementById(`action-${linked.id}`)?.focus();
  }, [linkedOutsidePage, linked]);

  useEffect(() => {
    if (!dirty && !uncertain && !busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    // Sign out mutates the session rather than navigating through the router.
    const confirmLink = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const navigation = target?.closest('.lab3-identity button');
      if (navigation && !window.confirm('Leave this page and discard the unsaved action draft?')) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    document.addEventListener('click', confirmLink, true);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', confirmLink, true); };
  }, [dirty, uncertain, busy]);

  const requestHistory = useCallback((actionId: number, historyPage: number) => {
    historyControllers.current.get(actionId)?.abort();
    const controller = new AbortController();
    historyControllers.current.set(actionId, controller);
    setHistory(current => ({ ...current, [actionId]: { status: 'loading' } }));
    fetchActionHistory(ticket.id, actionId, historyPage, controller.signal).then(data => {
      if (!controller.signal.aborted && mounted.current) setHistory(current => ({ ...current, [actionId]: { status: 'ready', ...data } }));
    }).catch(() => {
      if (!controller.signal.aborted && mounted.current) setHistory(current => ({ ...current, [actionId]: { status: 'error' } }));
    });
  }, [ticket.id]);

  function openEditor(action?: ActionDTO) {
    if (!canWrite || state.status !== 'ready') return;
    if (editor && (dirty || uncertain) && !window.confirm('Discard the current draft and open another action?')) return;
    pendingCreate.current = null; setUncertain(false); setLatest(null); setDirty(false); setNotice('');
    setEditor({ key: Date.now(), action, initial: createInitialDraft(action, user.id), ticketVersion: state.ticketVersion });
  }

  async function persist(draft: ActionDraft, intent: ActionIntent, retryOriginal = false) {
    if (!editor || !canWrite || saving.current || editor.conflict) return;
    const body: ActionBusinessInput = {
      actionAt: new Date(`${draft.actionAt}${draft.actionAt.length === 16 ? ':00' : ''}+07:00`).toISOString(),
      description: draft.description.trim(), result: draft.result.trim() || null, assigneeId: Number(draft.assigneeId),
      followUpRequired: draft.followUpRequired, followUpNote: draft.followUpRequired ? draft.followUpNote.trim() : null,
      attachmentNotes: draft.attachmentNotes.trim() || null,
    };
    saving.current = true; setBusy(true); setNotice('');
    setEditor(current => current ? { ...current, error: undefined, fields: undefined } : current);
    try {
      let response;
      if (editor.action) {
        const status = intent === 'start' ? 'IN_PROGRESS' : intent === 'complete' ? 'COMPLETED' : intent === 'cancel' ? 'CANCELLED' : undefined;
        response = await updateAction(ticket.id, editor.action.id, {
          ...body, expectedTicketVersion: editor.ticketVersion, expectedVersion: editor.action.version,
          ...(status ? { status } : {}), ...(intent === 'cancel' ? { cancellationReason: draft.cancellationReason.trim() } : {}),
        });
      } else {
        const signature = JSON.stringify(body);
        if (!pendingCreate.current || (!retryOriginal && signature !== pendingCreate.current.signature)) {
          pendingCreate.current = { signature, key: crypto.randomUUID(), body: { ...body, expectedTicketVersion: editor.ticketVersion } };
        } else if (!retryOriginal) {
          pendingCreate.current.body = { ...body, expectedTicketVersion: editor.ticketVersion };
        }
        response = await createAction(ticket.id, pendingCreate.current.body, pendingCreate.current.key);
      }
      if (!mounted.current) return;
      pendingCreate.current = null; setUncertain(false); setDirty(false); setEditor(null); setLatest(null);
      historyControllers.current.forEach(controller => controller.abort()); historyControllers.current.clear();
      setHistory({}); setLinked(focusActionId === response.data.id ? response.data : null);
      setNotice('Action saved.'); setRefresh(value => value + 1); onSaved();
    } catch (error) {
      if (!mounted.current) return;
      const apiError = error instanceof ActionApiError ? error : null;
      const stale = apiError?.status === 409;
      if (!editor.action && (!apiError || apiError.status === 0 || apiError.status >= 500)) setUncertain(true);
      setEditor(current => current ? { ...current, error: apiError?.message ?? 'Could not save the action. Your draft is retained.', fields: apiError?.fields, conflict: stale } : current);
    } finally {
      saving.current = false; if (mounted.current) setBusy(false);
    }
  }

  async function loadLatest() {
    if (!editor || saving.current) return;
    saving.current = true; setBusy(true);
    try {
      const current = editor.action ? await fetchAction(ticket.id, editor.action.id) : await fetchActions(ticket.id, page, pageSize);
      if (!mounted.current) return;
      setLatest({ ticketVersion: current.ticketVersion, action: 'pagination' in current ? undefined : current.data });
      onSaved();
    } catch {
      if (mounted.current) setEditor(current => current ? { ...current, error: 'Could not reload the latest values. Your draft is retained.' } : current);
    } finally { saving.current = false; if (mounted.current) setBusy(false); }
  }

  return <div className="ticket-actions">
    {notice ? <p role="status">{notice}</p> : null}
    {!isActive(ticket.currentStatus) ? <p>Reopen the ticket before recording more work.</p> : null}
    {ownersError && user.role !== 'REQUESTER' ? <p role="alert">Could not load active assignees. <button type="button" onClick={() => setRefresh(value => value + 1)}>Retry assignees</button></p> : null}
    {canWrite && state.status === 'ready' && !editor ? <button type="button" disabled={ownersError || !owners.length} onClick={() => openEditor()}>Add action</button> : null}
    {editor ? <>
      {editor.conflict ? <div role="alert" className="actions-taken__conflict">
        <p>This record changed or cannot accept this update. Your draft is retained. Reload the latest values before choosing how to continue.</p>
        <button type="button" disabled={busy} onClick={() => void loadLatest()}>Reload latest values</button>
        {latest ? <div>
          <h3>Latest server values</h3>
          {latest.action ? <dl><dt>Action date/time</dt><dd>{latest.action.actionAt}</dd><dt>Description</dt><dd>{latest.action.description}</dd><dt>Result</dt><dd>{latest.action.result ?? 'None'}</dd><dt>Status</dt><dd>{latest.action.status}</dd><dt>Performed by</dt><dd>{latest.action.performedBy.name}</dd><dt>Assigned to</dt><dd>{latest.action.assignee.name}</dd><dt>Follow-up required</dt><dd>{latest.action.followUpRequired ? 'Yes' : 'No'}</dd><dt>Follow-up note</dt><dd>{latest.action.followUpNote ?? 'None'}</dd><dt>Attachment notes</dt><dd>{latest.action.attachmentNotes ?? 'None'}</dd><dt>Cancellation reason</dt><dd>{latest.action.cancellationReason ?? 'None'}</dd></dl> : <p>Latest ticket version: {latest.ticketVersion}. Review the current action list before retrying.</p>}
          <button type="button" disabled={busy || (latest.action ? !['PLANNED', 'IN_PROGRESS'].includes(latest.action.status) : false)} onClick={() => {
            setEditor(current => current ? { ...current, ticketVersion: latest.ticketVersion, action: latest.action ?? current.action, error: undefined, fields: undefined, conflict: false } : current);
            setLatest(null);
          }}>Use latest versions and keep my draft</button>
        </div> : null}
      </div> : null}
      {uncertain ? <div role="alert"><p>The creation outcome is unknown. Retry the original submission with the same key before editing or creating another action.</p><button type="button" disabled={busy} onClick={() => void persist(editor.initial, 'save', true)}>Retry original submission</button></div> : null}
      <ActionForm key={editor.key} initial={editor.initial} action={editor.action} actorName={user.name} ticketNumber={ticket.ticketNumber} ticketCreatedAt={ticket.createdAt} owners={owners} busy={busy} disabled={!canWrite || editor.conflict || uncertain} error={editor.error} fieldErrors={editor.fields} onSubmit={(draft, intent) => void persist(draft, intent)} onDirtyChange={setDirty} onCancel={() => {
        if (uncertain && !window.confirm('The action may already have been created. Discard this draft and check the action list before creating more work?')) return;
        setEditor(null); setDirty(false); setUncertain(false); pendingCreate.current = null; setLatest(null);
      }} />
    </> : null}
    {linkError ? <div role="alert">{linkError} <button type="button" onClick={() => setRefresh(value => value + 1)}>Retry linked action</button></div> : null}
    {linkedOutsidePage ? <section id={`action-${linked.id}`} tabIndex={-1} aria-label={`Linked action ${linked.id}`}><h2>Linked action {linked.id}</h2><p>This action is outside the current list page.</p><ActionDetails action={linked} history={history[linked.id] ?? { status: 'idle' }} onHistoryOpen={() => requestHistory(linked.id, 1)} onHistoryPageChange={value => requestHistory(linked.id, value)} />{canWrite && ['PLANNED', 'IN_PROGRESS'].includes(linked.status) && !editor ? <button type="button" onClick={() => openEditor(linked)}>Edit action {linked.id}</button> : null}</section> : null}
    <ActionsTaken state={state} historyByAction={history} onRetry={() => setRefresh(value => value + 1)} onPageChange={setPage} onPageSizeChange={value => { setPage(1); setPageSize(value); }} onHistoryRequest={requestHistory} focusActionId={focusActionId} onEdit={canWrite && !editor ? openEditor : undefined} />
  </div>;
}
