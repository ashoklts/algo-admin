import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import Badge from "../../components/ui/badge/Badge";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

// ─── Types ─────────────────────────────────────────────────────────────────

interface Notification {
  event_type?: string;
  type?: string;
  timestamp?: string;
  created_at?: string;
  trigger_description?: string;
  what_happened?: string;
  message?: string;
  description?: string;
  data?: string | Record<string, unknown>;
  severity?: string;
  typeLabel?: string;
  messageText?: string;
  timestampText?: string;
}

interface Leg {
  token?: string;
  trading_symbol?: string;
  symbol?: string;
  ticker?: string;
  underlying?: string;
  option_type?: string;
  strike_price?: number;
  expiry?: string;
  effective_quantity?: number;
  quantity?: number;
  entry_price?: number;
  buy_price?: number;
  exit_price?: number;
  sell_price?: number;
  entry_time?: string;
  buy_time?: string;
  exit_time?: string;
  sell_time?: string;
  entry_timestamp?: string;
  exit_timestamp?: string;
  last_saw_price?: number;
  mark_price?: number;
  status?: string;
  pnl?: number;
  lots?: number;
  total_lots?: number;
  no_of_lots?: number;
  lot_size?: number;
  lotsize?: number;
  quantity_per_lot?: number;
  position?: string;
  position_side?: string;
  sub_trades?: { lots?: number; entry_price?: number; exit_price?: number }[];
  entry_trade?: { price?: number; trigger_price?: number; quantity?: number; traded_timestamp?: string; trigger_timestamp?: string; exchange_timestamp?: string };
  exit_trade?: { price?: number; trigger_price?: number; quantity?: number; traded_timestamp?: string; trigger_timestamp?: string; exchange_timestamp?: string };
}

interface BrokerOrder {
  trading_symbol?: string;
  symbol?: string;
  instrument?: string;
  order_side?: string;
  transaction_type?: string;
  quantity?: number;
  qty?: number;
  status?: string;
  order_id?: string;
  broker_order_id?: string;
  _id?: string;
  placed_at?: string;
  order_timestamp?: string;
  created_at?: string;
}

interface TradePayload {
  trade?: {
    _id?: string;
    name?: string;
    status?: string;
    ticker?: string;
    underlying?: string;
    broker?: string;
    broker_label?: string;
    broker_details?: { broker_name?: string; display_name?: string; broker_icon?: string };
  };
  summary?: {
    mtm?: number;
    open_positions?: number;
    margin_blocked?: number;
    spot_price?: number;
    spot_change_text?: string;
    deployed_at?: string;
    entry_time?: string;
    exit_time?: string;
  };
  legs?: { open?: Leg[]; closed?: Leg[] };
  broker_orders?: BrokerOrder[];
  notifications?: Notification[];
  notification_status?: Record<string, number>;
  view_type?: string;
  strategy_id?: string;
  group_id?: string;
  portfolio_id?: string;
  strategies?: StrategyItem[];
  execution_config_base?: StrategyItem["execution_config_base"];
  execution_config_extra?: StrategyItem["execution_config_extra"];
}

interface LegExecConfig {
  ProductType?: string;
  ReferenceForTgtSL?: string;
  EntryDelay?: number;
  EntryOrder?: {
    Type?: string;
    Value?: {
      Buffer?: { Type?: string; Value?: { TriggerBuffer?: number; LimitBuffer?: number } };
      Modification?: { MarketOrderAfter?: number };
    };
  };
  ExitOrder?: {
    Type?: string;
    Value?: {
      Buffer?: { Type?: string; Value?: { TriggerBuffer?: number; LimitBuffer?: number } };
      Modification?: { ModificationFrequency?: number; ContinuousMonitoring?: string; MarketOrderAfter?: number };
    };
  };
}

