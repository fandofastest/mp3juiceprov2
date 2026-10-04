"use client";

import { useEffect, useState, useRef } from "react";
import { apiRequest } from "../../lib/api-client";
import { 
  Activity, Flame, Smartphone, BarChart3, RefreshCw, Calendar, Search, 
  Layers, Users, Radio, Zap, ArrowUpRight, CheckCircle2, Server, Eye
} from "lucide-react";

export default function AppStatsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<number>(7);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [chartMode, setChartMode] = useState<"visitors" | "hits">("visitors");
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStats = (selectedDays = days, isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    apiRequest(`/stats/app-hits?days=${selectedDays}`)
      .then((res) => {
        setData(res);
        setLoading(false);
        setRefreshing(false);
      })
      .catch((err) => {
        if (!isSilent) {
          setError(err.message || "Failed to load app visitor statistics");
        }
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    fetchStats(days);
  }, [days]);

  // Auto-refresh interval for live real-time stats
  useEffect(() => {
    if (autoRefresh) {
      autoRefreshTimerRef.current = setInterval(() => {
        fetchStats(days, true);
      }, 8000); // Poll every 8s silently
    } else if (autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current);
    }

    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
    };
  }, [autoRefresh, days]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-stone-400 text-sm font-medium">Memuat statistik live dan pengunjung harian aplikasi...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Gagal Memuat Data</h3>
          <p className="text-sm text-red-300/80 mt-1">{error}</p>
        </div>
        <button 
          onClick={() => fetchStats()}
          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm font-semibold transition"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  const { summary, apps = [], chartData = [] } = data || {};

  const filteredApps = apps.filter((app: any) =>
    app.packageName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalLive = summary?.totalLiveVisitors || 0;
  const todayVisitors = summary?.todayVisitors || 0;
  const todayHits = summary?.todayHits || 0;
  const totalHits = summary?.totalHits || 0;
  const avgHitsPerUser = todayVisitors > 0 ? (todayHits / todayVisitors).toFixed(1) : "0.0";

  const statCards = [
    { 
      name: "Pengunjung Live Online", 
      value: totalLive.toLocaleString(), 
      sub: "Aktif dalam 5 menit terakhir",
      icon: Radio, 
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      badge: "LIVE",
      pulse: true
    },
    { 
      name: "Pengunjung Hari Ini (DAU)", 
      value: todayVisitors.toLocaleString(), 
      sub: "Unique visitors terdeteksi",
      icon: Users, 
      color: "text-blue-400",
      bgColor: "bg-blue-500/10"
    },
    { 
      name: "Hit Request Hari Ini", 
      value: todayHits.toLocaleString(), 
      sub: "Total traffic request API",
      icon: Flame, 
      color: "text-amber-400",
      bgColor: "bg-amber-500/10"
    },
    { 
      name: "Rata-rata Hit / Pengunjung", 
      value: `${avgHitsPerUser}x`, 
      sub: "Tingkat aktivitas per user",
      icon: Zap, 
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10"
    },
    { 
      name: "Total Hit Platform", 
      value: totalHits.toLocaleString(), 
      sub: `${days} hari terakhir`,
      icon: Activity, 
      color: "text-purple-400",
      bgColor: "bg-purple-500/10"
    },
  ];

  // Chart max values
  const maxVisitorsChart = Math.max(...chartData.map((d: any) => d.uniqueVisitors || 0), 1);
  const maxHitsChart = Math.max(...chartData.map((d: any) => d.totalHits || 0), 1);
  const currentChartMax = chartMode === "visitors" ? maxVisitorsChart : maxHitsChart;

  return (
    <div className="space-y-8">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Statistik Pengunjung & Hit</h1>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Real-time
            </span>
          </div>
          <p className="text-sm text-stone-400 mt-1">
            Pantau pengunjung unik harian (DAU), user yang sedang live online, dan beban request per aplikasi client.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              autoRefresh 
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                : "bg-stone-900 text-stone-500 border-stone-800 hover:text-stone-300"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-emerald-400 animate-pulse" : "bg-stone-600"}`} />
            Auto-refresh {autoRefresh ? "Aktif (8s)" : "Mati"}
          </button>

          {/* Days Filter */}
          <div className="flex items-center bg-stone-900 border border-stone-800 rounded-xl p-1">
            <button
              onClick={() => setDays(7)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                days === 7 ? "bg-emerald-500 text-white shadow" : "text-stone-400 hover:text-white"
              }`}
            >
              7 Hari
            </button>
            <button
              onClick={() => setDays(30)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                days === 30 ? "bg-emerald-500 text-white shadow" : "text-stone-400 hover:text-white"
              }`}
            >
              30 Hari
            </button>
          </div>

          <button
            onClick={() => fetchStats()}
            disabled={refreshing}
            className="p-2.5 bg-stone-900 hover:bg-stone-800 border border-stone-800 rounded-xl text-stone-300 hover:text-white transition flex items-center gap-2 text-xs font-semibold"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-emerald-400" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="p-5 rounded-2xl bg-stone-900 border border-stone-800 flex flex-col justify-between hover:border-stone-700 transition">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">{card.name}</span>
                <div className={`p-2 rounded-xl ${card.bgColor} relative`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                  {card.pulse && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-white tracking-tight truncate">{card.value}</p>
                <div className="flex items-center gap-1 mt-1 text-[11px] text-stone-400 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-stone-500" />
                  <span>{card.sub}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Trend Chart */}
      <div className="p-6 rounded-2xl bg-stone-900 border border-stone-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-sm font-bold text-stone-300 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              Tren {chartMode === "visitors" ? "Pengunjung Harian (Unique Visitors)" : "Volume Hit API"} ({days} Hari Terakhir)
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              {chartMode === "visitors" 
                ? "Jumlah pengguna unik berbeda yang membuka aplikasi per hari" 
                : "Total akumulasi request API yang dieksekusi client"}
            </p>
          </div>

          {/* Chart Mode Toggle */}
          <div className="flex items-center bg-stone-950 border border-stone-800 rounded-xl p-1 self-start sm:self-auto">
            <button
              onClick={() => setChartMode("visitors")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
                chartMode === "visitors" 
                  ? "bg-blue-600 text-white shadow" 
                  : "text-stone-400 hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Pengunjung (DAU)
            </button>
            <button
              onClick={() => setChartMode("hits")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
                chartMode === "hits" 
                  ? "bg-emerald-600 text-white shadow" 
                  : "text-stone-400 hover:text-white"
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Volume Hit
            </button>
          </div>
        </div>

        <div className="h-64 flex items-end justify-between gap-3 pt-8 pb-2 border-b border-stone-800/80">
          {chartData.map((d: any, idx: number) => {
            const currentVal = chartMode === "visitors" ? (d.uniqueVisitors || 0) : (d.totalHits || 0);
            const heightPercent = currentChartMax > 0 ? (currentVal / currentChartMax) * 100 : 0;
            const dateFormatted = d.date.split("-").slice(1).join("/");

            const gradientClasses = chartMode === "visitors"
              ? "bg-gradient-to-t from-blue-600/40 to-blue-400/80 group-hover:from-blue-500 group-hover:to-cyan-300"
              : "bg-gradient-to-t from-emerald-600/40 to-emerald-400/80 group-hover:from-emerald-500 group-hover:to-emerald-300";

            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                <div className="w-full flex flex-col justify-end items-center h-48 relative">
                  {/* Tooltip */}
                  <div className="absolute -top-12 bg-stone-800 border border-stone-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition duration-200 pointer-events-none whitespace-nowrap z-20 shadow-xl flex flex-col gap-0.5">
                    <span className="text-stone-400 text-[10px]">{d.date}</span>
                    <span className="text-blue-400">{d.uniqueVisitors?.toLocaleString() || 0} Pengunjung</span>
                    <span className="text-emerald-400">{d.totalHits?.toLocaleString() || 0} Hits</span>
                  </div>
                  {/* Bar */}
                  <div 
                    style={{ height: `${Math.max(heightPercent, 4)}%` }}
                    className={`w-full max-w-[48px] ${gradientClasses} rounded-t-md transition-all duration-300 shadow-sm`}
                  />
                </div>
                <span className="text-[11px] font-mono text-stone-400 group-hover:text-white transition">
                  {dateFormatted}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* App Client Breakdown List */}
      <div className="p-6 rounded-2xl bg-stone-900 border border-stone-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-emerald-400" />
              Rincian Pengunjung & Hit Per Aplikasi
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              Daftar live active users, pengunjung unik hari ini, dan distribusi traffic tiap package name.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Cari Package Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-stone-950 border border-stone-800 rounded-xl text-white placeholder-stone-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>
        </div>

        {/* Table / List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-800 text-stone-400 text-xs uppercase tracking-wider">
                <th className="py-3.5 px-4 font-bold">Aplikasi / Package Name</th>
                <th className="py-3.5 px-4 font-bold text-center">Live Online</th>
                <th className="py-3.5 px-4 font-bold">Pengunjung Hari Ini</th>
                <th className="py-3.5 px-4 font-bold">Hit Hari Ini</th>
                <th className="py-3.5 px-4 font-bold">Rasio Hit/User</th>
                <th className="py-3.5 px-4 font-bold">Total Hit ({days}D)</th>
                <th className="py-3.5 px-4 font-bold">Distribusi Endpoint</th>
                <th className="py-3.5 px-4 font-bold text-right">Terakhir Aktif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-stone-500 text-sm">
                    Tidak ada data aplikasi yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredApps.map((app: any, idx: number) => {
                  const percentOfTotal = summary.totalHits > 0 
                    ? Math.round((app.totalHits / summary.totalHits) * 100) 
                    : 0;

                  return (
                    <tr key={idx} className="hover:bg-stone-800/30 transition group">
                      {/* Package Name */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-emerald-400 font-bold text-xs uppercase shadow-sm">
                            {app.packageName.slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-mono font-bold text-white group-hover:text-emerald-400 transition text-sm">
                              {app.packageName}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-stone-400 font-medium">
                                Share Traffic: <strong className="text-emerald-400">{percentOfTotal}%</strong>
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Live Online Badge */}
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition ${
                          app.liveVisitors > 0 
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm" 
                            : "bg-stone-800/80 text-stone-500"
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${app.liveVisitors > 0 ? "bg-emerald-400 animate-pulse" : "bg-stone-600"}`} />
                          {app.liveVisitors > 0 ? `${app.liveVisitors} Online` : "0"}
                        </span>
                      </td>

                      {/* Today Visitors */}
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <Users className="w-3.5 h-3.5" />
                          {app.todayVisitors?.toLocaleString() || "0"}
                        </span>
                      </td>

                      {/* Today Hits */}
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          app.todayHits > 0 ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-stone-800 text-stone-500"
                        }`}>
                          {app.todayHits > 0 && <Flame className="w-3 h-3 fill-amber-400" />}
                          {app.todayHits.toLocaleString()}
                        </span>
                      </td>

                      {/* Hits Per User */}
                      <td className="py-4 px-4">
                        <span className="text-xs font-mono font-medium text-cyan-300">
                          {app.hitsPerVisitor ? `${app.hitsPerVisitor}x` : "-"}
                        </span>
                      </td>

                      {/* Total Hits */}
                      <td className="py-4 px-4">
                        <span className="font-mono font-bold text-white text-base">
                          {app.totalHits.toLocaleString()}
                        </span>
                      </td>

                      {/* Endpoints Breakdown */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {Object.entries(app.endpoints || {}).length === 0 ? (
                            <span className="text-xs text-stone-500 italic">Belum ada aktivitas</span>
                          ) : (
                            Object.entries(app.endpoints || {}).map(([ep, count]: [string, any], epIdx) => (
                              <span 
                                key={epIdx} 
                                className="px-2 py-0.5 rounded-md bg-stone-950 border border-stone-800 text-[11px] font-mono text-stone-300 flex items-center gap-1"
                              >
                                <span className="text-emerald-400 font-semibold">/{ep}:</span>
                                <span>{count}</span>
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      {/* Last Active */}
                      <td className="py-4 px-4 text-right">
                        <span className="text-xs text-stone-400 font-mono">
                          {app.lastHitAt 
                            ? new Date(app.lastHitAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" })
                            : "-"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
