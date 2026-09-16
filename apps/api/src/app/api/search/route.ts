import { NextRequest } from "next/server";
import { initApi, successResponse, errorResponse } from "../../../lib/api-helper";
import { ProviderFactory } from "@headless/providers";
import { AnalyticsEvent, SystemSettings, AppConfig } from "@headless/database";
import { verifyAccessToken } from "@headless/auth";
import { trackAppHit } from "../../../lib/hit-tracker";
import { shouldEnforceSafeMode, isBlockedKeyword } from "../../../lib/safe-mode-guard";

async function searchJamendoSafe(query: string, limit = 10) {
  try {
    const res = await fetch(
      `https://api.jamendo.com/v3.0/tracks/?client_id=87c44b11&format=json&namesearch=${encodeURIComponent(query)}&limit=${limit}`
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
        return { tracks, albums: [], artists: [] };
      }
    }
  } catch (err) {
    console.error("Jamendo safe search fallback error:", err);
  }
  const mockProvider = ProviderFactory.getProvider("mock");
  return mockProvider.search(query, limit);
}

export async function GET(req: NextRequest) {
  try {
    await initApi();
    trackAppHit(req, "search");
    const { searchParams } = new URL(req.url);

    const query = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit") || "10");
    let providerName = searchParams.get("provider") || "mock";
    const packageName = req.headers.get("x-package-name") || searchParams.get("packageName") || undefined;

    if (!query) {
      return errorResponse("Search query is required", 400);
    }

    // 1. Anti-DMCA & Safe Mode Enforcement
    let appConfig: any = null;
    if (packageName) {
      appConfig = await AppConfig.findOne({ packageName }).lean();
    }

    const isSafe = shouldEnforceSafeMode(req, appConfig);
    const isBlocked = isBlockedKeyword(query, appConfig?.blockedKeywords);

    if (isSafe || isBlocked) {
      console.log(`[SafeMode Search Guard] Enforced for query: "${query}", isSafe: ${isSafe}, isBlocked: ${isBlocked}`);
      const safeResults = await searchJamendoSafe(query, limit);
      return successResponse(safeResults);
    }

    const provider = ProviderFactory.getProvider(providerName);

    // Dynamically inject YouTube API Key from Settings database
    if (providerName === "youtube") {
      const settings = await SystemSettings.findOne();
      if (settings && settings.apiKeys) {
        const apiKey = settings.apiKeys.get("youtube_api_key");
        if (apiKey && "setApiKey" in provider) {
          (provider as any).setApiKey(apiKey);
        }
      }
    }

    let results;
    try {
      results = await provider.search(query, limit);
    } catch (e) {
      console.error("Provider search failed, using fallback:", e);
      results = { tracks: [], albums: [], artists: [] };
    }

    if ((!results || !results.tracks || results.tracks.length === 0) && providerName === "youtube") {
      console.log("YouTube search returned 0 results. Falling back to Safe Jamendo provider.");
      results = await searchJamendoSafe(query, limit);
    }

    // Track search event in analytics asynchronously
    const authHeader = req.headers.get("Authorization");
    let userId: string | undefined;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const payload = verifyAccessToken(authHeader.substring(7));
      if (payload) {
        userId = payload.userId;
      }
    }

    AnalyticsEvent.create({
      eventType: "Search",
      userId,
      metadata: { query, provider: providerName, resultCount: results.tracks.length },
    }).catch(err => console.error("Analytics error:", err));

    return successResponse(results);
  } catch (error: any) {
    return errorResponse(error.message || "Internal server error", 500);
  }
}
