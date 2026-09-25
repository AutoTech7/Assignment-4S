#!/usr/bin/env node
/**
 * Runs the e2e project in recording mode (headed, slowed down, steps captioned) and writes to recordings/:
 *   <test-title>.webm         video, plus .mp4 when ffmpeg is installed
 *   <test-title>.json         run details
 *   <test-title>.trace.zip    Playwright trace, when small enough to commit
 * A failed run is saved as <test-title>.failed.*. Uses Google Chrome when installed (see BROWSER_CHANNEL).
 *
 *   npm run record [-- <playwright test arguments>]
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const recordingsDir = join(root, 'recordings');
const isWindows = process.platform === 'win32';
// Widely playable H.264 MP4 (QuickTime, browsers, GitHub) with the index up front for streaming.
const H264_MP4 = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
// GitHub warns about files over 50 MB and rejects files over 100 MB.
const MAX_COMMITTABLE_BYTES = 50 * 1024 * 1024;
const fileSize = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const CHROME_PATHS = {
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
  win32: [
    join(process.env.PROGRAMFILES ?? 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe'),
    join(
      process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)',
      'Google/Chrome/Application/chrome.exe',
    ),
    join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe'),
  ],
  linux: ['/opt/google/chrome/chrome', '/usr/bin/google-chrome'],
};

const env = { ...process.env, RECORD_MODE: 'true' };
if (!env.BROWSER_CHANNEL && (CHROME_PATHS[process.platform] ?? []).some((path) => existsSync(path))) {
  env.BROWSER_CHANNEL = 'chrome';
  console.log('Recording in your installed Google Chrome (set BROWSER_CHANNEL to override).');
}

const startedAt = Date.now();
const run = spawnSync('npx', ['playwright', 'test', '--project=e2e', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: isWindows,
  env,
});

const newFiles = (extension) =>
  existsSync(recordingsDir)
    ? readdirSync(recordingsDir)
        .filter((name) => name.endsWith(extension))
        .map((name) => join(recordingsDir, name))
        .filter((path) => statSync(path).mtimeMs >= startedAt)
    : [];

const videos = newFiles('.webm');
if (videos.length === 0) {
  console.error('\nNo recording was produced; see the test output above.');
  process.exit(run.status ?? 1);
}

// Keep the trace next to the video, and point the run details at the copy.
for (const detailsFile of newFiles('.json')) {
  const details = JSON.parse(readFileSync(detailsFile, 'utf8'));
  const trace = join(details.testOutputDir ?? '', 'trace.zip');
  delete details.testOutputDir;
  if (existsSync(trace)) {
    const copy = detailsFile.replace(/\.json$/, '.trace.zip');
    const size = statSync(trace).size;
    if (size <= MAX_COMMITTABLE_BYTES) {
      copyFileSync(trace, copy);
      details.trace = relative(recordingsDir, copy);
    } else {
      rmSync(copy, { force: true }); // a trace from an earlier run would not match this video
      console.warn(
        `\nThe trace is ${fileSize(size)}, too big to commit (GitHub warns above 50 MB), so it stays at ` +
          `${relative(root, trace)}. Remove the trace link from README.md, or commit it with Git LFS.`,
      );
    }
  }
  writeFileSync(detailsFile, `${JSON.stringify(details, null, 2)}\n`);
}

const hasFfmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore', shell: isWindows }).status === 0;
console.log(`\nRecordings (${run.status === 0 ? 'tests passed' : 'TESTS FAILED'}):`);
for (const video of videos) {
  if (hasFfmpeg) {
    const mp4 = video.replace(/\.webm$/, '.mp4');
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, ...H264_MP4, mp4], {
      stdio: 'inherit',
      shell: isWindows,
    });
  }
}
for (const file of newFiles('')) console.log(`  ${relative(root, file)}  (${fileSize(statSync(file).size)})`);
if (!hasFfmpeg) console.log('  (install ffmpeg to also get an .mp4 copy)');
if (run.status === 0) console.log('\nCommit these files (git add recordings/): the README links to them.');
console.log('\nHTML report: npm run report');
process.exit(run.status ?? 1);
