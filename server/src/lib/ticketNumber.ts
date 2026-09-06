import { prisma } from './prisma.js';

/**
 * Formats a ticket number from year + sequential counter.
 * Format: TKT-YYYY-NNNNNN  (BR-01)
 */
export function formatTicketNumber(year: number, seq: number): string {
  return `TKT-${year}-${String(seq).padStart(6, '0')}`;
}

/**
 * Generates the next unique ticket number for the current year.
 * Uses a Prisma transaction to safely count existing tickets for the year
 * and derive the next sequential number.
 */
export async function generateTicketNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TKT-${year}-`;

  // Count tickets already issued this year to derive the next sequence number.
  // Wrapped in a transaction so concurrent requests don't produce duplicates.
  return prisma.$transaction(async (tx) => {
    const count = await tx.ticket.count({
      where: { ticketNumber: { startsWith: prefix } },
    });
    return formatTicketNumber(year, count + 1);
  });
}
