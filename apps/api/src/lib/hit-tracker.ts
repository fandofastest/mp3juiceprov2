import { NextRequest } from "next/server";
import { AppHitStat } from "@headless/database";

export function trackAppHit(req: NextRequest, endpointName: string) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const packageName =
      req.headers.get("x-package-name")?.trim() ||
      searchParams.get("packageName")?.trim() ||
      searchParams.get("package")?.trim() ||
      "com.mp3juice.mp3juicepro"; // Default app fallback

    const today = new Date().toISOString().split("T")[0];
    const cleanEndpoint = endpointName.replace(/^\/+/, "").replace(/\//g, "_") || "api";

    if (!AppHitStat) return;

    // Asynchronous non-blocking update
    AppHitStat.updateOne(
      { packageName, date: today },
      {
        $inc: {
          totalHits: 1,
          [`endpoints.${cleanEndpoint}`]: 1,
        },
        $set: {
          lastHitAt: new Date(),
        },
      },
      { upsert: true }
    ).exec().catch((err) => {
      console.error("[HitTracker] Error updating app hit stats:", err);
    });
  } catch (e) {
    // Fail silently so tracking never disrupts API response flow
  }
}
