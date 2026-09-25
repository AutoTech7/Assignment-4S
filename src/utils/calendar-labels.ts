/**
 * The availability calendar labels each day button with its state followed by the full date:
 *   "Available check-in date Friday, October 23, 2026"   "Available for checkout Saturday, October 24, 2026"
 *   "Out of Range Tuesday, September 1, 2026"            (the prefix changes as the selection progresses)
 */

/** Any day button: its label ends with "<Month> <d>, <yyyy>". */
export const DAY_LABEL =
  /(january|february|march|april|may|june|july|august|september|october|november|december) \d{1,2}, \d{4}$/i;

const NOT_BOOKABLE = /unavailable|out of range|sold out|not available/i;

/** Whether a label describes a day that can be picked (the button's disabled state is checked separately). */
export function isBookableDayLabel(label: string): boolean {
  return !NOT_BOOKABLE.test(label);
}
