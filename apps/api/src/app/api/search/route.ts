import { NextRequest } from "next/server";
import { initApi, successResponse, errorResponse } from "../../../lib/api-helper";
import { ProviderFactory } from "@headless/providers";
import { AnalyticsEvent, SystemSettings, AppConfig } from "@headless/database";
import { verifyAccessToken } from "@headless/auth";
import { trackAppHit } from "../../../lib/hit-tracker";
import { shouldEnforceSafeMode, isBlockedKeyword } from "../../../lib/safe-mode-guard";
import { CacheService } from "@headless/utils";

// In-Flight Request Deduplication (SingleFlight pattern)
const inFlightSearches = new Map<string, Promise<any>>();

async function searchJamendoSafe(query: string, limit = 10) {
  const cacheKey = `jamendo_safe:${query.toLowerCase().trim()}:${limit}`;
  const cached = await CacheService.get<any>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://api.jamendo.com/v3.0/tracks/?client_id=87c44b11&format=json&namesearch=${encodeURIComponent(query)}&limit=${limit}`,
      { signal: AbortSignal.timeout(3500) }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.results && Array.isArray(data.results)) {
        const tracks = data.results.map((item: any) => ({
          id: String(item.id),
          vid: String(item.id),
          title: item.name || "Unknown Title",
          artist: item.artist_name || "Unknown Artist",
          artistId: String(item.artist_id || ""),
          album: item.album_name || "Single",
          cover: item.image || "",
          duration: item.duration || 0,
          url: `https://api.jamendo.com/v3.0/tracks/file/?client_id=87c44b11&id=${item.id}&action=stream`,
          provider: "jamendo",
        }));
        const result = { tracks, albums: [], artists: [] };
        if (tracks.length > 0) {
          CacheService.set(cacheKey, result, 86400).catch(() => {});
        }
        return result;
      }
    }
  } catch (err) {
    // Silently fall back to mock provider
  }

  const mockProvider = ProviderFactory.getProvider("mock");
  return mockProvider.search(query, limit);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const cleanQuery = query.toLowerCase().trim();

    // 1. Instant Short Query Guard: Drop single-keystrokes without touching DB or YouTube
    if (!cleanQuery || cleanQuery.length < 2) {
      const emptyResult = { tracks: [], albums: [], artists: [] };
      const resp = successResponse(emptyResult);
      resp.headers.set("Cache-Control", "public, max-age=300");
      return resp;
    }

    await initApi();
    trackAppHit(req, "search");

    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "10"), 1), 25);
    let providerName = searchParams.get("provider") || "mock";
    const packageName = req.headers.get("x-package-name") || searchParams.get("packageName") || undefined;

    const searchCacheKey = `search:${providerName}:${cleanQuery}:${limit}`;

    // 2. Instant L1/L2 Cache Lookup (< 0.001ms if in L1)
    const cachedResults = await CacheService.get<any>(searchCacheKey);
    if (cachedResults) {
      const resp = successResponse(cachedResults);
      resp.headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=1800");
      return resp;
    }

    // 3. In-Flight Request Deduplication: If already searching, wait for existing promise
    if (inFlightSearches.has(searchCacheKey)) {
      try {
        const inFlightResult = await inFlightSearches.get(searchCacheKey);
        const resp = successResponse(inFlightResult);
        resp.headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=1800");
        return resp;
      } catch {
        // If in-flight failed, proceed to fresh attempt
      }
    }

    // Wrap fresh search execution
    const searchPromise = (async () => {
      // Safe Mode Enforcement (cached app config)
      let appConfig: any = null;
      if (packageName) {
        const appConfigKey = `raw_app_config:${packageName}`;
        appConfig = await CacheService.get(appConfigKey);
        if (!appConfig) {
          appConfig = await AppConfig.findOne({ packageName }).lean();
          if (appConfig) {
            CacheService.set(appConfigKey, appConfig, 600).catch(() => {});
          }
        }
      }

      const isSafe = shouldEnforceSafeMode(req, appConfig);
      const isBlocked = isBlockedKeyword(cleanQuery, appConfig?.blockedKeywords);

      if (isSafe || isBlocked) {
        const safeResults = await searchJamendoSafe(cleanQuery, limit);
        if (safeResults?.tracks?.length) {
          CacheService.set(searchCacheKey, safeResults, 86400).catch(() => {});
        }
        return safeResults;
      }

      const provider = ProviderFactory.getProvider(providerName);

      // Dynamically inject YouTube API Key from Settings (cached)
      if (providerName === "youtube") {
        let apiKey = await CacheService.get<string>("settings:youtube_api_key");
        if (apiKey === null) {
          try {
            const settings = await SystemSettings.findOne().lean();
            apiKey = (settings as any)?.apiKeys?.get ? (settings as any).apiKeys.get("youtube_api_key") : (settings as any)?.apiKeys?.youtube_api_key || "";
            await CacheService.set("settings:youtube_api_key", apiKey || "", 600);
          } catch {
            apiKey = "";
          }
        }
        if (apiKey && "setApiKey" in provider) {
          (provider as any).setApiKey(apiKey);
        }
      }

      let results;
      try {
        results = await provider.search(cleanQuery, limit);
      } catch (e) {
        results = { tracks: [], albums: [], artists: [] };
      }

      if ((!results || !results.tracks || results.tracks.length === 0) && providerName === "youtube") {
        results = await searchJamendoSafe(cleanQuery, limit);
      }

      // Cache successful search results (24 hours)
      if (results && results.tracks && results.tracks.length > 0) {
        CacheService.set(searchCacheKey, results, 86400).catch(() => {});
      }

      return results;
    })();

    inFlightSearches.set(searchCacheKey, searchPromise);

    let finalResults;
    try {
      finalResults = await searchPromise;
    } finally {
      inFlightSearches.delete(searchCacheKey);
    }

    // Asynchronously log analytics event without blocking response
    const authHeader = req.headers.get("Authorization");
    let userId: string | undefined;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const payload = verifyAccessToken(authHeader.substring(7));
      if (payload) userId = payload.userId;
    }

    AnalyticsEvent.create({
      eventType: "Search",
      userId,
      metadata: { query: cleanQuery, provider: providerName, resultCount: finalResults?.tracks?.length || 0 },
    }).catch(() => {});

    const response = successResponse(finalResults);
    response.headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=1800");
    return response;
  } catch (error: any) {
    return errorResponse(error.message || "Internal server error", 500);
  }
}

