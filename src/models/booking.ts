import type { CalendarDate } from '@utils/calendar-date';
import type { Money } from '@utils/money';
import type { StayDates } from '@utils/stay-range';

/** What the test asks the availability tool for. */
export interface StayRequest {
  /** Preferred check-in; later days are tried when it is sold out. */
  readonly earliestCheckIn: CalendarDate;
  /** Preferred length of stay; extended when the property enforces a minimum stay for that check-in. */
  readonly nights: number;
  /** How many extra days to scan for an available check-in before giving up. */
  readonly searchWindowDays: number;
}

export interface Occupancy {
  readonly rooms: number;
  readonly adults: number;
}

/** What the availability tool actually searched for. */
export interface StaySearch extends StayDates {
  readonly occupancy: Occupancy;
}

/** A rate the test added to the cart, captured from the room list *before* adding it. */
export interface RoomSelection {
  readonly roomName: string;
  readonly rateName: string;
  /** Bed configuration, for rates that require choosing one (e.g. "One king bed"). */
  readonly bedType: string | undefined;
  /** "Avg. price per night" as shown on the rate card (rounded to whole units by the UI). */
  readonly nightlyPrice: Money;
}

/** "1 Room - 2 Adults" → { rooms: 1, adults: 2 } */
export function parseOccupancy(text: string): Occupancy {
  const rooms = /(\d+)\s*rooms?\b/i.exec(text)?.[1];
  const adults = /(\d+)\s*adults?\b/i.exec(text)?.[1];
  if (rooms === undefined || adults === undefined) {
    throw new Error(`Unrecognised occupancy ${JSON.stringify(text)}`);
  }
  return { rooms: Number(rooms), adults: Number(adults) };
}

/** Title the cart renders for a line item: "Ocean-View La Casona Room - One king bed". */
export function cartItemTitle(selection: RoomSelection): string {
  return selection.bedType ? `${selection.roomName} - ${selection.bedType}` : selection.roomName;
}

/** "2 adults" / "1 adult", as the cart renders guest counts. */
export function adultsLabel(occupancy: Occupancy): string {
  return `${occupancy.adults} adult${occupancy.adults === 1 ? '' : 's'}`;
}
