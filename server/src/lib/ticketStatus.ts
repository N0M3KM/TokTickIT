import { TicketStatus, UserRole } from '@prisma/client';

const transitions: Record<TicketStatus, TicketStatus[]> = {
  NEW: ['OPEN', 'CANCELLED'],
  OPEN: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
  WAITING_FOR_REQUESTER: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['IN_PROGRESS', 'CANCELLED'],
  CANCELLED: [],
};

export function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === 'string' && Object.values(TicketStatus).includes(value as TicketStatus);
}

export function canTransition(from: TicketStatus, to: TicketStatus, role: UserRole): boolean {
  if (!transitions[from].includes(to)) return false;
  if (role === 'REQUESTER') return (from === 'RESOLVED' || from === 'CLOSED') && to === 'REOPENED';
  return role === 'IT_STAFF' || role === 'ADMINISTRATOR';
}

export function validateContent(content: unknown): string | null {
  if (typeof content !== 'string' || !content.trim()) return 'Content must not be empty or whitespace only.';
  if (content.trim().length > 2000) return 'Content must not exceed 2000 characters.';
  return null;
}
