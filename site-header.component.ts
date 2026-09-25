import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '@support/step.decorator';
import { CartPanel } from './cart-panel.component';

/** Header of every property-site page (/<property>/…). The brand-level pages have no cart icon. */
export class SiteHeader {
  /** Shopping-bag icon; its visible text is "Cart" or "Cart(<n>)". */
  readonly cartButton: Locator;

  constructor(private readonly page: Page) {
    this.cartButton = page.getByRole('button', { name: /^view cart$/i });
  }

  async expectCartCount(count: number): Promise<void> {
    await expect(this.cartButton).toContainText(new RegExp(`cart\\s*\\(\\s*${count}\\s*\\)`, 'i'));
  }

  @step()
  async openCart(): Promise<CartPanel> {
    const cart = new CartPanel(this.page);
    await this.cartButton.click();
    await cart.expectOpen();
    return cart;
  }
}
