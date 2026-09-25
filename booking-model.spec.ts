import { expect, test } from '@playwright/test';
import { adultsLabel, cartItemTitle, parseOccupancy, type RoomSelection } from '@models/booking';
import { parseMoney } from '@utils/money';

test.describe('booking model', () => {
  test('parses the occupancy field', () => {
    expect(parseOccupancy('1 Room - 2 Adults')).toEqual({ rooms: 1, adults: 2 });
    expect(parseOccupancy('2 Rooms - 1 Adult, 2 Children')).toEqual({ rooms: 2, adults: 1 });
    expect(() => parseOccupancy('Guests')).toThrow(/Unrecognised occupancy "Guests"/);
  });

  test('builds the line-item title the cart renders', () => {
    const selection: RoomSelection = {
      roomName: 'Ocean-View La Casona Room',
      rateName: 'Advance Purchase – Up to 20% Off',
      bedType: 'One king bed',
      nightlyPrice: parseMoney('CAD 1,449'),
    };
    expect(cartItemTitle(selection)).toBe('Ocean-View La Casona Room - One king bed');
    expect(cartItemTitle({ ...selection, bedType: undefined })).toBe('Ocean-View La Casona Room');
  });

  test('pluralises guests like the cart', () => {
    expect(adultsLabel({ rooms: 1, adults: 2 })).toBe('2 adults');
    expect(adultsLabel({ rooms: 1, adults: 1 })).toBe('1 adult');
  });
});
