import { NextRequest } from "next/server";
import { AppHitStat } from "@headless/database";

// In-Memory Hit Buffer to prevent MongoDB write spam
interface HitAccumulator {
  packageName: string;
  date: string;
  endpoints: Record<string, number>;
  total: number;
}

const hitBuffer = new Map<string, HitAccumulator>();
let flushTimer: NodeJS.Timeout | null = null;
let isFlushing = false;

async function flushHitsToDatabase() {
  if (isFlushing || hitBuffer.size === 0 || !AppHitStat) return;
  isFlushing = true;

  const currentBatch = Array.from(hitBuffer.values());
  hitBuffer.clear();

  try {
    const ops = currentBatch.map((item) => {
      const incFields: Record<string, number> = { totalHits: item.total };
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

    const today = new Date().toISOString().split("T")[0];
    const cleanEndpoint = endpointName.replace(/^\/+/, "").replace(/\//g, "_") || "api";
    const key = `${packageName}:${today}`;

    let item = hitBuffer.get(key);
    if (!item) {
      item = {
        packageName,
        date: today,
        endpoints: {},
        total: 0,
      };
      hitBuffer.set(key, item);
    }

    item.total += 1;
    item.endpoints[cleanEndpoint] = (item.endpoints[cleanEndpoint] || 0) + 1;
  } catch (e) {
    // Fail silently
  }
}

