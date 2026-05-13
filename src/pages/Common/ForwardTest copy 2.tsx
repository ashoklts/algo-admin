import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { Modal } from "../../components/ui/modal";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;
const ACTIVATION_MODE = "fast-forward";       // socket param
const POLL_INTERVAL_MS = 30_000;
const MTM_THROTTLE_MS = 400;

// ─── Types ────────────────────────────────────────────────────────────────────

interface LtpItem {
  token?: string; ltp?: number; underlying?: string;
  option_type?: string; strike?: string;
  expiry?: string; expiry_date?: string;
}

interface EntryTrade {
  price?: number; trigger_price?: number;
  instrument_token?: string;
  traded_timestamp?: string; trigger_timestamp?: string;
}

interface FeatureRow {
  current_sl_price?: number; trigger_price?: number; status?: string;
}

interface Leg {
  leg_id?: string; id?: string;
  token?: string; instrument_token?: string; symbol_token?: string;
  ticker?: string; underlying?: string;
  expiry_date?: string; expiry?: string;
  strike?: string; option?: string; option_type?: string;
  position?: string; quantity?: number; lot_size?: number;
  entry_trade?: EntryTrade;
  exit_trade?: EntryTrade | null;
  status?: number; pnl?: number;
  last_saw_price?: number; mark_price?: number; ltp?: number;
  feature_status_map?: { sl?: FeatureRow; target?: FeatureRow; trailSL?: FeatureRow; momentum_pending?: FeatureRow; reCost?: FeatureRow };
  active_trigger_descriptions?: string[];
  is_pending_feature_leg?: boolean; is_lazy?: boolean;
  lazy_leg_ref?: string; triggered_by?: string; parent_leg_id?: string; leg_type?: string;
  is_reentered_leg?: boolean; reentry_type?: string;
  queued_at?: string; armed_at?: string;
  momentum_base_price?: number; momentum_target_price?: number;
}

interface StrategyFeatureRow {
  feature: string; trigger_value?: number; next_trigger_value?: number;
  cycle_number?: number; reentry_type?: string; reentry_done?: number;
  reentry_count?: number; status?: string; trigger_description?: string;
}

interface PortfolioMeta { group_id?: string; portfolio?: string; group_name?: string }
interface BrokerDetails { alias?: string; display_name?: string; broker_name?: string; name?: string; title?: string; broker?: string; broker_icon?: string }
interface BrokerSettings {
  broker_id?: string; settings_active?: boolean; stop_loss?: number; target?: number;
  lock_and_trail?: { instrument_move?: number; stop_loss_move?: number };
  trail_sl?: { instrument_move?: number; stop_loss_move?: number };
  state?: { effective_sl?: number; lock_activated?: boolean; current_lock_floor?: number };
}
interface DeployedRecord {
  _id: string; trade_id?: string; name?: string; ticker?: string;
  status?: string; active_on_server?: boolean; broker?: string;
  broker_label?: string; user_id?: string; open_legs_count?: number;
  legs?: Leg[]; pending_feature_legs?: Leg[];
  portfolio?: PortfolioMeta; broker_details?: BrokerDetails;
  position_refresh_trigger?: string;
  strategy_feature_status_rows?: StrategyFeatureRow[];
  overall_sl_reentry_done?: number; overall_tgt_reentry_done?: number;
  last_overall_event_reason?: string;
  entry_time?: string;
}
interface Group { group_id: string; group_name: string; portfolio_id: string; items: DeployedRecord[] }
interface BrokerEntry { key: string; label: string; icon: string; brokerId: string; userId: string; strategyCount: number; openLegCount: number; mtm: number }
interface MtmHistoricalEntry { timestamp: string[]; open: number[]; high: number[]; low: number[]; close: number[]; volume: number[] }

// ─── Activation section types ─────────────────────────────────────────────────
interface StrategyItem { _id: string; name?: string; underlying?: string; execution_days?: number[]; strategy_type?: string }
interface PortfolioItem { _id: string; name?: string; strategy_ids?: string[] }
type ActivationTab = "strategies" | "portfolios" | "ra-algos" | "cryptobazaar";

// ─── LTP snapshot helpers ─────────────────────────────────────────────────────

function getLtpSnapshotKey(item: LtpItem): string {
  const tok = String(item.token ?? "").trim();
  if (tok) return "token:" + tok;
  const und = String(item.underlying ?? "").trim().toUpperCase();
  if (und && String(item.option_type ?? "").trim().toUpperCase() === "SPOT") return "spot:" + und;
  const str = String(item.strike ?? "").trim();
  const exp = String(item.expiry ?? item.expiry_date ?? "").trim().slice(0, 10);
  const opt = String(item.option_type ?? "").trim().toUpperCase();
  if (str && exp && opt) return "contract:" + str + "_" + exp + "_" + opt;
  return "";
}

function mergeLtpItems(items: LtpItem[], map: Record<string, LtpItem>) {
  for (const item of items) {
    const key = getLtpSnapshotKey(item);
    if (key) map[key] = { ...(map[key] ?? {}), ...item };
  }
}

function buildLegContractKey(leg: Leg): string {
  const strike = String(leg.strike ?? "").trim();
  const expiry = String(leg.expiry_date ?? leg.expiry ?? "").trim().slice(0, 10);
  const opt = String(leg.option ?? leg.option_type ?? "").trim().toUpperCase();
  if (!strike || !expiry || !opt || opt === "SPOT") return "";
  return "contract:" + strike + "_" + expiry + "_" + opt;
}

function resolveLegLtp(leg: Leg, ltpMap: Record<string, LtpItem>): number | null {
  const tok = String(leg.token ?? "").trim();
  if (tok && ltpMap["token:" + tok]?.ltp != null) return Number(ltpMap["token:" + tok].ltp!);
  const eTok = String(leg.entry_trade?.instrument_token ?? "").trim();
  if (eTok && ltpMap["token:" + eTok]?.ltp != null) return Number(ltpMap["token:" + eTok].ltp!);
  const ck = buildLegContractKey(leg);
  if (ck && ltpMap[ck]?.ltp != null) return Number(ltpMap[ck].ltp!);
  // fallback to leg's own cached price
  const fb = leg.last_saw_price ?? leg.mark_price ?? leg.ltp;
  if (fb != null) return Number(fb);
  return null;
}

// ─── PnL ──────────────────────────────────────────────────────────────────────

function computeStrategyPnl(rec: DeployedRecord, ltpMap: Record<string, LtpItem>): number {
  const legs = rec.legs ?? [];
  if (!legs.length) return 0;
  const isSqd = rec.active_on_server === false || (rec.status ?? "").includes("SquaredOff");
  let total = 0;
  for (const leg of legs) {
    if (!leg.entry_trade) continue;
    const ePrice = parseFloat(String(leg.entry_trade.price ?? leg.entry_trade.trigger_price ?? 0)) || 0;
    const qty = (Number(leg.quantity) || 0) * (Number(leg.lot_size) || 1);
    const isSell = String(leg.position ?? "").toLowerCase().includes("sell");
    if (leg.exit_trade) {
      const xPrice = parseFloat(String(leg.exit_trade.price ?? leg.exit_trade.trigger_price ?? 0)) || 0;
      if (xPrice > 0) { total += isSell ? (ePrice - xPrice) * qty : (xPrice - ePrice) * qty; }
      else { const ltp = resolveLegLtp(leg, ltpMap); if (ltp !== null) total += isSell ? (ePrice - ltp) * qty : (ltp - ePrice) * qty; }
    } else {
      if (isSqd) continue;
      const ltp = resolveLegLtp(leg, ltpMap);
      if (ltp !== null) {
        leg.last_saw_price = ltp;
        leg.ltp = ltp;
        total += isSell ? (ePrice - ltp) * qty : (ltp - ePrice) * qty;
      }
    }
  }
  return total;
}

// ─── Generic helpers ──────────────────────────────────────────────────────────

