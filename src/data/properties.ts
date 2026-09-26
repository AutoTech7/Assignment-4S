import { escapeRegExp } from '@utils/text';

/** Everything a test needs to know about a property. Add an entry to cover another hotel. */
export interface Property {
  /** Link text on /find_a_hotel_or_resort/. */
  readonly listingName: string;
  /** Region accordion on /find_a_hotel_or_resort/ that lists the property. */
  readonly region: string;
  /** Path segment of the property site: https://www.fourseasons.com/<slug>/ */
  readonly slug: string;
  /** Official name, as in the page title and the cart's property heading. */
  readonly displayName: string;
}

export const CABO_DEL_SOL = {
  listingName: 'Los Cabos (Cabo Del Sol)',
  region: 'North America',
  slug: 'cabodelsol',
  displayName: 'Four Seasons Resort Cabo Del Sol',
} as const satisfies Property;

/** Property home page, e.g. /cabodelsol/ (query string and hash tolerated). */
export function propertyHomeUrl(property: Property): RegExp {
  return new RegExp(`/${escapeRegExp(property.slug)}/?(?:[?#].*)?$`, 'i');
}

/** Room & rate results page, e.g. /cabodelsol/accommodations/?generalReservationForm.checkInDate=… */
export function roomResultsUrl(property: Property): RegExp {
  return new RegExp(`/${escapeRegExp(property.slug)}/accommodations/?(?:[?#].*)?$`, 'i');
}
