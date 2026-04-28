/**
 * Client-side input sanitization utilities.
 *
 * These are a defence-in-depth layer — the backend must also sanitize.
 * We strip HTML tags and dangerous characters from user-supplied strings
 * before sending them to the API, reducing stored-XSS risk.
 */

/**
 * Strip all HTML tags and null bytes from a string.
 * Safe to use on any user-supplied text field (title, description, name, etc.)
 */
export function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')       // remove HTML tags
    .replace(/\0/g, '')            // remove null bytes
    .trim();
}

/**
 * Sanitize a plain-text field: strip HTML and collapse excessive whitespace.
 */
export function sanitizeText(value: string): string {
  return stripHtml(value).replace(/\s{3,}/g, '  ');
}

/**
 * Sanitize a URL string — only allow http/https schemes.
 * Returns an empty string if the URL is not safe.
 */
export function sanitizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return trimmed;
  } catch {
    return '';
  }
}

/**
 * Sanitize an email address — lowercase and strip whitespace.
 */
export function sanitizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Validate that a string contains no script injection patterns.
 * Returns true if the string is safe, false if suspicious.
 */
export function isSafeString(value: string): boolean {
  const dangerous = /<script|javascript:|on\w+\s*=|data:/i;
  return !dangerous.test(value);
}
