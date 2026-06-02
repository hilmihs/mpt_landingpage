/**
 * Asia/Jakarta (WIB, UTC+7, no DST) timezone helpers.
 *
 * Indonesia doesn't observe DST, so we can use a fixed offset, but going
 * through Intl.DateTimeFormat is more future-proof and handles any edge
 * cases around the date line / locale formatting.
 */

const JAKARTA_TZ = "Asia/Jakarta";

/**
 * Returns the YYYY-MM-DD date string representing "today" in WIB.
 * Format is sortable and matches Postgres DATE column input.
 */
export function todayJakartaISO(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

/**
 * Returns a Date pointing to 00:00:00 WIB of "today" (in JS, this is
 * stored as the equivalent UTC instant).
 */
export function startOfJakartaDay(now: Date = new Date()): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dateStr = fmt.format(now);
  // 00:00 WIB == ISO string with +07:00 offset
  return new Date(`${dateStr}T00:00:00+07:00`);
}

/**
 * Returns a Date pointing to 23:59:59.999 WIB of "today".
 */
export function endOfJakartaDay(now: Date = new Date()): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dateStr = fmt.format(now);
  return new Date(`${dateStr}T23:59:59.999+07:00`);
}

/**
 * Returns a Date pointing to start of (today + dayOffset) in WIB.
 */
export function jakartaDayOffset(offsetDays: number, now: Date = new Date()): Date {
  const d = startOfJakartaDay(now);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}
