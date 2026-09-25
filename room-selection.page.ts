import { errors, expect, type Locator, type Page } from '@playwright/test';
import { BookingWidget } from '@components/booking-widget.component';
import { RATE_CTA, RoomCard } from '@components/room-card.component';
import { roomResultsUrl, type Property } from '@data/properties';
import type { RoomSelection, StaySearch } from '@models/booking';
import { step } from '@support/step.decorator';
import { exactText } from '@utils/text';
import { BasePage } from './base.page';

/** Time allowed for the post-add redirect to start (under 3 s on the live site). */
const HAND_OFF_TIMEOUT_MS = 10_000;

/** "Choose Your Room and Package": /<property>/accommodations/?generalReservationForm.… */
export class RoomSelectionPage extends BasePage {
  readonly bookingWidget: BookingWidget;
  readonly results: Locator;
  readonly roomCards: Locator;

  constructor(page: Page) {
    super(page);
    this.bookingWidget = new BookingWidget(page);
    // BEM-style component classes: far more stable than the utility classes around them.
    this.results = page.locator('section.RoomListing-room-results');
    this.roomCards = this.results.locator('.FilteredColumnsList-item');
  }

  /** The card for a room type, pinned by its name so later re-renders or re-sorting cannot swap it. */
  roomCardNamed(roomName: string): RoomCard {
    return new RoomCard(
      this.roomCards.filter({ has: this.page.getByRole('link', { name: exactText(roomName) }) }),
    );
  }

  /** The search landed on this property's results, for the dates requested, with rooms to choose from. */
  @step()
  async expectResultsFor(property: Property, search: StaySearch): Promise<void> {
    await this.waitForUrl(roomResultsUrl(property));
    await this.bookingWidget.expectDates(search);
    await expect(this.roomCards.first(), 'room results should render').toBeVisible({ timeout: 60_000 });
  }

  /** Adds the first rate of the first room that can be booked, and returns what was selected. */
  @step()
  async addFirstBookableRoomToCart(property: Property): Promise<RoomSelection> {
    const firstBookable = new RoomCard(this.roomCards.filter({ has: this.page.locator(RATE_CTA) }).first());
    await expect(firstBookable.root, 'at least one room should be bookable').toBeVisible();
    const selection = await this.roomCardNamed(await firstBookable.roomName()).addRateToCart(0);
    await this.waitForHandOff(property);
    return selection;
  }

  /**
   * After "Add to Cart" the site redirects to its "Things To Do" page, but the header shows the new count
   * first, and a cart opened in between is thrown away. Wait for the redirect; carry on if none comes.
   */
  private async waitForHandOff(property: Property): Promise<void> {
    const resultsUrl = roomResultsUrl(property);
    try {
      await this.waitForUrl((url) => !resultsUrl.test(url.pathname), HAND_OFF_TIMEOUT_MS);
    } catch (error) {
      if (!(error instanceof errors.TimeoutError)) throw error;
    }
  }
}
