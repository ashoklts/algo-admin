import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;
const POLL_INTERVAL = 5000;
const INSTRUMENTS = ["NIFTY", "BANKNIFTY", "FINNIFTY", "SENSEX", "MIDCPNIFTY"];

interface ChainRow {
  strike: number;
  ltp: number;
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  oi: number;
  token: string;
  symbol: string;
}

interface LiveChainResponse {
  instrument: string;
  expiry: string;
  expiries: string[];
  spot_price: number;
  chain: {
    CE: ChainRow[];
    PE: ChainRow[];
  };
}

function fmtOI(oi: number): string {
  if (!oi) return "—";
  if (oi >= 10_000_000) return (oi / 10_000_000).toFixed(1) + "Cr";
  if (oi >= 100_000) return (oi / 100_000).toFixed(1) + "L";
  return Math.round(oi / 1000) + "K";
}

function fmt(v: number | undefined, dec = 2): string {
  if (v == null || isNaN(v) || v === 0) return "—";
  return v.toFixed(dec);
}

function fmtDelta(v: number | undefined, dec = 4): string {
  if (v == null || isNaN(v)) return "—";
  return v.toFixed(dec);
}

export default function LiveOptionChain() {
  const [instrument, setInstrument] = useState("NIFTY");
  const [selectedExpiry, setSelectedExpiry] = useState("");
  const [data, setData] = useState<LiveChainResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expirySwitchRef = useRef(false);

  const fetchChain = useCallback(async (expiry?: string) => {
    const base = String(API_BASE || "").replace(/\/+$/, "");
    const exp = expiry ?? selectedExpiry;
    const expParam = exp ? `?expiry=${encodeURIComponent(exp)}` : "";
    const url = `${base}/live-greeks-chain/${instrument}${expParam}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}${body ? ": " + body.slice(0, 120) : ""}`);
      }
      const json: LiveChainResponse = await res.json();
      setData(json);
      if (!exp && json.expiry) setSelectedExpiry(json.expiry);
      setLastUpdated(new Date());
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [instrument, selectedExpiry]);

  // Reset on instrument change
  useEffect(() => {
    setLoading(true);
    setData(null);
    setSelectedExpiry("");
    setError(null);
    expirySwitchRef.current = false;
    fetchChain("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrument]);

  // Refetch on expiry tab click
  const handleExpiryClick = useCallback((exp: string) => {
    setSelectedExpiry(exp);
    setLoading(true);
    expirySwitchRef.current = true;
    fetchChain(exp);
  }, [fetchChain]);

  // Auto-poll
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => fetchChain(), POLL_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchChain]);

  // Build merged strike list
  const strikes = data
    ? Array.from(new Set([
        ...data.chain.CE.map(r => r.strike),
        ...data.chain.PE.map(r => r.strike),
      ])).sort((a, b) => a - b)
    : [];

  const ceMap = data ? Object.fromEntries(data.chain.CE.map(r => [r.strike, r])) : {};
  const peMap = data ? Object.fromEntries(data.chain.PE.map(r => [r.strike, r])) : {};

  const atmStrike = data && strikes.length
    ? strikes.reduce((best, cur) =>
        Math.abs(cur - data.spot_price) < Math.abs(best - data.spot_price) ? cur : best,
        strikes[0])
    : 0;

  // ATM row ref for auto-scroll
  const atmRowRef = useRef<HTMLTableRowElement>(null);
  const scrollBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (atmRowRef.current && scrollBoxRef.current && !expirySwitchRef.current) {
      const box = scrollBoxRef.current;
      const row = atmRowRef.current;
      const targetTop = row.offsetTop - box.clientHeight / 2 + row.offsetHeight / 2;
      box.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    }
  }, [data]);

  const maxCeOI = data ? Math.max(0, ...data.chain.CE.map(r => r.oi)) : 0;
  const maxPeOI = data ? Math.max(0, ...data.chain.PE.map(r => r.oi)) : 0;

  return (
    <div className="p-4 font-sans">
      {/* Instrument selector */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {INSTRUMENTS.map(ins => (
          <button
            key={ins}
            onClick={() => setInstrument(ins)}
            className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${
              instrument === ins
                ? "bg-brand-500 text-white border-brand-500"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
            }`}
          >
            {ins}
          </button>
        ))}

        {data && (
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              Spot:{" "}
              <span className="font-semibold text-gray-800 dark:text-white">
                {data.spot_price ? data.spot_price.toFixed(2) : "—"}
              </span>
            </span>
            <span className="text-xs text-gray-400">
              {lastUpdated ? `Updated: ${lastUpdated.toLocaleTimeString()}` : ""}
            </span>
            <button
              onClick={() => { setLoading(true); fetchChain(); }}
              className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            >
              ↺ Refresh
            </button>
          </div>
        )}
      </div>

      {/* Expiry tabs */}
      {data && data.expiries.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {data.expiries.map(exp => (
            <button
              key={exp}
              onClick={() => handleExpiryClick(exp)}
              className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                selectedExpiry === exp
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
              }`}
            >
              {exp}
            </button>
          ))}
        </div>
      )}

      {/* Loading / Error states */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Fetching live option chain...
        </div>
      )}
      {!loading && error && (
        <div className="text-center py-6 text-red-500 dark:text-red-400 text-sm">
          ⚠ {error}
        </div>
      )}

      {/* Option Chain Table */}
      {!loading && data && strikes.length > 0 && (
        <div
          ref={scrollBoxRef}
          className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-700"
          style={{ maxHeight: "calc(100vh - 220px)" }}
        >
          <table className="text-xs border-collapse" style={{ tableLayout: "fixed", width: "100%" }}>
            <colgroup>
              {/* CALLS: OI LTP Delta IV Theta Vega Gamma */}
              <col style={{ width: 58 }} />
              <col style={{ width: 68 }} />
              <col style={{ width: 64 }} />
              <col style={{ width: 52 }} />
              <col style={{ width: 72 }} />
              <col style={{ width: 56 }} />
              <col style={{ width: 72 }} />
              {/* Center: Strike AvgIV */}
              <col style={{ width: 72 }} />
              <col style={{ width: 52 }} />
              {/* PUTS: Delta IV LTP Theta Vega Gamma OI */}
              <col style={{ width: 64 }} />
              <col style={{ width: 52 }} />
              <col style={{ width: 68 }} />
              <col style={{ width: 72 }} />
              <col style={{ width: 56 }} />
              <col style={{ width: 72 }} />
              <col style={{ width: 58 }} />
            </colgroup>
            <thead className="sticky top-0 z-10">
              {/* Section headers */}
              <tr>
                <th colSpan={7} className="py-2 text-center text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-b border-gray-200 dark:border-gray-700 font-semibold tracking-wide">
                  CALLS
                </th>
                <th colSpan={2} className="py-2 text-center bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-semibold">
                  —
                </th>
                <th colSpan={7} className="py-2 text-center text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700 font-semibold tracking-wide">
                  PUTS
                </th>
              </tr>
              {/* Column headers */}
              <tr className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {/* CALLS */}
                <th className="py-1.5 px-2 text-right bg-yellow-50/60 dark:bg-yellow-900/10 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap overflow-hidden">OI</th>
                <th className="py-1.5 px-2 text-right bg-yellow-50/60 dark:bg-yellow-900/10 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap overflow-hidden">LTP</th>
                <th className="py-1.5 px-2 text-right bg-yellow-50/60 dark:bg-yellow-900/10 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap overflow-hidden">Delta</th>
                <th className="py-1.5 px-2 text-right bg-yellow-50/60 dark:bg-yellow-900/10 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap overflow-hidden">IV%</th>
                <th className="py-1.5 px-2 text-right bg-yellow-50/60 dark:bg-yellow-900/10 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap overflow-hidden">Theta</th>
                <th className="py-1.5 px-2 text-right bg-yellow-50/60 dark:bg-yellow-900/10 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap overflow-hidden">Vega</th>
                <th className="py-1.5 px-2 text-right bg-yellow-50/60 dark:bg-yellow-900/10 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap overflow-hidden">Gamma</th>
                {/* Center */}
                <th className="py-1.5 px-2 text-center bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap overflow-hidden">Strike</th>
                <th className="py-1.5 px-2 text-center bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap overflow-hidden">Avg IV</th>
                {/* PUTS */}
                <th className="py-1.5 px-2 text-left bg-blue-50/60 dark:bg-blue-900/10 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap overflow-hidden">Delta</th>
                <th className="py-1.5 px-2 text-left bg-blue-50/60 dark:bg-blue-900/10 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap overflow-hidden">IV%</th>
                <th className="py-1.5 px-2 text-left bg-blue-50/60 dark:bg-blue-900/10 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap overflow-hidden">LTP</th>
                <th className="py-1.5 px-2 text-left bg-blue-50/60 dark:bg-blue-900/10 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap overflow-hidden">Theta</th>
                <th className="py-1.5 px-2 text-left bg-blue-50/60 dark:bg-blue-900/10 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap overflow-hidden">Vega</th>
                <th className="py-1.5 px-2 text-left bg-blue-50/60 dark:bg-blue-900/10 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap overflow-hidden">Gamma</th>
                <th className="py-1.5 px-2 text-left bg-blue-50/60 dark:bg-blue-900/10 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap overflow-hidden">OI</th>
              </tr>
            </thead>
            <tbody>
              {strikes.map(strike => {
                const ce = ceMap[strike];
                const pe = peMap[strike];
                const isAtm = strike === atmStrike;
                const isCallItm = strike < atmStrike;  // call ITM = strike below spot
                const isPutItm = strike > atmStrike;   // put ITM = strike above spot

                const avgIv = ce?.iv && pe?.iv
                  ? (ce.iv + pe.iv) / 2
                  : (ce?.iv || pe?.iv || 0);

                const ceBg = isAtm
                  ? "bg-yellow-100 dark:bg-yellow-900/30"
                  : isCallItm
                    ? "bg-yellow-50/70 dark:bg-yellow-900/10"
                    : "bg-white dark:bg-gray-900";
                const peBg = isAtm
                  ? "bg-yellow-100 dark:bg-yellow-900/30"
                  : isPutItm
                    ? "bg-blue-50/60 dark:bg-blue-900/10"
                    : "bg-white dark:bg-gray-900";
                const strikeBg = isAtm
                  ? "bg-yellow-200 dark:bg-yellow-800/60 font-bold text-yellow-900 dark:text-yellow-200"
                  : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200";
                const midBg = isAtm
                  ? "bg-yellow-100 dark:bg-yellow-800/40"
                  : "bg-gray-50 dark:bg-gray-800";

                const ceOiPct = maxCeOI > 0 && ce?.oi ? (ce.oi / maxCeOI) * 100 : 0;
                const peOiPct = maxPeOI > 0 && pe?.oi ? (pe.oi / maxPeOI) * 100 : 0;

                return (
                  <tr
                    key={strike}
                    ref={isAtm ? atmRowRef : undefined}
                    className="border-b border-gray-100 dark:border-gray-800 hover:brightness-95 dark:hover:brightness-110 transition-all"
                  >
                    {/* CE OI with bar */}
                    <td className={`py-1 px-2 text-right ${ceBg} whitespace-nowrap overflow-hidden`}>
                      <div className="flex flex-col items-end gap-0.5">
                        <span>{fmtOI(ce?.oi ?? 0)}</span>
                        {ceOiPct > 0 && (
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                            <div
                              className="bg-yellow-400 dark:bg-yellow-500 h-1 rounded-full"
                              style={{ width: `${ceOiPct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                    {/* CE LTP */}
                    <td className={`py-1 px-2 text-right font-medium ${ceBg} whitespace-nowrap overflow-hidden`}>
                      {fmt(ce?.ltp)}
                    </td>
                    {/* CE Delta */}
                    <td className={`py-1 px-2 text-right ${ceBg} text-green-700 dark:text-green-400 font-mono whitespace-nowrap overflow-hidden`}>
                      {fmtDelta(ce?.delta)}
                    </td>
                    {/* CE IV */}
                    <td className={`py-1 px-2 text-right ${ceBg} whitespace-nowrap overflow-hidden`}>
                      {fmt(ce?.iv, 1)}
                    </td>
                    {/* CE Theta */}
                    <td className={`py-1 px-2 text-right ${ceBg} text-red-500 dark:text-red-400 whitespace-nowrap overflow-hidden`}>
                      {fmt(ce?.theta, 2)}
                    </td>
                    {/* CE Vega */}
                    <td className={`py-1 px-2 text-right ${ceBg} text-purple-600 dark:text-purple-400 whitespace-nowrap overflow-hidden`}>
                      {fmt(ce?.vega, 2)}
                    </td>
                    {/* CE Gamma */}
                    <td className={`py-1 px-2 text-right ${ceBg} text-gray-500 whitespace-nowrap overflow-hidden`}>
                      {fmt(ce?.gamma, 5)}
                    </td>

                    {/* Strike */}
                    <td className={`py-1 px-2 text-center ${strikeBg} whitespace-nowrap overflow-hidden`}>
                      {strike}
                      {isAtm && (
                        <span className="ml-1 text-[9px] bg-yellow-500 dark:bg-yellow-600 text-white px-1 rounded">ATM</span>
                      )}
                    </td>

                    {/* Avg IV */}
                    <td className={`py-1 px-2 text-center ${midBg} text-gray-500 dark:text-gray-400 whitespace-nowrap overflow-hidden`}>
                      {avgIv ? avgIv.toFixed(1) : "—"}
                    </td>

                    {/* PE Delta */}
                    <td className={`py-1 px-2 text-left ${peBg} text-red-600 dark:text-red-400 font-mono whitespace-nowrap overflow-hidden`}>
                      {fmtDelta(pe?.delta)}
                    </td>
                    {/* PE IV */}
                    <td className={`py-1 px-2 text-left ${peBg} whitespace-nowrap overflow-hidden`}>
                      {fmt(pe?.iv, 1)}
                    </td>
                    {/* PE LTP */}
                    <td className={`py-1 px-2 text-left font-medium ${peBg} whitespace-nowrap overflow-hidden`}>
                      {fmt(pe?.ltp)}
                    </td>
                    {/* PE Theta */}
                    <td className={`py-1 px-2 text-left ${peBg} text-red-500 dark:text-red-400 whitespace-nowrap overflow-hidden`}>
                      {fmt(pe?.theta, 2)}
                    </td>
                    {/* PE Vega */}
                    <td className={`py-1 px-2 text-left ${peBg} text-purple-600 dark:text-purple-400 whitespace-nowrap overflow-hidden`}>
                      {fmt(pe?.vega, 2)}
                    </td>
                    {/* PE Gamma */}
                    <td className={`py-1 px-2 text-left ${peBg} text-gray-500 whitespace-nowrap overflow-hidden`}>
                      {fmt(pe?.gamma, 5)}
                    </td>
                    {/* PE OI with bar */}
                    <td className={`py-1 px-2 text-left ${peBg} whitespace-nowrap overflow-hidden`}>
                      <div className="flex flex-col gap-0.5">
                        <span>{fmtOI(pe?.oi ?? 0)}</span>
                        {peOiPct > 0 && (
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                            <div
                              className="bg-blue-400 dark:bg-blue-500 h-1 rounded-full"
                              style={{ width: `${peOiPct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && data && strikes.length === 0 && (
        <div className="text-center py-10 text-gray-400">No option chain data found for {instrument}.</div>
      )}
    </div>
  );
}
