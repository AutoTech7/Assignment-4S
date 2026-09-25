// Playwright's expect plus the price matchers; no browser involved.
import { expect } from '@fixtures/matchers';
import { test } from '@playwright/test';
import {
  displayUnit,
  findMoney,
  formatMoney,
  isAtLeast,
  isAtMost,
  matchesWithinRounding,
  multiply,
  parseMoney,
  removeMoney,
  scale,
} from '@utils/money';

test.describe('parseMoney', () => {
  const cases = [
    { text: 'CAD 1,448.81', currency: 'CAD', minorUnits: 144881, precision: 2 },
    { text: 'From CAD 1,449', currency: 'CAD', minorUnits: 1449, precision: 0 },
    { text: 'Avg. price per nightCAD 3,981', currency: 'CAD', minorUnits: 3981, precision: 0 },
    {
      text: 'Avg. price per night\nUSD 10,528\nbefore addition',
      currency: 'USD',
      minorUnits: 10528,
      precision: 0,
    },
    { text: 'CAD  1,449', currency: 'CAD', minorUnits: 1449, precision: 0 },
    { text: 'From $1,449.5', currency: '$', minorUnits: 14495, precision: 1 },
    { text: 'MAX 3 guests · EUR 176 /person', currency: 'EUR', minorUnits: 176, precision: 0 },
  ];
  for (const { text, ...expected } of cases) {
    test(`parses ${JSON.stringify(text)}`, () => {
      expect(parseMoney(text)).toEqual(expected);
    });
  }

  test('rejects capitalised words and numbers that are not prices', () => {
    expect(findMoney('ADVANCE PURCHASE – UP TO 20% OFF')).toBeUndefined();
    expect(findMoney('RATE DETAILS 2 adults')).toBeUndefined();
    expect(findMoney('MAX 3')).toBeUndefined(); // not an ISO-4217 code
  });

  test('never cuts a malformed amount short', () => {
    expect(findMoney('INR 1,21,000')).toBeUndefined(); // lakh grouping is not parsed as "1"
    expect(findMoney('CAD 1,4490')).toBeUndefined(); // not parsed as 1,449
  });

  test('reports the offending text verbatim when there is no price', () => {
    expect(() => parseMoney('To be  calculated at checkout')).toThrow('No price found in "To be  calculated');
  });

  test('removeMoney strips the first price only', () => {
    expect(removeMoney('One king bedCAD 1,449')).toBe('One king bed');
    expect(removeMoney('Two queen beds CAD 1,484 · CAD 9')).toBe('Two queen beds · CAD 9');
  });
});

test.describe('price comparison', () => {
  const cart = parseMoney('CAD 1,448.81');
  const card = parseMoney('CAD 1,449');

  test('the tolerance is one display unit of the coarser price', () => {
    expect(displayUnit(cart, card)).toEqual({ precision: 2, minorUnits: 100 });
    expect(displayUnit(cart, cart)).toEqual({ precision: 2, minorUnits: 1 });
  });

  test('a cent-precise price matches the whole-unit price it was rounded, floored or ceiled to', () => {
    expect(matchesWithinRounding(cart, card)).toBe(true); // rounded
    expect(matchesWithinRounding(parseMoney('CAD 1,448.30'), card)).toBe(true); // ceiled
    expect(matchesWithinRounding(parseMoney('CAD 1,449.99'), card)).toBe(true); // floored
    expect(matchesWithinRounding(card, cart)).toBe(true); // symmetric
  });

  test('a difference of a whole unit or more does not match', () => {
    expect(matchesWithinRounding(parseMoney('CAD 1,448.00'), card)).toBe(false);
    expect(matchesWithinRounding(parseMoney('CAD 1,453.81'), card)).toBe(false);
    expect(matchesWithinRounding(parseMoney('CAD 1,448.80'), cart)).toBe(false); // same precision → exact
  });

  test('different currencies never match or compare', () => {
    expect(matchesWithinRounding(parseMoney('USD 1,448.81'), card)).toBe(false);
    expect(isAtLeast(parseMoney('USD 9,999'), card)).toBe(false);
    expect(isAtMost(parseMoney('USD 1'), card)).toBe(false);
  });

  test('bounds work across precisions', () => {
    const total = parseMoney('CAD 1,997.36');
    expect(isAtLeast(total, scale(cart, 1.15))).toBe(true);
    expect(isAtMost(total, scale(cart, 1.6))).toBe(true);
    expect(isAtMost(total, scale(cart, 1.3))).toBe(false);
    expect(formatMoney(multiply(cart, 3))).toBe('CAD 4,346.43');
    expect(formatMoney(scale(cart, 1.15))).toBe('CAD 1,666.13');
  });

  test('matchers report both amounts and the tolerance', () => {
    expect(cart).toMatchPriceWithinRounding(card);
    expect(parseMoney('CAD 1,500')).toBeAtLeastPrice(cart);
    expect(parseMoney('CAD 1,000')).toBeAtMostPrice(cart);

  test('rounding matcher reports both amounts and the tolerance', () => {
  expect(cart).toMatchPriceWithinRounding(card);

  expect(() =>
    expect(
      parseMoney('CAD 1,400.00'),
    ).toMatchPriceWithinRounding(card),
  ).toThrow(
    /CAD 1,449 \(difference < CAD 1\.00, the display's rounding unit\)[\s\S]*CAD 1,400\.00/,
  );  
  });
});
