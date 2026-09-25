import { expect, test } from '@playwright/test';
import { CalendarDate } from '@utils/calendar-date';
import { DAY_LABEL, isBookableDayLabel } from '@utils/calendar-labels';

test.describe('CalendarDate', () => {
  test('formats for the query string, the widget and the calendar labels', () => {
    const date = CalendarDate.of(2026, 10, 23);
    expect(date.toIso()).toBe('2026-10-23');
    expect(date.toUsNumeric()).toBe('10/23/2026');
    expect(date.toLongLabel()).toBe('Friday, October 23, 2026');
    expect(date.monthKey).toBe(202610);
  });

  test('adds days across month, year and leap-day boundaries', () => {
    expect(CalendarDate.of(2026, 10, 31).addDays(1).toIso()).toBe('2026-11-01');
    expect(CalendarDate.of(2026, 12, 31).addDays(1).toIso()).toBe('2027-01-01');
    expect(CalendarDate.of(2028, 2, 28).addDays(1).toIso()).toBe('2028-02-29');
    expect(CalendarDate.of(2026, 3, 1).addDays(-1).toIso()).toBe('2026-02-28');
  });

  test('is immune to DST transitions (arithmetic is on UTC midnights)', () => {
    // US DST ends 2026-11-01 and starts 2027-03-14; a Date-based "+24h" can land on the wrong day.
    expect(CalendarDate.of(2026, 10, 31).addDays(2).toIso()).toBe('2026-11-02');
    expect(CalendarDate.of(2027, 3, 13).daysUntil(CalendarDate.of(2027, 3, 15))).toBe(2);
  });

  test('today() uses the local calendar day of the given instant', () => {
    expect(CalendarDate.today(new Date(2026, 8, 23, 23, 59)).toIso()).toBe('2026-09-23');
  });

  test('rejects impossible dates instead of silently rolling them over', () => {
    expect(() => CalendarDate.of(2026, 2, 30)).toThrow(RangeError);
    expect(() => CalendarDate.fromIso('2026-13-01')).toThrow(RangeError);
    expect(() => CalendarDate.fromIso('23/10/2026')).toThrow(/YYYY-MM-DD/);
  });

  test('resolves month names and abbreviations', () => {
    expect(CalendarDate.monthNumber('Oct')).toBe(10);
    expect(CalendarDate.monthNumber('SEPT.')).toBe(9);
    expect(CalendarDate.monthNumber('may')).toBe(5);
    expect(() => CalendarDate.monthNumber('Ju')).toThrow(/Unknown month/);
  });
});

test.describe('calendar day-button labels', () => {
  const available = 'Available check-in date Friday, October 23, 2026';
  const checkout = 'Available for checkout Saturday, October 24, 2026';
  const past = 'Out of Range Tuesday, September 1, 2026';

  test('every day button is recognised, other buttons are not', () => {
    for (const label of [available, checkout, past]) expect(label).toMatch(DAY_LABEL);
    expect('Next month').not.toMatch(DAY_LABEL);
  });

  test('the date is read from the end of the label', () => {
    expect(CalendarDate.findInText(available)?.toIso()).toBe('2026-10-23');
    expect(CalendarDate.findInText(checkout)?.toIso()).toBe('2026-10-24');
    expect(CalendarDate.findInText('Next month')).toBeUndefined();
  });

  test('bookability is read from the prefix', () => {
    expect(isBookableDayLabel(available)).toBe(true);
    expect(isBookableDayLabel(checkout)).toBe(true);
    expect(isBookableDayLabel(past)).toBe(false);
    expect(isBookableDayLabel('Unavailable check-in date Friday, October 30, 2026')).toBe(false);
  });
});