function isObjectId(v: unknown) { return /^[a-f0-9]{24}$/i.test(String(v ?? "")); }
function humanize(v: unknown) {
  const n = String(v ?? "").replace(/^Broker\./i, "").replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim();
  if (!n) return "";
  return n.split(" ").map(p => p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : "").join(" ");
}
function getBrokerName(rec: DeployedRecord) {
  const d = rec.broker_details ?? {};
  for (const c of [humanize(d.alias), humanize(d.display_name), humanize(d.broker_name), humanize(d.name), humanize(d.title), !isObjectId(rec.broker_label) ? rec.broker_label ?? "" : "", !isObjectId(rec.broker) ? humanize(rec.broker) : ""])
    if (String(c).trim()) return String(c).trim();
  return "Unknown";
}
function getBrokerIcon(rec: DeployedRecord) {
  const ic = rec.broker_details?.broker_icon?.trim() ?? "";
  if (!ic) return "";
  if (/^https?:\/\//i.test(ic)) return ic;
  return `${API_BASE.replace(/\/+$/, "")}/broker-icon/${encodeURIComponent(ic)}`;
}
function normalizeStatus(rec: DeployedRecord): { text: string; cls: string } {
  const s = rec.status ?? "";
  if (rec.active_on_server === false || s.includes("SquaredOff")) return { text: "SQD OFF", cls: "squared-off" };
  if (s.includes("Paused")) return { text: "PAUSED", cls: "paused" };
  if (s.includes("Stopped")) return { text: "STOPPED", cls: "stopped" };
  if (s.includes("Running") || s.includes("Live") || rec.active_on_server) return { text: "RUNNING", cls: "running" };
  return { text: "STOPPED", cls: "stopped" };
}
function groupRecords(records: DeployedRecord[]): Group[] {
  const map: Record<string, Group> = {};
  for (const rec of records) {
    const pm = rec.portfolio ?? {};
    const gid = pm.group_id ?? pm.portfolio ?? rec._id ?? "";
    if (!map[gid]) map[gid] = { group_id: gid, group_name: pm.group_name ?? rec.name ?? "Portfolio", portfolio_id: pm.portfolio ?? "", items: [] };
    map[gid].items.push(rec);
  }
  return Object.values(map);
}
function fmtMoney(n: number) {
  return "₹ " + (n < 0 ? "-" : "") + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDetail(v: number | undefined | null, fallback = "-") {
  if (v == null || !isFinite(Number(v))) return fallback;
  return "₹ " + Math.abs(Number(v)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtRs(n: number | undefined) {
  const v = Math.round((parseFloat(String(n ?? 0)) || 0) * 100) / 100;
  return "₹ " + v.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function mergeRecord(incoming: DeployedRecord, existing: DeployedRecord | undefined): DeployedRecord {
  if (!existing) return incoming;
  const m = { ...existing, ...incoming };
  if (incoming.broker_details == null) m.broker_details = existing.broker_details;
  return m;
}
function nowIsoTs() { return new Date().toISOString().replace("T", " ").slice(0, 19); }

// ─── Brokerage & Taxes ───────────────────────────────────────────────────────

const NSE_STT = 0.001, NSE_EXCHANGE = 0.00053, NSE_STAMP = 0.00003, NSE_SEBI = 0.0000010, NSE_GST = 0.18;

interface TaxBucket { stt: number; exchange: number; stamp: number; sebi: number; gst: number; total: number }
interface BtChargeLeg { lots: number; lot_size: number; position: string; entry_price: number; exit_price: number }
interface BtChargeTrade { legs: BtChargeLeg[] }

function buildChargeLeg(leg: Leg): BtChargeLeg {
  const qty = Number(leg.quantity) || 0;
  const lotSize = Number(leg.lot_size) || 1;
  return { lots: qty / lotSize || 1, lot_size: lotSize, position: String(leg.position ?? "sell"), entry_price: Number(leg.entry_trade?.price ?? leg.entry_trade?.trigger_price ?? 0) || 0, exit_price: Number(leg.exit_trade?.price ?? leg.exit_trade?.trigger_price ?? 0) || 0 };
}
function buildAllChargeTrades(records: DeployedRecord[]): BtChargeTrade[] {
  return records.map(rec => ({ legs: (rec.legs ?? []).filter(l => l.entry_trade).map(buildChargeLeg) })).filter(t => t.legs.length > 0);
}
function calcBtBrokerage(trades: BtChargeTrade[], rate: number, rateType: string): number {
  if (rate <= 0) return 0;
  return trades.reduce((s, t) => { const lots = t.legs.reduce((ls, l) => ls + l.lots, 0) || 1; return s + (rateType === "per_lot" ? rate * lots : rate * (t.legs.length || 1)); }, 0);
}
function calcBtTaxes(trades: BtChargeTrade[]): TaxBucket {
  let stt = 0, exchange = 0, stamp = 0, sebi = 0;
  for (const t of trades) {
    for (const leg of t.legs) {
      const isSell = !leg.position.toLowerCase().includes("buy");
      const qty = leg.lots * leg.lot_size;
      const entryT = leg.entry_price * qty; const exitT = leg.exit_price * qty;
      if (isSell) { stt += entryT * NSE_STT; stamp += exitT * NSE_STAMP; } else { stamp += entryT * NSE_STAMP; stt += exitT * NSE_STT; }
      exchange += (entryT + exitT) * NSE_EXCHANGE; sebi += (entryT + exitT) * NSE_SEBI;
    }
  }
  const gst = (exchange + sebi) * NSE_GST;
  return { stt, exchange, stamp, sebi, gst, total: stt + exchange + stamp + sebi + gst };
}
const ZERO_TAX: TaxBucket = { stt: 0, exchange: 0, stamp: 0, sebi: 0, gst: 0, total: 0 };

// ─── Broker Settings types ─────────────────────────────────────────────────────

type TrailingTab = "lock" | "lock-trail" | "trail-stop-loss";
interface BsModalState {
  stopLossOpen: boolean; stopLoss: number;
  targetOpen: boolean; target: number;
  trailingOpen: boolean; trailingTab: TrailingTab;
  lock: { trigger: number; profit: number };
  lockTrail: { trigger: number; profit: number; trailTrigger: number; trailProfit: number };
  trailSL: { trigger: number; stopLoss: number };
}
interface BsDisplay { stopLoss: number | null; target: number | null; trailing: string }

function fmtBsCurrency(v: number | null) {
  if (v == null) return "-";
  return "₹ " + (parseInt(String(v), 10) || 0).toLocaleString("en-IN");
}

const DEFAULT_MODAL: BsModalState = {
  stopLossOpen: false, stopLoss: 4900,
  targetOpen: false, target: 2000,
  trailingOpen: false, trailingTab: "lock",
  lock: { trigger: 100, profit: 0 },
  lockTrail: { trigger: 100, profit: 0, trailTrigger: 1, trailProfit: 1 },
  trailSL: { trigger: 1, stopLoss: 1 },
};

// ─── Socket URL ───────────────────────────────────────────────────────────────
function buildWsUrl(channel: string, userId: string) {
  const base = API_BASE.replace(/\/+$/, "").replace(/^https?:\/\//i, "ws://");
  let url = `${base}/ws/${channel}?`;
  if (userId) url += `user_id=${encodeURIComponent(userId)}&`;
  url += `activation_mode=${encodeURIComponent(ACTIVATION_MODE)}`;
  return url;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BrokerSettingsStrip({ bs }: { bs: BrokerSettings }) {
  const chips: React.ReactNode[] = [];
  if (bs.stop_loss != null) {
    const eff = bs.state?.effective_sl ?? bs.stop_loss;
    chips.push(<span key="sl" className="inline-flex items-center px-[7px] py-[2px] rounded text-[10px] font-semibold whitespace-nowrap bg-red-50 text-red-700 border border-red-200">SL {fmtRs(eff)}</span>);
  }
  if (bs.target != null) chips.push(<span key="tgt" className="inline-flex items-center px-[7px] py-[2px] rounded text-[10px] font-semibold whitespace-nowrap bg-green-50 text-green-700 border border-green-200">TGT {fmtRs(bs.target)}</span>);
  const lat = bs.lock_and_trail;
  if (lat?.instrument_move != null) {
    const on = bs.state?.lock_activated;
    chips.push(<span key="lock" className={`inline-flex items-center px-[7px] py-[2px] rounded text-[10px] font-semibold whitespace-nowrap border ${on ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-yellow-50 text-yellow-800 border-yellow-300"}`}>{on ? `Lock ✓ ${fmtRs(bs.state?.current_lock_floor ?? lat.stop_loss_move)}` : `Lock @ ${fmtRs(lat.instrument_move)} → ${fmtRs(lat.stop_loss_move)}`}</span>);
  } else if (bs.trail_sl?.instrument_move != null)
    chips.push(<span key="trail" className="inline-flex items-center px-[7px] py-[2px] rounded text-[10px] font-semibold whitespace-nowrap bg-sky-50 text-sky-700 border border-sky-200">Trail {fmtRs(bs.trail_sl.stop_loss_move)}</span>);
  if (!chips.length) return null;
  return <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-blue-100">{chips}</div>;
}

function CountdownOrMtm({ entryTime, pnl }: { entryTime?: string; pnl: number }) {
  const [remaining, setRemaining] = useState<number>(() => {
    if (!entryTime) return 0;
    return new Date(entryTime.replace(" ", "T")).getTime() - Date.now();
  });

  useEffect(() => {
    if (!entryTime) return;
    const target = new Date(entryTime.replace(" ", "T")).getTime();
    const tick = () => setRemaining(target - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [entryTime]);

  if (remaining > 0) {
    const totalSecs = Math.ceil(remaining / 1000);
    const h = Math.floor(totalSecs / 3600).toString().padStart(2, "0");
    const m = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, "0");
    const s = (totalSecs % 60).toString().padStart(2, "0");
    return (
      <div className="flex flex-col items-start gap-0.5">
        <div className="text-[11px] text-[#5b7086] font-medium">Entry in</div>
        <div className="text-[14px] font-bold whitespace-nowrap tabular-nums text-[#d97706]">{h}:{m}:{s}</div>
      </div>
    );
  }

  return (
    <div className="text-[14px] font-bold whitespace-nowrap tabular-nums" style={{ color: pnl >= 0 ? "#16a34a" : "#ef4444" }}>
      {fmtMoney(pnl)}
    </div>
  );
}

function StatusBadge({ text, cls }: { text: string; cls: string }) {
  const map: Record<string, string> = {
    running: "border-[#8bd5a9] bg-[#f2fbf5] text-[#1c9b47]",
    paused: "border-[#f1c188] bg-[#fff7ef] text-[#d07a16]",
    stopped: "border-gray-400 bg-white text-gray-400",
    "squared-off": "border-gray-400 bg-white text-gray-400",
  };
  return <span className={`inline-flex items-center justify-center px-[6px] py-[2px] rounded-sm border text-[11px] font-semibold uppercase whitespace-nowrap ${map[cls] ?? map.stopped}`}>{text}</span>;
}

function BrokerCell({ rec }: { rec: DeployedRecord }) {
  const name = getBrokerName(rec); const icon = getBrokerIcon(rec);
  return (
    <div className="inline-flex items-center gap-2 text-[#22384e] text-sm min-w-0">
      {icon ? <img src={icon} alt="" className="w-[18px] h-[18px] object-contain flex-none" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} /> : <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded bg-blue-50 text-blue-500 text-[8px] font-bold flex-none">FT</span>}
      <span className="truncate">{name}</span>
    </div>
  );
}

// ─── Strategy detail panel ────────────────────────────────────────────────────

function DetailMetric({ label, value, pnl, featureEnabled }: { label: string; value: string; pnl?: boolean; featureEnabled?: boolean }) {
  const valColor = pnl && isFinite(Number(value.replace(/[₹ ,\-]/g, "")))
    ? (value.includes("-") ? "text-red-500" : "text-green-600")
    : "text-[#183247]";
  return (
    <div className="p-[10px_12px] border border-[#d9e7f5] rounded-lg bg-white">
      <div className="text-[11px] font-semibold text-[#5c7084] uppercase tracking-wide mb-[6px]">
        {label}
        {featureEnabled !== undefined && <span className={`ml-1 ${featureEnabled ? "text-green-600" : "text-gray-400"}`}>({featureEnabled ? "Enabled" : "Disabled"})</span>}
      </div>
      <div className={`text-[13px] font-bold ${valColor}`}>{value}</div>
    </div>
  );
}

// ── Build leg title: "24100 CE • Lazy Leg (5o063886)" ────────────────────────
function getLegTitle(leg: Leg): string {
  const strike   = String(leg.strike ?? "-").trim();
  const opt      = String(leg.option ?? leg.option_type ?? "").toUpperCase();
  const prefix   = `${strike}${opt ? " " + opt : ""}`;

  const lazyRef     = String(leg.lazy_leg_ref  ?? "").trim();
  const triggeredBy = String(leg.triggered_by  ?? "").trim();
  const parentId    = String(leg.parent_leg_id ?? "").trim();
  const legId       = String(leg.leg_id ?? leg.id ?? "").trim();
  const legType     = String(leg.leg_type ?? "").trim();
  const hasParent   = !!(triggeredBy || parentId);
  const isOverall   = /overall_reentry/i.test(legType) || /^overall_/i.test(triggeredBy);
  const isTrueLazy  = !!(lazyRef && hasParent && !isOverall && lazyRef !== parentId);

  // normalize reference (strip _re_ re-entry suffixes)
  function normalizeRef(raw: string): string {
    let r = raw.split(/_re_/i)[0].split("-overall_")[0].trim();
    if (/^[A-Za-z0-9_]+-[A-Za-z0-9_]+$/.test(r)) r = r.split("-")[0].trim();
    return r || raw;
  }

  let suffix: string;
  if (isTrueLazy) {
    const ref = normalizeRef(lazyRef || parentId || legId);
    suffix = `Lazy Leg (${ref})`;
  } else if (leg.is_reentered_leg || triggeredBy) {
    const m = legType.match(/reentry_(\d+)/i);
    suffix = `Parent Leg${m?.[1] ? " • Reentry " + m[1] : ""}`;
  } else {
    suffix = "Parent Leg";
  }
  return `${prefix} • ${suffix}`;
}

function StrategyDetails({ record, ltpMap }: { record: DeployedRecord; ltpMap: Record<string, LtpItem> }) {
  const featureRows = record.strategy_feature_status_rows ?? [];
  // open legs = status 1 (same logic as HTML dashboard)
  const openLegs   = (record.legs ?? []).filter(l => l && Number(l.status) === 1);
  const pendingLegs = (record.pending_feature_legs ?? []).filter(l => l?.is_pending_feature_leg);
  const allLegs = [...openLegs, ...pendingLegs];

  return (
    <div className="mt-0 px-4 py-4 border-t border-[#eef3f8] bg-[#f8fbff] rounded-b-lg">

      {/* Overall SL / TGT feature rows */}
      {featureRows.map((row, i) => {
        const title = row.feature === "overall_sl" ? "Overall Stop Loss" : "Overall Target";
        return (
          <div key={i} className={`${i > 0 ? "mt-4 pt-4 border-t border-dashed border-[#d5e3f1]" : ""}`}>
            <div className="text-[13px] font-bold text-[#1f3347] mb-[10px]">{title}</div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-[10px]">
              <DetailMetric label="Current Value" value={fmtDetail(row.trigger_value)} />
              <DetailMetric label="Next Value" value={fmtDetail(row.next_trigger_value)} />
              <DetailMetric label="Cycle" value={`Cycle ${row.cycle_number ?? 1}`} />
              <DetailMetric label="Re-entry Type" value={row.reentry_type ?? "None"} />
              <DetailMetric label="Re-entry Used" value={`${row.reentry_done ?? 0}/${row.reentry_count ?? 0}`} />
              <DetailMetric label="Status" value={row.status ?? "active"} />
            </div>
            <div className="mt-3 text-[12px] font-bold text-[#1f3347] uppercase tracking-wide">Feature Status</div>
            {row.trigger_description
              ? <div className="mt-2 pl-3 border-l-4 border-[#1580ed] bg-white rounded text-[12px] text-[#30485f] py-[10px] px-3">{row.trigger_description}</div>
              : <div className="mt-1 text-[12px] text-[#7b8ea2]">No overall feature status available.</div>}
          </div>
        );
      })}

      {/* Per-leg detail cards */}
      {allLegs.map((leg, idx) => {
        const legTitle = getLegTitle(leg);

        // ── Live LTP + live P&L calculation ──────────────────────────────────
        const ltp = resolveLegLtp(leg, ltpMap);
        const ltpDisplay = ltp !== null ? fmtDetail(ltp) : fmtDetail(leg.last_saw_price ?? leg.mark_price ?? leg.ltp);
        const entryPrice = fmtDetail(leg.entry_trade?.price);
        // compute current MTM from LTP (same formula as computeStrategyPnl)
        const ePrice = parseFloat(String(leg.entry_trade?.price ?? leg.entry_trade?.trigger_price ?? 0)) || 0;
        const qty    = (Number(leg.quantity) || 0) * (Number(leg.lot_size) || 1);
        const isSell = String(leg.position ?? "").toLowerCase().includes("sell");
        const livePnl = (ltp !== null && ePrice > 0 && qty > 0)
          ? (isSell ? (ePrice - ltp) * qty : (ltp - ePrice) * qty)
          : (leg.pnl ?? 0);
        const pnlColor = livePnl >= 0 ? "text-green-600" : "text-red-500";

        const slRow = leg.feature_status_map?.sl;
        const tgtRow = leg.feature_status_map?.target;
        const trailRow = leg.feature_status_map?.trailSL;
        const slVal = slRow ? fmtDetail(slRow.current_sl_price ?? slRow.trigger_price) : "-";
        const tgtVal = tgtRow ? fmtDetail(tgtRow.trigger_price) : "-";
        const trailVal = trailRow ? fmtDetail(trailRow.current_sl_price ?? trailRow.trigger_price) : "-";
        const descs = leg.active_trigger_descriptions?.filter(Boolean) ?? [];

        // Pending feature leg (momentum queue)
        if (leg.is_pending_feature_leg) {
          return (
            <div key={idx} className="mt-4 pt-4 border-t border-dashed border-[#d5e3f1]">
              <div className="text-[13px] font-bold text-[#1f3347] mb-[10px]">{legTitle} • Momentum Queue</div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-[10px]">
                <DetailMetric label="Queued At" value={String(leg.queued_at ?? "").replace("T", " ") || "-"} />
                <DetailMetric label="Armed At" value={String(leg.armed_at ?? "").replace("T", " ") || "-"} />
                <DetailMetric label="LTP" value={ltpDisplay} />
                <DetailMetric label="Base Price" value={fmtDetail(leg.momentum_base_price)} />
                <DetailMetric label="Target Price" value={fmtDetail(leg.momentum_target_price)} />
                <DetailMetric label="Status" value="Active" />
              </div>
              <FeatureStatusSection descs={descs} />
            </div>
          );
        }

        return (
          <div key={idx} className={`${featureRows.length > 0 || idx > 0 ? "mt-4 pt-4 border-t border-dashed border-[#d5e3f1]" : ""}`}>
            <div className="text-[13px] font-bold text-[#1f3347] mb-[10px]">{legTitle}</div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-[10px]">
              <DetailMetric label="Entry Price" value={entryPrice} />
              <DetailMetric label="LTP" value={ltpDisplay} />
              <div className="p-[10px_12px] border border-[#d9e7f5] rounded-lg bg-white">
                <div className="text-[11px] font-semibold text-[#5c7084] uppercase tracking-wide mb-[6px]">P&L</div>
                <div className={`text-[13px] font-bold ${pnlColor}`}>{fmtMoney(livePnl)}</div>
              </div>
              <DetailMetric label="SL" value={slVal} featureEnabled={!!slRow} />
              <DetailMetric label="TG" value={tgtVal} featureEnabled={!!tgtRow} />
              <DetailMetric label="TSL" value={trailVal} featureEnabled={!!trailRow} />
            </div>
            <FeatureStatusSection descs={descs} />
          </div>
        );
      })}

      {!featureRows.length && !allLegs.length && (
        <div className="text-[12px] text-[#7b8ea2]">No open leg details available.</div>
      )}
    </div>
  );
}

function FeatureStatusSection({ descs }: { descs: string[] }) {
  return (
    <>
      <div className="mt-3 text-[12px] font-bold text-[#1f3347] uppercase tracking-wide">Feature Status</div>
      {descs.length > 0
        ? <div className="mt-2 flex flex-col gap-2">{descs.map((d, i) => <div key={i} className="pl-3 border-l-4 border-[#1580ed] bg-white rounded text-[12px] text-[#30485f] py-[10px] px-3">{d}</div>)}</div>
        : <div className="mt-1 text-[12px] text-[#7b8ea2]">No active feature status available.</div>}
    </>
  );
}

// ─── Toggle switch ─────────────────────────────────────────────────────────────

function ToggleSwitch({ id, checked, onChange }: { id: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button id={id} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative inline-flex items-center rounded-full h-3 w-6 transition-colors ${checked ? "bg-[#1580ed]" : "bg-[#9ca3af]"}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full bg-white transition-transform ${checked ? "translate-x-3.5" : "translate-x-1"}`} />
    </button>
  );
}

// ─── Broker Settings Modal ─────────────────────────────────────────────────────

function BrokerSettingsModal({ open, brokerName, modal, saving, loading, onClose, onChange, onSave }: {
  open: boolean; brokerName: string; modal: BsModalState; saving: boolean; loading?: boolean;
  onClose: () => void; onChange: (next: BsModalState) => void; onSave: () => void;
}) {
  function toggleBtn(isOpen: boolean, onClick: () => void) {
    return (
      <button type="button" onClick={onClick}
        className="inline-flex items-center justify-center w-5 h-5 rounded border border-[#d1d5db] text-[#6b7280] text-sm font-bold hover:bg-gray-50 shrink-0">
        {isOpen ? "−" : "+"}
      </button>
    );
  }
  function numInput(label: string, val: number, onVal: (n: number) => void) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <div className="flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 bg-white focus-within:ring-1 focus-within:ring-brand-500/60">
          <span className="text-slate-400 text-sm shrink-0">₹</span>
          <input type="text" inputMode="numeric" value={String(val)}
            onChange={e => { const n = parseInt(e.target.value.replace(/\D/g, ""), 10); onVal(isNaN(n) ? 0 : n); }}
            className="flex-1 bg-transparent border-0 outline-none text-sm text-slate-700 font-medium w-0 min-w-0" />
        </div>
      </div>
    );
  }
  const tabs: { key: TrailingTab; label: string }[] = [
    { key: "lock", label: "Lock" },
    { key: "lock-trail", label: "Lock and Trail" },
    { key: "trail-stop-loss", label: "Trail Stop Loss" },
  ];
  return (
    <Modal isOpen={open} onClose={onClose} className="max-w-[540px] m-4 p-0">
      <div>
        <div className="flex items-center justify-between border-b border-gray-200 px-7 py-5 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">{brokerName || "Broker"} Broker Settings</h2>
        </div>
        <div className="flex flex-col gap-5 px-7 pb-6 pt-5 relative">
          {loading && <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80"><span className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>}
          <div className="grid grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">Stop Loss</span>
                {toggleBtn(modal.stopLossOpen, () => onChange({ ...modal, stopLossOpen: !modal.stopLossOpen }))}
              </div>
              {modal.stopLossOpen && (
                <div className="flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 bg-white focus-within:ring-1 focus-within:ring-brand-500/60">
                  <span className="text-slate-400 text-sm shrink-0">₹</span>
                  <input type="text" inputMode="numeric" value={String(modal.stopLoss)}
                    onChange={e => { const n = parseInt(e.target.value.replace(/\D/g, ""), 10); onChange({ ...modal, stopLoss: isNaN(n) ? 0 : n }); }}
                    className="flex-1 bg-transparent border-0 outline-none text-sm text-slate-700 font-medium w-0 min-w-0" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">Target Profit</span>
                {toggleBtn(modal.targetOpen, () => onChange({ ...modal, targetOpen: !modal.targetOpen }))}
              </div>
              {modal.targetOpen && (
                <div className="flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 bg-white focus-within:ring-1 focus-within:ring-brand-500/60">
                  <span className="text-slate-400 text-sm shrink-0">₹</span>
                  <input type="text" inputMode="numeric" value={String(modal.target)}
                    onChange={e => { const n = parseInt(e.target.value.replace(/\D/g, ""), 10); onChange({ ...modal, target: isNaN(n) ? 0 : n }); }}
                    className="flex-1 bg-transparent border-0 outline-none text-sm text-slate-700 font-medium w-0 min-w-0" />
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">Trailing Options</span>
              {toggleBtn(modal.trailingOpen, () => onChange({ ...modal, trailingOpen: !modal.trailingOpen }))}
            </div>
            {modal.trailingOpen && (
              <div className="rounded-xl border border-slate-200 p-4 flex flex-col gap-4">
                <div className="flex gap-2">
                  {tabs.map(t => (
                    <button key={t.key} type="button" onClick={() => onChange({ ...modal, trailingTab: t.key })}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${modal.trailingTab === t.key ? "bg-secondary-500 text-white border-secondary-500" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
                {modal.trailingTab === "lock" && (
                  <div className="grid grid-cols-2 gap-4">
                    {numInput("If profit reaches", modal.lock.trigger, v => onChange({ ...modal, lock: { ...modal.lock, trigger: v } }))}
                    {numInput("Lock profit", modal.lock.profit, v => onChange({ ...modal, lock: { ...modal.lock, profit: v } }))}
                  </div>
                )}
                {modal.trailingTab === "lock-trail" && (
                  <div className="grid grid-cols-2 gap-4">
                    {numInput("If profit reaches", modal.lockTrail.trigger, v => onChange({ ...modal, lockTrail: { ...modal.lockTrail, trigger: v } }))}
                    {numInput("Lock profit", modal.lockTrail.profit, v => onChange({ ...modal, lockTrail: { ...modal.lockTrail, profit: v } }))}
                    {numInput("For every increase in profit by", modal.lockTrail.trailTrigger, v => onChange({ ...modal, lockTrail: { ...modal.lockTrail, trailTrigger: v } }))}
                    {numInput("Trail profit by", modal.lockTrail.trailProfit, v => onChange({ ...modal, lockTrail: { ...modal.lockTrail, trailProfit: v } }))}
                  </div>
                )}
                {modal.trailingTab === "trail-stop-loss" && (
                  <div className="grid grid-cols-2 gap-4">
                    {numInput("For every increase in Profit by", modal.trailSL.trigger, v => onChange({ ...modal, trailSL: { ...modal.trailSL, trigger: v } }))}
                    {numInput("Trail Stop Loss by", modal.trailSL.stopLoss, v => onChange({ ...modal, trailSL: { ...modal.trailSL, stopLoss: v } }))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-gray-200 dark:border-gray-700">
          <button type="button" onClick={onClose} className="py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 border-r border-gray-200 dark:border-gray-700 transition-colors rounded-bl-3xl">Cancel</button>
          <button type="button" onClick={onSave} disabled={saving} className="py-3 text-sm font-medium text-white bg-secondary-500 hover:bg-secondary-600 disabled:opacity-50 transition-colors rounded-br-3xl">{saving ? "Saving…" : "Setup"}</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Broker Settings Row ───────────────────────────────────────────────────────

function BrokerSettingsRow({
  display, includeBrokerage, includeTaxes,
  onOpenEdit, onToggleBrokerage, onToggleTaxes,
  totalMtm, onMtmClick, onAnalysisClick, onReplayClick,
  brokerageTotal, taxAgg,
  brokerageRate, brokerageRateType, onBrokerageRateChange, onBrokerageRateTypeChange,
  marginBlocked, netDebitCredit,
}: {
  display: BsDisplay; includeBrokerage: boolean; includeTaxes: boolean;
  onOpenEdit: () => void; onToggleBrokerage: (v: boolean) => void; onToggleTaxes: (v: boolean) => void;
  totalMtm: number; onMtmClick: () => void; onAnalysisClick?: () => void; onReplayClick?: () => void;
  brokerageTotal: number; taxAgg: TaxBucket;
  brokerageRate: number; brokerageRateType: "per_order" | "per_lot";
  onBrokerageRateChange: (v: number) => void; onBrokerageRateTypeChange: (v: "per_order" | "per_lot") => void;
  marginBlocked?: number | null; netDebitCredit?: number;
}) {
  const [showBrokerageEdit, setShowBrokerageEdit] = useState(false);
  const [taxTooltipOpen, setTaxTooltipOpen] = useState(false);
  const brokeragePopupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (brokeragePopupRef.current && !brokeragePopupRef.current.contains(e.target as Node)) setShowBrokerageEdit(false);
    }
    if (showBrokerageEdit) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showBrokerageEdit]);

  return (
    <div className="flex flex-wrap items-stretch justify-between gap-6 w-full px-5 py-4 mb-5 bg-white rounded-xl border border-[#e5e7eb] shadow-[0_2px_8px_0_rgba(16,24,40,0.07)]">
      {/* Broker Settings card */}
      <div className="shrink-0">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5 pb-2.5 border-b border-[#ececec]">
            <p className="text-[18px] font-medium leading-tight tracking-tight text-[#1f2937]">Broker Settings</p>
            <span className="inline-flex items-center justify-center w-[14px] h-[14px] rounded-full border border-[#9ca3af] text-[#4b5563]">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
            </span>
          </div>
          <div className="flex flex-wrap items-stretch gap-0">
            {[
              { label: "Stop Loss", value: fmtBsCurrency(display.stopLoss) },
              { label: "Target Profit", value: fmtBsCurrency(display.target) },
              { label: "Trailing Options", value: display.trailing || "-" },
            ].map((m, i) => (
              <div key={m.label} className={`min-w-[96px] px-4 ${i === 0 ? "pl-0" : ""} ${i === 2 ? "border-r-0" : "border-r border-[#ececec]"}`}>
                <div className="mb-1.5 text-[11px] font-medium text-[#6b7280]">{m.label}</div>
                <div className="text-[18px] font-medium leading-none tracking-tight text-[#111827]">{m.value}</div>
              </div>
            ))}
            <button type="button" onClick={onOpenEdit}
              className="h-8 px-5 rounded-md border border-secondary-500 bg-white text-secondary-500 text-xs font-medium hover:bg-secondary-50 transition-colors whitespace-nowrap shrink-0 ml-4">
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Total MTM + icons */}
      <div className="flex flex-1 items-center gap-4 border-x border-[#ececec] px-6">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-[#6b7280] shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
          <span className="text-[14px] font-semibold text-[#1f2937]">Total MTM</span>
        </div>
        <span className="text-[15px] font-bold tabular-nums whitespace-nowrap" style={{ color: totalMtm >= 0 ? "#16a34a" : "#ef4444" }}>{fmtMoney(totalMtm)}</span>
        <div className="flex items-center gap-1">
          <button type="button" title="MTM" onClick={onMtmClick} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#f3f4f6] transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="#4b5563" viewBox="0 0 16 16"><path fillRule="evenodd" d="M0 0h1v15h15v1H0zm10 3.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V4.9l-3.613 4.417a.5.5 0 0 1-.74.037L7.06 6.767l-3.656 5.027a.5.5 0 0 1-.808-.588l4-5.5a.5.5 0 0 1 .758-.06l2.609 2.61L13.445 4H10.5a.5.5 0 0 1-.5-.5"/></svg>
          </button>
          <button type="button" title="Analysis" onClick={onAnalysisClick} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#f3f4f6] transition-colors">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.334 1.333V12.666c0 1.107.893 2 2 2H14.667" stroke="#4b5563" strokeWidth="1" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/><path d="M13.932 7.171L11.255 3.696a1 1 0 0 0-1.585.298L7.612 5.113a1 1 0 0 1-1.586-.19L4.572 2.714" stroke="#4b5563" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/><path d="M13.932 12.457L11.255 8.982a1 1 0 0 0-1.585.298L7.612 10.4a1 1 0 0 1-1.586-.19L4.572 8" stroke="#4b5563" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button type="button" title="Replay" onClick={onReplayClick} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#f3f4f6] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 20.75a7.25 7.25 0 0 1-7.25-7.25.75.75 0 0 1 1.5 0A5.75 5.75 0 1 0 12 7.75H9.5a.75.75 0 0 1 0-1.5H12a7.25 7.25 0 0 1 0 14.5Z" fill="#4b5563"/><path d="M12 10.75a.75.75 0 0 1-.53-.22l-3-3a.75.75 0 0 1 1.06-1.06L12 9.94l2.47-2.47a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-.53.22Z" fill="#4b5563"/></svg>
          </button>
        </div>
      </div>

      {/* Toggles + metrics */}
      <div className="flex items-center gap-7 flex-wrap py-1">
        {/* Include Brokerage */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[#1f2937]">Include Brokerage</span>
            <ToggleSwitch id="ft-brokerage-toggle" checked={includeBrokerage} onChange={onToggleBrokerage} />
          </div>
          <div className="relative flex items-center gap-1.5">
            <span className={`text-sm font-medium ${includeBrokerage ? "text-gray-800" : "text-gray-400"}`}>{fmtMoney(brokerageTotal)}</span>
            {includeBrokerage && (
              <button type="button" onClick={() => setShowBrokerageEdit(v => !v)} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.718 1.272l-.351 1.406a.75.75 0 0 0 .913.913l1.406-.351a2.75 2.75 0 0 0 1.272-.718l4.261-4.263a1.75 1.75 0 0 0 0-2.475ZM3.75 12.5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Z" /></svg>
              </button>
            )}
            {showBrokerageEdit && (
              <div ref={brokeragePopupRef} className="absolute top-full left-0 z-50 mt-2 w-max rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                <p className="mb-2.5 text-xs font-semibold text-gray-800">Brokerage</p>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} value={brokerageRate} onChange={e => onBrokerageRateChange(Math.max(0, Number(e.target.value)))}
                    className="w-20 rounded border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:border-secondary-500 focus:outline-none" />
                  <select value={brokerageRateType} onChange={e => onBrokerageRateTypeChange(e.target.value as "per_order" | "per_lot")}
                    className="rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800 focus:border-secondary-500 focus:outline-none">
                    <option value="per_order">per order</option>
                    <option value="per_lot">per lot</option>
                  </select>
                  <button type="button" onClick={() => setShowBrokerageEdit(false)} className="rounded-lg bg-secondary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-secondary-600 transition-colors">Done</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Taxes & charges */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[#1f2937]">Taxes &amp; charges</span>
            <ToggleSwitch id="ft-taxes-toggle" checked={includeTaxes} onChange={onToggleTaxes} />
          </div>
          <div className="relative flex items-center gap-1.5">
            <span className={`text-sm font-medium ${includeTaxes ? "text-gray-800" : "text-gray-400"}`}>{fmtMoney(taxAgg.total)}</span>
            {includeTaxes && (
              <button type="button" onMouseEnter={() => setTaxTooltipOpen(true)} onMouseLeave={() => setTaxTooltipOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.718 1.272l-.351 1.406a.75.75 0 0 0 .913.913l1.406-.351a2.75 2.75 0 0 0 1.272-.718l4.261-4.263a1.75 1.75 0 0 0 0-2.475ZM3.75 12.5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Z" /></svg>
              </button>
            )}
            {taxTooltipOpen && includeTaxes && (
              <div className="absolute top-full left-0 z-50 mt-2 w-52 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                <p className="mb-2 text-xs font-semibold text-gray-800">Taxes &amp; charges</p>
                <div className="space-y-1.5 text-xs text-gray-500">
                  {([{ label: "STT", val: taxAgg.stt }, { label: "Exchange transaction charges", val: taxAgg.exchange }, { label: "Stamp charges", val: taxAgg.stamp }, { label: "SEBI turnover fees", val: taxAgg.sebi }, { label: "GST", val: taxAgg.gst }] as { label: string; val: number }[]).map(({ label, val }) => (
                    <div key={label} className="flex items-center justify-between gap-2"><span>{label}</span><span className="whitespace-nowrap font-medium text-gray-700">{fmtMoney(val)}</span></div>
                  ))}
                  <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-1.5"><span className="font-semibold text-gray-800">Total</span><span className="whitespace-nowrap font-semibold text-gray-800">{fmtMoney(taxAgg.total)}</span></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Margin Blocked */}
        <div className="flex flex-col justify-center gap-2.5">
          <span className="text-[13px] text-[#6b7280]">Margin Blocked&nbsp;(approx)</span>
          <span className="text-[15px] font-medium text-[#1f2937] tabular-nums">{marginBlocked != null ? fmtMoney(marginBlocked) : "₹ 0"}</span>
        </div>

        {/* Net Debit/Credit */}
        <div className="flex flex-col justify-center gap-2.5">
          <span className="flex items-center gap-1 text-[13px] text-[#6b7280]">
            Net Debit/Credit
            <span className="inline-flex items-center justify-center w-[14px] h-[14px] rounded-full border border-[#9ca3af] text-[#4b5563]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
            </span>
          </span>
          <span className="text-[15px] font-medium text-[#1f2937] tabular-nums">{netDebitCredit != null ? fmtMoney(netDebitCredit) : "₹ 0"}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Control bar button style ─────────────────────────────────────────────────
const BTN = "inline-flex items-center gap-1.5 h-[34px] px-3 border border-[#d7e0ea] rounded-[10px] bg-white text-[#1f3347] text-[13px] font-medium whitespace-nowrap select-none cursor-pointer hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const COLS = "grid grid-cols-[minmax(240px,1.45fr)_minmax(150px,0.9fr)_minmax(120px,0.8fr)_minmax(170px,1fr)_minmax(200px,1fr)] gap-6 items-center";

// ─── Main component ───────────────────────────────────────────────────────────

export default function ForwardTest() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());
  const [socketStatus, setSocketStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("connecting");
  const [brokerEntries, setBrokerEntries] = useState<BrokerEntry[]>([]);
  const [pnlMap, setPnlMap] = useState<Record<string, number>>({});
  const [groupPnlMap, setGroupPnlMap] = useState<Record<string, number>>({});
  const [totalMtm, setTotalMtm] = useState(0);
  const [openPos, setOpenPos] = useState({ open: 0, total: 0 });
  const [loadError, setLoadError] = useState("");
  const [brokerSettingsCache, setBrokerSettingsCache] = useState<Record<string, BrokerSettings>>({});
  // broker settings row
  const [bsDisplay, setBsDisplay] = useState<BsDisplay>({ stopLoss: null, target: null, trailing: "-" });
  const [bsModalOpen, setBsModalOpen] = useState(false);
  const [bsModal, setBsModal] = useState<BsModalState>(DEFAULT_MODAL);
  const [bsSaving, setBsSaving] = useState(false);
  const [bsLoadingModal, setBsLoadingModal] = useState(false);
  const [selectedBrokerEntry, setSelectedBrokerEntry] = useState<BrokerEntry | null>(null);
  // mtm graph
  const [mtmGraphOpen, setMtmGraphOpen] = useState(false);
  const [mtmGraphData, setMtmGraphData] = useState<Record<string, MtmHistoricalEntry> | null>(null);
  const [mtmGraphLoading, setMtmGraphLoading] = useState(false);
  const [mtmGraphError, setMtmGraphError] = useState("");
  const [mtmHoverIdx, setMtmHoverIdx] = useState<number | null>(null);
  const [mtmGraphLegs, setMtmGraphLegs] = useState<Leg[]>([]);
  const [mtmGraphCurrentMtm, setMtmGraphCurrentMtm] = useState<number>(0);
  const mtmSvgRef = useRef<SVGSVGElement>(null);
  const [includeBrokerage, setIncludeBrokerage] = useState(false);
  const [includeTaxes, setIncludeTaxes] = useState(false);
  const [brokerageRate, setBrokerageRate] = useState(0);
  const [brokerageRateType, setBrokerageRateType] = useState<"per_order" | "per_lot">("per_order");
  // control bar
  const [autoload, setAutoload] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [speed, setSpeed] = useState("60");
  const [runNowLoading, setRunNowLoading] = useState(false);

  // ── Activation section
  const [activationTab, setActivationTab] = useState<ActivationTab>("strategies");
  const [strategies, setStrategies] = useState<StrategyItem[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioItem[]>([]);
  const [activationSearch, setActivationSearch] = useState("");
  const [activationLoading, setActivationLoading] = useState(false);
  const [dayFilter, setDayFilter] = useState<number | null>(null); // 1=M 2=T 3=W 4=Th 5=F 6=Sa 0=Su

  // ── refs
  const executionMapRef    = useRef<Record<string, DeployedRecord>>({});
  const currentRecordsRef  = useRef<DeployedRecord[]>([]);
  const ltpSnapshotMapRef  = useRef<Record<string, LtpItem>>({});   // 'token:TOKEN' → LtpItem
  const brokerStaticMapRef = useRef<Record<string, BrokerEntry>>({});
  const mtmTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exOrdWsRef         = useRef<WebSocket | null>(null);
  const updWsRef           = useRef<WebSocket | null>(null);
  const exOrdReconnRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updReconnRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestListenTsRef  = useRef("");
  const autoloadRef        = useRef(false);
  const autoplayTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const speedRef           = useRef("60");
  const userIdRef          = useRef(localStorage.getItem("user_id") ?? "");

  useEffect(() => { autoloadRef.current = autoload; }, [autoload]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  // ── get current timestamp ─────────────────────────────────────────────────
  const getCurrentTs = useCallback(() => latestListenTsRef.current || nowIsoTs(), []);

  // ── refresh all MTM from snapshot map ────────────────────────────────────
  const refreshMtm = useCallback(() => {
    const ltp = ltpSnapshotMapRef.current;
    const recMap = executionMapRef.current;
    const newPnl: Record<string, number> = {};
    const newGroupPnl: Record<string, number> = {};
    const newBrokerMtm: Record<string, number> = {};
    let totalPnl = 0, totalOpen = 0, totalCount = 0;

    for (const rid of Object.keys(recMap)) {
      const rec = recMap[rid];
      const pnl = computeStrategyPnl(rec, ltp);
      newPnl[rid] = pnl;
      const gid = rec.portfolio?.group_id ?? "";
      if (gid) newGroupPnl[gid] = (newGroupPnl[gid] ?? 0) + pnl;
      const bk = getBrokerName(rec).toLowerCase();
      newBrokerMtm[bk] = (newBrokerMtm[bk] ?? 0) + pnl;
      const openLegs = Array.isArray(rec.legs) ? rec.legs.filter(l => l && !l.exit_trade).length : (rec.open_legs_count ?? 0);
      totalOpen += openLegs; totalCount += 1;
    }
    for (const v of Object.values(newPnl)) totalPnl += v;

    setPnlMap(newPnl);
    setGroupPnlMap(newGroupPnl);
    setTotalMtm(Math.round(totalPnl * 100) / 100);
    setOpenPos({ open: totalOpen, total: totalCount });
    setBrokerEntries(Object.values(brokerStaticMapRef.current).map(e => ({ ...e, mtm: newBrokerMtm[e.key] ?? 0 })));
  }, []);

  const scheduleMtmRefresh = useCallback(() => {
    if (mtmTimerRef.current) return;
    mtmTimerRef.current = setTimeout(() => { mtmTimerRef.current = null; refreshMtm(); }, MTM_THROTTLE_MS);
  }, [refreshMtm]);

  const buildBrokerStaticMap = useCallback((records: DeployedRecord[]) => {
    const map: Record<string, BrokerEntry> = {};
    for (const rec of records) {
      const label = getBrokerName(rec); const bk = label.toLowerCase();
      if (!map[bk]) map[bk] = { key: bk, label, icon: getBrokerIcon(rec), brokerId: rec.broker ?? "", userId: rec.user_id ?? "", strategyCount: 0, openLegCount: 0, mtm: 0 };
      map[bk].strategyCount += 1;
      map[bk].openLegCount += Array.isArray(rec.legs) ? rec.legs.filter(l => l && !l.exit_trade).length : (rec.open_legs_count ?? 0);
    }
    brokerStaticMapRef.current = map;
  }, []);

  const applyRecords = useCallback((records: DeployedRecord[]) => {
    currentRecordsRef.current = records;
    for (const rec of records) {
      const rid = rec._id ?? rec.trade_id ?? ""; if (rid) executionMapRef.current[rid] = rec;
      if (!userIdRef.current && rec.user_id) userIdRef.current = rec.user_id;
    }
    buildBrokerStaticMap(records);
    setGroups(groupRecords(records));
    setLoadError("");
    refreshMtm();
  }, [buildBrokerStaticMap, refreshMtm]);

  // ── process execute-orders message ────────────────────────────────────────
  const processExecOrds = useCallback((payload: Record<string, unknown>) => {
    if (payload.type === "broker-settings") {
      const bsList = ((payload.data as Record<string, unknown>)?.brokers ?? []) as BrokerSettings[];
      if (Array.isArray(bsList)) setBrokerSettingsCache(prev => { const n = { ...prev }; for (const bs of bsList) { const bid = String(bs.broker_id ?? "").trim(); if (bid) n[bid] = bs; } return n; });
      return;
    }
    // Handle: { data: { records: [] } }  |  { data: [] }  |  { records: [] }  |  { data: singleRec }
    const d = payload.data as Record<string, unknown> | undefined;
    const recs: DeployedRecord[] = Array.isArray(payload.data) ? (payload.data as DeployedRecord[])
      : Array.isArray(d?.records) ? (d!.records as DeployedRecord[])
      : d?._id ? [d as unknown as DeployedRecord]
      : Array.isArray(payload.records) ? (payload.records as DeployedRecord[])
      : [];
    if (!recs.length) return;
    let needFull = false;
    for (const rec of recs) {
      const rid = String(rec._id ?? rec.trade_id ?? ""); if (!rid) continue;
      if (!userIdRef.current && rec.user_id) userIdRef.current = rec.user_id;
      const existing = executionMapRef.current[rid];
      const merged = mergeRecord(rec, existing);
      executionMapRef.current[rid] = merged;
      let found = false;
      currentRecordsRef.current = currentRecordsRef.current.map(r => { const id = String(r._id ?? r.trade_id ?? ""); if (id === rid) { found = true; return merged; } return r; });
      if (!found) {
        // Brand-new strategy/group — add to list and rebuild groups
        currentRecordsRef.current.push(merged);
        needFull = true;
      } else if (
        !existing ||
        existing.status !== rec.status ||
        existing.active_on_server !== rec.active_on_server ||
        existing.open_legs_count !== rec.open_legs_count
      ) {
        // Meaningful structural change — rebuild so badges/counts update
        needFull = true;
      }
      const t = rec.position_refresh_trigger ?? "";
      if (t === "cancel-deployment" || t === "squared-off") needFull = true;
    }
    if (needFull) { buildBrokerStaticMap(currentRecordsRef.current); setGroups(groupRecords(currentRecordsRef.current)); }
    scheduleMtmRefresh();
  }, [buildBrokerStaticMap, scheduleMtmRefresh]);

  // ── process update/ltp message ─────────────────────────────────────────────
  const processUpd = useCallback((payload: Record<string, unknown>) => {
    const type = payload.type as string | undefined;
    if (type === "ltp_update") {
      const d = (payload.data as Record<string, unknown>) ?? {};
      // LTP comes as ARRAY of {token, ltp, underlying, option_type, ...}
      if (Array.isArray(d.ltp)) mergeLtpItems(d.ltp as LtpItem[], ltpSnapshotMapRef.current);
      if (Array.isArray(d.instrument_ltp)) mergeLtpItems(d.instrument_ltp as LtpItem[], ltpSnapshotMapRef.current);
      const ts = String(d.listen_timestamp ?? d.listen_time ?? "").trim();
      if (ts) latestListenTsRef.current = ts;
      scheduleMtmRefresh(); return;
    }
    if (type === "broker-settings") {
      const bsList = ((payload.data as Record<string, unknown>)?.brokers ?? []) as BrokerSettings[];
      if (Array.isArray(bsList)) setBrokerSettingsCache(prev => { const n = { ...prev }; for (const bs of bsList) { const bid = String(bs.broker_id ?? "").trim(); if (bid) n[bid] = bs; } return n; });
      return;
    }
    if (type === "update") {
      const positions = ((payload.data as Record<string, unknown>)?.open_positions as Array<Record<string, unknown>>) ?? [];
      for (const pos of positions) {
        const tid = String(pos.trade_id ?? ""), lid = String(pos.leg_id ?? "");
        if (!tid || !lid || !executionMapRef.current[tid]) continue;
        for (const leg of executionMapRef.current[tid].legs ?? []) {
          if (String(leg.leg_id ?? leg.id ?? "") !== lid) continue;
          if (pos.current_price != null) { leg.last_saw_price = Number(pos.current_price); leg.ltp = Number(pos.current_price); }
        }
      }
      scheduleMtmRefresh();
    }
  }, [scheduleMtmRefresh]);

  // ── fetch portfolios ───────────────────────────────────────────────────────
  const fetchPortfolios = useCallback(async () => {
    // TODO: re-enable after testing
    // if (fetchInFlightRef.current) return;
    // fetchInFlightRef.current = true;
    // try {
    //   const res = await fetch(`${API_BASE}/executions?environment=${EXEC_ENV}&is_signal=false&trade_status=1`);
    //   if (!res.ok) throw new Error(`HTTP ${res.status}`);
    //   const data = await res.json();
    //   applyRecords(Array.isArray(data.records) ? data.records : []);
    // } catch (err) { setLoadError("Unable to load deployed portfolios. Retrying…"); console.error("[ForwardTest] fetch:", err); }
    // finally { fetchInFlightRef.current = false; }
  }, [applyRecords]);

  // ── keep latest handlers in refs so socket callbacks never go stale ───────
  const processExecOrdsRef = useRef(processExecOrds);
  const processUpdRef      = useRef(processUpd);
  useEffect(() => { processExecOrdsRef.current = processExecOrds; }, [processExecOrds]);
  useEffect(() => { processUpdRef.current      = processUpd;       }, [processUpd]);

  // ── sockets  (stable deps = [] — guards prevent duplicate connections) ────
  const connectExecOrds = useCallback(() => {
    const cur = exOrdWsRef.current;
    // Already connecting (0) or open (1) → do nothing
    if (cur && (cur.readyState === WebSocket.CONNECTING || cur.readyState === WebSocket.OPEN)) return;
    const ws = new WebSocket(buildWsUrl("execute-orders", userIdRef.current));
    exOrdWsRef.current = ws;
    ws.onopen = () => {
      setSocketStatus("connected");
      ws.send(JSON.stringify({ activation_mode: ACTIVATION_MODE, status: ACTIVATION_MODE, autoload: autoloadRef.current, reason: "subscribe" }));
    };
    ws.onmessage = e => { let p: Record<string, unknown>; try { p = JSON.parse(e.data); } catch { return; } processExecOrdsRef.current(p); };
    ws.onclose  = () => {
      // Stale socket (replaced or cleaned up) — do not reconnect
      if (exOrdWsRef.current !== ws) return;
      setSocketStatus("disconnected");
      if (exOrdReconnRef.current) clearTimeout(exOrdReconnRef.current);
      exOrdReconnRef.current = setTimeout(connectExecOrds, 3000);
    };
    ws.onerror  = () => setSocketStatus("error");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const connectUpd = useCallback(() => {
    const cur = updWsRef.current;
    if (cur && (cur.readyState === WebSocket.CONNECTING || cur.readyState === WebSocket.OPEN)) return;
    const ws = new WebSocket(buildWsUrl("update", userIdRef.current));
    updWsRef.current = ws;
    ws.onopen = () => ws.send(JSON.stringify({ activation_mode: ACTIVATION_MODE, status: ACTIVATION_MODE, autoload: autoloadRef.current, reason: "subscribe" }));
    ws.onmessage = e => {
      let p: Record<string, unknown>; try { p = JSON.parse(e.data); } catch { return; }
      if (p.type === "connection_established") { setSocketStatus("connected"); ws.send(JSON.stringify({ activation_mode: ACTIVATION_MODE, status: ACTIVATION_MODE, autoload: autoloadRef.current, reason: "connection_established" })); return; }
      if (p.type === "subscription_ack") { setSocketStatus("connected"); return; }
      processUpdRef.current(p);
    };
    ws.onclose = () => {
      // Stale socket (replaced or cleaned up) — do not reconnect
      if (updWsRef.current !== ws) return;
      if (updReconnRef.current) clearTimeout(updReconnRef.current);
      updReconnRef.current = setTimeout(connectUpd, 3000);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Run Now ────────────────────────────────────────────────────────────────
  const runNow = useCallback(async (tsOverride?: string) => {
    const ts = tsOverride ?? getCurrentTs();
    if (!ts) return;
    setRunNowLoading(true); setSocketStatus("connecting");
    try {
      const res = await fetch(`${API_BASE}/algo-backtest-simulator?listen_timestamp=${encodeURIComponent(ts)}&autoload=false`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      const bc = (payload.socket_broadcast ?? {}) as Record<string, unknown>;
      if (!bc["execute-orders"] && payload.execute_order_event) processExecOrds(payload.execute_order_event as Record<string, unknown>);
      if (!bc.update && payload.update_event) processUpd(payload.update_event as Record<string, unknown>);
      if (!bc.update && payload.ltp_event) processUpd(payload.ltp_event as Record<string, unknown>);
      setSocketStatus("connected");
    } catch (err) { console.error("[RunNow]", err); setSocketStatus("error"); }
    finally { setRunNowLoading(false); }
  }, [getCurrentTs, processExecOrds, processUpd]);

  // ── autoload toggle ────────────────────────────────────────────────────────
  const toggleAutoload = useCallback(() => {
    setAutoload(prev => {
      const next = !prev; autoloadRef.current = next;
      const sub = { activation_mode: ACTIVATION_MODE, status: ACTIVATION_MODE, autoload: next, reason: "autoload_toggle" };
      if (exOrdWsRef.current?.readyState === WebSocket.OPEN) exOrdWsRef.current.send(JSON.stringify(sub));
      if (updWsRef.current?.readyState === WebSocket.OPEN) updWsRef.current.send(JSON.stringify(sub));
      return next;
    });
  }, []);

  // ── autoplay ───────────────────────────────────────────────────────────────
  const stopAutoplay = useCallback(() => { if (autoplayTimerRef.current) clearInterval(autoplayTimerRef.current); autoplayTimerRef.current = null; setAutoplay(false); }, []);
  const startAutoplay = useCallback(() => {
    setAutoplay(true);
    autoplayTimerRef.current = setInterval(() => {
      const mins = Math.max(1, Math.round(parseInt(speedRef.current) / 60));
      const dt = new Date((latestListenTsRef.current || nowIsoTs()).replace(" ", "T"));
      dt.setMinutes(dt.getMinutes() + mins);
      const ts = dt.toISOString().replace("T", " ").slice(0, 19);
      latestListenTsRef.current = ts;
      runNow(ts);
    }, 1000);
  }, [runNow]);
  const toggleAutoplay = useCallback(() => { if (autoplayTimerRef.current) stopAutoplay(); else startAutoplay(); }, [stopAutoplay, startAutoplay]);

  // ── broker settings computed values ───────────────────────────────────────
  const chargeTrades = useMemo(() => buildAllChargeTrades(groups.flatMap(g => g.items)), [groups]);
  const brokerageTotal = useMemo(() => includeBrokerage ? calcBtBrokerage(chargeTrades, brokerageRate, brokerageRateType) : 0, [includeBrokerage, chargeTrades, brokerageRate, brokerageRateType]);
  const taxAgg = useMemo(() => includeTaxes ? calcBtTaxes(chargeTrades) : ZERO_TAX, [includeTaxes, chargeTrades]);
  const netDebitCredit = useMemo(() => groups.flatMap(g => g.items).reduce((total, rec) => {
    const openLegs = (rec.legs ?? []).filter(l => l && Number(l.status) === 1);
    return openLegs.reduce((s, leg) => {
      const ePrice = Number(leg.entry_trade?.price ?? leg.entry_trade?.trigger_price ?? 0) || 0;
      const qty = (Number(leg.quantity) || 0) * (Number(leg.lot_size) || 1);
      const isSell = String(leg.position ?? "").toLowerCase().includes("sell");
      return isSell ? s + ePrice * qty : s - ePrice * qty;
    }, total);
  }, 0), [groups]);

  // ── broker settings handlers ──────────────────────────────────────────────
  function syncBsDisplay(m: BsModalState) {
    const sl = m.stopLossOpen ? m.stopLoss : null;
    const tgt = m.targetOpen ? m.target : null;
    let trailing = "-";
    if (m.trailingOpen) {
      if (m.trailingTab === "lock") trailing = "Lock";
      else if (m.trailingTab === "lock-trail") trailing = "Lock and Trail";
      else trailing = "Trail Stop Loss";
    }
    setBsDisplay({ stopLoss: sl, target: tgt, trailing });
  }

  const fetchBrokerModalState = useCallback(async (entry: BrokerEntry): Promise<BsModalState> => {
    const userId = entry.userId || userIdRef.current;
    const brokerId = entry.brokerId;
    let next: BsModalState = { ...DEFAULT_MODAL };
    if (!userId || !brokerId) return next;
    setBsLoadingModal(true);
    try {
      const r = await fetch(`${API_BASE}/get_broker_stoploss_settings/${encodeURIComponent(brokerId)}/${encodeURIComponent(userId)}/${ACTIVATION_MODE}`);
      if (r.ok) {
        const data = await r.json();
        if (data?.found && data?.settings) {
          const s = data.settings;
          next = { ...DEFAULT_MODAL };
          if (s.StopLoss != null) { next.stopLossOpen = true; next.stopLoss = s.StopLoss; }
          if (s.Target != null) { next.targetOpen = true; next.target = s.Target; }
          if (s.LockAndTrail && s.OverallTrailSL) {
            next.trailingOpen = true; next.trailingTab = "lock-trail";
            next.lockTrail = { trigger: s.LockAndTrail.InstrumentMove ?? 100, profit: s.LockAndTrail.StopLossMove ?? 0, trailTrigger: s.OverallTrailSL.InstrumentMove ?? 1, trailProfit: s.OverallTrailSL.StopLossMove ?? 1 };
          } else if (s.LockAndTrail) {
            next.trailingOpen = true; next.trailingTab = "lock";
            next.lock = { trigger: s.LockAndTrail.InstrumentMove ?? 100, profit: s.LockAndTrail.StopLossMove ?? 0 };
          } else if (s.OverallTrailSL) {
            next.trailingOpen = true; next.trailingTab = "trail-stop-loss";
            next.trailSL = { trigger: s.OverallTrailSL.InstrumentMove ?? 1, stopLoss: s.OverallTrailSL.StopLossMove ?? 1 };
          }
          syncBsDisplay(next);
        }
      }
    } catch { /* use defaults */ }
    finally { setBsLoadingModal(false); }
    return next;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectBroker = useCallback(async (entry: BrokerEntry) => {
    setSelectedBrokerEntry(entry);
    const next = await fetchBrokerModalState(entry);
    setBsModal(next);
  }, [fetchBrokerModalState]);

  const openBrokerSettings = useCallback(async () => {
    const entry = selectedBrokerEntry ?? brokerEntries[0];
    if (!entry) return;
    setSelectedBrokerEntry(entry);
    const next = await fetchBrokerModalState(entry);
    setBsModal(next);
    setBsModalOpen(true);
  }, [selectedBrokerEntry, brokerEntries, fetchBrokerModalState]);

  const saveBrokerSettings = useCallback(async () => {
    setBsSaving(true);
    const entry = selectedBrokerEntry ?? brokerEntries[0];
    const userId = entry?.userId || userIdRef.current;
    const brokerId = entry?.brokerId ?? "";
    const m = bsModal;
    const payload: Record<string, unknown> = {
      StopLoss: m.stopLossOpen ? m.stopLoss : null,
      Target: m.targetOpen ? m.target : null,
      OverallTrailSL: null, LockAndTrail: null,
      activation_mode: ACTIVATION_MODE,
    };
    if (userId) payload.user_id = userId;
    if (brokerId) payload.broker = brokerId;
    if (m.trailingOpen) {
      if (m.trailingTab === "lock") payload.LockAndTrail = { InstrumentMove: m.lock.trigger, StopLossMove: m.lock.profit };
      else if (m.trailingTab === "lock-trail") { payload.LockAndTrail = { InstrumentMove: m.lockTrail.trigger, StopLossMove: m.lockTrail.profit }; payload.OverallTrailSL = { InstrumentMove: m.lockTrail.trailTrigger, StopLossMove: m.lockTrail.trailProfit }; }
      else payload.OverallTrailSL = { InstrumentMove: m.trailSL.trigger, StopLossMove: m.trailSL.stopLoss };
    }
    try {
      await fetch(`${API_BASE}/broker-stoploss-settings/save`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } catch { /* ignore */ }
    syncBsDisplay(m);
    setBsModalOpen(false);
    setBsSaving(false);
  }, [bsModal, brokerEntries, selectedBrokerEntry]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMtmGraph = useCallback(async (legs: Leg[], currentMtm: number = 0) => {
    const tokens = [...new Set(legs.map(l => String(l.token ?? "").trim()).filter(Boolean))];
    if (tokens.length === 0) return;
    setMtmGraphLegs(legs);
    setMtmGraphCurrentMtm(currentMtm);
    setMtmGraphOpen(true);
    setMtmGraphLoading(true);
    setMtmGraphError("");
    setMtmGraphData(null);
    try {
      const base = String(API_BASE || "").replace(/\/+$/, "");
      const url = `${base}/mtm/historical-data?tokens=${encodeURIComponent(tokens.join(","))}&activation_mode=${ACTIVATION_MODE}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data: Record<string, MtmHistoricalEntry> = await res.json();
      setMtmGraphData(data);
    } catch (e: unknown) {
      setMtmGraphError(e instanceof Error ? e.message : "Failed to load MTM graph data");
    } finally {
      setMtmGraphLoading(false);
    }
  }, []);

  // ── fetch activation data (strategies / portfolios list) ──────────────────
  const fetchActivationData = useCallback(async (tab: ActivationTab) => {
    if (tab !== "strategies" && tab !== "portfolios") return;
    setActivationLoading(true);
    try {
      const url = tab === "portfolios"
        ? `${API_BASE}/portfolio/list`
        : `${API_BASE}/strategy/list`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (tab === "portfolios") {
        setPortfolios(Array.isArray(data?.portfolios) ? data.portfolios : []);
      } else {
        setStrategies(Array.isArray(data?.strategies) ? data.strategies : []);
      }
    } catch (err) {
      console.error("[Activation] fetch error:", err);
    } finally {
      setActivationLoading(false);
    }
  }, []);

  // ── lifecycle — runs exactly once on mount ─────────────────────────────────
  useEffect(() => {
    // Connect sockets first, then fetch (so we don't miss any events)
    connectExecOrds();
    connectUpd();
    fetchPortfolios();
    fetchActivationData("strategies");
    const poll = setInterval(fetchPortfolios, POLL_INTERVAL_MS);
    return () => {
      clearInterval(poll);
      if (mtmTimerRef.current)    clearTimeout(mtmTimerRef.current);
      if (exOrdReconnRef.current) clearTimeout(exOrdReconnRef.current);
      if (updReconnRef.current)   clearTimeout(updReconnRef.current);
      if (autoplayTimerRef.current) clearInterval(autoplayTimerRef.current);
      // Null refs before closing so onclose guards skip reconnect
      const exOrd = exOrdWsRef.current; exOrdWsRef.current = null; exOrd?.close();
      const upd = updWsRef.current;     updWsRef.current   = null; upd?.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // auto-select first broker when entries first appear
  useEffect(() => {
    if (brokerEntries.length > 0 && !selectedBrokerEntry) {
      selectBroker(brokerEntries[0]);
    }
  }, [brokerEntries]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGroup = (gid: string) => setExpandedGroups(p => { const n = new Set(p); n.has(gid) ? n.delete(gid) : n.add(gid); return n; });
  const toggleDetails = (sid: string) => setExpandedDetails(p => { const n = new Set(p); n.has(sid) ? n.delete(sid) : n.add(sid); return n; });

  // ── Confirm modal state ───────────────────────────────────────────────────
  const [confirmModal, setConfirmModal] = useState<{
    type: "squared-off" | "cancel-deployment";
    strategy_id: string;
    group_id: string;
  } | null>(null);

  // ── Send square-off / cancel-deployment via execute-orders socket ─────────
  const sendDeploymentAction = useCallback((
    type: "squared-off" | "cancel-deployment",
    strategyId: string,
    groupId: string
  ) => {
    if (exOrdWsRef.current?.readyState !== WebSocket.OPEN) {
      console.warn("[ForwardTest] execute-orders socket not open");
      return;
    }
    const payload: Record<string, string> = {
      type,
      strategy_id: strategyId,
      group_id: groupId,
    };
    if (type === "squared-off") {
      payload.listen_timestamp = latestListenTsRef.current || nowIsoTs();
    }
    if (userIdRef.current) payload.user_id = userIdRef.current;
    exOrdWsRef.current.send(JSON.stringify(payload));
  }, []);

  const totalMtmColor = totalMtm >= 0 ? "text-green-500" : "text-red-500";

  useEffect(() => {
    const mtm = Math.round(Object.values(pnlMap).reduce((s, v) => s + v, 0) * 100) / 100;
    document.title = `${mtm >= 0 ? "▲" : "▼"} ${fmtMoney(mtm)} | Forward Test`;
    return () => { document.title = "Forward Test | Algo Trade"; };
  }, [pnlMap]);

  // ── filtered activation items ─────────────────────────────────────────────
  const filteredActivationItems: (StrategyItem | PortfolioItem)[] = (() => {
    const q = activationSearch.trim().toLowerCase();
    const list: (StrategyItem | PortfolioItem)[] = activationTab === "portfolios" ? portfolios : strategies;
    return list.filter(item => {
      if (q && !(item.name ?? "").toLowerCase().includes(q)) return false;
      if (dayFilter !== null && activationTab === "strategies") {
        const days = (item as StrategyItem).execution_days ?? [1, 2, 3, 4, 5];
        if (!days.includes(dayFilter)) return false;
      }
      return true;
    });
  })();

  const MtmIcons = ({ legs, currentMtm = 0, navUrl, replayUrl }: { legs: Leg[]; currentMtm?: number; navUrl?: string; replayUrl?: string }) => (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <button type="button" title="MTM Graph" onClick={() => handleMtmGraph(legs, currentMtm)}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#f3f4f6] transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="#4b5563" viewBox="0 0 16 16"><path fillRule="evenodd" d="M0 0h1v15h15v1H0zm10 3.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V4.9l-3.613 4.417a.5.5 0 0 1-.74.037L7.06 6.767l-3.656 5.027a.5.5 0 0 1-.808-.588l4-5.5a.5.5 0 0 1 .758-.06l2.609 2.61L13.445 4H10.5a.5.5 0 0 1-.5-.5"/></svg>
      </button>
      <button type="button" title="Analysis" onClick={() => navUrl && window.open(navUrl, "_blank")}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#f3f4f6] transition-colors">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.334 1.333V12.666c0 1.107.893 2 2 2H14.667" stroke="#4b5563" strokeWidth="1" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/><path d="M13.932 7.171L11.255 3.696a1 1 0 0 0-1.585.298L7.612 5.113a1 1 0 0 1-1.586-.19L4.572 2.714" stroke="#4b5563" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/><path d="M13.932 12.457L11.255 8.982a1 1 0 0 0-1.585.298L7.612 10.4a1 1 0 0 1-1.586-.19L4.572 8" stroke="#4b5563" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      <button type="button" title="Replay" onClick={() => replayUrl && window.open(replayUrl, "_blank")}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#f3f4f6] transition-colors">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 20.75a7.25 7.25 0 0 1-7.25-7.25.75.75 0 0 1 1.5 0A5.75 5.75 0 1 0 12 7.75H9.5a.75.75 0 0 1 0-1.5H12a7.25 7.25 0 0 1 0 14.5Z" fill="#4b5563"/><path d="M12 10.75a.75.75 0 0 1-.53-.22l-3-3a.75.75 0 0 1 1.06-1.06L12 9.94l2.47-2.47a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-.53.22Z" fill="#4b5563"/></svg>
      </button>
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <PageMeta title="Forward Test | Algo Trade" description="Live deployed forward test portfolios" />

      {/* MTM Historical Graph Modal */}
      {mtmGraphOpen && (() => {
        const allLegs = mtmGraphLegs;
        const hist = mtmGraphData ?? {};
        const tsSet = new Set<string>();
        for (const e of Object.values(hist)) e.timestamp.forEach(t => tsSet.add(t));
        const timestamps = [...tsSet].sort();
        const closeAt: Record<string, Record<string, number>> = {};
        for (const [tk, e] of Object.entries(hist)) { closeAt[tk] = {}; e.timestamp.forEach((t, i) => { closeAt[tk][t] = e.close[i]; }); }
        const mtmValues = timestamps.map(ts => {
          let total = 0;
          for (const leg of allLegs) {
            const tk = String(leg.token ?? "").trim(); if (!tk || !closeAt[tk]) continue;
            const entryTs = (leg.entry_trade?.traded_timestamp ?? leg.entry_trade?.trigger_timestamp ?? "").slice(0, 19);
            const exitTs  = (leg.exit_trade?.traded_timestamp  ?? leg.exit_trade?.trigger_timestamp  ?? "").slice(0, 19);
            if (entryTs && ts < entryTs) continue;
            const entryPx = Number(leg.entry_trade?.price ?? 0);
            const exitPx  = Number(leg.exit_trade?.price  ?? 0);
            const qty = (Number(leg.quantity) || 0) * (Number(leg.lot_size) || 1);
            const isSell = String(leg.position ?? "").toLowerCase().includes("sell");
            if (!entryPx || !qty) continue;
            const curPx = (exitTs && ts >= exitTs && exitPx > 0) ? exitPx : (closeAt[tk][ts] ?? 0);
            if (!curPx) continue;
            total += isSell ? (entryPx - curPx) * qty : (curPx - entryPx) * qty;
          }
          return total;
        });
        const isUp = mtmGraphCurrentMtm >= 0;
        const minMtm = Math.min(...mtmValues, 0), maxMtm = Math.max(...mtmValues, 0);
        const range = maxMtm - minMtm || 1;
        const W = 700, H = 220, PL = 72, PR = 16, PT = 20, PB = 28;
        const plotW = W - PL - PR, plotH = H - PT - PB, n = timestamps.length;
        const toX = (i: number) => PL + (i / Math.max(n - 1, 1)) * plotW;
        const toY = (v: number) => PT + (1 - (v - minMtm) / range) * plotH;
        const zeroY = toY(0);
        const linePoints = mtmValues.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
        const fillPath = n > 0 ? `M${toX(0).toFixed(1)},${zeroY.toFixed(1)} ` + mtmValues.map((v, i) => `L${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ") + ` L${toX(n - 1).toFixed(1)},${zeroY.toFixed(1)} Z` : "";
        const fmtMtmV = (v: number) => { const abs = Math.abs(v), s = v < 0 ? "-" : ""; if (abs >= 1e5) return `${s}${(abs / 1e5).toFixed(1)}L`; if (abs >= 1e3) return `${s}${(abs / 1e3).toFixed(1)}K`; return v.toFixed(0); };
        const xTicks = n <= 7 ? mtmValues.map((_, i) => i) : [0, Math.floor(n * 0.25), Math.floor(n * 0.5), Math.floor(n * 0.75), n - 1];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="relative w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-base font-semibold text-gray-800">Today's MTM Graph</span>
                  <span className={`text-sm font-bold tabular-nums ${isUp ? "text-green-600" : "text-red-500"}`}>{fmtMoney(mtmGraphCurrentMtm)}</span>
                </div>
                <button type="button" onClick={() => { setMtmGraphOpen(false); setMtmHoverIdx(null); }}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {mtmGraphLoading && <div className="flex items-center justify-center py-16 text-gray-500"><span className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />Loading historical data…</div>}
              {mtmGraphError && !mtmGraphLoading && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{mtmGraphError}</div>}
              {!mtmGraphLoading && !mtmGraphError && (
                n === 0 ? <div className="py-10 text-center text-sm text-gray-400">No historical data found for active tokens.</div>
                : (() => {
                    const hi = mtmHoverIdx;
                    const hx = hi !== null ? toX(hi) : null;
                    const hy = hi !== null ? toY(mtmValues[hi]) : null;
                    const hMtm = hi !== null ? mtmValues[hi] : null;
                    const hTs  = hi !== null ? timestamps[hi] : null;
                    const hIsUp = hMtm !== null ? hMtm >= 0 : isUp;
                    const tipX = hx !== null ? (hx > W - PL - 80 ? hx - 110 : hx + 10) : 0;
                    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
                      const svg = mtmSvgRef.current; if (!svg || n === 0) return;
                      const rect = svg.getBoundingClientRect();
                      const svgX = ((e.clientX - rect.left) / rect.width) * W;
                      const idx = Math.round(((svgX - PL) / plotW) * (n - 1));
                      setMtmHoverIdx(Math.max(0, Math.min(n - 1, idx)));
                    };
                    return (
                      <svg ref={mtmSvgRef} viewBox={`0 0 ${W} ${H}`} className="w-full cursor-crosshair" style={{ height: 260 }}
                        onMouseMove={handleMouseMove} onMouseLeave={() => setMtmHoverIdx(null)}>
                        <defs><clipPath id="ft-plot-clip"><rect x={PL} y={PT} width={plotW} height={plotH} /></clipPath></defs>
                        <line x1={PL} y1={zeroY} x2={W - PR} y2={zeroY} stroke="#d1d5db" strokeWidth="1" strokeDasharray="4,3" />
                        {fillPath && <path d={fillPath} clipPath="url(#ft-plot-clip)" fill={isUp ? "rgba(22,163,74,0.12)" : "rgba(239,68,68,0.15)"} />}
                        <polyline points={linePoints} clipPath="url(#ft-plot-clip)" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
                        {[maxMtm, 0, minMtm].map((v, i) => <text key={i} x={PL - 6} y={toY(v) + 4} textAnchor="end" fontSize="10" fill="#9ca3af">{fmtMtmV(v)}</text>)}
                        {xTicks.map(i => <text key={i} x={toX(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#9ca3af">{timestamps[i]?.slice(11, 16)}</text>)}
                        <line x1={PL} y1={PT} x2={PL} y2={PT + plotH} stroke="#e5e7eb" strokeWidth="1" />
                        <line x1={PL} y1={PT + plotH} x2={W - PR} y2={PT + plotH} stroke="#e5e7eb" strokeWidth="1" />
                        {hx !== null && hy !== null && hMtm !== null && hTs && (
                          <>
                            <line x1={hx} y1={PT} x2={hx} y2={PT + plotH} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,2" />
                            <circle cx={hx} cy={hy} r={4} fill="#2563eb" stroke="#fff" strokeWidth="1.5" />
                            <rect x={tipX} y={hy - 30} width={100} height={38} rx={5} fill="white" stroke="#e2e8f0" strokeWidth="1" filter="drop-shadow(0 1px 3px rgba(0,0,0,0.12))" />
                            <text x={tipX + 8} y={hy - 14} fontSize="10" fill="#64748b">{hTs.slice(11, 16)}</text>
                            <text x={tipX + 8} y={hy + 2} fontSize="11" fontWeight="600" fill={hIsUp ? "#16a34a" : "#ef4444"}>{hIsUp ? "+" : ""}{hMtm.toFixed(0)}</text>
                          </>
                        )}
                      </svg>
                    );
                  })()
              )}
            </div>
          </div>
        );
      })()}

      <div className="flex h-full min-h-screen">

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside className="w-[230px] min-w-[230px] bg-white border-r border-gray-200 flex flex-col overflow-y-auto shrink-0">
          <div className="flex items-center gap-2 px-4 py-[14px] border-b border-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-[18px] h-[18px] text-blue-500 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
            <span className="text-[15px] font-semibold text-gray-900">Portfolio Monitor</span>
          </div>

          <div className="mx-[10px] mt-[10px] mb-1 flex items-start justify-between gap-2 px-3 py-3 border border-blue-200 rounded-lg bg-blue-50">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Total MTM</span>
              <span className={`text-[15px] font-bold tabular-nums ${totalMtmColor}`}>{fmtMoney(totalMtm)}</span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[11px] text-gray-500 font-medium">{openPos.open}/{openPos.total}</span>
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" /></span>
            </div>
          </div>

          <div className={`mx-[10px] mt-[6px] flex items-center gap-2 px-[10px] py-[6px] border rounded-lg text-[11px] font-semibold ${socketStatus === "connected" ? "border-green-200 bg-green-50 text-green-700" : socketStatus === "error" ? "border-red-200 bg-red-50 text-red-600" : "border-gray-200 bg-gray-50 text-gray-500"}`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${socketStatus === "connected" ? "bg-green-500" : socketStatus === "error" ? "bg-red-500" : "bg-amber-400"}`} />
            {socketStatus === "connected" ? "Live" : socketStatus === "error" ? "Error" : socketStatus === "disconnected" ? "Reconnecting…" : runNowLoading ? "Running…" : "Connecting…"}
          </div>

          <div className="flex flex-col gap-2 px-[10px] py-[10px] overflow-y-auto">
            {brokerEntries.length === 0
              ? <p className="text-[11px] text-gray-400 px-1 py-2">No brokers loaded.</p>
              : brokerEntries.map(entry => {
                const mc = entry.mtm >= 0 ? "#16a34a" : "#ef4444";
                const bs = brokerSettingsCache[entry.brokerId];
                const isSelected = (selectedBrokerEntry ?? brokerEntries[0])?.key === entry.key;
                return (
                  <div key={entry.key} onClick={() => selectBroker(entry)} className={`flex flex-col px-3 py-[10px] border rounded-[10px] cursor-pointer transition-colors ${isSelected ? "border-blue-500 bg-[#eaf3ff] ring-1 ring-blue-400" : "border-blue-200 bg-[#f7fbff] hover:bg-[#eef5ff]"}`}>
                    <div className="flex items-start gap-2">
                      {entry.icon && <img src={entry.icon} alt="" className="w-4 h-4 object-contain mt-[2px] shrink-0" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[13px] font-semibold text-[#1f3b57] truncate">{entry.label}</span>
                          <span className="text-[13px] font-bold whitespace-nowrap shrink-0 tabular-nums" style={{ color: mc }}>{fmtMoney(entry.mtm)}</span>
                        </div>
                        <p className="text-[11px] text-[#5b7087] mt-[2px]">{entry.strategyCount} strateg{entry.strategyCount === 1 ? "y" : "ies"} • {entry.openLegCount} open legs</p>
                      </div>
                    </div>
                    {bs?.settings_active && <BrokerSettingsStrip bs={bs} />}
                  </div>
                );
              })}
          </div>
        </aside>

        {/* ── Main ──────────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 p-5 overflow-auto">

          {/* Control bar */}
          <div className="flex flex-wrap items-center gap-2 mb-5 p-3 border border-[#dbe4ee] rounded-[10px] bg-[#f8fbff]">
            <button type="button" onClick={() => runNow()} disabled={runNowLoading} className={BTN}>
              {runNowLoading && <span className="inline-block w-3 h-3 border-2 border-[#1f3347] border-t-transparent rounded-full animate-spin" />}
              Run Now
            </button>
            <button type="button" onClick={toggleAutoload} className={`${BTN} text-[#0f5da8]`}>Autoload: {autoload ? "true" : "false"}</button>
            <div className="inline-flex items-center h-[34px] px-3 border border-[#d7e0ea] rounded-[10px] bg-white text-[#31485f] text-[13px] font-semibold gap-1">
              autoload=&nbsp;<strong className="text-[#0f5da8] lowercase">{autoload ? "true" : "false"}</strong>
            </div>
            <button type="button" onClick={toggleAutoplay} className={`${BTN} ${autoplay ? "bg-[#eef4ff] border-[#a5b4fc] text-[#3730a3]" : ""}`}>
              {autoplay ? <><span className="w-2 h-2 rounded-sm bg-[#3730a3] inline-block" /> Stop</> : <><span>▶</span> Autoplay</>}
            </button>
            <select value={speed} onChange={e => setSpeed(e.target.value)} className="h-[34px] px-2 border border-[#d7e0ea] rounded-[10px] bg-white text-[#1f3347] text-[13px] font-medium cursor-pointer outline-none">
              <option value="60">1m/1s</option>
              <option value="300">5m/1s</option>
              <option value="900">15m/1s</option>
            </select>
          </div>

          {/* Broker Settings Row */}
          {(() => {
            const allItems = groups.flatMap(g => g.items);
            return (
              <BrokerSettingsRow
                display={bsDisplay}
                includeBrokerage={includeBrokerage}
                includeTaxes={includeTaxes}
                onOpenEdit={openBrokerSettings}
                onToggleBrokerage={setIncludeBrokerage}
                onToggleTaxes={setIncludeTaxes}
                totalMtm={allItems.reduce((s, i) => s + (pnlMap[i._id] ?? 0), 0)}
                onMtmClick={() => handleMtmGraph(allItems.flatMap(i => i.legs ?? []), allItems.reduce((s, i) => s + (pnlMap[i._id] ?? 0), 0))}
                onAnalysisClick={() => { const pid = groups[0]?.portfolio_id; if (pid) window.open(`/analyse/portfolio/${encodeURIComponent(pid)}`, "_blank"); }}
                onReplayClick={() => { const pid = groups[0]?.portfolio_id; if (pid) window.open(`/replay/portfolio/${encodeURIComponent(pid)}`, "_blank"); }}
                brokerageTotal={brokerageTotal}
                taxAgg={taxAgg}
                brokerageRate={brokerageRate}
                brokerageRateType={brokerageRateType}
                onBrokerageRateChange={setBrokerageRate}
                onBrokerageRateTypeChange={setBrokerageRateType}
                marginBlocked={null}
                netDebitCredit={netDebitCredit}
              />
            );
          })()}
          <BrokerSettingsModal
            open={bsModalOpen}
            brokerName={(selectedBrokerEntry ?? brokerEntries[0])?.label ?? ""}
            modal={bsModal}
            saving={bsSaving}
            loading={bsLoadingModal}
            onClose={() => setBsModalOpen(false)}
            onChange={setBsModal}
            onSave={saveBrokerSettings}
          />

          {/* Section header */}
          <div className="flex items-center gap-3 mb-4 text-[#1f3347]">
            <span className="text-xl font-medium">Deployed Portfolios</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="w-[22px] h-[22px] text-[#31485f] shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
          </div>

          {/* Table */}
          <div>
            <div className={`${COLS} px-[14px] py-[10px] rounded bg-[#fafbfc] text-[#5b7086] text-xs font-medium`}>
              <span>Name</span><span>Broker</span><span>Status</span><span>MTM</span><span>Actions</span>
            </div>

            {loadError && !groups.length
              ? <div className="mt-4 px-[14px] py-[18px] border border-dashed border-[#dbe4ee] rounded-lg bg-white text-[#5b7086] text-[13px] text-center">{loadError}</div>
              : !groups.length
              ? <div className="mt-4 px-[14px] py-[18px] border border-dashed border-[#dbe4ee] rounded-lg bg-white text-[#5b7086] text-[13px] text-center">Loading deployed portfolios…</div>
              : groups.map(group => {
                const activeCount = group.items.filter(i => i.active_on_server).length;
                const primary = group.items[0] ?? ({} as DeployedRecord);
                const pStatus = activeCount > 0 ? { text: "RUNNING", cls: "running" }
                  : group.items.every(i => i.active_on_server === false || (i.status ?? "").includes("SquaredOff")) ? { text: "SQD OFF", cls: "squared-off" }
                  : normalizeStatus(primary);
                const totalOpenPos = group.items.reduce((s, i) => s + (typeof i.open_legs_count === "number" ? i.open_legs_count : 0), 0);
                const gid = group.group_id;
                const isExpanded = expandedGroups.has(gid);
                const gPnl = groupPnlMap[gid] ?? 0;

                return (
                  <div key={gid} className="mt-4 border border-[#dbe4ee] rounded-[10px] bg-white overflow-hidden">
                    {/* Group row */}
                    <div className={`group ${COLS} px-3 py-[14px] cursor-pointer hover:bg-gray-50`} onClick={() => toggleGroup(gid)}>
                      <div className="flex items-center gap-[10px] min-w-0">
                        <input type="checkbox" onClick={e => e.stopPropagation()} disabled={activeCount === 0} className="w-[18px] h-[18px] accent-[#1580ed] cursor-pointer shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={`w-[18px] h-[18px] text-[#31485f] shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
                            <span className="text-[14px] font-medium text-[#22384e] truncate">{group.group_name}</span>
                          </div>
                          <div className="text-[12px] text-[#586d81]">Open Pos: {totalOpenPos}</div>
                        </div>
                      </div>
                      <BrokerCell rec={primary} />
                      <div><StatusBadge text={`${pStatus.text} ${activeCount}/${group.items.length}`} cls={pStatus.cls} /></div>
                      <div className="text-[14px] font-bold whitespace-nowrap tabular-nums" style={{ color: gPnl >= 0 ? "#16a34a" : "#ef4444" }}>{fmtMoney(gPnl)}</div>
                      {/* Group actions — visible on hover only */}
                      <div className="flex justify-end items-center gap-2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-150"
                        onClick={e => e.stopPropagation()}>
                        <MtmIcons legs={group.items.flatMap(i => i.legs ?? [])} currentMtm={gPnl} navUrl={`/analyse/group/${encodeURIComponent(gid)}`} replayUrl={`/replay/group/${encodeURIComponent(gid)}`} />
                        <div className="w-px h-5 bg-[#e5e7eb]" />
                        {activeCount > 0 && (
                          <button type="button"
                            onClick={() => setConfirmModal({ type: "squared-off", strategy_id: "", group_id: gid })}
                            className="h-8 px-3 rounded-md border border-[#f1c188] bg-white text-[#d07a16] text-xs font-medium hover:bg-[#fff7ef] transition-colors whitespace-nowrap">
                            Square Off
                          </button>
                        )}
                        <button type="button"
                          onClick={() => window.open(`/execution/group/${encodeURIComponent(gid)}`, "_blank")}
                          className="h-8 px-3 rounded-md bg-[#1a2f4a] text-white text-xs font-medium hover:bg-[#243d5e] transition-colors whitespace-nowrap">
                          View
                        </button>
                      </div>
                    </div>

                    {/* Child strategy rows */}
                    {isExpanded && (
                      <div className="px-3 pb-3 bg-[#fafcfe]">
                        {group.items.map(rec => {
                          const sid = rec._id;
                          const sStatus = normalizeStatus(rec);
                          const legCount = typeof rec.open_legs_count === "number" ? rec.open_legs_count : 0;
                          const isActive = !!rec.active_on_server;
                          const recPnl = pnlMap[sid] ?? 0;
                          const detailOpen = expandedDetails.has(sid);

                          return (
                            <div key={sid} className="group/row mt-3 first:mt-0 border border-[#e6edf5] rounded-lg bg-white overflow-hidden">
                              {/* Strategy main row */}
                              <div className={`${COLS} px-3 py-[14px] hover:bg-gray-50`}>
                                <div className="flex items-center gap-[10px] min-w-0">
                                  <input type="checkbox" disabled={!isActive} className="w-[18px] h-[18px] accent-[#1580ed] cursor-pointer shrink-0" />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2"><span className="text-[#f59e0b] text-[12px] shrink-0">✸</span><span className="text-[13px] font-medium text-[#22384e] truncate">{rec.name ?? "Untitled"}</span></div>
                                    <div className="text-[12px] text-[#586d81]">{rec.ticker ? `${rec.ticker} • ` : ""}Open Pos: {legCount}</div>
                                  </div>
                                </div>
                                <BrokerCell rec={rec} />
                                <div><StatusBadge text={sStatus.text} cls={sStatus.cls} /></div>
                                <CountdownOrMtm entryTime={rec.entry_time} pnl={recPnl} />
                                {/* Actions — visible on row hover only */}
                                <div className="flex justify-end items-center gap-2 opacity-0 group-hover/row:opacity-100 pointer-events-none group-hover/row:pointer-events-auto transition-opacity duration-150">
                                  <MtmIcons legs={rec.legs ?? []} currentMtm={recPnl} navUrl={`/analyse/strategy/${encodeURIComponent(sid)}`} replayUrl={`/replay/strategy/${encodeURIComponent(sid)}`} />
                                  <div className="w-px h-5 bg-[#e5e7eb]" />
                                  <button type="button" onClick={() => toggleDetails(sid)}
                                    className="h-8 px-3 rounded-md border border-[#d7e0ea] bg-white text-[#1f3347] text-xs font-medium hover:bg-gray-50 transition-colors whitespace-nowrap">
                                    {detailOpen ? "Hide Details" : "Show Details"}
                                  </button>
                                  {isActive && (
                                    <button type="button"
                                      onClick={() => setConfirmModal({
                                        type: legCount > 0 ? "squared-off" : "cancel-deployment",
                                        strategy_id: sid,
                                        group_id: group.group_id,
                                      })}
                                      className={`h-8 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap border ${
                                        legCount > 0
                                          ? "border-[#f1c188] bg-white text-[#d07a16] hover:bg-[#fff7ef]"
                                          : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
                                      }`}>
                                      {legCount > 0 ? "Square Off" : "Cancel"}
                                    </button>
                                  )}
                                  <button type="button"
                                    onClick={() => window.open(`/execution/strategy/${encodeURIComponent(sid)}`, "_blank")}
                                    className="h-8 px-3 rounded-md bg-[#1a2f4a] text-white text-xs font-medium hover:bg-[#243d5e] transition-colors whitespace-nowrap">
                                    View
                                  </button>
                                </div>
                              </div>

                              {/* Strategy details panel */}
                              {detailOpen && (
                                <StrategyDetails
                                  record={executionMapRef.current[sid] ?? rec}
                                  ltpMap={ltpSnapshotMapRef.current}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          {/* ── Activation Section ──────────────────────────────────────── */}
          <div className="mt-8">
            {/* Section header */}
            <div className="flex items-center gap-4 mb-5 text-[#1f3347]">
              <hr className="flex-1 border-gray-200" />
              <span className="text-xl font-medium whitespace-nowrap">Activation</span>
              <hr className="flex-1 border-gray-200" />
            </div>

            {/* Tab bar + search + filters */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {/* Tabs */}
              <div className="flex border border-[#d7e0ea] rounded-lg overflow-hidden text-[13px] font-medium shrink-0">
                {(["strategies", "portfolios", "ra-algos", "cryptobazaar"] as const).map((t, i) => {
                  const labels: Record<string, string> = { strategies: "Strategies", portfolios: "Portfolios", "ra-algos": "RA Algos", cryptobazaar: "CryptoBazaar Algos" };
                  const isActive = activationTab === t;
                  const isFirst = i === 0; const isLast = i === 3;
                  return (
                    <button key={t} type="button"
                      onClick={() => { setActivationTab(t as ActivationTab); if (t === "strategies" || t === "portfolios") fetchActivationData(t as ActivationTab); }}
                      className={`px-4 py-[7px] whitespace-nowrap transition-colors ${isFirst ? "rounded-l-lg" : ""} ${isLast ? "rounded-r-lg" : "border-r border-[#d7e0ea]"} ${isActive ? "bg-[#eef4ff] text-[#1580ed] font-semibold" : "bg-white text-[#4a5e70] hover:bg-gray-50"}`}>
                      {labels[t]}
                    </button>
                  );
                })}
              </div>

              {/* Search */}
              <div className="relative flex-1 min-w-[180px] max-w-[260px]">
                <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8da0b0]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                <input value={activationSearch} onChange={e => setActivationSearch(e.target.value)} placeholder="Search Strategies"
                  className="w-full pl-7 pr-3 py-[7px] border border-[#d7e0ea] rounded-lg text-[13px] text-[#1f3347] placeholder:text-[#8da0b0] outline-none focus:border-[#1580ed] bg-white" />
              </div>

              {/* Selected count */}
              <div className="inline-flex items-center gap-1 h-[34px] px-3 border border-[#d7e0ea] rounded-lg bg-white text-[13px] text-[#4a5e70] font-medium cursor-pointer hover:bg-gray-50 shrink-0">
                0 Selected
                <svg className="w-4 h-4 text-[#8da0b0]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
              </div>

              {/* Execution Days filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[12px] text-[#5b7086]">Filter Execution Days</span>
                <div className="flex border border-[#d7e0ea] rounded-lg overflow-hidden text-[12px] font-medium">
                  <button type="button" className="px-3 py-[5px] bg-[#eef4ff] text-[#1580ed] font-semibold rounded-l-lg">Weekdays</button>
                  <button type="button" className="px-3 py-[5px] bg-white text-[#4a5e70] hover:bg-gray-50 border-l border-[#d7e0ea] rounded-r-lg">DTE</button>
                </div>
                {/* Day chips */}
                {[{label:"M",val:1},{label:"T",val:2},{label:"W",val:3},{label:"Th",val:4},{label:"F",val:5},{label:"Sa",val:6},{label:"Su",val:0}].map(d => (
                  <button key={d.val} type="button"
                    onClick={() => setDayFilter(prev => prev === d.val ? null : d.val)}
                    className={`w-7 h-7 rounded-full border text-[11px] font-semibold transition-colors ${dayFilter === d.val ? "border-[#1580ed] bg-[#eef4ff] text-[#1580ed]" : "border-[#d7e0ea] bg-white text-[#5b7086] hover:border-[#1580ed] hover:text-[#1580ed]"}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div>
              {/* Table header */}
              <div className="grid grid-cols-[1fr_140px_130px_220px_160px] gap-4 px-3 py-[10px] rounded bg-[#fafbfc] text-[#5b7086] text-xs font-medium">
                <span>{activationTab === "portfolios" ? `Portfolio (${filteredActivationItems.length})` : `Strategy (${filteredActivationItems.length})`}</span>
                <span>Status</span>
                <span>Instances</span>
                <span>Execution On</span>
                <span></span>
              </div>

              {activationLoading ? (
                <div className="mt-4 px-3 py-8 text-center text-[13px] text-[#8da0b0]">Loading…</div>
              ) : filteredActivationItems.length === 0 ? (
                <div className="mt-4 px-3 py-8 text-center text-[13px] text-[#8da0b0] border border-dashed border-[#dbe4ee] rounded-lg bg-white">
                  No {activationTab === "portfolios" ? "portfolios" : "strategies"} found.
                </div>
              ) : filteredActivationItems.map((item: StrategyItem | PortfolioItem) => {
                const isPortfolio = activationTab === "portfolios";
                const name = (item as StrategyItem).name ?? "Untitled";
                const metaPrimary = isPortfolio ? "PORTFOLIO" : ((item as StrategyItem).underlying ?? "—");
                const metaSecondary = isPortfolio
                  ? `${((item as PortfolioItem).strategy_ids?.length ?? 0)} Strategies`
                  : "INTRADAY";
                const execDays = (item as StrategyItem).execution_days ?? [1, 2, 3, 4, 5];
                return (
                  <div key={item._id} className="group mt-2 grid grid-cols-[1fr_140px_130px_220px_160px] gap-4 items-center px-3 py-[14px] border border-[#e6edf5] rounded-lg bg-white hover:bg-gray-50 transition-colors">
                    {/* Name */}
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-[#22384e] truncate">{name}</div>
                      <div className="text-[11px] text-[#586d81] mt-[2px]">{metaPrimary} • {metaSecondary}</div>
                    </div>
                    {/* Status */}
                    <div>
                      <span className="inline-flex items-center px-3 py-[4px] rounded border border-[#8bd5a9] bg-[#f2fbf5] text-[#1c9b47] text-[11px] font-semibold whitespace-nowrap">
                        Ready to deploy
                      </span>
                    </div>
                    {/* Instances */}
                    <div>
                      <span className="inline-flex items-center px-3 py-[4px] rounded border border-[#d7e0ea] bg-[#f8fbff] text-[#5b7086] text-[11px] font-medium whitespace-nowrap">
                        0 Deployed
                      </span>
                    </div>
                    {/* Execution On days */}
                    <div className="flex items-center gap-1">
                      {[{label:"M",val:1},{label:"T",val:2},{label:"W",val:3},{label:"TH",val:4},{label:"F",val:5},{label:"-",val:6},{label:"-",val:0}].map((d, idx) => {
                        const active = d.label !== "-" && execDays.includes(d.val);
                        return (
                          <span key={idx} className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-semibold border ${active ? "border-[#1580ed] bg-[#eef4ff] text-[#1580ed]" : "border-[#d7e0ea] bg-white text-[#8da0b0]"}`}>
                            {d.label}
                          </span>
                        );
                      })}
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" className="h-8 px-3 rounded-md border border-[#d7e0ea] bg-white text-[#1f3347] text-xs font-medium hover:bg-gray-50 transition-colors whitespace-nowrap">
                        Edit Setup
                      </button>
                      <button type="button"
                        onClick={() => {
                          const dt = encodeURIComponent(latestListenTsRef.current || nowIsoTs());
                          window.open(`/portfolio/activation/${encodeURIComponent(item._id)}/${ACTIVATION_MODE}/${dt}`, "_blank");
                        }}
                        className="h-8 px-3 rounded-md bg-[#1580ed] text-white text-xs font-medium hover:bg-[#1268c7] transition-colors whitespace-nowrap">
                        Activate
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Confirm modal (Square Off / Cancel Deployment) ──────────── */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmModal(null)} />

          {/* Dialog */}
          <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-gray-200 bg-white shadow-2xl p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">
                {confirmModal.type === "squared-off" ? "Square Off" : "Cancel Deployment"}
              </h3>
              <button type="button" onClick={() => setConfirmModal(null)}
                className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Message */}
            <p className="text-sm text-gray-600 mb-6">
              {confirmModal.type === "squared-off"
                ? "Are you sure you want to square off this strategy? This will close all open positions."
                : "Are you sure you want to cancel this deployment?"}
            </p>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmModal(null)}
                className="h-9 px-4 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="button"
                onClick={() => {
                  sendDeploymentAction(confirmModal.type, confirmModal.strategy_id, confirmModal.group_id);
                  setConfirmModal(null);
                }}
                className={`h-9 px-4 rounded-lg text-sm font-medium text-white transition-colors ${
                  confirmModal.type === "squared-off"
                    ? "bg-orange-500 hover:bg-orange-600"
                    : "bg-red-500 hover:bg-red-600"
                }`}>
                {confirmModal.type === "squared-off" ? "Square Off" : "Cancel Deployment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
