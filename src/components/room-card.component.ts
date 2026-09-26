import { expect, type Locator } from '@playwright/test';
import type { RoomSelection } from '@models/booking';
import { step } from '@support/step.decorator';
import { parseMoney, removeMoney } from '@utils/money';
import { normalizeWhitespace } from '@utils/text';

/** The booking engine's own test and analytics hooks: the most stable handles on this page. */
const HOOK = {
  addToCart: '[data-tracking-id="add-to-cart"]',
  selectBedOptions: '[data-tracking-id="select-bed-options"]',
  feesDisclaimer: '[data-cy="rate-card-fees-disclaimer"]',
} as const;

/** Either call-to-action a bookable rate shows. */
export const RATE_CTA = `${HOOK.addToCart}, ${HOOK.selectBedOptions}`;

/** A rate row has no hook: it is the closest ancestor of its call-to-action that holds "Rate Details". */
const RATE_ROW_FROM_CTA = 'xpath=ancestor::div[.//button[normalize-space()="Rate Details"]][1]';

const text = async (locator: Locator): Promise<string> =>
  normalizeWhitespace((await locator.textContent()) ?? '');

/** One room type in the results list (image, name, description, 1..n rates). */
export class RoomCard {
  readonly name: Locator;
  readonly rates: Locator;

  constructor(readonly root: Locator) {
    // The room title is the only link that opens the room's detail page in a new tab.
    this.name = root.locator('a[target="_blank"]').first();
    this.rates = root.locator(RATE_CTA).locator(RATE_ROW_FROM_CTA);
  }

  rate(index: number): RateRow {
    return new RateRow(this.rates.nth(index));
  }

  async roomName(): Promise<string> {
    return text(this.name);
  }

  /** Adds the rate at `rateIndex` to the cart and returns what was selected, as displayed before adding. */
  @step()
  async addRateToCart(rateIndex = 0): Promise<RoomSelection> {
    const roomName = await this.roomName();
    expect(roomName, 'room name should be displayed').not.toBe('');
    return { roomName, ...(await this.rate(rateIndex).addToCart()) };
  }
}

/** One bookable rate of a room: name, nightly price and its call-to-action. */
export class RateRow {
  readonly name: Locator;
  readonly price: Locator;
  readonly addToCartButton: Locator;
  readonly selectBedOptionsButton: Locator;
  readonly selectedBedOption: Locator;

  constructor(readonly root: Locator) {
    this.name = root
      .getByRole('button', { name: 'Rate Details', exact: true })
      .locator('xpath=preceding-sibling::*[1]');
    // "Avg. price per night / [From] CAD 1,449" sits immediately before the fees disclaimer.
    this.price = root.locator(HOOK.feesDisclaimer).locator('xpath=preceding-sibling::*[1]');
    this.addToCartButton = root.locator(HOOK.addToCart);
    this.selectBedOptionsButton = root.locator(HOOK.selectBedOptions);
    // Bed options render as radios whose visible text ("One king bed", "CAD 1,449") sits beside the <label>.
    this.selectedBedOption = root
      .getByRole('radio', { checked: true })
      .locator('xpath=ancestor::label[1]/following-sibling::*[1]');
  }

  /**
   * Rooms with several bed configurations need one chosen first ("Select Bed Options" → radio group →
   * "Add to Cart"); the pre-selected option is kept. Other rates go straight to "Add to Cart".
   */
  @step()
  async addToCart(): Promise<Omit<RoomSelection, 'roomName'>> {
    // textContent keeps the source casing the cart repeats; styling (e.g. uppercase) cannot break the match.
    const rateName = await text(this.name);
    let bedType: string | undefined;

    if (await this.selectBedOptionsButton.isVisible()) {
      await this.selectBedOptionsButton.click();
      await expect(this.addToCartButton).toBeVisible();
      // The option is CSS-capitalised on screen; "One king bedCAD 1,449" → "One king bed".
      bedType = removeMoney(await text(this.selectedBedOption));
      expect(bedType, 'selected bed option should have a name').not.toBe('');
      // The row then shows that option's price instead of "From <lowest>".
      await expect(this.price).not.toContainText(/\bfrom\b/i);
    }

    const nightlyPrice = parseMoney(await this.price.innerText());
    await this.addToCartButton.click();
    return { rateName, bedType, nightlyPrice };
  }
}
