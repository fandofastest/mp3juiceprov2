import { NextRequest } from "next/server";
import { AppHitStat } from "@headless/database";

// In-Memory Hit Buffer to prevent MongoDB write spam
interface HitAccumulator {
  packageName: string;
  date: string;
  endpoints: Record<string, number>;
  total: number;
  uniqueVisitors: number;
}

const hitBuffer = new Map<string, HitAccumulator>();
let flushTimer: NodeJS.Timeout | null = null;
let isFlushing = false;

// Live Real-Time Visitor Tracking (In-Memory Sliding Window)
// Key: visitorId -> { packageName, lastSeen: timestamp }
interface LiveVisitorEntry {
  packageName: string;
  lastSeen: number;
}

const liveVisitors = new Map<string, LiveVisitorEntry>();

// Daily Unique Visitor Tracking (In-Memory Set to deduplicate per day)
// Key: `${packageName}:${date}:${visitorId}`
const dailySeenVisitors = new Set<string>();
let activeDate = new Date().toISOString().split("T")[0];

/**
 * Extract or generate a consistent unique visitor ID.
 * Priority:
 * 1. Header: x-device-id or x-client-id
 * 2. Query param: deviceId or clientId
 * 3. Fallback: Hash of Client IP + User-Agent
 */
export function extractVisitorId(req: NextRequest): string {
  try {
    const headerDev = req.headers.get("x-device-id") || req.headers.get("x-client-id");
    if (headerDev && headerDev.trim()) return headerDev.trim();

    const searchParams = req.nextUrl.searchParams;
    const qDev = searchParams.get("deviceId") || searchParams.get("clientId");
    if (qDev && qDev.trim()) return qDev.trim();

    // Fallback IP + User-Agent
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : (req.headers.get("x-real-ip") || "127.0.0.1");
    const ua = req.headers.get("user-agent") || "generic-client";

    let hash = 0;
    const str = `${ip}###${ua}`;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return `dev_${Math.abs(hash).toString(36)}`;
  } catch {
    return "dev_anonymous";
  }
}

async function flushHitsToDatabase() {
  if (isFlushing || hitBuffer.size === 0 || !AppHitStat) return;
  isFlushing = true;

  const currentBatch = Array.from(hitBuffer.values());
  hitBuffer.clear();

  try {
    const ops = currentBatch.map((item) => {
      const incFields: Record<string, number> = { 
        totalHits: item.total,
        uniqueVisitors: item.uniqueVisitors,
      };
      for (const [ep, count] of Object.entries(item.endpoints)) {
        incFields[`endpoints.${ep}`] = count;
      }

      return {
        updateOne: {
          filter: { packageName: item.packageName, date: item.date },
          update: {
            $inc: incFields,
            $set: { lastHitAt: new Date() },
          },
          upsert: true,
        },
      };
    });

    if (ops.length > 0) {
      await AppHitStat.bulkWrite(ops, { ordered: false });
    }
  } catch (err) {
    // Non-fatal, suppress to not block event loop
  } finally {
    isFlushing = false;
  }
}

function scheduleFlush() {
  if (!flushTimer) {
    flushTimer = setInterval(() => {
      flushHitsToDatabase().catch(() => {});
    }, 10000);
    // Unref so timer doesn't keep node process from exiting
    if (flushTimer && typeof flushTimer.unref === "function") {
      flushTimer.unref();
    }
  }
}

export function trackAppHit(req: NextRequest, endpointName: string) {
  try {
    scheduleFlush();

    const searchParams = req.nextUrl.searchParams;
    const packageName =
      req.headers.get("x-package-name")?.trim() ||
      searchParams.get("packageName")?.trim() ||
      searchParams.get("package")?.trim() ||
      "com.mp3juice.mp3juicepro";

    const now = Date.now();
    const today = new Date().toISOString().split("T")[0];

    // Reset daily cache if day rolled over
    if (today !== activeDate) {
      dailySeenVisitors.clear();
      activeDate = today;
    }

    const visitorId = extractVisitorId(req);
    const liveKey = `${packageName}:${visitorId}`;

    // 1. Record Live Realtime Activity
    liveVisitors.set(liveKey, {
      packageName,
      lastSeen: now,
    });

    // 2. Record Daily Unique Visitor
    const dailyKey = `${packageName}:${today}:${visitorId}`;
    let isNewDailyVisitor = false;
    if (!dailySeenVisitors.has(dailyKey)) {
      dailySeenVisitors.add(dailyKey);
      isNewDailyVisitor = true;
    }

    // 3. Accumulate in buffer
    const cleanEndpoint = endpointName.replace(/^\/+/, "").replace(/\//g, "_") || "api";
    const bufferKey = `${packageName}:${today}`;

    let item = hitBuffer.get(bufferKey);
    if (!item) {
      item = {
        packageName,
        date: today,
        endpoints: {},
        total: 0,
        uniqueVisitors: 0,
      };
      hitBuffer.set(bufferKey, item);
    }

    item.total += 1;
    if (isNewDailyVisitor) {
      item.uniqueVisitors += 1;
    }
    item.endpoints[cleanEndpoint] = (item.endpoints[cleanEndpoint] || 0) + 1;
  } catch (e) {
    // Fail silently
  }
}

/**
 * Retrieve Live Active Visitors and Today's Unique Visitor counts.
 * Default live window: active within last 5 minutes.
 */
export function getLiveVisitorStats(windowMs = 5 * 60 * 1000): {
  totalLive: number;
  perPackage: Record<string, number>;
  todayUniqueVisitors: Record<string, number>;
} {
  const now = Date.now();
  const threshold = now - windowMs;
  const pruneThreshold = now - 15 * 60 * 1000;
  const perPackage: Record<string, number> = {};
  let totalLive = 0;

  for (const [key, entry] of liveVisitors.entries()) {
    if (entry.lastSeen < pruneThreshold) {
      liveVisitors.delete(key);
    } else if (entry.lastSeen >= threshold) {
      totalLive++;
      perPackage[entry.packageName] = (perPackage[entry.packageName] || 0) + 1;
    }
  }

  // Count unique visitors seen today from in-memory set
  const today = new Date().toISOString().split("T")[0];
  const todayUniqueVisitors: Record<string, number> = {};

  for (const key of dailySeenVisitors) {
    if (key.includes(`:${today}:`)) {
      const parts = key.split(":");
      const pkg = parts[0];
      todayUniqueVisitors[pkg] = (todayUniqueVisitors[pkg] || 0) + 1;
    }
  }

  return {
    totalLive,
    perPackage,
    todayUniqueVisitors,
  };
}
