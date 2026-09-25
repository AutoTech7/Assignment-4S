import { expect, type Locator, type Page } from '@playwright/test';
import { propertyHomeUrl, type Property } from '@data/properties';
import { step } from '@support/step.decorator';
import { exactText, startsWithText } from '@utils/text';
import { BasePage } from './base.page';

/** /find_a_hotel_or_resort/: every property, grouped by region. */
export class FindHotelPage extends BasePage {
  static readonly path = '/find_a_hotel_or_resort/';

  readonly heading: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: /all hotels (&|and) resorts/i });
  }

  /** Region panel. Only the active category tab is visible, and role locators skip hidden elements. */
  regionPanel(region: string): Locator {
    return this.page.getByRole('region', { name: startsWithText(region) });
  }

  /** Accordion header button: "North America 55 properties hide". */
  regionToggle(region: string): Locator {
    return this.page.getByRole('button', { name: startsWithText(region) });
  }

  propertyLink(property: Property): Locator {
    return this.regionPanel(property.region).getByRole('link', { name: exactText(property.listingName) });
  }

  @step()
  async open(): Promise<void> {
    await this.visit(FindHotelPage.path);
    await expect(this.heading).toBeVisible();
  }

  @step()
  async selectProperty(property: Property): Promise<void> {
    await this.expandRegion(property.region);
    await this.propertyLink(property).click();
    await this.waitForUrl(propertyHomeUrl(property));
  }

  private async expandRegion(region: string): Promise<void> {
    const toggle = this.regionToggle(region);
    if ((await toggle.getAttribute('aria-expanded')) === 'false') {
      await toggle.click();
    }
    await expect(this.regionPanel(region)).toBeVisible();
  }
}
