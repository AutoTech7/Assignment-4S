#!/usr/bin/env node
/**
 * Runs the e2e spec against the offline replica (tools/offline-site) instead of www.fourseasons.com.
 *
 *   npm run test:offline       # the unchanged spec, hermetically (extra args are passed to `playwright test`)
 *   npm run test:mutations     # self-test of the spec: it must pass, survive variations, and catch defects
 *
 * Mutation mode runs, a few at a time and without retries:
 *   control      the replica as observed live            → must pass (otherwise nothing below means anything)
 *   variations   harmless behaviour changes              → must still pass
 *   blocked      the bot manager's "Access Denied" page  → must fail with BotProtectionError
 *   defects      one wrong detail in the cart each       → must fail on the assertion meant to catch it
 */
import { spawn } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
import { DEFECTS, startOfflineSite } from '../tools/offline-site/server.mjs';

const args = process.argv.slice(2);
const mutationMode = args.includes('--mutations');
const playwrightArgs = args.filter((arg) => arg !== '--mutations');
const PARALLEL_RUNS = 3;

// Pin the stay so the replica's sold-out day (today + 30) is always exercised, whatever .env says.
const PINNED_ENV = {
  HEADLESS: process.env.HEADLESS ?? 'true',
  RECORD_MODE: 'false',
  CHECK_IN_OFFSET_DAYS: '30',
  NIGHTS: '1',
  AVAILABILITY_SEARCH_DAYS: '14',
  SLOW_MO: '0',
};

function runSpec(baseUrl, extraArgs, quiet) {
  return new Promise((resolve) => {
    const child = spawn('npx', ['playwright', 'test', '--project=e2e', ...extraArgs], {
      shell: process.platform === 'win32',
      stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      env: { ...process.env, ...PINNED_ENV, BASE_URL: baseUrl },
    });
    let output = '';
    child.stdout?.on('data', (chunk) => (output += chunk));
    child.stderr?.on('data', (chunk) => (output += chunk));
    child.on('close', (code) => resolve({ passed: code === 0, output: stripVTControlCharacters(output) }));
  });
}

async function runAgainst(siteOptions, extraArgs, quiet) {
  const site = await startOfflineSite(siteOptions);
  try {
    return await runSpec(site.url, extraArgs, quiet);
  } finally {
    await site.close();
  }
}

if (!mutationMode) {
  const { passed } = await runAgainst({}, playwrightArgs, false);
  process.exit(passed ? 0 : 1);
}

/** The first line of Playwright's failure message, e.g. "Error: nightly rate in cart vs. rate card". */
function firstError(output) {
  const failure = output.split(/^\s*1\) /m)[1] ?? '';
  return /^\s*(\w*Error: .+)$/m.exec(failure)?.[1] ?? 'see output';
}

const scenarios = [
  { name: 'control', description: 'the replica as observed live', site: {}, expect: 'pass' },
  {
    name: 'no-redirect',
    description: 'no hand-off page after adding a room',
    site: { redirectAfterAdd: false },
    expect: 'pass',
  },
  {
    name: 'blocked',
    description: 'bot manager blocks the browser',
    site: { deny: true },
    expect: 'BotProtectionError',
  },
  ...Object.entries(DEFECTS).map(([defect, { description, caughtBy }]) => ({
    name: defect,
    description: `cart defect: ${description}`,
    site: { defect },
    expect: caughtBy,
  })),
];

async function run(scenario) {
  const extraArgs = ['--reporter=line', '--retries=0', `--output=test-results/offline-${scenario.name}`];
  const { passed, output } = await runAgainst(scenario.site, [...extraArgs, ...playwrightArgs], true);
  const ok = scenario.expect === 'pass' ? passed : !passed && firstError(output).includes(scenario.expect);
  return { ...scenario, ok, outcome: passed ? 'passed' : firstError(output), output };
}

console.log('Running the control first…');
const [control, ...others] = scenarios;
const results = [await run(control)];
if (!results[0].ok) {
  console.error(results[0].output);
  console.error('The control run failed: fix the spec or the replica before reading the other results.');
  process.exit(1);
}

const queue = [...others];
await Promise.all(
  Array.from({ length: PARALLEL_RUNS }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) results.push(await run(next));
  }),
);

const order = new Map(scenarios.map((scenario, index) => [scenario.name, index]));
results.sort((a, b) => order.get(a.name) - order.get(b.name));
const width = Math.max(...results.map((result) => result.description.length)) + 2;
console.log(`\n  ${'Scenario'.padEnd(width)}Expected → actual`);
for (const result of results) {
  const expected = result.expect === 'pass' ? 'pass' : `fail on "${result.expect}"`;
  console.log(`${result.ok ? '✔' : '✘'} ${result.description.padEnd(width)}${expected} → ${result.outcome}`);
}
const failures = results.filter((result) => !result.ok);
const defects = results.filter((result) => result.name in DEFECTS);
console.log(
  `\n${defects.filter((result) => result.ok).length}/${defects.length} defects caught by the intended assertion; ` +
    (failures.length === 0
      ? 'every scenario behaved as expected.'
      : `${failures.length} scenario(s) did not.`),
);
process.exit(failures.length === 0 ? 0 : 1);
