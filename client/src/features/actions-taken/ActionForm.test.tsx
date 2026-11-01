import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ActionForm, { createInitialDraft, type ActionFormProps } from './ActionForm.js';
import type { ActionDTO } from './types.js';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
const actor = { id: 5, name: 'Original performer', role: 'IT_STAFF' as const };
const action: ActionDTO = {
  id: 1, ticketId: 42, actionAt: '2026-09-27T02:00:00.000Z', description: 'Inspect adapter', result: null,
  performedBy: actor, assignee: { ...actor, isActive: true }, status: 'PLANNED', followUpRequired: false,
  followUpNote: null, attachmentNotes: null, cancellationReason: null, version: 2, updatedBy: actor,
  createdAt: '2026-09-27T02:00:00.000Z', updatedAt: '2026-09-27T02:00:00.000Z',
};
function setup(overrides: Partial<ActionFormProps> = {}) {
  const props: ActionFormProps = {
    initial: createInitialDraft(action), actorName: 'Current editor', ticketNumber: 'TT-42',
    ticketCreatedAt: '2026-09-01T00:00:00.000Z', owners: [{ id: 5, name: 'Staff A' }, { id: 6, name: 'Staff B' }],
    busy: false, onSubmit: vi.fn(), onCancel: vi.fn(), onDirtyChange: vi.fn(), ...overrides,
  };
  return { props, ...render(<ActionForm {...props} />) };
}

describe('ActionForm', () => {
  it('initializes current Bangkok time and creator without changing original action values', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-30T10:12:13Z'));
    expect(createInitialDraft(undefined, 6)).toMatchObject({ actionAt: '2026-10-30T17:12:13', assigneeId: '6', description: '', followUpRequired: false });
    expect(createInitialDraft(action)).toMatchObject({ actionAt: '2026-09-27T09:00:00', assigneeId: '5' });
  });
  it('keeps immutable ticket/performer fields read-only and allows independent assignment', () => {
    const { props } = setup({ action });
    expect(screen.getByLabelText('Ticket number')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Performed by')).toHaveValue('Original performer');
    expect(screen.getByLabelText('Performed by')).toHaveAttribute('readonly');
    fireEvent.change(screen.getByLabelText('Assigned to'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ assigneeId: '6' }), 'save');
  });
  it('validates and focuses first invalid field without submitting', async () => {
    const { props } = setup({ initial: { ...createInitialDraft(action), actionAt: '', description: ' ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save action' }));
    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Action date/time (Bangkok)')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/Enter an action description/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Action date/time (Bangkok)')).toHaveFocus());
  });
  it.each(['2026-08-01T12:00:00', '2099-01-01T12:00:00', '2026-02-30T12:00:00'])('rejects out of bounds or invalid date %s', actionAt => {
    const { props } = setup({ initial: { ...createInitialDraft(action), actionAt } });
    fireEvent.click(screen.getByRole('button', { name: 'Save action' }));
    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Action date/time (Bangkok)')).toHaveAttribute('aria-invalid', 'true');
  });
  it('preserves draft across failed save and latest initial props, then retries same intent', () => {
    const { props, rerender } = setup();
    fireEvent.change(screen.getByLabelText(/Action description/), { target: { value: 'My unsaved work' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save action' }));
    rerender(<ActionForm {...props} initial={{ ...props.initial, description: 'Latest server version' }} error="This action changed. Reconcile before retrying." />);
    expect(screen.getByLabelText(/Action description/)).toHaveValue('My unsaved work');
    expect(screen.getByRole('alert')).toHaveTextContent('Reconcile');
    fireEvent.click(screen.getByRole('button', { name: 'Save action' }));
    expect(props.onSubmit).toHaveBeenNthCalledWith(2, expect.objectContaining({ description: 'My unsaved work' }), 'save');
  });
  it('requires a follow-up note and clears it explicitly when toggled off', () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Save action' }));
    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Follow-up note')).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(screen.getByLabelText('Follow-up note'), { target: { value: 'Please call requester' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Save action' }));
    expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ followUpRequired: false, followUpNote: '' }), 'save');
  });
  it('offers Start only for Planned and sends start as separate intent', () => {
    const { props } = setup({ action });
    expect(screen.queryByRole('button', { name: 'Complete action' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start action' }));
    expect(props.onSubmit).toHaveBeenCalledWith(expect.any(Object), 'start');
  });
  it('requires explicit completion confirmation, result and finished follow-up', () => {
    const { props } = setup({ action: { ...action, status: 'IN_PROGRESS' } });
    expect(screen.queryByRole('button', { name: 'Start action' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Complete action' }));
    expect(props.onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm complete action' }));
    expect(screen.getByText('Enter a result before completing the action.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Result'), { target: { value: 'Adapter replaced and tested' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText('Follow-up note'), { target: { value: 'Call requester' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm complete action' }));
    expect(screen.getByText('Complete the follow-up before completing this action.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm complete action' }));
    expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ result: 'Adapter replaced and tested', followUpRequired: false }), 'complete');
  });
  it('requires cancellation reason and confirmation, permits retiring an inactive assignment', () => {
    const { props } = setup({ action, owners: [], initial: createInitialDraft({ ...action, assignee: { ...actor, isActive: false } }) });
    expect(screen.getByText(/Inactive or unavailable/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel action' }));
    expect(props.onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancel action' }));
    expect(screen.getByLabelText('Cancellation reason')).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(screen.getByLabelText('Cancellation reason'), { target: { value: 'Work no longer needed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancel action' }));
    expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ cancellationReason: 'Work no longer needed' }), 'cancel');
  });
  it('rejects unavailable assignees for ordinary saves', () => {
    const { props } = setup({ owners: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Save action' }));
    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Assigned to')).toHaveAttribute('aria-invalid', 'true');
  });
  it('confirms dirty discard and preserves draft when declined', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { props } = setup();
    fireEvent.change(screen.getByLabelText(/Action description/), { target: { value: 'Keep draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel editing' }));
    expect(props.onCancel).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Action description/)).toHaveValue('Keep draft');
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel editing' }));
    expect(props.onCancel).toHaveBeenCalledOnce();
    expect(props.onDirtyChange).toHaveBeenLastCalledWith(true);
  });
  it.each([{ busy: true }, { disabled: true }, { action: { ...action, status: 'COMPLETED' as const } }])('prevents writes when busy/read-only %j', overrides => {
    const { props, container } = setup(overrides);
    expect(container.querySelector('fieldset')).toBeDisabled();
    fireEvent.submit(container.querySelector('form')!);
    expect(props.onSubmit).not.toHaveBeenCalled();
  });
  it('connects safe server validation to the relevant field and focuses it', async () => {
    setup({ fieldErrors: { description: 'Please correct this description.' } });
    const field = screen.getByLabelText(/Action description/);
    expect(field).toHaveAttribute('aria-describedby');
    await waitFor(() => expect(field).toHaveFocus());
  });
});
