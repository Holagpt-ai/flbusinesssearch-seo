'use client';

import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type AgentLogRow = {
  id: string;
  agent_name: string | null;
  run_at: string;
  records_processed: number | null;
  status: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
};

type SectionId = "overview" | "logs" | "alerts" | "reports";

type ReportAggRow = {
  agent: string;
  runs: number;
  success: number;
  partial: number;
  error: number;
  records: number;
};

const LOGS_PAGE_SIZE = 25;

function formatDateInputLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateStartLocal(s: string): Date {
  const [y, mo, d] = s.split("-").map((n) => Number(n));
  return new Date(y, mo - 1, d, 0, 0, 0, 0);
}

function parseDateEndLocal(s: string): Date {
  const [y, mo, d] = s.split("-").map((n) => Number(n));
  return new Date(y, mo - 1, d, 23, 59, 59, 999);
}

function startOfTodayLocal(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function dayKeyLocal(d: Date): string {
  return formatDateInputLocal(d);
}

function shortWeekdayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function normalizeStatus(s: string | null | undefined): "success" | "partial" | "error" | "other" {
  const v = (s ?? "").toLowerCase();
  if (v === "success") return "success";
  if (v === "partial") return "partial";
  if (v === "error") return "error";
  return "other";
}

type GlobalRangePreset = "24h" | "7d" | "14d" | "30d" | "custom";

type RunsChartPoint = {
  label: string;
  key: string;
  success: number;
  partial: number;
  error: number;
  tooltipTitle: string;
};

type RecordsChartPoint = {
  label: string;
  key: string;
  records: number;
  tooltipTitle: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function hourBucketKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}-${pad2(d.getHours())}`;
}

function buildHourBucketsEndAt(end: Date): Date[] {
  const endHour = new Date(end);
  endHour.setMinutes(0, 0, 0);
  const out: Date[] = [];
  for (let i = 23; i >= 0; i -= 1) {
    const d = new Date(endHour);
    d.setHours(d.getHours() - i);
    out.push(d);
  }
  return out;
}

function getOverviewWindow(range: GlobalRangePreset, globalFrom: string, globalTo: string): { start: Date; end: Date } {
  const now = new Date();
  if (range === "24h") {
    return { start: new Date(now.getTime() - 24 * 60 * 60 * 1000), end: now };
  }
  if (range === "7d") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (range === "14d") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 13);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (range === "30d") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 29);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  let from = parseDateStartLocal(globalFrom);
  let to = parseDateEndLocal(globalTo);
  if (from.getTime() > to.getTime()) {
    const tmp = from;
    from = to;
    to = tmp;
  }
  const endCap = to.getTime() > now.getTime() ? now : to;
  return { start: from, end: endCap };
}

function globalRangeTitle(range: GlobalRangePreset, globalFrom: string, globalTo: string): string {
  if (range === "24h") return "Last 24 Hours";
  if (range === "7d") return "Last 7 Days";
  if (range === "14d") return "Last 14 Days";
  if (range === "30d") return "Last 30 Days";
  const a = parseDateStartLocal(globalFrom);
  const b = parseDateEndLocal(globalTo);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return `${a.toLocaleDateString(undefined, opts)} – ${b.toLocaleDateString(undefined, opts)}`;
}

function formatRelativeTimeAgo(d: Date): string {
  const sec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

function buildRunsChartData(
  logs: AgentLogRow[],
  range: GlobalRangePreset,
  globalFrom: string,
  globalTo: string,
): RunsChartPoint[] {
  const { start, end } = getOverviewWindow(range, globalFrom, globalTo);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const inWindow = (runAt: string) => {
    const t = new Date(runAt).getTime();
    return t >= startMs && t <= endMs;
  };

  if (range === "24h") {
    const buckets = buildHourBucketsEndAt(end);
    return buckets.map((d) => {
      const key = hourBucketKeyFromDate(d);
      const tooltipTitle = d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
      const label = d.toLocaleTimeString(undefined, { hour: "numeric" });
      let success = 0;
      let partial = 0;
      let error = 0;
      for (const row of logs) {
        if (!inWindow(row.run_at)) continue;
        const rd = new Date(row.run_at);
        if (hourBucketKeyFromDate(rd) !== key) continue;
        const st = normalizeStatus(row.status);
        if (st === "success") success += 1;
        else if (st === "partial") partial += 1;
        else if (st === "error") error += 1;
      }
      return { label, key, success, partial, error, tooltipTitle };
    });
  }

  const days: Date[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  while (cursor.getTime() <= endDay.getTime()) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days.map((d) => {
    const key = dayKeyLocal(d);
    const label =
      days.length > 14 ? `${d.getMonth() + 1}/${d.getDate()}` : `${shortWeekdayLabel(d)} ${d.getMonth() + 1}/${d.getDate()}`;
    const tooltipTitle = d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    let success = 0;
    let partial = 0;
    let error = 0;
    for (const row of logs) {
      if (!inWindow(row.run_at)) continue;
      const rd = new Date(row.run_at);
      rd.setHours(0, 0, 0, 0);
      if (dayKeyLocal(rd) !== key) continue;
      const st = normalizeStatus(row.status);
      if (st === "success") success += 1;
      else if (st === "partial") partial += 1;
      else if (st === "error") error += 1;
    }
    return { label, key, success, partial, error, tooltipTitle };
  });
}

function buildRecordsChartData(
  logs: AgentLogRow[],
  range: GlobalRangePreset,
  globalFrom: string,
  globalTo: string,
): RecordsChartPoint[] {
  const { start, end } = getOverviewWindow(range, globalFrom, globalTo);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const inWindow = (runAt: string) => {
    const t = new Date(runAt).getTime();
    return t >= startMs && t <= endMs;
  };

  if (range === "24h") {
    const buckets = buildHourBucketsEndAt(end);
    return buckets.map((d) => {
      const key = hourBucketKeyFromDate(d);
      const tooltipTitle = d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
      const label = d.toLocaleTimeString(undefined, { hour: "numeric" });
      let records = 0;
      for (const row of logs) {
        if (!inWindow(row.run_at)) continue;
        const rd = new Date(row.run_at);
        if (hourBucketKeyFromDate(rd) !== key) continue;
        records += row.records_processed ?? 0;
      }
      return { label, key, records, tooltipTitle };
    });
  }

  const days: Date[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  while (cursor.getTime() <= endDay.getTime()) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days.map((d) => {
    const key = dayKeyLocal(d);
    const label =
      days.length > 14 ? `${d.getMonth() + 1}/${d.getDate()}` : `${shortWeekdayLabel(d)} ${d.getMonth() + 1}/${d.getDate()}`;
    const tooltipTitle = d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    let records = 0;
    for (const row of logs) {
      if (!inWindow(row.run_at)) continue;
      const rd = new Date(row.run_at);
      rd.setHours(0, 0, 0, 0);
      if (dayKeyLocal(rd) !== key) continue;
      records += row.records_processed ?? 0;
    }
    return { label, key, records, tooltipTitle };
  });
}

type AgentHealthKind = "active" | "warning" | "error" | "idle";

type AgentHealthCard = {
  agent: string;
  kind: AgentHealthKind;
  statusLabel: string;
  lastRun: Date;
  lastRecords: number;
};

function buildAgentHealthCards(logs: AgentLogRow[]): AgentHealthCard[] {
  const map = new Map<string, AgentLogRow[]>();
  for (const row of logs) {
    const agent = row.agent_name?.trim() || "(unknown)";
    if (!map.has(agent)) map.set(agent, []);
    map.get(agent)!.push(row);
  }
  const idleMs = 48 * 60 * 60 * 1000;
  const now = Date.now();
  const out: AgentHealthCard[] = [];
  for (const [agent, rows] of Array.from(map.entries())) {
    const sorted = [...rows].sort((a, b) => new Date(b.run_at).getTime() - new Date(a.run_at).getTime());
    const latest = sorted[0];
    const lastRun = new Date(latest.run_at);
    const lastMs = lastRun.getTime();
    const lastRecords = latest.records_processed ?? 0;

    let kind: AgentHealthKind;
    let statusLabel: string;
    if (now - lastMs > idleMs) {
      kind = "idle";
      statusLabel = "Idle";
    } else {
      const st = normalizeStatus(latest.status);
      if (st === "error") {
        kind = "error";
        statusLabel = "Error";
      } else if (st === "partial") {
        kind = "warning";
        statusLabel = "Warning";
      } else if (st === "success") {
        kind = "active";
        statusLabel = "Active";
      } else {
        kind = "idle";
        statusLabel = "Idle";
      }
    }
    out.push({ agent, kind, statusLabel, lastRun, lastRecords });
  }
  return out.sort((a, b) => a.agent.localeCompare(b.agent));
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function buildReportRows(logs: AgentLogRow[]): ReportAggRow[] {
  const map = new Map<string, ReportAggRow>();
  for (const row of logs) {
    const agent = row.agent_name?.trim() || "(unknown)";
    const cur =
      map.get(agent) ??
      { agent, runs: 0, success: 0, partial: 0, error: 0, records: 0 };
    cur.runs += 1;
    const st = normalizeStatus(row.status);
    if (st === "success") cur.success += 1;
    else if (st === "partial") cur.partial += 1;
    else if (st === "error") cur.error += 1;
    cur.records += row.records_processed ?? 0;
    map.set(agent, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.agent.localeCompare(b.agent));
}

function downloadCsv(filename: string, rows: ReportAggRow[]) {
  const header = ["agent_name", "total_runs", "success", "partial", "error", "records_processed"];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        csvEscape(r.agent),
        String(r.runs),
        String(r.success),
        String(r.partial),
        String(r.error),
        String(r.records),
      ].join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-[#006B5E] border-t-transparent"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const st = normalizeStatus(status);
  const label = status ?? "—";
  const cls =
    st === "success"
      ? "bg-green-100 text-green-900"
      : st === "partial"
        ? "bg-orange-100 text-orange-900"
        : st === "error"
          ? "bg-red-100 text-red-900"
          : "bg-gray-100 text-gray-800";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

export default function AdminMonitoringPage() {
  const [chartsMounted, setChartsMounted] = useState(false);
  const [active, setActive] = useState<SectionId>("overview");

  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [overviewLogs, setOverviewLogs] = useState<AgentLogRow[]>([]);

  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logsRows, setLogsRows] = useState<AgentLogRow[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [agentOptions, setAgentOptions] = useState<string[]>([]);
  const [agentFilter, setAgentFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "partial" | "error">("all");
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatDateInputLocal(d);
  });
  const [toDate, setToDate] = useState<string>(() => formatDateInputLocal(new Date()));
  const [logsPage, setLogsPage] = useState(0);

  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [alertsRows, setAlertsRows] = useState<AgentLogRow[]>([]);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(() => new Set());

  const [reportADate, setReportADate] = useState<string>(() => formatDateInputLocal(new Date()));
  const [reportALoading, setReportALoading] = useState(false);
  const [reportAError, setReportAError] = useState<string | null>(null);
  const [reportARows, setReportARows] = useState<ReportAggRow[]>([]);

  const [reportBFrom, setReportBFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return formatDateInputLocal(d);
  });
  const [reportBTo, setReportBTo] = useState<string>(() => formatDateInputLocal(new Date()));
  const [reportBAgent, setReportBAgent] = useState<string>("");
  const [reportBLoading, setReportBLoading] = useState(false);
  const [reportBError, setReportBError] = useState<string | null>(null);
  const [reportBRows, setReportBRows] = useState<ReportAggRow[]>([]);

  const [globalRange, setGlobalRange] = useState<GlobalRangePreset>("7d");
  const [globalFrom, setGlobalFrom] = useState<string>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 6);
    return formatDateInputLocal(d);
  });
  const [globalTo, setGlobalTo] = useState<string>(() => formatDateInputLocal(new Date()));

  useEffect(() => {
    setChartsMounted(true);
  }, []);

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    const { start, end } = getOverviewWindow(globalRange, globalFrom, globalTo);
    const { data, error } = await supabase
      .from("agent_logs")
      .select("id, agent_name, run_at, records_processed, status, error_message, metadata")
      .gte("run_at", start.toISOString())
      .lte("run_at", end.toISOString())
      .order("run_at", { ascending: false })
      .limit(5000);
    setOverviewLoading(false);
    if (error) {
      setOverviewError(error.message);
      setOverviewLogs([]);
      return;
    }
    setOverviewLogs((data as AgentLogRow[]) ?? []);
  }, [globalFrom, globalRange, globalTo]);

  const fetchAgentNames = useCallback(async () => {
    const { data, error } = await supabase.from("agent_logs").select("agent_name").limit(5000);
    if (error) return;
    const names = Array.from(new Set((data ?? []).map((r) => r.agent_name).filter(Boolean) as string[])).sort((a, b) =>
      a.localeCompare(b),
    );
    setAgentOptions(names);
  }, []);

  const fetchLogsPage = useCallback(async () => {
    setLogsLoading(true);
    setLogsError(null);
    const from = parseDateStartLocal(fromDate).toISOString();
    const to = parseDateEndLocal(toDate).toISOString();

    let q = supabase
      .from("agent_logs")
      .select("id, agent_name, run_at, records_processed, status, error_message, metadata", { count: "exact" })
      .gte("run_at", from)
      .lte("run_at", to)
      .order("run_at", { ascending: false });

    if (agentFilter) q = q.eq("agent_name", agentFilter);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);

    const fromIdx = logsPage * LOGS_PAGE_SIZE;
    const toIdx = fromIdx + LOGS_PAGE_SIZE - 1;
    const { data, error, count } = await q.range(fromIdx, toIdx);

    setLogsLoading(false);
    if (error) {
      setLogsError(error.message);
      setLogsRows([]);
      setLogsTotal(0);
      return;
    }
    setLogsRows((data as AgentLogRow[]) ?? []);
    setLogsTotal(count ?? 0);
  }, [agentFilter, fromDate, logsPage, statusFilter, toDate]);

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    setAlertsError(null);
    const since = new Date();
    since.setDate(since.getDate() - 7);
    since.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("agent_logs")
      .select("id, agent_name, run_at, records_processed, status, error_message, metadata")
      .gte("run_at", since.toISOString())
      .in("status", ["error", "partial"])
      .order("run_at", { ascending: false })
      .limit(500);

    setAlertsLoading(false);
    if (error) {
      setAlertsError(error.message);
      setAlertsRows([]);
      return;
    }
    setAlertsRows((data as AgentLogRow[]) ?? []);
  }, []);

  useEffect(() => {
    if (active !== "overview") return;
    void fetchOverview();
  }, [active, fetchOverview]);

  useEffect(() => {
    if (active !== "logs" && active !== "reports") return;
    void fetchAgentNames();
  }, [active, fetchAgentNames]);

  useEffect(() => {
    if (active !== "logs") return;
    void fetchLogsPage();
  }, [active, fetchLogsPage]);

  useEffect(() => {
    if (active !== "alerts") return;
    void fetchAlerts();
  }, [active, fetchAlerts]);

  useEffect(() => {
    setLogsPage(0);
  }, [agentFilter, fromDate, statusFilter, toDate]);

  const overviewKpis = useMemo(() => {
    const todayStart = startOfTodayLocal().getTime();
    const last24 = Date.now() - 24 * 60 * 60 * 1000;

    const todayRows = overviewLogs.filter((r) => new Date(r.run_at).getTime() >= todayStart);
    const totalRunsToday = todayRows.length;
    const successToday = todayRows.filter((r) => normalizeStatus(r.status) === "success").length;
    const successRateToday = totalRunsToday === 0 ? 0 : Math.round((successToday / totalRunsToday) * 1000) / 10;
    const recordsToday = todayRows.reduce((sum, r) => sum + (r.records_processed ?? 0), 0);
    const activeAlerts = overviewLogs.filter((r) => {
      const t = new Date(r.run_at).getTime();
      if (t < last24) return false;
      const st = normalizeStatus(r.status);
      return st === "error" || st === "partial";
    }).length;

    return { totalRunsToday, successRateToday, recordsToday, activeAlerts };
  }, [overviewLogs]);

  const runsLast7Chart = useMemo(
    () => buildRunsChartData(overviewLogs, globalRange, globalFrom, globalTo),
    [globalFrom, globalRange, globalTo, overviewLogs],
  );

  const recordsLast14Chart = useMemo(
    () => buildRecordsChartData(overviewLogs, globalRange, globalFrom, globalTo),
    [globalFrom, globalRange, globalTo, overviewLogs],
  );

  const overviewRangeLabel = useMemo(
    () => globalRangeTitle(globalRange, globalFrom, globalTo),
    [globalFrom, globalRange, globalTo],
  );

  const runsChartEmpty = useMemo(
    () => runsLast7Chart.every((p) => p.success + p.partial + p.error === 0),
    [runsLast7Chart],
  );

  const recordsChartEmpty = useMemo(() => recordsLast14Chart.every((p) => p.records === 0), [recordsLast14Chart]);

  const agentHealthCards = useMemo(() => buildAgentHealthCards(overviewLogs), [overviewLogs]);

  const visibleAlerts = useMemo(
    () => alertsRows.filter((r) => !dismissedAlertIds.has(r.id)),
    [alertsRows, dismissedAlertIds],
  );

  const pageTitle =
    active === "overview"
      ? "Overview"
      : active === "logs"
        ? "Agent Logs"
        : active === "alerts"
          ? "Alerts"
          : "Reports";

  const generateReportA = async () => {
    setReportALoading(true);
    setReportAError(null);
    const start = parseDateStartLocal(reportADate).toISOString();
    const end = parseDateEndLocal(reportADate).toISOString();
    const { data, error } = await supabase
      .from("agent_logs")
      .select("id, agent_name, run_at, records_processed, status, error_message, metadata")
      .gte("run_at", start)
      .lte("run_at", end)
      .limit(20000);
    setReportALoading(false);
    if (error) {
      setReportAError(error.message);
      setReportARows([]);
      return;
    }
    setReportARows(buildReportRows((data as AgentLogRow[]) ?? []));
  };

  const generateReportB = async () => {
    setReportBLoading(true);
    setReportBError(null);
    const start = parseDateStartLocal(reportBFrom).toISOString();
    const end = parseDateEndLocal(reportBTo).toISOString();
    let q = supabase
      .from("agent_logs")
      .select("id, agent_name, run_at, records_processed, status, error_message, metadata")
      .gte("run_at", start)
      .lte("run_at", end)
      .limit(20000);
    if (reportBAgent) q = q.eq("agent_name", reportBAgent);
    const { data, error } = await q;
    setReportBLoading(false);
    if (error) {
      setReportBError(error.message);
      setReportBRows([]);
      return;
    }
    setReportBRows(buildReportRows((data as AgentLogRow[]) ?? []));
  };

  const exportReportACsv = () => {
    downloadCsv(`flbiz-report-${reportADate}.csv`, reportARows);
  };

  const exportReportBCsv = () => {
    downloadCsv(`flbiz-report-${reportBFrom}-to-${reportBTo}.csv`, reportBRows);
  };

  const totalPages = Math.max(1, Math.ceil(logsTotal / LOGS_PAGE_SIZE));
  const canPrev = logsPage > 0;
  const canNext = logsPage + 1 < totalPages;

  return (
    <div className="flex min-h-screen bg-[#F4F4F5] text-[#1A1A1A]">
      <aside className="w-[220px] shrink-0 bg-[#111827] text-white">
        <div className="px-5 py-6 text-sm font-bold tracking-tight">FLBusinessSearch</div>
        <nav className="px-2 pb-6">
          {(
            [
              ["overview", "Overview"],
              ["logs", "Agent Logs"],
              ["alerts", "Alerts"],
              ["reports", "Reports"],
            ] as const
          ).map(([id, label]) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActive(id)}
                className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                  isActive ? "bg-[#006B5E] text-white" : "text-gray-200 hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 p-8">
        <header className="mb-8">
          {active === "overview" ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <h1 className="text-2xl font-bold">Overview</h1>
                <div className="flex flex-col items-stretch gap-2 sm:items-end">
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["24h", "24h"],
                        ["7d", "7d"],
                        ["14d", "14d"],
                        ["30d", "30d"],
                        ["custom", "Custom"],
                      ] as const
                    ).map(([id, label]) => {
                      const selected = globalRange === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setGlobalRange(id)}
                          className={
                            selected
                              ? "rounded-lg bg-[#006B5E] px-3 py-1.5 text-xs font-semibold text-white"
                              : "rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                          }
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {globalRange === "custom" && (
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="text-xs font-semibold text-gray-600">
                        From
                        <input
                          type="date"
                          className="mt-1 block rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
                          value={globalFrom}
                          onChange={(e) => setGlobalFrom(e.target.value)}
                        />
                      </label>
                      <label className="text-xs font-semibold text-gray-600">
                        To
                        <input
                          type="date"
                          className="mt-1 block rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
                          value={globalTo}
                          onChange={(e) => setGlobalTo(e.target.value)}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <h1 className="text-2xl font-bold">{pageTitle}</h1>
          )}
        </header>

        {active === "overview" && (
          <div>
            {overviewError && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{overviewError}</p>}
            {overviewLoading ? (
              <Spinner />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm border-l-4 border-l-gray-400">
                    <div className="text-3xl font-bold text-[#1A1A1A]">{overviewKpis.totalRunsToday}</div>
                    <div className="mt-1 text-sm text-gray-500">Total runs today</div>
                    {overviewKpis.totalRunsToday === 0 && (
                      <div className="mt-1 text-xs text-gray-400">Agents haven&apos;t run today yet</div>
                    )}
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm border-l-4 border-l-[#006B5E]">
                    <div className="text-3xl font-bold text-[#1A1A1A]">{overviewKpis.successRateToday}%</div>
                    <div className="mt-1 text-sm text-gray-500">Success rate today</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm border-l-4 border-l-orange-500">
                    <div className="text-3xl font-bold text-[#1A1A1A]">{overviewKpis.recordsToday.toLocaleString()}</div>
                    <div className="mt-1 text-sm text-gray-500">Records processed today</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm border-l-4 border-l-red-500">
                    <div className="text-3xl font-bold text-[#1A1A1A]">{overviewKpis.activeAlerts}</div>
                    <div className="mt-1 text-sm text-gray-500">Active alerts (last 24h)</div>
                    {overviewKpis.activeAlerts === 0 && (
                      <div className="mt-1 text-xs text-green-600">No issues detected</div>
                    )}
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-4 text-sm font-semibold text-[#1A1A1A]">Agent Runs — {overviewRangeLabel}</h2>
                    <div className="relative h-[320px] w-full min-w-0">
                      {!chartsMounted ? (
                        <div className="h-full w-full rounded-lg bg-gray-50" />
                      ) : (
                        <>
                          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <BarChart data={runsLast7Chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                              <XAxis dataKey="label" tick={{ fill: "#6B7280", fontSize: 12 }} />
                              <YAxis allowDecimals={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
                              <Tooltip
                                cursor={{ stroke: "#006B5E", strokeDasharray: "4 4" }}
                                content={({ active, payload }) => {
                                  if (!active || !payload?.length) return null;
                                  const row = payload[0]?.payload as RunsChartPoint | undefined;
                                  if (!row) return null;
                                  return (
                                    <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-md">
                                      <div className="text-sm font-bold text-gray-900">{row.tooltipTitle}</div>
                                      <div className="mt-2 space-y-1.5 text-xs text-gray-800">
                                        <div className="flex items-center gap-2">
                                          <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#22C55E]" />
                                          <span className="font-medium">Success</span>
                                          <span className="ml-auto tabular-nums font-semibold">{row.success}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#F97316]" />
                                          <span className="font-medium">Partial</span>
                                          <span className="ml-auto tabular-nums font-semibold">{row.partial}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#EF4444]" />
                                          <span className="font-medium">Error</span>
                                          <span className="ml-auto tabular-nums font-semibold">{row.error}</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }}
                              />
                              <Legend />
                              <Bar dataKey="success" stackId="a" name="Success" fill="#22C55E" />
                              <Bar dataKey="partial" stackId="a" name="Partial" fill="#F97316" />
                              <Bar dataKey="error" stackId="a" name="Error" fill="#EF4444" />
                            </BarChart>
                          </ResponsiveContainer>
                          {runsChartEmpty && (
                            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
                              <svg
                                className="mb-2 h-8 w-8 text-gray-300"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden="true"
                              >
                                <path
                                  d="M12 8v5l3 2"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              <div className="text-sm text-gray-400">No data for this period</div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-4 text-sm font-semibold text-[#1A1A1A]">Records Processed — {overviewRangeLabel}</h2>
                    <div className="relative h-[320px] w-full min-w-0">
                      {!chartsMounted ? (
                        <div className="h-full w-full rounded-lg bg-gray-50" />
                      ) : (
                        <>
                          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <AreaChart data={recordsLast14Chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <defs>
                                <linearGradient id="tealFill" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#006B5E" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#006B5E" stopOpacity={0.05} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                              <XAxis dataKey="label" tick={{ fill: "#6B7280", fontSize: 11 }} />
                              <YAxis tick={{ fill: "#6B7280", fontSize: 12 }} />
                              <Tooltip
                                cursor={{ stroke: "#006B5E", strokeDasharray: "4 4" }}
                                content={({ active, payload }) => {
                                  if (!active || !payload?.length) return null;
                                  const row = payload[0]?.payload as RecordsChartPoint | undefined;
                                  if (!row) return null;
                                  return (
                                    <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-md">
                                      <div className="text-sm font-bold text-gray-900">{row.tooltipTitle}</div>
                                      <div className="mt-2 text-xs text-gray-800">
                                        Records processed:{" "}
                                        <span className="font-semibold tabular-nums">{row.records.toLocaleString()}</span>
                                      </div>
                                    </div>
                                  );
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="records"
                                name="Records processed"
                                stroke="#006B5E"
                                fill="url(#tealFill)"
                                strokeWidth={2}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                          {recordsChartEmpty && (
                            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
                              <svg
                                className="mb-2 h-8 w-8 text-gray-300"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden="true"
                              >
                                <path d="M4 18V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <path d="M8 18V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <path d="M12 18V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <path d="M16 18V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <path d="M20 18V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                              <div className="text-sm text-gray-400">No data for this period</div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <h2 className="text-sm font-semibold text-[#1A1A1A]">Agent Health</h2>
                  {overviewLogs.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
                      No agent data yet. Agents will appear here once they start running.
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                      {agentHealthCards.map((card) => {
                        const dotBase = "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full";
                        const dotClass =
                          card.kind === "active"
                            ? `${dotBase} animate-pulse bg-green-500`
                            : card.kind === "warning"
                              ? `${dotBase} bg-orange-500`
                              : card.kind === "error"
                                ? `${dotBase} bg-red-500`
                                : `${dotBase} bg-gray-400`;
                        return (
                          <div
                            key={card.agent}
                            className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                          >
                            <div className={dotClass} aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-[#1A1A1A]" title={card.agent}>
                                {card.agent}
                              </div>
                              <div className="text-xs text-gray-500">{card.statusLabel}</div>
                              <div className="mt-1 text-xs text-gray-400">{formatRelativeTimeAgo(card.lastRun)}</div>
                              <div className="mt-1 text-xs text-gray-400">
                                Records on last run: {card.lastRecords.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {active === "logs" && (
          <div>
            {logsError && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{logsError}</p>}

            <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <label className="text-xs font-semibold text-gray-600">
                Agent
                <select
                  className="mt-1 block w-56 rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                >
                  <option value="">All agents</option>
                  {agentOptions.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold text-gray-600">
                Status
                <select
                  className="mt-1 block w-44 rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                >
                  <option value="all">All</option>
                  <option value="success">Success</option>
                  <option value="partial">Partial</option>
                  <option value="error">Error</option>
                </select>
              </label>

              <label className="text-xs font-semibold text-gray-600">
                From
                <input
                  type="date"
                  className="mt-1 block rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </label>

              <label className="text-xs font-semibold text-gray-600">
                To
                <input
                  type="date"
                  className="mt-1 block rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </label>

              <button
                type="button"
                className="ml-auto rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 30);
                  setFromDate(formatDateInputLocal(d));
                  setToDate(formatDateInputLocal(new Date()));
                  setAgentFilter("");
                  setStatusFilter("all");
                  setLogsPage(0);
                }}
              >
                Reset filters
              </button>
            </div>

            {logsLoading ? (
              <Spinner />
            ) : logsRows.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
                No logs match the selected filters.
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Agent</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Run At</th>
                        <th className="px-4 py-3">Records</th>
                        <th className="px-4 py-3">Error Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logsRows.map((row) => (
                        <tr key={row.id} className="border-t border-gray-100">
                          <td className="px-4 py-3 font-medium">{row.agent_name ?? "—"}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="px-4 py-3 text-gray-600">{new Date(row.run_at).toLocaleString()}</td>
                          <td className="px-4 py-3 text-gray-700">{(row.records_processed ?? 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-gray-700">{row.error_message ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                  <div>
                    Page <span className="font-semibold text-gray-900">{logsPage + 1}</span> of{" "}
                    <span className="font-semibold text-gray-900">{totalPages}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!canPrev}
                      onClick={() => setLogsPage((p) => Math.max(0, p - 1))}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 font-semibold text-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={!canNext}
                      onClick={() => setLogsPage((p) => p + 1)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 font-semibold text-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {active === "alerts" && (
          <div>
            {alertsError && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{alertsError}</p>}
            {alertsLoading ? (
              <Spinner />
            ) : visibleAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
                <svg
                  className="mb-3 h-10 w-10 text-green-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path d="M8 12.5l2.5 2.5L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="text-base font-semibold text-[#1A1A1A]">All agents healthy</div>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleAlerts.map((row) => {
                  const st = normalizeStatus(row.status);
                  const border = st === "error" ? "border-l-red-500" : "border-l-orange-500";
                  return (
                    <div key={row.id} className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm border-l-4 ${border}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-bold">{row.agent_name ?? "—"}</div>
                          <div className="mt-1 text-xs text-gray-500">{new Date(row.run_at).toLocaleString()}</div>
                          <div className="mt-3 text-sm text-gray-800 whitespace-pre-wrap">{row.error_message ?? "—"}</div>
                          <div className="mt-2 text-xs text-gray-600">Records processed: {(row.records_processed ?? 0).toLocaleString()}</div>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 rounded-lg bg-[#111827] px-3 py-2 text-xs font-semibold text-white hover:bg-black"
                          onClick={() =>
                            setDismissedAlertIds((prev) => {
                              const next = new Set(prev);
                              next.add(row.id);
                              return next;
                            })
                          }
                        >
                          Acknowledge
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {active === "reports" && (
          <div className="space-y-10">
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold">Report A — Daily Summary</h2>
              <p className="mt-1 text-sm text-gray-500">Aggregate metrics for a single day.</p>

              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="text-xs font-semibold text-gray-600">
                  Date
                  <input
                    type="date"
                    className="mt-1 block rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
                    value={reportADate}
                    onChange={(e) => setReportADate(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="rounded-lg bg-[#006B5E] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                  onClick={() => void generateReportA()}
                  disabled={reportALoading}
                >
                  Generate Report
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={exportReportACsv}
                  disabled={reportARows.length === 0}
                >
                  Export CSV
                </button>
              </div>

              {reportAError && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{reportAError}</p>}
              {reportALoading ? (
                <Spinner />
              ) : (
                <div className="mt-6 overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Agent</th>
                        <th className="px-4 py-3">Total runs</th>
                        <th className="px-4 py-3">Success</th>
                        <th className="px-4 py-3">Partial</th>
                        <th className="px-4 py-3">Error</th>
                        <th className="px-4 py-3">Records processed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportARows.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-gray-500" colSpan={6}>
                            Generate a report to see results.
                          </td>
                        </tr>
                      ) : (
                        reportARows.map((r) => (
                          <tr key={r.agent} className="border-t border-gray-100">
                            <td className="px-4 py-3 font-medium">{r.agent}</td>
                            <td className="px-4 py-3">{r.runs}</td>
                            <td className="px-4 py-3">{r.success}</td>
                            <td className="px-4 py-3">{r.partial}</td>
                            <td className="px-4 py-3">{r.error}</td>
                            <td className="px-4 py-3">{r.records.toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold">Report B — Agent Performance</h2>
              <p className="mt-1 text-sm text-gray-500">Aggregate metrics over a date range.</p>

              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="text-xs font-semibold text-gray-600">
                  From
                  <input
                    type="date"
                    className="mt-1 block rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
                    value={reportBFrom}
                    onChange={(e) => setReportBFrom(e.target.value)}
                  />
                </label>
                <label className="text-xs font-semibold text-gray-600">
                  To
                  <input
                    type="date"
                    className="mt-1 block rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
                    value={reportBTo}
                    onChange={(e) => setReportBTo(e.target.value)}
                  />
                </label>
                <label className="text-xs font-semibold text-gray-600">
                  Agent
                  <select
                    className="mt-1 block w-56 rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
                    value={reportBAgent}
                    onChange={(e) => setReportBAgent(e.target.value)}
                  >
                    <option value="">All</option>
                    {agentOptions.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="rounded-lg bg-[#006B5E] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                  onClick={() => void generateReportB()}
                  disabled={reportBLoading}
                >
                  Generate Report
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={exportReportBCsv}
                  disabled={reportBRows.length === 0}
                >
                  Export CSV
                </button>
              </div>

              {reportBError && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{reportBError}</p>}
              {reportBLoading ? (
                <Spinner />
              ) : (
                <div className="mt-6 overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Agent</th>
                        <th className="px-4 py-3">Total runs</th>
                        <th className="px-4 py-3">Success</th>
                        <th className="px-4 py-3">Partial</th>
                        <th className="px-4 py-3">Error</th>
                        <th className="px-4 py-3">Records processed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportBRows.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-gray-500" colSpan={6}>
                            Generate a report to see results.
                          </td>
                        </tr>
                      ) : (
                        reportBRows.map((r) => (
                          <tr key={r.agent} className="border-t border-gray-100">
                            <td className="px-4 py-3 font-medium">{r.agent}</td>
                            <td className="px-4 py-3">{r.runs}</td>
                            <td className="px-4 py-3">{r.success}</td>
                            <td className="px-4 py-3">{r.partial}</td>
                            <td className="px-4 py-3">{r.error}</td>
                            <td className="px-4 py-3">{r.records.toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
