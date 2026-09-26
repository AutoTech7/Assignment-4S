import { CalendarDate } from './calendar-date';
import { normalizeWhitespace } from './text';

export interface StayDates {
  readonly checkIn: CalendarDate;
  readonly checkOut: CalendarDate;
}

export const nightsOf = (stay: StayDates): number => stay.checkIn.daysUntil(stay.checkOut);

/** `2026-10-23 → 2026-10-24`: unambiguous in assertions and reports. */
export const formatStay = (stay: StayDates): string => `${stay.checkIn.toIso()} → ${stay.checkOut.toIso()}`;

// month day[, year] - [month] day, year
const COMPACT_RANGE =
  /^([a-z]{3,9})\.? (\d{1,2})(?:, (\d{4}))? ?[-–—] ?(?:([a-z]{3,9})\.? )?(\d{1,2}), (\d{4})$/i;

/**
 * Parses the cart's stay range: "Oct 23 - 24, 2026", "Oct 31 - Nov 1, 2026", "Dec 31, 2026 - Jan 1, 2027".
 */
export function parseStayRange(text: string): StayDates {
  const match = COMPACT_RANGE.exec(normalizeWhitespace(text));
  const [, inMonth, inDay, inYear, outMonth, outDay, outYear] = match ?? [];
  if (!inMonth || !inDay || !outDay || !outYear) {
    throw new Error(`Unrecognised stay range "${text}"`);
  }

  const checkOutYear = Number(outYear);
  const checkInMonth = CalendarDate.monthNumber(inMonth);
  const checkOutMonth = CalendarDate.monthNumber(outMonth ?? inMonth);
  // "Dec 31 - Jan 1, 2027": the check-in year is implied by the check-out year.
  const checkInYear =
    inYear !== undefined ? Number(inYear) : checkInMonth > checkOutMonth ? checkOutYear - 1 : checkOutYear;

  return {
    checkIn: CalendarDate.of(checkInYear, checkInMonth, Number(inDay)),
    checkOut: CalendarDate.of(checkOutYear, checkOutMonth, Number(outDay)),
  };
}
