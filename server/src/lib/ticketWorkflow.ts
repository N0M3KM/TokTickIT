import { Prisma, Ticket, TicketStatus, UserRole } from '@prisma/client';
import { canTransition } from './ticketStatus.js';

export type ResolutionReason = 'OWNER_REQUIRED' | 'OWNER_INACTIVE' | 'NO_COMPLETED_ACTION'
  | 'OPEN_ACTIONS' | 'FOLLOW_UP_OUTSTANDING' | 'FRESH_WORK_REQUIRED';
export interface ResolutionSummary {
  hasOwner: boolean; eligibleOwner: boolean; completed: number;
  active: number; followUp: number; reopened: boolean; freshCompleted: number;
}

/** The same gate is used for UI explanations and transactional status writes. */
export function resolutionReasons(summary: ResolutionSummary): ResolutionReason[] {
  const reasons: ResolutionReason[] = [];
  if (!summary.hasOwner) reasons.push('OWNER_REQUIRED');
  else if (!summary.eligibleOwner) reasons.push('OWNER_INACTIVE');
  if (summary.completed === 0) reasons.push('NO_COMPLETED_ACTION');
  if (summary.active > 0) reasons.push('OPEN_ACTIONS');
  if (summary.followUp > 0) reasons.push('FOLLOW_UP_OUTSTANDING');
  if (summary.reopened && summary.freshCompleted === 0) reasons.push('FRESH_WORK_REQUIRED');
  return reasons;
}

export function allowedTicketTransitions(status: TicketStatus, role: UserRole): TicketStatus[] {
  return Object.values(TicketStatus).filter(next => canTransition(status, next, role));
}

export async function readResolutionGate(tx: Prisma.TransactionClient, ticket: Pick<Ticket, 'id' | 'ticketOwnerId' | 'reopenedAt'>) {
  if (ticket.ticketOwnerId !== null) await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${ticket.ticketOwnerId} FOR SHARE`;
  const completedWhere: Prisma.ActionTakenWhereInput = {
    ticketId: ticket.id, status: 'COMPLETED', result: { not: null }, NOT: { result: '' },
  };
  const [owner, completed, active, followUp, freshCompleted] = await Promise.all([
    ticket.ticketOwnerId === null ? null : tx.user.findUnique({ where: { id: ticket.ticketOwnerId }, select: { isActive: true, role: true } }),
    tx.actionTaken.count({ where: completedWhere }),
    tx.actionTaken.count({ where: { ticketId: ticket.id, status: { in: ['PLANNED', 'IN_PROGRESS'] } } }),
    tx.actionTaken.count({ where: { ticketId: ticket.id, status: { not: 'CANCELLED' }, followUpRequired: true } }),
    ticket.reopenedAt ? tx.actionTaken.count({ where: { ...completedWhere, createdAt: { gte: ticket.reopenedAt } } }) : 0,
  ]);
  return { reasons: resolutionReasons({
    hasOwner: ticket.ticketOwnerId !== null,
    eligibleOwner: Boolean(owner?.isActive && (owner.role === 'IT_STAFF' || owner.role === 'ADMINISTRATOR')),
    completed, active, followUp, reopened: ticket.reopenedAt !== null, freshCompleted,
  }) };
}
