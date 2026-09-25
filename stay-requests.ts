import { env } from '@config/env';
import type { StayRequest } from '@models/booking';
import { CalendarDate } from '@utils/calendar-date';

/** Check-in CHECK_IN_OFFSET_DAYS from today, for NIGHTS nights. Relative, so the suite never goes stale. */
export function stayRequestFromEnv(today: CalendarDate = CalendarDate.today()): StayRequest {
  return {
    earliestCheckIn: today.addDays(env.checkInOffsetDays),
    nights: env.nights,
    searchWindowDays: env.availabilitySearchDays,
  };
}
