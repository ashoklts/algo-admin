import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import PaperTradePage from "./PaperTrade";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string || "").replace(/\/+$/, "");
const PAPER_TRADE_API_BASE = API_BASE ? `${API_BASE}/simulator/paper-trade` : "http://127.0.0.1:8000/algo/simulator/paper-trade";
const REFRESH_SECONDS = 60;
const REFRESH_OPTS = [
  { v: 0, l: "Off" },
  { v: 5, l: "5 Sec" },
  { v: 10, l: "10 Sec" },
  { v: 15, l: "15 Sec" },
  { v: 30, l: "30 Sec" },
  { v: 60, l: "60 Sec" },
];
const SPOT_SYMBOLS = [
  { code: "N", instrument: "NIFTY" },
  { code: "BN", instrument: "BANKNIFTY" },
  { code: "FN", instrument: "FINNIFTY" },
  { code: "MN", instrument: "MIDCPNIFTY" },
  { code: "SX", instrument: "SENSEX" },
];

type PortfolioApiItem = { _id?: string; name?: string; portfolio_name?: string };
type StrategyPosition = {
  type?: string;
  option_type?: string;
  strike?: number;
  expiry?: string;
  entry_price?: number | null;
  lot_size?: number | null;
  quantity?: number | null;
  lots?: number | null;
  exited?: boolean;
  exit_price?: number | null;
  pnl?: number | null;
};
type StrategyItem = {
  _id: string;
  strategy_name?: string;
  instrument?: string;
  saved_at?: string;
  realized_pnl?: number;
  position_count?: number;
  all_exited?: boolean;
  positions?: StrategyPosition[];
};
type SpotCard = {
  code: string;
  instrument: string;
  spot: number | null;
  atm: number | null;
};
type LiveChainRow = {
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
};
type LiveChainResponse = {
  instrument?: string;
  expiries?: string[];
  expiry?: string;
  india_vix?: number;
  spot_price?: number;
  chain?: { CE?: LiveChainRow[]; PE?: LiveChainRow[] };
};

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).replace(",", ",");
}

