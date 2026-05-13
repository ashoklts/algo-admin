import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { useNavigate, useParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:8000/algo";

type Day = "M" | "T" | "W" | "Th" | "F";

type PortfolioStrategy = {
  _id: string;
  name: string;
  underlying?: string;
  product?: string;
  checked?: boolean;
  dte?: number[];
  qty_multiplier?: number;
  slippage?: number;
  weekdays?: Day[];
};

type PortfolioDetail = {
  _id: string;
  name: string;
  strategy_ids: string[];
  qty_multiplier?: number;
  is_weekdays?: boolean;
  strategies: PortfolioStrategy[];
};

type StrategyRow = {
  id: string;
  name: string;
  underlying: string;
  product: string;
  qty_multiplier: number;
  slippage: number;
  dte: number[];
  weekdays: Day[];
  checked: boolean;
};

type ProgressState = {
  visible: boolean;
  percent: number;
  completed: number;
  total: number;
  label: string;
  meta: string;
};

type ResultRow = { label: string; value: string; tone?: "positive" | "negative" | "neutral" };

type BacktestSubTrade = {
  entry_time?: string;
  exit_time?: string;
  entry_price?: number;
  exit_price?: number;
  pnl?: number;
  lots?: number;
  option_type?: string;
  strike?: string | number;
  entry_action?: string;
  exit_action?: string;
  reentry_number?: number | string;
  exit_reason?: string;
};

type BacktestLeg = {
  pnl?: number;
  lots?: number;
  lot_size?: number;
  position?: string;
  type?: string;
  strike?: string | number;
  entry_time?: string;
  exit_time?: string;
  entry_price?: number;
  exit_price?: number;
  exit_reason?: string;
  sub_trades?: BacktestSubTrade[];
};

type BacktestTrade = {
  date?: string;
  entry_time?: string;
  exit_time?: string;
  total_pnl?: number;
  strategy_name?: string;
  legs?: BacktestLeg[];
  _netPnlPrecomputed?: boolean;
};

type PortfolioResultItem = {
  item_id?: string;
  strategy_name?: string;
  results?: {
    trades?: BacktestTrade[];
  };
};

type PortfolioBacktestResult = {
  results?: PortfolioResultItem[];
};

const ALL_WEEKDAYS: Day[] = ["M", "T", "W", "Th", "F"];
const QTY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const DTE_OPTIONS = [0, 1, 2, 3, 4, 5, 6];

function oneYearAgoStr() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function ChevronDown() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-3 w-3 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function Spinner() {
  return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

function ResultValue({
  value,
  tone = "neutral",
}: {
  value: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const toneClass =
    tone === "positive" ? "text-green-600" : tone === "negative" ? "text-red-500" : "text-slate-700";
  return <span className={`font-semibold ${toneClass}`}>{value}</span>;
}

function ResultSummaryTable({ rows }: { rows: ResultRow[] }) {
  return (
    <table className="w-full border-collapse overflow-hidden rounded-lg border border-slate-200 bg-slate-50 xl:w-1/3">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td className="border border-slate-200 px-5 py-2 text-sm text-slate-700">
              {row.label}
              <div className="m-2 text-xs font-medium tracking-wide text-slate-500">
                <b>AlgoTest.in</b>
              </div>
            </td>
            <td className="border border-slate-200 p-2 text-center text-xs font-semibold whitespace-nowrap">
              <ResultValue value={row.value} tone={row.tone} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatChartDateLabel(dateStr: string) {
  const dt = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return dateStr;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function buildTickValues(min: number, max: number, steps = 6) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) return [min];
  const range = max - min;
  return Array.from({ length: steps }, (_, index) => min + (range * index) / (steps - 1));
}

function CumulativePnLChart({ days, values }: { days: string[]; values: number[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltipIndex, setTooltipIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const width = 1100;
  const height = 320;
  const padding = { top: 28, right: 32, bottom: 54, left: 50 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const minValue = Math.min(0, ...values, 0);
  const maxValue = Math.max(0, ...values, 1);
  const yTicks = buildTickValues(minValue, maxValue, 6);
  const xTickIndexes =
    days.length <= 8
      ? days.map((_, idx) => idx)
      : Array.from(new Set([0, Math.floor(days.length * 0.18), Math.floor(days.length * 0.33), Math.floor(days.length * 0.55), Math.floor(days.length * 0.77), days.length - 1]));

  const xForIndex = (index: number) => padding.left + (index / Math.max(days.length - 1, 1)) * innerWidth;
  const yForValue = (value: number) => padding.top + ((maxValue - value) / Math.max(maxValue - minValue || 1, 1)) * innerHeight;
  const points = values.map((value, index) => `${xForIndex(index)},${yForValue(value)}`).join(" ");
  const activeIndex = hoverIndex != null ? Math.max(0, Math.min(values.length - 1, hoverIndex)) : null;
  const activeX = activeIndex != null ? xForIndex(activeIndex) : 0;
  const activeY = activeIndex != null ? yForValue(values[activeIndex] || 0) : 0;
  const visibleTooltipIndex = tooltipIndex != null ? Math.max(0, Math.min(values.length - 1, tooltipIndex)) : null;
  const tooltipX = visibleTooltipIndex != null ? xForIndex(visibleTooltipIndex) : 0;
  const tooltipY = visibleTooltipIndex != null ? yForValue(values[visibleTooltipIndex] || 0) : 0;
  const tooltipLeft = visibleTooltipIndex != null ? Math.min(width - 210, tooltipX + 18) : 0;
  const tooltipTop = visibleTooltipIndex != null ? Math.max(18, tooltipY - 34) : 0;

  const handleMouseMove = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !days.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * width;
    const rawIndex = Math.round(((relativeX - padding.left) / innerWidth) * Math.max(days.length - 1, 1));
    setHoverIndex(Math.max(0, Math.min(days.length - 1, rawIndex)));
  };

  useEffect(() => {
    if (hoverIndex === null) {
      const timeout = window.setTimeout(() => setTooltipIndex(null), 140);
      return () => window.clearTimeout(timeout);
    }
    const frame = window.requestAnimationFrame(() => setTooltipIndex(hoverIndex));
    return () => window.cancelAnimationFrame(frame);
  }, [hoverIndex]);

  return (
    <div className="relative flex h-80 w-full flex-col rounded-xl border border-slate-200 bg-white p-4" data-testid="result-chart">
      <div className="mb-2 flex items-center justify-end">
        <button type="button" className="rounded-md border border-[#0f4c81] px-4 py-2 text-sm font-medium text-[#0f4c81] transition hover:bg-[#0f4c81]/5">
          Reset Zoom
        </button>
      </div>
      <div className="relative flex-1">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="h-full w-full"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {yTicks.map((tick) => {
            const y = yForValue(tick);
            return (
              <g key={tick}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#6b7280">
                  {Math.abs(tick) >= 1000 ? `${Math.round(tick / 1000)}k` : Math.round(tick)}
                </text>
              </g>
            );
          })}
          {xTickIndexes.map((index) => (
            <g key={index}>
              <line x1={xForIndex(index)} y1={padding.top} x2={xForIndex(index)} y2={height - padding.bottom} stroke="#f1f5f9" strokeWidth="1" />
              <text x={xForIndex(index)} y={height - padding.bottom + 22} textAnchor="middle" fontSize="11" fill="#6b7280">
                {formatChartDateLabel(days[index] || "")}
              </text>
            </g>
          ))}
          <text x={20} y={height / 2} textAnchor="middle" fontSize="11" fill="#6b7280" transform={`rotate(-90 20 ${height / 2})`}>
            Cumulative PnL
          </text>
          <polyline points={points} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {activeIndex != null ? (
            <g>
              <line x1={activeX} y1={padding.top} x2={activeX} y2={height - padding.bottom} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" />
              <circle cx={activeX} cy={activeY} r="5.5" fill="#ffffff" stroke="#22c55e" strokeWidth="2" />
            </g>
          ) : null}
        </svg>
        <div
          className={`pointer-events-none absolute z-10 rounded-md bg-[#2f3136] px-3 py-2 text-white shadow-lg transition-[left,top,opacity,transform] duration-300 ease-out ${
            visibleTooltipIndex != null ? "translate-y-0 scale-100 opacity-100" : "translate-y-1 scale-95 opacity-0"
          }`}
          style={{ left: `${(tooltipLeft / width) * 100}%`, top: `${(tooltipTop / height) * 100}%`, minWidth: 156 }}
        >
          {visibleTooltipIndex != null ? (
            <>
              <div className="mb-1 text-[12px] font-semibold">{formatChartDateLabel(days[visibleTooltipIndex] || "")}</div>
              <div className="flex items-center gap-2 text-[12px]">
                <span className="inline-block h-3 w-3 border-2 border-[#22c55e] bg-white" />
                <span>Cumulative PnL: {Math.round(values[visibleTooltipIndex] || 0).toLocaleString("en-IN")}</span>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DrawdownChart({ days, values }: { days: string[]; values: number[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltipIndex, setTooltipIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const width = 1100;
  const height = 320;
  const padding = { top: 42, right: 32, bottom: 26, left: 50 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const minValue = Math.min(...values, -1);
  const maxValue = Math.max(0, ...values);
  const yTicks = buildTickValues(minValue, maxValue, 6);
  const xTickIndexes =
    days.length <= 8
      ? days.map((_, idx) => idx)
      : Array.from(new Set([0, Math.floor(days.length * 0.18), Math.floor(days.length * 0.33), Math.floor(days.length * 0.55), Math.floor(days.length * 0.77), days.length - 1]));

  const xForIndex = (index: number) => padding.left + (index / Math.max(days.length - 1, 1)) * innerWidth;
  const yForValue = (value: number) => padding.top + ((maxValue - value) / Math.max(maxValue - minValue || 1, 1)) * innerHeight;
  const points = values.map((value, index) => `${xForIndex(index)},${yForValue(value)}`).join(" ");
  const activeIndex = hoverIndex != null ? Math.max(0, Math.min(values.length - 1, hoverIndex)) : null;
  const activeX = activeIndex != null ? xForIndex(activeIndex) : 0;
  const activeY = activeIndex != null ? yForValue(values[activeIndex] || 0) : 0;
  const visibleTooltipIndex = tooltipIndex != null ? Math.max(0, Math.min(values.length - 1, tooltipIndex)) : null;
  const tooltipX = visibleTooltipIndex != null ? xForIndex(visibleTooltipIndex) : 0;
  const tooltipY = visibleTooltipIndex != null ? yForValue(values[visibleTooltipIndex] || 0) : 0;
  const tooltipLeft = visibleTooltipIndex != null ? Math.min(width - 190, tooltipX + 18) : 0;
  const tooltipTop = visibleTooltipIndex != null ? Math.max(18, tooltipY - 34) : 0;

  const handleMouseMove = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !days.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * width;
    const rawIndex = Math.round(((relativeX - padding.left) / innerWidth) * Math.max(days.length - 1, 1));
    setHoverIndex(Math.max(0, Math.min(days.length - 1, rawIndex)));
  };

  useEffect(() => {
    if (hoverIndex === null) {
      const timeout = window.setTimeout(() => setTooltipIndex(null), 140);
      return () => window.clearTimeout(timeout);
    }
    const frame = window.requestAnimationFrame(() => setTooltipIndex(hoverIndex));
    return () => window.cancelAnimationFrame(frame);
  }, [hoverIndex]);

  return (
    <div className="relative flex h-80 w-full flex-col rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-end">
        <button type="button" className="rounded-md border border-[#0f4c81] px-4 py-2 text-sm font-medium text-[#0f4c81] transition hover:bg-[#0f4c81]/5">
          Reset Zoom
        </button>
      </div>
      <div className="relative flex-1">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="h-full w-full"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {xTickIndexes.map((index) => (
            <g key={index}>
              <line x1={xForIndex(index)} y1={padding.top} x2={xForIndex(index)} y2={height - padding.bottom} stroke="#f1f5f9" strokeWidth="1" />
              <text x={xForIndex(index)} y={18} textAnchor="middle" fontSize="11" fill="#6b7280">
                {formatChartDateLabel(days[index] || "")}
              </text>
            </g>
          ))}
          {yTicks.map((tick) => {
            const y = yForValue(tick);
            return (
              <g key={tick}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#6b7280">
                  {Math.abs(tick) >= 1000 ? `${Math.round(tick / 1000)}k` : Math.round(tick)}
                </text>
              </g>
            );
          })}
          <text x={12} y={height / 2} textAnchor="middle" fontSize="11" fill="#6b7280" transform={`rotate(-90 12 ${height / 2})`}>
            Drawdown
          </text>
          <polyline points={points} fill="none" stroke="#ff4d4f" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {activeIndex != null ? (
            <g>
              <line x1={activeX} y1={padding.top} x2={activeX} y2={height - padding.bottom} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" />
              <circle cx={activeX} cy={activeY} r="5.5" fill="#ffffff" stroke="#ff4d4f" strokeWidth="2" />
            </g>
          ) : null}
        </svg>
        <div
          className={`pointer-events-none absolute z-10 rounded-md bg-[#2f3136] px-3 py-2 text-white shadow-lg transition-[left,top,opacity,transform] duration-300 ease-out ${
            visibleTooltipIndex != null ? "translate-y-0 scale-100 opacity-100" : "translate-y-1 scale-95 opacity-0"
          }`}
          style={{ left: `${(tooltipLeft / width) * 100}%`, top: `${(tooltipTop / height) * 100}%`, minWidth: 148 }}
        >
          {visibleTooltipIndex != null ? (
            <>
              <div className="mb-1 text-[12px] font-semibold">{formatChartDateLabel(days[visibleTooltipIndex] || "")}</div>
              <div className="flex items-center gap-2 text-[12px]">
                <span className="inline-block h-3 w-3 border-2 border-[#ff4d4f] bg-white" />
                <span>Drawdown: {Math.round(values[visibleTooltipIndex] || 0).toLocaleString("en-IN")}</span>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function formatMoney(value: number) {
  const abs = Math.abs(Number(value || 0));
  return `${value < 0 ? "₹ -" : "₹ "}${abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateLabel(dateStr?: string) {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

function getTradePnl(trade: BacktestTrade) {
  if (trade._netPnlPrecomputed) return Number(trade.total_pnl || 0);
  if (Number.isFinite(Number(trade.total_pnl))) return Number(trade.total_pnl);
  return (trade.legs ?? []).reduce((sum, leg) => sum + Number(leg.pnl || 0), 0);
}

function buildCombinedTrades(result: PortfolioBacktestResult, rows: StrategyRow[]) {
  const nameMap = Object.fromEntries(rows.map((row) => [row.id, row.name]));
  const byDate: Record<string, BacktestTrade> = {};
  const strategyResults = Array.isArray(result.results) ? result.results : [];

  strategyResults.forEach((item) => {
    const strategyName = item.strategy_name || nameMap[String(item.item_id || "")] || "Strategy";
    const trades = Array.isArray(item.results?.trades) ? item.results?.trades : [];
    trades.forEach((trade) => {
      if (!trade?.date) return;
      if (!byDate[trade.date]) {
        byDate[trade.date] = {
          date: trade.date,
          entry_time: trade.entry_time || "",
          exit_time: trade.exit_time || "",
          total_pnl: 0,
          _netPnlPrecomputed: true,
          strategy_name: strategyName,
          legs: [],
        };
      }
      byDate[trade.date].total_pnl = Number(byDate[trade.date].total_pnl || 0) + getTradePnl(trade);
    });
  });

  return Object.values(byDate).sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
}

function buildChartSeries(trades: BacktestTrade[]) {
  const pnlByDay: Record<string, number> = {};
  trades.forEach((trade) => {
    if (!trade.date) return;
    pnlByDay[trade.date] = (pnlByDay[trade.date] || 0) + getTradePnl(trade);
  });
  const days = Object.keys(pnlByDay).sort();
  const cumulative: number[] = [];
  const drawdowns: number[] = [];
  let cum = 0;
  let peak = 0;
  days.forEach((day) => {
    cum += pnlByDay[day];
    peak = Math.max(peak, cum);
    cumulative.push(Number(cum.toFixed(2)));
    drawdowns.push(Number((cum - peak).toFixed(2)));
  });
  return { days, cumulative, drawdowns };
}

function computeYearWise(trades: BacktestTrade[]) {
  const byYear: Record<string, { months: Record<number, number> }> = {};
  const pnlByDay: Record<string, number> = {};

  trades.forEach((trade) => {
    if (!trade.date) return;
    const [yearStr, monthStr] = trade.date.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const tradePnl = getTradePnl(trade);
    if (!byYear[year]) {
      byYear[year] = { months: {} };
      for (let i = 1; i <= 12; i += 1) byYear[year].months[i] = 0;
    }
    byYear[year].months[month] += tradePnl;
    pnlByDay[trade.date] = (pnlByDay[trade.date] || 0) + tradePnl;
  });

  return Object.keys(byYear).sort().map((year) => {
    const yearDays = Object.keys(pnlByDay).filter((day) => day.startsWith(`${year}-`)).sort();
    let cumulative = 0;
    let peak = 0;
    let drawdownStartCandidate = yearDays[0] || "";
    let maxDrawdown = 0;
    let mddStart = yearDays[0] || "";
    let mddEnd = yearDays[0] || "";

    yearDays.forEach((day) => {
      cumulative += pnlByDay[day];
      if (cumulative >= peak) {
        peak = cumulative;
        drawdownStartCandidate = day;
      }
      const drawdown = cumulative - peak;
      if (drawdown < maxDrawdown) {
        maxDrawdown = drawdown;
        mddStart = drawdownStartCandidate;
        mddEnd = day;
      }
    });

    const total = Object.values(byYear[year].months).reduce((sum, value) => sum + value, 0);
    const days = mddStart && mddEnd ? Math.round((new Date(mddEnd).getTime() - new Date(mddStart).getTime()) / 86400000) + 1 : 0;
    return {
      year,
      months: Array.from({ length: 12 }, (_, i) => byYear[year].months[i + 1] || 0),
      total,
      maxDrawdown,
      days: days || 1,
      ratio: maxDrawdown !== 0 ? Math.abs(total / maxDrawdown).toFixed(2) : "—",
    };
  });
}

function computeSummary(trades: BacktestTrade[]) {
  const pnls = trades.map((trade) => getTradePnl(trade));
  const totalProfit = pnls.reduce((sum, pnl) => sum + pnl, 0);
  const winningTrades = pnls.filter((pnl) => pnl > 0);
  const losingTrades = pnls.filter((pnl) => pnl < 0);
  const tradeCount = pnls.length;
  const avgProfit = tradeCount ? totalProfit / tradeCount : 0;
  const avgWin = winningTrades.length ? winningTrades.reduce((sum, pnl) => sum + pnl, 0) / winningTrades.length : 0;
  const avgLoss = losingTrades.length ? losingTrades.reduce((sum, pnl) => sum + pnl, 0) / losingTrades.length : 0;
  const maxProfit = tradeCount ? Math.max(...pnls) : 0;
  const maxLoss = tradeCount ? Math.min(...pnls) : 0;
  const winPct = tradeCount ? (winningTrades.length / tradeCount) * 100 : 0;
  const lossPct = tradeCount ? (losingTrades.length / tradeCount) * 100 : 0;

  let cumulative = 0;
  let peak = 0;
  let drawdownStartCandidate = trades[0]?.date || "";
  let maxDrawdown = 0;
  let maxDrawdownStart = trades[0]?.date || "";
  let maxDrawdownEnd = trades[0]?.date || "";
  let activeDrawdownTrades = 0;
  let maxTradesInDrawdown = 0;
  let winStreak = 0;
  let maxWinStreak = 0;
  let lossStreak = 0;
  let maxLossStreak = 0;

  trades.forEach((trade) => {
    const pnl = getTradePnl(trade);
    if (pnl > 0) {
      winStreak += 1;
      lossStreak = 0;
    } else if (pnl < 0) {
      lossStreak += 1;
      winStreak = 0;
    } else {
      winStreak = 0;
      lossStreak = 0;
    }
    maxWinStreak = Math.max(maxWinStreak, winStreak);
    maxLossStreak = Math.max(maxLossStreak, lossStreak);

    cumulative += pnl;
    if (cumulative >= peak) {
      peak = cumulative;
      drawdownStartCandidate = trade.date || "";
      activeDrawdownTrades = 0;
    }
    const drawdown = cumulative - peak;
    if (drawdown < 0) {
      activeDrawdownTrades += 1;
      maxTradesInDrawdown = Math.max(maxTradesInDrawdown, activeDrawdownTrades);
    }
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownStart = drawdownStartCandidate;
      maxDrawdownEnd = trade.date || "";
    }
  });

  const expectancy = tradeCount ? ((winPct / 100) * avgWin) + ((lossPct / 100) * avgLoss) : 0;
  const rewardToRisk = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;
  const expectancyRatio = avgLoss !== 0 ? Math.abs(expectancy / avgLoss) : 0;
  const returnToMaxDD = maxDrawdown !== 0 ? Math.abs(totalProfit / maxDrawdown) : 0;
  const durationDays = maxDrawdownStart && maxDrawdownEnd ? Math.round((new Date(maxDrawdownEnd).getTime() - new Date(maxDrawdownStart).getTime()) / 86400000) + 1 : 0;

  return {
    left: [
      { label: "Overall Profit", value: formatMoney(totalProfit), tone: totalProfit < 0 ? "negative" as const : "positive" as const},
      { label: "No. of Trades", value: String(tradeCount) },
      { label: "Average Profit per Trade", value: formatMoney(avgProfit), tone: avgProfit < 0 ? "negative" as const : "positive" as const},
      { label: "Win %", value: formatNumber(winPct) },
      { label: "Loss %", value: formatNumber(lossPct) },
      { label: "Average Profit on Winning Trades", value: formatMoney(avgWin), tone: avgWin < 0 ? "negative" as const : "positive" as const},
    ],
    middle: [
      { label: "Average Loss on Losing Trades", value: formatMoney(avgLoss), tone: "negative" as const },
      { label: "Max Profit in Single Trade", value: formatMoney(maxProfit), tone: maxProfit < 0 ? "negative" as const : "positive" as const},
      { label: "Max Loss in Single Trade", value: formatMoney(maxLoss), tone: "negative" as const },
      { label: "Max Drawdown", value: formatMoney(maxDrawdown), tone: "negative" as const },
      { label: "Duration of Max Drawdown", value: `${durationDays} [${dateLabel(maxDrawdownStart)} to ${dateLabel(maxDrawdownEnd)}]` },
    ],
    right: [
      { label: "Return/MaxDD", value: formatNumber(returnToMaxDD) },
      { label: "Reward to Risk Ratio", value: formatNumber(rewardToRisk) },
      { label: "Expectancy Ratio", value: formatNumber(expectancyRatio) },
      { label: "Max Win Streak (trades)", value: String(maxWinStreak) },
      { label: "Max Losing Streak (trades)", value: String(maxLossStreak) },
      { label: "Max trades in any drawdown", value: String(maxTradesInDrawdown) },
    ],
  };
}

function ActionButton({
  children,
  onClick,
  disabled,
  variant = "secondary",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "secondary" | "primary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        variant === "primary"
          ? "bg-green-600 text-white hover:bg-green-700"
          : "border border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

export default function Portfolio() {
  const { portfolioId } = useParams<{ portfolioId: string }>();
  const navigate = useNavigate();
  const resultSectionRef = useRef<HTMLDivElement | null>(null);

  const [portfolioName, setPortfolioName] = useState("Portfolio");
  const [rows, setRows] = useState<StrategyRow[]>([]);
  const [portfolioQty, setPortfolioQty] = useState(1);
  const [isWeekdays, setIsWeekdays] = useState(true);
  const [startDate, setStartDate] = useState(oneYearAgoStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [includePreviousRegime, setIncludePreviousRegime] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [progress, setProgress] = useState<ProgressState>({
    visible: false,
    percent: 0,
    completed: 0,
    total: 0,
    label: "Running Backtest...",
    meta: "Preparing backtest...",
  });
  const [result, setResult] = useState<PortfolioBacktestResult | null>(null);

  useEffect(() => {
    if (!portfolioId) return;
    let active = true;
    setLoading(true);
    setError("");

    fetch(`${API_BASE}/portfolio/${portfolioId}`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Failed to load portfolio");
        return data as PortfolioDetail;
      })
      .then((data) => {
        if (!active) return;
        setPortfolioName(data.name || "Portfolio");
        setPortfolioQty(Number(data.qty_multiplier || 1));
        setIsWeekdays(Boolean(data.is_weekdays));
        setRows(
          (Array.isArray(data.strategies) ? data.strategies : []).map((strategy) => ({
            id: strategy._id,
            name: strategy.name || "",
            underlying: strategy.underlying || "",
            product: strategy.product || "INTRADAY",
            qty_multiplier: Number(strategy.qty_multiplier || 1),
            slippage: Number(strategy.slippage || 0),
            dte: Array.isArray(strategy.dte) && strategy.dte.length ? strategy.dte.map((value) => Number(value)) : [0],
            weekdays: Array.isArray(strategy.weekdays) && strategy.weekdays.length ? strategy.weekdays : ALL_WEEKDAYS,
            checked: Boolean(strategy.checked ?? true),
          })),
        );
      })
      .catch((err: Error) => {
        if (active) setError(err.message || "Failed to load portfolio");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [portfolioId]);

  const checkedCount = useMemo(() => rows.filter((row) => row.checked).length, [rows]);
  const combinedTrades = useMemo(() => (result ? buildCombinedTrades(result, rows) : []), [result, rows]);
  const chartSeries = useMemo(() => buildChartSeries(combinedTrades), [combinedTrades]);
  const yearWise = useMemo(() => computeYearWise(combinedTrades), [combinedTrades]);
  const summary = useMemo(() => computeSummary(combinedTrades), [combinedTrades]);
  const fullReport = useMemo(
    () =>
      combinedTrades.map((trade, index) => ({
        id: index + 1,
        date: trade.date || "",
        entryTime: trade.entry_time || "-",
        exitTime: trade.exit_time || "-",
        pnl: getTradePnl(trade),
      })),
    [combinedTrades],
  );

  const updateRow = (id: string, updater: (row: StrategyRow) => StrategyRow) => {
    setRows((current) => current.map((row) => (row.id === id ? updater(row) : row)));
  };

  const handleSave = async (saveAsNew = false) => {
    if (!portfolioId && !saveAsNew) return;
    setSaving(true);
    setError("");
    setInfo("");
    try {
      const payload = {
        ...(saveAsNew ? {} : { portfolio_id: portfolioId }),
        name: saveAsNew ? `${portfolioName} Copy` : portfolioName,
        strategy_ids: rows.map((row) => row.id),
        strategies: rows.map((row) => ({
          id: row.id,
          checked: row.checked,
          dte: row.dte,
          qty_multiplier: row.qty_multiplier,
          slippage: row.slippage,
          weekdays: row.weekdays,
        })),
        qty_multiplier: portfolioQty,
        is_weekdays: isWeekdays,
      };
      const response = await fetch(`${API_BASE}/portfolio/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Failed to save portfolio");
      setInfo(saveAsNew ? "Portfolio saved as new." : "Portfolio updated successfully.");
      if (saveAsNew && data.portfolio_id) {
        navigate(`/backtest/portfolio/${data.portfolio_id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save portfolio");
    } finally {
      setSaving(false);
    }
  };

  const handleBacktest = async () => {
    if (!portfolioId) return;
    if (!startDate || !endDate) {
      setError("Please select Start Date and End Date before running backtest.");
      return;
    }

    setRunning(true);
    setError("");
    setInfo("");
    setResult(null);
    setProgress({
      visible: true,
      percent: 0,
      completed: 0,
      total: 0,
      label: "Running Backtest...",
      meta: "Preparing backtest...",
    });

    try {
      const response = await fetch(`${API_BASE}/portfolio/backtest/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolio: portfolioId,
          start_date: startDate,
          end_date: endDate,
          weekly_old_regime: includePreviousRegime,
          source: "WEB",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail?.message || data.detail || "Failed to start backtest");

      const jobId = String(data.job_id || "");
      const strategyCount = Number(data.strategy_count || 1);

      setProgress({
        visible: true,
        percent: 0,
        completed: 0,
        total: strategyCount,
        label: "Running Backtest...",
        meta: `Processing 0/${strategyCount}`,
      });

      await new Promise<void>((resolve, reject) => {
        const poll = window.setInterval(async () => {
          try {
            const statusResponse = await fetch(`${API_BASE}/backtest/status/${jobId}`);
            const statusData = await statusResponse.json().catch(() => ({}));

            if (statusData.status === "running") {
              const pct = Number(statusData.percent || 0);
              const done = Number(statusData.completed || 0);
              const total = Number(statusData.total || strategyCount);
              const currentDay = String(statusData.current_day || "");
              const strategyName = String(statusData.strategy_name || "");
              setProgress({
                visible: true,
                percent: pct,
                completed: done,
                total,
                label: "Running Backtest...",
                meta: `Processing ${done}/${total}${currentDay ? `: ${currentDay}` : strategyName ? `: ${strategyName}` : ""}`,
              });
              return;
            }

            if (statusData.status === "done") {
              window.clearInterval(poll);
              setProgress({
                visible: true,
                percent: 100,
                completed: strategyCount,
                total: strategyCount,
                label: "Finalizing Backtest...",
                meta: "Backtest completed. Fetching result...",
              });

              const resultResponse = await fetch(`${API_BASE}/backtest/result/${jobId}`);
              const resultData = await resultResponse.json().catch(() => ({}));
              setResult(resultData as PortfolioBacktestResult);
              setProgress((current) => ({ ...current, visible: false }));
              window.setTimeout(() => {
                resultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 120);
              resolve();
              return;
            }

            if (statusData.status === "error") {
              window.clearInterval(poll);
              reject(new Error(statusData.error || "Backtest error"));
            }
          } catch (pollError) {
            window.clearInterval(poll);
            reject(pollError);
          }
        }, 1000);
      });
    } catch (err) {
      setProgress((current) => ({ ...current, visible: false }));
      setError(err instanceof Error ? err.message : "Failed to run backtest");
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <PageMeta title="Backtest Portfolio" description="Portfolio detail and backtest results" />
      <div className="min-h-screen bg-[#f7f9fc]">
        <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/backtest/portfolios")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">{portfolioName}</h1>
                <p className="text-sm text-slate-500">Portfolio strategies, backtest controls and combined results</p>
              </div>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{checkedCount}</span> / {rows.length} selected
            </div>
          </div>

          {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}
          {info ? <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{info}</div> : null}

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="text-[13px] font-medium text-slate-700">Overall Portfolio Setting</p>
            </div>

            <div className="grid grid-cols-1 gap-3 border-b border-slate-100 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_1fr_1fr_1fr]">
              <div className="flex items-center gap-2">
                <button type="button" className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-[12px] text-slate-600">
                  All <ChevronDown />
                </button>
              </div>
              <div className="flex items-center">
                <div className="flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700">
                  <span className="font-medium">Qty Multiplier:</span>
                  <select
                    value={String(portfolioQty)}
                    onChange={(e) => setPortfolioQty(Number(e.target.value))}
                    className="bg-transparent text-[12px] outline-none"
                  >
                    {QTY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-slate-600">
                <div className="flex overflow-hidden rounded border border-slate-200 font-semibold">
                  <button type="button" onClick={() => setIsWeekdays(false)} className={`px-2 py-1 ${!isWeekdays ? "bg-blue-500 text-white" : "bg-white"}`}>
                    DTE
                  </button>
                  <button type="button" onClick={() => setIsWeekdays(true)} className={`border-l border-slate-200 px-2 py-1 ${isWeekdays ? "bg-blue-500 text-white" : "bg-white"}`}>
                    Weekdays
                  </button>
                </div>
                <span>{isWeekdays ? "Weekdays Mode" : "DTE Mode"}</span>
              </div>
              <div className="flex items-center justify-start text-[12px] text-slate-600 lg:justify-end">
                <span>Strategy-specific slippage and quantity are editable below</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-left text-[12px] uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Strategy</th>
                    <th className="px-4 py-3">Underlying</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">DTE</th>
                    <th className="px-4 py-3">Weekdays</th>
                    <th className="px-4 py-3">Slippage</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-4">
                        <label className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={row.checked}
                            onChange={(e) => updateRow(row.id, (current) => ({ ...current, checked: e.target.checked }))}
                            className="mt-1 h-4 w-4 rounded border-slate-300 accent-blue-500"
                          />
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{row.name}</div>
                            <div className="text-xs text-slate-500">{row.id}</div>
                          </div>
                        </label>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{row.underlying || "-"}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{row.product || "-"}</td>
                      <td className="px-4 py-4">
                        <select
                          value={String(row.qty_multiplier)}
                          onChange={(e) => updateRow(row.id, (current) => ({ ...current, qty_multiplier: Number(e.target.value) }))}
                          className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-400"
                        >
                          {QTY_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {DTE_OPTIONS.map((value) => {
                            const active = row.dte.includes(value);
                            return (
                              <button
                                key={value}
                                type="button"
                                onClick={() =>
                                  updateRow(row.id, (current) => ({
                                    ...current,
                                    dte: active ? current.dte.filter((item) => item !== value) : [...current.dte, value].sort((a, b) => a - b),
                                  }))
                                }
                                className={`rounded border px-2 py-1 text-[11px] font-medium ${
                                  active ? "border-blue-500 bg-blue-50 text-blue-600" : "border-slate-200 bg-white text-slate-500"
                                }`}
                              >
                                {value}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {ALL_WEEKDAYS.map((day) => {
                            const active = row.weekdays.includes(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() =>
                                  updateRow(row.id, (current) => ({
                                    ...current,
                                    weekdays: active ? current.weekdays.filter((item) => item !== day) : [...current.weekdays, day],
                                  }))
                                }
                                className={`rounded border px-2 py-1 text-[11px] font-medium ${
                                  active ? "border-blue-500 bg-blue-50 text-blue-600" : "border-slate-200 bg-white text-slate-500"
                                }`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            value={row.slippage}
                            onChange={(e) => updateRow(row.id, (current) => ({ ...current, slippage: Number(e.target.value || 0) }))}
                            className="w-20 rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-400"
                          />
                          <span className="text-sm text-slate-400">%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-14 text-center text-sm text-slate-400">
                        No strategies in this portfolio.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="text-[13px] text-slate-600">Enter the duration of your backtest</span>
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-slate-500">Start Date</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="cursor-pointer rounded border border-slate-200 px-2 py-1 text-[12px] text-slate-700 outline-none focus:border-blue-400"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-slate-500">End Date</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="cursor-pointer rounded border border-slate-200 px-2 py-1 text-[12px] text-slate-700 outline-none focus:border-blue-400"
                  />
                </div>
                <label className="flex items-center gap-2 text-[12px] text-slate-600">
                  <input
                    type="checkbox"
                    checked={includePreviousRegime}
                    onChange={(e) => setIncludePreviousRegime(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-blue-500"
                  />
                  Include data from previous regime
                </label>
              </div>
            </div>
          </div>

          {progress.visible ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{progress.label}</p>
                  <p className="text-xs text-slate-500">{progress.meta}</p>
                </div>
                <div className="text-sm font-semibold text-slate-700">{progress.percent.toFixed(1)}%</div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }} />
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Processing {progress.completed}/{progress.total || 0}
              </div>
            </div>
          ) : null}

          <div ref={resultSectionRef} className="mt-6 space-y-6 pb-40">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-slate-900">BACKTEST RESULT</h2>
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
              >
                Snap a Screenshot
              </button>
            </div>

            {result ? (
              <>
                <div className="grid grid-cols-1 gap-5">
                  <CumulativePnLChart days={chartSeries.days} values={chartSeries.cumulative} />
                  <DrawdownChart days={chartSeries.days} values={chartSeries.drawdowns} />
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">Year</th>
                        {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((month) => (
                          <th key={month} className="px-4 py-3">
                            {month}
                          </th>
                        ))}
                        <th className="px-4 py-3">Total</th>
                        <th className="px-4 py-3">Max DD</th>
                        <th className="px-4 py-3">Days</th>
                        <th className="px-4 py-3">Return/MDD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearWise.map((row) => (
                        <tr key={row.year} className="border-t border-slate-100 text-sm">
                          <td className="px-4 py-3 font-semibold text-slate-800">{row.year}</td>
                          {row.months.map((monthValue, index) => (
                            <td key={`${row.year}-${index}`} className={`px-4 py-3 ${monthValue < 0 ? "text-red-500" : "text-green-600"}`}>
                              {formatMoney(monthValue)}
                            </td>
                          ))}
                          <td className={`px-4 py-3 font-semibold ${row.total < 0 ? "text-red-500" : "text-green-600"}`}>{formatMoney(row.total)}</td>
                          <td className="px-4 py-3 text-red-500">{formatMoney(row.maxDrawdown)}</td>
                          <td className="px-4 py-3 text-slate-700">{row.days}</td>
                          <td className="px-4 py-3 text-slate-700">{row.ratio}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                  <ResultSummaryTable rows={summary.left} />
                  <ResultSummaryTable rows={summary.middle} />
                  <ResultSummaryTable rows={summary.right} />
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Entry Time</th>
                        <th className="px-4 py-3">Exit Time</th>
                        <th className="px-4 py-3">PnL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fullReport.map((row) => (
                        <tr key={row.id} className="border-t border-slate-100 text-sm">
                          <td className="px-4 py-3 text-slate-700">{row.id}</td>
                          <td className="px-4 py-3 text-slate-700">{dateLabel(row.date)}</td>
                          <td className="px-4 py-3 text-slate-700">{row.entryTime}</td>
                          <td className="px-4 py-3 text-slate-700">{row.exitTime}</td>
                          <td className={`px-4 py-3 font-semibold ${row.pnl < 0 ? "text-red-500" : "text-green-600"}`}>{formatMoney(row.pnl)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
                Backtest result will appear here after portfolio backtest completion.
              </div>
            )}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-3">
            <p className="text-[12px] text-slate-400">
              <span className="font-semibold text-slate-700">{checkedCount}</span> of {rows.length} strategies selected
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <ActionButton onClick={() => handleSave(true)} disabled={saving || running}>
                {saving ? <Spinner /> : null}
                Save as new
              </ActionButton>
              <ActionButton onClick={() => handleSave(false)} disabled={saving || running}>
                {saving ? <Spinner /> : null}
                Update Portfolio
              </ActionButton>
              <ActionButton onClick={() => navigate("/backtest/portfolios")} disabled={saving || running}>
                Recent Backtests
              </ActionButton>
              <ActionButton onClick={handleBacktest} disabled={running || saving || loading} variant="primary">
                {running ? <Spinner /> : null}
                {running ? `${progress.percent.toFixed(1)}% (${progress.completed}/${progress.total || 0})` : "Backtest"}
              </ActionButton>
              <ActionButton disabled>Optimise</ActionButton>
            </div>
          </div>
          <div className="border-t border-slate-100 bg-slate-50 py-1.5 text-center text-[11px] text-slate-400">
            Update Portfolio to save any changes to the DTE or Qty Multiplier
          </div>
        </div>
      </div>
    </>
  );
}
