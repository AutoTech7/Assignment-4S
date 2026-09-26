import { normalizeWhitespace } from './text';

/**
 * A price as displayed: integer minor units plus the displayed precision, so comparisons avoid floating
 * point and keep track of how the UI rounded (CAD 1,449 vs CAD 1,448.81).
 */
export interface Money {
  /** ISO-4217 code (e.g. `CAD`), or the bare symbol when the UI shows no code. */
  readonly currency: string;
  /** Integer amount at `precision` decimals: 144881 for 1,448.81, 1449 for 1,449. */
  readonly minorUnits: number;
  /** Number of decimals the UI displayed. */
  readonly precision: number;
}

const ISO_CURRENCIES = new Set(Intl.supportedValuesOf('currency'));

// A 3-letter code (not glued to other capitals) or a symbol, then "1,448.81" or "1449". The number must end
// there, so "1,21,000" and "1,4490" are rejected rather than cut short.
const MONEY =
  /(?<![A-Z])(?:(?<code>[A-Z]{3})|(?<symbol>[$€£¥]))\s*(?<amount>\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?![.,]?\d)/g;

/** The first price in `text` whose code is a real ISO-4217 currency (or that uses a symbol). */
function firstPrice(text: string): { money: Money; start: number; end: number } | undefined {
  for (const match of text.matchAll(MONEY)) {
    const amount = match.groups?.['amount'];
    const code = match.groups?.['code'];
    const currency = code ?? match.groups?.['symbol'];
    if (!amount || !currency || (code !== undefined && !ISO_CURRENCIES.has(code))) continue;
    const [whole = '0', fraction = ''] = amount.replace(/,/g, '').split('.');
    const money = { currency, minorUnits: Number(whole + fraction), precision: fraction.length };
    const start = match.index ?? 0;
    return { money, start, end: start + match[0].length };
  }
  return undefined;
}

/** First price in `text`, or `undefined`. */
export function findMoney(text: string): Money | undefined {
  return firstPrice(text)?.money;
}

/** First price in `text`; throws with the offending text (quoted verbatim) when there is none. */
export function parseMoney(text: string): Money {
  const money = findMoney(text);
  if (!money) throw new Error(`No price found in ${JSON.stringify(text)}`);
  return money;
}

/** `text` without its first price: "One king bedCAD 1,449" → "One king bed". */
export function removeMoney(text: string): string {
  const price = firstPrice(text);
  return normalizeWhitespace(price ? text.slice(0, price.start) + text.slice(price.end) : text);
}

/** Re-expresses `money` in minor units at a (greater or equal) `precision`. */
export function minorUnitsAt(money: Money, precision: number): number {
  if (precision < money.precision) {
    throw new RangeError(`Cannot lower precision from ${money.precision} to ${precision} without rounding`);
  }
  return money.minorUnits * 10 ** (precision - money.precision);
}

/** Exact `money × count`, e.g. a nightly rate times the number of nights. */
export function multiply(money: Money, count: number): Money {
  if (!Number.isInteger(count)) throw new RangeError(`count must be an integer, received ${count}`);
  return { ...money, minorUnits: money.minorUnits * count };
}

/** `money × factor`, rounded to the nearest minor unit. For bounds and sanity checks, not for accounting. */
export function scale(money: Money, factor: number): Money {
  return { ...money, minorUnits: Math.round(money.minorUnits * factor) };
}

/**
 * The display unit of the coarser of two prices, in minor units at the finer precision: comparing
 * CAD 1,449 with CAD 1,448.81 gives 100 (CAD 1.00).
 */
export function displayUnit(a: Money, b: Money): { precision: number; minorUnits: number } {
  const precision = Math.max(a.precision, b.precision);
  return { precision, minorUnits: 10 ** (precision - Math.min(a.precision, b.precision)) };
}

/**
 * Same currency, and less than one display unit of the coarser price apart. Correct whether the rate card
 * rounds, floors or ceils, while a difference of a whole unit still fails.
 */
export function matchesWithinRounding(actual: Money, expected: Money): boolean {
  if (actual.currency !== expected.currency) return false;
  const { precision, minorUnits: unit } = displayUnit(actual, expected);
  // Same precision on both sides → unit is 1 minor unit → this is plain equality.
  return Math.abs(minorUnitsAt(actual, precision) - minorUnitsAt(expected, precision)) < unit;
}

/** Same currency and `amount` ≥ `minimum`. */
export function isAtLeast(amount: Money, minimum: Money): boolean {
  return compare(amount, minimum) >= 0;
}

/** Same currency and `amount` ≤ `maximum`. */
export function isAtMost(amount: Money, maximum: Money): boolean {
  return compare(amount, maximum) <= 0;
}

/** `CAD 1,448.81` (floating point is fine here: it only formats for humans). */
export function formatMoney(money: Money): string {
  const value = money.minorUnits / 10 ** money.precision;
  const digits = { minimumFractionDigits: money.precision, maximumFractionDigits: money.precision };
  return `${money.currency} ${value.toLocaleString('en-US', digits)}`;
}

/** Sign of `a − b`; NaN when the currencies differ, so every comparison with it is false. */
function compare(a: Money, b: Money): number {
  if (a.currency !== b.currency) return Number.NaN;
  const precision = Math.max(a.precision, b.precision);
  return Math.sign(minorUnitsAt(a, precision) - minorUnitsAt(b, precision));
}
