import type { Page } from '@playwright/test';
import { assertNotBlocked } from '@support/bot-protection';

/** Behaviour shared by every page object: bot-protection-aware navigation. */
export abstract class BasePage {
  protected constructor(protected readonly page: Page) {}

  /** Navigates to a path relative to `baseURL`. */
  protected async visit(path: string): Promise<void> {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
    await assertNotBlocked(this.page);
  }

  /** Waits for a navigation that an action (link, form submit, redirect) has started. */
  protected async waitForUrl(url: RegExp | ((url: URL) => boolean), timeout?: number): Promise<void> {
    await this.page.waitForURL(url, { waitUntil: 'domcontentloaded', timeout });
    await assertNotBlocked(this.page);
  }
}