function formatSigned(value: number) {
  if (Math.abs(value) < 0.005) return "0.00";
  const sign = value > 0 ? "+" : "-";
  return `${sign}${Math.abs(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getValueClass(value: number) {
  if (value > 0) return "text-[#20a55a]";
  if (value < 0) return "text-[#e05454]";
  return "text-[#334155]";
}

function instrumentLabel(value?: string) {
  if (!value) return "—";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function nearestStrike(strikes: number[], spot: number) {
  if (!strikes.length) return null;
  return strikes.reduce((best, current) => Math.abs(current - spot) < Math.abs(best - spot) ? current : best, strikes[0]);
}


export default function SimulatorPortfolioPage() {
  const navigate = useNavigate();
  const [portfolios, setPortfolios] = useState<string[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState("");
  const [strategies, setStrategies] = useState<StrategyItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [spots, setSpots] = useState<SpotCard[]>(SPOT_SYMBOLS.map((item) => ({ ...item, spot: null, atm: null })));
  const [refresh, setRefresh] = useState(REFRESH_SECONDS);
  const [countdown, setCountdown] = useState(REFRESH_SECONDS);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [expandedStrategyId, setExpandedStrategyId] = useState<string | null>(null);
  const [strategyDetails, setStrategyDetails] = useState<Record<string, StrategyItem>>({});
  const [livePriceMap, setLivePriceMap] = useState<Record<string, number>>({});
  const [liveChainMap, setLiveChainMap] = useState<Record<string, LiveChainResponse>>({});
  const liveRefreshInFlightRef = useRef(false);

  function getQuoteKey(instrument?: string, expiry?: string, strike?: number, optionType?: string) {
    return [
      String(instrument || "").toUpperCase(),
      String(expiry || ""),
      String(Number(strike || 0)),
      String(optionType || "").toUpperCase(),
    ].join("|");
  }

  function getLivePrice(position: StrategyPosition, instrument?: string) {
    const optionType = String(position.option_type || "").toLowerCase();
    const normalizedType = optionType === "call" || optionType === "ce" ? "CE" : "PE";
    const key = getQuoteKey(instrument, position.expiry, Number(position.strike || 0), normalizedType);
    return livePriceMap[key];
  }

  function calcOpenPositionPnl(position: StrategyPosition, instrument?: string) {
    const livePrice = getLivePrice(position, instrument);
    const entryPrice = Number(position.entry_price || 0);
    const qty = Number(position.quantity || 0) || Number(position.lots || 1) * Number(position.lot_size || 75);
    const type = String(position.type || "sell").toLowerCase();
    const priceToUse = livePrice ?? entryPrice;
    return type === "buy" ? (priceToUse - entryPrice) * qty : (entryPrice - priceToUse) * qty;
  }

  async function refreshLivePrices(detailMap: Record<string, StrategyItem>) {
    if (liveRefreshInFlightRef.current) return;
    liveRefreshInFlightRef.current = true;
    const chainRequests = new Map<string, { instrument: string }>();
    Object.values(detailMap).forEach((strategy) => {
      const instrument = String(strategy.instrument || "").toUpperCase();
      (strategy.positions || []).forEach((position) => {
        if (position.exited || !instrument) return;
        if (!chainRequests.has(instrument)) chainRequests.set(instrument, { instrument });
      });
    });

    if (!chainRequests.size) {
      setLivePriceMap({});
      setLastUpdated(new Date());
      liveRefreshInFlightRef.current = false;
      return;
    }

    try {
      const chainResponses = await Promise.all(
        Array.from(chainRequests.values()).map(async ({ instrument }) => {
          try {
            const response = await fetch(`${API_BASE}/live-greeks-chain/${instrument}`);
            const data = await response.json().catch(() => null) as LiveChainResponse | null;
            if (!response.ok || !data) return null;
            return { instrument, expiry: String(data.expiry || ""), data };
          } catch {
            return null;
          }
        }),
      );

      const nextLiveMap: Record<string, number> = {};
      const nextChainMap: Record<string, LiveChainResponse> = {};
      chainResponses.forEach((result) => {
        if (!result?.data?.chain) return;
        nextChainMap[result.instrument] = result.data;
        (result.data.chain.CE || []).forEach((row) => {
          nextLiveMap[getQuoteKey(result.instrument, result.expiry, row.strike, "CE")] = Number(row.ltp || 0);
        });
        (result.data.chain.PE || []).forEach((row) => {
          nextLiveMap[getQuoteKey(result.instrument, result.expiry, row.strike, "PE")] = Number(row.ltp || 0);
        });
      });
      setLivePriceMap((previous) => ({ ...previous, ...nextLiveMap }));
      setLiveChainMap((previous) => ({ ...previous, ...nextChainMap }));
      setLastUpdated(new Date());
    } finally {
      liveRefreshInFlightRef.current = false;
    }
  }

  async function hydrateLiveStrategyData(strategyList: StrategyItem[]) {
    if (!strategyList.length) {
      setStrategyDetails({});
      setLivePriceMap({});
      return;
    }

    const detailResults = await Promise.all(
      strategyList.map(async (strategy) => {
        try {
          const response = await fetch(`${PAPER_TRADE_API_BASE}/strategies/${encodeURIComponent(strategy._id)}`);
          const data = await response.json().catch(() => null) as { status?: string; strategy?: StrategyItem } | null;
          if (!response.ok || data?.status === "error" || !data?.strategy) return [strategy._id, strategy] as const;
          return [strategy._id, data.strategy] as const;
        } catch {
          return [strategy._id, strategy] as const;
        }
      }),
    );

    const detailMap = Object.fromEntries(detailResults);
    setStrategyDetails(detailMap);
    await refreshLivePrices(detailMap);
  }

  async function fetchPortfolios(keepSelection = true) {
    const response = await fetch(`${PAPER_TRADE_API_BASE}/portfolios`);
    const data = await response.json().catch(() => null) as { status?: string; portfolios?: PortfolioApiItem[]; detail?: string } | null;
    if (!response.ok || data?.status === "error") {
      throw new Error(data?.detail || "Failed to load portfolios");
    }
    const list = Array.isArray(data?.portfolios)
      ? data!.portfolios
          .map((item) => String(item?.name || item?.portfolio_name || "").trim())
          .filter(Boolean)
      : [];
    setPortfolios(list);
    setSelectedPortfolio((current) => {
      if (keepSelection && current && list.includes(current)) return current;
      return list[0] || "";
    });
    return list;
  }

  async function fetchStrategies(portfolioName: string, background = false) {
    if (!portfolioName) {
      setStrategies([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (background) setRefreshing(true);
    else {
      setLoading(true);
      setError("");
    }
    try {
      const response = await fetch(`${PAPER_TRADE_API_BASE}/strategies?portfolio_name=${encodeURIComponent(portfolioName)}`);
      const data = await response.json().catch(() => null) as { status?: string; strategies?: StrategyItem[]; detail?: string } | null;
      if (!response.ok || data?.status === "error") {
        throw new Error(data?.detail || "Failed to load strategies");
      }
      const strategyList = Array.isArray(data?.strategies) ? data!.strategies : [];
      setStrategies(strategyList);
      setExpandedStrategyId((current) => strategyList.some((item) => item._id === current) ? current : null);
      await hydrateLiveStrategyData(strategyList);
    } catch (fetchError) {
      if (!background) {
        setStrategies([]);
        setExpandedStrategyId(null);
        setStrategyDetails({});
        setLivePriceMap({});
      }
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load strategies");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleTogglePositions(strategyId: string) {
    setExpandedStrategyId((current) => current === strategyId ? null : strategyId);
  }

  async function handleStrategyMetadataChanged() {
    try {
      await fetchPortfolios(true);
      await fetchStrategies(selectedPortfolio, true);
    } catch {
      // keep current quick overview usable even if parent refresh fails
    }
  }

  async function fetchSpots() {
    const results = await Promise.all(
      SPOT_SYMBOLS.map(async ({ code, instrument }) => {
        try {
          const response = await fetch(`${API_BASE}/live-greeks-chain/${instrument}`);
          const data = await response.json().catch(() => null) as {
            spot_price?: number;
            chain?: { CE?: Array<{ strike: number }>; PE?: Array<{ strike: number }> };
          } | null;
          if (!response.ok || !data) throw new Error("spot");
          const strikes = [
            ...(data.chain?.CE ?? []).map((item) => Number(item.strike)),
            ...(data.chain?.PE ?? []).map((item) => Number(item.strike)),
          ].filter((item) => !Number.isNaN(item));
          const spot = Number(data.spot_price ?? 0);
          return { code, instrument, spot: spot || null, atm: spot ? nearestStrike(strikes, spot) : null };
        } catch {
          return { code, instrument, spot: null, atm: null };
        }
      }),
    );
    setSpots(results);
  }

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        await fetchPortfolios(false);
        if (!active) return;
        await fetchSpots();
      } catch (loadError) {
        if (!active) return;
        setPortfolios([]);
        setStrategies([]);
        setLoading(false);
        setError(loadError instanceof Error ? loadError.message : "Failed to load data");
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedPortfolio) return;
    fetchStrategies(selectedPortfolio);
  }, [selectedPortfolio]);

  useEffect(() => {
    if (refresh === 0) {
      setCountdown(0);
      return;
    }

    setCountdown(refresh);
    const tick = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          const hasDetails = Object.keys(strategyDetails).length > 0;
          if (hasDetails) {
            setRefreshing(true);
            refreshLivePrices(strategyDetails)
              .catch(() => undefined)
              .finally(() => setRefreshing(false));
          }
          return refresh;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [refresh, strategyDetails]);

  const filteredStrategies = strategies.filter((strategy) =>
    String(strategy.strategy_name || "").toLowerCase().includes(search.toLowerCase()),
  );

  let totalPnl = 0;
  let unrealizedPnl = 0;
  let realizedPnl = 0;

  filteredStrategies.forEach((strategy) => {
    const realized = Number(strategy.realized_pnl || 0);
    const detail = strategyDetails[strategy._id] ?? strategy;
    const unrealized = Array.isArray(detail.positions)
      ? detail.positions.reduce((sum, position) => sum + (!position.exited ? calcOpenPositionPnl(position, detail.instrument || strategy.instrument) : 0), 0)
      : 0;
    realizedPnl += realized;
    unrealizedPnl += unrealized;
    totalPnl += realized + unrealized;
  });

  return (
    <>
      <PageMeta title="Simulator Portfolio" description="Paper trade portfolio strategy list" />

      <div className="min-h-screen bg-[#f3f6fb] px-4 py-4 md:px-6">
        <div className="overflow-hidden rounded-[14px] border border-[#d7dfeb] bg-white shadow-[0_12px_30px_rgba(27,39,70,0.08)]">
          <div className="bg-[#233f69] px-5 py-3 text-[29px] font-semibold text-white">Portfolio</div>

          <div className="border-b border-[#dce4ef] bg-[#fdfefe] px-4 py-2.5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="min-w-[112px] rounded-md border border-[#d7dce5] bg-white px-3 py-2 text-left text-[14px] text-[#475569]"
                >
                  All Index
                </button>
                <div className="text-[14px] text-[#4b5563]">
                  {lastUpdated.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}, {" "}
                  {lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}
                </div>
                {refresh > 0 && <div className="text-[14px] text-[#20a55a]">Update in 00:{String(countdown).padStart(2, "0")}</div>}
                <select
                  value={refresh}
                  onChange={(e) => setRefresh(Number(e.target.value))}
                  className="rounded-md border border-[#d7dce5] bg-white px-3 py-2 text-[13px] text-[#475569] outline-none"
                >
                  {REFRESH_OPTS.map((option) => (
                    <option key={option.v} value={option.v}>{option.l}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-5">
                {spots.map((spot) => (
                  <div key={spot.code} className="min-w-[78px]">
                    <div className="flex items-center gap-1 text-[12px] font-semibold text-[#334155]">
                      <span className="text-[#64748b]">{spot.code}:</span>
                      <span>{spot.spot != null ? Number(spot.spot.toFixed(2)).toLocaleString("en-IN") : "—"}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-[#94a3b8]">
                      ATM: {spot.atm != null ? spot.atm.toLocaleString("en-IN") : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border-b border-[#dce4ef] bg-white px-4 py-2.5">
            <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={selectedPortfolio}
                  onChange={(e) => setSelectedPortfolio(e.target.value)}
                  className="min-w-[196px] rounded-md border border-[#cfd8e3] bg-white px-3 py-2 text-[14px] text-[#475569] outline-none"
                >
                  {portfolios.length === 0 && <option value="">No portfolios</option>}
                  {portfolios.map((portfolio) => (
                    <option key={portfolio} value={portfolio}>{portfolio}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => navigate("/simulator/paper-trade")}
                  className="text-[15px] font-medium text-[#1290ff] hover:text-[#0b74d1]"
                >
                  + Add Strategy
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-6 text-[14px]">
                <div className="text-[#6b7280]">Total P&amp;L: <span className={`font-semibold ${getValueClass(totalPnl)}`}>{formatSigned(totalPnl)}</span></div>
                <div className="text-[#6b7280]">Unrealized P&amp;L: <span className={`font-semibold ${getValueClass(unrealizedPnl)}`}>{formatSigned(unrealizedPnl)}</span></div>
                <div className="text-[#6b7280]">Realized P&amp;L: <span className={`font-semibold ${getValueClass(realizedPnl)}`}>{formatSigned(realizedPnl)}</span></div>
                {refreshing && <div className="text-[#20a55a]">Refreshing...</div>}
              </div>
            </div>
          </div>

          <div className="border-b border-[#e5ebf3] bg-[#fbfdff] px-4 py-3">
            <div className="flex justify-end">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Strategy By Name..."
                className="w-full max-w-[320px] rounded-md border border-[#d1d9e5] bg-white px-4 py-2.5 text-[14px] text-[#475569] outline-none placeholder:text-[#9aa6b2]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-[#fbfcfe] text-left text-[14px] font-semibold text-[#667085]">
                  <th className="border-b border-r border-[#dbe4ef] px-4 py-3 text-center"><input type="checkbox" /></th>
                  <th className="border-b border-r border-[#dbe4ef] px-4 py-3">Strategy Name</th>
                  <th className="border-b border-r border-[#dbe4ef] px-4 py-3">Index</th>
                  <th className="border-b border-r border-[#dbe4ef] px-4 py-3">Created On</th>
                  <th className="border-b border-r border-[#dbe4ef] px-4 py-3">Unrealized P&amp;L</th>
                  <th className="border-b border-r border-[#dbe4ef] px-4 py-3">Realized P&amp;L</th>
                  <th className="border-b border-r border-[#dbe4ef] px-4 py-3">Total P&amp;L</th>
                  <th className="border-b border-[#dbe4ef] px-4 py-3 text-center">Live</th>
                  <th className="border-b border-r border-[#dbe4ef] px-4 py-3 text-center">Positions</th>
                  <th className="border-b border-[#dbe4ef] px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-[14px] text-[#94a3b8]">Loading strategies...</td>
                  </tr>
                )}
                {!loading && error && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-[14px] text-[#e05454]">{error}</td>
                  </tr>
                )}
                {!loading && !error && filteredStrategies.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-[14px] text-[#94a3b8]">
                      {search ? "No strategies match your search" : "No strategies found for this portfolio"}
                    </td>
                  </tr>
                )}
                {!loading && !error && filteredStrategies.map((strategy) => {
                  const realized = Number(strategy.realized_pnl || 0);
                  const positionCount = Number(strategy.position_count ?? strategy.positions?.length ?? 0);
                  const detail = strategyDetails[strategy._id] ?? strategy;
                  const unrealized = Array.isArray(detail.positions)
                    ? detail.positions.reduce((sum, position) => sum + (!position.exited ? calcOpenPositionPnl(position, detail.instrument || strategy.instrument) : 0), 0)
                    : 0;
                  const total = realized + unrealized;
                  const isExpanded = expandedStrategyId === strategy._id;
                  return (
                    <>
                      <tr key={strategy._id} className="text-[15px] text-[#334155] hover:bg-[#fafcff]">
                        <td className="border-b border-r border-[#e1e8f0] px-4 py-4 text-center"><input type="checkbox" /></td>
                        <td className="border-b border-r border-[#e1e8f0] px-4 py-4 font-semibold text-[#1f2937]">{strategy.strategy_name || "Unnamed Strategy"}</td>
                        <td className="border-b border-r border-[#e1e8f0] px-4 py-4">{instrumentLabel(strategy.instrument)}</td>
                        <td className="border-b border-r border-[#e1e8f0] px-4 py-4 text-[#475569]">{formatDate(strategy.saved_at)}</td>
                        <td className={`border-b border-r border-[#e1e8f0] px-4 py-4 font-semibold ${getValueClass(unrealized)}`}>{unrealized === 0 ? "—" : formatSigned(unrealized)}</td>
                        <td className={`border-b border-r border-[#e1e8f0] px-4 py-4 font-semibold ${getValueClass(realized)}`}>{formatSigned(realized)}</td>
                        <td className={`border-b border-r border-[#e1e8f0] px-4 py-4 font-semibold ${getValueClass(total)}`}>{formatSigned(total)}</td>
                        <td className="border-b border-r border-[#e1e8f0] px-4 py-4 text-center">
                          <span className={`inline-block h-2.5 w-2.5 rounded-full ${strategy.all_exited ? "bg-[#ef4444]" : "bg-[#22c55e]"}`} />
                        </td>
                        <td className="border-b border-r border-[#e1e8f0] px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleTogglePositions(strategy._id)}
                            className="rounded-md border border-[#1098ff] px-3 py-1.5 text-[13px] font-medium text-[#1098ff] hover:bg-[#f0f9ff]"
                          >
                            {positionCount} Position{positionCount === 1 ? "" : "s"} ›
                          </button>
                        </td>
                        <td className="border-b border-[#e1e8f0] px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-2 text-[14px]">
                            <button
                              type="button"
                              onClick={() => navigate(`/analyse/strategy/${encodeURIComponent(strategy._id)}`)}
                              className="font-medium text-[#1098ff] hover:text-[#0b74d1]"
                            >
                              Analyze
                            </button>
                            <span className="text-[#c4cfdb]">+</span>
                            <button
                              type="button"
                              className="font-medium text-[#1098ff] hover:text-[#0b74d1]"
                            >
                              Notes
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={10} className="border-b border-[#d9e4f0] bg-[#f8fbff] px-5 py-4">
                            <div className="overflow-visible rounded-[12px] border border-[#d7dfeb] bg-white shadow-[0_8px_20px_rgba(27,39,70,0.08)]">
                              <div className="flex items-center justify-between border-b border-[#e5edf5] bg-[#f8fbff] px-4 py-3">
                                <div>
                                  <div className="text-[14px] font-semibold text-[#233f69]">{strategy.strategy_name || "Strategy"} Quick Overview</div>
                                  <div className="mt-1 text-[12px] text-[#64748b]">{positionCount} positions • {instrumentLabel(strategy.instrument)} • {formatDate(strategy.saved_at)}</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/simulator/paper-trade/${encodeURIComponent(strategy._id)}`)}
                                  className="rounded-md border border-[#1098ff] px-3 py-1.5 text-[13px] font-medium text-[#1098ff] hover:bg-[#f0f9ff]"
                                >
                                  Open Full View
                                </button>
                              </div>
                              <div className="px-6 pb-5">
                                <PaperTradePage
                                  key={strategy._id}
                                  embeddedStrategyId={strategy._id}
                                  useExternalLiveChain
                                  externalLiveChain={(liveChainMap[String(strategy.instrument || "").toUpperCase()] as any) || null}
                                  onStrategyMetadataChanged={handleStrategyMetadataChanged}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
