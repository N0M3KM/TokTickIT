/** Requester dashboard date contract; pure helpers never read the clock or DB. */
export class DashboardInputError extends Error {
  readonly code = 'VALIDATION_ERROR';
  constructor() { super('Use a supported dashboard filter and valid explicit-offset time range.'); this.name = 'DashboardInputError'; }
}

/** Reject JavaScript date normalization (February 30, 24:00, missing offset). */
export function parseDashboardInstant(value: unknown): string {
  if (typeof value !== 'string') throw new DashboardInputError();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) throw new DashboardInputError();
  const [, y, m, d, h, min, s, offset] = match;
  const [year, month, day, hour, minute, second] = [y, m, d, h, min, s].map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || second > 59) throw new DashboardInputError();
  if (offset !== 'Z' && (Number(offset.slice(1, 3)) > 23 || Number(offset.slice(4, 6)) > 59)) throw new DashboardInputError();
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new DashboardInputError();
  return new Date(timestamp).toISOString();
}

export interface RequesterSnapshotWindow {
  readonly asOf: string;
  readonly timeZone: 'Asia/Bangkok';
  readonly window: Readonly<{ from: string; to: string }>;
}

/** BR-23: midnight six Bangkok dates before today inclusive; asOf exclusive. */
export function createRequesterWindow(asOf: Date | string): RequesterSnapshotWindow {
  const instant = parseDashboardInstant(asOf instanceof Date && Number.isFinite(asOf.getTime()) ? asOf.toISOString() : asOf);
  // Bangkok has fixed UTC+07:00. UTC calendar operations avoid host timezone/DST.
  const local = new Date(Date.parse(instant) + 7 * 60 * 60 * 1000);
  local.setUTCHours(0, 0, 0, 0);
  local.setUTCDate(local.getUTCDate() - 6);
  const from = new Date(local.getTime() - 7 * 60 * 60 * 1000).toISOString();
  return Object.freeze({ asOf: instant, timeZone: 'Asia/Bangkok' as const, window: Object.freeze({ from, to: instant }) });
}
