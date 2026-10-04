import { NextRequest } from "next/server";
import { initApi, successResponse, errorResponse, authenticateRequest, authorizeRoles } from "../../../../lib/api-helper";
import { AppHitStat, AppConfig } from "@headless/database";
import { getLiveVisitorStats } from "../../../../lib/hit-tracker";

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

    // 1. Get all hit stats within range from MongoDB
    const rawStats = await AppHitStat.find(matchQuery).sort({ date: 1 });

    // 2. Real-time Live & In-memory Visitor Counts
    const liveStats = getLiveVisitorStats(5 * 60 * 1000); // 5 min active window

    // 3. Platform aggregates
    const totalHits = rawStats.reduce((sum, item) => sum + (item.totalHits || 0), 0);
    const totalUniqueVisitors = rawStats.reduce((sum, item) => sum + (item.uniqueVisitors || 0), 0);

    const todayStr = new Date().toISOString().split("T")[0];
    const todayHits = rawStats
      .filter((s) => s.date === todayStr)
      .reduce((sum, item) => sum + (item.totalHits || 0), 0);

    // 4. Per App Summary
    interface AppSummary {
      packageName: string;
      totalHits: number;
      todayHits: number;
      todayVisitors: number;
      liveVisitors: number;
      hitsPerVisitor: number;
      lastHitAt: Date | null;
      endpoints: Record<string, number>;
    }

    const appMap: Record<string, AppSummary> = {};

    // Seed registered apps list
    const registeredApps = await AppConfig.find({}).select("packageName");
    registeredApps.forEach((app) => {
      appMap[app.packageName] = {
        packageName: app.packageName,
        totalHits: 0,
        todayHits: 0,
        todayVisitors: 0,
        liveVisitors: 0,
        hitsPerVisitor: 0,
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
          todayVisitors: 0,
          liveVisitors: 0,
          hitsPerVisitor: 0,
          lastHitAt: null,
          endpoints: {},
        };
      }

      appMap[pkg].totalHits += stat.totalHits || 0;

      if (stat.date === todayStr) {
        appMap[pkg].todayHits += stat.totalHits || 0;
        appMap[pkg].todayVisitors += stat.uniqueVisitors || 0;
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

    // Merge live visitor counts & instant memory today unique counts
    for (const [pkg, appData] of Object.entries(appMap)) {
      const liveCount = liveStats.perPackage[pkg] || 0;
      const memTodayVisitors = liveStats.todayUniqueVisitors[pkg] || 0;

      appData.liveVisitors = liveCount;
      appData.todayVisitors = Math.max(appData.todayVisitors, memTodayVisitors, liveCount);
      appData.hitsPerVisitor = appData.todayVisitors > 0 ? Number((appData.todayHits / appData.todayVisitors).toFixed(1)) : 0;
    }

    const appSummaries = Object.values(appMap).sort((a, b) => b.liveVisitors - a.liveVisitors || b.todayHits - a.todayHits);

    // Calculate Platform Today Unique Visitors
    const platformTodayVisitors = Math.max(
      appSummaries.reduce((sum, a) => sum + a.todayVisitors, 0),
      liveStats.totalLive
    );

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
      let dayVisitors = dayStats.reduce((sum, item) => sum + (item.uniqueVisitors || 0), 0);

      if (dStr === todayStr) {
        dayVisitors = Math.max(dayVisitors, platformTodayVisitors);
      }

      const appBreakdown: Record<string, number> = {};
      const appVisitorBreakdown: Record<string, number> = {};

      dayStats.forEach((s) => {
        appBreakdown[s.packageName] = (appBreakdown[s.packageName] || 0) + (s.totalHits || 0);
        appVisitorBreakdown[s.packageName] = (appVisitorBreakdown[s.packageName] || 0) + (s.uniqueVisitors || 0);
      });

      return {
        date: dStr,
        totalHits: dayHits,
        uniqueVisitors: dayVisitors,
        apps: appBreakdown,
        appVisitors: appVisitorBreakdown,
      };
    });

    return successResponse({
      summary: {
        totalHits,
        todayHits,
        totalLiveVisitors: liveStats.totalLive,
        todayVisitors: platformTodayVisitors,
        totalUniqueVisitors,
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
