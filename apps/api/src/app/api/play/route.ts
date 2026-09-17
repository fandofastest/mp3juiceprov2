import { NextRequest } from "next/server";
import { initApi, successResponse, errorResponse, authenticateRequest } from "../../../lib/api-helper";
import { SystemSettings, History, AnalyticsEvent, Track, AppConfig, PlayLog } from "@headless/database";
import { trackAppHit } from "../../../lib/hit-tracker";
import { shouldEnforceSafeMode, isBlockedKeyword } from "../../../lib/safe-mode-guard";
import { CacheService } from "@headless/utils";

export async function GET(req: NextRequest) {
  try {
    await initApi();
    trackAppHit(req, "play");
    
    // Optional/Required authentication
    const userPayload = await authenticateRequest(req);
    const userId = userPayload?.userId;

    const { searchParams } = new URL(req.url);
    const vid = searchParams.get("vid");

    if (!vid) {
      return errorResponse("YouTube video ID (vid) query parameter is required", 400);
    }

    // 1. Anti-DMCA & Safe Mode Enforcement (cached)
    const packageName = req.headers.get("x-package-name") || searchParams.get("packageName");
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

    // Check if Safe Mode is enforced globally or via Geo-fencing (BE, GB, US, etc.)
    if (shouldEnforceSafeMode(req, appConfig)) {
      return errorResponse("Song playback is disabled (Safe Mode Active / Region Restricted)", 403);
    }

    const title = searchParams.get("title") || "YouTube Track";
    const artist = searchParams.get("artist") || "";

    // Check if track or artist matches high-risk copyrighted blacklist
    if (
      vid === "2Vv-BfVoq4g" ||
      isBlockedKeyword(title, appConfig?.blockedKeywords) ||
      isBlockedKeyword(artist, appConfig?.blockedKeywords)
    ) {
      return errorResponse("Song is unavailable due to copyright restrictions", 403);
    }

    // Retrieve settings (cached in memory)
    let baseUrl = await CacheService.get<string>("settings:play_api_url");
    if (!baseUrl) {
      try {
        const settings = await SystemSettings.findOne().lean();
        baseUrl = (settings as any)?.apiKeys?.get ? (settings as any).apiKeys.get("play_api_url") : (settings as any)?.apiKeys?.play_api_url || process.env.PLAY_API_URL || "https://ytdl.lovelywombat.box.ca/dl";
        CacheService.set("settings:play_api_url", baseUrl, 600).catch(() => {});
      } catch {
        baseUrl = process.env.PLAY_API_URL || "https://ytdl.lovelywombat.box.ca/dl";
      }
    }
    const safeBaseUrl = baseUrl || process.env.PLAY_API_URL || "https://ytdl.lovelywombat.box.ca/dl";
    const downloadLink = `${safeBaseUrl.replace(/\/+$/, '')}/${vid}`;

    const data = {
      status: "ok",
      link: downloadLink,
      vid,
      title,
      duration: 0,
      filesize: 0,
    };

    // Log Play Hit in PlayLog (non-blocking)
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    PlayLog.create({
      vid,
      title: data.title,
      artist: "YouTube Video",
      playUrl: downloadLink,
      packageName: packageName || undefined,
      userId: userId || undefined,
      ipAddress,
      userAgent,
    }).catch(() => {});

    // Log Analytics Play Event (non-blocking)
    AnalyticsEvent.create({
      eventType: "Play Event",
      userId,
      metadata: {
        vid,
        title: data.title || "Unknown Title",
        duration: data.duration || 0,
        filesize: data.filesize || 0,
        provider: "youtube",
      },
    }).catch(() => {});

    // Save track to local database cache asynchronously (non-blocking)
    Track.updateOne(
      { vid },
      {
        $set: {
          vid,
          title: data.title || "YouTube Track",
          artist: "YouTube Video",
          cover: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
          duration: Math.round(data.duration || 240),
          provider: "youtube",
        },
      },
      { upsert: true }
    ).catch(() => {});

    // If authenticated, automatically write to user's Listening History as well
    if (userId) {
      try {
        await History.create({
          userId,
          vid,
          trackId: vid,
          title: data.title || "YouTube Track",
          artist: "YouTube Video",
          cover: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
          duration: Math.round(data.duration || 240),
        });
      } catch (err) {
        console.error("Listening history log failed in play endpoint:", err);
      }
    }

    return successResponse(data);
  } catch (error: any) {
    return errorResponse(error.message || "Internal server error", 500);
  }
}
