import type { BrowserContext, Page } from '@playwright/test';

/**
 * OneTrust hides its banner once the `OptanonAlertBoxClosed` cookie is set. Setting it up front keeps the
 * banner from appearing mid-flow, e.g. over the date picker; the locator handler below is the fallback.
 */
export async function preAcknowledgeCookieBanner(context: BrowserContext, siteUrl: string): Promise<void> {
  await context.addCookies([
    { name: 'OptanonAlertBoxClosed', value: new Date().toISOString(), url: siteUrl },
  ]);
}

/**
 * Overlays that can appear at any time and block clicks. `addLocatorHandler` clears them before any action
 * they would obstruct, so page objects need no "if visible, dismiss" checks. Handlers run in registration
 * order and do not trigger each other, so the survey, which can cover the banner's button, goes first.
 */
export async function dismissOverlaysWhenShown(page: Page): Promise<void> {
  // Qualtrics survey, seen right after adding a room; normally blocked by network-hygiene.ts. Its close
  // control is an unlabelled <img>, so the node is removed. Handler locators are strict, hence `.first()`.
  const surveyPopOver = page.locator('.QSIPopOver').filter({ visible: true }).first();
  await page.addLocatorHandler(surveyPopOver, async () => {
    await surveyPopOver.evaluate((popover) => popover.remove());
  });

  // OneTrust uses these ids on every site it powers.
  const cookieBanner = page.locator('#onetrust-banner-sdk');
  await page.addLocatorHandler(cookieBanner, async () => {
    await cookieBanner.locator('#onetrust-accept-btn-handler').click();
  });
}
