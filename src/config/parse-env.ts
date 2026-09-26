/** Parses and validates configuration. Pure, for unit tests; `env.ts` applies it to `process.env`. */
export class ConfigError extends Error {
  override name = 'ConfigError';
}

type Source = Readonly<Record<string, string | undefined>>;

const TRUE = /^(1|true|yes|on)$/i;
const FALSE = /^(0|false|no|off)$/i;

function readString(source: Source, name: string): string | undefined {
  const value = source[name]?.trim();
  return value === undefined || value === '' ? undefined : value;
}

function readBoolean(source: Source, name: string, fallback: boolean): boolean {
  const raw = readString(source, name);
  if (raw === undefined) return fallback;
  if (TRUE.test(raw)) return true;
  if (FALSE.test(raw)) return false;
  throw new ConfigError(`${name} must be true or false, received "${raw}"`);
}

function readInteger(
  source: Source,
  name: string,
  fallback: number,
  range: { min: number; max: number },
): number {
  const raw = readString(source, name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < range.min || value > range.max) {
    throw new ConfigError(`${name} must be an integer from ${range.min} to ${range.max}, received "${raw}"`);
  }
  return value;
}

function readUrl(source: Source, name: string, fallback: string): string {
  const raw = readString(source, name) ?? fallback;
  try {
    return new URL(raw).toString().replace(/\/$/, '');
  } catch {
    throw new ConfigError(`${name} must be an absolute URL, received "${raw}"`);
  }
}

/** Parses a configuration source, normally `process.env`. */
export function parseEnv(source: Source) {
  // CI systems set CI to all sorts of values ("true", "1", "github"…): anything but an explicit "no" counts.
  const ciValue = readString(source, 'CI');
  const isCI = ciValue !== undefined && !FALSE.test(ciValue);
  const recordMode = readBoolean(source, 'RECORD_MODE', false);

  return Object.freeze({
    isCI,
    /** Set by `npm run record`: slowed down, captioned, video and trace always on. */
    recordMode,
    baseUrl: readUrl(source, 'BASE_URL', 'https://www.fourseasons.com'),
    /** Headed by default outside CI: the bot manager tolerates a visible browser far better. */
    headless: readBoolean(source, 'HEADLESS', isCI && !recordMode),
    /** e.g. `chrome` or `msedge` instead of bundled Chromium. */
    browserChannel: readString(source, 'BROWSER_CHANNEL'),
    slowMoMs: readInteger(source, 'SLOW_MO', recordMode ? 400 : 0, { min: 0, max: 5_000 }),
    checkInOffsetDays: readInteger(source, 'CHECK_IN_OFFSET_DAYS', 30, { min: 1, max: 330 }),
    nights: readInteger(source, 'NIGHTS', 1, { min: 1, max: 14 }),
    availabilitySearchDays: readInteger(source, 'AVAILABILITY_SEARCH_DAYS', 14, { min: 0, max: 60 }),
    blockThirdParty: readBoolean(source, 'BLOCK_THIRD_PARTY', false),
  });
}

export type Env = ReturnType<typeof parseEnv>;
