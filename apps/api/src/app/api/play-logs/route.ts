import { NextRequest } from "next/server";
import { initApi, successResponse, errorResponse, authenticateRequest, authorizeRoles } from "../../../lib/api-helper";
import { PlayLog } from "@headless/database";

export async function GET(req: NextRequest) {
  try {
    await initApi();
    const userPayload = await authenticateRequest(req);
    if (!userPayload || !authorizeRoles(userPayload.role, "Moderator")) {
      return errorResponse("Unauthorized access", 403);
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const q = searchParams.get("q")?.trim();
    const packageName = searchParams.get("packageName")?.trim();

    const query: any = {};

    if (q) {
      query.$or = [
        { vid: { $regex: q, $options: "i" } },
        { title: { $regex: q, $options: "i" } },
        { playUrl: { $regex: q, $options: "i" } },
      ];
    }

    if (packageName) {
      query.packageName = packageName;
    }

    const skip = (page - 1) * limit;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const PlayLogModel = PlayLog as any;

    // Parallel execution of pagination and summary queries with lean & aggregation optimization
    const [rawLogs, totalHits, todayHits, uniqueTracksRes, uniqueApps] = await Promise.all([
      PlayLogModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PlayLogModel.estimatedDocumentCount().catch(() => PlayLogModel.countDocuments()),
      PlayLogModel.countDocuments({ createdAt: { $gte: startOfToday } }),
      PlayLogModel.aggregate([
        { $group: { _id: "$vid" } },
        { $count: "total" }
      ]).catch(() => []),
      PlayLogModel.distinct("packageName").catch(() => []),
    ]);

    const total = Object.keys(query).length > 0
      ? await PlayLogModel.countDocuments(query)
      : totalHits;

    const uniqueTracksCount = (uniqueTracksRes && uniqueTracksRes[0] && uniqueTracksRes[0].total) || 0;

    const logs = (rawLogs || []).map((log: any) => ({
      id: log._id ? log._id.toString() : "",
      vid: log.vid || "",
      title: log.title || "YouTube Track",
      artist: log.artist || "YouTube Video",
      playUrl: log.playUrl || "",
      packageName: log.packageName || "Default App",
      userId: log.userId || null,
      ipAddress: log.ipAddress || "Unknown IP",
      userAgent: log.userAgent || "Unknown Client",
      createdAt: log.createdAt || new Date(),
    }));

    return successResponse({
      logs,
      pagination: {
        total: total || 0,
        page,
        limit,
        pages: Math.ceil((total || 0) / limit) || 1,
      },
      summary: {
        totalHits: totalHits || 0,
        todayHits: todayHits || 0,
        uniqueTracksCount: uniqueTracksCount || 0,
        uniqueAppsCount: Array.isArray(uniqueApps) ? uniqueApps.length : 0,
      },
    });
  } catch (error: any) {
    return errorResponse(error.message || "Internal server error", 500);
  }
}
