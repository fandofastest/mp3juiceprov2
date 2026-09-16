import { NextRequest } from "next/server";

export const DEFAULT_RESTRICTED_COUNTRIES = [
  "BE", // Belgium (IFPI European Headquarters)
  "GB", // United Kingdom (IFPI International Secretariat)
  "US", // United States (Google Reviewers, RIAA, Major Labels)
  "DE", // Germany (GEMA / Strict EU copyright jurisdiction)
  "FR", // France (SACEM / Strict enforcement)
  "NL", // Netherlands (BREIN / Anti-piracy)
  "IE", // Ireland (Google EU HQ)
  "CA", // Canada
  "AU", // Australia
  "CH", // Switzerland
  "SE", // Sweden
];

export const DEFAULT_BLOCKED_KEYWORDS = [
  "ed sheeran",
  "perfect",
  "shape of you",
  "taylor swift",
  "warner music",
  "universal music",
  "sony music",
  "billie eilish",
  "the weeknd",
  "dua lipa",
  "ariana grande",
  "justin bieber",
  "drake",
  "adele",
  "coldplay",
  "bruno mars",
  "post malone",
  "harry styles",
  "olivia rodrigo",
  "kendrick lamar",
  "beyonce",
  "rihanna",
  "eminem",
  "bts",
  "ifpi",
  "riaa",
];

/**
 * Extracts the 2-letter ISO country code from incoming request headers
 */
export function getClientCountry(req: NextRequest): string | null {
  const headers = req.headers;

  const directCountry =
    headers.get("cf-ipcountry") ||
    headers.get("x-vercel-ip-country") ||
    headers.get("x-country-code") ||
    headers.get("x-client-country") ||
    headers.get("x-geoip-country") ||
    headers.get("x-forwarded-country");

  if (directCountry && directCountry.length === 2) {
    return directCountry.toUpperCase();
  }

  // Fallback: Check custom package / locale header if sent by app
  const clientLocale = headers.get("x-device-locale") || headers.get("accept-language");
  if (clientLocale) {
    // Examples: "en-GB", "en_GB", "nl-BE", "fr-BE", "en-US"
    const match = clientLocale.match(/[-_]([A-Za-z]{2})\b/);
    if (match && match[1]) {
      const parsed = match[1].toUpperCase();
      if (DEFAULT_RESTRICTED_COUNTRIES.includes(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

/**
 * Checks if the detected country is in the restricted/audit zone
 */
export function isRestrictedCountry(
  countryCode: string | null,
  customRestricted: string[] = DEFAULT_RESTRICTED_COUNTRIES
): boolean {
  if (!countryCode) return false;
  const list = customRestricted.length > 0 ? customRestricted : DEFAULT_RESTRICTED_COUNTRIES;
  return list.map((c) => c.toUpperCase()).includes(countryCode.toUpperCase());
}

/**
 * Checks if a string query or title contains high-risk copyrighted artists/labels
 */
export function isBlockedKeyword(
  text: string,
  customBlocked: string[] = DEFAULT_BLOCKED_KEYWORDS
): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase().trim();
  const list = customBlocked.length > 0 ? customBlocked : DEFAULT_BLOCKED_KEYWORDS;
  return list.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

/**
 * Determines whether Safe Mode must be enforced for this specific request.
 * Returns true if:
 * 1. Global Safe Mode is active
 * 2. Geo-Safe Mode is enabled AND client is from a restricted country (BE, GB, US, etc.)
 */
export function shouldEnforceSafeMode(
  req: NextRequest,
  config?: {
    safeMode?: boolean;
    geoSafeMode?: boolean;
    restrictedCountries?: string[];
  }
): boolean {
  // 1. If global safeMode is on, always enforce
  if (config?.safeMode === true) {
    return true;
  }

  // 2. Check Geo-Safe Mode (default true)
  const isGeoEnabled = config?.geoSafeMode !== false;
  if (isGeoEnabled) {
    const country = getClientCountry(req);
    if (isRestrictedCountry(country, config?.restrictedCountries)) {
      return true;
    }
  }

  return false;
}
