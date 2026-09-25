import { expect as baseExpect } from '@playwright/test';
import {
  displayUnit,
  formatMoney,
  isAtLeast,
  isAtMost,
  matchesWithinRounding,
  type Money,
} from '@utils/money';

/** Price matchers whose failure messages show both amounts (and the tolerance, where one applies). */
export const expect = baseExpect.extend({
  /**
   * Same currency, and equal up to display rounding: less than one unit of the coarser display (the room
   * list shows whole units, the cart shows cents). `expect(cartPrice).toMatchPriceWithinRounding(listed)`
   */
  toMatchPriceWithinRounding(received: Money, expected: Money) {
    const pass = matchesWithinRounding(received, expected);
    const { precision, minorUnits } = displayUnit(received, expected);
    const unit = formatMoney({ currency: expected.currency, minorUnits, precision });
    const hint = this.utils.matcherHint('toMatchPriceWithinRounding', 'received', 'expected', {
      isNot: this.isNot,
    });
    return {
      pass,
      name: 'toMatchPriceWithinRounding',
      expected: formatMoney(expected),
      actual: formatMoney(received),
      message: () =>
        `${hint}\n\n` +
        `Expected: ${this.isNot ? 'not ' : ''}${formatMoney(expected)} (difference < ${unit}, the display's rounding unit)\n` +
        `Received: ${formatMoney(received)}`,
    };
  },

  /** Same currency and ≥ `minimum`. */
  toBeAtLeastPrice(received: Money, minimum: Money) {
    const pass = isAtLeast(received, minimum);
    const hint = this.utils.matcherHint('toBeAtLeastPrice', 'received', 'minimum', { isNot: this.isNot });
    return {
      pass,
      name: 'toBeAtLeastPrice',
      expected: formatMoney(minimum),
      actual: formatMoney(received),
      message: () =>
        `${hint}\n\nExpected: ${this.isNot ? '< ' : '≥ '}${formatMoney(minimum)}\nReceived: ${formatMoney(received)}`,
    };
  },

  /** Same currency and ≤ `maximum`. */
  toBeAtMostPrice(received: Money, maximum: Money) {
    const pass = isAtMost(received, maximum);
    const hint = this.utils.matcherHint('toBeAtMostPrice', 'received', 'maximum', { isNot: this.isNot });
    return {
      pass,
      name: 'toBeAtMostPrice',
      expected: formatMoney(maximum),
      actual: formatMoney(received),
      message: () =>
        `${hint}\n\nExpected: ${this.isNot ? '> ' : '≤ '}${formatMoney(maximum)}\nReceived: ${formatMoney(received)}`,
    };
  },
});
