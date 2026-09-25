// Playwright's expect plus the price matchers; no browser involved.
import { expect } from '@fixtures/matchers';
import { test } from '@playwright/test';
import { CABO_DEL_SOL } from '@data/properties';
import { adultsLabel, cartItemTitle, parseOccupancy, type RoomSelection } from '@models/booking';
import { CalendarDate } from '@utils/calendar-date';
import { isBookableDayLabel } from '@utils/calendar-labels';
import { multiply, parseMoney, removeMoney, scale } from '@utils/money';
import { formatStay, nightsOf, parseStayRange } from '@utils/stay-range';

/**
 * Text captured from the live site on 2026-09-23 (Cabo del Sol, 23 → 24 Oct 2026, 1 room, 2 adults; CAD
 * because the session was in Canada), so the parsers are tested against real markup.
 */
const LIVE = {
  occupancyField: '1 Room - 2 Adults',
  checkInLabel: 'Available check-in date Friday, October 23, 2026',
  checkOutLabel: 'Available for checkout Saturday, October 24, 2026',
  pastDayLabel: 'Out of Range Tuesday, September 1, 2026',
  roomName: 'Ocean-View La Casona Room',
  rateName: 'Advance Purchase – Up to 20% Off',
  ratePriceBeforeBedChoice: 'Avg. price per night\nFrom CAD 1,449',
  ratePriceAfterBedChoice: 'Avg. price per night\nCAD 1,449',
  selectedBedOption: 'One king bedCAD 1,449', // textContent; CSS-capitalised to "One King Bed" on screen
  cartStayDates: 'Oct 23 - 24, 2026', // textContent; CSS-uppercased to "OCT 23 - 24, 2026" on screen
  cartItem:
    'Ocean-View La Casona Room - One king bedAdvance Purchase – Up to 20% Off2 adultsRemove' +
    'CAD 1,448.81 before addition of Service Charge plus taxes per night',
  cartItemPrice: 'CAD 1,448.81',
  cartEstimatedTotal: 'CAD 1,997.36',
} as const;

test.describe('live-site contract (captured 2026-09-23)', () => {
  const selection: RoomSelection = {
    roomName: LIVE.roomName,
    rateName: LIVE.rateName,
    bedType: removeMoney(LIVE.selectedBedOption),
    nightlyPrice: parseMoney(LIVE.ratePriceAfterBedChoice),
  };

  test('calendar labels: the date is found and bookability is read from the prefix', () => {
    expect(CalendarDate.findInText(LIVE.checkInLabel)?.toLongLabel()).toBe('Friday, October 23, 2026');
    expect(CalendarDate.findInText(LIVE.checkOutLabel)?.toIso()).toBe('2026-10-24');
    expect(isBookableDayLabel(LIVE.checkInLabel)).toBe(true);
    expect(isBookableDayLabel(LIVE.checkOutLabel)).toBe(true);
    expect(isBookableDayLabel(LIVE.pastDayLabel)).toBe(false);
  });

  test('rate card: the "From" price and the chosen bed option parse to the same amount', () => {
    expect(parseMoney(LIVE.ratePriceBeforeBedChoice)).toEqual(parseMoney(LIVE.ratePriceAfterBedChoice));
    expect(selection.bedType).toBe('One king bed');
  });

  test('cart line item carries the selected room, bed, rate and guests', () => {
    expect(LIVE.cartItem).toContain(cartItemTitle(selection));
    expect(LIVE.cartItem).toContain(selection.rateName);
    expect(LIVE.cartItem).toContain(adultsLabel(parseOccupancy(LIVE.occupancyField)));
    expect(formatStay(parseStayRange(LIVE.cartStayDates))).toBe('2026-10-23 → 2026-10-24');
  });

  test('cart price equals the rate-card price once display rounding is accounted for', () => {
    expect(parseMoney(LIVE.cartItemPrice)).toMatchPriceWithinRounding(selection.nightlyPrice);
  });

  test('estimated total sits inside the property band (service charge + taxes)', () => {
    const subtotal = multiply(parseMoney(LIVE.cartItemPrice), nightsOf(parseStayRange(LIVE.cartStayDates)));
    const total = parseMoney(LIVE.cartEstimatedTotal);
    expect(total).toBeAtLeastPrice(scale(subtotal, CABO_DEL_SOL.estimatedTotalFactor.min));
    expect(total).toBeAtMostPrice(scale(subtotal, CABO_DEL_SOL.estimatedTotalFactor.max));
  });
});
