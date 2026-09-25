/** Escapes a string so it can be embedded literally in a RegExp. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Collapses whitespace runs (including non-breaking spaces and line breaks) and trims. */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Case-insensitive, whitespace-tolerant pattern matching the whole of `value`. */
export function exactText(value: string): RegExp {
  return new RegExp(`^\\s*${escapeRegExp(normalizeWhitespace(value)).replace(/ /g, '\\s+')}\\s*$`, 'i');
}

/** Case-insensitive pattern matching text that starts with `value` as a whole word/phrase. */
export function startsWithText(value: string): RegExp {
  return new RegExp(`^\\s*${escapeRegExp(normalizeWhitespace(value)).replace(/ /g, '\\s+')}(?![\\w-])`, 'i');
}
