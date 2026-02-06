/**
 * Slug generation utilities for semantic URLs
 * Converts list names like "Acme Series A" into "acme-series-a"
 */

/**
 * Generates a URL-friendly slug from a string
 * @param name - The string to convert (e.g., "Acme Series A")
 * @returns A slugified string (e.g., "acme-series-a")
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '');     // Remove leading/trailing hyphens
}

/**
 * Generates a unique slug by checking against existing slugs in the database
 * If slug exists, appends -2, -3, etc.
 * @param name - The list name to convert
 * @param checkExists - Async function that checks if a slug exists
 * @returns A unique slug
 */
export async function generateUniqueSlug(
  name: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
  let slug = generateSlug(name);
  let counter = 2;

  // Keep trying with incrementing counter until we find a unique slug
  while (await checkExists(slug)) {
    slug = `${generateSlug(name)}-${counter}`;
    counter++;
  }

  return slug;
}

/**
 * Validates that a slug meets the requirements
 * - Must be 1-100 characters
 * - Must contain only lowercase letters, numbers, and hyphens
 * - Must not start or end with a hyphen
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || slug.length === 0 || slug.length > 100) {
    return false;
  }

  // Check format: lowercase letters, numbers, hyphens only
  // Must not start or end with hyphen
  const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  return slugRegex.test(slug);
}
