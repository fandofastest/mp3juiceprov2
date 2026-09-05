import { NextRequest } from "next/server";
import { initApi, successResponse, errorResponse, authenticateRequest, authorizeRoles } from "../../../../lib/api-helper";
import { AppHitStat as ImportedAppHitStat, AppConfig } from "@headless/database";
import mongoose from "mongoose";

const getAppHitStatModel = () => {
  if (ImportedAppHitStat) return ImportedAppHitStat;
  return mongoose.models.AppHitStat || mongoose.model("AppHitStat");
};

export async function GET(req: NextRequest) {
  try {
    await initApi();
    const userPayload = await authenticateRequest(req);
    if (!userPayload || !authorizeRoles(userPayload.role, "Moderator")) {
      return errorResponse("Unauthorized access", 403);
    }

    const { searchParams } = new URL(req.url);
    const packageNameFilter = searchParams.get("packageName")?.trim();
    const days = parseInt(searchParams.get("days") || "7");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    const startDateStr = startDate.toISOString().split("T")[0];

    const matchQuery: any = {
      date: { $gte: startDateStr },
    };
    if (packageNameFilter) {
      matchQuery.packageName = packageNameFilter;
    }

    // 1. Get all hit stats within range
    const AppHitStatModel = getAppHitStatModel();
    const rawStats = await AppHitStatModel.find(matchQuery).sort({ date: 1 });

    // 2. Total platform hits in range
    const totalHits = rawStats.reduce((sum, item) => sum + (item.totalHits || 0), 0);

    // 3. Today's hits
    const todayStr = new Date().toISOString().split("T")[0];
    const todayHits = rawStats
      .filter((s) => s.date === todayStr)
      .reduce((sum, item) => sum + (item.totalHits || 0), 0);

    // 4. Per App Summary
    const appMap: Record<string, { packageName: string; totalHits: number; todayHits: number; lastHitAt: Date | null; endpoints: Record<string, number> }> = {};

    // Get registered apps list for complete picture
    const registeredApps = await AppConfig.find({}).select("packageName");
    registeredApps.forEach((app) => {
      appMap[app.packageName] = {
        packageName: app.packageName,
        totalHits: 0,
        todayHits: 0,
        lastHitAt: null,
        endpoints: {},
      };
    });

    rawStats.forEach((stat) => {
      const pkg = stat.packageName || "com.mp3juice.mp3juicepro";
      if (!appMap[pkg]) {
        appMap[pkg] = {
          packageName: pkg,
          totalHits: 0,
          todayHits: 0,
          lastHitAt: null,
          endpoints: {},
        };
      }

      appMap[pkg].totalHits += stat.totalHits || 0;
      if (stat.date === todayStr) {
        appMap[pkg].todayHits += stat.totalHits || 0;
      }

      if (!appMap[pkg].lastHitAt || (stat.lastHitAt && new Date(stat.lastHitAt) > new Date(appMap[pkg].lastHitAt!))) {
        appMap[pkg].lastHitAt = stat.lastHitAt;
      }

      // Aggregate endpoint breakdowns
      if (stat.endpoints) {
        if (stat.endpoints instanceof Map) {
          stat.endpoints.forEach((count: number, ep: string) => {
            appMap[pkg].endpoints[ep] = (appMap[pkg].endpoints[ep] || 0) + (count || 0);
          });
        } else if (typeof stat.endpoints === "object") {
          Object.entries(stat.endpoints).forEach(([ep, count]: [string, any]) => {
            appMap[pkg].endpoints[ep] = (appMap[pkg].endpoints[ep] || 0) + (Number(count) || 0);
          });
        }
      }
    });

    const appSummaries = Object.values(appMap).sort((a, b) => b.totalHits - a.totalHits);

    // 5. Daily Trend Chart Data (Last N days)
    const datesList: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      datesList.push(d.toISOString().split("T")[0]);
    }

    const chartData = datesList.map((dStr) => {
      const dayStats = rawStats.filter((s) => s.date === dStr);
      const dayHits = dayStats.reduce((sum, item) => sum + (item.totalHits || 0), 0);
      const appBreakdown: Record<string, number> = {};
      dayStats.forEach((s) => {
        appBreakdown[s.packageName] = (appBreakdown[s.packageName] || 0) + (s.totalHits || 0);
      });
      return {
        date: dStr,
        totalHits: dayHits,
        apps: appBreakdown,
      };
    });

    return successResponse({
      summary: {
        totalHits,
        todayHits,
        totalApps: appSummaries.length,
      },
      apps: appSummaries,
      chartData,
    });
  } catch (error: any) {
    console.error("[AppHitsRoute Error]", error);
    return errorResponse(error.message || "Internal server error", 500);
  }
}
