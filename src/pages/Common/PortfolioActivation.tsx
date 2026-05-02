import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";

const API_BASE    = import.meta.env.VITE_API_BASE_URL as string;
const WS_BASE     = import.meta.env.VITE_WS_BASE_URL as string ?? "ws://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrokerConfig { _id: string; name: string; broker_type: string; user_id?: string; }

interface PreparedStrategy {
  source_strategy_id: string;
  assigned_strategy_id: string;
  number_of_executions: number;
  ticker?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function padTs(n: number) { return String(n).padStart(2, "0"); }

function formatActivationTs(d: Date): string {
  return `${d.getFullYear()}-${padTs(d.getMonth()+1)}-${padTs(d.getDate())} ${padTs(d.getHours())}:${padTs(d.getMinutes())}:${padTs(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3,"0")}000`;
}

function parseTimeTo24hHMS(timeStr: string): string {
  // "09:15 AM" / "09:15 PM" → "09:15:59" / "21:15:59"
  const ampm = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = ampm[2];
    const period = ampm[4].toUpperCase();
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${m}:59`;
  }
  // "09:15" or "09:15:30" → "09:15:59"
  const hm = timeStr.match(/^(\d{2}:\d{2})(?::\d{2})?$/);
  if (hm) return `${hm[1]}:59`;
  return timeStr;
}

function buildStrategyDateTime(baseDate: string, timeStr: string): string {
  if (!timeStr) return "";
  // already full datetime "2025-11-03 09:15:59"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(timeStr)) return timeStr;
  const datePart = baseDate ? baseDate.split("T")[0].split(" ")[0] : new Date().toISOString().slice(0, 10);
  return `${datePart} ${parseTimeTo24hHMS(timeStr)}`;
}

const ALL_DAYS = ["M", "T", "W", "Th", "F", "Sa", "Su"] as const;
type Day = (typeof ALL_DAYS)[number];
type FilterMode = "Weekdays" | "DTE";

interface StrategyRow {
  id: string; name: string; underlying: string; product: string;
  entry_time: string; exit_time: string;
  weekdays: Day[]; dte: number[];
  qty_multiplier: number; slippage: number; checked: boolean;
}
interface PortfolioData {
  _id?: string; name?: string; qty_multiplier?: number; is_weekdays?: boolean;
  strategies?: Array<{
    _id?: string; id?: string; name?: string; underlying?: string; product?: string;
    entry_time?: string; exit_time?: string; weekdays?: Day[]; dte?: number[];
    qty_multiplier?: number; slippage?: number; checked?: boolean;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt12h(hour: number, minute: number): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h    = hour % 12 || 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${ampm}`;
}

function extractTimeFromIndicators(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  if (n.IndicatorName === "IndicatorType.TimeIndicator") {
    const p = n.Parameters as { Hour?: number; Minute?: number } | undefined;
    if (p?.Hour != null) return fmt12h(Number(p.Hour), Number(p.Minute ?? 0));
  }
  if (n.Value && !Array.isArray(n.Value)) return extractTimeFromIndicators(n.Value);
  if (Array.isArray(n.Value)) {
    for (const child of n.Value) { const t = extractTimeFromIndicators(child); if (t) return t; }
  }
  return "";
}

// Avatar color palette — deterministic by string hash
const AVATAR_COLORS = [
  { bg: "bg-blue-100",   text: "text-blue-600"   },
  { bg: "bg-pink-100",   text: "text-pink-600"   },
  { bg: "bg-teal-100",   text: "text-teal-600"   },
  { bg: "bg-orange-100", text: "text-orange-600" },
  { bg: "bg-violet-100", text: "text-violet-600" },
  { bg: "bg-green-100",  text: "text-green-600"  },
  { bg: "bg-red-100",    text: "text-red-600"    },
  { bg: "bg-sky-100",    text: "text-sky-600"    },
];

function avatarColor(idx: number) { return AVATAR_COLORS[idx % AVATAR_COLORS.length]; }

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PortfolioActivation() {
  const { portfolioId, status, currentDatetime } = useParams<{
    portfolioId: string; status: string; currentDatetime: string;
  }>();
  const navigate = useNavigate();

  const activationMode  = status ?? "fast-forward";
  const decodedDatetime = decodeURIComponent(currentDatetime ?? "");

  const [portfolioName, setPortfolioName] = useState("");
  const [rows, setRows]                   = useState<StrategyRow[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState("");
  const [activating, setActivating]       = useState(false);
  const [saving, setSaving]               = useState(false);
  const [toast, setToast]                 = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [filterMode, setFilterMode]       = useState<FilterMode>("Weekdays");
  const [portfolioQty, setPortfolioQty]   = useState(1);
  const [search, setSearch]               = useState("");
  const [brokers, setBrokers]             = useState<BrokerConfig[]>([]);
  const [selectedBroker, setSelectedBroker] = useState<BrokerConfig | null>(null);
  const [brokerError, setBrokerError]     = useState(false);
  const toastRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsExecuteRef  = useRef<WebSocket | null>(null);
  const wsUpdateRef   = useRef<WebSocket | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // WebSocket connections — reconnect on page refresh with user_id from localStorage
  useEffect(() => {
    const userId = localStorage.getItem("user_id") ?? "";
    const params = `user_id=${encodeURIComponent(userId)}&activation_mode=${encodeURIComponent(activationMode)}`;

    const wsExecute = new WebSocket(`${WS_BASE}/algo/ws/execute-orders?${params}`);
    wsExecuteRef.current = wsExecute;

    const wsUpdate = new WebSocket(`${WS_BASE}/algo/ws/update?${params}`);
    wsUpdateRef.current = wsUpdate;

    return () => {
      wsExecute.close();
      wsUpdate.close();
    };
  }, [activationMode]);

  useEffect(() => {
    fetch(`${API_BASE}/broker-configurations?broker_type=${encodeURIComponent(activationMode)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: { records?: BrokerConfig[] }) => setBrokers(Array.isArray(data?.records) ? data.records : []))
      .catch(() => setBrokers([]));
  }, [activationMode]);

  useEffect(() => {
    if (!portfolioId) return;
    setLoading(true);
    fetch(`${API_BASE}/portfolio/${encodeURIComponent(portfolioId)}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(async (data: ({ portfolio?: PortfolioData } & PortfolioData)) => {
        const p: PortfolioData = data?.portfolio ?? data ?? {};
        setPortfolioName(p.name ?? "Portfolio");
        setPortfolioQty(p.qty_multiplier ?? 1);
        setFilterMode(p.is_weekdays === false ? "DTE" : "Weekdays");

        const baseRows: StrategyRow[] = (p.strategies ?? []).map(s => ({
          id: String(s._id ?? s.id ?? ""),
          name: s.name ?? "Untitled",
          underlying: s.underlying ?? "NIFTY",
          product: s.product ?? "INTRADAY",
          entry_time: s.entry_time ?? "",
          exit_time: s.exit_time ?? "",
          weekdays: s.weekdays ?? ["M", "T", "W", "Th", "F"],
          dte: s.dte ?? [0],
          qty_multiplier: s.qty_multiplier ?? 1,
          slippage: s.slippage ?? 0,
          checked: s.checked !== false,
        }));
        setRows(baseRows);

        const results = await Promise.all(
          baseRows.map(row =>
            row.id
              ? fetch(`${API_BASE}/strategy/${encodeURIComponent(row.id)}`)
                  .then(r => r.ok ? r.json() : null).catch(() => null)
              : Promise.resolve(null)
          )
        );
        setRows(prev => prev.map((row, i) => {
          const detail = results[i];
          if (!detail) return row;
          const fc  = detail?.full_config?.strategy ?? {};
          const et  = row.entry_time || detail.entry_time || extractTimeFromIndicators(fc.EntryIndicators) || "";
          const xt  = row.exit_time  || detail.exit_time  || extractTimeFromIndicators(fc.ExitIndicators)  || "";
          return { ...row, name: detail.name ?? row.name, underlying: detail.underlying ?? row.underlying, entry_time: et, exit_time: xt };
        }));
      })
      .catch(() => setError("Failed to load portfolio."))
      .finally(() => setLoading(false));
    return () => { if (toastRef.current) clearTimeout(toastRef.current); };
  }, [portfolioId]);

  // ── derived
  const filteredRows = rows.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.underlying.toLowerCase().includes(search.toLowerCase()));
  const selectedRows = rows.filter(r => r.checked);
  const allChecked   = rows.length > 0 && rows.every(r => r.checked);
  const someChecked  = rows.some(r => r.checked) && !allChecked;

  // ── handlers
  const toggleAll  = () => setRows(p => p.map(r => ({ ...r, checked: !allChecked })));
  const toggleRow  = (id: string) => setRows(p => p.map(r => r.id === id ? { ...r, checked: !r.checked } : r));
  const changeGQty = (d: number) => setPortfolioQty(p => Math.max(1, Math.min(100, p + d)));
  const changeRQty = (id: string, d: number) => setRows(p => p.map(r => r.id !== id ? r : { ...r, qty_multiplier: Math.max(1, Math.min(100, r.qty_multiplier + d)) }));
  const toggleDay  = (id: string, day: Day) => setRows(p => p.map(r => {
    if (r.id !== id) return r;
    const has = r.weekdays.includes(day);
    return { ...r, weekdays: has ? r.weekdays.filter(d => d !== day) : [...r.weekdays, day] };
  }));

  const handleSave = async () => {
    if (!portfolioId) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/portfolio/save`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolio_id: portfolioId, name: portfolioName,
          strategy_ids: rows.map(r => r.id),
          strategies: rows.map(r => ({ id: r.id, checked: r.checked, qty_multiplier: r.qty_multiplier, slippage: r.slippage, weekdays: r.weekdays, dte: r.dte })),
          qty_multiplier: portfolioQty, is_weekdays: filterMode === "Weekdays",
        }),
      });
      if (!res.ok) throw new Error();
      showToast("Portfolio updated successfully.");
    } catch { showToast("Failed to update portfolio", "error"); }
    finally { setSaving(false); }
  };

  const handleActivate = async () => {
    if (!selectedBroker) { setBrokerError(true); showToast("Please select broker.", "error"); return; }
    if (selectedRows.length === 0) { showToast("Select at least one strategy to activate.", "error"); return; }
    setActivating(true);
    try {
      // Step 1: prepare-activation — assigns executed strategy IDs server-side
      const prepareRes = await fetch(`${API_BASE}/portfolio/prepare-activation`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolio_id: portfolioId,
          activation_mode: activationMode,
          strategies: selectedRows.map(r => ({
            strategy_id: r.id,
            name: r.name,
            broker: selectedBroker._id,
            qty_multiplier: r.qty_multiplier * portfolioQty,
            ticker: r.underlying?.toUpperCase() ?? "NIFTY",
          })),
        }),
      });
      if (!prepareRes.ok) { const d = await prepareRes.json().catch(() => ({})); throw new Error((d as { detail?: string }).detail || "Failed to prepare activation"); }
      const prepareData = await prepareRes.json() as { executed_strategies?: PreparedStrategy[] };
      const executedStrategies: PreparedStrategy[] = Array.isArray(prepareData?.executed_strategies) ? prepareData.executed_strategies : [];

      // Step 2: build full trade payload matching activation-curl-request format
      const activationNow = new Date();
      const nowTs = formatActivationTs(activationNow);
      const groupHex = Date.now().toString(16) + Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0");
      const groupId = `exec_${groupHex}group`;

      const trades = selectedRows.map(r => {
        const prepared = executedStrategies.find(e => e.source_strategy_id === r.id);
        const assignedId = prepared?.assigned_strategy_id ?? r.id;
        const execId = `exec_${groupHex}${r.id.slice(-8)}`;
        const ticker = r.underlying?.toUpperCase() ?? "NIFTY";
        const entryTime = buildStrategyDateTime(decodedDatetime, r.entry_time);
        const exitTime  = buildStrategyDateTime(decodedDatetime, r.exit_time);

        return {
          _id: execId,
          active_on_server: true,
          activation_mode: activationMode,
          broker: selectedBroker._id,
          broker_type: selectedBroker.broker_type,
          check_after_ts: entryTime,
          config: { Ticker: ticker },
          creation_ts: nowTs,
          entry_time: entryTime,
          exit_time: exitTime,
          external_start: null,
          free_execution: false,
          is_ra_algo: false,
          is_shared: false,
          last_activation_ts: nowTs,
          legs: [],
          name: r.name,
          portfolio: { group_id: groupId, group_name: portfolioName, portfolio: portfolioId },
          reentry_time_restriction: null,
          skip_initial_candles: 0,
          status: "StrategyStatus.Live_Running",
          trade_status: 1,
          strategy_id: assignedId,
          ticker,
          source_strategy_id: r.id,
          executed_strategy_id: assignedId,
          number_of_executions: prepared?.number_of_executions ?? 1,
        };
      });

      // Step 3: activate
      const res = await fetch(`${API_BASE}/portfolio/activate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolio_id: portfolioId,
          activation_mode: activationMode,
          current_datetime: decodedDatetime || undefined,
          trades,
        }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error((d as { detail?: string }).detail || "Activation failed"); }
      showToast("Activated successfully!");
      setTimeout(() => navigate(-1), 1200);
    } catch (err) { showToast((err as Error).message || "Activation failed. Please try again.", "error"); }
    finally { setActivating(false); }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <PageMeta title={`${portfolioName || "Portfolio"} Activation`} description="Activate portfolio strategies" />

