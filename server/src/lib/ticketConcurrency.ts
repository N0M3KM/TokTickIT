import { Prisma, type Ticket, type UserRole } from '@prisma/client';
import { prisma } from './prisma.js';

export class WorkflowError extends Error {
  constructor(readonly status: number, readonly code: string, readonly details?: Record<string, unknown>) {
    super(code === 'STALE_UPDATE' ? 'This record changed. Reload before saving.' : 'The requested operation could not be completed.');
    this.name = 'WorkflowError';
  }
}

/** All action and workflow writes acquire this same parent lock before reads. */
export async function withTicketTransaction<T>(
  ticketId: number,
  actor: { id: number; role: UserRole },
  expectedVersion: number | undefined,
  callback: (tx: Prisma.TransactionClient, ticket: Ticket) => Promise<T>,
): Promise<T> {
  if (!Number.isSafeInteger(ticketId) || ticketId < 1) throw new WorkflowError(400, 'VALIDATION_ERROR');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`;
        const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) throw new WorkflowError(404, 'NOT_FOUND');
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.id} FOR SHARE`;
        const currentActor = await tx.user.findUnique({ where: { id: actor.id }, select: { isActive: true, role: true, mustChangePassword: true } });
        if (!currentActor?.isActive) throw new WorkflowError(403, 'ACCOUNT_INACTIVE');
        if (currentActor.mustChangePassword) throw new WorkflowError(403, 'PASSWORD_CHANGE_REQUIRED');
        if (currentActor.role !== actor.role) throw new WorkflowError(403, 'FORBIDDEN');
        if (actor.role === 'REQUESTER' && ticket.requesterId !== actor.id) throw new WorkflowError(403, 'FORBIDDEN');
        if (expectedVersion !== undefined && ticket.version !== expectedVersion) {
          throw new WorkflowError(409, 'STALE_UPDATE', { currentTicketVersion: ticket.version });
        }
        return callback(tx, ticket);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5000, timeout: 10000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (
        ['P2034', 'P2028'].includes(error.code)
        || (error.code === 'P2010' && ['40001', '40P01'].includes(String(error.meta?.code)))
      )) {
        if (attempt < 2) continue;
        throw new WorkflowError(409, 'STALE_UPDATE');
      }
      throw error;
    }
  }
  throw new WorkflowError(409, 'STALE_UPDATE');
}
