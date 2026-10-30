import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ActionsTaken from './ActionsTaken.js';
import type { ActionDTO, ActionPageState, RevisionPageState } from './types.js';

afterEach(cleanup);
const actor = { id: 5, name: 'Staff A', role: 'IT_STAFF' as const };
const action: ActionDTO = {
  id: 101, ticketId: 42, actionAt: '2026-09-27T02:00:00.000Z', description: 'Inspect the adapter',
  result: null, performedBy: actor, assignee: { ...actor, name: 'Staff B', isActive: false },
  followUpRequired: true, followUpNote: 'Wait for requester', attachmentNotes: 'adapter.png',
  status: 'PLANNED', cancellationReason: null, version: 1, updatedBy: actor,
  createdAt: '2026-09-27T02:01:00.000Z', updatedAt: '2026-09-27T02:01:00.000Z',
};
function ready(data = [action]): ActionPageState {
  return { status: 'ready', data, pagination: { page: 1, pageSize: 10, total: data.length, totalPages: 1 }, ticketVersion: 8 };
}
function setup(state = ready(), historyByAction: Record<number, RevisionPageState> = {}) {
  const callbacks = { onRetry: vi.fn(), onPageChange: vi.fn(), onPageSizeChange: vi.fn(), onHistoryRequest: vi.fn() };
  const view = render(<ActionsTaken state={state} historyByAction={historyByAction} {...callbacks} />);
  return { ...callbacks, ...view };
}

describe('Actions Taken isolated read-only preparation', () => {
  it('distinguishes loading and empty success, without fabricated rows', () => {
    const view = setup({ status: 'loading' });
    expect(screen.getByRole('status')).toHaveTextContent('Loading actions');
    expect(screen.queryByText('No actions recorded for this ticket.')).not.toBeInTheDocument();
    view.unmount();
    setup(ready([]));
    expect(screen.getByText('No actions recorded for this ticket.')).toBeInTheDocument();
  });

  it.each(['forbidden', 'not-found'] as const)('does not show action content for %s', reason => {
    setup({ status: 'error', reason });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry actions' })).not.toBeInTheDocument();
  });

  it('retries a safe fetch failure', () => {
    const { onRetry } = setup({ status: 'error', reason: 'failure' });
    fireEvent.click(screen.getByRole('button', { name: 'Retry actions' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows all statuses and inactive assignees without mutation controls', () => {
    const statuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
    setup(ready(statuses.map((status, i) => ({ ...action, id: 101 + i, status }))));
    for (const label of ['Planned', 'In progress', 'Completed', 'Cancelled']) expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getAllByText('Staff B (Inactive)')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: /^(add|edit|start|complete|cancel)/i })).not.toBeInTheDocument();
    expect(screen.getByText(/visible to the requester/)).toBeInTheDocument();
  });

  it('preserves server order and exposes complete escaped text with Bangkok dates', () => {
    const injected = '<img src=x onerror=alert(1)>';
    const { container } = setup(ready([{ ...action, id: 102, description: injected }, action]));
    expect(screen.getAllByRole('article').map(row => row.getAttribute('aria-label'))).toEqual(['Action 102', 'Action 101']);
    fireEvent.click(screen.getByRole('button', { name: 'View action 102' }));
    expect(screen.getAllByText(injected)).toHaveLength(2);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getAllByText(/09:00 \(Bangkok\)/).length).toBeGreaterThan(0);
    expect(screen.getByText('adapter.png')).toBeInTheDocument();
    expect(screen.getByText('Wait for requester')).toBeInTheDocument();
  });

  it('only requests history when expanded and renders no invented legacy history', () => {
    const history: RevisionPageState = { status: 'ready', data: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } };
    const view = setup(ready(), { 101: history });
    expect(view.onHistoryRequest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'View action 101' }));
    fireEvent.click(screen.getByText('Revision history for action 101'));
    expect(screen.getByText('No recorded history')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next history page' })).toBeDisabled();
  });

  it('renders only allowlisted snapshot fields and supports history retry', () => {
    setup(ready(), { 101: { status: 'ready', pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 }, data: [{
      id: 1, actionId: 101, version: 1, eventType: 'CREATE', editor: actor, createdAt: action.createdAt,
      snapshot: { description: 'Historical description', followUpRequired: false, performedById: 5, assigneeId: 6, updatedById: 5, internalNote: 'Secret internal note' },
    }] } });
    fireEvent.click(screen.getByRole('button', { name: 'View action 101' }));
    fireEvent.click(screen.getByText('Revision history for action 101'));
    expect(screen.getByText('Historical description')).toBeInTheDocument();
    expect(screen.getByText('Performed by account')).toBeInTheDocument();
    expect(screen.getByText('Assigned account')).toBeInTheDocument();
    expect(screen.getByText('Editor account')).toBeInTheDocument();
    expect(screen.queryByText('Secret internal note')).not.toBeInTheDocument();
    cleanup();
    const view = setup(ready(), { 101: { status: 'error' } });
    fireEvent.click(screen.getByRole('button', { name: 'View action 101' }));
    fireEvent.click(screen.getByText('Revision history for action 101'));
    fireEvent.click(screen.getByRole('button', { name: 'Retry history' }));
    expect(view.onHistoryRequest).toHaveBeenCalledWith(101, 1);
  });

  it('uses server totals for paging and exposes allowed page sizes', () => {
    const state = ready();
    if (state.status !== 'ready') throw new Error('Fixture');
    state.pagination = { page: 2, pageSize: 10, total: 21, totalPages: 3 };
    const view = setup(state);
    const nav = within(screen.getByRole('navigation', { name: 'Actions pages' }));
    fireEvent.click(nav.getByRole('button', { name: 'Next actions page' }));
    expect(view.onPageChange).toHaveBeenCalledWith(3);
    fireEvent.click(nav.getByRole('button', { name: 'Previous actions page' }));
    expect(view.onPageChange).toHaveBeenCalledWith(1);
    fireEvent.change(screen.getByLabelText('Actions per page'), { target: { value: '25' } });
    expect(view.onPageSizeChange).toHaveBeenCalledWith(25);
    expect(nav.getByRole('status')).toHaveTextContent('21 actions');
  });
});
