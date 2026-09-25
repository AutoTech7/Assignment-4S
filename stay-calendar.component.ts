import { expect, type Locator } from '@playwright/test';
import type { StayRequest } from '@models/booking';
import { step } from '@support/step.decorator';
import { CalendarDate } from '@utils/calendar-date';
import { DAY_LABEL, isBookableDayLabel } from '@utils/calendar-labels';
import type { StayDates } from '@utils/stay-range';
import { escapeRegExp } from '@utils/text';

/** The booking engine does not sell stays much more than a year out. */
const MAX_MONTHS_AHEAD = 13;
/** How far beyond the requested stay length to look for a check-out when a minimum stay applies. */
const MAX_EXTRA_NIGHTS = 7;

/** The two-month date-range picker inside the availability widget. */
export class StayCalendar {
  readonly root: Locator;
  private readonly dayButtons: Locator;
  private readonly nextMonthButton: Locator;

  constructor(widget: Locator) {
    this.root = widget.getByRole('application', { name: 'Calendar Stay Dates' });
    this.dayButtons = this.root.getByRole('button', { name: DAY_LABEL });
    this.nextMonthButton = widget.getByRole('button', { name: 'Next month', exact: true });
  }

  /** Matches the date suffix only: the availability prefix changes as the selection progresses. */
  dayButton(date: CalendarDate): Locator {
    return this.root.getByRole('button', { name: new RegExp(`${escapeRegExp(date.toLongLabel())}$`) });
  }

  /**
   * Selects the first bookable check-in from `earliestCheckIn` (within `searchWindowDays`), then the first
   * selectable check-out at least `nights` later (more only if a minimum stay applies). Returns both.
   */
  @step()
  async selectStay(request: StayRequest): Promise<StayDates> {
    await expect(this.root).toBeVisible();
    const checkIn = await this.firstBookableCheckIn(request);
    await this.dayButton(checkIn).click();
    const checkOut = await this.firstSelectableCheckOut(checkIn, request.nights);
    await this.dayButton(checkOut).click();
    return { checkIn, checkOut };
  }

  private async firstBookableCheckIn({
    earliestCheckIn,
    searchWindowDays,
  }: StayRequest): Promise<CalendarDate> {
    for (let offset = 0; offset <= searchWindowDays; offset += 1) {
      const candidate = earliestCheckIn.addDays(offset);
      if (await this.isSelectable(candidate)) return candidate;
    }
    const lastTried = earliestCheckIn.addDays(searchWindowDays);
    throw new Error(`No bookable check-in between ${earliestCheckIn.toIso()} and ${lastTried.toIso()}`);
  }

  private async firstSelectableCheckOut(checkIn: CalendarDate, nights: number): Promise<CalendarDate> {
    for (let extra = 0; extra <= MAX_EXTRA_NIGHTS; extra += 1) {
      const candidate = checkIn.addDays(nights + extra);
      if (await this.isSelectable(candidate)) return candidate;
    }
    throw new Error(
      `No selectable check-out within ${nights + MAX_EXTRA_NIGHTS} nights of ${checkIn.toIso()}`,
    );
  }

  private async isSelectable(date: CalendarDate): Promise<boolean> {
    await this.showMonthOf(date);
    const button = this.dayButton(date);
    return (await button.isEnabled()) && isBookableDayLabel((await button.getAttribute('aria-label')) ?? '');
  }

  /** Pages forward until `date`'s month is rendered, waiting for each re-render so it never overshoots. */
  private async showMonthOf(date: CalendarDate): Promise<void> {
    for (let pagesTurned = 0; pagesTurned <= MAX_MONTHS_AHEAD; pagesTurned += 1) {
      const shown = await this.shownMonths();
      if (shown.length === 0) throw new Error('The availability calendar shows no days');
      if (shown.includes(date.monthKey)) return;
      if (date.monthKey < Math.min(...shown)) {
        throw new Error(`${date.toIso()} is earlier than the months the calendar shows`);
      }
      const lastShown = Math.max(...shown);
      await this.nextMonthButton.click();
      await expect
        .poll(async () => Math.max(...(await this.shownMonths())), {
          message: 'calendar should page forward',
        })
        .toBeGreaterThan(lastShown);
    }
    throw new Error(`Could not page the calendar forward to ${date.toIso()}`);
  }

  /** Month keys (e.g. 202610) currently rendered, derived from the day-button labels. */
  private async shownMonths(): Promise<number[]> {
    const labels = await this.dayButtons.evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute('aria-label') ?? ''),
    );
    const keys = labels.flatMap((label) => CalendarDate.findInText(label)?.monthKey ?? []);
    return [...new Set(keys)];
  }
}
