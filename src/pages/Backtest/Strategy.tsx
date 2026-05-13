import { useState, useRef, useEffect, useMemo, type ChangeEvent, type DragEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { useParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import Select, { type Option } from "../../components/form/Select";
import { Modal } from "../../components/ui/modal";
import Button from "../../components/ui/button/Button";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:8000/algo";

// ─── Primitive UI helpers ────────────────────────────────────────────────────

function ActionButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-[#465fff] transition hover:border-[#465fff]/30 hover:bg-[#1284d0]/10"
    >
      <span className="text-slate-500">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function StatBlock({
  label,
  value,
  action,
}: {
  label: string;
  value: string;
  action: string;
}) {
  return (
    <div className="text-right">
      <p className="text-xs text-slate-400">{label}</p>
      <div className="mt-1 flex items-center justify-end gap-3">
        <span className="text-base font-bold text-slate-900">{value}</span>
        <button
          type="button"
          className="text-xs font-medium text-[#465fff] hover:text-[#465fff]"
        >
          {action}
        </button>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-sm font-normal text-slate-600">{children}</label>;
}

function InfoIcon() {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-xs text-slate-400">
      i
    </span>
  );
}

function ToggleSwitch({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle?: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
        enabled ? "bg-[#1284d0]" : "bg-slate-400"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition ${
          enabled ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  compact = false,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  compact?: boolean;
}) {
  return (
    <div className="inline-flex rounded-md border border-[#465fff] bg-white p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-[4px] px-3 py-1 text-sm font-medium transition ${
            value === opt.value
              ? "bg-[#1284d0] text-white"
              : "text-[#465fff] hover:bg-[#1284d0]/10"
          } ${compact ? "px-2.5 py-1 text-xs" : ""}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}


function CompactSelect({
  value,
  options,
  onChange,
  wide = false,
  placeholder,
  className = "",
  menuClassName = "",
  optionClassName = "",
  selectedOptionClassName = "",
  iconClassName = "",
  triggerStyle,
  menuStyle,
  optionStyle,
  selectedOptionStyle,
  iconStyle,
}: {
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  wide?: boolean;
  placeholder?: string;
  className?: string;
  menuClassName?: string;
  optionClassName?: string;
  selectedOptionClassName?: string;
  iconClassName?: string;
  triggerStyle?: React.CSSProperties;
  menuStyle?: React.CSSProperties;
  optionStyle?: React.CSSProperties;
  selectedOptionStyle?: React.CSSProperties;
  iconStyle?: React.CSSProperties;
}) {
  return (
    <Select
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`h-9 min-h-9 rounded-md border-slate-200 px-3 py-2 text-sm shadow-none ${
        wide ? "min-w-[146px]" : "min-w-[104px]"
      } ${className}`}
      menuClassName={menuClassName}
      optionClassName={optionClassName}
      selectedOptionClassName={selectedOptionClassName}
      iconClassName={iconClassName}
      triggerStyle={triggerStyle}
      menuStyle={menuStyle}
      optionStyle={optionStyle}
      selectedOptionStyle={selectedOptionStyle}
      iconStyle={iconStyle}
    />
  );
}

function NativeSelect({
  value,
  options,
  onChange,
  className = "",
}: {
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className="relative w-max">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`cursor-pointer appearance-none rounded border border-slate-300 bg-white py-1.5 pl-3 pr-8 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#465fff]/60 ${className}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-slate-500"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

function TextInput({
  value,
  onChange,
  className = "",
  type = "text",
  placeholder,
}: {
  value: string;
  onChange?: (v: string) => void;
  className?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      className={`h-9 min-w-[78px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-hidden transition focus:border-[#465fff] focus:ring-3 focus:ring-[#465fff]/10 ${className}`}
    />
  );
}

function ResultValue({
  value,
  tone = "neutral",
}: {
  value: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "text-green-600"
      : tone === "negative"
        ? "text-red-500"
        : "text-slate-700";
  return <span className={`font-semibold ${toneClass}`}>{value}</span>;
}

function ResultSummaryTable({
  rows,
}: {
  rows: { label: string; value: string; tone?: "positive" | "negative" | "neutral" }[];
}) {
  return (
    <table className="box-border w-full border-collapse overflow-hidden rounded-lg border border-slate-200 bg-slate-50 md:w-1/3">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td className="border border-slate-200 px-5 py-2 text-sm font-normal leading-4 text-slate-700">
              {row.label}
              <div className="m-2 text-xs font-medium tracking-wide text-slate-500">
                <b>AlgoTest.in</b>
              </div>
            </td>
            <td className="border border-slate-200 p-2 text-center text-xs font-semibold leading-4 whitespace-nowrap">
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
  return dt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buildTickValues(min: number, max: number, steps = 6) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) return [min];
  const range = max - min;
  return Array.from({ length: steps }, (_, index) => min + (range * index) / (steps - 1));
}

function CumulativePnLChart({
  days,
  values,
}: {
  days: string[];
  values: number[];
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltipIndex, setTooltipIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const width = 1100;
  const height = 320;
  const padding = { top: 28, right: 32, bottom: 54, left: 50 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const yTicks = buildTickValues(minValue, maxValue || 1, 6);
  const xTickIndexes = days.length <= 8
    ? days.map((_, idx) => idx)
    : Array.from(new Set([0, Math.floor(days.length * 0.18), Math.floor(days.length * 0.33), Math.floor(days.length * 0.55), Math.floor(days.length * 0.77), days.length - 1]));

  const xForIndex = (index: number) =>
    padding.left + (index / Math.max(days.length - 1, 1)) * innerWidth;
  const yForValue = (value: number) =>
    padding.top + ((maxValue - value) / Math.max(maxValue - minValue || 1, 1)) * innerHeight;

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
    <div className="relative flex h-80 w-full flex-col rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-end">
        <button type="button" className="rounded-md border border-[#0f5da8] px-4 py-2 text-sm font-medium text-[#0f5da8] transition hover:bg-[#0f5da8]/5">
          Reset Zoom
        </button>
      </div>
      <div className="mb-1 flex items-center justify-center gap-2 text-sm text-slate-700">
        <span className="inline-block h-4 w-4 border-2 border-[#22c55e]" />
        <span>Cumulative PnL</span>
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
              <g key={`y-${tick}`}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                <text x={padding.left - 12} y={y + 4} textAnchor="end" fontSize="12" fill="#64748b">
                  {Math.round(tick / 1000)}k
                </text>
              </g>
            );
          })}
          {xTickIndexes.map((index) => {
            const x = xForIndex(index);
            return (
              <g key={`x-${index}`}>
                <line x1={x} y1={padding.top} x2={x} y2={height - padding.bottom} stroke="#f1f5f9" strokeWidth="1" />
                <text x={x} y={height - 18} textAnchor="middle" fontSize="12" fill="#64748b">
                  {formatChartDateLabel(days[index] || "")}
                </text>
              </g>
            );
          })}
          <text
            x={16}
            y={padding.top + innerHeight / 2}
            transform={`rotate(-90 16 ${padding.top + innerHeight / 2})`}
            fontSize="12"
            fill="#475569"
            textAnchor="middle"
          >
            Cumulative PnL
          </text>
          <polyline
            points={points}
            fill="none"
            stroke="#22c55e"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {activeIndex != null ? (
            <g>
              <line
                x1={activeX}
                y1={padding.top}
                x2={activeX}
                y2={height - padding.bottom}
                stroke="#cbd5e1"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <circle cx={activeX} cy={activeY} r="5.5" fill="#ffffff" stroke="#22c55e" strokeWidth="2" />
            </g>
          ) : null}
        </svg>
        <div
          className={`pointer-events-none absolute z-10 rounded-md bg-[#2f3136] px-3 py-2 text-white shadow-lg will-change-transform transition-[left,top,opacity,transform] duration-300 ease-out ${
            visibleTooltipIndex != null ? "translate-y-0 scale-100 opacity-100" : "translate-y-1 scale-95 opacity-0"
          }`}
          style={{
            left: `${(tooltipLeft / width) * 100}%`,
            top: `${(tooltipTop / height) * 100}%`,
            minWidth: 156,
          }}
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

function DrawdownChart({
  days,
  values,
}: {
  days: string[];
  values: number[];
}) {
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
  const xTickIndexes = days.length <= 8
    ? days.map((_, idx) => idx)
    : Array.from(new Set([0, Math.floor(days.length * 0.18), Math.floor(days.length * 0.33), Math.floor(days.length * 0.55), Math.floor(days.length * 0.77), days.length - 1]));
  const xForIndex = (index: number) =>
    padding.left + (index / Math.max(days.length - 1, 1)) * innerWidth;
  const yForValue = (value: number) =>
    padding.top + ((maxValue - value) / Math.max(maxValue - minValue || 1, 1)) * innerHeight;
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
        <button type="button" className="rounded-md border border-[#4f46e5] px-4 py-2 text-sm font-medium text-[#4f46e5] transition hover:bg-[#4f46e5]/5">
          Reset Zoom
        </button>
      </div>
      <div className="relative flex-1 p-2">
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
              <g key={`dd-y-${tick}`}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                <text x={padding.left - 12} y={y + 4} textAnchor="end" fontSize="12" fill="#64748b">
                  {tick === 0 ? "0" : `${Math.round(tick / 1000)}k`}
                </text>
              </g>
            );
          })}
          {xTickIndexes.map((index) => {
            const x = xForIndex(index);
            return (
              <g key={`dd-x-${index}`}>
                <line x1={x} y1={padding.top} x2={x} y2={height - padding.bottom} stroke="#f1f5f9" strokeWidth="1" />
                <text x={x} y={18} textAnchor="middle" fontSize="12" fill="#64748b">
                  {formatChartDateLabel(days[index] || "")}
                </text>
              </g>
            );
          })}
          <text
            x={16}
            y={padding.top + innerHeight / 2}
            transform={`rotate(-90 16 ${padding.top + innerHeight / 2})`}
            fontSize="12"
            fill="#475569"
            textAnchor="middle"
          >
            Drawdown
          </text>
          <polyline
            points={points}
            fill="none"
            stroke="#ff4747"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {activeIndex != null ? (
            <g>
              <line
                x1={activeX}
                y1={padding.top}
                x2={activeX}
                y2={height - padding.bottom}
                stroke="#cbd5e1"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <circle cx={activeX} cy={activeY} r="5.5" fill="#ffffff" stroke="#ff4747" strokeWidth="2" />
            </g>
          ) : null}
        </svg>
        <div
          className={`pointer-events-none absolute z-10 rounded-md bg-[#2f3136] px-3 py-2 text-white shadow-lg will-change-transform transition-[left,top,opacity,transform] duration-300 ease-out ${
            visibleTooltipIndex != null ? "translate-y-0 scale-100 opacity-100" : "translate-y-1 scale-95 opacity-0"
          }`}
          style={{
            left: `${(tooltipLeft / width) * 100}%`,
            top: `${(tooltipTop / height) * 100}%`,
            minWidth: 144,
          }}
        >
          {visibleTooltipIndex != null ? (
            <>
              <div className="mb-1 text-[12px] font-semibold">{formatChartDateLabel(days[visibleTooltipIndex] || "")}</div>
              <div className="flex items-center gap-2 text-[12px]">
                <span className="inline-block h-3 w-3 border-2 border-[#ff4747] bg-white" />
                <span>Drawdown: {Math.round(values[visibleTooltipIndex] || 0).toLocaleString("en-IN")}</span>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type BacktestSubTrade = {
  entry_date?: string;
  entry_time?: string;
  exit_date?: string;
  exit_time?: string;
  option_type?: string;
  strike?: string | number;
  entry_action?: string;
  exit_action?: string;
  entry_price?: number;
  exit_price?: number;
  reentry_type?: string;
  reentry_number?: number | string;
  exit_reason?: string;
  pnl?: number;
  lots?: number;
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
  legs?: BacktestLeg[];
  _cycle?: number;
};

function getTradePnl(trade: BacktestTrade) {
  if (Number.isFinite(Number(trade.total_pnl))) return Number(trade.total_pnl);
  return (trade.legs ?? []).reduce((sum, leg) => sum + Number(leg.pnl || 0), 0);
}

function flattenToSubTrades(trades: BacktestTrade[]) {
  const result: BacktestTrade[] = [];
  trades.forEach((trade) => {
    const legs = trade.legs ?? [];
    let maxCycles = 0;
    legs.forEach((leg) => {
      const count = leg.sub_trades?.length ? leg.sub_trades.length : 1;
      if (count > maxCycles) maxCycles = count;
    });

    if (maxCycles <= 1) {
      result.push(trade);
      return;
    }

    for (let cycleIndex = 0; cycleIndex < maxCycles; cycleIndex += 1) {
      let cyclePnl = 0;
      let cycleEntryTime = "";
      let cycleExitTime = "";
      const cycleLegs: BacktestLeg[] = [];

      legs.forEach((leg) => {
        const sub = leg.sub_trades && leg.sub_trades.length > cycleIndex ? leg.sub_trades[cycleIndex] : null;
        if (!sub && cycleIndex > 0) return;
        const pnl = sub ? Number(sub.pnl || 0) : Number(leg.pnl || 0);
        const entryTime = sub?.entry_time || sub?.entry_date || leg.entry_time || "";
        const exitTime = sub?.exit_time || sub?.exit_date || leg.exit_time || "";
        cyclePnl += pnl;
        if (!cycleEntryTime || entryTime < cycleEntryTime) cycleEntryTime = entryTime;
        if (!cycleExitTime || exitTime > cycleExitTime) cycleExitTime = exitTime;
        cycleLegs.push({
          lots: sub?.lots ? Number(sub.lots) : Number(leg.lots || 1),
          lot_size: Number(leg.lot_size || 1),
          position: leg.position,
          entry_price: sub?.entry_price ?? leg.entry_price,
          exit_price: sub?.exit_price ?? leg.exit_price,
          pnl,
          sub_trades: [],
        });
      });

      result.push({
        date: trade.date,
        entry_time: cycleEntryTime || trade.entry_time,
        exit_time: cycleExitTime || trade.exit_time,
        total_pnl: cyclePnl,
        legs: cycleLegs,
        _cycle: cycleIndex + 1,
      });
    }
  });
  return result;
}

function formatMoneyCompact(value: number) {
  const abs = Math.abs(Number(value || 0));
  return `${value < 0 ? "₹ -" : "₹ "}${abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumberCompact(value: number) {
  return Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateLabel(dateStr?: string) {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
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

  return Object.keys(byYear)
    .sort()
    .map((year) => {
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
      const mddDays = mddStart && mddEnd ? Math.round((new Date(mddEnd).getTime() - new Date(mddStart).getTime()) / 86400000) + 1 : 0;
      return {
        year,
        months: Array.from({ length: 12 }, (_, i) => byYear[year].months[i + 1] || 0),
        total,
        maxDrawdown,
        days: mddDays || 1,
        ratio: maxDrawdown !== 0 ? Math.abs(total / maxDrawdown).toFixed(2) : "—",
      };
    });
}

function computeSummaryMetrics(trades: BacktestTrade[]) {
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
      { label: "Overall Profit", value: formatMoneyCompact(totalProfit), tone: totalProfit < 0 ? "negative" as const : "positive" as const},
      { label: "No. of Trades", value: String(tradeCount) },
      { label: "Average Profit per Trade", value: formatMoneyCompact(avgProfit), tone: avgProfit < 0 ? "negative" as const : "positive" as const},
      { label: "Win %", value: formatNumberCompact(winPct) },
      { label: "Loss %", value: formatNumberCompact(lossPct) },
      { label: "Average Profit on Winning Trades", value: formatMoneyCompact(avgWin), tone: avgWin < 0 ? "negative" as const : "positive" as const},
    ],
    middle: [
      { label: "Average Loss on Losing Trades", value: formatMoneyCompact(avgLoss), tone: "negative" as const },
      { label: "Max Profit in Single Trade", value: formatMoneyCompact(maxProfit), tone: maxProfit < 0 ? "negative" as const : "positive" as const},
      { label: "Max Loss in Single Trade", value: formatMoneyCompact(maxLoss), tone: "negative" as const },
      { label: "Max Drawdown", value: formatMoneyCompact(maxDrawdown), tone: "negative" as const },
      { label: "Duration of Max Drawdown", value: `${durationDays} [${dateLabel(maxDrawdownStart)} to ${dateLabel(maxDrawdownEnd)}]` },
    ],
    right: [
      { label: "Return/MaxDD", value: formatNumberCompact(returnToMaxDD) },
      { label: "Reward to Risk Ratio", value: formatNumberCompact(rewardToRisk) },
      { label: "Expectancy Ratio", value: formatNumberCompact(expectancyRatio) },
      { label: "Max Win Streak (trades)", value: String(maxWinStreak) },
      { label: "Max Losing Streak (trades)", value: String(maxLossStreak) },
      { label: "Max trades in any drawdown", value: String(maxTradesInDrawdown) },
    ],
  };
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
    cumulative.push(cum);
    drawdowns.push(cum - peak);
  });
  return { days, cumulative, drawdowns };
}

function buildFullReportRows(trades: BacktestTrade[]) {
  const rows: Array<Record<string, string | number>> = [];
  trades.forEach((trade, tradeIndex) => {
    const tradeNumber = String(tradeIndex + 1);
    rows.push({
      index: tradeNumber,
      entryDate: trade.date || "",
      entryTime: trade.entry_time || "",
      exitDate: trade.date || "",
      exitTime: trade.exit_time || "",
      type: "",
      strike: "",
      side: "",
      qty: "",
      entryType: "",
      entryPrice: "",
      exitType: "",
      exitPrice: "",
      legType: "",
      reentry: "",
      reentryReason: "",
      vix: "",
      pnl: formatMoneyCompact(getTradePnl(trade)),
      pnlTone: getTradePnl(trade) < 0 ? "negative" : "positive",
    });
    let detailIndex = 1;
    (trade.legs || []).forEach((leg) => {
      const qty = Number(leg.lots || 0) * Number(leg.lot_size || 0);
      const subTrades = leg.sub_trades?.length ? leg.sub_trades : [null];
      subTrades.forEach((sub) => {
        const pnl = Number(sub?.pnl ?? leg.pnl ?? 0);
        rows.push({
          index: `${tradeNumber}.${detailIndex}`,
          entryDate: sub?.entry_date || trade.date || "",
          entryTime: sub?.entry_time || leg.entry_time || "",
          exitDate: sub?.exit_date || trade.date || "",
          exitTime: sub?.exit_time || leg.exit_time || "",
          type: sub?.option_type || leg.type || "",
          strike: String(sub?.strike ?? leg.strike ?? ""),
          side: leg.position || "",
          qty: qty || "",
          entryType: sub?.entry_action || "",
          entryPrice: sub?.entry_price != null ? formatNumberCompact(Number(sub.entry_price)) : leg.entry_price != null ? formatNumberCompact(Number(leg.entry_price)) : "",
          exitType: sub?.exit_action || "",
          exitPrice: sub?.exit_price != null ? formatNumberCompact(Number(sub.exit_price)) : leg.exit_price != null ? formatNumberCompact(Number(leg.exit_price)) : "",
          legType: sub?.reentry_type || "",
          reentry: sub?.reentry_number != null ? String(sub.reentry_number) : "",
          reentryReason: sub?.exit_reason || leg.exit_reason || "",
          vix: "",
          pnl: formatMoneyCompact(pnl),
          pnlTone: pnl < 0 ? "negative" : "positive",
        });
        detailIndex += 1;
      });
    });
  });
  return rows;
}

// ─── Option data (exact values from HTML) ───────────────────────────────────

const indexOptions: Option[] = [
  { value: "NIFTY", label: "NIFTY" },
  { value: "BANKNIFTY", label: "BANKNIFTY" },
  { value: "FINNIFTY", label: "FINNIFTY" },
  { value: "MIDCPNIFTY", label: "MIDCPNIFTY" },
  { value: "SENSEX", label: "SENSEX" },
  { value: "BANKEX", label: "BANKEX" },
];

const overallMomentumTypeOptions: Option[] = [
  { value: "OverallMomentumType.PointsUp", label: "Points (Pts) ↑" },
  { value: "OverallMomentumType.PointsDown", label: "Points (Pts) ↓" },
  { value: "OverallMomentumType.PercentageUp", label: "Percent (%) ↑" },
  { value: "OverallMomentumType.PercentageDown", label: "Percent (%) ↓" },
];

const expiryOptions: Option[] = [
  { value: "ExpiryType.Weekly", label: "Weekly" },
  { value: "ExpiryType.NextWeekly", label: "Next Weekly" },
  { value: "ExpiryType.Monthly", label: "Monthly" },
  { value: "ExpiryType.NextMonthly", label: "Next Monthly" },
];

const strikeTypeOptions: Option[] = [
  ...Array.from({ length: 20 }, (_, i) => ({
    value: `StrikeType.ITM${20 - i}`,
    label: `ITM${20 - i}`,
  })),
  { value: "StrikeType.ATM", label: "ATM" },
  ...Array.from({ length: 30 }, (_, i) => ({
    value: `StrikeType.OTM${i + 1}`,
    label: `OTM${i + 1}`,
  })),
];

const strikeCriteriaOptions: Option[] = [
  { value: "EntryType.EntryByStrikeType", label: "Strike Type" },
  { value: "EntryType.EntryByPremiumRange", label: "Premium Range" },
  { value: "EntryType.EntryByPremium", label: "Closest Premium" },
  { value: "EntryType.EntryByPremiumGEQ", label: "Premium >=" },
  { value: "EntryType.EntryByPremiumLEQ", label: "Premium <=" },
  { value: "EntryType.EntryByStraddlePrice", label: "Straddle Width" },
  { value: "EntryType.EntryByAtmMultiplier", label: "% of ATM" },
  { value: "EntryType.EntryBySyntheticFuture", label: "Synthetic Future" },
  {
    value: "EntryType.EntryByPremiumCloseToStraddle",
    label: "ATM Straddle Premium %",
  },
  { value: "EntryType.EntryByDelta", label: "Closest Delta" },
  { value: "EntryType.EntryByDeltaRange", label: "Delta Range" },
];

const adjustmentOptions: Option[] = [
  { value: "AdjustmentType.Plus", label: "Plus" },
  { value: "AdjustmentType.Minus", label: "Minus" },
];

const positionOptions: Option[] = [
  { value: "PositionType.Buy", label: "Buy" },
  { value: "PositionType.Sell", label: "Sell" },
];

const optionTypeOptions: Option[] = [
  { value: "LegType.CE", label: "Call" },
  { value: "LegType.PE", label: "Put" },
];

const legTgtSLTypeOptions: Option[] = [
  { value: "LegTgtSLType.Points", label: "Points (Pts)" },
  { value: "LegTgtSLType.UnderlyingPoints", label: "Underlying Pts" },
  { value: "LegTgtSLType.Percentage", label: "Percent (%)" },
  { value: "LegTgtSLType.UnderlyingPercentage", label: "Underlying %" },
];

const legReentryActionOptions: Option[] = [
  { value: "ReentryType.Immediate", label: "RE ASAP" },
  { value: "ReentryType.ImmediateReverse", label: "RE ASAP ↩" },
  { value: "ReentryType.LikeOriginal", label: "RE MOMENTUM" },
  { value: "ReentryType.LikeOriginalReverse", label: "RE MOMENTUM ↩" },
  { value: "ReentryType.AtCost", label: "RE COST" },
  { value: "ReentryType.AtCostReverse", label: "RE COST ↩" },
  { value: "ReentryType.NextLeg", label: "Lazy Leg" },
];

const trailSLTypeOptions: Option[] = [
  { value: "TrailStopLossType.Points", label: "Points" },
  { value: "TrailStopLossType.Percentage", label: "Percentage" },
];

const simpleMomentumTypeOptions: Option[] = [
  { value: "MomentumType.PointsUp", label: "Points (Pts) ↑" },
  { value: "MomentumType.PointsDown", label: "Points (Pts) ↓" },
  { value: "MomentumType.PercentageUp", label: "Percent (%) ↑" },
  { value: "MomentumType.PercentageDown", label: "Percent (%) ↓" },
  { value: "MomentumType.UnderlyingPointsUp", label: "Underlying Pts ↑" },
  { value: "MomentumType.UnderlyingPointsDown", label: "Underlying Pts ↓" },
  { value: "MomentumType.UnderlyingPercentageUp", label: "Underlying % ↑" },
  { value: "MomentumType.UnderlyingPercentageDown", label: "Underlying % ↓" },
];

const rangeBreakoutTrackingOptions: Option[] = [
  { value: "true", label: "Underlying" },
  { value: "false", label: "Strike Price" },
];

const rangeBreakoutModalTrackingOptions: Option[] = [
  { value: "false", label: "Strike Price" },
  { value: "true", label: "Underlying" },
];

const overallTgtSLTypeOptions: Option[] = [
  { value: "OverallTgtSLType.MTM", label: "Max Loss" },
  { value: "OverallTgtSLType.PremiumPercentage", label: "Total Premium %" },
];

const overallActionOptions: Option[] = [
  { value: "ReentryType.Immediate", label: "RE ASAP" },
  { value: "ReentryType.ImmediateReverse", label: "RE ASAP ↩" },
  { value: "ReentryType.LikeOriginal", label: "RE MOMENTUM" },
  { value: "ReentryType.LikeOriginalReverse", label: "RE MOMENTUM ↩" },
];

const reentryCountOptions: Option[] = Array.from({ length: 10 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

const trailingTypeOptions: Option[] = [
  { value: "TrailingOption.Lock", label: "Lock" },
  { value: "TrailingOption.LockAndTrail", label: "Lock and Trail" },
  { value: "TrailingOption.OverallTrailSL", label: "Overall Trail SL" },
];

// ─── Leg state ───────────────────────────────────────────────────────────────

type LegState = {
  id: number;
  lots: string;
  position: string;
  optionType: string;
  expiry: string;
  strikeCriteria: string;
  strikeValue: string;
  straddleMultiplier: string;
  straddleAdjustment: string;
  straddleStrikeKind: string;
  atmMultiplier: string;
  atmStrikeKind: string;
  rangeLower: string;
  rangeUpper: string;
  targetProfitEnabled: boolean;
  targetProfitType: string;
  targetProfitValue: string;
  stopLossEnabled: boolean;
  stopLossType: string;
  stopLossValue: string;
  trailSLEnabled: boolean;
  trailSLType: string;
  trailSLInput1: string;
  trailSLInput2: string;
  reentryTgtEnabled: boolean;
  reentryTgtAction: string;
  reentryTgtCount: string;
  reentrySLEnabled: boolean;
  reentrySLAction: string;
  reentrySLCount: string;
  simpleMomentumEnabled: boolean;
  simpleMomentumType: string;
  simpleMomentumValue: string;
  rangeBreakoutEnabled: boolean;
  rangeBreakoutTime: string;
  rangeBreakoutHighLow: string;
  rangeBreakoutTracking: string;
  reentryTgtLazyLegName: string;
  reentrySLLazyLegName: string;
};

function createDefaultLeg(id: number): LegState {
  return {
    id,
    lots: "1",
    position: "PositionType.Sell",
    optionType: "LegType.CE",
    expiry: "ExpiryType.Weekly",
    strikeCriteria: "EntryType.EntryByStrikeType",
    strikeValue: "StrikeType.ATM",
    straddleMultiplier: "0.4",
    straddleAdjustment: "AdjustmentType.Plus",
    straddleStrikeKind: "StrikeType.ATM",
    atmMultiplier: "0.66",
    atmStrikeKind: "StrikeType.ATM",
    rangeLower: "50",
    rangeUpper: "200",
    targetProfitEnabled: false,
    targetProfitType: "LegTgtSLType.Points",
    targetProfitValue: "",
    stopLossEnabled: false,
    stopLossType: "LegTgtSLType.Points",
    stopLossValue: "",
    trailSLEnabled: false,
    trailSLType: "TrailStopLossType.Points",
    trailSLInput1: "",
    trailSLInput2: "",
    reentryTgtEnabled: false,
    reentryTgtAction: "ReentryType.Immediate",
    reentryTgtCount: "1",
    reentrySLEnabled: false,
    reentrySLAction: "ReentryType.Immediate",
    reentrySLCount: "1",
    reentryTgtLazyLegName: "",
    reentrySLLazyLegName: "",
    simpleMomentumEnabled: false,
    simpleMomentumType: "MomentumType.PointsUp",
    simpleMomentumValue: "",
    rangeBreakoutEnabled: false,
    rangeBreakoutTime: "",
    rangeBreakoutHighLow: "High",
    rangeBreakoutTracking: "true",
  };
}

// ─── Strike parameter controls (reused in builder + leg cards) ───────────────

// ─── Builder strike param (inline single-row style) ─────────────────────────

function BuilderStrikeParam({
  strikeCriteria,
  strikeValue,
  rangeLower,
  rangeUpper,
  straddleMultiplier,
  straddleAdjustment,
  straddleStrikeKind,
  atmMultiplier,
  atmStrikeKind,
  onChange,
}: {
  strikeCriteria: string;
  strikeValue: string;
  rangeLower: string;
  rangeUpper: string;
  straddleMultiplier: string;
  straddleAdjustment: string;
  straddleStrikeKind: string;
  atmMultiplier: string;
  atmStrikeKind: string;
  onChange: (key: string, val: string) => void;
}) {
  const numInput = (val: string, key: string, label: string) => (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number"
        value={val}
        onChange={(e) => onChange(key, e.target.value)}
        className="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#465fff]/60"
      />
    </div>
  );

  const numberCriterias = new Set([
    "EntryType.EntryByPremium",
    "EntryType.EntryByPremiumGEQ",
    "EntryType.EntryByPremiumLEQ",
    "EntryType.EntryByAtmMultiplier",
    "EntryType.EntryByDelta",
  ]);
  const rangeCriterias = new Set([
    "EntryType.EntryByPremiumRange",
    "EntryType.EntryByDeltaRange",
  ]);

  if (
    strikeCriteria === "EntryType.EntryByStrikeType" ||
    strikeCriteria === "EntryType.EntryBySyntheticFuture"
  ) {
    return (
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Strike Type</FieldLabel>
        <NativeSelect
          value={strikeValue}
          options={strikeTypeOptions}
          onChange={(v) => onChange("strikeValue", v)}
          className="min-w-[90px]"
        />
      </div>
    );
  }

  if (numberCriterias.has(strikeCriteria)) {
    return numInput(strikeValue, "strikeValue", "Strike Parameter");
  }

  if (rangeCriterias.has(strikeCriteria)) {
    return (
      <>
        {numInput(rangeLower, "rangeLower", "Lower Range")}
        {numInput(rangeUpper, "rangeUpper", "Upper Range")}
      </>
    );
  }

  if (strikeCriteria === "EntryType.EntryByStraddlePrice") {
    return (
      <>
        {numInput(straddleMultiplier, "straddleMultiplier", "Multiplier")}
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Adjustment</FieldLabel>
          <NativeSelect
            value={straddleAdjustment}
            options={adjustmentOptions}
            onChange={(v) => onChange("straddleAdjustment", v)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Strike Kind</FieldLabel>
          <NativeSelect
            value={straddleStrikeKind}
            options={strikeTypeOptions}
            onChange={(v) => onChange("straddleStrikeKind", v)}
            className="min-w-[90px]"
          />
        </div>
      </>
    );
  }

  if (strikeCriteria === "EntryType.EntryByPremiumCloseToStraddle") {
    return (
      <>
        {numInput(atmMultiplier, "atmMultiplier", "Multiplier")}
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Strike Kind</FieldLabel>
          <NativeSelect
            value={atmStrikeKind}
            options={strikeTypeOptions}
            onChange={(v) => onChange("atmStrikeKind", v)}
            className="min-w-[90px]"
          />
        </div>
      </>
    );
  }

  return null;
}

// ─── Lazy Leg Modal ──────────────────────────────────────────────────────────

function uniqueLazyName(existingNames: string[]): string {
  let i = 1;
  while (existingNames.includes(`lazy${i}`)) i++;
  return `lazy${i}`;
}

function subtractOneSecond(time: string): string {
  if (!time || !time.includes(":")) return "09:44:59";
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return "09:44:59";
  const totalSeconds = Math.max(0, hours * 3600 + minutes * 60 - 1);
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

type LazyLegForm = {
  legName: string;
  lots: string;
  position: string;
  optionType: string;
  expiry: string;
  strikeCriteria: string;
  strikeValue: string;
  rangeLower: string;
  rangeUpper: string;
  straddleMultiplier: string;
  straddleAdjustment: string;
  straddleStrikeKind: string;
  atmMultiplier: string;
  atmStrikeKind: string;
  targetProfitEnabled: boolean;
  targetProfitType: string;
  targetProfitValue: string;
  stopLossEnabled: boolean;
  stopLossType: string;
  stopLossValue: string;
  trailSLEnabled: boolean;
  trailSLType: string;
  trailSLInput1: string;
  trailSLInput2: string;
  reentryTgtEnabled: boolean;
  reentryTgtAction: string;
  reentryTgtCount: string;
  reentryTgtLazyLegName: string;
  reentrySLEnabled: boolean;
  reentrySLAction: string;
  reentrySLCount: string;
  reentrySLLazyLegName: string;
  simpleMomentumEnabled: boolean;
  simpleMomentumType: string;
  simpleMomentumValue: string;
};

function defaultLazyLegForm(): LazyLegForm {
  return {
    legName: "lazy1",
    lots: "1",
    position: "PositionType.Buy",
    optionType: "LegType.CE",
    expiry: "ExpiryType.Weekly",
    strikeCriteria: "EntryType.EntryByStrikeType",
    strikeValue: "StrikeType.ATM",
    rangeLower: "50",
    rangeUpper: "200",
    straddleMultiplier: "0.4",
    straddleAdjustment: "AdjustmentType.Plus",
    straddleStrikeKind: "StrikeType.ATM",
    atmMultiplier: "0.66",
    atmStrikeKind: "StrikeType.ATM",
    targetProfitEnabled: false,
    targetProfitType: "LegTgtSLType.Points",
    targetProfitValue: "",
    stopLossEnabled: false,
    stopLossType: "LegTgtSLType.Points",
    stopLossValue: "",
    trailSLEnabled: false,
    trailSLType: "TrailStopLossType.Points",
    trailSLInput1: "",
    trailSLInput2: "",
    reentryTgtEnabled: false,
    reentryTgtAction: "ReentryType.Immediate",
    reentryTgtCount: "1",
    reentryTgtLazyLegName: "",
    reentrySLEnabled: false,
    reentrySLAction: "ReentryType.Immediate",
    reentrySLCount: "1",
    reentrySLLazyLegName: "",
    simpleMomentumEnabled: false,
    simpleMomentumType: "MomentumType.PointsUp",
    simpleMomentumValue: "",
  };
}

function LegSelect({
  value,
  options,
  onChange,
  enabled,
  className = "",
}: {
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  enabled: boolean;
  className?: string;
}) {
  return (
    <div className="relative w-max">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!enabled}
        className={`cursor-pointer appearance-none rounded border border-[#1284d0] bg-[#1284d0] py-1.5 pl-3 pr-8 text-sm text-white focus:outline-none ${
          enabled ? "opacity-100" : "opacity-40 cursor-not-allowed"
        } ${className}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} style={{ backgroundColor: "#1284d0", color: "white" }}>
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-white"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

function LazyLegReentryPicker({
  selectedName,
  lazyLegs,
  enabled,
  onSelect,
  onCreateNew,
}: {
  selectedName: string;
  lazyLegs: LazyLegForm[];
  enabled: boolean;
  onSelect: (name: string) => void;
  onCreateNew: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const label = selectedName || "Lazy Leg";

  return (
    <div ref={ref} className="relative w-max">
      <button
        type="button"
        disabled={!enabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 rounded border border-[#1284d0] bg-[#1284d0] py-1.5 pl-3 pr-2 text-sm text-white focus:outline-none ${
          enabled ? "opacity-100 cursor-pointer" : "opacity-40 cursor-not-allowed"
        }`}
      >
        <span>{label}</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" className="h-4 w-4 text-white">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="p-2">
            <button
              type="button"
              onClick={() => { setOpen(false); onCreateNew(); }}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[#465fff] px-3 py-2 text-sm font-semibold text-white hover:bg-[#3550ee]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New
            </button>
          </div>

          {lazyLegs.length > 0 && (
            <>
              <div className="flex items-center gap-2 px-3 py-1">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400">OR</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="px-2 pb-1">
                <p className="mb-1 px-1 text-xs font-medium text-slate-500">Select from existing</p>
                {lazyLegs
                  .filter((ll, i, arr) => arr.findIndex((x) => x.legName === ll.legName) === i)
                  .map((ll) => (
                    <button
                      key={ll.legName}
                      type="button"
                      onClick={() => { onSelect(ll.legName); setOpen(false); }}
                      className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      <span>{ll.legName}</span>
                      {selectedName === ll.legName && (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                          stroke="currentColor" className="h-4 w-4 text-[#465fff]">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LazyLegModal({
  onClose,
  onConfirm,
  existingNames = [],
  lazyLegs = [],
  onAddLazyLeg,
}: {
  onClose: () => void;
  onConfirm: (form: LazyLegForm) => void;
  existingNames?: string[];
  lazyLegs?: LazyLegForm[];
  onAddLazyLeg?: (form: LazyLegForm) => void;
}) {
  const [form, setForm] = useState<LazyLegForm>(() => ({
    ...defaultLazyLegForm(),
    legName: uniqueLazyName(existingNames),
  }));
  const nameError = existingNames.includes(form.legName.trim());
  const upd = <K extends keyof LazyLegForm>(key: K, val: LazyLegForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));
  const tog = (key: keyof LazyLegForm) =>
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));

  const [nestedFor, setNestedFor] = useState<"tgt" | "sl" | null>(null);

  const handleReentryChange = (which: "tgt" | "sl", value: string) => {
    upd(which === "tgt" ? "reentryTgtAction" : "reentrySLAction", value as LazyLegForm["reentryTgtAction"]);
    if (value !== "ReentryType.NextLeg") {
      upd(which === "tgt" ? "reentryTgtLazyLegName" : "reentrySLLazyLegName", "");
    } else if (lazyLegs.length === 0) {
      setNestedFor(which);
    }
  };

  const handleNestedConfirm = (newForm: LazyLegForm) => {
    onAddLazyLeg?.(newForm);
    upd(nestedFor === "tgt" ? "reentryTgtLazyLegName" : "reentrySLLazyLegName", newForm.legName);
    setNestedFor(null);
  };

  const modalInput = (val: string, key: keyof LazyLegForm, enabled: boolean) => (
    <input
      type="number"
      value={val}
      onChange={(e) => upd(key, e.target.value as LazyLegForm[typeof key])}
      disabled={!enabled}
      className={`w-16 rounded border px-2 py-1.5 text-sm focus:outline-none ${
        enabled ? "border-slate-300 text-slate-700" : "border-slate-200 text-slate-400 opacity-40"
      }`}
    />
  );

  return (
    <>
    <Modal isOpen onClose={onClose} className="max-w-[1100px] m-4 p-0">
      <div>

        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-gray-200 px-7 py-5 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Create New Lazy Leg</h2>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-col gap-5 px-7 pb-6">

          {/* Leg Name */}
          <div className="flex items-center gap-5">
            <label className="whitespace-nowrap text-sm font-normal text-slate-600">
              Enter Leg Name
            </label>
            <div className="flex flex-col gap-1">
              <input type="text" value={form.legName}
                onChange={(e) => upd("legName", e.target.value)}
                className={`rounded border px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 w-44 ${
                  nameError
                    ? "border-red-400 focus:ring-red-400/60"
                    : "border-slate-300 focus:ring-[#465fff]/60"
                }`} />
              {nameError && (
                <span className="text-xs text-red-500">Name already exists</span>
              )}
            </div>
          </div>

          {/* ── Inner card ── */}
          <div className="rounded-xl border border-slate-200 p-5">

            {/* Row 1 — all fields in one scrollable line */}
            <div className="overflow-x-auto">
              <div className="flex min-w-max items-end gap-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#465fff]">Lots</label>
                  <input type="number" min="1" value={form.lots}
                    onChange={(e) => upd("lots", e.target.value)}
                    className="w-16 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-slate-500">Position</label>
                  <NativeSelect value={form.position} options={positionOptions}
                    onChange={(v) => upd("position", v)} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-slate-500">Option Type</label>
                  <NativeSelect value={form.optionType} options={optionTypeOptions}
                    onChange={(v) => upd("optionType", v)} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-slate-500">Expiry</label>
                  <NativeSelect value={form.expiry} options={expiryOptions}
                    onChange={(v) => upd("expiry", v)} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1">
                    <label className="text-xs font-normal text-slate-500">Select Strike Criteria</label>
                    <InfoIcon />
                  </div>
                  <NativeSelect value={form.strikeCriteria} options={strikeCriteriaOptions}
                    onChange={(v) => upd("strikeCriteria", v)} className="min-w-[160px]" />
                </div>

                <BuilderStrikeParam
                  strikeCriteria={form.strikeCriteria}
                  strikeValue={form.strikeValue}
                  rangeLower={form.rangeLower}
                  rangeUpper={form.rangeUpper}
                  straddleMultiplier={form.straddleMultiplier}
                  straddleAdjustment={form.straddleAdjustment}
                  straddleStrikeKind={form.straddleStrikeKind}
                  atmMultiplier={form.atmMultiplier}
                  atmStrikeKind={form.atmStrikeKind}
                  onChange={(key, val) =>
                    upd(key as keyof LazyLegForm, val as LazyLegForm[keyof LazyLegForm])
                  }
                />
              </div>
            </div>

            {/* Row 2 — Target Profit | Stop Loss | Trail SL */}
            <div className="mt-5 flex flex-wrap items-start gap-8">
              {/* Target Profit */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-normal text-slate-600">Target Profit</label>
                  <ToggleSwitch enabled={form.targetProfitEnabled}
                    onToggle={() => tog("targetProfitEnabled")} />
                </div>
                <div className="flex items-center gap-1.5">
                  <LegSelect value={form.targetProfitType} options={legTgtSLTypeOptions}
                    onChange={(v) => upd("targetProfitType", v)}
                    enabled={form.targetProfitEnabled} className="min-w-[130px]" />
                  {modalInput(form.targetProfitValue, "targetProfitValue", form.targetProfitEnabled)}
                </div>
              </div>

              {/* Stop Loss */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-normal text-slate-600">Stop Loss</label>
                  <ToggleSwitch enabled={form.stopLossEnabled}
                    onToggle={() => tog("stopLossEnabled")} />
                </div>
                <div className="flex items-center gap-1.5">
                  <LegSelect value={form.stopLossType} options={legTgtSLTypeOptions}
                    onChange={(v) => upd("stopLossType", v)}
                    enabled={form.stopLossEnabled} className="min-w-[130px]" />
                  {modalInput(form.stopLossValue, "stopLossValue", form.stopLossEnabled)}
                </div>
              </div>

              {/* Trail SL */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-normal text-slate-600">Trail SL</label>
                  <InfoIcon />
                  <ToggleSwitch enabled={form.trailSLEnabled}
                    onToggle={() => tog("trailSLEnabled")} />
                </div>
                <div className="flex items-center gap-1.5">
                  <LegSelect value={form.trailSLType} options={trailSLTypeOptions}
                    onChange={(v) => upd("trailSLType", v)}
                    enabled={form.trailSLEnabled} className="min-w-[100px]" />
                  {modalInput(form.trailSLInput1, "trailSLInput1", form.trailSLEnabled)}
                  {modalInput(form.trailSLInput2, "trailSLInput2", form.trailSLEnabled)}
                </div>
              </div>
            </div>

            {/* Row 3 — Re-entry on Tgt | Re-entry on SL | Simple Momentum */}
            <div className="mt-5 flex flex-wrap items-start gap-8">
              {/* Re-entry on Tgt */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-normal text-slate-600">Re-entry on Tgt</label>
                  <InfoIcon />
                  <ToggleSwitch enabled={form.reentryTgtEnabled}
                    onToggle={() => tog("reentryTgtEnabled")} />
                </div>
                <div className="flex items-center gap-1.5">
                  <LegSelect value={form.reentryTgtAction} options={legReentryActionOptions}
                    onChange={(v) => handleReentryChange("tgt", v)}
                    enabled={form.reentryTgtEnabled} className="min-w-[120px]" />
                  {form.reentryTgtAction === "ReentryType.NextLeg" ? (
                    <LazyLegReentryPicker
                      selectedName={form.reentryTgtLazyLegName}
                      lazyLegs={lazyLegs}
                      enabled={form.reentryTgtEnabled}
                      onSelect={(name) => upd("reentryTgtLazyLegName", name)}
                      onCreateNew={() => setNestedFor("tgt")}
                    />
                  ) : (
                    <LegCountSelect value={form.reentryTgtCount}
                      onChange={(v) => upd("reentryTgtCount", v)} enabled={form.reentryTgtEnabled} />
                  )}
                </div>
              </div>

              {/* Re-entry on SL */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-normal text-slate-600">Re-entry on SL</label>
                  <InfoIcon />
                  <ToggleSwitch enabled={form.reentrySLEnabled}
                    onToggle={() => tog("reentrySLEnabled")} />
                </div>
                <div className="flex items-center gap-1.5">
                  <LegSelect value={form.reentrySLAction} options={legReentryActionOptions}
                    onChange={(v) => handleReentryChange("sl", v)}
                    enabled={form.reentrySLEnabled} className="min-w-[120px]" />
                  {form.reentrySLAction === "ReentryType.NextLeg" ? (
                    <LazyLegReentryPicker
                      selectedName={form.reentrySLLazyLegName}
                      lazyLegs={lazyLegs}
                      enabled={form.reentrySLEnabled}
                      onSelect={(name) => upd("reentrySLLazyLegName", name)}
                      onCreateNew={() => setNestedFor("sl")}
                    />
                  ) : (
                    <LegCountSelect value={form.reentrySLCount}
                      onChange={(v) => upd("reentrySLCount", v)} enabled={form.reentrySLEnabled} />
                  )}
                </div>
              </div>

              {/* Simple Momentum */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-normal text-slate-600">Simple Momentum</label>
                  <InfoIcon />
                  <ToggleSwitch enabled={form.simpleMomentumEnabled}
                    onToggle={() => tog("simpleMomentumEnabled")} />
                </div>
                <div className="flex items-center gap-1.5">
                  <LegSelect value={form.simpleMomentumType} options={simpleMomentumTypeOptions}
                    onChange={(v) => upd("simpleMomentumType", v)}
                    enabled={form.simpleMomentumEnabled} className="min-w-[150px]" />
                  {modalInput(form.simpleMomentumValue, "simpleMomentumValue", form.simpleMomentumEnabled)}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-7 py-4 dark:border-gray-700">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm(form)} disabled={nameError || !form.legName.trim()}>Create and Select</Button>
        </div>

      </div>
    </Modal>

    {nestedFor && (
      <LazyLegModal
        onClose={() => setNestedFor(null)}
        onConfirm={handleNestedConfirm}
        existingNames={[...existingNames, form.legName, ...lazyLegs.map((l) => l.legName)]}
        lazyLegs={lazyLegs}
        onAddLazyLeg={onAddLazyLeg}
      />
    )}
    </>
  );
}

// ─── Per-leg card ────────────────────────────────────────────────────────────

// Blue select when enabled, grey+opacity when disabled
// Small count select (plain style)
function LegCountSelect({
  value,
  onChange,
  enabled,
}: {
  value: string;
  onChange: (v: string) => void;
  enabled: boolean;
}) {
  return (
    <div className="relative w-max">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!enabled}
        className={`cursor-pointer appearance-none rounded border border-slate-300 bg-white py-1.5 pl-2 pr-6 text-sm text-slate-700 focus:outline-none ${
          enabled ? "opacity-100" : "opacity-40"
        }`}
      >
        {reentryCountOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        className="pointer-events-none absolute right-1 top-2.5 h-3 w-3 text-slate-500"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

// ─── Lazy Leg display card ────────────────────────────────────────────────────

function LazyLegCard({
  form,
  onRemove,
  onCopy,
  lazyLegs = [],
  onAddLazyLeg,
}: {
  form: LazyLegForm;
  onRemove: () => void;
  onCopy: () => void;
  lazyLegs?: LazyLegForm[];
  onAddLazyLeg?: (f: LazyLegForm) => void;
}) {
  const [data, setData] = useState<LazyLegForm>(form);
  const upd = <K extends keyof LazyLegForm>(key: K, val: LazyLegForm[K]) =>
    setData((prev) => ({ ...prev, [key]: val }));
  const tog = (key: keyof LazyLegForm) =>
    setData((prev) => ({ ...prev, [key]: !prev[key] }));

  const [cardLazyModal, setCardLazyModal] = useState<"tgt" | "sl" | null>(null);

  const handleCardReentryChange = (which: "tgt" | "sl", value: string) => {
    upd(which === "tgt" ? "reentryTgtAction" : "reentrySLAction", value);
    if (value !== "ReentryType.NextLeg") {
      upd(which === "tgt" ? "reentryTgtLazyLegName" : "reentrySLLazyLegName", "");
    } else if (lazyLegs.length === 0) {
      setCardLazyModal(which);
    }
  };

  const handleCardLazyConfirm = (newForm: LazyLegForm) => {
    onAddLazyLeg?.(newForm);
    upd(cardLazyModal === "tgt" ? "reentryTgtLazyLegName" : "reentrySLLazyLegName", newForm.legName);
    setCardLazyModal(null);
  };

  const disabledInput = (val: string, key: keyof LazyLegForm, enabled: boolean) => (
    <input
      type="number"
      value={val}
      onChange={(e) => upd(key, e.target.value as LazyLegForm[typeof key])}
      disabled={!enabled}
      className={`w-16 rounded border px-2 py-1.5 text-sm focus:outline-none ${
        enabled ? "border-slate-300 text-slate-700" : "border-slate-200 text-slate-400 opacity-40"
      }`}
    />
  );

  return (
    <div className="relative rounded-md border border-slate-200 bg-white p-5 md:p-6">
      {/* Name badge */}
      <div className="absolute left-0 top-0">
        <div className="rounded rounded-bl-none rounded-tr-none bg-slate-300 px-2 py-0.5">
          <span className="text-xs font-semibold text-slate-700">{data.legName}</span>
        </div>
      </div>

      {/* Remove button */}
      <div className="absolute -right-3 -top-3 flex flex-col items-center gap-1">
        <button type="button" onClick={onRemove}
          className="rounded-full border-2 border-white bg-red-500 p-1 shadow">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth="1.5" stroke="currentColor" className="h-3.5 w-3.5 text-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <button type="button" onClick={onCopy} className="rounded-full border-2 border-white bg-slate-500 p-1 shadow">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth="1.5" stroke="currentColor" className="h-3.5 w-3.5 text-white">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
          </svg>
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-6">
        {/* Row 1 */}
        <div className="flex flex-wrap items-end justify-center gap-6">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Lots</FieldLabel>
            <input type="number" min="1" value={data.lots}
              onChange={(e) => upd("lots", e.target.value)}
              className="w-16 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Position</FieldLabel>
            <NativeSelect value={data.position} options={positionOptions}
              onChange={(v) => upd("position", v)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Option Type</FieldLabel>
            <NativeSelect value={data.optionType} options={optionTypeOptions}
              onChange={(v) => upd("optionType", v)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Expiry</FieldLabel>
            <NativeSelect value={data.expiry} options={expiryOptions}
              onChange={(v) => upd("expiry", v)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <FieldLabel>Select Strike Criteria</FieldLabel>
              <InfoIcon />
            </div>
            <NativeSelect value={data.strikeCriteria} options={strikeCriteriaOptions}
              onChange={(v) => upd("strikeCriteria", v)} className="min-w-[160px]" />
          </div>
          <BuilderStrikeParam
            strikeCriteria={data.strikeCriteria}
            strikeValue={data.strikeValue}
            rangeLower={data.rangeLower}
            rangeUpper={data.rangeUpper}
            straddleMultiplier={data.straddleMultiplier}
            straddleAdjustment={data.straddleAdjustment}
            straddleStrikeKind={data.straddleStrikeKind}
            atmMultiplier={data.atmMultiplier}
            atmStrikeKind={data.atmStrikeKind}
            onChange={(key, val) => upd(key as keyof LazyLegForm, val as LazyLegForm[keyof LazyLegForm])}
          />
        </div>

        {/* Row 2: Target Profit | Stop Loss | Trail SL | Re-entry on Tgt | Re-entry on SL | Simple Momentum */}
        <div className="flex flex-wrap items-start justify-center gap-6">
          {/* Target Profit */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Target Profit</FieldLabel>
              <ToggleSwitch enabled={data.targetProfitEnabled} onToggle={() => tog("targetProfitEnabled")} />
            </div>
            <div className="flex items-center gap-1.5">
              <LegSelect value={data.targetProfitType} options={legTgtSLTypeOptions}
                onChange={(v) => upd("targetProfitType", v)} enabled={data.targetProfitEnabled} className="min-w-[130px]" />
              {disabledInput(data.targetProfitValue, "targetProfitValue", data.targetProfitEnabled)}
            </div>
          </div>

          {/* Stop Loss */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Stop Loss</FieldLabel>
              <ToggleSwitch enabled={data.stopLossEnabled} onToggle={() => tog("stopLossEnabled")} />
            </div>
            <div className="flex items-center gap-1.5">
              <LegSelect value={data.stopLossType} options={legTgtSLTypeOptions}
                onChange={(v) => upd("stopLossType", v)} enabled={data.stopLossEnabled} className="min-w-[130px]" />
              {disabledInput(data.stopLossValue, "stopLossValue", data.stopLossEnabled)}
            </div>
          </div>

          {/* Trail SL */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Trail SL</FieldLabel>
              <InfoIcon />
              <ToggleSwitch enabled={data.trailSLEnabled} onToggle={() => tog("trailSLEnabled")} />
            </div>
            <div className="flex items-center gap-1.5">
              <LegSelect value={data.trailSLType} options={trailSLTypeOptions}
                onChange={(v) => upd("trailSLType", v)} enabled={data.trailSLEnabled} className="min-w-[100px]" />
              {disabledInput(data.trailSLInput1, "trailSLInput1", data.trailSLEnabled)}
              {disabledInput(data.trailSLInput2, "trailSLInput2", data.trailSLEnabled)}
            </div>
          </div>

          {/* Re-entry on Tgt */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Re-entry on Tgt</FieldLabel>
              <InfoIcon />
              <ToggleSwitch enabled={data.reentryTgtEnabled} onToggle={() => tog("reentryTgtEnabled")} />
            </div>
            <div className="flex items-center gap-1.5">
              <LegSelect value={data.reentryTgtAction} options={legReentryActionOptions}
                onChange={(v) => handleCardReentryChange("tgt", v)} enabled={data.reentryTgtEnabled} className="min-w-[110px]" />
              {data.reentryTgtAction === "ReentryType.NextLeg" ? (
                <LazyLegReentryPicker
                  selectedName={data.reentryTgtLazyLegName}
                  lazyLegs={lazyLegs}
                  enabled={data.reentryTgtEnabled}
                  onSelect={(name) => upd("reentryTgtLazyLegName", name)}
                  onCreateNew={() => setCardLazyModal("tgt")}
                />
              ) : (
                <LegCountSelect value={data.reentryTgtCount}
                  onChange={(v) => upd("reentryTgtCount", v)} enabled={data.reentryTgtEnabled} />
              )}
            </div>
          </div>

          {/* Re-entry on SL */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Re-entry on SL</FieldLabel>
              <InfoIcon />
              <ToggleSwitch enabled={data.reentrySLEnabled} onToggle={() => tog("reentrySLEnabled")} />
            </div>
            <div className="flex items-center gap-1.5">
              <LegSelect value={data.reentrySLAction} options={legReentryActionOptions}
                onChange={(v) => handleCardReentryChange("sl", v)} enabled={data.reentrySLEnabled} className="min-w-[110px]" />
              {data.reentrySLAction === "ReentryType.NextLeg" ? (
                <LazyLegReentryPicker
                  selectedName={data.reentrySLLazyLegName}
                  lazyLegs={lazyLegs}
                  enabled={data.reentrySLEnabled}
                  onSelect={(name) => upd("reentrySLLazyLegName", name)}
                  onCreateNew={() => setCardLazyModal("sl")}
                />
              ) : (
                <LegCountSelect value={data.reentrySLCount}
                  onChange={(v) => upd("reentrySLCount", v)} enabled={data.reentrySLEnabled} />
              )}
            </div>
          </div>

          {/* Simple Momentum */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Simple Momentum</FieldLabel>
              <InfoIcon />
              <ToggleSwitch enabled={data.simpleMomentumEnabled} onToggle={() => tog("simpleMomentumEnabled")} />
            </div>
            <div className="flex items-center gap-1.5">
              <LegSelect value={data.simpleMomentumType} options={simpleMomentumTypeOptions}
                onChange={(v) => upd("simpleMomentumType", v)} enabled={data.simpleMomentumEnabled} className="min-w-[150px]" />
              {disabledInput(data.simpleMomentumValue, "simpleMomentumValue", data.simpleMomentumEnabled)}
            </div>
          </div>
        </div>
      </div>

      {cardLazyModal && (
        <LazyLegModal
          onClose={() => setCardLazyModal(null)}
          onConfirm={handleCardLazyConfirm}
          existingNames={lazyLegs.map((l) => l.legName)}
          lazyLegs={lazyLegs}
          onAddLazyLeg={onAddLazyLeg}
        />
      )}
    </div>
  );
}

function LegCard({
  leg,
  index,
  onUpdate,
  onRemove,
  onCopy,
  onAddLazyLeg,
  lazyLegs,
}: {
  leg: LegState;
  index: number;
  onUpdate: (id: number, key: keyof LegState, val: string | boolean) => void;
  onRemove: (id: number) => void;
  onCopy: (id: number) => void;
  onAddLazyLeg: (form: LazyLegForm) => void;
  lazyLegs: LazyLegForm[];
}) {
  const set = (key: keyof LegState, val: string | boolean) =>
    onUpdate(leg.id, key, val);
  const toggle = (key: keyof LegState) => set(key, !(leg[key] as boolean));

  const [lazyLegModal, setLazyLegModal] = useState<"tgt" | "sl" | null>(null);
  const [rangeBreakoutModalOpen, setRangeBreakoutModalOpen] = useState(false);

  const handleReentryChange = (which: "tgt" | "sl", value: string) => {
    set(which === "tgt" ? "reentryTgtAction" : "reentrySLAction", value);
    if (value !== "ReentryType.NextLeg") {
      set(which === "tgt" ? "reentryTgtLazyLegName" : "reentrySLLazyLegName", "");
    } else if (lazyLegs.length === 0) {
      setLazyLegModal(which);
    }
  };

  const handleLazyConfirm = (form: LazyLegForm) => {
    if (lazyLegModal) {
      set(lazyLegModal === "tgt" ? "reentryTgtAction" : "reentrySLAction", "ReentryType.NextLeg");
      set(lazyLegModal === "tgt" ? "reentryTgtLazyLegName" : "reentrySLLazyLegName", form.legName);
    }
    onAddLazyLeg(form);
    setLazyLegModal(null);
  };

  const disabledInput = (val: string, key: keyof LegState, enabled: boolean) => (
    <input
      type="number"
      value={val}
      onChange={(e) => set(key, e.target.value)}
      disabled={!enabled}
      className={`w-16 rounded border px-2 py-1.5 text-sm focus:outline-none ${
        enabled ? "border-slate-300 text-slate-700" : "border-slate-200 text-slate-400 opacity-40"
      }`}
    />
  );

  const handleRangeBreakoutToggle = () => {
    if (leg.rangeBreakoutEnabled) {
      set("rangeBreakoutEnabled", false);
      return;
    }
    setRangeBreakoutModalOpen(true);
  };

  return (
    <div className="relative rounded-md border border-slate-200 bg-white p-5 md:p-6">
      {/* #N badge */}
      <div className="absolute left-0 top-0">
        <div className="rounded rounded-bl-none rounded-tr-none bg-slate-300 px-2 py-0.5">
          <span className="text-xs font-semibold text-slate-700">#{index + 1}</span>
        </div>
      </div>

      {/* X + copy buttons */}
      <div className="absolute -right-3 -top-3 flex flex-col items-center gap-1">
        <button type="button" onClick={() => onRemove(leg.id)}
          className="rounded-full border-2 border-white bg-red-500 p-1 shadow">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth="1.5" stroke="currentColor" className="h-3.5 w-3.5 text-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <button type="button" onClick={() => onCopy(leg.id)}
          className="rounded-full border-2 border-white bg-slate-500 p-1 shadow">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth="1.5" stroke="currentColor" className="h-3.5 w-3.5 text-white">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
          </svg>
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-6">

        {/* ── Row 1: centered, all fields in one line ── */}
        <div className="flex flex-wrap items-end justify-center gap-6">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Lots</FieldLabel>
            <input type="number" min="1" value={leg.lots}
              onChange={(e) => set("lots", e.target.value)}
              className="w-16 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none" />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel>Position</FieldLabel>
            <NativeSelect value={leg.position} options={positionOptions}
              onChange={(v) => set("position", v)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel>Option Type</FieldLabel>
            <NativeSelect value={leg.optionType} options={optionTypeOptions}
              onChange={(v) => set("optionType", v)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel>Expiry</FieldLabel>
            <NativeSelect value={leg.expiry} options={expiryOptions}
              onChange={(v) => set("expiry", v)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <FieldLabel>Select Strike Criteria</FieldLabel>
              <InfoIcon />
            </div>
            <NativeSelect value={leg.strikeCriteria} options={strikeCriteriaOptions}
              onChange={(v) => set("strikeCriteria", v)} className="min-w-[160px]" />
          </div>

          <BuilderStrikeParam
            strikeCriteria={leg.strikeCriteria}
            strikeValue={leg.strikeValue}
            rangeLower={leg.rangeLower}
            rangeUpper={leg.rangeUpper}
            straddleMultiplier={leg.straddleMultiplier}
            straddleAdjustment={leg.straddleAdjustment}
            straddleStrikeKind={leg.straddleStrikeKind}
            atmMultiplier={leg.atmMultiplier}
            atmStrikeKind={leg.atmStrikeKind}
            onChange={(key, val) => set(key as keyof LegState, val)}
          />
        </div>

        {/* ── Row 2: Target Profit | Stop Loss | Trail SL — centered ── */}
        <div className="flex flex-wrap items-start justify-center gap-8">
          {/* Target Profit */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Target Profit</FieldLabel>
              <ToggleSwitch enabled={leg.targetProfitEnabled}
                onToggle={() => toggle("targetProfitEnabled")} />
            </div>
            <div className="flex items-center gap-1.5">
              <LegSelect value={leg.targetProfitType} options={legTgtSLTypeOptions}
                onChange={(v) => set("targetProfitType", v)}
                enabled={leg.targetProfitEnabled} className="min-w-[130px]" />
              {disabledInput(leg.targetProfitValue, "targetProfitValue", leg.targetProfitEnabled)}
            </div>
          </div>

          {/* Stop Loss */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Stop Loss</FieldLabel>
              <ToggleSwitch enabled={leg.stopLossEnabled}
                onToggle={() => toggle("stopLossEnabled")} />
            </div>
            <div className="flex items-center gap-1.5">
              <LegSelect value={leg.stopLossType} options={legTgtSLTypeOptions}
                onChange={(v) => set("stopLossType", v)}
                enabled={leg.stopLossEnabled} className="min-w-[130px]" />
              {disabledInput(leg.stopLossValue, "stopLossValue", leg.stopLossEnabled)}
            </div>
          </div>

          {/* Trail SL */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Trail SL</FieldLabel>
              <InfoIcon />
              <ToggleSwitch enabled={leg.trailSLEnabled}
                onToggle={() => toggle("trailSLEnabled")} />
            </div>
            <div className="flex items-center gap-1.5">
              <LegSelect value={leg.trailSLType} options={trailSLTypeOptions}
                onChange={(v) => set("trailSLType", v)}
                enabled={leg.trailSLEnabled} className="min-w-[100px]" />
              {disabledInput(leg.trailSLInput1, "trailSLInput1", leg.trailSLEnabled)}
              {disabledInput(leg.trailSLInput2, "trailSLInput2", leg.trailSLEnabled)}
            </div>
          </div>
        </div>

        {/* ── Row 3: Re-entry on Tgt | Re-entry on SL | Simple Momentum | Range Breakout — centered ── */}
        <div className="flex flex-wrap items-start justify-center gap-8">
          {/* Re-entry on Tgt */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Re-entry on Tgt</FieldLabel>
              <InfoIcon />
              <ToggleSwitch enabled={leg.reentryTgtEnabled}
                onToggle={() => toggle("reentryTgtEnabled")} />
            </div>
            <div className="flex items-center gap-1.5">
              <LegSelect value={leg.reentryTgtAction} options={legReentryActionOptions}
                onChange={(v) => handleReentryChange("tgt", v)}
                enabled={leg.reentryTgtEnabled} className="min-w-[110px]" />
              {leg.reentryTgtAction === "ReentryType.NextLeg" ? (
                <LazyLegReentryPicker
                  selectedName={leg.reentryTgtLazyLegName}
                  lazyLegs={lazyLegs}
                  enabled={leg.reentryTgtEnabled}
                  onSelect={(name) => set("reentryTgtLazyLegName", name)}
                  onCreateNew={() => setLazyLegModal("tgt")}
                />
              ) : (
                <LegCountSelect value={leg.reentryTgtCount}
                  onChange={(v) => set("reentryTgtCount", v)} enabled={leg.reentryTgtEnabled} />
              )}
            </div>
          </div>

          {/* Re-entry on SL */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Re-entry on SL</FieldLabel>
              <InfoIcon />
              <ToggleSwitch enabled={leg.reentrySLEnabled}
                onToggle={() => toggle("reentrySLEnabled")} />
            </div>
            <div className="flex items-center gap-1.5">
              <LegSelect value={leg.reentrySLAction} options={legReentryActionOptions}
                onChange={(v) => handleReentryChange("sl", v)}
                enabled={leg.reentrySLEnabled} className="min-w-[110px]" />
              {leg.reentrySLAction === "ReentryType.NextLeg" ? (
                <LazyLegReentryPicker
                  selectedName={leg.reentrySLLazyLegName}
                  lazyLegs={lazyLegs}
                  enabled={leg.reentrySLEnabled}
                  onSelect={(name) => set("reentrySLLazyLegName", name)}
                  onCreateNew={() => setLazyLegModal("sl")}
                />
              ) : (
                <LegCountSelect value={leg.reentrySLCount}
                  onChange={(v) => set("reentrySLCount", v)} enabled={leg.reentrySLEnabled} />
              )}
            </div>
          </div>

          {/* Simple Momentum */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Simple Momentum</FieldLabel>
              <InfoIcon />
              <ToggleSwitch enabled={leg.simpleMomentumEnabled}
                onToggle={() => toggle("simpleMomentumEnabled")} />
            </div>
            <div className="flex items-center gap-1.5">
              <LegSelect value={leg.simpleMomentumType} options={simpleMomentumTypeOptions}
                onChange={(v) => set("simpleMomentumType", v)}
                enabled={leg.simpleMomentumEnabled} className="min-w-[150px]" />
              {disabledInput(leg.simpleMomentumValue, "simpleMomentumValue", leg.simpleMomentumEnabled)}
            </div>
          </div>

          {/* Range Breakout */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Range Breakout</FieldLabel>
              <ToggleSwitch enabled={leg.rangeBreakoutEnabled}
                onToggle={handleRangeBreakoutToggle} />
            </div>
            <div className={`flex items-center gap-2 ${
              leg.rangeBreakoutEnabled ? "" : "pointer-events-none opacity-40"
            }`}>
              <input type="time" value={leg.rangeBreakoutTime}
                onChange={(e) => set("rangeBreakoutTime", e.target.value)}
                className="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none" />
              <div className="inline-flex overflow-hidden rounded border border-[#465fff]/60">
                {(["High", "Low"] as const).map((opt) => (
                  <button key={opt} type="button"
                    onClick={() => set("rangeBreakoutHighLow", opt)}
                    className={`px-3 py-1.5 text-sm font-medium transition ${
                      leg.rangeBreakoutHighLow === opt
                        ? "bg-[#1284d0]/15 text-[#465fff]"
                        : "text-slate-500 hover:bg-slate-50"
                    }`}>
                    {opt}
                  </button>
                ))}
              </div>
              <NativeSelect value={leg.rangeBreakoutTracking}
                options={rangeBreakoutTrackingOptions}
                onChange={(v) => set("rangeBreakoutTracking", v)} />
            </div>
          </div>
        </div>

      </div>

      {lazyLegModal && (
        <LazyLegModal
          onClose={() => setLazyLegModal(null)}
          onConfirm={handleLazyConfirm}
          existingNames={lazyLegs.map((l) => l.legName)}
          lazyLegs={lazyLegs}
          onAddLazyLeg={onAddLazyLeg}
        />
      )}

      {rangeBreakoutModalOpen && (
        <RangeBreakoutModal
          initialEndTime={leg.rangeBreakoutTime || "09:45"}
          initialEntryOn={(leg.rangeBreakoutHighLow as "High" | "Low") || "High"}
          initialTracking={leg.rangeBreakoutTracking || "false"}
          onClose={() => {
            setRangeBreakoutModalOpen(false);
            set("rangeBreakoutEnabled", false);
          }}
          onConfirm={({ endTime, entryOn, tracking }) => {
            set("rangeBreakoutTime", endTime);
            set("rangeBreakoutHighLow", entryOn);
            set("rangeBreakoutTracking", tracking);
            set("rangeBreakoutEnabled", true);
            setRangeBreakoutModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function RangeBreakoutModal({
  initialEndTime,
  initialEntryOn,
  initialTracking,
  onClose,
  onConfirm,
}: {
  initialEndTime: string;
  initialEntryOn: "High" | "Low";
  initialTracking: string;
  onClose: () => void;
  onConfirm: (config: {
    endTime: string;
    entryOn: "High" | "Low";
    tracking: string;
  }) => void;
}) {
  const [endTime, setEndTime] = useState(initialEndTime || "09:45");
  const [entryOn, setEntryOn] = useState<"High" | "Low">(initialEntryOn || "High");
  const [tracking, setTracking] = useState(initialTracking || "false");
  const trackingLabel =
    rangeBreakoutModalTrackingOptions.find((opt) => opt.value === tracking)?.label || "Strike Price";
  const trackingUntil = subtractOneSecond(endTime);

  return (
    <Modal isOpen onClose={onClose} className="max-w-[640px] m-4 p-0" showCloseButton={false}>
      <div className="rounded-2xl bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <h2 className="text-[30px] leading-none text-slate-900">Range Breakout</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 transition hover:text-slate-700"
            aria-label="Close range breakout modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-8 px-6 py-5">
          <div className="flex flex-wrap gap-4 md:gap-8">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-normal text-slate-500">Start Time</label>
              <input
                type="text"
                value="09:35"
                disabled
                className="w-[104px] rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-normal text-slate-700">End Time</label>
              <div className="relative">
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-[104px] rounded-md border border-slate-300 px-3 py-2 pr-9 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#465fff]/60"
                />
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-500">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 6v6l4 2" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 md:gap-10">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-normal text-slate-700">Entry on</label>
              <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
                {(["High", "Low"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setEntryOn(opt)}
                    className={`min-w-[56px] px-4 py-2 text-sm transition ${
                      entryOn === opt
                        ? "bg-[#1284d0]/15 text-[#1284d0]"
                        : "bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-normal text-slate-700">Tracking</label>
              <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
                {rangeBreakoutModalTrackingOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTracking(opt.value)}
                    className={`min-w-[96px] px-4 py-2 text-sm transition ${
                      tracking === opt.value
                        ? "bg-[#1284d0]/15 text-[#1284d0]"
                        : "bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="max-w-[560px] text-[15px] leading-8 text-slate-800">
            We will start by tracking the <span className="font-semibold">Selected {trackingLabel}</span> between{" "}
            <span className="font-semibold">09:35:00</span> and <span className="font-semibold">{trackingUntil}</span>.
            We will take entry after <span className="font-semibold">{trackingUntil}</span> once the{" "}
            <span className="font-semibold">{entryOn}</span> price of the{" "}
            <span className="font-semibold">Selected Strike</span> in the range is breached.
          </p>
        </div>

        <div className="flex items-center justify-end gap-4 px-6 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm text-slate-600 transition hover:text-slate-900"
          >
            Cancel
          </button>
          <Button
            onClick={() => onConfirm({ endTime, entryOn, tracking })}
            className="rounded-md bg-[#0f4c81] px-6 py-2.5 text-sm hover:bg-[#0b3f6b]"
          >
            Confirm
          </Button>
        </div>
      </div>
    </Modal>
  );
}

type ImportedStrategyPayload = {
  name?: string;
  strategy?: Record<string, unknown>;
  [key: string]: unknown;
};

type IndicatorParameters = {
  Hour?: number;
  Minute?: number;
};

type IndicatorNode = {
  Type?: string;
  Value?: {
    IndicatorName?: string;
    Parameters?: IndicatorParameters;
  };
};

type IndicatorGroup = {
  Value?: IndicatorNode[];
};

type StrikeRange = {
  LowerRange?: string | number;
  UpperRange?: string | number;
};

type TrailValue = {
  InstrumentMove?: string | number;
  LockProfit?: string | number;
  StopLossMove?: string | number;
  TrailBy?: string | number;
  ProfitReaches?: string | number;
  IncreaseBy?: string | number;
};

type ReentryValue = {
  NextLegRef?: string;
  ReentryCount?: string | number;
};

type StrategyValueConfig = {
  Type?: string;
  Value?: string | number | TrailValue | ReentryValue;
};

type LotConfig = {
  Value?: string | number;
};

type LegConfig = {
  StrikeParameter?: string | StrikeRange;
  LegStopLoss?: StrategyValueConfig;
  LegTarget?: StrategyValueConfig;
  LegTrailSL?: StrategyValueConfig;
  LegReentrySL?: StrategyValueConfig;
  LegReentryTP?: StrategyValueConfig;
  LegMomentum?: StrategyValueConfig;
  LotConfig?: LotConfig;
  PositionType?: string;
  InstrumentKind?: string;
  ExpiryKind?: string;
  EntryType?: string;
};

type StrategyConfig = {
  Ticker?: string;
  TakeUnderlyingFromCashOrNot?: string;
  TrailSLtoBreakeven?: string;
  SquareOffAllLegs?: string;
  StrategyType?: string;
  EntryIndicators?: IndicatorGroup;
  ExitIndicators?: IndicatorGroup;
  ListOfLegConfigs?: LegConfig[];
  IdleLegConfigs?: Record<string, LegConfig>;
  OverallMomentum?: StrategyValueConfig;
  OverallSL?: StrategyValueConfig;
  OverallTgt?: StrategyValueConfig;
  OverallReentrySL?: StrategyValueConfig;
  OverallReentryTgt?: StrategyValueConfig;
  LockAndTrail?: StrategyValueConfig;
  OverallTrailSL?: StrategyValueConfig;
  WeeklyOldRegime?: boolean;
};

type StrategyFullConfig = {
  strategy?: StrategyConfig;
  attributes?: Record<string, unknown>;
  source?: string;
};

type StrategyApiResponse = ImportedStrategyPayload & {
  full_config?: StrategyFullConfig;
};

function ImportStrategyModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [pendingPayload, setPendingPayload] = useState<ImportedStrategyPayload | null>(null);
  const [pendingName, setPendingName] = useState("");
  const [nameError, setNameError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"info" | "success" | "error">("info");
  const [showNameEditor, setShowNameEditor] = useState(false);
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const resetState = () => {
    setIsDragging(false);
    setSelectedFileName("");
    setPendingPayload(null);
    setPendingName("");
    setNameError("");
    setStatusMessage("");
    setStatusTone("info");
    setShowNameEditor(false);
    setIsCheckingName(false);
    setIsSaving(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    if (!isOpen) resetState();
  }, [isOpen]);

  const closeModal = () => {
    resetState();
    onClose();
  };

  const showStatus = (message: string, tone: "info" | "success" | "error") => {
    setStatusMessage(message);
    setStatusTone(tone);
  };

  const strategyNameExists = async (name: string) => {
    const response = await fetch(
      `${API_BASE}/strategy/check-name?name=${encodeURIComponent(name)}`
    );
    if (!response.ok) throw new Error("Unable to validate strategy name");
    const data = await response.json();
    return !!data?.exists;
  };

  const saveImportedStrategy = async (payload: ImportedStrategyPayload) => {
    const response = await fetch(`${API_BASE}/strategy/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        typeof data?.detail === "string" ? data.detail : "Failed to save strategy"
      );
    }
    return data;
  };

  const persistStrategy = async (
    payload: ImportedStrategyPayload,
    nextName: string,
    options?: { skipNameCheck?: boolean }
  ) => {
    const trimmedName = nextName.trim();
    if (!trimmedName) {
      setNameError("Strategy name is required.");
      return;
    }

    setIsSaving(true);
    setNameError("");
    showStatus("Saving strategy...", "info");

    try {
      if (!options?.skipNameCheck) {
        const exists = await strategyNameExists(trimmedName);
        if (exists) {
          setShowNameEditor(true);
          setPendingName(trimmedName);
          setNameError("Strategy name already exists.");
          setStatusMessage("");
          return;
        }
      }

      await saveImportedStrategy({ ...payload, name: trimmedName });
      showStatus(`Strategy imported successfully as "${trimmedName}".`, "success");
      window.setTimeout(() => {
        closeModal();
      }, 1200);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to import strategy.";
      if (/already exists/i.test(message)) {
        setShowNameEditor(true);
        setPendingName(trimmedName);
        setNameError("Strategy name already exists.");
        setStatusMessage("");
      } else {
        showStatus(message, "error");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const processFile = async (file: File | null) => {
    if (!file) return;

    const fileName = file.name || "";
    if (!/\.(algtst|algst)$/i.test(fileName)) {
      showStatus("Please upload a valid .algtst file.", "error");
      return;
    }

    setSelectedFileName(fileName);
    setPendingPayload(null);
    setPendingName("");
    setNameError("");
    setShowNameEditor(false);
    setIsCheckingName(true);
    showStatus("Checking strategy name...", "info");

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as ImportedStrategyPayload;
      if (!parsed || typeof parsed !== "object" || !parsed.strategy) {
        throw new Error("Uploaded file does not contain a valid strategy.");
      }

      const nextName =
        typeof parsed.name === "string" && parsed.name.trim()
          ? parsed.name.trim()
          : "Imported Strategy";

      setPendingPayload(parsed);
      setPendingName(nextName);

      const exists = await strategyNameExists(nextName);
      if (exists) {
        setShowNameEditor(true);
        setNameError("Strategy name already exists.");
        setStatusMessage("");
        return;
      }

      await persistStrategy(parsed, nextName, { skipNameCheck: true });
    } catch (error) {
      const message =
        error instanceof SyntaxError
          ? "Invalid .algtst file content."
          : error instanceof Error
            ? error.message
            : "Failed to import strategy.";
      showStatus(message, "error");
    } finally {
      setIsCheckingName(false);
    }
  };

  const onFileInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    await processFile(event.target.files?.[0] ?? null);
  };

  const onDropFile = async (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    await processFile(event.dataTransfer.files?.[0] ?? null);
  };

  const statusClassName =
    statusTone === "error"
      ? "text-red-500"
      : statusTone === "success"
        ? "text-green-600"
        : "text-slate-600";

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      className="m-4 max-w-[560px] p-0"
      showCloseButton={false}
    >
      <div className="rounded-[24px] bg-white">
        <div className="flex items-center justify-between px-8 pb-4 pt-7">
          <div>
            <h2 className="text-[32px] font-semibold leading-none text-slate-900">
              Import Algo Strategy
            </h2>
            <p className="mt-5 text-base text-slate-600">
              Upload your <span className="font-semibold text-slate-800">.algtst</span>{" "}
              strategy file to create a new saved strategy.
            </p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="self-start text-slate-300 transition hover:text-slate-500"
            aria-label="Close import strategy modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              className="h-7 w-7"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="px-8 pb-8">
          <label
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDragging(false);
            }}
            onDrop={onDropFile}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-[22px] border border-dashed px-6 py-14 text-center transition ${
              isDragging
                ? "border-[#1284d0] bg-[#1284d0]/5"
                : "border-slate-300/90 bg-white hover:border-[#1284d0]/45 hover:bg-slate-50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".algtst,.algst,application/json"
              className="hidden"
              onChange={onFileInputChange}
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              className="h-12 w-12 text-[#0f4c81]"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.6}
                d="M12 16V4m0 0-4 4m4-4 4 4M5 19.25v.25A2.5 2.5 0 0 0 7.5 22h9a2.5 2.5 0 0 0 2.5-2.5v-.25"
              />
            </svg>
            <p className="mt-6 text-[17px] font-semibold text-slate-900">
              Drag and drop your .algtst file here
            </p>
            <p className="mt-3 text-base text-slate-500">
              or click to choose a file from your computer
            </p>
            {selectedFileName ? (
              <p className="mt-5 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                {selectedFileName}
              </p>
            ) : null}
          </label>

          {showNameEditor ? (
            <div className="mt-5 space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Strategy Name
              </label>
              <input
                type="text"
                value={pendingName}
                onChange={(event) => {
                  setPendingName(event.target.value);
                  setNameError("");
                }}
                className={`w-full rounded-xl border px-4 py-3 text-sm text-slate-700 outline-hidden transition focus:ring-4 focus:ring-[#1284d0]/10 ${
                  nameError
                    ? "border-red-400 focus:border-red-400"
                    : "border-slate-200 focus:border-[#1284d0]"
                }`}
                placeholder="Enter strategy name"
              />
              {nameError ? (
                <p className="text-sm text-red-500">{nameError}</p>
              ) : null}
            </div>
          ) : null}

          {statusMessage ? (
            <p className={`mt-4 text-sm ${statusClassName}`}>{statusMessage}</p>
          ) : null}

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeModal}
              className="px-2 py-2 text-base text-slate-500 transition hover:text-slate-800"
            >
              Cancel
            </button>
            {showNameEditor ? (
              <button
                type="button"
                disabled={!pendingPayload || isCheckingName || isSaving}
                onClick={() => {
                  if (pendingPayload) void persistStrategy(pendingPayload, pendingName);
                }}
                className="rounded-xl bg-[#0f4c81] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#0b3f6b] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Proceeding..." : "Proceed"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Strategy config → state helpers ─────────────────────────────────────────

function findTimeIndicator(indicators?: IndicatorGroup | null): { Hour: number; Minute: number } | null {
  if (!indicators || !Array.isArray(indicators.Value)) return null;
  for (const node of indicators.Value) {
    if (
      node.Type === "IndicatorTreeNodeType.DataNode" &&
      node.Value?.IndicatorName === "IndicatorType.TimeIndicator"
    ) {
      return (node.Value.Parameters ?? null) as { Hour: number; Minute: number } | null;
    }
  }
  return null;
}

function legConfigToLegState(cfg: LegConfig, id: number): LegState {
  const strikeParam = cfg.StrikeParameter;
  let strikeValue = "StrikeType.ATM";
  let rangeLower = "50";
  let rangeUpper = "200";
  if (typeof strikeParam === "string") {
    strikeValue = strikeParam;
  } else if (strikeParam && typeof strikeParam === "object" && "LowerRange" in strikeParam) {
    rangeLower = String(strikeParam.LowerRange);
    rangeUpper = String(strikeParam.UpperRange);
  }

  const sl = cfg.LegStopLoss;
  const slEnabled = sl?.Type && sl.Type !== "None";

  const tgt = cfg.LegTarget;
  const tgtEnabled = tgt?.Type && tgt.Type !== "None";

  const trail = cfg.LegTrailSL;
  const trailEnabled = trail?.Type && trail.Type !== "None";
  let trailSLInput1 = "";
  let trailSLInput2 = "";
  if (trailEnabled && trail.Value && typeof trail.Value === "object") {
    const trailValue = trail.Value as TrailValue;
    trailSLInput1 = String(trailValue.InstrumentMove ?? trailValue.LockProfit ?? "");
    trailSLInput2 = String(trailValue.StopLossMove ?? trailValue.TrailBy ?? "");
  }

  const rsl = cfg.LegReentrySL;
  const rslEnabled = rsl?.Type && rsl.Type !== "None";
  let reentrySLAction = "ReentryType.Immediate";
  let reentrySLCount = "1";
  let reentrySLLazyLegName = "";
  if (rslEnabled) {
    reentrySLAction = rsl.Type ?? "ReentryType.Immediate";
    if (rsl.Type === "ReentryType.NextLeg") {
      reentrySLLazyLegName = (rsl.Value as ReentryValue | undefined)?.NextLegRef || "";
    } else {
      reentrySLCount = String((rsl.Value as ReentryValue | undefined)?.ReentryCount ?? "1");
    }
  }

  const rtp = cfg.LegReentryTP;
  const rtpEnabled = rtp?.Type && rtp.Type !== "None";
  let reentryTgtAction = "ReentryType.Immediate";
  let reentryTgtCount = "1";
  let reentryTgtLazyLegName = "";
  if (rtpEnabled) {
    reentryTgtAction = rtp.Type ?? "ReentryType.Immediate";
    if (rtp.Type === "ReentryType.NextLeg") {
      reentryTgtLazyLegName = (rtp.Value as ReentryValue | undefined)?.NextLegRef || "";
    } else {
      reentryTgtCount = String((rtp.Value as ReentryValue | undefined)?.ReentryCount ?? "1");
    }
  }

  const mom = cfg.LegMomentum;
  const momEnabled = mom?.Type && mom.Type !== "None";

  return {
    id,
    lots: String(cfg.LotConfig?.Value ?? "1"),
    position: cfg.PositionType || "PositionType.Sell",
    optionType: cfg.InstrumentKind || "LegType.CE",
    expiry: cfg.ExpiryKind || "ExpiryType.Weekly",
    strikeCriteria: cfg.EntryType || "EntryType.EntryByStrikeType",
    strikeValue,
    straddleMultiplier: "0.4",
    straddleAdjustment: "AdjustmentType.Plus",
    straddleStrikeKind: "StrikeType.ATM",
    atmMultiplier: "0.66",
    atmStrikeKind: "StrikeType.ATM",
    rangeLower,
    rangeUpper,
    targetProfitEnabled: !!tgtEnabled,
    targetProfitType: tgtEnabled ? (tgt.Type ?? "LegTgtSLType.Points") : "LegTgtSLType.Points",
    targetProfitValue: tgtEnabled ? String(tgt.Value ?? "") : "",
    stopLossEnabled: !!slEnabled,
    stopLossType: slEnabled ? (sl.Type ?? "LegTgtSLType.Points") : "LegTgtSLType.Points",
    stopLossValue: slEnabled ? String(sl.Value ?? "") : "",
    trailSLEnabled: !!trailEnabled,
    trailSLType: trailEnabled ? (trail.Type ?? "TrailStopLossType.Points") : "TrailStopLossType.Points",
    trailSLInput1,
    trailSLInput2,
    reentryTgtEnabled: !!rtpEnabled,
    reentryTgtAction,
    reentryTgtCount,
    reentryTgtLazyLegName,
    reentrySLEnabled: !!rslEnabled,
    reentrySLAction,
    reentrySLCount,
    reentrySLLazyLegName,
    simpleMomentumEnabled: !!momEnabled,
    simpleMomentumType: momEnabled ? (mom.Type ?? "MomentumType.PointsUp") : "MomentumType.PointsUp",
    simpleMomentumValue: momEnabled ? String(mom.Value ?? "") : "",
    rangeBreakoutEnabled: false,
    rangeBreakoutTime: "",
    rangeBreakoutHighLow: "High",
    rangeBreakoutTracking: "true",
  };
}

function idleLegToLazyForm(name: string, cfg: LegConfig): LazyLegForm {
  const strikeParam = cfg.StrikeParameter;
  let strikeValue = "StrikeType.ATM";
  let rangeLower = "50";
  let rangeUpper = "200";
  if (typeof strikeParam === "string") {
    strikeValue = strikeParam;
  } else if (strikeParam && typeof strikeParam === "object" && "LowerRange" in strikeParam) {
    rangeLower = String(strikeParam.LowerRange);
    rangeUpper = String(strikeParam.UpperRange);
  }

  const sl = cfg.LegStopLoss;
  const slEnabled = sl?.Type && sl.Type !== "None";

  const tgt = cfg.LegTarget;
  const tgtEnabled = tgt?.Type && tgt.Type !== "None";

  const trail = cfg.LegTrailSL;
  const trailEnabled = trail?.Type && trail.Type !== "None";
  let trailSLInput1 = "";
  let trailSLInput2 = "";
  if (trailEnabled && trail.Value && typeof trail.Value === "object") {
    const trailValue = trail.Value as TrailValue;
    trailSLInput1 = String(trailValue.InstrumentMove ?? trailValue.LockProfit ?? "");
    trailSLInput2 = String(trailValue.StopLossMove ?? trailValue.TrailBy ?? "");
  }

  const rsl = cfg.LegReentrySL;
  const rslEnabled = rsl?.Type && rsl.Type !== "None";
  let reentrySLAction = "ReentryType.Immediate";
  let reentrySLCount = "1";
  let reentrySLLazyLegName = "";
  if (rslEnabled) {
    reentrySLAction = rsl.Type ?? "ReentryType.Immediate";
    if (rsl.Type === "ReentryType.NextLeg") {
      reentrySLLazyLegName = (rsl.Value as ReentryValue | undefined)?.NextLegRef || "";
    } else {
      reentrySLCount = String((rsl.Value as ReentryValue | undefined)?.ReentryCount ?? "1");
    }
  }

  const rtp = cfg.LegReentryTP;
  const rtpEnabled = rtp?.Type && rtp.Type !== "None";
  let reentryTgtAction = "ReentryType.Immediate";
  let reentryTgtCount = "1";
  let reentryTgtLazyLegName = "";
  if (rtpEnabled) {
    reentryTgtAction = rtp.Type ?? "ReentryType.Immediate";
    if (rtp.Type === "ReentryType.NextLeg") {
      reentryTgtLazyLegName = (rtp.Value as ReentryValue | undefined)?.NextLegRef || "";
    } else {
      reentryTgtCount = String((rtp.Value as ReentryValue | undefined)?.ReentryCount ?? "1");
    }
  }

  const mom = cfg.LegMomentum;
  const momEnabled = mom?.Type && mom.Type !== "None";

  return {
    legName: name,
    lots: String(cfg.LotConfig?.Value ?? "1"),
    position: cfg.PositionType || "PositionType.Sell",
    optionType: cfg.InstrumentKind || "LegType.CE",
    expiry: cfg.ExpiryKind || "ExpiryType.Weekly",
    strikeCriteria: cfg.EntryType || "EntryType.EntryByStrikeType",
    strikeValue,
    rangeLower,
    rangeUpper,
    straddleMultiplier: "0.4",
    straddleAdjustment: "AdjustmentType.Plus",
    straddleStrikeKind: "StrikeType.ATM",
    atmMultiplier: "0.66",
    atmStrikeKind: "StrikeType.ATM",
    targetProfitEnabled: !!tgtEnabled,
    targetProfitType: tgtEnabled ? (tgt.Type ?? "LegTgtSLType.Points") : "LegTgtSLType.Points",
    targetProfitValue: tgtEnabled ? String(tgt.Value ?? "") : "",
    stopLossEnabled: !!slEnabled,
    stopLossType: slEnabled ? (sl.Type ?? "LegTgtSLType.Points") : "LegTgtSLType.Points",
    stopLossValue: slEnabled ? String(sl.Value ?? "") : "",
    trailSLEnabled: !!trailEnabled,
    trailSLType: trailEnabled ? (trail.Type ?? "TrailStopLossType.Points") : "TrailStopLossType.Points",
    trailSLInput1,
    trailSLInput2,
    reentryTgtEnabled: !!rtpEnabled,
    reentryTgtAction,
    reentryTgtCount,
    reentryTgtLazyLegName,
    reentrySLEnabled: !!rslEnabled,
    reentrySLAction,
    reentrySLCount,
    reentrySLLazyLegName,
    simpleMomentumEnabled: !!momEnabled,
    simpleMomentumType: momEnabled ? (mom.Type ?? "MomentumType.PointsUp") : "MomentumType.PointsUp",
    simpleMomentumValue: momEnabled ? String(mom.Value ?? "") : "",
  };
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function BacktestStrategy() {
  type TabItem = {
    title: string;
    subtitle: string;
    active?: boolean;
    badge?: ReactNode;
  };

  const topTabs: TabItem[] = [
    { title: "Weekly & Monthly Expiries", subtitle: "NIFTY | SENSEX", active: true },
    {
      title: "Monthly Only Expiry",
      subtitle: "MIDCPNIFTY | BANKNIFTY | FINNIFTY | BANKEX",
    },
    { title: "Stocks - Cash / F&O", subtitle: "ALL NIFTY 500 STOCKS" },
    {
      title: "Delta Exchange",
      subtitle: "BTCUSD | ETHUSD",
      badge: (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-center">
          <p className="text-xs font-semibold text-emerald-500">New</p>
          <p className="mt-1 text-xs text-slate-500">Algo Trading</p>
        </div>
      ),
    },
  ];

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [includeBrokerage, setIncludeBrokerage] = useState(false);
  const [includeTaxes, setIncludeTaxes] = useState(false);
  const [slippage, setSlippage] = useState("0");
  const [includePreviousRegime, setIncludePreviousRegime] = useState(true);
  const [weekdaysExpanded, setWeekdaysExpanded] = useState(false);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [dteExpanded, setDteExpanded] = useState(false);
  const [selectedDtes, setSelectedDtes] = useState<number[]>([]);
  const [expiryDayMargin, setExpiryDayMargin] = useState(false);
  const [vixFrom, setVixFrom] = useState("");
  const [vixTo, setVixTo] = useState("");
  const [fullReportSort, setFullReportSort] = useState("EntryDate");
  const [fullReportOrder, setFullReportOrder] = useState<"Asc" | "Desc">("Asc");
  const [loadedStrategyData, setLoadedStrategyData] = useState<StrategyApiResponse | null>(null);
  const [backtestTrades, setBacktestTrades] = useState<BacktestTrade[]>([]);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestStatusText, setBacktestStatusText] = useState("");
  const [backtestError, setBacktestError] = useState("");
  const resultSectionRef = useRef<HTMLDivElement>(null);

  // ── Instrument settings ──
  const [selectedIndex, setSelectedIndex] = useState("NIFTY");
  const [underlyingFrom, setUnderlyingFrom] = useState<"Cash" | "Futures">("Cash");

  // ── Entry settings ──
  const [strategyType, setStrategyType] = useState<"Intraday" | "BTST" | "Positional">(
    "Intraday"
  );
  const [entryTime, setEntryTime] = useState("09:16");
  const [exitTime, setExitTime] = useState("15:15");
  const [noReentryAfterEnabled, setNoReentryAfterEnabled] = useState(false);
  const [noReentryAfterTime, setNoReentryAfterTime] = useState("");
  const [overallMomentumEnabled, setOverallMomentumEnabled] = useState(false);
  const [overallMomentumType, setOverallMomentumType] = useState(
    "OverallMomentumType.PointsUp"
  );
  const [overallMomentumValue, setOverallMomentumValue] = useState("");

  // ── Legwise settings ──
  const [squareOff, setSquareOff] = useState<"Partial" | "Complete">("Partial");
  const [trailSLBreakeven, setTrailSLBreakeven] = useState(false);
  const [trailSLBreakevenScope, setTrailSLBreakevenScope] = useState<
    "All Legs" | "SL Legs"
  >("All Legs");

  // ── Leg builder form ──
  const [builderSegment, setBuilderSegment] = useState<"Futures" | "Options">("Options");
  const [builderTotalLot, setBuilderTotalLot] = useState("1");
  const [builderPosition, setBuilderPosition] = useState<"Buy" | "Sell">("Sell");
  const [builderOptionType, setBuilderOptionType] = useState<"Call" | "Put">("Call");
  const [builderExpiry, setBuilderExpiry] = useState("ExpiryType.Weekly");
  const [builderStrikeCriteria, setBuilderStrikeCriteria] = useState(
    "EntryType.EntryByStrikeType"
  );
  const [builderStrikeValue, setBuilderStrikeValue] = useState("StrikeType.ATM");
  const [builderRangeLower, setBuilderRangeLower] = useState("50");
  const [builderRangeUpper, setBuilderRangeUpper] = useState("200");
  const [builderStraddleMultiplier, setBuilderStraddleMultiplier] = useState("0.4");
  const [builderStraddleAdjustment, setBuilderStraddleAdjustment] = useState(
    "AdjustmentType.Plus"
  );
  const [builderStraddleStrikeKind, setBuilderStraddleStrikeKind] =
    useState("StrikeType.ATM");
  const [builderAtmMultiplier, setBuilderAtmMultiplier] = useState("0.66");
  const [builderAtmStrikeKind, setBuilderAtmStrikeKind] = useState("StrikeType.ATM");

  // ── Leg instances ──
  const [legs, setLegs] = useState<LegState[]>([]);
  const [nextLegId, setNextLegId] = useState(1);

  const addLeg = () => {
    setLegs((prev) => [...prev, createDefaultLeg(nextLegId)]);
    setNextLegId((n) => n + 1);
  };

  const updateLeg = (id: number, key: keyof LegState, val: string | boolean) => {
    setLegs((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [key]: val } : l))
    );
  };

  const removeLeg = (id: number) => {
    setLegs((prev) => prev.filter((l) => l.id !== id));
  };

  const copyLeg = (id: number) => {
    const src = legs.find((l) => l.id === id);
    if (!src) return;
    setLegs((prev) => [...prev, { ...src, id: nextLegId }]);
    setNextLegId((n) => n + 1);
  };

  // ── Lazy Leg instances ──
  const [lazyLegs, setLazyLegs] = useState<LazyLegForm[]>([]);

  const addLazyLeg = (form: LazyLegForm) => {
    setLazyLegs((prev) =>
      prev.some((l) => l.legName === form.legName) ? prev : [...prev, form]
    );
  };

  const removeLazyLeg = (index: number) => {
    setLazyLegs((prev) => prev.filter((_, i) => i !== index));
  };

  const copyLazyLeg = (form: LazyLegForm) => {
    setLazyLegs((prev) => {
      const newName = uniqueLazyName(prev.map((l) => l.legName));
      return [...prev, { ...form, legName: newName }];
    });
  };

  // ── Overall strategy settings ──
  const [overallSLEnabled, setOverallSLEnabled] = useState(false);
  const [overallSLType, setOverallSLType] = useState("OverallTgtSLType.MTM");
  const [overallSLValue, setOverallSLValue] = useState("");
  const [overallSLReentryEnabled, setOverallSLReentryEnabled] = useState(false);
  const [overallSLReentryAction, setOverallSLReentryAction] =
    useState("ReentryType.Immediate");
  const [overallSLReentryCount, setOverallSLReentryCount] = useState("1");

  const [overallTgtEnabled, setOverallTgtEnabled] = useState(false);
  const [overallTgtType, setOverallTgtType] = useState("OverallTgtSLType.MTM");
  const [overallTgtValue, setOverallTgtValue] = useState("");
  const [overallTgtReentryEnabled, setOverallTgtReentryEnabled] = useState(false);
  const [overallTgtReentryAction, setOverallTgtReentryAction] =
    useState("ReentryType.Immediate");
  const [overallTgtReentryCount, setOverallTgtReentryCount] = useState("1");

  const [trailingEnabled, setTrailingEnabled] = useState(false);
  const [trailingType, setTrailingType] = useState("TrailingOption.Lock");
  const [trailingProfitReaches, setTrailingProfitReaches] = useState("0");
  const [trailingLockProfit, setTrailingLockProfit] = useState("1");
  const [trailingIncreaseBy, setTrailingIncreaseBy] = useState("0");
  const [trailingTrailBy, setTrailingTrailBy] = useState("0");

  // ── Backtest dates ──
  const [startDate, setStartDate] = useState("2025-10-01");
  const [endDate, setEndDate] = useState("2025-10-30");

  const sampleYearWiseRows = [
    {
      year: "2026",
      months: ["₹ 3,250", "₹ -1,875", "₹ 54,073.5", "₹ 0", "₹ 0", "₹ 0", "₹ 0", "₹ 0", "₹ 0", "₹ 0", "₹ 0", "₹ 0"],
      total: "₹ 55,448.5",
      maxDrawdown: "₹ -27,813.5",
      days: "41",
      ratio: "1.99",
    },
  ];
  const sampleSummaryTableLeft = [
    { label: "Overall Profit", value: "₹ 54,073.5", tone: "positive" as const },
    { label: "No. of Trades", value: "278" },
    { label: "Average Profit per Trade", value: "₹ 194.51", tone: "positive" as const },
    { label: "Win %", value: "58.27" },
    { label: "Loss %", value: "41.73" },
    { label: "Average Profit on Winning Trades", value: "₹ 1,766.05", tone: "positive" as const },
  ];
  const sampleSummaryTableMiddle = [
    { label: "Average Loss on Losing Trades", value: "₹ -2,000.23", tone: "negative" as const },
    { label: "Max Profit in Single Trade", value: "₹ 3,952", tone: "positive" as const },
    { label: "Max Loss in Single Trade", value: "₹ -3,773.25", tone: "negative" as const },
    { label: "Max Drawdown", value: "₹ -27,813.5", tone: "negative" as const },
    { label: "Duration of Max Drawdown", value: "41 [13/02/2026 to 25/03/2026]" },
  ];
  const sampleSummaryTableRight = [
    { label: "Return/MaxDD", value: "1.95" },
    { label: "Reward to Risk Ratio", value: "0.88" },
    { label: "Expectancy Ratio", value: "0.10" },
    { label: "Max Win Streak (trades)", value: "11" },
    { label: "Max Losing Streak (trades)", value: "6" },
    { label: "Max trades in any drawdown", value: "43" },
  ];
  const sampleFullReportRows = [
    {
      index: 1,
      entryDate: "24/03/2026",
      entryTime: "09:16",
      exitDate: "24/03/2026",
      exitTime: "15:15",
      type: "CE",
      strike: "22400",
      side: "SELL",
      qty: "50",
      entryType: "ATM",
      entryPrice: "₹ 142.35",
      exitType: "Target",
      exitPrice: "₹ 101.20",
      legType: "Parent",
      reentry: "-",
      reentryReason: "-",
      vix: "13.42",
      pnl: "₹ 2,057.5",
      pnlTone: "positive" as const,
    },
    {
      index: 2,
      entryDate: "25/03/2026",
      entryTime: "09:16",
      exitDate: "25/03/2026",
      exitTime: "11:42",
      type: "PE",
      strike: "22350",
      side: "SELL",
      qty: "50",
      entryType: "ATM",
      entryPrice: "₹ 131.10",
      exitType: "Stop Loss",
      exitPrice: "₹ 168.85",
      legType: "Parent",
      reentry: "1",
      reentryReason: "SL",
      vix: "14.05",
      pnl: "₹ -1,887.5",
      pnlTone: "negative" as const,
    },
  ];

  const flattenedTrades = useMemo(() => flattenToSubTrades(backtestTrades), [backtestTrades]);
  const computedYearWiseRows = useMemo(() => computeYearWise(flattenedTrades), [flattenedTrades]);
  const computedSummary = useMemo(() => computeSummaryMetrics(flattenedTrades), [flattenedTrades]);
  const chartSeries = useMemo(() => buildChartSeries(flattenedTrades), [flattenedTrades]);
  const displayedYearWiseRows = computedYearWiseRows.length ? computedYearWiseRows : sampleYearWiseRows.map((row) => ({
    year: row.year,
    months: row.months.map((month) => {
      const negative = month.includes("-");
      const num = Number(month.replace(/[₹,\s-]/g, ""));
      return negative ? -num : num;
    }),
    total: Number(row.total.replace(/[₹,\s-]/g, "")) * (row.total.includes("-") ? -1 : 1),
    maxDrawdown: Number(row.maxDrawdown.replace(/[₹,\s-]/g, "")) * (row.maxDrawdown.includes("-") ? -1 : 1),
    days: Number(row.days),
    ratio: row.ratio,
  }));
  const displayedSummaryLeft = flattenedTrades.length ? computedSummary.left : sampleSummaryTableLeft;
  const displayedSummaryMiddle = flattenedTrades.length ? computedSummary.middle : sampleSummaryTableMiddle;
  const displayedSummaryRight = flattenedTrades.length ? computedSummary.right : sampleSummaryTableRight;
  const displayedFullReportRows = backtestTrades.length ? buildFullReportRows(backtestTrades) : sampleFullReportRows;

  // ── Load strategy from URL param ──
  const { strategy_id } = useParams<{ strategy_id: string }>();

  useEffect(() => {
    if (!strategy_id) return;
    fetch(`${API_BASE}/strategy/${strategy_id}`)
      .then((r) => r.json())
      .then((data) => {
        setLoadedStrategyData(data);
        const cfg = data?.full_config?.strategy;
        if (!cfg) return;

        setSelectedIndex(cfg.Ticker || "NIFTY");
        setUnderlyingFrom(cfg.TakeUnderlyingFromCashOrNot === "True" ? "Cash" : "Futures");
        setTrailSLBreakeven(cfg.TrailSLtoBreakeven === "True");
        setSquareOff(cfg.SquareOffAllLegs === "True" ? "Complete" : "Partial");

        if (cfg.StrategyType === "StrategyType.IntradaySameDay") setStrategyType("Intraday");
        else if (cfg.StrategyType?.includes("BTST")) setStrategyType("BTST");
        else if (cfg.StrategyType?.includes("Positional")) setStrategyType("Positional");

        const entryT = findTimeIndicator(cfg.EntryIndicators);
        if (entryT) {
          setEntryTime(
            `${String(entryT.Hour).padStart(2, "0")}:${String(entryT.Minute).padStart(2, "0")}`
          );
        }
        const exitT = findTimeIndicator(cfg.ExitIndicators);
        if (exitT) {
          setExitTime(
            `${String(exitT.Hour).padStart(2, "0")}:${String(exitT.Minute).padStart(2, "0")}`
          );
        }

        if (Array.isArray(cfg.ListOfLegConfigs)) {
          const newLegs = cfg.ListOfLegConfigs.map((lc: LegConfig, i: number) =>
            legConfigToLegState(lc, i + 1)
          );
          setLegs(newLegs);
          setNextLegId(newLegs.length + 1);
        }

        if (cfg.IdleLegConfigs && typeof cfg.IdleLegConfigs === "object") {
          const newLazy = Object.entries(cfg.IdleLegConfigs).map(([name, lc]) =>
            idleLegToLazyForm(name, lc as LegConfig)
          );
          setLazyLegs(newLazy);
        }

        const om = cfg.OverallMomentum;
        if (om?.Type && om.Type !== "None") {
          setOverallMomentumEnabled(true);
          setOverallMomentumType(om.Type);
          setOverallMomentumValue(String(om.Value ?? ""));
        }

        const osl = cfg.OverallSL;
        if (osl?.Type && osl.Type !== "None") {
          setOverallSLEnabled(true);
          setOverallSLType(osl.Type);
          setOverallSLValue(String(osl.Value ?? ""));
        }

        const otgt = cfg.OverallTgt;
        if (otgt?.Type && otgt.Type !== "None") {
          setOverallTgtEnabled(true);
          setOverallTgtType(otgt.Type);
          setOverallTgtValue(String(otgt.Value ?? ""));
        }

        const orsl = cfg.OverallReentrySL;
        if (orsl?.Type && orsl.Type !== "None") {
          setOverallSLReentryEnabled(true);
          setOverallSLReentryAction(orsl.Type);
          setOverallSLReentryCount(String(orsl.Value?.ReentryCount ?? "1"));
        }

        const ortgt = cfg.OverallReentryTgt;
        if (ortgt?.Type && ortgt.Type !== "None") {
          setOverallTgtReentryEnabled(true);
          setOverallTgtReentryAction(ortgt.Type);
          setOverallTgtReentryCount(String(ortgt.Value?.ReentryCount ?? "1"));
        }

        const lat = cfg.LockAndTrail;
        const otrail = cfg.OverallTrailSL;
        if (lat?.Type && lat.Type !== "None") {
          setTrailingEnabled(true);
          setTrailingType(lat.Type);
          if (lat.Value && typeof lat.Value === "object") {
            setTrailingProfitReaches(String(lat.Value.ProfitReaches ?? "0"));
            setTrailingLockProfit(String(lat.Value.LockProfit ?? "1"));
            setTrailingIncreaseBy(String(lat.Value.IncreaseBy ?? "0"));
            setTrailingTrailBy(String(lat.Value.TrailBy ?? "0"));
          }
        } else if (otrail?.Type && otrail.Type !== "None") {
          setTrailingEnabled(true);
          setTrailingType("TrailingOption.OverallTrailSL");
          if (otrail.Value && typeof otrail.Value === "object") {
            setTrailingProfitReaches(String(otrail.Value.ProfitReaches ?? "0"));
            setTrailingLockProfit(String(otrail.Value.LockProfit ?? "1"));
            setTrailingTrailBy(String(otrail.Value.TrailBy ?? "0"));
          }
        }
      })
      .catch((err) => console.error("Failed to fetch strategy:", err));
  }, [strategy_id]);

  const builderStraddleOnChange = (key: string, val: string) => {
    if (key === "strikeValue") setBuilderStrikeValue(val);
    if (key === "rangeLower") setBuilderRangeLower(val);
    if (key === "rangeUpper") setBuilderRangeUpper(val);
    if (key === "straddleMultiplier") setBuilderStraddleMultiplier(val);
    if (key === "straddleAdjustment") setBuilderStraddleAdjustment(val);
    if (key === "straddleStrikeKind") setBuilderStraddleStrikeKind(val);
    if (key === "atmMultiplier") setBuilderAtmMultiplier(val);
    if (key === "atmStrikeKind") setBuilderAtmStrikeKind(val);
  };

  const buildBacktestPayload = () => {
    if (!loadedStrategyData?.full_config || typeof loadedStrategyData.full_config !== "object") {
      return null;
    }
    const fullConfig = loadedStrategyData.full_config;
    const strategyConfig =
      fullConfig.strategy && typeof fullConfig.strategy === "object"
        ? { ...fullConfig.strategy }
        : null;
    if (!strategyConfig) return null;

    strategyConfig.WeeklyOldRegime = includePreviousRegime;

    return {
      strategy_id: null,
      name: null,
      start_date: startDate,
      end_date: endDate,
      strategy: strategyConfig,
      attributes:
        fullConfig.attributes && typeof fullConfig.attributes === "object"
          ? fullConfig.attributes
          : { template: "Custom", positional: "False" },
      source: fullConfig.source ?? "WEB",
    };
  };

  const runBacktest = async () => {
    const payload = buildBacktestPayload();
    if (!payload) {
      setBacktestError("Saved strategy payload not available for backtest.");
      return;
    }

    setBacktestLoading(true);
    setBacktestError("");
    setBacktestStatusText("Starting...");

    try {
      const startResponse = await fetch(`${API_BASE}/backtest/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const startData = await startResponse.json().catch(() => ({}));
      if (!startResponse.ok) {
        throw new Error(typeof startData?.detail === "string" ? startData.detail : "Failed to start backtest");
      }

      const jobId = startData.job_id;
      if (!jobId) throw new Error("Backtest job id missing.");

      while (true) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        const statusResponse = await fetch(`${API_BASE}/backtest/status/${jobId}`);
        const statusData = await statusResponse.json().catch(() => ({}));
        if (statusData.status === "running") {
          const pct = statusData.percent || 0;
          const completed = statusData.completed || 0;
          const total = statusData.total || 0;
          setBacktestStatusText(`Running... ${pct}% (${completed}/${total} days)`);
          continue;
        }
        if (statusData.status === "error") {
          throw new Error(statusData.error || "Backtest failed");
        }

        setBacktestStatusText("Fetching result...");
        const resultResponse = await fetch(`${API_BASE}/backtest/result/${jobId}`);
        const resultData = await resultResponse.json().catch(() => ({}));
        if (!resultResponse.ok) {
          throw new Error(typeof resultData?.detail === "string" ? resultData.detail : "Failed to fetch backtest result");
        }
        const trades = resultData.trades || resultData.data || resultData;
        setBacktestTrades(Array.isArray(trades) ? trades : []);
        setBacktestStatusText("");
        window.setTimeout(() => resultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
        break;
      }
    } catch (error) {
      setBacktestError(error instanceof Error ? error.message : "Backtest failed.");
      setBacktestStatusText("");
    } finally {
      setBacktestLoading(false);
    }
  };

  return (
    <div>
      <PageMeta
        title="Backtest Strategy | Algo Admin"
        description="Backtest strategy builder page"
      />

      <div className="space-y-5">
        <div className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
          {/* ── Header ── */}
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-[32px] font-medium leading-none text-slate-900">
                  Backtest
                </h1>
                <ActionButton
                  label="Import .algtst"
                  onClick={() => setImportModalOpen(true)}
                  icon={
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 3V15M12 15L7 10M12 15L17 10M5 19H19"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  }
                />
                <ActionButton
                  label="Export .algtst"
                  icon={
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 15V3M12 3L7 8M12 3L17 8M5 19H19"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  }
                />
                <ActionButton
                  label="PDF"
                  icon={
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 16V4M12 16L7 11M12 16L17 11M5 20H19"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  }
                />
              </div>
            </div>

            <div className="flex flex-wrap items-start gap-8 xl:gap-10">
              <StatBlock label="Credits Available" value="265" action="Add" />
              <StatBlock
                label="Weekly Backtests"
                value="21"
                action="Buy Backtests"
              />
            </div>
          </div>

          {/* ── Top tabs ── */}
          <div className="flex flex-wrap border-b border-slate-200 bg-white">
            {topTabs.map((item) => (
              <button
                key={item.title}
                type="button"
                className={`flex min-w-[220px] flex-1 items-start justify-between gap-3 border-b-2 px-4 py-3 text-left transition ${
                  item.active
                    ? "border-[#465fff] bg-[#1284d0]/10 text-[#465fff]"
                    : "border-transparent text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div>
                  <p
                    className={`text-sm ${item.active ? "font-semibold" : "font-medium"}`}
                  >
                    {item.title}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                    {item.subtitle}
                  </p>
                </div>
                {item.badge}
              </button>
            ))}
          </div>

          {/* ── Body ── */}
          <div className="space-y-5 bg-slate-50 px-4 py-5 xl:px-5 xl:py-6">
            {/* Instrument (left) + Entry (right, row-span-2) + Legwise (left below) */}
            <div className="grid grid-cols-10 gap-5">
              {/* Left column: Instrument + Legwise stacked */}
              <div className="col-span-10 flex flex-col justify-between gap-5 md:col-span-4">
                {/* Instrument settings */}
                <div className="flex flex-col gap-2">
                  <h6 className="text-base font-medium leading-7 text-slate-800">
                    Instrument settings
                  </h6>
                  <div className="flex h-full flex-col items-center justify-center gap-10 rounded-md border border-slate-200 bg-white py-6">
                    <div className="flex w-full max-w-sm flex-wrap items-center justify-between gap-5 px-6">
                      <FieldLabel>Index</FieldLabel>
                      <div className="min-w-32 flex-1">
                        <CompactSelect
                          value={selectedIndex}
                          options={indexOptions}
                          onChange={setSelectedIndex}
                          wide
                        />
                      </div>
                    </div>
                    <div className="flex w-full max-w-sm flex-wrap items-center justify-between gap-5 px-6">
                      <div className="flex items-center gap-2">
                        <FieldLabel>Underlying from</FieldLabel>
                        <InfoIcon />
                      </div>
                      <SegmentedControl
                        options={[
                          { label: "Cash", value: "Cash" },
                          { label: "Futures", value: "Futures" },
                        ]}
                        value={underlyingFrom}
                        onChange={setUnderlyingFrom}
                        compact
                      />
                    </div>
                  </div>
                </div>

                {/* Legwise settings */}
                <div className="flex flex-col gap-2">
                  <h6 className="text-base font-medium leading-7 text-slate-800">
                    Legwise settings
                  </h6>
                  <div className="flex h-full flex-col items-center justify-center gap-8 rounded-md border border-slate-200 bg-white p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-sm font-normal text-slate-600">
                        Square Off
                        <InfoIcon />
                      </label>
                      <SegmentedControl
                        options={[
                          { label: "Partial", value: "Partial" },
                          { label: "Complete", value: "Complete" },
                        ]}
                        value={squareOff}
                        onChange={setSquareOff}
                        compact
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={trailSLBreakeven}
                          onChange={(e) => setTrailSLBreakeven(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-[#465fff] focus:ring-[#465fff]"
                        />
                        Trail SL to Break-even price
                        <InfoIcon />
                      </label>
                      <div
                        className={
                          trailSLBreakeven ? "" : "pointer-events-none opacity-80"
                        }
                      >
                        <SegmentedControl
                          options={[
                            { label: "All Legs", value: "All Legs" },
                            { label: "SL Legs", value: "SL Legs" },
                          ]}
                          value={trailSLBreakevenScope}
                          onChange={setTrailSLBreakevenScope}
                          compact
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column: Entry settings spanning both rows */}
              <div className="col-span-10 md:col-span-6">
                <div className="flex h-full flex-col gap-2">
                  <h6 className="text-base font-medium leading-7 text-slate-800">
                    Entry settings
                  </h6>
                  <div className="flex h-full flex-col items-center justify-center gap-8 rounded-md border border-slate-200 bg-white p-6">
                    {/* Strategy Type */}
                    <div className="flex w-full max-w-sm items-center justify-between">
                      <FieldLabel>Strategy Type</FieldLabel>
                      <SegmentedControl
                        options={[
                          { label: "Intraday", value: "Intraday" },
                          { label: "BTST", value: "BTST" },
                          { label: "Positional", value: "Positional" },
                        ]}
                        value={strategyType}
                        onChange={setStrategyType}
                        compact
                      />
                    </div>

                    {/* Entry Time + Exit Time */}
                    <div className="flex flex-wrap items-center justify-center gap-10">
                      <div className="flex items-center gap-3">
                        <FieldLabel>Entry Time</FieldLabel>
                        <TextInput
                          value={entryTime}
                          onChange={setEntryTime}
                          type="time"
                          className="min-w-[90px]"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <FieldLabel>Exit Time</FieldLabel>
                        <TextInput
                          value={exitTime}
                          onChange={setExitTime}
                          type="time"
                          className="min-w-[90px]"
                        />
                      </div>
                    </div>

                    {/* No re-entry after + Overall Momentum */}
                    <div className="flex w-full flex-col items-center justify-center gap-8 md:flex-row">
                      {/* No re-entry after */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <FieldLabel>No re-entry after</FieldLabel>
                          <ToggleSwitch
                            enabled={noReentryAfterEnabled}
                            onToggle={() => setNoReentryAfterEnabled((v) => !v)}
                          />
                        </div>
                        <div
                          className={
                            noReentryAfterEnabled
                              ? ""
                              : "pointer-events-none opacity-40"
                          }
                        >
                          <TextInput
                            value={noReentryAfterTime}
                            onChange={setNoReentryAfterTime}
                            type="time"
                            className="min-w-[110px]"
                          />
                        </div>
                      </div>

                      <div className="hidden h-12 w-px bg-slate-200 md:block" />

                      {/* Overall Momentum */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <FieldLabel>Overall Momentum</FieldLabel>
                          <InfoIcon />
                          <ToggleSwitch
                            enabled={overallMomentumEnabled}
                            onToggle={() => setOverallMomentumEnabled((v) => !v)}
                          />
                        </div>
                        <div
                          className={`flex items-center gap-2 transition ${
                            overallMomentumEnabled
                              ? ""
                              : "pointer-events-none opacity-40"
                          }`}
                        >
                          <div className="w-[170px]">
                            <CompactSelect
                              value={overallMomentumType}
                              options={overallMomentumTypeOptions}
                              onChange={setOverallMomentumType}
                              wide
                              className="rounded-[4px] border-[#2d77c7] bg-[#1b6ca8] text-white focus:border-[#2d77c7] focus:ring-0"
                              menuClassName="rounded-none border-[#1b6ca8] bg-[#165f95] py-0 shadow-none"
                              optionClassName="border-b border-[#2d77c7]/20 bg-[#165f95] py-1.5 text-white hover:bg-[#1e73af] dark:bg-[#165f95] dark:text-white dark:hover:bg-[#1e73af]"
                              selectedOptionClassName="border-b border-[#2d77c7]/20 bg-[#2f74db] py-1.5 font-semibold text-white dark:bg-[#2f74db] dark:text-white"
                              iconClassName="text-white"
                            />
                          </div>
                          <TextInput
                            value={overallMomentumValue}
                            onChange={setOverallMomentumValue}
                            type="number"
                            className="min-w-[70px]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Leg Builder */}
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-medium text-slate-800">
                    Leg Builder
                  </h3>
                  <InfoIcon />
                </div>
                <button
                  type="button"
                  className="text-sm font-semibold text-[#465fff]"
                >
                  Collapse
                </button>
              </div>

              <div className="rounded-md border border-slate-200 bg-white px-6 py-8">
                {/* Single horizontal row — centered */}
                <div className="flex flex-wrap items-end justify-center gap-6">
                    {/* Select segments */}
                    <div className="flex flex-col gap-1.5">
                      <FieldLabel>Select segments</FieldLabel>
                      <SegmentedControl
                        options={[
                          { label: "Futures", value: "Futures" },
                          { label: "Options", value: "Options" },
                        ]}
                        value={builderSegment}
                        onChange={setBuilderSegment}
                        compact
                      />
                    </div>

                    {/* Total Lot */}
                    <div className="flex flex-col gap-1.5">
                      <FieldLabel>Total Lot</FieldLabel>
                      <input
                        type="number"
                        min="1"
                        value={builderTotalLot}
                        onChange={(e) => setBuilderTotalLot(e.target.value)}
                        className="w-16 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#465fff]/60"
                      />
                    </div>

                    {/* Position */}
                    <div className="flex flex-col gap-1.5">
                      <FieldLabel>Position</FieldLabel>
                      <SegmentedControl
                        options={[
                          { label: "Buy", value: "Buy" },
                          { label: "Sell", value: "Sell" },
                        ]}
                        value={builderPosition}
                        onChange={setBuilderPosition}
                        compact
                      />
                    </div>

                    {/* Option Type */}
                    <div className="flex flex-col gap-1.5">
                      <FieldLabel>Option Type</FieldLabel>
                      <SegmentedControl
                        options={[
                          { label: "Call", value: "Call" },
                          { label: "Put", value: "Put" },
                        ]}
                        value={builderOptionType}
                        onChange={setBuilderOptionType}
                        compact
                      />
                    </div>

                    {/* Expiry */}
                    <div className="flex flex-col gap-1.5">
                      <FieldLabel>Expiry</FieldLabel>
                      <NativeSelect
                        value={builderExpiry}
                        options={expiryOptions}
                        onChange={setBuilderExpiry}
                      />
                    </div>

                    {/* Strike Criteria */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1">
                        <FieldLabel>Strike Criteria</FieldLabel>
                        <InfoIcon />
                      </div>
                      <NativeSelect
                        value={builderStrikeCriteria}
                        options={strikeCriteriaOptions}
                        onChange={setBuilderStrikeCriteria}
                        className="min-w-[160px]"
                      />
                    </div>

                    {/* Strike Type / Parameter */}
                    <BuilderStrikeParam
                      strikeCriteria={builderStrikeCriteria}
                      strikeValue={builderStrikeValue}
                      rangeLower={builderRangeLower}
                      rangeUpper={builderRangeUpper}
                      straddleMultiplier={builderStraddleMultiplier}
                      straddleAdjustment={builderStraddleAdjustment}
                      straddleStrikeKind={builderStraddleStrikeKind}
                      atmMultiplier={builderAtmMultiplier}
                      atmStrikeKind={builderAtmStrikeKind}
                      onChange={builderStraddleOnChange}
                    />
                </div>

                {/* Add Leg button */}
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    onClick={addLeg}
                    className="rounded-md bg-[#1284d0] px-7 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0e6fad]"
                  >
                    Add Leg
                  </button>
                </div>
              </div>

              {/* Added leg cards */}
              {legs.length > 0 && (
                <div className="mt-4 flex flex-col gap-4">
                  <h6 className="text-base font-medium leading-7 text-slate-700">
                    Legs
                  </h6>
                  {legs.map((leg, idx) => (
                    <LegCard
                      key={leg.id}
                      leg={leg}
                      index={idx}
                      onUpdate={updateLeg}
                      onRemove={removeLeg}
                      onCopy={copyLeg}
                      onAddLazyLeg={addLazyLeg}
                      lazyLegs={lazyLegs}
                    />
                  ))}
                </div>
              )}

              {/* Lazy Legs section */}
              {lazyLegs.length > 0 && (
                <div className="mt-4 flex flex-col gap-4">
                  <h6 className="text-base font-medium leading-7 text-slate-700">
                    Lazy Legs
                  </h6>
                  {lazyLegs.map((form, idx) => (
                    <LazyLegCard
                      key={idx}
                      form={form}
                      onRemove={() => removeLazyLeg(idx)}
                      onCopy={() => copyLazyLeg(form)}
                      lazyLegs={lazyLegs}
                      onAddLazyLeg={addLazyLeg}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Overall strategy settings */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-[15px] font-medium text-slate-800">
                  Overall strategy settings
                </h3>
                <InfoIcon />
              </div>

              <div className="flex flex-wrap gap-4">

                {/* ── Overall Stop Loss ── */}
                <div className="rounded-md border border-slate-200 bg-white p-5 min-w-[240px]">
                  <div className="flex items-center justify-between gap-4">
                    <FieldLabel>Overall Stop Loss</FieldLabel>
                    <ToggleSwitch enabled={overallSLEnabled} onToggle={() => setOverallSLEnabled((v) => !v)} />
                  </div>
                  <div className={`mt-4 flex flex-col gap-4 ${overallSLEnabled ? "" : "pointer-events-none opacity-40"}`}>
                    <div className="flex items-center gap-2">
                      <LegSelect value={overallSLType} options={overallTgtSLTypeOptions}
                        onChange={setOverallSLType} enabled={overallSLEnabled} className="min-w-[140px]" />
                      <input type="number" value={overallSLValue}
                        onChange={(e) => setOverallSLValue(e.target.value)}
                        className="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none" />
                    </div>
                    <div className="border-t border-slate-100 pt-4">
                      <div className="flex items-center gap-2">
                        <FieldLabel>Re-entry on SL</FieldLabel>
                        <InfoIcon />
                        <ToggleSwitch enabled={overallSLReentryEnabled}
                          onToggle={() => setOverallSLReentryEnabled((v) => !v)} />
                      </div>
                      <div className={`mt-2 flex items-center gap-2 ${overallSLReentryEnabled ? "" : "pointer-events-none opacity-40"}`}>
                        <LegSelect value={overallSLReentryAction} options={overallActionOptions}
                          onChange={setOverallSLReentryAction} enabled={overallSLReentryEnabled} className="min-w-[110px]" />
                        <LegCountSelect value={overallSLReentryCount}
                          onChange={setOverallSLReentryCount} enabled={overallSLReentryEnabled} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Overall Target ── */}
                <div className="rounded-md border border-slate-200 bg-white p-5 min-w-[240px]">
                  <div className="flex items-center justify-between gap-4">
                    <FieldLabel>Overall Target</FieldLabel>
                    <ToggleSwitch enabled={overallTgtEnabled} onToggle={() => setOverallTgtEnabled((v) => !v)} />
                  </div>
                  <div className={`mt-4 flex flex-col gap-4 ${overallTgtEnabled ? "" : "pointer-events-none opacity-40"}`}>
                    <div className="flex items-center gap-2">
                      <LegSelect value={overallTgtType} options={overallTgtSLTypeOptions}
                        onChange={setOverallTgtType} enabled={overallTgtEnabled} className="min-w-[140px]" />
                      <input type="number" value={overallTgtValue}
                        onChange={(e) => setOverallTgtValue(e.target.value)}
                        className="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none" />
                    </div>
                    <div className="border-t border-slate-100 pt-4">
                      <div className="flex items-center gap-2">
                        <FieldLabel>Re-entry on Tgt</FieldLabel>
                        <InfoIcon />
                        <ToggleSwitch enabled={overallTgtReentryEnabled}
                          onToggle={() => setOverallTgtReentryEnabled((v) => !v)} />
                      </div>
                      <div className={`mt-2 flex items-center gap-2 ${overallTgtReentryEnabled ? "" : "pointer-events-none opacity-40"}`}>
                        <LegSelect value={overallTgtReentryAction} options={overallActionOptions}
                          onChange={setOverallTgtReentryAction} enabled={overallTgtReentryEnabled} className="min-w-[110px]" />
                        <LegCountSelect value={overallTgtReentryCount}
                          onChange={setOverallTgtReentryCount} enabled={overallTgtReentryEnabled} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Trailing Options ── */}
                <div className="rounded-md border border-slate-200 bg-white p-5 min-w-[300px]">
                  <div className="flex items-center justify-between gap-4">
                    <FieldLabel>Trailing Options</FieldLabel>
                    <ToggleSwitch enabled={trailingEnabled} onToggle={() => setTrailingEnabled((v) => !v)} />
                  </div>
                  <div className={`mt-4 flex flex-col gap-4 ${trailingEnabled ? "" : "pointer-events-none opacity-40"}`}>
                    <NativeSelect value={trailingType} options={trailingTypeOptions}
                      onChange={setTrailingType} className="min-w-[180px]" />
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <FieldLabel>If profit reaches</FieldLabel>
                        <input type="number" value={trailingProfitReaches}
                          onChange={(e) => setTrailingProfitReaches(e.target.value)}
                          className="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none" />
                      </div>
                      <div className="flex items-center gap-2">
                        <FieldLabel>Lock profit</FieldLabel>
                        <input type="number" value={trailingLockProfit}
                          onChange={(e) => setTrailingLockProfit(e.target.value)}
                          className="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none" />
                      </div>
                    </div>
                    {trailingType === "TrailingOption.LockAndTrail" && (
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                          <FieldLabel>Increase profit by</FieldLabel>
                          <input type="number" value={trailingIncreaseBy}
                            onChange={(e) => setTrailingIncreaseBy(e.target.value)}
                            className="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none" />
                        </div>
                        <div className="flex items-center gap-2">
                          <FieldLabel>Trail profit by</FieldLabel>
                          <input type="number" value={trailingTrailBy}
                            onChange={(e) => setTrailingTrailBy(e.target.value)}
                            className="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </section>

            {/* Backtest date range */}
            <div className="flex h-full flex-col items-start justify-between gap-4 rounded-md border border-slate-200 bg-white p-5 md:flex-row md:items-center md:gap-10">
              <span className="text-sm font-light leading-4 text-slate-700 md:text-base md:leading-7">
                Enter the duration of your backtest
              </span>
              <div className="relative flex w-full items-center gap-4 md:w-max md:flex-row md:gap-10">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-normal leading-6 text-slate-700">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded border border-[#465fff]/20 px-2 py-1 text-sm text-slate-700 focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-normal leading-6 text-slate-700">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded border border-[#465fff]/20 px-2 py-1 text-sm text-slate-700 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Info note */}
            <p className="flex items-center justify-end gap-2 rounded bg-amber-50 p-2 px-4 text-sm font-semibold text-amber-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                />
              </svg>
              Latest Backtest data is available for 24-Mar-26
            </p>

            <div ref={resultSectionRef} className="mt-10 rounded-lg bg-white p-5" id="backtest-results">
              <div className="flex flex-col gap-4">
                <h5 className="text-2xl font-medium text-slate-900">BACKTEST RESULT</h5>
                <p className="rounded border border-red-400 bg-red-50 px-2 py-1.5 text-xs text-red-500">
                  Following results are backtested results on historical data. These historical simulations do not represent actual trading and have not been executed in the live market.
                  <span className="ml-1 text-slate-700 underline">Know more</span>
                </p>
                {backtestStatusText ? <p className="text-sm font-medium text-[#465fff]">{backtestStatusText}</p> : null}
                {backtestError ? <p className="text-sm font-medium text-red-500">{backtestError}</p> : null}
              </div>

              <div className="mt-5 flex flex-col gap-10 py-4">
                <div className="flex flex-wrap items-center justify-between gap-5 border-b border-slate-200 pb-4">
                  <div className="flex w-full flex-wrap items-center justify-between gap-5 text-xs">
                    <div className="flex w-full flex-col items-center gap-8 xl:w-auto xl:flex-row">
                      <div className="flex w-full items-center justify-between gap-4 xl:w-auto">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-700">Include Brokerage</label>
                            <ToggleSwitch enabled={includeBrokerage} onToggle={() => setIncludeBrokerage((v) => !v)} />
                          </div>
                          <div className={`flex items-center justify-center gap-2 text-sm font-medium tabular-nums ${includeBrokerage ? "text-slate-700" : "opacity-50"}`}>
                            <span>₹ 0</span>
                            <button type="button" className="text-slate-500 hover:text-slate-700">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-3.5 w-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931Z" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-700">Taxes &amp; charges</label>
                            <ToggleSwitch enabled={includeTaxes} onToggle={() => setIncludeTaxes((v) => !v)} />
                          </div>
                          <div className={`flex items-center justify-center gap-2 text-sm font-medium tabular-nums ${includeTaxes ? "text-slate-700" : "opacity-50"}`}>
                            <span>₹ 0</span>
                            <button type="button" className="text-slate-500 hover:text-slate-700">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-3.5 w-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-end gap-3">
                        <div className="flex flex-col gap-2">
                          <p className="flex items-center gap-1 text-xs text-slate-700">
                            Slippage (in %)
                            <InfoIcon />
                          </p>
                          <TextInput value={slippage} onChange={setSlippage} type="number" className="min-w-[82px]" />
                        </div>
                        <button type="button" className="rounded border border-[#465fff] px-3 py-2 text-xs font-medium text-[#465fff] transition hover:bg-[#1284d0]/10">
                          Re-calculate
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-transparent text-xs">
                      <ToggleSwitch enabled={includePreviousRegime} onToggle={() => setIncludePreviousRegime((v) => !v)} />
                      <p className="text-sm text-slate-700">Include data from previous regime</p>
                      <InfoIcon />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-between gap-5 border-b border-dashed border-slate-300 pb-4">
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-slate-700">Filter by</p>
                    <div className="flex flex-wrap items-center gap-3">
                      {(weekdaysExpanded || selectedWeekdays.length > 0 || dteExpanded || selectedDtes.length > 0) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedWeekdays([]);
                            setSelectedDtes([]);
                            setWeekdaysExpanded(false);
                            setDteExpanded(false);
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setWeekdaysExpanded((v) => !v)}
                          className={`flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${weekdaysExpanded ? "border-[#465fff] text-[#465fff]" : "border-slate-500 text-slate-600"}`}
                        >
                          Weekdays
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {weekdaysExpanded && (
                          <div className="flex items-center gap-2">
                            {[{ label: "M", val: 1 }, { label: "T", val: 2 }, { label: "W", val: 3 }, { label: "Th", val: 4 }, { label: "F", val: 5 }, { label: "Sa", val: 6 }, { label: "Su", val: 0 }].map((day) => {
                              const active = selectedWeekdays.includes(day.val);
                              return (
                                <button
                                  key={day.val}
                                  type="button"
                                  onClick={() => setSelectedWeekdays((prev) => prev.includes(day.val) ? prev.filter((v) => v !== day.val) : [...prev, day.val])}
                                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition ${active ? "border-[#465fff] bg-[#1284d0]/10 text-[#465fff]" : "border-slate-300 text-slate-600"}`}
                                >
                                  {day.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDteExpanded((v) => !v)}
                          className={`flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${dteExpanded ? "border-[#465fff] text-[#465fff]" : "border-slate-500 text-slate-600"}`}
                        >
                          DTE
                          <InfoIcon />
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {dteExpanded && (
                          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                            {["0 DTE", "1 DTE", "2 DTE", "3 DTE"].map((label, idx) => {
                              const active = selectedDtes.includes(idx);
                              return (
                                <button
                                  key={label}
                                  type="button"
                                  onClick={() => setSelectedDtes((prev) => prev.includes(idx) ? prev.filter((v) => v !== idx) : [...prev, idx])}
                                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${active ? "border-[#465fff] bg-[#1284d0]/10 text-[#465fff]" : "border-slate-300 text-slate-600"}`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <button type="button" className="flex items-center gap-1 rounded-full border border-slate-500 px-3 py-1 text-sm text-slate-600">
                        Budget Days
                        <span className="rounded bg-yellow-300 px-1 text-xs font-semibold text-amber-700">NEW</span>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-slate-700">Margin Estimate</p>
                      <ToggleSwitch enabled={expiryDayMargin} onToggle={() => setExpiryDayMargin((v) => !v)} />
                      <label className="text-sm text-slate-600">for expiry day</label>
                    </div>
                    <button type="button" className="h-max w-max rounded border border-slate-300 px-2 py-1.5 text-xs font-medium text-[#465fff]">
                      Calculate
                    </button>
                  </div>

                  <div className="flex flex-col gap-2">
                    <p className="text-sm leading-6 text-slate-700">Select VIX Range</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-normal capitalize text-slate-600">From</label>
                        <TextInput value={vixFrom} onChange={setVixFrom} type="number" className="min-w-[82px]" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-normal capitalize text-slate-600">To</label>
                        <TextInput value={vixTo} onChange={setVixTo} type="number" className="min-w-[82px]" />
                      </div>
                      <button type="button" className="rounded border border-[#465fff] px-3 py-2 text-xs font-medium text-[#465fff] transition hover:bg-[#1284d0]/10">
                        Re-calculate
                      </button>
                    </div>
                  </div>
                </div>

                <div className="-mt-2">
                  <h4 className="-mb-2 mt-8 text-2xl font-medium text-slate-900">Year-wise Returns</h4>
                  <div className="my-5 w-full overflow-x-auto text-sm font-normal leading-6">
                    <table className="w-full table-auto border-separate border-spacing-y-2 border-spacing-x-0">
                      <thead className="sticky top-0 z-[5] whitespace-nowrap bg-slate-100 text-sm font-semibold text-slate-700">
                        <tr>
                          {["Year", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Total", "Max Drawdown", "Days for MDD", "*R/MDD (Yearly)"].map((head) => (
                            <th key={head} className="border-r border-slate-200 bg-slate-200 px-4 py-4 text-left font-light last:border-r-0">
                              {head}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white text-center text-sm font-medium text-slate-700">
                        {displayedYearWiseRows.map((row) => (
                          <tr key={row.year} className="rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                            <td className="bg-white px-4 py-4 text-left font-semibold">{row.year}</td>
                            {row.months.map((month, idx) => (
                              <td key={`${row.year}-${idx}`} className={`bg-white px-4 py-4 text-left ${month < 0 ? "text-red-500" : "text-green-600"}`}>
                                {formatMoneyCompact(month)}
                              </td>
                            ))}
                            <td className="bg-white px-4 py-4 text-left font-semibold text-green-600">{formatMoneyCompact(row.total)}</td>
                            <td className="bg-white px-4 py-4 text-left font-semibold text-red-500">{formatMoneyCompact(row.maxDrawdown)}</td>
                            <td className="bg-white px-4 py-4 text-left">{row.days}</td>
                            <td className="bg-white px-4 py-4 text-left">{row.ratio}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="my-5 flex flex-col gap-8">
                  <CumulativePnLChart
                    days={chartSeries.days.length ? chartSeries.days : [
                      "2025-10-01",
                      "2025-10-06",
                      "2025-10-08",
                      "2025-10-10",
                      "2025-10-14",
                      "2025-10-16",
                      "2025-10-20",
                      "2025-10-24",
                      "2025-10-28",
                      "2025-10-30",
                    ]}
                    values={chartSeries.cumulative.length ? chartSeries.cumulative : [0, 2200, 5200, 8100, 8800, 9100, 15800, 21900, 24300, 23900]}
                  />
                  <DrawdownChart
                    days={chartSeries.days.length ? chartSeries.days : [
                      "2025-10-01",
                      "2025-10-06",
                      "2025-10-08",
                      "2025-10-10",
                      "2025-10-14",
                      "2025-10-16",
                      "2025-10-20",
                      "2025-10-24",
                      "2025-10-28",
                      "2025-10-30",
                    ]}
                    values={chartSeries.drawdowns.length ? chartSeries.drawdowns : [-300, -300, -300, -3200, -2500, -2200, -300, -300, -300, -300, -1100, -300, -300, -300, -300, -300, -300, -1800, -1200]}
                  />
                </div>

                <div className="border-y border-slate-200">
                  <div className="flex w-full flex-col justify-between gap-2 py-5 md:flex-row md:items-center">
                    <div className="flex w-full flex-col items-start justify-between gap-4 md:w-[60%] md:flex-row md:items-center">
                      <div className="flex items-center justify-center gap-2">
                        <h4 className="text-lg font-medium text-slate-900">
                          Curve Fitting Analysis: <span className="text-xs text-slate-500">Monte Carlo Drawdown</span>
                        </h4>
                        <InfoIcon />
                      </div>
                      <div className="flex w-full flex-col items-center justify-between gap-4 pr-0 md:flex-row md:pr-6">
                        <div className="relative w-full pt-1">
                          <input type="range" min="1" max="99" step="1" value="95" readOnly className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-[#1284d0]" />
                          <div className="absolute left-[95%] top-0 -translate-x-1/2 -translate-y-8 rounded bg-slate-800 px-3 py-1 text-xs text-white shadow-md">
                            95
                          </div>
                          <div className="absolute bottom-0 left-0 translate-y-6 font-semibold text-slate-700">1</div>
                          <div className="absolute bottom-0 right-0 translate-y-6 font-semibold text-slate-700">99</div>
                        </div>
                        <button type="button" className="whitespace-nowrap rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">
                          Run 10000 Simulations
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex min-w-[320px] flex-col gap-1.5 border-b border-slate-200 py-5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-700">In/Out Sample:</span>
                      <InfoIcon />
                      <ToggleSwitch enabled={false} />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-between gap-2 md:w-full md:flex-row md:overflow-auto">
                  <ResultSummaryTable rows={displayedSummaryLeft} />
                  <ResultSummaryTable rows={displayedSummaryMiddle} />
                  <ResultSummaryTable rows={displayedSummaryRight} />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-end">
                    <button type="button" className="inline-flex items-center gap-2 rounded border border-[#465fff] px-3 py-2 text-xs font-medium text-[#465fff] transition hover:bg-[#1284d0]/10">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Download trades
                    </button>
                  </div>

                  <div className="mt-10">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-5">
                      <div className="flex w-fit flex-col gap-1">
                        <h4 className="text-2xl font-medium text-slate-900">Full Report</h4>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-slate-700">
                        <div className="relative flex items-center gap-2 justify-between">
                          <label className="text-xs font-normal leading-6 text-slate-700">Sort By:</label>
                          <NativeSelect
                            value={fullReportSort}
                            options={[
                              { value: "EntryDate", label: "Entry date" },
                              { value: "ProfitLoss", label: "P/L" },
                            ]}
                            onChange={setFullReportSort}
                            className="w-max"
                          />
                        </div>
                        <div className="relative flex flex-wrap items-center justify-between gap-2">
                          <div className="flex">
                            <button
                              type="button"
                              onClick={() => setFullReportOrder("Asc")}
                              className={`border border-[#465fff] px-2 py-2 text-xs ${fullReportOrder === "Asc" ? "bg-[#1284d0] text-white" : "text-[#465fff]"}`}
                            >
                              Asc
                            </button>
                            <button
                              type="button"
                              onClick={() => setFullReportOrder("Desc")}
                              className={`border border-l-0 border-[#465fff] px-2 py-2 text-xs ${fullReportOrder === "Desc" ? "bg-[#1284d0] text-white" : "text-[#465fff]"}`}
                            >
                              Desc
                            </button>
                          </div>
                        </div>
                        <span>Showing <b>1 - {displayedFullReportRows.length}</b> trades out of <b>{displayedFullReportRows.length}</b></span>
                      </div>
                    </div>

                    <div className="w-full overflow-auto">
                      <table className="w-full overflow-auto text-center">
                        <thead className="rounded border-2 border-slate-300 bg-slate-200">
                          <tr>
                            {["Index", "Entry Date", "Entry Time", "Exit Date", "Exit Time", "Type", "Strike", "B/S", "Qty", "Entry Type", "Entry Price", "Exit Type", "Exit Price", "Leg Type", "Reentry", "Reentry Reason", "Vix", "P/L"].map((head) => (
                              <th key={head} className="border-2 border-slate-300 p-1 text-sm text-slate-700">
                                {head}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-slate-50">
                          {displayedFullReportRows.map((row) => (
                            <tr key={row.index} className="border-b border-white">
                              <td className="border-2 border-slate-300 p-3 text-sm text-slate-700">{row.index}</td>
                              <td className="border-2 border-slate-300 p-3 text-sm text-slate-700">{row.entryDate}</td>
                              <td className="border-2 border-slate-300 p-3 text-sm text-slate-700">{row.entryTime}</td>
                              <td className="border-2 border-slate-300 p-3 text-sm text-slate-700">{row.exitDate}</td>
                              <td className="border-2 border-slate-300 p-3 text-sm text-slate-700">{row.exitTime}</td>
                              <td className="border-2 border-slate-300 p-3 text-sm text-slate-700">{row.type}</td>
                              <td className="border-2 border-slate-300 p-3 text-sm text-slate-700">{row.strike}</td>
                              <td className="border-2 border-slate-300 p-3 text-sm text-slate-700">{row.side}</td>
                              <td className="border-2 border-slate-300 p-3 text-sm text-slate-700">{row.qty}</td>
                              <td className="border-2 border-slate-300 p-3 text-sm text-slate-700">{row.entryType}</td>
                              <td className="border-2 border-slate-300 p-3 text-sm text-slate-700">{row.entryPrice}</td>
                              <td className="border-2 border-slate-300 p-3 text-sm text-slate-700">{row.exitType}</td>
                              <td className="border-2 border-slate-300 p-3 text-sm text-slate-700">{row.exitPrice}</td>
                              <td className="border-2 border-slate-300 p-3 text-sm text-slate-700">{row.legType}</td>
                              <td className="border-2 border-slate-300 p-3 text-sm text-slate-700">{row.reentry}</td>
                              <td className="border-2 border-slate-300 p-3 text-sm text-slate-700">{row.reentryReason}</td>
                              <td className="border-2 border-slate-300 p-3 text-sm text-slate-700">{row.vix}</td>
                              <td className="border-2 border-slate-300 p-3 text-sm font-semibold">
                                <ResultValue value={String(row.pnl)} tone={row.pnlTone as "positive" | "negative" | "neutral"} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-5">
                      <button type="button" className="rounded border border-[#465fff] px-3 py-2 text-xs font-medium text-[#465fff] transition hover:bg-[#1284d0]/10">
                        Download Report
                      </button>
                      <div className="flex items-center gap-1 rounded text-[#465fff]">
                        {["«", "‹", "1", "›", "»"].map((p, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className={`rounded px-2 py-1 text-sm ${p === "1" ? "bg-[#1284d0] text-white" : "hover:bg-[#1284d0]/10"}`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 flex w-full flex-col items-end justify-center bg-white shadow-[0_-6px_20px_rgba(15,23,42,0.12)]">
        <div className="flex w-full items-center justify-end gap-3 bg-white p-3 px-6">
          <button type="button" className="inline-flex items-center gap-2 rounded border border-[#465fff] px-3 py-2 text-xs font-semibold text-[#465fff] transition hover:bg-[#1284d0]/10 md:px-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4">
              <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
              <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
              <path d="M7 3v4a1 1 0 0 0 1 1h7" />
            </svg>
            <span className="hidden md:block">Save Strategy</span>
          </button>
          {strategy_id ? (
            <>
              <button type="button" className="inline-flex items-center gap-2 rounded border border-orange-500 px-3 py-2 text-xs font-semibold text-orange-500 transition hover:border-red-500 hover:bg-red-500 hover:text-white md:px-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span className="hidden md:block">Update Strategy</span>
              </button>
              <button type="button" className="inline-flex items-center gap-2 rounded border border-[#465fff] px-3 py-2 text-xs font-semibold text-[#465fff] transition hover:bg-[#1284d0]/10 md:px-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4">
                  <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
                  <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
                  <path d="M7 3v4a1 1 0 0 0 1 1h7" />
                </svg>
                <span className="hidden md:block">Save As Strategy</span>
              </button>
            </>
          ) : null}
          <button type="button" onClick={() => void runBacktest()} disabled={backtestLoading || !strategy_id} className="inline-flex items-center gap-2 rounded border border-green-600 bg-green-500 px-3 py-2 text-xs font-semibold text-white transition hover:border-green-700 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 md:px-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
            </svg>
            <span className="hidden md:block">{backtestLoading ? "Running Backtest" : "Start Backtest"}</span>
            <span className="hidden text-[10px] md:block">(Shift+enter)</span>
          </button>
        </div>
      </div>

      <ImportStrategyModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />
    </div>
  );
}
