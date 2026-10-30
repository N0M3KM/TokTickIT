export type ActionStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export interface ActionActor { id: number; name: string; role: 'IT_STAFF' | 'ADMINISTRATOR' }
export interface ActionDTO {
  id: number; ticketId: number; actionAt: string; description: string; result: string | null;
  performedBy: ActionActor; assignee: ActionActor & { isActive: boolean };
  followUpRequired: boolean; followUpNote: string | null; attachmentNotes: string | null;
  status: ActionStatus; cancellationReason: string | null; version: number;
  updatedBy: ActionActor; createdAt: string; updatedAt: string;
}
export interface ActionRevision {
  id: number; actionId: number; version: number; eventType: 'CREATE' | 'EDIT' | 'STATUS';
  editor: ActionActor; snapshot: Record<string, unknown>; createdAt: string;
}
export interface PageInfo { page: number; pageSize: 10 | 25 | 50; total: number; totalPages: number }
export type ActionPageState = { status: 'loading' }
  | { status: 'error'; reason: 'forbidden' | 'not-found' | 'failure' }
  | { status: 'ready'; data: ActionDTO[]; pagination: PageInfo; ticketVersion: number };
export type RevisionPageState = { status: 'idle' | 'loading' } | { status: 'error' }
  | { status: 'ready'; data: ActionRevision[]; pagination: PageInfo };
export const actionStatusLabels: Record<ActionStatus, string> = {
  PLANNED: 'Planned', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
};
const bangkokDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' });
export function formatActionTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : `${bangkokDate.format(date)} (Bangkok)`;
}
