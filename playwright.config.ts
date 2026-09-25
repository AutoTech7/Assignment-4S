import { defineConfig, type ReporterDescription } from '@playwright/test';
import { env } from './src/config/env';
import { hostResolverRules } from './src/support/network-hygiene';

const VIEWPORT = { width: 1440, height: 900 };

const reporters: ReporterDescription[] = [
  ['list'],
  ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ['junit', { outputFile: 'test-results/junit.xml' }],
  // Inline failure annotations on the PR / workflow summary.
  ...(env.isCI ? [['github'] as ReporterDescription] : []),
];

const chromiumArgs = [
  // Keeps navigator.webdriver unset; see README › Bot protection.
  '--disable-blink-features=AutomationControlled',
  // Ad/social pixels and the survey pop-over fail DNS instead of loading (see network-hygiene.ts).
  ...(env.blockThirdParty ? [`--host-resolver-rules=${hostResolverRules()}`] : []),
];

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  timeout: 3 * 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: env.isCI,
  workers: env.isCI ? 2 : undefined,
  reporter: reporters,

  projects: [
    {
      // Pure logic (price maths, date handling, parsers): runs in milliseconds, no browser.
      name: 'unit',
      testDir: './tests/unit',
      retries: 0,
    },
    {
      name: 'e2e',
      testDir: './tests/e2e',
      // A third-party production site over the public internet: one retry on CI absorbs network blips.
      retries: env.isCI ? 1 : 0,
      use: {
        browserName: 'chromium',
        channel: env.browserChannel,
        headless: env.headless,
        baseURL: env.baseUrl,
        viewport: VIEWPORT,
        locale: 'en-US',
        actionTimeout: 20_000,
        navigationTimeout: 60_000,
        launchOptions: { slowMo: env.slowMoMs, args: chromiumArgs },
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        video: { mode: env.recordMode ? 'on' : 'retain-on-failure', size: VIEWPORT },
      },
    },
  ],
});
