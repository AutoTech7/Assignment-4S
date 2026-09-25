import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { platform, release } from 'node:os';
import type { Page, TestInfo } from '@playwright/test';

const BANNER_ID = '__e2e-step-banner';

/**
 * Recording mode: captions the current step and the site's host (the video has no address bar), redrawn
 * after each navigation. Cosmetic only: aria-hidden, pointer-events off, drawing errors swallowed.
 */
export class StepBanner {
  private caption: string | undefined;

  constructor(private readonly page: Page) {
    page.on('domcontentloaded', () => void this.draw());
  }

  async show(caption: string): Promise<void> {
    this.caption = caption;
    await this.draw();
  }

  private async draw(): Promise<void> {
    if (this.caption === undefined || this.page.isClosed()) return;
    await this.page.evaluate(renderBanner, { id: BANNER_ID, caption: this.caption }).catch(() => undefined);
  }
}

// Runs in the browser, so it must not reference Node-side values.
function renderBanner({ id, caption }: { id: string; caption: string }): void {
  let banner = document.getElementById(id);
  if (!banner) {
    banner = document.createElement('div');
    banner.id = id;
    banner.setAttribute('aria-hidden', 'true');
    banner.style.cssText = [
      'position:fixed',
      'left:16px',
      'bottom:16px',
      'z-index:2147483647',
      'max-width:60vw',
      'padding:10px 14px',
      'border-radius:6px',
      'background:rgba(17,17,17,.88)',
      'color:#fff',
      'font:600 15px/1.35 system-ui,-apple-system,Segoe UI,sans-serif',
      'white-space:pre-line',
      'pointer-events:none',
      'box-shadow:0 4px 16px rgba(0,0,0,.35)',
    ].join(';');
    document.documentElement.appendChild(banner);
  }
  banner.textContent = `${caption}\n${location.host}`;
}

/** Final caption, so the video shows the outcome. */
export function outcomeCaption(testInfo: TestInfo): string {
  if (testInfo.status === testInfo.expectedStatus) return '✓ PASSED: room and price verified in the cart';
  const firstLine = (testInfo.error?.message ?? 'see the report').split('\n')[0];
  return `✗ FAILED: ${firstLine}`;
}

/** recordings/<test-title-slug>[.failed].<extension>: stable names, and a failure never overwrites a pass. */
export function recordingPath(testInfo: TestInfo, extension: 'webm' | 'json'): string {
  const slug = testInfo.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
  const failed = testInfo.status === testInfo.expectedStatus ? '' : '.failed';
  const root = testInfo.config.configFile ? dirname(testInfo.config.configFile) : process.cwd();
  return join(root, 'recordings', `${slug}${failed}.${extension}`);
}

/** When, where and how the run happened, and what it selected; saved next to the video. */
export async function writeRunDetails(
  testInfo: TestInfo,
  page: Page,
  run: { startedAt: Date; siteUrl: string; channel: string | undefined },
): Promise<void> {
  const browser = page.context().browser();
  const details = {
    test: testInfo.titlePath.slice(1).join(' › '),
    status: testInfo.status,
    startedAt: run.startedAt.toISOString(),
    durationSeconds: Math.round((Date.now() - run.startedAt.getTime()) / 1000),
    site: run.siteUrl,
    browser: `${run.channel ?? 'bundled chromium'} ${browser?.version() ?? ''}`.trim(),
    os: `${platform()} ${release()}`,
    // The stay searched and the room selected, as annotated by the spec.
    selection: Object.fromEntries(testInfo.annotations.map(({ type, description }) => [type, description])),
    // record.mjs copies the trace from here into recordings/.
    testOutputDir: testInfo.outputDir,
  };
  await writeFile(recordingPath(testInfo, 'json'), `${JSON.stringify(details, null, 2)}\n`);
}