interface StrategyItem {
  trade?: { name?: string; _id?: string };
  execution_config_base?: {
    Multiplier?: number;
    LikeBacktester?: boolean;
    MarginAutoSquareOff?: boolean;
    TimeDelta?: number;
  };
  execution_config_extra?: {
    ListOfLegExecutionConfig?: LegExecConfig[];
  };
  legs?: { open?: unknown[]; closed?: unknown[]; all?: unknown[] };
  notifications?: Notification[];
  notification_status?: Record<string, number>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtMoney(val?: number) {
  const n = Number(val ?? 0);
  const abs = Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "₹ " + (n < 0 ? "-" : "") + abs;
}

function fmtDateTime(raw?: string) {
  if (!raw) return "-";
  const dt = new Date(raw.replace(" ", "T"));
  if (isNaN(dt.getTime())) return raw;
  return dt.toLocaleString("en-IN", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function normInstrument(leg: Leg) {
  if (leg.trading_symbol) return leg.trading_symbol;
  if (leg.symbol) return leg.symbol;
  const base = leg.ticker || leg.underlying || "";
  const strike = leg.strike_price ? String(leg.strike_price) : "";
  const ot = leg.option_type ? leg.option_type.toUpperCase() : "";
  return [base, leg.expiry, strike, ot].filter(Boolean).join(" ") || "-";
}

function normPrice(leg: Leg, side: "entry" | "exit") {
  const val = side === "entry"
    ? (leg.entry_price ?? leg.buy_price ?? leg.entry_trade?.price ?? leg.entry_trade?.trigger_price)
    : (leg.exit_price ?? leg.sell_price ?? leg.exit_trade?.price ?? leg.exit_trade?.trigger_price);
  return val != null ? Number(val).toFixed(2) : "-";
}

function normTime(leg: Leg, side: "entry" | "exit") {
  const raw = side === "entry"
    ? (leg.entry_time || leg.buy_time || leg.entry_timestamp || leg.entry_trade?.traded_timestamp || leg.entry_trade?.trigger_timestamp || leg.entry_trade?.exchange_timestamp)
    : (leg.exit_time || leg.sell_time || leg.exit_timestamp || leg.exit_trade?.traded_timestamp || leg.exit_trade?.trigger_timestamp || leg.exit_trade?.exchange_timestamp);
  return fmtDateTime(raw);
}

function normEntryType(leg: Leg) {
  return String(leg.position_side ?? leg.position ?? "sell").toLowerCase() === "buy" ? "Buy" : "Sell";
}

function statusStyle(status: string) {
  const s = status.toLowerCase();
  if (s.includes("sqd") || s.includes("squared")) return "border-gray-300 bg-white text-gray-500";
  if (s.includes("running") || s.includes("active")) return "border-green-300 bg-green-50 text-green-700";
  if (s.includes("pending") || s.includes("import")) return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-gray-300 bg-white text-gray-600";
}

// ─── Brokerage & Taxes calculation ────────────────────────────────────────

const NSE_STT      = 0.001;
const NSE_EXCHANGE = 0.00053;
const NSE_STAMP    = 0.00003;
const NSE_SEBI     = 0.0000010;
const NSE_GST      = 0.18;

interface ChargeLeg {
  lots: number;
  lot_size: number;
  position: string;
  entry_price: number;
  exit_price: number;
  sub_trades: { lots?: number; entry_price?: number; exit_price?: number }[];
}

interface ChargeTrade {
  legs: ChargeLeg[];
  orders: BrokerOrder[];
}

function getExecPrice(trade?: { price?: number; trigger_price?: number }) {
  if (!trade) return 0;
  return Number(trade.price ?? trade.trigger_price ?? 0) || 0;
}


function getLegLots(leg: Leg) {
  const qty   = Number(leg.effective_quantity ?? leg.quantity ?? 0) || 0;
  const lots  = Number(leg.lots ?? leg.total_lots ?? leg.no_of_lots ?? 0) || 0;
  if (lots > 0) return lots;
  const ls    = Number(leg.lot_size ?? leg.lotsize ?? leg.quantity_per_lot ?? 0) || 0;
  if (qty > 0 && ls > 0) return Math.max(qty / ls, 1);
  return qty > 0 ? 1 : 0;
}

function getLegLotSize(leg: Leg) {
  const qty = Number(leg.effective_quantity ?? leg.quantity ?? 0) || 0;
  const lots = Number(leg.lots ?? leg.total_lots ?? leg.no_of_lots ?? 0) || 0;
  const ls = Number(leg.lot_size ?? leg.lotsize ?? leg.quantity_per_lot ?? 0) || 0;
  if (ls > 0) return ls;
  if (qty > 0 && lots > 0) return Math.max(qty / lots, 1);
  return qty > 0 ? qty : 1;
}

function normalizeChargeLeg(leg: Leg): ChargeLeg {
  return {
    lots: getLegLots(leg),
    lot_size: getLegLotSize(leg),
    position: String(leg.position_side ?? leg.position ?? "sell"),
    entry_price: getExecPrice(leg.entry_trade) || Number(leg.entry_price ?? 0) || 0,
    exit_price: getExecPrice(leg.exit_trade) || Number(leg.exit_price ?? 0) || 0,
    sub_trades: Array.isArray(leg.sub_trades) ? leg.sub_trades : [],
  };
}

function buildChargeTrades(payload: { legs?: { open?: Leg[]; closed?: Leg[] }; broker_orders?: BrokerOrder[] }): ChargeTrade[] {
  const allLegs = [
    ...(payload.legs?.open ?? []),
    ...(payload.legs?.closed ?? []),
  ].map(normalizeChargeLeg);
  return [{ legs: allLegs, orders: payload.broker_orders ?? [] }];
}

function getTradeLotCount(trade: ChargeTrade) {
  const fromLegs = trade.legs.reduce((s, l) => s + l.lots, 0);
  return fromLegs || 1;
}

function getTradeOrderCount(trade: ChargeTrade) {
  if (trade.orders.length) return trade.orders.length;
  return trade.legs.reduce((s, _) => s + 1, 0) || 1;
}

function calcTradeBrokerage(trade: ChargeTrade, rate: number, rateType: string) {
  if (rate <= 0) return 0;
  return rateType === "per_lot"
    ? rate * getTradeLotCount(trade)
    : rate * getTradeOrderCount(trade);
}

function computeTotalBrokerage(trades: ChargeTrade[], rate: number, rateType: string) {
  return trades.reduce((s, t) => s + calcTradeBrokerage(t, rate, rateType), 0);
}

interface TaxBucket { stt: number; exchange: number; stamp: number; sebi: number; gst: number; total: number }

function calcTradeTaxes(trade: ChargeTrade): TaxBucket {
  let stt = 0, exchange = 0, stamp = 0, sebi = 0;
  if (trade.orders.length) {
    trade.orders.forEach(o => {
      const qty   = Number((o as Record<string, unknown>).filled_quantity ?? (o as Record<string, unknown>).fill_qty ?? o.quantity ?? o.qty ?? 0) || 0;
      const price = Number((o as Record<string, unknown>).average_price ?? (o as Record<string, unknown>).avg_price ?? (o as Record<string, unknown>).fill_price ?? (o as Record<string, unknown>).price ?? (o as Record<string, unknown>).trigger_price ?? 0) || 0;
      const side  = String(o.transaction_type ?? o.order_side ?? "").toLowerCase();
      if (!qty || !price) return;
      const turnover = qty * price;
      if (side === "sell" || side === "s") stt += turnover * NSE_STT;
      else stamp += turnover * NSE_STAMP;
      exchange += turnover * NSE_EXCHANGE;
      sebi     += turnover * NSE_SEBI;
    });
  } else {
    trade.legs.forEach(leg => {
      const isSell = leg.position.toLowerCase() !== "buy";
      const subList = leg.sub_trades.length ? leg.sub_trades : [null];
      subList.forEach(sub => {
        const subLots = Number(sub?.lots ?? 0) || leg.lots;
        const qty = subLots * leg.lot_size;
        const entryPx = Number(sub?.entry_price ?? leg.entry_price) || 0;
        const exitPx  = Number(sub?.exit_price  ?? leg.exit_price)  || 0;
        const entryT  = entryPx * qty;
        const exitT   = exitPx * qty;
        if (isSell) { stt += entryT * NSE_STT; stamp += exitT * NSE_STAMP; }
        else        { stamp += entryT * NSE_STAMP; stt += exitT * NSE_STT; }
        exchange += (entryT + exitT) * NSE_EXCHANGE;
        sebi     += (entryT + exitT) * NSE_SEBI;
      });
    });
  }
  const gst = (exchange + sebi) * NSE_GST;
  return { stt, exchange, stamp, sebi, gst, total: stt + exchange + stamp + sebi + gst };
}

function aggregateTaxes(trades: ChargeTrade[]): TaxBucket {
  return trades.reduce((agg, t) => {
    const b = calcTradeTaxes(t);
    return { stt: agg.stt + b.stt, exchange: agg.exchange + b.exchange, stamp: agg.stamp + b.stamp, sebi: agg.sebi + b.sebi, gst: agg.gst + b.gst, total: agg.total + b.total };
  }, { stt: 0, exchange: 0, stamp: 0, sebi: 0, gst: 0, total: 0 });
}

function fmtCost(val: number) {
  return "₹ " + Math.abs(val).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Notification helpers ──────────────────────────────────────────────────

const NOTIFICATION_LABEL_MAP: Record<string, string> = {
  entry_taken: "Entry Taken",
  trail_sl_changed: "Trail SL Changed",
  sl_hit: "SL Hit",
  target_hit: "Target Hit",
  reentry_queued: "Reentry Queued",
  square_off: "Square Off",
  squared_off: "Squared Off",
  pending_entry: "Pending Entry",
  momentum_pending: "Momentum Pending",
  overall_sl: "Overall SI",
  sl: "SI",
  trail_sl: "TrailSL",
};

function toTitleCase(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function getNotifTypeLabel(eventType: string) {
  return NOTIFICATION_LABEL_MAP[eventType] ?? toTitleCase(eventType || "notification");
}

function getNotifSeverity(eventType: string): "info" | "critical" | "error" {
  const t = eventType.toLowerCase();
  if (["error", "rejected", "failed"].includes(t)) return "error";
  if (["sl_hit", "stop_loss_hit", "square_off", "squared_off", "cancelled"].includes(t)) return "critical";
  return "info";
}

function buildNotifMessage(item: Notification): string {
  const data = typeof item.data === "object" && item.data ? item.data : {};
  const direct = (
    item.trigger_description ||
    (data as Record<string, unknown>).trigger_description ||
    item.what_happened ||
    (data as Record<string, unknown>).what_happened ||
    item.message ||
    item.description ||
    ""
  ) as string;
  if (direct.trim()) return direct.trim();
  return toTitleCase(item.event_type || item.type || "notification");
}

type EnrichedNotification = Notification & {
  severity: string;
  typeLabel: string;
  messageText: string;
  timestampText: string;
};

function enrichNotifications(raw: Notification[]): EnrichedNotification[] {
  return raw.map(item => ({
    ...item,
    severity: getNotifSeverity(item.event_type || item.type || ""),
    typeLabel: getNotifTypeLabel(item.event_type || item.type || ""),
    messageText: buildNotifMessage(item),
    timestampText: fmtDateTime(item.timestamp || item.created_at),
  })).sort((a, b) => {
    const at = new Date(String(a.timestamp || a.created_at || "").replace(" ", "T")).getTime() || 0;
    const bt = new Date(String(b.timestamp || b.created_at || "").replace(" ", "T")).getTime() || 0;
    return bt - at;
  });
}

// ─── NotificationStatus component ─────────────────────────────────────────

type SeverityFilter = "all" | "info" | "critical" | "error";

function severityBadgeColor(severity: string): "info" | "warning" | "error" | "light" {
  if (severity === "error") return "error";
  if (severity === "critical") return "warning";
  return "info";
}

function NotificationStatus({ notifications, notificationStatus, strategies }: {
  notifications: Notification[];
  notificationStatus: Record<string, number>;
  strategies?: StrategyItem[];
}) {
  const showStratTabs = (strategies?.length ?? 0) > 1;
  const [stratTab, setStratTab]   = useState(-1); // -1 = All
  const [filter, setFilter]       = useState<SeverityFilter>("all");
  const [search, setSearch]       = useState("");

  // Reset filters when strategy tab changes
  const handleStratTab = (idx: number) => { setStratTab(idx); setFilter("all"); setSearch(""); };

  // Pick correct notification source based on selected strategy tab
  const activeNotifs  = stratTab === -1 ? notifications : (strategies?.[stratTab]?.notifications ?? []);
  const activeStatus  = stratTab === -1 ? notificationStatus : (strategies?.[stratTab]?.notification_status ?? {});

  const enriched = enrichNotifications(activeNotifs);

  const counts = {
    all:      enriched.length,
    info:     enriched.filter(n => n.severity === "info").length,
    critical: enriched.filter(n => n.severity === "critical").length,
    error:    enriched.filter(n => n.severity === "error").length,
  };

  const q = search.trim().toLowerCase();
  const visible = enriched
    .filter(n => filter === "all" || n.severity === filter)
    .filter(n => !q || [n.typeLabel, n.messageText, n.timestampText].some(t => t.toLowerCase().includes(q)));

  const statusChips = Object.keys(activeStatus);
  const FILTERS: { key: SeverityFilter; label: string }[] = [
    { key: "all",      label: `All (${counts.all})` },
    { key: "info",     label: `Info (${counts.info})` },
    { key: "critical", label: `Critical (${counts.critical})` },
    { key: "error",    label: `Error (${counts.error})` },
  ];

  return (
    <div className="mt-8 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">

      {/* Card header: title + search */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <h3 className="text-base font-medium text-gray-800 dark:text-white/90">Notification Status</h3>
        <div className="relative w-full sm:w-64">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
            </svg>
          </span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-secondary-500 focus:ring-1 focus:ring-secondary-500 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300 dark:placeholder-gray-500 dark:focus:border-secondary-400"
          />
        </div>
      </div>

      {/* Strategy tabs (group view only) */}
      {showStratTabs && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          <div className="flex flex-wrap items-center gap-5 px-6 sm:gap-7">
            {/* All tab */}
            {[{ name: "All", count: notifications.length, idx: -1 }, ...(strategies ?? []).map((s, i) => ({
              name: s.trade?.name ?? `Strategy ${i + 1}`,
              count: s.notifications?.length ?? 0,
              idx: i,
            }))].map(({ name, count, idx }) => {
              const active = stratTab === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleStratTab(idx)}
                  className={`relative inline-flex items-center gap-2 px-0 pb-4 pt-3 text-sm font-medium leading-none transition ${
                    active
                      ? "text-secondary-500 dark:text-secondary-400"
                      : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90"
                  }`}
                >
                  <span>{name}</span>
                  {count > 0 && (
                    <span className={`inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 py-0 text-xs font-medium ${
                      active
                        ? "bg-secondary-50 text-secondary-500 dark:bg-secondary-500/10"
                        : "bg-gray-100 text-gray-500 dark:bg-white/[0.03] dark:text-gray-400"
                    }`}>{count}</span>
                  )}
                  <span className={`absolute bottom-0 left-0 h-0.5 w-full rounded-full transition ${active ? "bg-secondary-500" : "bg-transparent"}`} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Severity filter + status chips */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-4 py-1.5 text-theme-xs font-medium transition-colors ${
                filter === f.key
                  ? "border-secondary-500 bg-secondary-25 text-secondary-600 dark:border-secondary-400 dark:bg-secondary-500/10 dark:text-secondary-400"
                  : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {statusChips.map(key => (
            <span key={key} className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300">
              {getNotifTypeLabel(key)}: {activeStatus[key]}
            </span>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="max-w-full overflow-x-auto border-t border-gray-100 dark:border-gray-800">
        {visible.length === 0 ? (
          <div className="px-6 py-8 text-sm text-gray-400">
            {q ? `No results for "${search}".` : "No notifications found."}
          </div>
        ) : (
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow>
                {["Time", "Status", "Message"].map(h => (
                  <TableCell key={h} isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{h}</TableCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {visible.map((item, i) => (
                <TableRow key={i} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                  <TableCell className="px-5 py-4 text-start text-theme-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {item.timestampText}
                  </TableCell>
                  <TableCell className="px-5 py-4 text-start">
                    <div className="flex items-center gap-2.5">
                      <span className="font-medium text-theme-sm text-gray-800 dark:text-white/90 whitespace-nowrap">{item.typeLabel}</span>
                      <Badge size="sm" color={severityBadgeColor(item.severity)}>
                        {item.severity.charAt(0).toUpperCase() + item.severity.slice(1)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="px-5 py-4 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                    {item.messageText}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

// ─── TrendArrow ────────────────────────────────────────────────────────────

function LegStatusBadge({ status }: { status?: string | number }) {
  const s = Number(status);
  if (s === 1) return (
    <span className="inline-flex items-center rounded-full bg-success-50 px-2.5 py-0 text-xs font-medium text-success-700 border border-success-200">
      Running
    </span>
  );
  if (s === 2) return (
    <span className="inline-flex items-center rounded-full bg-error-50 px-2.5 py-0 text-xs font-medium text-error-700 border border-error-200">
      Closed
    </span>
  );
  if (s === 3) return (
    <span className="inline-flex items-center rounded-full bg-warning-50 px-2.5 py-0 text-xs font-medium text-warning-700 border border-warning-200">
      Pending
    </span>
  );
  return <span className="text-[#667085] text-xs">{status ?? "-"}</span>;
}

function TrendArrow({ value }: { value: number }) {
  if (value > 0) return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block w-4 h-4 ml-0.5 align-middle">
      <path fillRule="evenodd" clipRule="evenodd" d="M7.60141 2.33683C7.73885 2.18084 7.9401 2.08243 8.16435 2.08243C8.16475 2.08243 8.16516 2.08243 8.16556 2.08243C8.35773 2.08219 8.54998 2.15535 8.69664 2.30191L12.6968 6.29924C12.9898 6.59203 12.9899 7.0669 12.6971 7.3599C12.4044 7.6529 11.9295 7.65306 11.6365 7.36027L8.91435 4.64004L8.91435 13.5C8.91435 13.9142 8.57856 14.25 8.16435 14.25C7.75013 14.25 7.41435 13.9142 7.41435 13.5L7.41435 4.64442L4.69679 7.36025C4.4038 7.65305 3.92893 7.6529 3.63613 7.35992C3.34333 7.06693 3.34348 6.59206 3.63646 6.29926L7.60141 2.33683Z" fill="#039855" />
    </svg>
  );
  if (value < 0) return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block w-4 h-4 ml-0.5 align-middle">
      <path fillRule="evenodd" clipRule="evenodd" d="M7.26816 13.6632C7.4056 13.8192 7.60686 13.9176 7.8311 13.9176C7.83148 13.9176 7.83187 13.9176 7.83226 13.9176C8.02445 13.9178 8.21671 13.8447 8.36339 13.6981L12.3635 9.70076C12.6565 9.40797 12.6567 8.9331 12.3639 8.6401C12.0711 8.34711 11.5962 8.34694 11.3032 8.63973L8.5811 11.36L8.5811 2.5C8.5811 2.08579 8.24531 1.75 7.8311 1.75C7.41688 1.75 7.0811 2.08579 7.0811 2.5L7.0811 11.3556L4.36354 8.63975C4.07055 8.34695 3.59568 8.3471 3.30288 8.64009C3.01008 8.93307 3.01023 9.40794 3.30321 9.70075L7.26816 13.6632Z" fill="#D92D20" />
    </svg>
  );
  return null;
}

function OpenLegRibbon({ entryType }: { entryType: "Buy" | "Sell" }) {
  const ribbonColor = entryType === "Buy" ? "bg-green-500" : "bg-red-500";

  return (
    <div className="absolute left-0 top-0 overflow-hidden">
      <div className="relative h-[36px] w-[36px] overflow-hidden">
        <div className={`absolute -left-[14px] top-[6px] w-[52px] -rotate-45 ${ribbonColor} py-0 text-center text-[10px] font-semibold text-white shadow-sm`}>
          {entryType}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

const thClass = "px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400";
const tdClass = "px-5 py-4 text-start text-theme-sm text-[#667085]";
const headerActionButtonClass = "inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-primary-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-white/[0.03] dark:text-white/90";

function HeaderActionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
      <path d="M8 1.3335L13.3333 4.00016V12.0002L8 14.6668L2.66667 12.0002V4.00016L8 1.3335Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M2.66667 4L8 7.00001L13.3333 4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8 7V14.6667" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function LegTable({ legs, title, isOpen, ltpMap }: { legs: Leg[]; title: string; isOpen?: boolean; ltpMap?: Record<string, number> }) {
  const headers = isOpen
    ? ["Instrument", "Entry Type", "Qty", "Entry Price", "Entry Time", "LTP", "Status", "MTM"]
    : ["Instrument", "Entry Type", "Qty", "Entry Price", "Entry Time", "Exit Price", "Exit Time", "Status", "MTM"];

  return (
    <div className="mt-8 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between px-6 py-5">
        <h3 className="text-base font-medium text-gray-800 dark:text-white/90">{title}</h3>
        <span className="text-theme-xs text-gray-400">Count: {legs.length}</span>
      </div>
      <div className="max-w-full overflow-x-auto border-t border-gray-100 dark:border-gray-800">
        {legs.length === 0 ? (
          <div className="px-6 py-8 text-sm text-gray-400">No legs found.</div>
        ) : (
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow>
                {headers.map(h => (
                  <TableCell key={h} isHeader className={thClass}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {legs.map((leg, i) => {
                const sym        = leg.trading_symbol ?? leg.symbol ?? "";
                const entryPx    = Number(leg.entry_price ?? leg.buy_price ?? leg.entry_trade?.price ?? 0);
                const qty        = Number(leg.effective_quantity ?? leg.quantity ?? 0);
                const liveLtpVal = isOpen
                  ? (ltpMap?.[String(leg.token ?? "")] ?? ltpMap?.[sym] ?? leg.last_saw_price ?? leg.mark_price)
                  : undefined;
                const ltpDisplay = liveLtpVal != null ? Number(liveLtpVal).toFixed(2) : "-";
                const entryType  = normEntryType(leg);
                const isSell     = entryType === "Sell";
                const ltpTextColor = liveLtpVal == null || entryPx <= 0
                  ? "text-gray-800 dark:text-white/90"
                  : isSell
                    ? Number(liveLtpVal) > entryPx
                      ? "text-error-600 dark:text-error-400"
                      : "text-success-600 dark:text-success-400"
                    : Number(liveLtpVal) >= entryPx
                      ? "text-success-600 dark:text-success-400"
                      : "text-error-600 dark:text-error-400";
                const livePnl    = isOpen && liveLtpVal != null && entryPx > 0 && qty > 0
                  ? (isSell ? (entryPx - Number(liveLtpVal)) * qty : (Number(liveLtpVal) - entryPx) * qty)
                  : Number(leg.pnl ?? 0);
                const base       = entryPx * qty;
                const mtmPct     = base > 0 ? ((livePnl / base) * 100).toFixed(2) + "%" : "-";
                return (
                  <TableRow key={i} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                    <TableCell className={isOpen ? "relative overflow-hidden px-0 py-0 text-start text-theme-sm text-[#667085]" : `${tdClass} font-semibold whitespace-nowrap`}>
                      {isOpen ? (
                        <div className="relative min-w-[180px] px-5 py-4">
                          <div className="pointer-events-none absolute left-0 top-0 z-10">
                            <OpenLegRibbon entryType={entryType} />
                          </div>
                          <span className="block font-semibold whitespace-nowrap pl-6">{normInstrument(leg)}</span>
                        </div>
                      ) : (
                        normInstrument(leg)
                      )}
                    </TableCell>
                    <TableCell className={`${tdClass} font-medium`}>{entryType}</TableCell>
                    <TableCell className={`${tdClass} font-semibold`}>{qty || "-"}</TableCell>
                    <TableCell className={tdClass}>{normPrice(leg, "entry")}</TableCell>
                    <TableCell className={`${tdClass} whitespace-nowrap`}>{normTime(leg, "entry")}</TableCell>
                    {isOpen ? (
                      <TableCell className={`px-5 py-4 text-start text-theme-sm tabular-nums font-semibold ${ltpTextColor}`}>
                        {ltpDisplay}
                      </TableCell>
                    ) : (
                      <>
                        <TableCell className={tdClass}>{normPrice(leg, "exit")}</TableCell>
                        <TableCell className={`${tdClass} whitespace-nowrap`}>{normTime(leg, "exit")}</TableCell>
                      </>
                    )}
                    <TableCell className="px-5 py-4 text-start"><LegStatusBadge status={leg.status} /></TableCell>
                    <TableCell className={`px-5 py-4 text-start text-theme-sm font-bold whitespace-nowrap ${livePnl >= 0 ? "text-success-600 dark:text-success-400" : "text-error-600 dark:text-error-400"}`}>
                      {fmtMoney(livePnl)}&nbsp;<span className="font-medium text-[11px] opacity-75">({mtmPct})</span><TrendArrow value={livePnl} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function OrderTable({ orders }: { orders: BrokerOrder[] }) {
  return (
    <div className="mt-8 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="px-6 py-5">
        <h3 className="text-base font-medium text-gray-800 dark:text-white/90">Broker Orders</h3>
      </div>
      <div className="max-w-full overflow-x-auto border-t border-gray-100 dark:border-gray-800">
        {orders.length === 0 ? (
          <div className="px-6 py-8 text-sm text-gray-400">No broker orders found.</div>
        ) : (
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow>
                {["Instrument", "Side", "Qty", "Status", "Order ID", "Placed At"].map(h => (
                  <TableCell key={h} isHeader className={thClass}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {orders.map((o, i) => (
                <TableRow key={i} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                  <TableCell className={`${tdClass} font-medium text-gray-800 dark:text-white/90 whitespace-nowrap`}>{o.trading_symbol ?? o.symbol ?? o.instrument ?? "-"}</TableCell>
                  <TableCell className={tdClass}>{o.order_side ?? o.transaction_type ?? "-"}</TableCell>
                  <TableCell className={tdClass}>{o.quantity ?? o.qty ?? "-"}</TableCell>
                  <TableCell className={tdClass}>{o.status ?? "-"}</TableCell>
                  <TableCell className={`${tdClass} font-mono text-xs`}>{o.order_id ?? o.broker_order_id ?? o._id ?? "-"}</TableCell>
                  <TableCell className={`${tdClass} whitespace-nowrap`}>{fmtDateTime(o.placed_at ?? o.order_timestamp ?? o.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

// ─── ExecutionSettings component ──────────────────────────────────────────

function stripT(val?: string) {
  if (!val) return "-";
  const i = val.lastIndexOf(".");
  return i >= 0 ? val.slice(i + 1) : val;
}

function LegExecRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{label}</span>
      <span className={`text-xs font-medium text-gray-800 dark:text-white/90 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function LegExecCard({ leg, index }: { leg: LegExecConfig; index: number }) {
  const entryBuf = leg.EntryOrder?.Value?.Buffer;
  const exitBuf  = leg.ExitOrder?.Value?.Buffer;
  const exitMod  = leg.ExitOrder?.Value?.Modification;
  const isContMon = String(exitMod?.ContinuousMonitoring ?? "").toLowerCase() === "true";

  return (
    <div className="mt-4">
      <p className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Leg {index + 1}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        {/* Left — General */}
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]">
          <LegExecRow label="NRML/MIS"        value={stripT(leg.ProductType)} />
          <LegExecRow label="Tgt/SL Ref Price" value={stripT(leg.ReferenceForTgtSL)} />
          <LegExecRow label="Delay entry by"  value={<>{leg.EntryDelay ?? 0} <span className="text-gray-400">sec</span></>} />
        </div>

        {/* Middle — Entry Order */}
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Entry Order</p>
          <LegExecRow label="Order Type"     value={stripT(leg.EntryOrder?.Type)} />
          <LegExecRow label="Buffer type"    value={stripT(entryBuf?.Type)} />
          <LegExecRow label="Trigger buffer" value={entryBuf?.Value?.TriggerBuffer ?? 0} />
          <LegExecRow label="Limit buffer"   value={entryBuf?.Value?.LimitBuffer ?? 0} />
        </div>

        {/* Right — Exit Order */}
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Exit Order</p>
          <LegExecRow label="Order Type"     value={stripT(leg.ExitOrder?.Type)} />
          <LegExecRow label="Buffer type"    value={stripT(exitBuf?.Type)} />
          <LegExecRow label="Trigger buffer" value={exitBuf?.Value?.TriggerBuffer ?? 0} />
          <LegExecRow label="Limit buffer"   value={exitBuf?.Value?.LimitBuffer ?? 0} />
          <LegExecRow label="Monitoring"     value={isContMon ? "Continuous" : "Fixed"} />
          <LegExecRow label="Frequency"      value={<>{exitMod?.ModificationFrequency ?? 0} <span className="text-gray-400">sec</span></>} />
        </div>

      </div>
    </div>
  );
}

function ExecutionSettings({ strategies }: { strategies: StrategyItem[] }) {
  const [activeTab, setActiveTab] = useState(0);
  if (!strategies.length) return null;

  const current    = strategies[activeTab] ?? strategies[0];
  const base       = current.execution_config_base ?? {};
  const legConfigs = current.execution_config_extra?.ListOfLegExecutionConfig ?? [];
  const showTabs   = strategies.length > 1;

  return (
    <div className="mt-8 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      {/* Header */}
      <div className="px-6 py-5">
        <h3 className="text-base font-medium text-gray-800 dark:text-white/90">Execution Settings</h3>
      </div>

      {/* Tabs (only when multiple strategies) */}
      {showTabs && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          <div className="flex flex-wrap items-center gap-5 px-6 sm:gap-7">
            {strategies.map((s, i) => {
              const active     = activeTab === i;
              const openCount  = s.legs?.open?.length ?? 0;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveTab(i)}
                  className={`relative inline-flex items-center gap-2 px-0 pb-4 pt-3 text-sm font-medium leading-none transition ${
                    active
                      ? "text-secondary-500 dark:text-secondary-400"
                      : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90"
                  }`}
                >
                  <span>{s.trade?.name ?? `Strategy ${i + 1}`}</span>
                  {openCount > 0 && (
                    <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-success-500 px-1.5 py-0 text-xs font-bold text-white">
                      {openCount}
                    </span>
                  )}
                  <span className={`absolute bottom-0 left-0 h-0.5 w-full rounded-full transition ${
                    active ? "bg-secondary-500 dark:bg-secondary-400" : "bg-transparent"
                  }`} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab content: description + leg configs */}
      <div className="border-t border-gray-100 px-6 pb-6 pt-4 dark:border-gray-800">
        <div className="mb-4 space-y-1 text-sm text-gray-500 dark:text-gray-400">
          <p>
            Number of lots in each leg are multiplied by{" "}
            <span className="font-semibold text-gray-800 dark:text-white/90">{base.Multiplier ?? 1}</span>{" "}
            (Quantity Multiplier)
          </p>
          {base.MarginAutoSquareOff && (
            <p>Strategy will automatically be squared off in case of margin error.</p>
          )}
          <p>Trade monitoring on LTP</p>
        </div>

        {legConfigs.length === 0 ? (
          <p className="text-sm text-gray-400">No leg execution config found.</p>
        ) : (
          legConfigs.map((leg, i) => <LegExecCard key={i} leg={leg} index={i} />)
        )}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

function buildWsUrl(channel: string) {
  const base = (API_BASE || "").replace(/\/+$/, "").replace(/^https?:\/\//i, "ws://");
  const userId = localStorage.getItem("user_id") ?? "";
  let url = `${base}/ws/${channel}?`;
  if (userId) url += `user_id=${encodeURIComponent(userId)}&`;
  url += `activation_mode=algo-backtest`;
  return url;
}

export default function ExecutionView() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const [payload, setPayload] = useState<TradePayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reqRef = useRef(0);

  const [liveLtp, setLiveLtp] = useState<number | null>(null);
  const [ltpMap, setLtpMap] = useState<Record<string, number>>({});
  const updWsRef      = useRef<WebSocket | null>(null);
  const exOrdWsRef    = useRef<WebSocket | null>(null);
  const updReconnRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exOrdReconnRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const underlyingRef = useRef("");

  const [includeBrokerage, setIncludeBrokerage] = useState(false);
  const [brokerageRate, setBrokerageRate] = useState(0);
  const [brokerageRateType, setBrokerageRateType] = useState<"per_order" | "per_lot">("per_order");
  const [showBrokerageEdit, setShowBrokerageEdit] = useState(false);
  const [includeTaxes, setIncludeTaxes] = useState(false);
  const [showTaxTooltip, setShowTaxTooltip] = useState(false);
  const brokeragePopupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (brokeragePopupRef.current && !brokeragePopupRef.current.contains(e.target as Node)) {
        setShowBrokerageEdit(false);
      }
    }
    if (showBrokerageEdit) document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showBrokerageEdit]);

  // sync underlying name when payload arrives
  useEffect(() => {
    if (!payload) return;
    underlyingRef.current = String(payload.trade?.ticker ?? payload.trade?.underlying ?? "").toUpperCase();
  }, [payload]);

  // connect both sockets on mount
  useEffect(() => {
    const SUB = JSON.stringify({ activation_mode: "algo-backtest", status: "algo-backtest", reason: "subscribe" });

    function connectUpd() {
      if (updWsRef.current?.readyState === WebSocket.OPEN || updWsRef.current?.readyState === WebSocket.CONNECTING) return;
      const ws = new WebSocket(buildWsUrl("update"));
      updWsRef.current = ws;
      ws.onopen = () => ws.send(SUB);
      ws.onmessage = e => {
        let p: Record<string, unknown>; try { p = JSON.parse(e.data); } catch { return; }
        if (p.type !== "ltp_update") return;
        const d = (p.data as Record<string, unknown>) ?? {};
        const ul = underlyingRef.current;
        const ltpArr = (d.ltp as Array<{ token?: string; symbol?: string; underlying?: string; option_type?: string; ltp?: number }>) ?? [];

        if (ul) {
          const spotMap = d.spot_map as Record<string, number> | undefined;
          if (spotMap?.[ul] != null) {
            setLiveLtp(Number(spotMap[ul]));
          } else {
            const found = ltpArr.find(x => x.underlying?.toUpperCase() === ul && x.option_type?.toUpperCase() === "SPOT");
            if (found?.ltp != null) setLiveLtp(Number(found.ltp));
          }
        }

        if (ltpArr.length > 0) {
          setLtpMap(prev => {
            const next = { ...prev };
            for (const item of ltpArr) {
              const key = String(item.token ?? "").trim();
              if (key && item.ltp != null) next[key] = Number(item.ltp);
            }
            return next;
          });
        }
      };
      ws.onclose = () => { if (updWsRef.current !== ws) return; updReconnRef.current = setTimeout(connectUpd, 3000); };
    }

    function connectExOrd() {
      if (exOrdWsRef.current?.readyState === WebSocket.OPEN || exOrdWsRef.current?.readyState === WebSocket.CONNECTING) return;
      const ws = new WebSocket(buildWsUrl("execute-orders"));
      exOrdWsRef.current = ws;
      ws.onopen = () => ws.send(SUB);
      ws.onmessage = e => {
        let p: Record<string, unknown>; try { p = JSON.parse(e.data); } catch { return; }
        if (p.type === "execute_order") fetchDataRef.current();
      };
      ws.onclose = () => { if (exOrdWsRef.current !== ws) return; exOrdReconnRef.current = setTimeout(connectExOrd, 3000); };
    }

    connectUpd();
    connectExOrd();

    return () => {
      if (updReconnRef.current)   clearTimeout(updReconnRef.current);
      if (exOrdReconnRef.current) clearTimeout(exOrdReconnRef.current);
      const upd = updWsRef.current;   updWsRef.current   = null; upd?.close();
      const exo = exOrdWsRef.current; exOrdWsRef.current = null; exo?.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDataRef = useRef<() => void>(() => {});

  const fetchData = useCallback(() => {
    if (!type || !id) { setError("Missing type or id in URL."); setLoading(false); return; }

    const token = ++reqRef.current;
    setLoading(true);
    setError("");

    const status = "algo-backtest";
    const path =
      type === "portfolio"
        ? `strategy-trade-history/portfolio/${encodeURIComponent(id)}?status=${status}`
        : type === "group"
        ? `strategy-trade-history/group/${encodeURIComponent(id)}?status=${status}`
        : `strategy-trade-history/${encodeURIComponent(id)}?status=${status}`;

    const url = `${String(API_BASE || "").replace(/\/+$/, "")}/${path}`;

    fetch(url)
      .then(r => { if (!r.ok) throw new Error("Failed to load trade history"); return r.json(); })
      .then(data => { if (token !== reqRef.current) return; setPayload(data ?? {}); setLoading(false); })
      .catch(e => { if (token !== reqRef.current) return; setError(e?.message ?? "Error loading data"); setLoading(false); });
  }, [type, id]);

  useEffect(() => { fetchDataRef.current = fetchData; }, [fetchData]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const trade = payload?.trade ?? {};
  const summary = payload?.summary ?? {};
  const openLegs = payload?.legs?.open ?? [];
  const closedLegs = payload?.legs?.closed ?? [];
  const orders = payload?.broker_orders ?? [];
  const notifications = payload?.notifications ?? [];
  const notificationStatus = payload?.notification_status ?? {};
  const strategies: StrategyItem[] = payload?.strategies?.length
    ? payload.strategies
    : (payload?.execution_config_base || payload?.execution_config_extra)
      ? [{ trade: payload?.trade, execution_config_base: payload.execution_config_base, execution_config_extra: payload.execution_config_extra, legs: { open: payload?.legs?.open ?? [], closed: payload?.legs?.closed ?? [] } }]
      : [];

  const titleLabel = type === "portfolio" ? "Portfolio" : type === "group" ? "Strategy Group" : "Strategy";
  const title = trade.name ?? trade._id ?? titleLabel;
  const statusLabel = String(trade.status ?? "-").replace(/^StrategyStatus\./, "").replace(/_/g, " ");
  const brokerLabel = (trade.broker_details?.broker_name ?? trade.broker_details?.display_name ?? trade.broker_label ?? trade.broker ?? "-");
  const brokerIcon = trade.broker_details?.broker_icon ?? "";
  const apiMtm = Number(summary.mtm ?? 0);
  const underlyingLabel = String(trade.ticker ?? trade.underlying ?? "Underlying").toUpperCase();
  const spotValue = liveLtp ?? (summary.spot_price != null ? Number(summary.spot_price) : null);
  const underlyingPrice = spotValue != null
    ? spotValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })
    : "-";

  // recompute MTM live whenever ltpMap ticks
  const mtm = useMemo(() => {
    const hasLive = Object.keys(ltpMap).length > 0;
    if (!hasLive) return apiMtm;
    const closedPnl = closedLegs.reduce((s, l) => s + Number(l.pnl ?? 0), 0);
    const openPnl = openLegs.reduce((s, leg) => {
      const sym = leg.trading_symbol ?? leg.symbol ?? "";
      const ltp = ltpMap[String(leg.token ?? "")] ?? ltpMap[sym] ?? leg.last_saw_price ?? leg.mark_price;
      const entryPx = Number(leg.entry_price ?? leg.buy_price ?? leg.entry_trade?.price ?? 0);
      const qty = Number(leg.effective_quantity ?? leg.quantity ?? 0);
      if (ltp == null || !entryPx || !qty) return s + Number(leg.pnl ?? 0);
      const isSell = String(leg.position_side ?? leg.position ?? "sell").toLowerCase() !== "buy";
      return s + (isSell ? (entryPx - Number(ltp)) * qty : (Number(ltp) - entryPx) * qty);
    }, 0);
    return closedPnl + openPnl;
  }, [ltpMap, openLegs, closedLegs, apiMtm]);

  const chargeTrades = payload ? buildChargeTrades(payload) : [];
  const totalBrokerage = includeBrokerage ? computeTotalBrokerage(chargeTrades, brokerageRate, brokerageRateType) : 0;
  const taxAgg = includeTaxes ? aggregateTaxes(chargeTrades) : { stt: 0, exchange: 0, stamp: 0, sebi: 0, gst: 0, total: 0 };
  const netMtm = mtm - totalBrokerage - taxAgg.total;

  const changeText = summary.spot_change_text ?? "";
  const isNegativeChange = changeText.trim().startsWith("-");

  return (
    <>
      <PageMeta title={`${title} — Execution`} description="Execution trade history" />
      <div className="min-h-screen bg-[#f4f6f9]">

        <div className="px-4 py-6 md:px-6">

          {/* Back + title row */}
          <div className="mb-6 rounded-2xl border border-gray-200 bg-white px-5 py-4">
            <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <button type="button" onClick={() => navigate(-1)}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:text-gray-300">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 15.75L3 12m0 0l3.75-3.75M3 12h18" />
                  </svg>
                  Back
                </button>
                <span className="truncate text-xl font-semibold text-gray-800 dark:text-white/90">{loading ? "Loading…" : title}</span>
              </div>
              <div className="flex justify-start lg:justify-center">
                {!loading && payload && (
                  <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-white/[0.03]">
                    <span className="text-sm font-semibold text-gray-800 dark:text-white/90">{underlyingLabel}</span>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span className="text-sm font-semibold tabular-nums text-gray-800 dark:text-white/90">{underlyingPrice}</span>
                    {changeText && (
                      <span className={`text-xs font-medium tabular-nums ${isNegativeChange ? "text-error-600 dark:text-error-400" : "text-success-600 dark:text-success-400"}`}>
                        ({changeText})
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                <button type="button" className={headerActionButtonClass}><HeaderActionIcon />Screenshot</button>
                <button type="button" className={headerActionButtonClass}><HeaderActionIcon />Today's MTM Graph</button>
                <button type="button" className={headerActionButtonClass}><HeaderActionIcon />Analyse</button>
                <button type="button" className={headerActionButtonClass}><HeaderActionIcon />Replay</button>
              </div>
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-20 text-[#5b7086]">
              <span className="w-5 h-5 border-2 border-[#1580ed] border-t-transparent rounded-full animate-spin mr-2" />
              Loading trade history…
            </div>
          )}

          {error && !loading && (
            <div className="rounded border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-600">{error}</div>
          )}

          {!loading && !error && payload && (
            <>
              {/* Summary stats */}
              <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
                <div className="flex flex-wrap items-center gap-x-10 gap-y-4 px-6 py-5 text-xs text-gray-500 dark:text-gray-400">

                  {/* Status */}
                  <div className="flex flex-col gap-1">
                    <span>Status</span>
                    <span className={`inline-flex w-fit items-center rounded border px-2 py-0 text-xs font-medium uppercase ${statusStyle(statusLabel)}`}>
                      {statusLabel}
                    </span>
                  </div>

                  {/* Open Position */}
                  <div className="flex flex-col gap-1">
                    <span>Open Position</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-white/90">{summary.open_positions ?? 0}</span>
                  </div>

                  {/* Broker */}
                  <div className="flex flex-col gap-1">
                    <span>Broker</span>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800 dark:text-white/90">
                      {brokerIcon && (
                        <img src={brokerIcon} alt={brokerLabel} className="w-5 h-5 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      )}
                      <span>{brokerLabel}</span>
                    </div>
                  </div>

                  {/* Include Brokerage */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span>Include Brokerage</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={includeBrokerage}
                        onClick={() => { setIncludeBrokerage(v => !v); setShowBrokerageEdit(false); }}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${includeBrokerage ? "bg-secondary-500" : "bg-gray-300 dark:bg-gray-600"}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${includeBrokerage ? "translate-x-4" : "translate-x-0"}`} />
                      </button>
                    </div>
                    <div className="relative flex items-center gap-1.5">
                      <span className={`text-sm font-medium ${includeBrokerage ? "text-gray-800 dark:text-white/90" : "text-gray-400 dark:text-gray-600"}`}>
                        {fmtCost(totalBrokerage)}
                      </span>
                      {includeBrokerage && (
                        <button
                          type="button"
                          onClick={() => setShowBrokerageEdit(v => !v)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                            <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.718 1.272l-.351 1.406a.75.75 0 0 0 .913.913l1.406-.351a2.75 2.75 0 0 0 1.272-.718l4.261-4.263a1.75 1.75 0 0 0 0-2.475ZM3.75 12.5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Z" />
                          </svg>
                        </button>
                      )}
                      {showBrokerageEdit && (
                        <div ref={brokeragePopupRef} className="absolute top-full left-0 z-50 mt-2 w-max rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                          <p className="mb-2.5 text-xs font-semibold text-gray-800 dark:text-white/90">Brokerage</p>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              value={brokerageRate}
                              onChange={e => setBrokerageRate(Math.max(0, Number(e.target.value)))}
                              className="w-20 rounded border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:border-secondary-500 focus:outline-none dark:border-gray-700 dark:bg-white/5 dark:text-white"
                            />
                            <select
                              value={brokerageRateType}
                              onChange={e => setBrokerageRateType(e.target.value as "per_order" | "per_lot")}
                              className="rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800 focus:border-secondary-500 focus:outline-none dark:border-gray-700 dark:bg-white/5 dark:text-white"
                            >
                              <option value="per_order">per order</option>
                              <option value="per_lot">per lot</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => setShowBrokerageEdit(false)}
                              className="rounded-lg bg-secondary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-secondary-600 transition-colors"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Taxes & Charges */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span>Taxes &amp; charges</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={includeTaxes}
                        onClick={() => { setIncludeTaxes(v => !v); setShowTaxTooltip(false); }}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${includeTaxes ? "bg-secondary-500" : "bg-gray-300 dark:bg-gray-600"}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${includeTaxes ? "translate-x-4" : "translate-x-0"}`} />
                      </button>
                    </div>
                    <div className="relative flex items-center gap-1.5">
                      <span className={`text-sm font-medium ${includeTaxes ? "text-gray-800 dark:text-white/90" : "text-gray-400 dark:text-gray-600"}`}>
                        {fmtCost(taxAgg.total)}
                      </span>
                      {includeTaxes && (
                        <button
                          type="button"
                          onMouseEnter={() => setShowTaxTooltip(true)}
                          onMouseLeave={() => setShowTaxTooltip(false)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                            <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.718 1.272l-.351 1.406a.75.75 0 0 0 .913.913l1.406-.351a2.75 2.75 0 0 0 1.272-.718l4.261-4.263a1.75 1.75 0 0 0 0-2.475ZM3.75 12.5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Z" />
                          </svg>
                        </button>
                      )}
                      {showTaxTooltip && (
                        <div className="absolute top-full left-0 z-50 mt-2 w-52 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                          <p className="mb-2 text-xs font-semibold text-gray-800 dark:text-white/90">Taxes &amp; charges</p>
                          <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
                            {[
                              { label: "STT", val: taxAgg.stt },
                              { label: "Exchange transaction charges", val: taxAgg.exchange },
                              { label: "Stamp charges", val: taxAgg.stamp },
                              { label: "SEBI turnover fees", val: taxAgg.sebi },
                              { label: "GST", val: taxAgg.gst },
                            ].map(({ label, val }) => (
                              <div key={label} className="flex items-center justify-between gap-2">
                                <span>{label}</span>
                                <span className="whitespace-nowrap font-medium text-gray-700 dark:text-gray-200">{fmtCost(val)}</span>
                              </div>
                            ))}
                            <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-1.5 dark:border-gray-700">
                              <span className="font-semibold text-gray-800 dark:text-white/90">Total</span>
                              <span className="whitespace-nowrap font-semibold text-gray-800 dark:text-white/90">{fmtCost(taxAgg.total)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Margin Blocked */}
                  <div className="flex flex-col gap-1">
                    <span>Margin Blocked (approx)</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                      {summary.margin_blocked != null ? fmtMoney(summary.margin_blocked) : "₹ 0"}
                    </span>
                  </div>

                  {/* Gross MTM — only when at least one charge is enabled */}
                  {(includeBrokerage || includeTaxes) && (
                    <div className="flex flex-col gap-1">
                      <span>Gross MTM</span>
                      <span className={`text-sm font-bold ${mtm >= 0 ? "text-success-600 dark:text-success-400" : "text-error-600 dark:text-error-400"}`}>
                        {fmtMoney(mtm)}<TrendArrow value={mtm} />
                      </span>
                    </div>
                  )}

                  {/* Net MTM / MTM */}
                  <div className="flex flex-col gap-1">
                    <span>{includeBrokerage || includeTaxes ? "Net MTM" : "MTM"}</span>
                    <span className={`text-sm font-bold ${netMtm >= 0 ? "text-success-600 dark:text-success-400" : "text-error-600 dark:text-error-400"}`}>
                      {fmtMoney(netMtm)}<TrendArrow value={netMtm} />
                    </span>
                  </div>

                </div>

                {(summary.deployed_at || summary.entry_time || summary.exit_time) && (
                  <>
                    <hr className="border-gray-100 dark:border-gray-800" />
                    <div className="flex flex-wrap gap-x-8 gap-y-2 px-6 py-4 text-xs text-gray-500 dark:text-gray-400">
                      {summary.deployed_at && (
                        <div className="flex flex-col gap-0.5">
                          <span>Deployed</span>
                          <span className="font-medium uppercase text-gray-800 dark:text-white/90">{fmtDateTime(summary.deployed_at)}</span>
                        </div>
                      )}
                      {summary.entry_time && (
                        <div className="flex flex-col gap-0.5">
                          <span>Entry Time</span>
                          <span className="font-medium uppercase text-gray-800 dark:text-white/90">{fmtDateTime(summary.entry_time)}</span>
                        </div>
                      )}
                      {summary.exit_time && (
                        <div className="flex flex-col gap-0.5">
                          <span>Exit Time</span>
                          <span className="font-medium uppercase text-gray-800 dark:text-white/90">{fmtDateTime(summary.exit_time)}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <LegTable legs={openLegs} title="Open Legs" isOpen ltpMap={ltpMap} />
              <LegTable legs={closedLegs} title="Closed Legs" />
              <OrderTable orders={orders} />
              <NotificationStatus notifications={notifications} notificationStatus={notificationStatus} strategies={payload?.strategies} />
              <ExecutionSettings strategies={strategies} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
