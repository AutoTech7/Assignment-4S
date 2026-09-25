import { expect, type Locator, type Page } from '@playwright/test';
import type { Property } from '@data/properties';
import { parseMoney, type Money } from '@utils/money';
import { parseStayRange, type StayDates } from '@utils/stay-range';
import { exactText } from '@utils/text';

// The one test hook the cart exposes; every line item has exactly one.
const ITEM_FEES_DISCLAIMER = '[data-cy="shopping-cart-item__taxes-and-fees"]';

/** Slide-over "User Panel" opened by the header cart icon (tabs: Itinerary | Cart (n)). */
export class CartPanel {
  readonly root: Locator;
  readonly cartTab: Locator;
  readonly items: Locator;
  readonly estimatedTotal: Locator;

  constructor(page: Page) {
    this.root = page.getByRole('dialog', { name: 'User Panel' });
    this.cartTab = this.root.getByRole('tab', { name: /^cart\b/i });
    // A line item is the closest ancestor of its fees disclaimer that also holds its "Remove" button.
    this.items = this.root
      .locator(ITEM_FEES_DISCLAIMER)
      .locator('xpath=ancestor::div[.//button[normalize-space()="Remove"]][1]');
    this.estimatedTotal = this.root
      .getByText('Est. Total', { exact: true })
      .locator('xpath=following-sibling::*[1]');
  }

  async expectOpen(): Promise<void> {
    await expect(this.root).toBeVisible();
    await expect(this.cartTab).toHaveAttribute('aria-selected', 'true');
  }

  item(index: number): CartItem {
    return new CartItem(this.items.nth(index));
  }

  /** Items are grouped per property: a heading with the property name, followed by the stay dates. */
  propertyHeading(property: Property): Locator {
    return this.root.getByRole('heading', { name: exactText(property.displayName) });
  }

  async stayDatesFor(property: Property): Promise<StayDates> {
    const dates = this.propertyHeading(property).locator('xpath=following-sibling::*[1]');
    // textContent, not innerText: the element is CSS-uppercased and the parser wants the source text.
    return parseStayRange((await dates.textContent()) ?? '');
  }

  async estimatedTotalAmount(): Promise<Money> {
    return parseMoney(await this.estimatedTotal.innerText());
  }
}

/** One line item: "<room> - <bed>", rate plan, guests, nightly price and fees disclaimer. */
export class CartItem {
  readonly price: Locator;

  constructor(readonly root: Locator) {
    this.price = root.locator(ITEM_FEES_DISCLAIMER).locator('xpath=preceding-sibling::*[1]');
  }

  /** The exact nightly rate, e.g. CAD 1,448.81 "before addition of Service Charge plus taxes". */
  async nightlyPrice(): Promise<Money> {
    return parseMoney(await this.price.innerText());
  }
}
