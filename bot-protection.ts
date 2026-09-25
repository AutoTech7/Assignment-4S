import type { Page } from '@playwright/test';

export class BotProtectionError extends Error {
  override name = 'BotProtectionError';
}

/**
 * Akamai Bot Manager answers rejected traffic with a bare "Access Denied" page. Checked after every
 * navigation, so a block fails at once instead of as a locator timeout several steps later.
 */
export async function assertNotBlocked(page: Page): Promise<void> {
  const title = await page.title().catch(() => '');
  const denialNotice = page.getByText(/you don.t have permission to access/i);
  if (/^\s*access denied\s*$/i.test(title) || (await denialNotice.count()) > 0) {
    throw new BotProtectionError(
      `The site's bot protection blocked this browser at ${page.url()}. ` +
        'Run headed (HEADLESS=false); see README › Bot protection.',
    );
  }
}
