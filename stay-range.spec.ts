import { expect, test } from '@playwright/test';
import { formatStay, nightsOf, parseStayRange } from '@utils/stay-range';

test.describe('parseStayRange (cart header)', () => {
  const cases = [
    { text: 'Oct 23 - 24, 2026', stay: '2026-10-23 → 2026-10-24' },
    { text: 'OCT 23 - 24, 2026', stay: '2026-10-23 → 2026-10-24' },
    { text: 'Oct 31 - Nov 1, 2026', stay: '2026-10-31 → 2026-11-01' },
    { text: 'Oct 30 – Nov 02, 2026', stay: '2026-10-30 → 2026-11-02' },
    { text: 'Dec 31 - Jan 1, 2027', stay: '2026-12-31 → 2027-01-01' },
    { text: 'Dec 31, 2026 - Jan 1, 2027', stay: '2026-12-31 → 2027-01-01' },
    { text: '  Sep 5 -\n 9, 2026 ', stay: '2026-09-05 → 2026-09-09' },
  ];
  for (const { text, stay } of cases) {
    test(`parses ${JSON.stringify(text)}`, () => {
      expect(formatStay(parseStayRange(text))).toBe(stay);
    });
  }

  test('counts nights', () => {
    expect(nightsOf(parseStayRange('Oct 30 - Nov 2, 2026'))).toBe(3);
  });

  test('rejects text that is not a stay range', () => {
    expect(() => parseStayRange('To be calculated at checkout')).toThrow(/Unrecognised stay range/);
    expect(() => parseStayRange('Foo 3 - 4, 2026')).toThrow(/Unknown month/);
  });
});