      <div className="relative min-h-screen bg-gray-50">

        {/* ── Top nav bar ──────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-5 py-3 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <button type="button" onClick={() => navigate(-1)}
              className="shrink-0 text-gray-500 hover:text-gray-800 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 15.75L3 12m0 0l3.75-3.75M3 12h18" />
              </svg>
            </button>
            <span className="text-[17px] font-semibold text-gray-800 truncate">
              {loading ? "Loading…" : (portfolioName || "Portfolio")}
            </span>
            {decodedDatetime && (
              <span className="hidden md:inline text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{decodedDatetime}</span>
            )}
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-[11px] font-medium text-blue-600">{activationMode}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-[12px] text-gray-500 hover:bg-gray-50 transition-colors">
              <DownloadIcon /><span className="hidden md:inline">PDF</span>
            </button>
            <button type="button" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-[12px] text-gray-500 hover:bg-gray-50 transition-colors">
              <ExportIcon /><span className="hidden md:inline">Export</span>
            </button>
            <button type="button" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-[12px] text-red-500 hover:bg-red-50 transition-colors">
              <TrashIcon /><span className="hidden md:inline">Delete</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-4 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-[13px] text-red-600">{error}</div>
        )}

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div className="p-5 pb-36">

          {/* Portfolio settings */}
          <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <span className="text-[13px] font-semibold text-gray-700 mr-1">Overall Portfolio Setting</span>
            {/* Qty stepper */}
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-gray-500">Qty Multiplier</span>
              <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
                <button onClick={() => changeGQty(-1)} disabled={portfolioQty <= 1}
                  className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-40 border-r border-gray-200 font-medium">−</button>
                <span className="w-9 text-center text-[13px] font-semibold text-gray-800">{portfolioQty}</span>
                <button onClick={() => changeGQty(1)} disabled={portfolioQty >= 100}
                  className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-40 border-l border-gray-200 font-medium">+</button>
              </div>
            </div>
            {/* Broker dropdown */}
            <div className="flex flex-col gap-0.5">
              <select
                value={selectedBroker?._id ?? ""}
                onChange={e => { setSelectedBroker(brokers.find(b => b._id === e.target.value) ?? null); setBrokerError(false); }}
                className={`px-2 py-1.5 rounded-lg border text-[12px] text-gray-700 bg-white outline-none focus:ring-1 transition-colors ${brokerError ? "border-red-400 focus:ring-red-200" : "border-gray-200 focus:border-blue-400 focus:ring-blue-100"}`}
              >
                <option value="">Select Broker</option>
                {brokers.map(b => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
              {brokerError && <span className="text-[11px] text-red-500">Please select broker</span>}
            </div>
            {/* Edit portfolio btn */}
            <button type="button"
              onClick={() => portfolioId && window.open(`/portfolio/${portfolioId}`, "_blank")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-500 text-blue-500 text-[12px] font-semibold hover:bg-blue-500 hover:text-white transition-colors">
              Edit Portfolio
            </button>
            {/* Mode toggle */}
            <div className="flex border border-gray-200 rounded-lg overflow-hidden text-[12px] font-medium">
              {(["DTE", "Weekdays", "Budget Days"] as const).map((m, i, a) => (
                <button key={m} type="button"
                  onClick={() => (m === "DTE" || m === "Weekdays") && setFilterMode(m as FilterMode)}
                  className={`px-3 py-[5px] transition-colors ${i < a.length - 1 ? "border-r border-gray-200" : ""} ${filterMode === m ? "bg-blue-50 text-blue-600 font-semibold" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* ── Recent Orders style card ─────────────────────────────── */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">

            {/* Card header */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
              <h2 className="text-[16px] font-semibold text-gray-800">
                Portfolio Strategies
                <span className="ml-2 text-[12px] font-normal text-gray-400">({filteredRows.length})</span>
              </h2>
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-[13px] text-gray-700 placeholder:text-gray-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 w-48 transition-all" />
                </div>
                {/* Filter */}
                <button type="button" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-[13px] text-gray-600 hover:bg-gray-50 transition-colors font-medium">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                  </svg>
                  Filter
                </button>
              </div>
            </div>

            {/* Table head */}
            <div className="grid grid-cols-[40px_1fr_90px_90px_140px_220px_100px_100px_120px] items-center gap-4 px-5 py-3 border-b border-gray-100 bg-white">
              <label className="flex items-center cursor-pointer">
                <input type="checkbox" checked={allChecked}
                  ref={el => { if (el) el.indeterminate = someChecked; }}
                  onChange={toggleAll}
                  className="w-4 h-4 accent-blue-600 cursor-pointer rounded" />
              </label>
              {["Strategy", "Instrument", "Product", "Qty Multiplier", filterMode === "Weekdays" ? "Weekdays" : "DTE", "Entry", "Exit", ""].map((col, i) => (
                <span key={i} className="text-[12px] font-medium text-gray-400 uppercase tracking-wide">{col}</span>
              ))}
            </div>

            {/* Rows */}
            {loading ? (
              <div className="py-16 text-center text-[13px] text-gray-400">Loading strategies…</div>
            ) : filteredRows.length === 0 ? (
              <div className="py-16 text-center text-[13px] text-gray-400">No strategies found.</div>
            ) : filteredRows.map((row, idx) => {
              const av = avatarColor(idx);
              return (
                <div key={row.id}
                  className={`grid grid-cols-[40px_1fr_90px_90px_140px_220px_100px_100px_120px] items-center gap-4 px-5 py-[18px] border-b border-gray-100 last:border-0 transition-colors ${row.checked ? "bg-blue-50/30" : "bg-white hover:bg-gray-50/60"}`}>

                  {/* Checkbox */}
                  <label className="flex items-center cursor-pointer">
                    <input type="checkbox" checked={row.checked} onChange={() => toggleRow(row.id)}
                      className="w-4 h-4 accent-blue-600 cursor-pointer rounded" />
                  </label>

                  {/* Strategy — avatar + name + underlying */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${av.bg}`}>
                      <span className={`text-[12px] font-bold ${av.text}`}>{initials(row.name)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-gray-800 truncate">{row.name}</p>
                      <p className="text-[12px] text-gray-400">{row.underlying}</p>
                    </div>
                  </div>

                  {/* Instrument */}
                  <span className="text-[13px] font-semibold text-gray-700 tracking-wide">{row.underlying.toUpperCase()}</span>

                  {/* Product */}
                  <span className="text-[13px] text-gray-600">{row.product}</span>

                  {/* Qty multiplier — formula + steppers only */}
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => changeRQty(row.id, -1)} disabled={row.qty_multiplier <= 1}
                      className="w-5 h-5 rounded border border-gray-200 text-gray-400 hover:bg-gray-100 disabled:opacity-40 text-[12px] font-semibold flex items-center justify-center transition-colors">−</button>
                    <span className="text-[13px] text-gray-600">{row.qty_multiplier}</span>
                    <span className="text-gray-300 text-[12px]">×</span>
                    <span className="text-[13px] text-gray-600">{portfolioQty}</span>
                    <span className="text-gray-300 text-[12px]">=</span>
                    <span className="text-[13px] font-bold text-blue-600">{row.qty_multiplier * portfolioQty}</span>
                    <button onClick={() => changeRQty(row.id, 1)} disabled={row.qty_multiplier >= 100}
                      className="w-5 h-5 rounded border border-gray-200 text-gray-400 hover:bg-gray-100 disabled:opacity-40 text-[12px] font-semibold flex items-center justify-center transition-colors">+</button>
                  </div>

                  {/* DTE / Weekdays — separate column */}
                  <div>
                    {filterMode === "Weekdays" ? (
                      <div className="flex items-center gap-[4px]">
                        {ALL_DAYS.map(d => {
                          const isWeekday = !["Sa", "Su"].includes(d);
                          const on = isWeekday && row.weekdays.includes(d);
                          return (
                            <button key={d} type="button"
                              onClick={() => isWeekday && toggleDay(row.id, d)}
                              disabled={!isWeekday}
                              className={`inline-flex items-center justify-center w-[26px] h-[26px] rounded-full text-[10px] font-semibold border transition-colors
                                ${on
                                  ? "border-blue-400 bg-white text-blue-500"
                                  : isWeekday
                                    ? "border-gray-200 bg-white text-gray-300 hover:border-blue-300 hover:text-blue-400"
                                    : "border-gray-100 bg-white text-gray-200 cursor-default"}`}>
                              {d}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-[13px] text-gray-500">{row.dte.length ? row.dte.join(", ") : "0"} DTE</span>
                    )}
                  </div>

                  {/* Entry */}
                  <span className="text-[13px] text-gray-700 font-medium">{row.entry_time || "—"}</span>

                  {/* Exit */}
                  <span className="text-[13px] text-gray-700 font-medium">{row.exit_time || "—"}</span>

                  {/* Action */}
                  <div className="flex items-center justify-end gap-3">
                    <button type="button" className="text-[12px] text-blue-500 hover:underline font-medium whitespace-nowrap">
                      Edit Config
                    </button>
                    <button type="button" className="text-gray-300 hover:text-red-400 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-[15px] h-[15px]">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Sticky bottom bar ──────────────────────────────────────────── */}
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between px-5 py-3">
            <p className="text-[12px] text-gray-400">
              <span className="font-semibold text-gray-700">{selectedRows.length}</span> of {rows.length} strategies selected
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleSave} disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-[13px] text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 font-medium">
                {saving && <Spinner />} Save Changes
              </button>
              <button type="button" onClick={handleActivate}
                disabled={activating || selectedRows.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-[13px] font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-sm">
                {activating ? <Spinner /> : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                Activate Selected ({selectedRows.length})
              </button>
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5 bg-gray-50 border-t border-gray-100 py-2 text-[11px] text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            Update Portfolio to save any changes to the DTE or Qty Multiplier
          </div>
        </div>

        {/* ── Toast ──────────────────────────────────────────────────────── */}
        {toast && (
          <div className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl shadow-xl text-[13px] font-semibold text-white transition-all ${toast.type === "error" ? "bg-red-500" : "bg-green-600"}`}>
            {toast.msg}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

function Spinner() {
  return <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />;
}

function DownloadIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>;
}

function ExportIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15" /></svg>;
}

function TrashIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z" clipRule="evenodd" /></svg>;
}
