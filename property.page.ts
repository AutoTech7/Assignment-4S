import { expect, type Page } from '@playwright/test';
import { BookingWidget } from '@components/booking-widget.component';
import { propertyHomeUrl, type Property } from '@data/properties';
import { step } from '@support/step.decorator';
import { escapeRegExp } from '@utils/text';
import { BasePage } from './base.page';

/** A property's home page, e.g. https://www.fourseasons.com/cabodelsol/ */
export class PropertyPage extends BasePage {
  readonly bookingWidget: BookingWidget;

  constructor(page: Page) {
    super(page);
    this.bookingWidget = new BookingWidget(page);
  }

  @step()
  async expectLoaded(property: Property): Promise<void> {
    await expect(this.page).toHaveURL(propertyHomeUrl(property));
    await expect(this.page).toHaveTitle(new RegExp(escapeRegExp(property.displayName), 'i'));
    await expect(this.bookingWidget.root).toBeVisible();
  }
}
