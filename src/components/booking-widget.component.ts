import { expect, type Locator, type Page } from '@playwright/test';
import { parseOccupancy, type StayRequest, type StaySearch } from '@models/booking';
import { step } from '@support/step.decorator';
import type { StayDates } from '@utils/stay-range';
import { escapeRegExp } from '@utils/text';
import { StayCalendar } from './stay-calendar.component';

/** The "Check Rates and Availability" bar at the top of every property page (and the results page). */
export class BookingWidget {
  readonly root: Locator;
  readonly dateField: Locator;
  readonly occupancyField: Locator;
  readonly applyDatesButton: Locator;
  readonly checkRatesButton: Locator;
  readonly calendar: StayCalendar;

  constructor(page: Page) {
    this.root = page.getByRole('form', { name: 'Check Rates and Availability' });
    // Accessible name is "Select Dates for Check-in and Check-out…" or "Selected Dates <from> to <to>…".
    this.dateField = this.root.getByRole('button', { name: /select(ed)? dates/i });
    this.occupancyField = this.root.getByRole('button', { name: /\d+\s*rooms?\b.*\d+\s*adults?/i });
    this.applyDatesButton = this.root.getByRole('button', { name: 'Apply', exact: true });
    this.checkRatesButton = this.root.getByRole('button', { name: 'Check Rates', exact: true });
    this.calendar = new StayCalendar(this.root);
  }

  /** The date field shows a selected range as "10/23/2026 - 10/24/2026". */
  async expectDates(stay: StayDates): Promise<void> {
    const range = `${escapeRegExp(stay.checkIn.toUsNumeric())}\\s*[-–]\\s*${escapeRegExp(stay.checkOut.toUsNumeric())}`;
    await expect(this.dateField).toContainText(new RegExp(range));
  }

  /** Picks a stay in the calendar and submits the search. Returns what was actually searched for. */
  @step()
  async checkRates(request: StayRequest): Promise<StaySearch> {
    const occupancy = parseOccupancy(await this.occupancyField.innerText());
    await this.dateField.click();
    const stay = await this.calendar.selectStay(request);
    await this.applyDatesButton.click();
    await this.expectDates(stay);
    await this.checkRatesButton.click();
    return { ...stay, occupancy };
  }
}
