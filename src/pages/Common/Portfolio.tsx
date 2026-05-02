import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterMode = "DTE" | "Weekdays" | "Budget Days";
type Day = "M" | "T" | "W" | "Th" | "F";
type DTEOption = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type BudgetOption = "Event Day" | "1 Day Before" | "2 Days Before";

const ALL_WEEKDAYS: Day[] = ["M", "T", "W", "Th", "F"];
const DTE_OPTIONS: DTEOption[] = [0, 1, 2, 3, 4, 5, 6];
const BUDGET_OPTIONS: BudgetOption[] = ["Event Day", "1 Day Before", "2 Days Before"];
const QTY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

interface StrategyRow {
  id: string;
  name: string;
  underlying: string;
  product: string;
  qty_multiplier: number;
  slippage: number;
  dte: number[];
  weekdays: Day[];
  checked: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().slice(0, 10); }
function oneYearAgoStr() {
  const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10);
}

// ─── Small UI atoms ───────────────────────────────────────────────────────────

function ChevronDown() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-3 h-3 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function Spinner() {
  return <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Portfolio() {
  const { portfolioId } = useParams<{ portfolioId: string }>();
  const navigate        = useNavigate();

  const [portfolioName, setPortfolioName] = useState("");
  const [rows, setRows]                   = useState<StrategyRow[]>([]);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [toast, setToast]                 = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Overall toolbar state
  const [filterMode, setFilterMode]           = useState<FilterMode>("DTE");
  const [portfolioQty, setPortfolioQty]       = useState(1);
  const [globalSlippage, setGlobalSlippage]   = useState(0);
  const [selectedDays, setSelectedDays]       = useState<Day[]>([...ALL_WEEKDAYS]);
  const [selectedDTEs, setSelectedDTEs]       = useState<DTEOption[]>([0]);
  const [selectedBudgets, setSelectedBudgets] = useState<BudgetOption[]>(["Event Day"]);

  // Popover open states
  const [qtyOpen, setQtyOpen]           = useState(false);
  const [slippageOpen, setSlippageOpen] = useState(false);
  const [dayOpen, setDayOpen]           = useState(false);
  const [tickerOpen, setTickerOpen]     = useState(false);

  // Backtest dates
  const [startDate, setStartDate] = useState(oneYearAgoStr());
  const [endDate, setEndDate]     = useState(todayStr());

  const toastRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qtyRef      = useRef<HTMLDivElement>(null);
  const slipRef     = useRef<HTMLDivElement>(null);
  const dayRef      = useRef<HTMLDivElement>(null);
  const tickerRef   = useRef<HTMLDivElement>(null);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Close popovers on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (qtyRef.current    && !qtyRef.current.contains(e.target as Node))    setQtyOpen(false);
      if (slipRef.current   && !slipRef.current.contains(e.target as Node))   setSlippageOpen(false);
      if (dayRef.current    && !dayRef.current.contains(e.target as Node))    setDayOpen(false);
      if (tickerRef.current && !tickerRef.current.contains(e.target as Node)) setTickerOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Load portfolio
  useEffect(() => {
    if (!portfolioId) return;
    setLoading(true);
    fetch(`${API_BASE}/portfolio/${encodeURIComponent(portfolioId)}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => {
        const p = data?.portfolio ?? data ?? {};
        setPortfolioName(p.name ?? "Portfolio");
        setPortfolioQty(p.qty_multiplier ?? 1);
        setFilterMode(p.is_weekdays === true ? "Weekdays" : "DTE");
        setRows((p.strategies ?? []).map((s: Record<string, unknown>) => ({
          id:            String(s._id ?? ""),
          name:          String(s.name ?? "Untitled"),
          underlying:    String(s.underlying ?? "NIFTY"),
          product:       String(s.product ?? "INTRADAY"),
          qty_multiplier: Number(s.qty_multiplier ?? 1),
          slippage:      Number(s.slippage ?? 0),
          dte:           Array.isArray(s.dte) ? s.dte as number[] : [0],
          weekdays:      Array.isArray(s.weekdays) ? s.weekdays as Day[] : [...ALL_WEEKDAYS],
          checked:       s.checked !== false,
        })));
      })
      .catch(() => showToast("Failed to load portfolio", "error"))
      .finally(() => setLoading(false));
    return () => { if (toastRef.current) clearTimeout(toastRef.current); };
  }, [portfolioId, showToast]);

  // ── Derived
  const allChecked   = rows.length > 0 && rows.every(r => r.checked);
  const someChecked  = rows.some(r => r.checked) && !allChecked;
  const checkedCount = rows.filter(r => r.checked).length;
  const underlyings  = [...new Set(rows.map(r => r.underlying.toUpperCase()))];

  function filterSelLabel() {
    if (filterMode === "DTE")         return selectedDTEs.length === DTE_OPTIONS.length     ? "All DTE"  : selectedDTEs.map(d => `${d} DTE`).join(", ");
    if (filterMode === "Weekdays")    return selectedDays.length === ALL_WEEKDAYS.length    ? "All Days" : selectedDays.join(", ");
    return selectedBudgets.length === BUDGET_OPTIONS.length ? "All" : selectedBudgets.join(", ");
  }

  // ── Handlers
  const toggleAll    = () => setRows(p => p.map(r => ({ ...r, checked: !allChecked })));
  const toggleRow    = (id: string) => setRows(p => p.map(r => r.id === id ? { ...r, checked: !r.checked } : r));
  const deleteChecked = () => setRows(p => p.filter(r => !r.checked));

  const setRowQty      = (id: string, v: number) => setRows(p => p.map(r => r.id === id ? { ...r, qty_multiplier: v } : r));
  const setRowDTE      = (id: string, v: number) => setRows(p => p.map(r => r.id === id ? { ...r, dte: [v] } : r));
  const setRowSlippage = (id: string, v: number) => setRows(p => p.map(r => r.id === id ? { ...r, slippage: v } : r));

  const applyGlobalSlippage = () => {
    setRows(p => p.map(r => ({ ...r, slippage: globalSlippage })));
    setSlippageOpen(false);
    showToast("Slippage applied to all strategies");
  };

  const toggleDay    = (d: Day)         => setSelectedDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);
  const toggleDTE    = (d: DTEOption)   => setSelectedDTEs(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);
  const toggleBudget = (b: BudgetOption) => setSelectedBudgets(p => p.includes(b) ? p.filter(x => x !== b) : [...p, b]);

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
      showToast("Portfolio saved successfully.");
    } catch { showToast("Failed to save portfolio", "error"); }
    finally { setSaving(false); }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <PageMeta title={portfolioName || "Portfolio"} description="Manage portfolio" />

      <div className="relative min-h-screen bg-gray-50">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-5 py-3 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <button type="button" onClick={() => navigate(-1)} className="shrink-0 text-gray-500 hover:text-gray-800">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 15.75L3 12m0 0l3.75-3.75M3 12h18" />
              </svg>
            </button>
            <span className="text-[17px] font-semibold text-gray-800 truncate">{loading ? "Loading…" : portfolioName}</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-gray-200 text-[12px] text-gray-500 hover:bg-gray-50">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
              PDF
            </button>
            <button type="button" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-gray-200 text-[12px] text-gray-500 hover:bg-gray-50">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15" /></svg>
              Export <span className="text-[10px]">.algtst</span>
            </button>
            <button type="button" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-gray-200 text-[12px] text-gray-600 hover:bg-gray-50 font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
              Edit
            </button>
            <button type="button" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-red-200 text-[12px] text-red-500 hover:bg-red-50">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951z" clipRule="evenodd" /></svg>
              Delete
            </button>
          </div>
        </div>

        <div className="p-4 pb-52">

          {/* ── Overall Portfolio Setting panel ──────────────────────────── */}
          <div className="mb-3 rounded-lg border border-gray-200 bg-white shadow-sm">
            <p className="px-4 pt-3 pb-2 text-[13px] font-medium text-gray-700">Overall Portfolio Setting</p>

            {/* Toolbar — grid mirrors row columns: [name-area 1fr] [qty 1fr] [dte 1fr] [slip 1fr] */}
            <div className="grid grid-cols-[minmax(0,1fr)_1fr_1fr_1fr] items-center gap-x-2 border-t border-gray-100 px-3 py-2">

              {/* Name area: ticker filter */}
              <div ref={tickerRef} className="relative w-fit">
                <button type="button" onClick={() => setTickerOpen(v => !v)}
                  className="flex items-center gap-1 rounded border border-gray-200 bg-white px-2.5 py-1 text-[12px] text-gray-600 hover:border-gray-400 transition-colors">
                  All <ChevronDown />
                </button>
                {tickerOpen && (
                  <div className="absolute left-0 top-7 z-30 min-w-[110px] rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                    <button type="button" onClick={() => setTickerOpen(false)}
                      className="w-full px-3 py-1.5 text-left text-[12px] font-medium text-blue-600 hover:bg-gray-50">All</button>
                    {underlyings.map(u => (
                      <button key={u} type="button" onClick={() => setTickerOpen(false)}
                        className="w-full px-3 py-1.5 text-left text-[12px] text-gray-700 hover:bg-gray-50">{u}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* Qty column header — 116px */}
              <div ref={qtyRef} className="relative">
                <button type="button" onClick={() => setQtyOpen(v => !v)}
                  className="flex items-center gap-1 rounded border border-gray-200 bg-white px-2.5 py-1 text-[12px] text-gray-600 hover:border-gray-400 transition-colors">
                  <span className="font-medium">Qty Multiplier: {portfolioQty}</span> <ChevronDown />
                </button>
                {qtyOpen && (
                  <div className="absolute left-0 top-8 z-30 w-44 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                    <p className="mb-2 text-[12px] font-medium text-gray-700">Quantity Multiplier</p>
                    <select value={portfolioQty} onChange={e => { setPortfolioQty(Number(e.target.value)); setQtyOpen(false); }}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-[12px] text-gray-700 outline-none focus:border-blue-400">
                      {QTY_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* DTE column header — 160px: toggle + filter stacked as row */}
              <div ref={dayRef} className="flex items-center gap-1.5">
                {/* Mode toggle */}
                <div className="flex overflow-hidden rounded border border-gray-200 text-[10px] font-semibold shrink-0">
                  {(["DTE", "Weekdays", "Budget Days"] as const).map((m, i, a) => (
                    <button key={m} type="button" onClick={() => setFilterMode(m)}
                      className={`px-2 py-1 transition-colors whitespace-nowrap ${i < a.length - 1 ? "border-r border-gray-200" : ""} ${filterMode === m ? "bg-blue-500 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                      {m}
                    </button>
                  ))}
                </div>
                {/* Filter dropdown */}
                <div className="relative">
                  <button type="button" onClick={() => setDayOpen(v => !v)}
                    className="flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-[12px] text-gray-600 hover:border-gray-400 transition-colors">
                    <span>{filterSelLabel()}</span> <ChevronDown />
                  </button>
                  {dayOpen && (
                    <div className="absolute left-0 top-8 z-30 min-w-[150px] rounded-lg border border-gray-200 bg-white shadow-lg py-1.5 px-1">
                      {filterMode === "Weekdays" && ALL_WEEKDAYS.map(d => (
                        <label key={d} className="flex items-center gap-2 px-2 py-1 text-[12px] text-gray-700 hover:bg-gray-50 cursor-pointer rounded">
                          <input type="checkbox" checked={selectedDays.includes(d)} onChange={() => toggleDay(d)} className="accent-blue-500 w-3.5 h-3.5" />{d}
                        </label>
                      ))}
                      {filterMode === "DTE" && DTE_OPTIONS.map(d => (
                        <label key={d} className="flex items-center gap-2 px-2 py-1 text-[12px] text-gray-700 hover:bg-gray-50 cursor-pointer rounded">
                          <input type="checkbox" checked={selectedDTEs.includes(d)} onChange={() => toggleDTE(d)} className="accent-blue-500 w-3.5 h-3.5" />{d} DTE
                        </label>
                      ))}
                      {filterMode === "Budget Days" && BUDGET_OPTIONS.map(b => (
                        <label key={b} className="flex items-center gap-2 px-2 py-1 text-[12px] text-gray-700 hover:bg-gray-50 cursor-pointer rounded">
                          <input type="checkbox" checked={selectedBudgets.includes(b)} onChange={() => toggleBudget(b)} className="accent-blue-500 w-3.5 h-3.5" />{b}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Slippage column header — 96px */}
              <div ref={slipRef} className="relative">
                <button type="button" onClick={() => setSlippageOpen(v => !v)}
                  className="flex items-center gap-1 rounded border border-gray-200 bg-white px-2.5 py-1 text-[12px] text-gray-600 hover:border-gray-400 transition-colors">
                  Slippage <ChevronDown />
                </button>
                {slippageOpen && (
                  <div className="absolute right-0 top-8 z-30 w-52 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                    <p className="mb-2 text-[12px] font-medium text-gray-700">Slippage (%) — Apply all</p>
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} max={100} step={0.1} value={globalSlippage}
                        onChange={e => setGlobalSlippage(Number(e.target.value))}
                        className="w-16 rounded border border-gray-300 px-2 py-1 text-center text-[12px] outline-none focus:border-blue-400" />
                      <span className="text-[12px] text-gray-400">%</span>
                      <button type="button" onClick={applyGlobalSlippage}
                        className="rounded bg-blue-500 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-blue-600">Apply</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Strategy list ────────────────────────────────────────────── */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">

            {/* List header: select-all + delete */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={allChecked}
                  ref={el => { if (el) el.indeterminate = someChecked; }}
                  onChange={toggleAll}
                  className="h-4 w-4 accent-blue-500 cursor-pointer" />
                <span className="text-[12px] text-gray-600">
                  <span className="font-semibold">{checkedCount}</span>/{rows.length} selected
                </span>
              </label>
              <button type="button" onClick={deleteChecked}
                className="flex items-center gap-1 text-[12px] font-medium text-red-500 hover:text-red-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951z" clipRule="evenodd" />
                </svg>
                Delete Selected
              </button>
            </div>

            {/* Loading */}
            {loading && <div className="py-14 text-center text-[13px] text-gray-400">Loading strategies…</div>}

            {/* Rows — same grid-cols as toolbar: [drag 20px] [check 16px] [name 1fr] [qty 1fr] [dte 1fr] [slip 1fr] */}
            {!loading && rows.map(row => (
              <div key={row.id}
                className={`grid grid-cols-[20px_16px_1fr_1fr_1fr_1fr] items-center gap-x-2 border-b border-gray-100 last:border-0 px-3 py-2 transition-colors ${row.checked ? "bg-blue-50/40" : "hover:bg-gray-50/40"}`}>

                {/* Drag */}
                <div className="cursor-grab text-gray-300 hover:text-gray-400 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" />
                    <circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" />
                  </svg>
                </div>

                {/* Checkbox */}
                <input type="checkbox" checked={row.checked} onChange={() => toggleRow(row.id)}
                  className="h-4 w-4 accent-blue-500 cursor-pointer" />

                {/* Name */}
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-gray-800 truncate">{row.name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{row.underlying.toUpperCase()} • {row.product}</p>
                </div>

                {/* Qty */}
                <div>
                  <select value={row.qty_multiplier} onChange={e => setRowQty(row.id, Number(e.target.value))}
                    className="rounded border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-700 outline-none focus:border-blue-400 cursor-pointer">
                    {QTY_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>

                {/* DTE */}
                <div>
                  <select value={row.dte[0] ?? 0} onChange={e => setRowDTE(row.id, Number(e.target.value))}
                    className="rounded border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-700 outline-none focus:border-blue-400 cursor-pointer">
                    {DTE_OPTIONS.map(d => <option key={d} value={d}>{d} DTE</option>)}
                  </select>
                </div>

                {/* Slippage */}
                <div className="flex items-center gap-1">
                  <input type="number" min={0} max={100} step={0.1}
                    value={row.slippage} onChange={e => setRowSlippage(row.id, Number(e.target.value))}
                    className="w-16 rounded border border-gray-200 px-2 py-1.5 text-center text-[12px] text-gray-700 outline-none focus:border-blue-400" />
                  <span className="text-[12px] text-gray-400 shrink-0">%</span>
                </div>
              </div>
            ))}

            {!loading && rows.length === 0 && (
              <div className="py-14 text-center text-[13px] text-gray-400">No strategies in this portfolio.</div>
            )}
          </div>

          {/* ── Backtest date range ──────────────────────────────────────── */}
          <div className="mt-3 rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="text-[13px] text-gray-600">Enter the duration of your backtest</span>
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-gray-500">Start Date</span>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="rounded border border-gray-200 px-2 py-1 text-[12px] text-gray-700 outline-none focus:border-blue-400 cursor-pointer" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-gray-500">End Date</span>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="rounded border border-gray-200 px-2 py-1 text-[12px] text-gray-700 outline-none focus:border-blue-400 cursor-pointer" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sticky bottom bar ────────────────────────────────────────────── */}
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between px-5 py-3">
            <p className="text-[12px] text-gray-400">
              <span className="font-semibold text-gray-700">{checkedCount}</span> of {rows.length} strategies selected
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleSave} disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-blue-500 text-blue-500 text-[13px] font-semibold hover:bg-blue-500 hover:text-white transition-colors disabled:opacity-50">
                {saving && <Spinner />} Update Portfolio
              </button>
              <button type="button"
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-green-600 text-white text-[13px] font-semibold hover:bg-green-700 transition-colors shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                </svg>
                Run Backtest
              </button>
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5 bg-gray-50 border-t border-gray-100 py-1.5 text-[11px] text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            Update Portfolio to save any changes to the DTE or Qty Multiplier
          </div>
        </div>

        {/* ── Toast ────────────────────────────────────────────────────────── */}
        {toast && (
          <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl shadow-xl text-[13px] font-semibold text-white ${toast.type === "error" ? "bg-red-500" : "bg-green-600"}`}>
            {toast.msg}
          </div>
        )}
      </div>
    </>
  );
}
