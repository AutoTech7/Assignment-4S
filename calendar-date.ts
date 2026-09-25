const MS_PER_DAY = 86_400_000;

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const;

const LONG_LABEL = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Matches the date part of labels such as "Available check-in date Friday, October 23, 2026". */
const LONG_DATE_IN_TEXT = new RegExp(`(${MONTHS.join('|')}) (\\d{1,2}), (\\d{4})`, 'i');

const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * A calendar date without a time zone. Stays are dates, not instants; arithmetic runs on UTC midnights so
 * midnight and DST changes cannot shift a day.
 */
export class CalendarDate {
  private constructor(
    readonly year: number,
    /** 1–12 */
    readonly month: number,
    readonly day: number,
  ) {}

  static of(year: number, month: number, day: number): CalendarDate {
    const probe = new Date(Date.UTC(year, month - 1, day));
    const isValid =
      Number.isInteger(year) &&
      Number.isInteger(month) &&
      Number.isInteger(day) &&
      probe.getUTCFullYear() === year &&
      probe.getUTCMonth() === month - 1 &&
      probe.getUTCDate() === day;
    if (!isValid) throw new RangeError(`Invalid calendar date: ${year}-${month}-${day}`);
    return new CalendarDate(year, month, day);
  }

  /** Today on the test machine, which shares the browser's clock and time zone. */
  static today(now: Date = new Date()): CalendarDate {
    return CalendarDate.of(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }

  /** Parses `YYYY-MM-DD`. */
  static fromIso(value: string): CalendarDate {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) throw new RangeError(`Expected an ISO date (YYYY-MM-DD), received "${value}"`);
    return CalendarDate.of(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  /** Finds a "October 23, 2026"-style date anywhere in `text`; `undefined` when there is none. */
  static findInText(text: string): CalendarDate | undefined {
    const match = LONG_DATE_IN_TEXT.exec(text);
    if (!match?.[1]) return undefined;
    return CalendarDate.of(Number(match[3]), CalendarDate.monthNumber(match[1]), Number(match[2]));
  }

  /** 'Oct', 'october', 'OCT.' → 10. */
  static monthNumber(name: string): number {
    const key = name.trim().toLowerCase().replace(/\.$/, '');
    const index = key.length >= 3 ? MONTHS.findIndex((month) => month.startsWith(key)) : -1;
    if (index === -1) throw new RangeError(`Unknown month name "${name}"`);
    return index + 1;
  }

  /** Sortable key for the month, e.g. 202610 for October 2026. */
  get monthKey(): number {
    return this.year * 100 + this.month;
  }

  addDays(days: number): CalendarDate {
    const shifted = new Date(this.utcMidnight() + days * MS_PER_DAY);
    return CalendarDate.of(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
  }

  daysUntil(other: CalendarDate): number {
    return Math.round((other.utcMidnight() - this.utcMidnight()) / MS_PER_DAY);
  }

  /** `2026-10-23`, the booking engine's query-string format. */
  toIso(): string {
    return `${this.year}-${pad(this.month)}-${pad(this.day)}`;
  }

  /** `10/23/2026`, as the availability widget displays it. */
  toUsNumeric(): string {
    return `${pad(this.month)}/${pad(this.day)}/${this.year}`;
  }

  /** `Friday, October 23, 2026`, the suffix of every day-button label in the calendar. */
  toLongLabel(): string {
    return LONG_LABEL.format(new Date(this.utcMidnight()));
  }

  toString(): string {
    return this.toIso();
  }

  private utcMidnight(): number {
    return Date.UTC(this.year, this.month - 1, this.day);
  }
}
