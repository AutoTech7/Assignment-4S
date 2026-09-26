import { test as base } from '@playwright/test';
import { SiteHeader } from '@components/site-header.component';
import { env } from '@config/env';
import { stayRequestFromEnv } from '@data/stay-requests';
import type { StayRequest } from '@models/booking';
import { FindHotelPage } from '@pages/find-hotel.page';
import { PropertyPage } from '@pages/property.page';
import { RoomSelectionPage } from '@pages/room-selection.page';
import { dismissOverlaysWhenShown, preAcknowledgeCookieBanner } from '@support/overlays';
import { outcomeCaption, recordingPath, StepBanner, writeRunDetails } from '@support/recording';

/** `test.step` that also captions the video in recording mode. */
export type StepFn = <T>(title: string, body: () => Promise<T>) => Promise<T>;

interface BookingFixtures {
  step: StepFn;
  stayRequest: StayRequest;
  siteHeader: SiteHeader;
  findHotelPage: FindHotelPage;
  propertyPage: PropertyPage;
  roomSelectionPage: RoomSelectionPage;
  /** Recording mode (tests using `step`): captions, outcome, video and run details in recordings/. */
  recorder: StepBanner | undefined;
}

/** Specs import `test` and `expect` from here: page objects as fixtures, overlays handled everywhere. */
export const test = base.extend<BookingFixtures>({
  context: async ({ context }, use) => {
    await preAcknowledgeCookieBanner(context, env.baseUrl);
    await use(context);
  },

  page: async ({ page }, use) => {
    await dismissOverlaysWhenShown(page);
    await use(page);
  },

  recorder: async ({ page }, use, testInfo) => {
    if (!env.recordMode) {
      await use(undefined);
      return;
    }
    const startedAt = new Date();
    const recorder = new StepBanner(page);
    await use(recorder);
    if (page.isClosed()) return;
    await recorder.show(outcomeCaption(testInfo));
    // Deliberate: keep the final, verified state on screen for a moment before the video ends.
    await page.waitForTimeout(2_500); // eslint-disable-line playwright/no-wait-for-timeout
    await writeRunDetails(testInfo, page, { startedAt, siteUrl: env.baseUrl, channel: env.browserChannel });
    await page.close();
    await page.video()?.saveAs(recordingPath(testInfo, 'webm'));
  },

  step: async ({ recorder }, use) => {
    await use((title, body) =>
      base.step(title, async () => {
        await recorder?.show(title);
        return body();
      }),
    );
  },
  stayRequest: async ({}, use) => {
    await use(stayRequestFromEnv());
  },

  siteHeader: async ({ page }, use) => {
    await use(new SiteHeader(page));
  },
  findHotelPage: async ({ page }, use) => {
    await use(new FindHotelPage(page));
  },
  propertyPage: async ({ page }, use) => {
    await use(new PropertyPage(page));
  },
  roomSelectionPage: async ({ page }, use) => {
    await use(new RoomSelectionPage(page));
  },
});

export { expect } from './matchers';
