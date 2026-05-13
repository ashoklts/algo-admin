import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router";
import { Chart, registerables } from "chart.js";
import { Modal } from "../../components/ui/modal";
Chart.register(...registerables);

/* ─── API + constants ──────────────────────────────────────────────────────── */
const API_BASE  = (import.meta.env.VITE_API_BASE_URL as string || "").replace(/\/+$/, "");
const PAPER_TRADE_API_BASE = API_BASE ? `${API_BASE}/simulator/paper-trade` : "http://127.0.0.1:8000/algo/simulator/paper-trade";
const CREATE_NEW_PORTFOLIO = "__create_new_portfolio__";
const INSTRUMENTS = ["NIFTY","BANKNIFTY","FINNIFTY","SENSEX","MIDCPNIFTY"];
const REFRESH_OPTS = [
  { v:0,  l:"Off"    }, { v:5,  l:"5 Sec"  }, { v:10, l:"10 Sec" },
  { v:15, l:"15 Sec" }, { v:30, l:"30 Sec" }, { v:60, l:"60 Sec" },
];
const LOT_SIZE: Record<string,number> = { NIFTY:75, BANKNIFTY:30, FINNIFTY:65, SENSEX:10, MIDCPNIFTY:120 };
const OC_ITEM_W = 104, OC_ITEM_GAP = 8, OC_STEP = OC_ITEM_W + OC_ITEM_GAP;

/* ─── Types ────────────────────────────────────────────────────────────────── */
interface ChainRow { strike:number; ltp:number; iv:number; delta:number; gamma:number; theta:number; vega:number; oi:number; token:string; symbol:string; }
interface LiveChain { instrument:string; expiry:string; expiries:string[]; spot_price:number; india_vix?:number; chain:{ CE:ChainRow[]; PE:ChainRow[] }; }
interface Leg { id:string; side:"B"|"S"; lots:number; qty:number; date:string; entryTime:string; strike:number; optionType:"CE"|"PE"; expiry:string; entry:number; ltp:number; delta:number; entryIv:number; entryVix:number; exited?:boolean; exitPrice?:number|null; exitTime?:string|null; }
interface PortfolioOption { label:string; value:string; }
interface QuoteSnapshot { ltp:number; delta:number; iv:number; }
interface StrategyPositionPayload { type?:string; option_type?:string; strike?:number; expiry?:string; entry_price?:number|null; entry_time?:string|null; lots?:number|null; lot_size?:number|null; quantity?:number|null; exited?:boolean; exit_price?:number|null; exit_time?:string|null; pnl?:number|null; pnl_pct?:number|null; }
interface StrategyConfigPayload {
  stopLoss?: { enabled?:boolean; unit?:SlUnit; value?:number|null };
  target?: { enabled?:boolean; unit?:SlUnit; value?:number|null };
  trailingStop?: { enabled?:boolean; unit?:SlUnit; x?:number|null; y?:number|null };
  timeControl?: { enabled?:boolean; entryTime?:string; exitTime?:string };
  lots?: number | null;
  trading_mode?: TradeMode;
  reentry_interval?: number | null;
  expiryType?: string;
  strikeType?: { enabled?:boolean; mode?:StrikeMode; value?:number|null; strike?:string };
  sl_upper?: number | null;
  sl_lower?: number | null;
}
interface StrategyPayload { _id:string; strategy_name?:string; portfolio_name?:string; instrument?:string; config?:StrategyConfigPayload; positions?:StrategyPositionPayload[]; }
type TradeMode = "manual"|"semi_auto"|"auto";
type SlUnit    = "points"|"pct";
type StrikeMode= "delta"|"closest_premium"|"strike";
type StoplossCondition = "<=" | ">=";

type PaperTradePageProps = {
  embeddedStrategyId?: string;
  forcedEmbedMode?: boolean;
  useExternalLiveChain?: boolean;
  externalLiveChain?: LiveChain | null;
  onStrategyMetadataChanged?: (payload: {
    strategyId: string;
    previousPortfolioName: string;
    nextPortfolioName: string;
    previousStrategyName: string;
    nextStrategyName: string;
  }) => void;
};

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
function fmtOI(v:number){ if(!v) return "—"; if(v>=1e7) return (v/1e7).toFixed(1)+"Cr"; if(v>=1e5) return (v/1e5).toFixed(1)+"L"; return Math.round(v/1000)+"K"; }
function p2(n:number){ return String(n).padStart(2,"0"); }
function toLocalIso(d:Date){ return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; }
function normalCDF(x:number){ const t=1/(1+0.2316419*Math.abs(x)),d=0.3989423*Math.exp((-x*x)/2),p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274)))); return x>0?1-p:p; }
function bsCall(S:number,K:number,T:number,r:number,s:number){ if(T<=1e-6||s<=0) return Math.max(0,S-K); const d1=(Math.log(S/K)+(r+.5*s*s)*T)/(s*Math.sqrt(T)); return S*normalCDF(d1)-K*Math.exp(-r*T)*normalCDF(d1-s*Math.sqrt(T)); }
function bsPut(S:number,K:number,T:number,r:number,s:number){ if(T<=1e-6||s<=0) return Math.max(0,K-S); const d1=(Math.log(S/K)+(r+.5*s*s)*T)/(s*Math.sqrt(T)),d2=d1-s*Math.sqrt(T); return K*Math.exp(-r*T)*normalCDF(-d2)-S*normalCDF(-d1); }
/* exact same as AnalyseView.tsx */
function calcImpliedIV(ltp:number,S:number,K:number,T:number,r:number,optType:"CE"|"PE"): number|null {
  if (ltp<=0 || T<1/(365*24*60)) return null;
  let lo=0.001, hi=5.0;
  for (let i=0;i<60;i++) {
    const mid=(lo+hi)/2;
    const price = optType==="CE" ? bsCall(S,K,T,r,mid) : bsPut(S,K,T,r,mid);
    if (Math.abs(price-ltp)<0.01) return mid;
    if (price<ltp) lo=mid; else hi=mid;
  }
  return (lo+hi)/2;
}

const OI_STEP = 50;
function buildOIData(priceRange:number[], isCall:boolean, ceMap:Record<number,ChainRow>, peMap:Record<number,ChainRow>): number[] {
  return priceRange.map(price => {
    const strikePrice = isCall ? price - 10 : price + 10;
    if (strikePrice % OI_STEP !== 0) return 0;
    return (isCall ? ceMap[strikePrice] : peMap[strikePrice])?.oi ?? 0;
  });
}

function inferExpiryType(selectedExpiry:string, expiries:string[]): string {
  const idx = expiries.findIndex(exp => exp === selectedExpiry);
  if (idx === 0) return "CURRENT_WEEK";
  if (idx === 1) return "NEXT_WEEK";
  if (selectedExpiry) return "CUSTOM";
  return "CURRENT_WEEK";
}

function normalizePortfolioOptions(data: unknown): PortfolioOption[] {
  const source =
    Array.isArray(data) ? data :
    Array.isArray((data as { portfolios?: unknown[] })?.portfolios) ? (data as { portfolios: unknown[] }).portfolios :
    Array.isArray((data as { data?: unknown[] })?.data) ? (data as { data: unknown[] }).data :
    [];

  return source
    .map((item) => {
      if (typeof item === "string") {
        const value = item.trim();
        return value ? { label: value, value } : null;
      }
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const value = String(record.portfolio_name ?? record.name ?? record.title ?? record._id ?? "").trim();
      if (!value) return null;
      const label = String(record.portfolio_name ?? record.name ?? value).trim() || value;
      return { label, value };
    })
    .filter((item): item is PortfolioOption => Boolean(item));
}

function legQuoteKey(expiry:string, strike:number, optionType:"CE"|"PE") {
  return `${expiry}|${strike}|${optionType}`;
}

function getPreferredStrategyExpiry(positions: StrategyPositionPayload[] = []): string {
  const uniqueExpiries = Array.from(
    new Set(
      positions
        .map((position) => String(position?.expiry || "").trim())
        .filter(Boolean),
    ),
  );
  if (uniqueExpiries.length <= 1) return uniqueExpiries[0] || "";

  return uniqueExpiries.sort((left, right) => {
    const leftTs = new Date(left).getTime();
    const rightTs = new Date(right).getTime();
    if (Number.isNaN(leftTs) || Number.isNaN(rightTs)) return left.localeCompare(right);
    return rightTs - leftTs;
  })[0];
}

/* ─── CSS — same classes as AnalyseView, scoped to .pt-page ───────────────── */
function scopeCss(css:string,scope:string){ return css.replace(/(^|[{}])\s*([^@{}][^{]*)\{/g,(_m,pre:string,sel:string)=>{ const s=sel.split(",").map(s=>s.trim()).filter(Boolean).map(s=>s.startsWith(scope)?s:`${scope} ${s}`).join(", "); return s?`${pre}\n  ${s} {`:_m; }); }
const RAW_CSS = `
* { box-sizing:border-box; margin:0; padding:0; }
.sl-page { min-height:100vh; background:#f8f9fa; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; }
.main-container { display:flex; flex-wrap:wrap; gap:20px; align-items:flex-start; }
.left-panel-tabs { display:flex; border-bottom:1px solid #e5e7eb; background:#fff; flex-shrink:0; }
.left-panel-tab { flex:1; text-align:center; padding:11px 16px; font-size:13px; font-weight:500; color:#6b7280; cursor:pointer; border:none; border-bottom:2px solid transparent; background:none; font-family:inherit; transition:color .15s,border-color .15s; }
.left-panel-tab.active { color:#2563eb; border-bottom-color:#2563eb; background:#f0f7ff; }
.left-panel-tab:hover:not(.active) { color:#374151; background:#f9fafb; }
.option-chain-panel { width:760px; min-width:min(760px,100%); flex:0 0 auto; background:#fff; border-radius:8px; border:1px solid #e5e7eb; box-shadow:0 2px 10px rgba(0,0,0,.08); overflow:hidden; display:flex; flex-direction:column; height:calc(100vh - 154px); }
.oc-header { display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-bottom:1px solid #D9D9D9; font-size:13px; }
.oc-header-left { color:#6b7280; font-size:12px; cursor:pointer; }
.oc-title { font-weight:700; font-size:13px; color:#333; }
.oc-expiry-label { font-size:11px; font-weight:400; opacity:0.8; color:#333; margin-left:2px; }
.oc-hide-btn { color:#38bdf8; font-size:12px; background:none; border:none; cursor:pointer; display:inline-flex; align-items:center; gap:3px; }
.expiry__viewer { width:100%; min-height:56px; border-bottom:1px solid #D9D9D9; display:flex; align-items:center; gap:8px; padding:4px 8px; }
.expiry-carousel__viewport { flex:1; overflow:hidden; }
.expiry-carousel__track { display:flex; align-items:flex-start; gap:8px; transition:transform 0.25s ease; will-change:transform; }
.expiry_button { text-align:center; flex:0 0 104px; width:104px; padding:4px 0; cursor:pointer; }
.expiry_button button { width:100%; padding:4px 8px; color:#646464; background:#F4F4F4; border-radius:2px; border:0; font-size:12px; cursor:pointer; font-family:inherit; text-transform:uppercase; }
.expiry_button .expiry_indicator { margin-top:2px; color:#646464; font-size:10px; }
.selected__oc__expiry button { color:#4DA1C7 !important; background-color:#DDF8FF !important; }
.expiry-carousel__arrow { flex:0 0 24px; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center; padding:0; border:0; background:transparent; color:#565656; font-size:28px; line-height:1; cursor:pointer; }
.expiry-carousel__arrow:disabled { opacity:0.2; cursor:default; }
.oc_filter { padding:4px 10px; min-height:36px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #f1f5f9; font-size:13px; color:#646464; }
.oc_filter > div { display:flex; align-items:center; min-width:110px; }
.oc_filter > div:last-child { justify-content:flex-end; }
.squar__off__type { display:flex; align-items:center; gap:8px; }
.atm-radio-label { display:flex; align-items:center; gap:4px; cursor:pointer; font-size:12px; }
.atm-radio-dot { width:12px; height:12px; border-radius:50%; border:1.5px solid #94a3b8; background:#fff; display:inline-block; flex-shrink:0; transition:all .15s; }
.atm-radio-active .atm-radio-dot { border-color:#2563eb; background:#2563eb; box-shadow:inset 0 0 0 2px #fff; }
.atm-radio-title { font-size:12px; color:#646464; }
.total_oi { display:flex; align-items:center; justify-content:center; font-size:13px; color:#646464; gap:4px; }
.total_call_oi { min-width:48px; text-align:right; font-size:11px; color:#000; }
.total_put_oi { min-width:50px; text-align:left; font-size:11px; color:#000; }
.oi-progress { width:14px; height:5px; margin:0 3px; border-radius:2px; overflow:hidden; background:#e2e8f0; }
.oi-progress-call { background:#FBE2E2; width:100%; height:100%; }
.oi-progress-put { background:#CDF1DF; width:100%; height:100%; }
.oc-custom-table { width:100%; overflow-x:auto; overflow-y:auto; flex:1; font-size:13px; }
.oc-custom-table table { min-width:460px; width:100%; border-collapse:collapse; table-layout:fixed; }
.oc-custom-table thead tr { position:sticky; top:0; z-index:2; background:#f1f5f9; }
.oc-custom-table th { padding:8px 10px; font-weight:600; font-size:12px; color:#475569; border-bottom:2px solid #e2e8f0; letter-spacing:0.03em; }
.oc-call-head { text-align:right; color:#16a34a !important; width:25%; }
.oc-call-oi-head { text-align:right; color:#ef4444 !important; width:12%; font-size:11px; }
.oc-iv-head { text-align:center; color:#7c3aed !important; width:10%; font-size:11px; }
.oc-strike-head { text-align:center; width:16%; color:#1e293b !important; }
.oc-put-oi-head { text-align:left; color:#22c55e !important; width:12%; font-size:11px; }
.oc-put-head { text-align:left; color:#dc2626 !important; width:25%; }
.oc-head-delta { font-weight:400; opacity:0.7; font-size:11px; }
.oc-row td { padding:5px 8px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
.oc-row:hover .oc-strike-td, .oc-row:hover .oc-ltp { font-weight:600; }
.oc-call-td { text-align:right; }
.oc-put-td { text-align:left; }
.oc-iv-td { text-align:center; padding:4px !important; }
.oc-iv-value { font-size:11px; font-weight:200; color:#1e293b; white-space:nowrap; }
.oc-strike-td { text-align:center; font-weight:300; font-size:13px; color:#334155; background:#f8fafc; }
.oc-ltp { font-weight:300; color:#1e293b; margin-right:3px; }
.oc-delta { font-size:11px; color:#64748b; }
.oc-empty { color:#94a3b8; }
.oc-row.oc-atm td { background:#EBFBFF !important; }
.oc-row.oc-atm .oc-strike-td { background:#c7f2ff !important; font-weight:600; }
.oc-row.oc-call-itm .oc-call-td { background:#fefce8 !important; }
.oc-row.oc-put-itm .oc-put-td { background:#fefce8 !important; }
.oc-call-oi-td { text-align:right; padding:4px 6px !important; }
.oc-put-oi-td { text-align:left; padding:4px 6px !important; }
.oc-oi-value { font-size:11px; font-weight:600; line-height:1.4; white-space:nowrap; opacity:0.6; }
.oc-oi-call { color:#ef4444; }
.oc-oi-put { color:#22c55e; }
.oc-oi-bar-wrap { height:3px; background:#e2e8f0; border-radius:2px; margin-top:3px; overflow:hidden; opacity:0.4; }
.oc-call-oi-td .oc-oi-bar-wrap { display:flex; justify-content:flex-end; }
.oc-oi-bar { height:100%; border-radius:2px; transition:width 0.3s; }
.oc-oi-bar-call { background:#ef4444; }
.oc-oi-bar-put { background:#22c55e; }
.oc-actions { display:none; align-items:center; gap:3px; }
.oc-row:hover .oc-actions { display:inline-flex; }
.oc-actions.has-active { display:inline-flex !important; }
.oc-btn-wrap { position:relative; display:inline-flex; }
.oc-action-popover {
  position:absolute;
  top:calc(100% + 6px);
  right:0;
  min-width:104px;
  background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%);
  border:1px solid rgba(148,163,184,.28);
  border-radius:10px;
  box-shadow:0 14px 30px rgba(15,23,42,.16);
  padding:6px;
  display:flex;
  flex-direction:column;
  gap:4px;
  z-index:20;
  backdrop-filter:blur(10px);
}
.oc-action-popover::before {
  content:"";
  position:absolute;
  top:-6px;
  right:12px;
  width:10px;
  height:10px;
  background:#fff;
  border-left:1px solid #dbe3ef;
  border-top:1px solid #dbe3ef;
  transform:rotate(45deg);
}
.oc-action-popover button {
  width:100%;
  border:0;
  background:#fff;
  color:#334155;
  text-align:left;
  padding:7px 9px;
  border-radius:8px;
  font-size:11px;
  font-weight:700;
  cursor:pointer;
  font-family:inherit;
  display:flex;
  align-items:center;
  gap:7px;
  box-shadow:inset 0 0 0 1px rgba(226,232,240,.9);
  transition:transform .12s ease, box-shadow .12s ease, background .12s ease;
}
.oc-action-popover button:hover {
  transform:translateY(-1px);
  box-shadow:0 6px 14px rgba(15,23,42,.10), inset 0 0 0 1px rgba(191,219,254,.95);
}
.oc-action-popover .menu-icon {
  width:18px;
  height:18px;
  border-radius:999px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  font-size:12px;
  font-weight:800;
  flex-shrink:0;
}
.oc-action-popover .add-option {
  color:#166534;
}
.oc-action-popover .add-option .menu-icon {
  background:#dcfce7;
  color:#16a34a;
}
.oc-action-popover .remove-option {
  color:#dc2626;
}
.oc-action-popover .remove-option .menu-icon {
  background:#fee2e2;
  color:#dc2626;
}
.oc-pos-count { position:absolute; top:-5px; right:-5px; min-width:14px; height:14px; border-radius:50%; font-size:9px; font-weight:700; display:flex; align-items:center; justify-content:center; line-height:1; padding:0 2px; pointer-events:none; z-index:5; }
.oc-pos-count.buy { background:#03b760; border:1px solid #fff; color:#fff; }
.oc-pos-count.sell { background:#ef6161; border:1px solid #fff; color:#fff; }
.oc-custom-table .action_button button { background:#fff; color:#999; border:1px solid #ccc; font-size:11px; padding:1px 5px; border-radius:2px; cursor:pointer; font-family:inherit; line-height:1.5; }
.oc-custom-table .buy_button:hover { color:#03B760 !important; border-color:#03B760 !important; }
.oc-custom-table .sell_button:hover { color:#EF6161 !important; border-color:#EF6161 !important; }
.oc-custom-table .buy_button.oc-btn-active { background:#03B760 !important; color:#fff !important; border-color:#03B760 !important; }
.oc-custom-table .sell_button.oc-btn-active { background:#EF6161 !important; color:#fff !important; border-color:#EF6161 !important; }
.oc-call-td .oc-cell-inner { display:flex; align-items:center; justify-content:flex-end; gap:4px; white-space:nowrap; width:100%; }
.oc-call-td .oc-actions { margin-right:auto; }
.oc-put-td .oc-cell-inner { display:flex; align-items:center; justify-content:flex-start; gap:4px; white-space:nowrap; width:100%; }
.oc-put-td .oc-actions { margin-left:auto; }
.chart-section { flex:1 1 420px; min-width:420px; background:#fff; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,.08); overflow:hidden; }
.simulator-card { overflow:hidden; border:1px solid #e5e7eb; border-radius:8px; background:#fff; height:calc(100vh - 154px); display:flex; flex-direction:column; }
.pt-page.pt-embed .chart-section { overflow: visible; }
.pt-page.pt-embed .simulator-card { height: auto; overflow: visible; }
.pt-page.pt-embed .chart-body-wrap { flex: 0 0 auto !important; overflow: visible; }
.table-tabs-container { border-bottom:1px solid #e5e7eb; overflow-x:auto; flex-shrink:0; }
.table-tabs { list-style:none; display:flex; align-items:center; min-width:max-content; }
.table-tabs li { border-right:1px solid #e5e7eb; }
.table-tabs .nav-link-sim { display:block; padding:10px 14px; font-size:13px; color:#5f6b7a; white-space:nowrap; text-decoration:none; cursor:pointer; }
.table-tabs .nav-link-sim.active { color:#3190ce; background:#fff; }
.time-on-print { padding:10px 14px; font-size:12px; color:#6b7280; white-space:nowrap; }
.simulator-stats { display:grid; grid-template-columns:repeat(8,minmax(110px,1fr)); border-bottom:1px solid #e5e7eb; flex-shrink:0; }
.simulator-stats > div { padding:10px 12px; min-width:0; border-right:1px solid #f1f5f9; }
.simulator-stats > div > div:first-child { font-size:13px; color:#5f6b7a; margin-bottom:2px; }
.sim-stat-value { font-size:12px; font-weight:700; color:#464646; white-space:nowrap; }
.breakeven-small { min-width:180px; }
.breakevan-box { font-size:12px; font-weight:700; color:#464646; }
.metrics-sub { font-size:11px; margin-left:4px; }
.chart-wrapper { position:relative; height:440px; margin-bottom:4px; flex-shrink:0; overflow:hidden; }
.chart-wrapper canvas { display:block; width:100% !important; height:100% !important; }
.spot-line { position:absolute; width:1px; pointer-events:none; z-index:10; top:0; }
.spot-line.profit { background:#16a34a; }
.spot-line.loss { background:#dc2626; }
.spot-line::before { content:''; position:absolute; top:0; left:-3px; width:7px; height:7px; border-radius:50%; border:2px solid #fff; }
.spot-line.profit::before { background:#16a34a; }
.spot-line.loss::before { background:#dc2626; }
.spot-price-label { position:absolute; background:#374151; color:#fff; padding:4px 10px; border-radius:4px; font-size:12px; font-weight:600; white-space:nowrap; pointer-events:none; z-index:12; transform:translateX(-50%); box-shadow:0 2px 6px rgba(0,0,0,.2); top:0; }
.spot-price-label::after { content:''; position:absolute; top:100%; left:50%; transform:translateX(-50%); border-left:5px solid transparent; border-right:5px solid transparent; border-top:5px solid #374151; }
.floating-pnl { position:absolute; color:#fff; padding:5px 14px; border-radius:20px; font-size:12px; font-weight:600; pointer-events:none; z-index:20; white-space:nowrap; display:flex; align-items:center; gap:5px; bottom:32px; transform:translateX(-50%); }
.floating-pnl.profit-bg { background:#15803d; }
.floating-pnl.loss-bg { background:#b91c1c; }
.payoff-bottom { text-align:center; font-size:13px; font-weight:600; color:#374151; padding:6px 0 2px; letter-spacing:.3px; flex-shrink:0; }
.pos-section { flex:1; display:flex; flex-direction:column; overflow:hidden; border-top:1px solid #e5e7eb; }
.pos-tabs { display:flex; align-items:center; border-bottom:1px solid #e5e7eb; background:#fff; padding:0 12px; flex-shrink:0; }
.pos-tab { padding:10px 12px; font-size:13px; color:#6b7280; cursor:pointer; border-bottom:2px solid transparent; white-space:nowrap; background:none; border-top:none; border-left:none; border-right:none; font-family:inherit; }
.pos-tab.active { color:#3b82f6; border-bottom-color:#3b82f6; font-weight:500; }
.pos-tab-right { margin-left:auto; font-size:12px; color:#6b7280; }
.position_table { overflow-x:auto; overflow-y:auto; flex:1; }
.position_table table { width:100%; min-width:700px; table-layout:fixed; border-collapse:collapse; }
.position_table .sticky-top { position:sticky; top:0; z-index:2; }
.position_table th { padding:5px 4px; color:#9B9B9B; background:#fff !important; font-size:12px; font-weight:500; white-space:nowrap; text-align:left; }
.action_button_group { display:flex; align-items:center; gap:6px; justify-content:flex-start; }
.pos-select-wrap { display:flex; align-items:center; justify-content:center; width:16px; min-width:16px; flex:0 0 16px; }
.pos-select-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.pos-select-box {
  width: 14px;
  height: 14px;
  border: 1px solid #9db2c7;
  border-radius: 2px;
  background: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.pos-select-box::after {
  content: "";
  width: 7px;
  height: 4px;
  border-left: 1.5px solid transparent;
  border-bottom: 1.5px solid transparent;
  transform: rotate(-45deg) translate(0, -1px);
}
.pos-select-input:checked + .pos-select-box {
  border-color: #8ab0da;
  background: #f5faff;
}
.pos-select-input:checked + .pos-select-box::after {
  border-left-color: #5f9be0;
  border-bottom-color: #5f9be0;
}
.pos-first-col-head,
.pos-first-col-cell {
  padding: 0 0 0 10px !important;
}
.pt-buy-btn { width:18px; height:18px; background:#fff; color:#03B760; border:1px solid #03B760; border-radius:4px; font-size:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-weight:600; transition:0.3s; }
.pt-sell-btn { width:18px; height:18px; background:#fff; color:#EF6161; border:1px solid #EF6161; border-radius:4px; font-size:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-weight:600; }
.parent_position td { padding:4px; font-size:12px; color:#333; border-bottom:1px solid #f4f4f4; vertical-align:middle; }
.parent_position:not(.exited__SL):not(.exited__TP):hover td { background:#f7f8f9 !important; }
.parent_position.exited__profit,
.parent_position.exited__profit td { background:#f0fdf4 !important; }
.parent_position.exited__loss,
.parent_position.exited__loss td { background:#fef2f2 !important; }
.position__strike { display:flex; align-items:center; gap:2px; user-select:none; white-space:nowrap; }
.call-btn-pt { font-size:11px; font-weight:600; color:#16a34a; }
.put-btn-pt { font-size:11px; font-weight:600; color:#ef4444; }
.sign_btn { width:14px; height:16px; font-size:11px; color:#555; background:#F4F4F4; border:0; border-radius:2px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; opacity:0; transition:opacity 0.2s; padding:0; line-height:1; }
.parent_position:hover .sign_btn { opacity:1; }
.position__expiry { white-space:nowrap; text-align:center; font-size:12px; }
.sim-input { width:55px; height:20px; border:1px solid transparent; border-radius:2px; text-align:center; outline:0; font-size:12px; background:transparent; transition:border-color .2s,background .2s; }
.sim-input:hover,.sim-input:focus { border-color:#C4C4C4; background:#fff; }
.lot-input { width:32px !important; }
.simulator_green_text { color:#03B760 !important; }
.simulator_red_text { color:#EF6161 !important; }
.expiry_indicator { font-size:11px; }
.simulator_position_button { display:flex; align-items:center; gap:4px; }
.pos-exit-btn,.pos-del-btn { background:none; border:none; cursor:pointer; padding:2px; border-radius:3px; display:inline-flex; align-items:center; justify-content:center; line-height:1; }
.pos-action-icon { width:16px; height:16px; display:block; }
.pos-exit-btn.exited .pos-action-icon { width:16px; height:16px; }
.pos-del-btn { color:#ef4444; }
.pos-del-btn:hover { background:#fef2f2; }
.pos-del-icon { width:16px; height:16px; display:block; color:currentColor; }
.lot_select_space { font-size:11px; border:1px solid #d1d5db; border-radius:2px; padding:1px 2px; background:#fff; max-width:40px; }
.position_table tr.table_footer { position:sticky; bottom:0; z-index:1; box-shadow:0 -2px 6px rgba(154,154,154,.15); }
.position_table tr.table_footer th { height:38px; background:rgba(255,255,255,.97) !important; padding:4px; font-size:12px; color:#333; font-weight:400; }
.simulator_group_input { display:inline-flex; align-items:center; border:1px solid #d1d5db; border-radius:3px; overflow:hidden; }
.sign_button { width:18px; height:22px; background:#f3f4f6; border:none; font-size:13px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; padding:0; color:#374151; }
.sign_button:disabled { opacity:0.3; cursor:not-allowed; }
.mult_input { width:28px; height:22px; border:none; text-align:center; font-size:12px; outline:none; background:#fff; }
.btn-outline-xs { padding:2px 8px; font-size:12px; border:1px solid #3b82f6; border-radius:3px; background:#fff; color:#3b82f6; cursor:pointer; white-space:nowrap; }
.btn-outline-xs:hover { background:#eff6ff; }
.pos-exit-all { font-size:12px; color:#ef4444; cursor:pointer; }
.pos-clear-all { font-size:12px; color:#6b7280; cursor:pointer; margin-left:6px; }
.pos-empty { padding:20px; text-align:center; color:#94a3b8; font-size:13px; }
.sl-config-btn { position:absolute; top:10px; right:100px; padding:5px 11px; background:#1e40af; color:#fff; border:none; border-radius:5px; font-size:12px; font-weight:600; cursor:pointer; z-index:14; display:flex; align-items:center; gap:5px; box-shadow:0 1px 4px rgba(0,0,0,.18); }
.sl-config-btn.active { background:#dc2626; }
.sl-hover-line, .sl-marker-line { position:absolute; top:0; width:0; pointer-events:none; z-index:15; }
.sl-hover-line { border-left:2px dashed #f59e0b; }
.sl-marker-line { border-left:2px solid #f59e0b; }
.sl-marker-upper { border-left:2px solid #16a34a !important; }
.sl-marker-lower { border-left:2px solid #dc2626 !important; }
.sl-marker-label { position:absolute; top:12px; white-space:nowrap; font-size:11px; font-weight:700; padding:4px 8px; border-radius:5px; line-height:1.5; pointer-events:none; }
.sl-label-upper { left:5px; background:#16a34a; color:#fff; }
.sl-label-lower { right:5px; left:auto; background:#dc2626; color:#fff; text-align:right; }
.sl-lbl-price { display:block; font-size:12px; font-weight:800; }
.sl-lbl-dist { display:block; font-size:10px; font-weight:600; opacity:.92; }
.sl-shade-region { position:absolute; top:0; pointer-events:none; z-index:8; }
.sl-config-panel { position:fixed; width:270px; background:#fff; border:1px solid #e5e7eb; border-radius:10px; box-shadow:0 8px 32px rgba(0,0,0,.18); z-index:30; font-size:13px; overflow:hidden; user-select:none; }
.sl-panel-header { background:#1e3a8a; cursor:grab; color:#fff; padding:10px 14px; display:flex; align-items:center; justify-content:space-between; }
.sl-panel-title { font-weight:700; font-size:13px; }
.sl-panel-close { background:none; border:none; color:#fff; font-size:18px; cursor:pointer; line-height:1; padding:0; }
.sl-panel-body { padding:12px 14px; display:flex; flex-direction:column; gap:10px; }
.sl-instruction { font-size:11px; color:#6b7280; background:#f0f9ff; border:1px solid #bae6fd; border-radius:5px; padding:6px 9px; text-align:center; }
.sl-panel-row { display:flex; flex-direction:column; gap:4px; }
.sl-panel-row label { font-size:11px; color:#6b7280; font-weight:600; text-transform:uppercase; letter-spacing:.4px; }
.sl-condition-row { display:flex; gap:6px; }
.sl-condition-row select, .sl-condition-row input { padding:6px 8px; border:1px solid #d1d5db; border-radius:5px; font-size:13px; background:#f9fafb; }
.sl-condition-row select { flex:0 0 110px; }
.sl-condition-row input { flex:1; font-weight:600; }
.sl-spot-value { font-weight:700; color:#1e3a8a; font-size:14px; }
.sl-diff-row { display:flex; gap:8px; }
.sl-diff-row span { flex:1; text-align:center; padding:4px 0; background:#f3f4f6; border-radius:4px; font-size:12px; font-weight:600; color:#374151; }
.sl-pnl-box { background:#fff1f2; border:1px solid #fecaca; border-radius:6px; padding:8px 10px; }
.sl-pnl-box.profit { background:#f0fdf4; border-color:#bbf7d0; }
.sl-pnl-label { font-size:10px; color:#9ca3af; font-weight:600; text-transform:uppercase; }
.sl-pnl-value { font-size:18px; font-weight:800; color:#dc2626; margin-top:2px; }
.sl-pnl-value.profit { color:#16a34a; }
.sl-panel-actions { display:flex; gap:8px; }
.sl-cancel-btn, .sl-save-btn { flex:1; padding:7px; border-radius:5px; font-size:13px; font-weight:600; cursor:pointer; }
.sl-cancel-btn { border:1px solid #d1d5db; background:#fff; color:#374151; }
.sl-save-btn { border:none; background:#1e40af; color:#fff; }
.sl-save-btn:disabled { background:#93c5fd; cursor:not-allowed; }
.sl-saved-bar { display:flex; align-items:center; gap:8px; background:#fff7ed; border:1px solid #fed7aa; border-radius:6px; padding:5px 10px; font-size:12px; font-weight:600; color:#92400e; margin-top:4px; flex-wrap:wrap; }
.sl-saved-edit, .sl-remove-link { color:#1d4ed8; cursor:pointer; text-decoration:underline; font-weight:700; background:none; border:none; padding:0; font:inherit; }
.sl-config-link { color:#1d4ed8; cursor:pointer; text-decoration:underline; font-weight:700; background:none; border:none; padding:0; font:inherit; }
.sl-config-preview {
  margin-top: 8px;
  border: 1px solid #dbe4ef;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
  height: 680px;
  display: flex;
  flex-direction: column;
}
.sl-config-preview .position_table {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.sl-config-preview-title {
  padding: 8px 12px;
  border-bottom: 1px solid #e5edf5;
  background: #f8fbff;
  color: #233f69;
  font-size: 13px;
  font-weight: 700;
}
.sl-saved-edit { margin-left:auto; }
`;
const PAGE_SCOPE = ".pt-page";
const SCOPED_CSS = scopeCss(RAW_CSS, PAGE_SCOPE);

/* ─── TCP-bar CSS (not scoped, just for the top bar) ──────────────────────── */
const TCP_CSS = `
.pt-cfg-bar { display:flex; align-items:stretch; background:#fff; border-bottom:1px solid #dde3ed; min-height:46px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
.pt-cfg-left { display:flex; align-items:center; gap:8px; padding:6px 14px; border-right:1px solid #dde3ed; flex-shrink:0; position:relative; }
.pt-cfg-inst-btn { display:flex; align-items:center; gap:5px; padding:4px 12px; border:1px solid #cbd5e1; border-radius:5px; background:#fff; font-size:13px; font-weight:700; cursor:pointer; color:#1e293b; min-width:115px; text-transform:uppercase; }
.pt-cfg-inst-menu { position:absolute; top:calc(100% + 4px); left:14px; background:#fff; border:1px solid #e2e8f0; border-radius:6px; box-shadow:0 4px 20px rgba(0,0,0,.12); z-index:400; min-width:144px; padding:4px 0; list-style:none; }
.pt-cfg-inst-menu li { padding:8px 16px; cursor:pointer; font-size:13px; text-transform:capitalize; color:#334155; }
.pt-cfg-inst-menu li:hover,.pt-cfg-inst-menu li.sel { background:#eff6ff; color:#2563eb; font-weight:600; }
.pt-cfg-compact { display:flex; align-items:center; flex:1; }
.pt-cfg-center { display:flex; align-items:center; gap:10px; flex:1; padding:0 14px; }
.pt-cfg-goback { padding:4px 12px; border:1px solid #cbd5e1; border-radius:4px; background:#fff; font-size:12px; cursor:pointer; color:#374151; }
.pt-cfg-datelbl { font-size:13px; font-weight:600; color:#1e293b; }
.pt-cfg-timelbl { font-size:13px; color:#64748b; font-variant-numeric:tabular-nums; }
.pt-cfg-refsel { border:1px solid #e2e8f0; border-radius:4px; padding:3px 6px; font-size:12px; background:#f8fafc; cursor:pointer; color:#475569; }
.pt-cfg-countdown { font-size:11px; color:#f59e0b; font-weight:700; padding:1px 7px; background:#fef3c7; border-radius:10px; border:1px solid #fbbf24; }
.pt-cfg-right { display:flex; align-items:center; gap:8px; padding:0 14px; border-left:1px solid #dde3ed; }
.pt-cfg-broker-hint { font-size:11px; color:#94a3b8; white-space:nowrap; }
.pt-cfg-connect { padding:4px 12px; border:1px solid #3b82f6; border-radius:4px; background:#eff6ff; color:#2563eb; font-size:12px; font-weight:600; cursor:pointer; }
.pt-cfg-snap { padding:4px 8px; border:1px solid #e2e8f0; border-radius:4px; background:#fff; cursor:pointer; font-size:14px; }
.pt-cfg-radio { font-size:12px; color:#475569; display:flex; align-items:center; gap:4px; cursor:pointer; }
.pt-cfg-radio.on { color:#2563eb; font-weight:600; }
.pt-tcp-bar { background:#f8fafc; border-bottom:2px solid #dde3ed; overflow-x:auto; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
.pt-tcp-row { display:flex; flex-direction:row; align-items:stretch; flex-wrap:nowrap; min-height:58px; }
.pt-tcp-card { display:flex; flex-direction:column; justify-content:center; gap:3px; padding:6px 12px; border-right:1px solid #dde3ed; flex-shrink:0; }
.pt-tcp-card:last-child { border-right:none; }
.pt-tcp-hdr { display:flex; align-items:center; gap:5px; }
.pt-tcp-t { font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.6px; white-space:nowrap; }
.pt-tcp-body { display:flex; flex-direction:row; align-items:center; gap:4px; flex-wrap:nowrap; }
.pt-tcp-sel { border:1px solid #cbd5e1; border-radius:4px; padding:3px 6px; font-size:12px; color:#1e293b; background:#fff; cursor:pointer; height:26px; outline:none; }
.pt-tcp-sel:disabled { background:#f1f5f9; color:#94a3b8; cursor:not-allowed; border-color:#e2e8f0; }
.pt-tcp-num { border:1px solid #cbd5e1; border-radius:4px; padding:3px 4px; font-size:12px; color:#1e293b; background:#fff; height:26px; width:58px; outline:none; text-align:center; }
.pt-tcp-num:disabled { background:#f1f5f9; color:#94a3b8; }
.pt-tcp-time { border:1px solid #cbd5e1; border-radius:4px; padding:3px 5px; font-size:12px; color:#1e293b; background:#fff; height:26px; outline:none; }
.pt-tcp-time:disabled { background:#f1f5f9; color:#94a3b8; }
.pt-tcp-xy { font-size:10px; font-weight:800; color:#94a3b8; margin:0 1px; }
.pt-pause-btn { height:26px; padding:0 10px; border-radius:4px; border:none; font-size:11px; font-weight:700; cursor:pointer; background:#3b82f6; color:#fff; }
.pt-pause-btn.on { background:#22c55e; }
.pt-tog { position:relative; display:inline-block; width:32px; height:17px; flex-shrink:0; cursor:pointer; margin:0; }
.pt-tog input { opacity:0; width:0; height:0; position:absolute; }
.pt-tog-track { position:absolute; inset:0; background:#cbd5e1; border-radius:17px; transition:background .2s; }
.pt-tog-track::before { content:''; position:absolute; width:11px; height:11px; left:3px; top:3px; background:#fff; border-radius:50%; transition:transform .2s; box-shadow:0 1px 3px rgba(0,0,0,.2); }
.pt-tog.on .pt-tog-track { background:#3b82f6; }
.pt-tog.on .pt-tog-track::before { transform:translateX(15px); }
`;

/* ─── Toggle component ─────────────────────────────────────────────────────── */
function Tog({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`pt-tog${checked ? " on" : ""}`}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="pt-tog-track" />
    </label>
  );
}

/* ─── Main page ────────────────────────────────────────────────────────────── */
export default function PaperTradePage({
  embeddedStrategyId,
  forcedEmbedMode = false,
  useExternalLiveChain = false,
  externalLiveChain = null,
  onStrategyMetadataChanged,
}: PaperTradePageProps = {}) {
  const { strategyId = "" } = useParams<{ strategyId?: string }>();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialStrategyId = embeddedStrategyId || strategyId || searchParams.get("strategyId") || searchParams.get("strategy_id") || "";
  const isEmbedMode = forcedEmbedMode || searchParams.get("embed") === "1" || location.pathname.startsWith("/embed/");
  const useExpiryQuery = !isEmbedMode;
  const initialRefreshSeconds = isEmbedMode ? 0 : 30;
  const externalChainMode = useExternalLiveChain;
  const pendingStrategyRef = useRef<StrategyPayload|null>(null);
  const strategyHydratedRef = useRef(false);
  const inFlightChainUrlRef = useRef<string | null>(null);
  const loadedStrategyMetaRef = useRef<{ portfolioName: string; strategyName: string }>({ portfolioName: "", strategyName: "" });

  /* Config bar */
  const [inst,       setInst]       = useState("NIFTY");
  const [instOpen,   setInstOpen]   = useState(false);
  const [instrType,  setInstrType]  = useState<"index"|"stock">("index");
  const [refresh,    setRefresh]    = useState(initialRefreshSeconds);
  const [countdown,  setCountdown]  = useState(initialRefreshSeconds);
  const [now,        setNow]        = useState(new Date());
  const instRef = useRef<HTMLDivElement>(null);
  const cdRef   = useRef<ReturnType<typeof setInterval>|null>(null);

  /* TCP bar */
  const [lots,    setLots]    = useState(1);
  const [tMode,   setTMode]   = useState<TradeMode>("manual");
  const [paused,  setPaused]  = useState(false);
  const [slOn,    setSlOn]    = useState(false);
  const [slUnit,  setSlUnit]  = useState<SlUnit>("points");
  const [slVal,   setSlVal]   = useState(0);
  const [tgtOn,   setTgtOn]   = useState(false);
  const [tgtUnit, setTgtUnit] = useState<SlUnit>("points");
  const [tgtVal,  setTgtVal]  = useState(0);
  const [tslOn,   setTslOn]   = useState(false);
  const [tslUnit, setTslUnit] = useState<SlUnit>("points");
  const [tslX,    setTslX]    = useState(0);
  const [tslY,    setTslY]    = useState(0);
  const [stOn,    setStOn]    = useState(false);
  const [stMode,  setStMode]  = useState<StrikeMode>("delta");
  const [stVal,   setStVal]   = useState<number|"">("");
  const [stDrop,  setStDrop]  = useState("ATM");
  const [tcOn,    setTcOn]    = useState(false);
  const [enTime,  setEnTime]  = useState("09:15");
  const [exTime,  setExTime]  = useState("15:30");

  /* Option chain */
  const [chain,      setChain]      = useState<LiveChain|null>(null);
  const [ocLoading,  setOcLoading]  = useState(false);
  const [ocError,    setOcError]    = useState<string|null>(null);
  const [selExpiry,  setSelExpiry]  = useState("");
  const [lastUpd,    setLastUpd]    = useState<Date|null>(null);
  const [carOff,     setCarOff]     = useState(0);
  const [atmMode,    setAtmMode]    = useState<"Spot"|"Fut"|"SynthFut">("Spot");
  const [leftTab,    setLeftTab]    = useState<"Positions"|"OptionChain">("OptionChain");
  const ocScrollRef = useRef<HTMLDivElement>(null);
  const atmRowRef   = useRef<HTMLTableRowElement>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval>|null>(null);
  const selExpiryRef = useRef("");

  /* Positions + chart */
  const [legs, setLegs] = useState<Leg[]>([]);
  const [selectedLegIds, setSelectedLegIds] = useState<string[]>([]);
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const chartRef         = useRef<Chart|null>(null);
  const pnlPriceRangeRef = useRef<number[]>([]);
  const callOIRef        = useRef<number[]>([]);
  const putOIRef         = useRef<number[]>([]);
  const chartWrapperRef  = useRef<HTMLDivElement>(null);
  const chartAreaRef     = useRef<{top:number;bottom:number;left:number;right:number}|null>(null);
  const panelDragRef     = useRef<{active:boolean;offsetX:number;offsetY:number}>({active:false,offsetX:0,offsetY:0});
  const [chartArea, setChartArea] = useState<{top:number;bottom:number;left:number;right:number}|null>(null);
  const [payoffAtSpot, setPayoffAtSpot] = useState(0);
  /* ── Stoploss state ── */
  const [slMode,       setSlMode]       = useState(false);
  const [slCondition,  setSlCondition]  = useState<StoplossCondition>("<=");
  const [slHoverPrice, setSlHoverPrice] = useState<number|null>(null);
  const [slMarkerPrice,setSlMarkerPrice]= useState<number|null>(null);
  const [slSavedUpper, setSlSavedUpper] = useState<{condition:StoplossCondition;price:number}|null>(null);
  const [slSavedLower, setSlSavedLower] = useState<{condition:StoplossCondition;price:number}|null>(null);
  const [slConfigOpen, setSlConfigOpen] = useState(false);
  const [reverseConfigLegs, setReverseConfigLegs] = useState<Leg[]>([]);
  const [panelPosition,setPanelPosition]= useState<{left:number|null;top:number|null}>({left:null,top:null});
  const [posTab, setPosTab] = useState<"Positions"|"Greeks"|"TargetPnL">("Positions");
  const [multiplier, setMultiplier] = useState(1);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveModalMode, setSaveModalMode] = useState<"create" | "update">("create");
  const [portfolioOptions, setPortfolioOptions] = useState<PortfolioOption[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState("");
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const [strategyName, setStrategyName] = useState("");
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioSaveLoading, setPortfolioSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string|null>(null);
  const [persistBanner, setPersistBanner] = useState<{ type:"success"|"error"; message:string }|null>(null);
  const [expiryQuoteMap, setExpiryQuoteMap] = useState<Record<string, QuoteSnapshot>>({});
  const [valuationTs, setValuationTs] = useState(() => Date.now());
  const [hydrationTick, setHydrationTick] = useState(0);
  const [ocActionMenu, setOcActionMenu] = useState<{ strike:number; type:"CE"|"PE"; side:"B"|"S" } | null>(null);

  useEffect(() => {
    setSelectedLegIds((current) => {
      const availableIds = legs.map((leg) => leg.id);
      const nextSelected = current.filter((id) => availableIds.includes(id));
      const newIds = availableIds.filter((id) => !nextSelected.includes(id));
      return [...nextSelected, ...newIds];
    });
  }, [legs]);

  useEffect(() => {
    pendingStrategyRef.current = null;
    strategyHydratedRef.current = false;
    inFlightChainUrlRef.current = null;
    setOcActionMenu(null);
    setLegs([]);
    setChain(null);
    setOcError(null);
    setSelExpiry("");
    setExpiryQuoteMap({});
  }, [initialStrategyId]);

  function applyLoadedStrategy(strategy: StrategyPayload) {
    const cfg = strategy.config ?? {};
    const loadedSlUpper = typeof cfg.sl_upper === "number" ? cfg.sl_upper : null;
    const loadedSlLower = typeof cfg.sl_lower === "number" ? cfg.sl_lower : null;
    const loadedPortfolioName = String(strategy.portfolio_name || "");
    const loadedStrategyName = String(strategy.strategy_name || "");
    loadedStrategyMetaRef.current = {
      portfolioName: loadedPortfolioName,
      strategyName: loadedStrategyName,
    };
    setSelectedPortfolio(loadedPortfolioName);
    setStrategyName(loadedStrategyName);
    setLots(Number(cfg.lots || 1));
    setTMode(cfg.trading_mode || "manual");
    setSlOn(Boolean(cfg.stopLoss?.enabled));
    setSlUnit(cfg.stopLoss?.unit || "points");
    setSlVal(Number(cfg.stopLoss?.value || 0));
    setTgtOn(Boolean(cfg.target?.enabled));
    setTgtUnit(cfg.target?.unit || "points");
    setTgtVal(Number(cfg.target?.value || 0));
    setTslOn(Boolean(cfg.trailingStop?.enabled));
    setTslUnit(cfg.trailingStop?.unit || "points");
    setTslX(Number(cfg.trailingStop?.x || 0));
    setTslY(Number(cfg.trailingStop?.y || 0));
    setTcOn(Boolean(cfg.timeControl?.enabled));
    setEnTime(cfg.timeControl?.entryTime || "09:15");
    setExTime(cfg.timeControl?.exitTime || "15:30");
    setStOn(Boolean(cfg.strikeType?.enabled));
    setStMode(cfg.strikeType?.mode || "delta");
    setStVal(typeof cfg.strikeType?.value === "number" ? cfg.strikeType.value : 0);
    setStDrop(cfg.strikeType?.strike || "ATM");
    setSlSavedUpper(loadedSlUpper != null ? { condition: ">=", price: Number(loadedSlUpper) } : null);
    setSlSavedLower(loadedSlLower != null ? { condition: "<=", price: Number(loadedSlLower) } : null);
    setLeftTab("Positions");
    setPosTab("Positions");
  }

  /* ── Inject CSS ── */
  useEffect(() => {
    ["pt-tcp-css","pt-scoped-css"].forEach(id => document.getElementById(id)?.remove());
    const t = document.createElement("style"); t.id="pt-tcp-css"; t.textContent=TCP_CSS; document.head.appendChild(t);
    const s = document.createElement("style"); s.id="pt-scoped-css"; s.textContent=SCOPED_CSS; document.head.appendChild(s);
    return () => { document.getElementById("pt-tcp-css")?.remove(); document.getElementById("pt-scoped-css")?.remove(); };
  }, []);

  /* ── Live clock ── */
  useEffect(() => { const t=setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(t); }, []);

  /* ── Close inst dropdown on outside click ── */
  useEffect(() => {
    const h=(e:MouseEvent)=>{ if(instRef.current&&!instRef.current.contains(e.target as Node)) setInstOpen(false); };
    document.addEventListener("mousedown",h); return ()=>document.removeEventListener("mousedown",h);
  }, []);

  useEffect(() => {
    const onDocPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".oc-btn-wrap")) return;
      setOcActionMenu(null);
    };
    document.addEventListener("mousedown", onDocPointerDown);
    return () => document.removeEventListener("mousedown", onDocPointerDown);
  }, []);

  useEffect(() => {
    setOcActionMenu(null);
  }, [selExpiry]);

  useEffect(() => {
    selExpiryRef.current = selExpiry;
  }, [selExpiry]);

  useEffect(() => {
    if (!externalChainMode || !externalLiveChain) return;
    setChain(externalLiveChain);
    setSelExpiry(String(externalLiveChain.expiry || ""));
    setLastUpd(new Date());
    setValuationTs(Date.now());
    setOcError(null);
    setOcLoading(false);
  }, [externalLiveChain, externalChainMode]);

  /* ── Fetch option chain ── */
  const fetchChain = useCallback(async (expiry?:string) => {
    if (externalChainMode) return;
    const exp = useExpiryQuery ? (expiry ?? selExpiryRef.current) : "";
    const url = `${API_BASE}/live-greeks-chain/${inst}${exp ? `?expiry=${encodeURIComponent(exp)}` : ""}`;
    if (inFlightChainUrlRef.current === url) return;
    inFlightChainUrlRef.current = url;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: LiveChain = await res.json();
      setChain(json);
      if (!exp && json.expiry) setSelExpiry(json.expiry);
      setLastUpd(new Date());
      setValuationTs(Date.now());
      setOcError(null);
    } catch(e:unknown) { setOcError((e as Error).message); }
    finally {
      if (inFlightChainUrlRef.current === url) inFlightChainUrlRef.current = null;
      setOcLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inst, useExpiryQuery]);

  /* ── Reset + initial fetch on instrument change ── */
  useEffect(() => {
    if (externalChainMode) {
      setOcLoading(false);
      setOcError(null);
      setCarOff(0);
      return;
    }
    setOcLoading(true); setChain(null); setSelExpiry(""); setOcError(null); setCarOff(0);
    const pending = pendingStrategyRef.current;
    const pendingExpiry = getPreferredStrategyExpiry(pending?.positions || []);
    if (useExpiryQuery && pending && String(pending.instrument || "").toUpperCase() === inst && pendingExpiry) {
      setSelExpiry(pendingExpiry);
      fetchChain(pendingExpiry);
      return;
    }
    fetchChain("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchChain, inst, useExpiryQuery]);

  useEffect(() => {
    if (!initialStrategyId || strategyHydratedRef.current) return;
    let active = true;
    (async () => {
      try {
        const response = await fetch(`${PAPER_TRADE_API_BASE}/strategies/${encodeURIComponent(initialStrategyId)}`);
        const data = await response.json().catch(() => null) as { status?:string; strategy?:StrategyPayload; detail?:string } | null;
        if (!active || !response.ok || data?.status === "error" || !data?.strategy) return;
        pendingStrategyRef.current = data.strategy;
        setHydrationTick((current) => current + 1);
        applyLoadedStrategy(data.strategy);
        const strategyInstrument = String(data.strategy.instrument || "NIFTY").toUpperCase();
        const strategyExpiry = getPreferredStrategyExpiry(data.strategy.positions || []);
        if (useExpiryQuery && strategyExpiry) setSelExpiry(strategyExpiry);
        if (strategyInstrument === inst) {
          if (!externalChainMode) {
            setOcLoading(true);
            fetchChain(useExpiryQuery ? strategyExpiry : "");
          }
        } else {
          setInst(strategyInstrument);
        }
      } catch {
        // keep page usable even if preload fails
      }
    })();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalChainMode, fetchChain, initialStrategyId, inst, useExpiryQuery]);

  /* ── Auto-poll with countdown ── */
  useEffect(() => {
    if (externalChainMode) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (cdRef.current) clearInterval(cdRef.current);
      setCountdown(0);
      return;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (cdRef.current) clearInterval(cdRef.current);
    if (refresh === 0) { setCountdown(0); return; }
    setCountdown(refresh);
    timerRef.current = setInterval(()=>{ fetchChain(); setCountdown(refresh); }, refresh*1000);
    cdRef.current    = setInterval(()=>setCountdown(c=>Math.max(0,c-1)), 1000);
    return ()=>{ if(timerRef.current) clearInterval(timerRef.current); if(cdRef.current) clearInterval(cdRef.current); };
  }, [fetchChain, refresh]);

  useEffect(() => {
    if (!isEmbedMode || externalChainMode) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "portfolio-paper-trade-refresh") return;
      setOcLoading(true);
      fetchChain();
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [externalChainMode, fetchChain, isEmbedMode]);

  /* ── ATM auto-scroll ── */
  useEffect(() => {
    if (!atmRowRef.current || !ocScrollRef.current) return;
    const box=ocScrollRef.current, row=atmRowRef.current;
    box.scrollTo({ top:Math.max(0,row.offsetTop - box.clientHeight/2 + row.offsetHeight/2), behavior:"smooth" });
  }, [chain]);

  /* ── Build strike/map structures ── */
  const strikes = chain ? Array.from(new Set([...chain.chain.CE.map(r=>r.strike),...chain.chain.PE.map(r=>r.strike)])).sort((a,b)=>a-b) : [];
  const ceMap = chain ? Object.fromEntries(chain.chain.CE.map(r=>[r.strike,r])) : {} as Record<number,ChainRow>;
  const peMap = chain ? Object.fromEntries(chain.chain.PE.map(r=>[r.strike,r])) : {} as Record<number,ChainRow>;
  const alternateExpiries = Array.from(
    new Set(legs.map((leg) => leg.expiry).filter((expiry) => expiry && expiry !== chain?.expiry)),
  ).sort();
  const alternateExpirySignature = alternateExpiries.join("|");
  const spotPrice = chain?.spot_price ?? 0;
  const atmStrike = strikes.length && spotPrice ? strikes.reduce((b,c)=>Math.abs(c-spotPrice)<Math.abs(b-spotPrice)?c:b,strikes[0]) : 0;
  const maxCeOI   = chain ? Math.max(0,...chain.chain.CE.map(r=>r.oi)) : 0;
  const maxPeOI   = chain ? Math.max(0,...chain.chain.PE.map(r=>r.oi)) : 0;
  const totalCeOI = chain ? chain.chain.CE.reduce((s,r)=>s+r.oi,0) : 0;
  const totalPeOI = chain ? chain.chain.PE.reduce((s,r)=>s+r.oi,0) : 0;
  const pcr = totalCeOI > 0 ? (totalPeOI/totalCeOI).toFixed(2) : "—";
  const atmCe = ceMap[atmStrike], atmPe = peMap[atmStrike];
  const atmIv = atmCe?.iv != null ? atmCe.iv.toFixed(0) : "—";
  const straddlePrem = (atmCe?.ltp&&atmPe?.ltp) ? (atmCe.ltp+atmPe.ltp).toFixed(2) : "—";
  const maxPain = atmStrike || "—";
  const lotSize = LOT_SIZE[inst] ?? 75;
  const ocMaxOffset = Math.max(0,(chain?.expiries?.length??0)*(OC_ITEM_W+OC_ITEM_GAP)-OC_ITEM_W*3);

  function addLeg(strike:number, type:"CE"|"PE", side:"B"|"S") {
    const expiry = chain?.expiry ?? selExpiry;

    const row     = type==="CE" ? ceMap[strike] : peMap[strike];
    const entryIv = row?.iv ?? (type==="CE" ? atmCe?.iv : atmPe?.iv) ?? 15;
    const newLeg: Leg = {
      id: `${Date.now()}-${Math.random()}`, side, lots: lots*multiplier,
      qty: lots*multiplier*lotSize,
      date: `${now.getFullYear()}-${p2(now.getMonth()+1)}-${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())}`,
      entryTime: toLocalIso(now),
      strike, optionType:type, expiry,
      entry: row?.ltp??0, ltp: row?.ltp??0, delta: row?.delta??0,
      entryIv,
      entryVix: chain?.india_vix ?? 0,
    };
    if (slConfigOpen) {
      setReverseConfigLegs((previous) => [...previous, { ...newLeg, id: `reverse-${newLeg.id}` }]);
      return;
    }
    setLegs(p=>[...p,newLeg]);
  }

  function removeOpenLeg(strike:number, type:"CE"|"PE", side:"B"|"S") {
    const expiry = chain?.expiry ?? selExpiry;
    const updateList = slConfigOpen ? setReverseConfigLegs : setLegs;
    updateList((previous) => {
      const existingIdx = previous.findIndex(
        (leg) => !leg.exited && leg.strike === strike && leg.optionType === type && leg.side === side && leg.expiry === expiry,
      );
      if (existingIdx === -1) return previous;
      return previous.filter((_, index) => index !== existingIdx);
    });
  }

  function handleOcActionClick(strike:number, type:"CE"|"PE", side:"B"|"S", isActive:boolean) {
    if (!isActive) {
      setOcActionMenu(null);
      addLeg(strike, type, side);
      return;
    }

    setOcActionMenu((previous) => {
      if (
        previous &&
        previous.strike === strike &&
        previous.type === type &&
        previous.side === side
      ) {
        return null;
      }
      return { strike, type, side };
    });
  }

  /* ── Update stored LTP only for legs whose expiry matches current chain expiry ── */
  useEffect(() => {
    if (!chain || !legs.length) return;
    const chainExpiry = chain.expiry;
    setLegs(p => p.map(l => {
      if (l.exited) return l;
      const r = l.optionType === "CE" ? ceMap[l.strike] : peMap[l.strike];
      if (!r) return l;
      if (useExpiryQuery && l.expiry !== chainExpiry) return l;  // different expiry → keep last known LTP
      return r ? { ...l, ltp: r.ltp, delta: r.delta } : l;
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, useExpiryQuery]);

  useEffect(() => {
    if (!useExpiryQuery) {
      setExpiryQuoteMap({});
      return;
    }
    if (!alternateExpiries.length) {
      setExpiryQuoteMap({});
      return;
    }

    let active = true;
    (async () => {
      const results = await Promise.all(
        alternateExpiries.map(async (expiry) => {
          try {
            const response = await fetch(`${API_BASE}/live-greeks-chain/${inst}?expiry=${encodeURIComponent(expiry)}`);
            const data = await response.json().catch(() => null) as LiveChain | null;
            if (!response.ok || !data?.chain) return null;
            return { expiry, data };
          } catch {
            return null;
          }
        }),
      );

      if (!active) return;
      const nextMap: Record<string, QuoteSnapshot> = {};
      results.forEach((result) => {
        if (!result) return;
        result.data.chain.CE.forEach((row) => {
          nextMap[legQuoteKey(result.expiry, row.strike, "CE")] = { ltp: row.ltp, delta: row.delta, iv: row.iv };
        });
        result.data.chain.PE.forEach((row) => {
          nextMap[legQuoteKey(result.expiry, row.strike, "PE")] = { ltp: row.ltp, delta: row.delta, iv: row.iv };
        });
      });
      setExpiryQuoteMap(nextMap);
      setValuationTs(Date.now());
    })();

    return () => { active = false; };
  }, [inst, chain?.expiry, alternateExpirySignature, useExpiryQuery]);

  useEffect(() => {
    if (!legs.length || !Object.keys(expiryQuoteMap).length) return;
    setLegs((previous) => previous.map((leg) => {
      if (leg.exited) return leg;
      if (chain && leg.expiry === chain.expiry) return leg;
      const quote = expiryQuoteMap[legQuoteKey(leg.expiry, leg.strike, leg.optionType)];
      return quote ? { ...leg, ltp: quote.ltp, delta: quote.delta, entryIv: quote.iv || leg.entryIv } : leg;
    }));
  }, [expiryQuoteMap, chain]);

  useEffect(() => {
    const pending = pendingStrategyRef.current;
    if (!pending || !chain || strategyHydratedRef.current) return;
    if (String(pending.instrument || "").toUpperCase() !== inst) return;
    const pendingExpiry = getPreferredStrategyExpiry(pending.positions || []);
    if (useExpiryQuery && pendingExpiry && chain.expiry !== pendingExpiry) return;

    const mappedLegs: Leg[] = (pending.positions || []).map((position, index) => {
      const optionType = String(position.option_type || "").toLowerCase();
      const normalizedType = optionType === "call" || optionType === "ce" ? "CE" : "PE";
      const normalizedSide = String(position.type || "").toLowerCase() === "buy" ? "B" : "S";
      const strike = Number(position.strike || 0);
      const matchingRow = normalizedType === "CE" ? ceMap[strike] : peMap[strike];
      const qty = Number(position.quantity || 0);
      const lotsValue = Number(position.lots || 1);
      const lotSizeValue = Number(position.lot_size || LOT_SIZE[inst] || 75);
      return {
        id: `${pending._id}-${index}`,
        side: normalizedSide,
        lots: lotsValue,
        qty: qty || lotsValue * lotSizeValue,
        date: String(position.entry_time || "").replace("T", " ").slice(0, 19) || `${now.getFullYear()}-${p2(now.getMonth()+1)}-${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())}`,
        entryTime: String(position.entry_time || toLocalIso(now)),
        strike,
        optionType: normalizedType,
        expiry: String(position.expiry || chain.expiry || ""),
        entry: Number(position.entry_price || 0),
        ltp: matchingRow?.ltp ?? Number(position.entry_price || 0),
        delta: matchingRow?.delta ?? 0,
        entryIv: matchingRow?.iv ?? 15,
        entryVix: chain.india_vix ?? 0,
        exited: Boolean(position.exited),
        exitPrice: position.exit_price ?? null,
        exitTime: position.exit_time ?? null,
      };
    });
    setLegs(mappedLegs);
    strategyHydratedRef.current = true;
    pendingStrategyRef.current = null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, hydrationTick, inst, useExpiryQuery]);

  function getTheoreticalLtp(leg: Leg): number {
    if (leg.exited && typeof leg.exitPrice === "number") return leg.exitPrice;
    const S = spotPrice || 0;
    if (S <= 0) return leg.ltp;

    const expiryDate = new Date(leg.expiry);
    expiryDate.setUTCHours(10, 0, 0, 0);
    const T = Math.max(1 / (365 * 24 * 60), (expiryDate.getTime() - valuationTs) / (1000 * 60 * 60 * 24 * 365));
    const r = 0.065;

    let sigma: number;
    const sameExpiryQuote = chain && (!useExpiryQuery || leg.expiry === chain.expiry)
      ? (leg.optionType === "CE" ? ceMap[leg.strike] : peMap[leg.strike])
      : expiryQuoteMap[legQuoteKey(leg.expiry, leg.strike, leg.optionType)];

    const quoteLtp = typeof sameExpiryQuote?.ltp === "number" ? sameExpiryQuote.ltp : 0;
    const quoteIv = typeof sameExpiryQuote?.iv === "number" ? sameExpiryQuote.iv : 0;

    if (quoteLtp > 0) {
      const impliedSigma = calcImpliedIV(quoteLtp, S, leg.strike, T, r, leg.optionType);
      sigma = impliedSigma ?? (quoteIv > 0 ? quoteIv / 100 : leg.entryIv / 100);
    } else if (leg.ltp > 0) {
      const impliedSigma = calcImpliedIV(leg.ltp, S, leg.strike, T, r, leg.optionType);
      sigma = impliedSigma ?? (leg.entryIv > 0 ? leg.entryIv / 100 : 0.15);
    } else {
      sigma = leg.entryIv > 0 ? leg.entryIv / 100 : 0.15;
    }

    sigma = Math.max(0.01, sigma);
    return leg.optionType === "CE" ? bsCall(S, leg.strike, T, r, sigma) : bsPut(S, leg.strike, T, r, sigma);
  }

  /* ── Get live LTP for a leg: live chain if expiry+strike+type matches, else stored ── */
  function getLiveLtp(leg: Leg): number {
    if (leg.exited && typeof leg.exitPrice === "number") return leg.exitPrice;
    if (chain && (!useExpiryQuery || leg.expiry === chain.expiry)) {
      const r = leg.optionType === "CE" ? ceMap[leg.strike] : peMap[leg.strike];
      if (r) return r.ltp;
    }
    const altQuote = expiryQuoteMap[legQuoteKey(leg.expiry, leg.strike, leg.optionType)];
    if (altQuote) return altQuote.ltp;
    return getTheoreticalLtp(leg);
  }

  function getLegPnl(leg: Leg, liveLtp: number) {
    return (leg.side === "S" ? leg.entry - liveLtp : liveLtp - leg.entry) * leg.qty;
  }

  function getCurrentMarketQuote(leg: Leg) {
    if (chain && (!useExpiryQuery || leg.expiry === chain.expiry)) {
      const row = leg.optionType === "CE" ? ceMap[leg.strike] : peMap[leg.strike];
      if (row) return { ltp: row.ltp, delta: row.delta };
    }
    const altQuote = expiryQuoteMap[legQuoteKey(leg.expiry, leg.strike, leg.optionType)];
    if (altQuote) return { ltp: altQuote.ltp, delta: altQuote.delta };
    const theoreticalLtp = getTheoreticalLtp({ ...leg, exited: false, exitPrice: null });
    return { ltp: theoreticalLtp, delta: leg.delta };
  }

  function exitLeg(index: number) {
    const exitTimestamp = toLocalIso(new Date());
    setLegs((previous) => previous.map((leg, currentIndex) => {
      if (currentIndex !== index || leg.exited) return leg;
      const exitPrice = Number(getLiveLtp(leg).toFixed(2));
      return {
        ...leg,
        exited: true,
        exitPrice,
        exitTime: exitTimestamp,
        ltp: exitPrice,
        delta: 0,
      };
    }));
  }

  function reopenLeg(index: number) {
    setLegs((previous) => previous.map((leg, currentIndex) => {
      if (currentIndex !== index || !leg.exited) return leg;
      const marketQuote = getCurrentMarketQuote(leg);
      return {
        ...leg,
        exited: false,
        exitPrice: null,
        exitTime: null,
        ltp: Number(marketQuote.ltp.toFixed(2)),
        delta: Number(marketQuote.delta.toFixed(2)),
      };
    }));
  }

  function exitAllLegs() {
    const exitTimestamp = toLocalIso(new Date());
    setLegs((previous) => previous.map((leg) => {
      if (leg.exited) return leg;
      const exitPrice = Number(getLiveLtp(leg).toFixed(2));
      return {
        ...leg,
        exited: true,
        exitPrice,
        exitTime: exitTimestamp,
        ltp: exitPrice,
        delta: 0,
      };
    }));
  }

  function updateLegLots(legId: string, nextLots: number) {
    setLegs((previous) => previous.map((leg) => {
      if (leg.id !== legId) return leg;
      const safeLots = Math.max(1, Number.isFinite(nextLots) ? Math.floor(nextLots) : 1);
      const lotSize = Math.max(1, Math.round((Number(leg.qty || 0) || safeLots) / Math.max(1, Number(leg.lots || 1))));
      return {
        ...leg,
        lots: safeLots,
        qty: safeLots * lotSize,
      };
    }));
  }

  function updateReverseConfigLegLots(legId: string, nextLots: number) {
    setReverseConfigLegs((previous) => previous.map((leg) => {
      if (leg.id !== legId) return leg;
      const safeLots = Math.max(1, Number.isFinite(nextLots) ? Math.floor(nextLots) : 1);
      const lotSize = Math.max(1, Math.round((Number(leg.qty || 0) || safeLots) / Math.max(1, Number(leg.lots || 1))));
      return {
        ...leg,
        lots: safeLots,
        qty: safeLots * lotSize,
      };
    }));
  }

  function openReverseConfigPreview() {
    setReverseConfigLegs(
      legs
        .filter((leg) => !leg.exited)
        .map((leg) => ({
          ...leg,
          id: `reverse-${leg.id}`,
          side: leg.side === "S" ? "B" : "S",
        })),
    );
    setSlConfigOpen(true);
  }

  function closeReverseConfigPreview() {
    setSlConfigOpen(false);
    setReverseConfigLegs([]);
    setOcActionMenu(null);
  }

  /* ── Computed totals ── */
  const selectedLegSet = new Set(selectedLegIds);
  const activeLegs = legs.filter((leg) => selectedLegSet.has(leg.id));
  const totalPnL   = activeLegs.reduce((s,l)=>{ const ltp=getLiveLtp(l); return s + getLegPnl(l, ltp); },0);
  const totalDelta = activeLegs.reduce((s,l)=>s+l.delta*l.lots*(l.side==="S"?-1:1),0);
  const netCredit  = activeLegs.reduce((s,l)=>s+(l.side==="S"?l.entry:-l.entry)*l.qty,0);
  function fmtExpiry(e:string) {
    const d = new Date(e);
    return isNaN(d.getTime()) ? e : d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"2-digit"});
  }
  function syncChartArea(next: {top:number;bottom:number;left:number;right:number}) {
    chartAreaRef.current = next;
    setChartArea((prev) => (
      prev &&
      prev.top === next.top &&
      prev.bottom === next.bottom &&
      prev.left === next.left &&
      prev.right === next.right
    ) ? prev : next);
  }
  const reversePositionsPreview = slConfigOpen ? (
    <div className="sl-config-preview">
      <div className="sl-config-preview-title">Reverse Positions Preview</div>
      <div className="position_table">
        <table style={{width:"100%",minWidth:700,tableLayout:"fixed"}}>
          <colgroup>
            <col style={{width:72}}/><col style={{width:72}}/><col style={{width:"5%"}}/>
            <col style={{width:78}}/><col style={{width:80}}/><col style={{width:"8%"}}/>
            <col style={{width:"6%"}}/><col style={{width:90}}/>
          </colgroup>
          <thead><tr className="sticky-top">
            <th className="pos-first-col-head" style={{width:72}}>
              <div className="action_button_group">
                <label className="pos-select-wrap">
                  <input type="checkbox" className="pos-select-input" checked readOnly />
                  <span className="pos-select-box" />
                </label>
                <span style={{width:18,display:"inline-block"}} />
              </div>
            </th>
            <th>Lots</th><th>Qty</th><th>Strike ◇</th>
            <th>Expiry</th><th>LTP/Exit</th><th>Delta</th><th>Lots Exit ◇</th>
          </tr></thead>
          <tbody>
            {reverseConfigLegs.length === 0 ? (
              <tr><td colSpan={8} className="pos-empty">No open positions available for reverse config preview.</td></tr>
            ) : (
              reverseConfigLegs.map((leg) => {
                const liveLtp = getLiveLtp(leg);
                return (
                  <tr key={`reverse-${leg.id}`} className="parent_position">
                    <td className="pos-first-col-cell">
                      <div className="action_button_group">
                        <label className="pos-select-wrap">
                          <input type="checkbox" className="pos-select-input" checked readOnly />
                          <span className="pos-select-box" />
                        </label>
                        <span className={leg.side==="B"?"pt-buy-btn":"pt-sell-btn"}>{leg.side}</span>
                      </div>
                    </td>
                    <td>
                      <div className="simulator_position_input position__strike">
                        <button className="sign_btn" onClick={() => updateReverseConfigLegLots(leg.id, leg.lots - 1)}>−</button>
                        <input
                          type="number"
                          className="sim-input lot-input"
                          value={leg.lots}
                          min={1}
                          onChange={(e) => {
                            const value = Math.max(1, parseInt(e.target.value || "1", 10) || 1);
                            updateReverseConfigLegLots(leg.id, value);
                          }}
                        />
                        <button className="sign_btn" onClick={() => updateReverseConfigLegLots(leg.id, leg.lots + 1)}>+</button>
                      </div>
                    </td>
                    <td>{leg.qty}</td>
                    <td>
                      <div className="position__strike">
                        <span>{leg.strike}</span>
                        <span className={leg.optionType==="CE"?"call-btn-pt":"put-btn-pt"}>{leg.optionType}</span>
                      </div>
                    </td>
                    <td><div className="position__expiry">{fmtExpiry(leg.expiry)}</div></td>
                    <td><input type="number" step="any" className="sim-input" value={liveLtp.toFixed(2)} readOnly /></td>
                    <td style={{textAlign:"center"}}>{leg.delta.toFixed(2)}</td>
                    <td>
                      <div className="simulator_position_button">
                        <select className="lot_select_space" value={leg.lots} disabled>
                          {Array.from({length:leg.lots},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  ) : null;

  /* ── Payoff chart — same 4-dataset dual-axis design as AnalyseView ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;

    const S    = spotPrice || 24000;
    const half = Math.max(1000, S * 0.06);
    const step = 5;
    const prices: number[] = [];
    for (let p = Math.floor((S - half) / step) * step; p <= S + half; p += step) prices.push(p);
    pnlPriceRangeRef.current = prices;

    const r = 0.065;
    // DTE: use first leg's expiry if available, else default 7 days
    const nowMs = valuationTs;

    /* ── exact same as AnalyseView.calculateCurrentDayPnL ── */
    function calcPnL(Sp: number, atExpiry: boolean): number {
      return activeLegs.reduce((sum, l) => {
        if (l.exited) {
          const closedLtp = l.exitPrice ?? l.ltp ?? 0;
          return sum + getLegPnl(l, closedLtp);
        }

        // T: real DTE from expiry date, same as AnalyseView
        const expiryDate = new Date(l.expiry);
        expiryDate.setUTCHours(10, 0, 0, 0);
        const T = atExpiry
          ? 1e-6
          : Math.max(1 / (365 * 24 * 60), (expiryDate.getTime() - nowMs) / (1000 * 60 * 60 * 24 * 365));

        // sigma: expiry-aware — only use live chain data if leg's expiry matches displayed chain
        let sigma: number;
        const legMatchesChain = chain && (!useExpiryQuery || l.expiry === chain.expiry);
        if (legMatchesChain) {
          const liveLtp = (l.optionType === "CE" ? ceMap[l.strike]?.ltp : peMap[l.strike]?.ltp) ?? 0;
          const chainIvPct = (l.optionType === "CE" ? ceMap[l.strike]?.iv : peMap[l.strike]?.iv) ?? 0;
          if (liveLtp > 0) {
            const impliedSigma = calcImpliedIV(liveLtp, spotPrice || S, l.strike, T, r, l.optionType);
            sigma = impliedSigma ?? (chainIvPct > 0 ? chainIvPct / 100 : l.entryIv / 100);
          } else {
            sigma = chainIvPct > 0 ? chainIvPct / 100 : l.entryIv / 100;
          }
        } else {
          // Different expiry displayed — use stored leg LTP to derive IV
          if (l.ltp > 0 && (spotPrice || S) > 0) {
            const impliedSigma = calcImpliedIV(l.ltp, spotPrice || S, l.strike, T, r, l.optionType);
            sigma = impliedSigma ?? (l.entryIv > 0 ? l.entryIv / 100 : 0.15);
          } else {
            sigma = l.entryIv > 0 ? l.entryIv / 100 : 0.15;
          }
        }
        sigma = Math.max(0.01, sigma);

        const theo = l.optionType === "CE" ? bsCall(Sp, l.strike, T, r, sigma) : bsPut(Sp, l.strike, T, r, sigma);
        return sum + (l.side === "S" ? l.entry - theo : theo - l.entry) * l.qty;
      }, 0);
    }

    const expiryPayoff    = prices.map(p => calcPnL(p, true));
    const currentPayoff   = prices.map(p => calcPnL(p, false));
    const putOI           = buildOIData(prices, false, ceMap, peMap);
    const callOI          = buildOIData(prices, true,  ceMap, peMap);
    putOIRef.current  = putOI;
    callOIRef.current = callOI;

    const maxPnL    = Math.max(...expiryPayoff, 0);
    const minPnL    = Math.min(...expiryPayoff, 0);
    const pnlMax    = Math.max(Math.abs(maxPnL), Math.abs(minPnL)) || 1000;
    const maxOI     = Math.max(...putOI, ...callOI, 0);
    const oiMax     = Math.ceil((maxOI * 1.2) / 5000) * 5000 || 5000;

    /* ── update existing chart in place (no destroy/recreate) ── */
    if (chartRef.current && chartRef.current.canvas === canvas) {
      const ch = chartRef.current;
      ch.data.labels              = prices as any;
      ch.data.datasets[0].data   = putOI as any;
      ch.data.datasets[1].data   = callOI as any;
      ch.data.datasets[2].data   = expiryPayoff as any;
      ch.data.datasets[3].data   = currentPayoff as any;
      (ch.options.scales as any).yPnL.min = -pnlMax;
      (ch.options.scales as any).yPnL.max =  pnlMax;
      (ch.options.scales as any).yOI.min  = -oiMax;
      (ch.options.scales as any).yOI.max  =  oiMax;
      ch.update("none");
      setPayoffAtSpot(calcPnL(spotPrice || S, false));
      requestAnimationFrame(() => {
        const a = chartRef.current?.chartArea;
        if (a) {
          const v={top:a.top,bottom:a.bottom,left:a.left,right:a.right};
          syncChartArea(v);
        }
      });
      return;
    }

    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    chartRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: prices,
        datasets: [
          {
            type: "bar" as const,
            label: "Put OI",
            data: putOI,
            backgroundColor: "rgba(16,185,129,0.7)",
            borderWidth: 0,
            yAxisID: "yOI",
            order: 4,
            barPercentage: 6,
            categoryPercentage: 1,
          },
          {
            type: "bar" as const,
            label: "Call OI",
            data: callOI,
            backgroundColor: "rgba(239,68,68,0.7)",
            borderWidth: 0,
            yAxisID: "yOI",
            order: 3,
            barPercentage: 6,
            categoryPercentage: 1,
          },
          {
            type: "line" as const,
            label: "Expiry Payoff",
            data: expiryPayoff,
            borderColor: "rgba(16,185,129,1)",
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 5,
            fill: { target: "origin", above: "rgba(16,185,129,0.15)", below: "#fff3f4" },
            segment: {
              borderColor: (ctx2: any) => {
                const y0 = ctx2.p0.parsed.y, y1 = ctx2.p1.parsed.y;
                if (y0 >= 0 && y1 >= 0) return "rgba(16,185,129,1)";
                if (y0 < 0  && y1 < 0)  return "#c85a5a";
                return (y0 + y1) / 2 >= 0 ? "rgba(16,185,129,1)" : "#c85a5a";
              },
            },
            tension: 0.1,
            yAxisID: "yPnL",
            order: 2,
          },
          {
            type: "line" as const,
            label: "Current Day Payoff",
            data: currentPayoff,
            borderColor: "#006ce6",
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 5,
            fill: false as any,
            tension: 0.1,
            yAxisID: "yPnL",
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: i => `Spot: ₹${Number(i[0].label).toLocaleString("en-IN")}`,
              label: i => {
                if (i.datasetIndex <= 1) return `${i.dataset.label}: ${Math.round(i.parsed.y ?? 0).toLocaleString()}`;
                return `${i.dataset.label}: ₹${Math.round(i.parsed.y ?? 0).toLocaleString("en-IN")}`;
              },
            },
          },
        },
        scales: {
          x: {
            offset: true,
            grid: { display: true, color: "rgba(0,0,0,0.05)" },
            ticks: {
              callback(this: any, value: any) {
                const price = Number(this.getLabelForValue(value));
                return price % 100 === 0 ? price : "";
              },
              color: "#6b7280", font: { size: 11 },
            },
            border: { display: false },
          },
          yPnL: {
            type: "linear", position: "left" as const,
            min: -pnlMax, max: pnlMax,
            title: { display: true, text: "Profit / Loss", color: "#6b7280", font: { size: 12, weight: 500 } },
            grid: {
              display: true,
              color: (ctx2: any) => ctx2.tick.value === 0 ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.05)",
              lineWidth: (ctx2: any) => ctx2.tick.value === 0 ? 2 : 1,
            },
            ticks: { callback: (v: any) => Number(v).toLocaleString(), color: "#6b7280", font: { size: 11 } },
            border: { display: false },
          },
          yOI: {
            type: "linear", position: "right" as const,
            min: -oiMax, max: oiMax,
            title: { display: true, text: "Open Interest", color: "#6b7280", font: { size: 12, weight: 500 } },
            grid: { display: false },
            ticks: {
              callback: (v: any) => { const a = Math.abs(Number(v)); if (!a) return "0"; if (a >= 10000) return `${(a/10000).toFixed(0)}Cr`; return a.toLocaleString(); },
              color: "#6b7280", font: { size: 11 },
            },
            border: { display: false },
          },
        },
      },
    });

    setPayoffAtSpot(calcPnL(spotPrice || S, false));
    requestAnimationFrame(() => {
      chartRef.current?.resize();
      chartRef.current?.update("none");
      const a = chartRef.current?.chartArea;
      if (a) {
        const v={top:a.top,bottom:a.bottom,left:a.left,right:a.right};
        syncChartArea(v);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLegs, legs, spotPrice, useExpiryQuery, valuationTs]);

  /* ── OI-only live update — runs on every chain refresh, no chart rebuild ── */
  useEffect(() => {
    const chart = chartRef.current;
    const priceRange = pnlPriceRangeRef.current;
    if (!chart || !priceRange.length) return;
    const putOI  = buildOIData(priceRange, false, ceMap, peMap);
    const callOI = buildOIData(priceRange, true,  ceMap, peMap);
    putOIRef.current  = putOI;
    callOIRef.current = callOI;
    const maxOI = Math.max(...putOI, ...callOI, 0);
    const oiMax = Math.ceil((maxOI * 1.2) / 5000) * 5000 || 5000;
    chart.data.datasets[0].data = putOI as any;
    chart.data.datasets[1].data = callOI as any;
    (chart.options.scales as any).yOI.min = -oiMax;
    (chart.options.scales as any).yOI.max =  oiMax;
    chart.update("none");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, selExpiry]);

  /* ── ResizeObserver for chart wrapper ── */
  useEffect(() => {
    const wrapper = chartWrapperRef.current;
    if (!wrapper || typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(() => {
      chartRef.current?.resize();
      chartRef.current?.update("none");
      const a = chartRef.current?.chartArea;
      if (a) {
        const v={top:a.top,bottom:a.bottom,left:a.left,right:a.right};
        syncChartArea(v);
      }
    });
    obs.observe(wrapper);
    return () => obs.disconnect();
  }, []);

  /* ── Sync slMarkerPrice when slCondition changes while panel is open ── */
  useEffect(() => {
    if (!slMode) return;
    const existing = slCondition === ">=" ? slSavedUpper : slSavedLower;
    setSlMarkerPrice(existing?.price ?? null);
  }, [slCondition, slMode, slSavedLower, slSavedUpper]);

  /* ── Canvas mouse handlers: SL mode click/hover + chart destroy cleanup ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!slMode) return;
      const area = chartAreaRef.current;
      if (!area) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < area.left || x > area.right) { setSlHoverPrice(null); return; }
      setSlHoverPrice(xToPrice(x));
    };

    const onClick = (e: MouseEvent) => {
      if (!slMode) return;
      const area = chartAreaRef.current;
      if (!area) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < area.left || x > area.right) return;
      setSlMarkerPrice(xToPrice(x));
    };

    const onMouseLeave = () => { if (slMode) setSlHoverPrice(null); };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("mouseleave", onMouseLeave);
    return () => {
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("mouseleave", onMouseLeave);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slMode]);

  const strikeDrpOpts=[...Array.from({length:30},(_,i)=>`OTM${30-i}`),"ATM",...Array.from({length:30},(_,i)=>`ITM${i+1}`)];
  /* ── priceToX: same logic as AnalyseView ── */
  function priceToX(price: number): number | null {
    const area  = chartAreaRef.current;
    const range = pnlPriceRangeRef.current;
    if (!area || !range.length) return null;
    let best = -1, bestDiff = Infinity;
    range.forEach((v, i) => { const d = Math.abs(v - price); if (d < bestDiff) { bestDiff = d; best = i; } });
    if (best < 0) return null;
    return area.left + (best / (range.length - 1)) * (area.right - area.left);
  }

  function xToPrice(x: number): number | null {
    const area  = chartAreaRef.current;
    const range = pnlPriceRangeRef.current;
    if (!area || !range.length) return null;
    const ratio = Math.max(0, Math.min(1, (x - area.left) / (area.right - area.left)));
    return range[Math.round(ratio * (range.length - 1))] ?? null;
  }

  function fmtCurrency(value: number, digits = 0): string {
    const sign = value < 0 ? "-" : "";
    return `${sign}₹${Math.abs(value).toLocaleString("en-IN", { maximumFractionDigits: digits })}`;
  }

  function removeStoploss(side: "upper" | "lower") {
    if (side === "upper") setSlSavedUpper(null);
    else setSlSavedLower(null);
  }

  function renderPriceLabel(price: number) {
    const pts = Math.round(price - spotPrice);
    const pct = ((price - spotPrice) / (spotPrice || 1)) * 100;
    return (
      <>
        <span className="sl-lbl-price">₹{price.toLocaleString("en-IN")}</span>
        <span className="sl-lbl-dist">{pts >= 0 ? "+" : ""}{pts} pts ({pct >= 0 ? "+" : ""}{pct.toFixed(2)}%)</span>
      </>
    );
  }

  const spotX       = priceToX(spotPrice);
  const spotVisible = spotX != null && chartArea != null && spotPrice > 0;
  const isLoss      = payoffAtSpot < 0;
  const isCreatingNewPortfolio = selectedPortfolio === CREATE_NEW_PORTFOLIO;
  const isEditingExistingStrategy = Boolean(initialStrategyId);
  const allLegsSelected = legs.length > 0 && selectedLegIds.length === legs.length;

  /* ── SL computed ── */
  const activeSlPrice   = slMarkerPrice ?? slHoverPrice;
  const editingSlPrice  = slMode ? (slMarkerPrice ?? slHoverPrice) : null;
  const editingSlX      = editingSlPrice == null ? null : priceToX(editingSlPrice);
  // actual P&L at SL price from chart range
  function calcPnLAtPrice(price: number): number {
    const range = pnlPriceRangeRef.current;
    const chart = chartRef.current;
    if (!range.length || !chart) return 0;
    let best = -1, bestDiff = Infinity;
    range.forEach((v, i) => { const d = Math.abs(v - price); if (d < bestDiff) { bestDiff = d; best = i; } });
    if (best < 0) return 0;
    return (chart.data.datasets[2]?.data[best] as number) ?? 0;
  }
  const slPnlAtPrice = activeSlPrice == null ? null : calcPnLAtPrice(activeSlPrice);
  const slPnlIsProfit = slPnlAtPrice != null && slPnlAtPrice >= 0;

  async function handleOpenSaveModal(mode: "create" | "update" = "create") {
    setSaveModalMode(mode);
    setSaveModalOpen(true);
    setSaveError(null);
    setNewPortfolioName("");
    if (mode === "update") {
      setStrategyName(loadedStrategyMetaRef.current.strategyName);
    }

    if (!legs.length) {
      setPortfolioOptions([{ label: "+ Create New Portfolio", value: CREATE_NEW_PORTFOLIO }]);
      if (mode === "create") setSelectedPortfolio(CREATE_NEW_PORTFOLIO);
      setSaveError("Add at least one position before saving.");
      return;
    }

    setPortfolioLoading(true);
    try {
      const response = await fetch(`${PAPER_TRADE_API_BASE}/portfolios`);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String((data as { detail?: unknown })?.detail || "Failed to load portfolios"));
      }
      const options = [{ label: "+ Create New Portfolio", value: CREATE_NEW_PORTFOLIO }, ...normalizePortfolioOptions(data)];
      setPortfolioOptions(options);
      setSelectedPortfolio((current) => {
        if (mode === "update") {
          const loadedPortfolioName = loadedStrategyMetaRef.current.portfolioName;
          if (loadedPortfolioName && options.some((item) => item.value === loadedPortfolioName)) return loadedPortfolioName;
        }
        if (current && options.some((item) => item.value === current)) return current;
        return options[1]?.value ?? options[0].value;
      });
    } catch (error) {
      setPortfolioOptions([{ label: "+ Create New Portfolio", value: CREATE_NEW_PORTFOLIO }]);
      setSelectedPortfolio(CREATE_NEW_PORTFOLIO);
      setSaveError(error instanceof Error ? error.message : "Failed to load portfolios");
    } finally {
      setPortfolioLoading(false);
    }
  }

  function closeSaveModal() {
    if (portfolioSaveLoading) return;
    setSaveModalOpen(false);
    setSaveError(null);
  }

  function getPersistPayloadContext() {
    const resolvedPortfolioName = isCreatingNewPortfolio ? newPortfolioName.trim() : selectedPortfolio;
    const trimmedStrategyName = strategyName.trim();
    if (!resolvedPortfolioName) {
      return { error: isCreatingNewPortfolio ? "Please enter a portfolio name." : "Please select a portfolio." };
    }
    if (!selectedPortfolio) {
      return { error: "Please select a portfolio." };
    }
    if (!trimmedStrategyName) {
      return { error: "Please enter a strategy name." };
    }
    if (!legs.length) {
      return { error: "No positions available to save." };
    }
    return { resolvedPortfolioName, trimmedStrategyName };
  }

  function buildStrategyPayload(resolvedPortfolioName: string, trimmedStrategyName: string) {
    return {
      portfolio_name: resolvedPortfolioName,
      strategy_name: trimmedStrategyName,
      instrument: inst.toLowerCase(),
      spot_price: Number(spotPrice || 0),
      config: {
        stopLoss: {
          enabled: slOn,
          unit: slUnit,
          value: Number(slVal) || 0,
        },
        target: {
          enabled: tgtOn,
          unit: tgtUnit,
          value: Number(tgtVal) || 0,
        },
        trailingStop: {
          enabled: tslOn,
          unit: tslUnit,
          x: Number(tslX) || 0,
          y: Number(tslY) || 0,
        },
        timeControl: {
          enabled: tcOn,
          entryTime: enTime,
          exitTime: exTime,
        },
        lots,
        trading_mode: tMode,
        reentry_interval: 0,
        expiryType: inferExpiryType(selExpiry, chain?.expiries ?? []),
        strikeType: {
          enabled: stOn,
          mode: stMode,
          value: typeof stVal === "number" ? stVal : 0,
          strike: stDrop,
        },
        sl_upper: slSavedUpper ? Number(slSavedUpper.price) || null : null,
        sl_lower: slSavedLower ? Number(slSavedLower.price) || null : null,
      },
      positions: legs.map((leg) => {
        const liveLtp = getLiveLtp(leg);
        const pnl = (leg.side === "S" ? leg.entry - liveLtp : liveLtp - leg.entry) * leg.qty;
        const pnlPct = leg.entry > 0 ? Math.abs(pnl / (leg.entry * leg.qty)) * 100 : 0;
        const isExited = Boolean(leg.exited);
        return {
          type: leg.side === "S" ? "Sell" : "Buy",
          option_type: leg.optionType === "CE" ? "Call" : "Put",
          strike: leg.strike,
          expiry: leg.expiry,
          entry_price: Number(leg.entry.toFixed(2)),
          entry_time: leg.entryTime || leg.date.replace(" ", "T"),
          lots: leg.lots,
          lot_size: lotSize,
          quantity: leg.qty,
          exited: isExited,
          exit_price: isExited ? (leg.exitPrice ?? Number(liveLtp.toFixed(2))) : null,
          exit_time: isExited ? (leg.exitTime ?? toLocalIso(now)) : null,
          pnl: isExited ? Number(pnl.toFixed(2)) : null,
          pnl_pct: isExited ? Number(pnlPct.toFixed(2)) : null,
        };
      }),
    };
  }

  async function persistStrategy(mode: "create" | "update") {
    const payloadContext = getPersistPayloadContext();
    if ("error" in payloadContext) {
      const message = payloadContext.error;
      if (mode === "create") setSaveError(message ?? null);
      else setPersistBanner({ type: "error", message: message ?? "" });
      return false;
    }

    if (mode === "update" && !initialStrategyId) {
      setPersistBanner({ type: "error", message: "Strategy ID is missing in the URL." });
      return false;
    }

    const payload = buildStrategyPayload(payloadContext.resolvedPortfolioName, payloadContext.trimmedStrategyName);
    const previousMeta = loadedStrategyMetaRef.current;
    const metadataChanged =
      mode === "update" &&
      (
        previousMeta.portfolioName !== payloadContext.resolvedPortfolioName ||
        previousMeta.strategyName !== payloadContext.trimmedStrategyName
      );

    setPortfolioSaveLoading(true);
    setSaveError(null);
    setPersistBanner(null);
    try {
      const endpoint = mode === "update"
        ? `${PAPER_TRADE_API_BASE}/strategies/${encodeURIComponent(initialStrategyId)}`
        : `${PAPER_TRADE_API_BASE}/strategies`;
      const response = await fetch(endpoint, {
        method: mode === "update" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.status === "error") {
        throw new Error(String((data as { detail?: unknown; message?: unknown })?.detail || (data as { message?: unknown })?.message || `Failed to ${mode} strategy`));
      }
      if (mode === "create") {
        setSaveModalOpen(false);
        setNewPortfolioName("");
        setStrategyName("");
        setSaveError(null);
      } else {
        loadedStrategyMetaRef.current = {
          portfolioName: payloadContext.resolvedPortfolioName,
          strategyName: payloadContext.trimmedStrategyName,
        };
        setSelectedPortfolio(payloadContext.resolvedPortfolioName);
        setStrategyName(payloadContext.trimmedStrategyName);
        setSaveModalOpen(false);
        setPersistBanner({ type: "success", message: "Strategy updated successfully." });
        if (metadataChanged && initialStrategyId) {
          onStrategyMetadataChanged?.({
            strategyId: initialStrategyId,
            previousPortfolioName: previousMeta.portfolioName,
            nextPortfolioName: payloadContext.resolvedPortfolioName,
            previousStrategyName: previousMeta.strategyName,
            nextStrategyName: payloadContext.trimmedStrategyName,
          });
        }
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to ${mode} strategy`;
      if (mode === "create") setSaveError(message);
      else setPersistBanner({ type: "error", message });
      return false;
    } finally {
      setPortfolioSaveLoading(false);
    }
  }

  async function handleSaveStrategy() {
    await persistStrategy("create");
  }

  async function handleUpdateStrategy() {
    await persistStrategy("update");
  }

  /* ───────────────────────────────── RENDER ─────────────────────────────── */
  return (
    <>
      <style>{TCP_CSS}</style>
      <style>{SCOPED_CSS}</style>

      {/* ── Config Bar ─────────────────────────────────────────────── */}
      {!isEmbedMode && (
        <div className="pt-cfg-bar" style={{ margin:"0 -24px" }}>
          <div className="pt-cfg-left" ref={instRef}>
            <button className="pt-cfg-inst-btn" onClick={()=>setInstOpen(o=>!o)}>
              {inst}
              <svg width="9" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            {instOpen && (
              <ul className="pt-cfg-inst-menu">
                {INSTRUMENTS.map(i=>(
                  <li key={i} className={i===inst?"sel":""} onClick={()=>{setInst(i);setInstOpen(false);}}>{i}</li>
                ))}
              </ul>
            )}
            <div style={{display:"flex",gap:6}}>
              {(["index","stock"] as const).map(t=>(
                <label key={t} className={`pt-cfg-radio${instrType===t?" on":""}`}>
                  <input type="radio" name="pt-itype" checked={instrType===t} onChange={()=>setInstrType(t)} style={{marginRight:3}}/>
                  {t==="index"?"Index":"Stock"}
                </label>
              ))}
            </div>
          </div>
          <div className="pt-cfg-compact">
            <div className="pt-cfg-center">
              <button className="pt-cfg-goback">↩ Go Back</button>
              <span className="pt-cfg-datelbl">{now.toLocaleDateString("en-IN",{weekday:"short",day:"2-digit",month:"short",year:"numeric"})}</span>
              <span className="pt-cfg-timelbl">{now.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false})}</span>
              <select className="pt-cfg-refsel" value={refresh} onChange={e=>setRefresh(Number(e.target.value))}>
                {REFRESH_OPTS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              {refresh>0&&countdown>0&&<span className="pt-cfg-countdown">↻ {countdown}s</span>}
              {lastUpd&&<span style={{fontSize:10,color:"#94a3b8",marginLeft:4}}>Updated: {lastUpd.toLocaleTimeString()}</span>}
            </div>
            <div className="pt-cfg-right">
              <span className="pt-cfg-broker-hint">For Live Zerodha / Upstox Trading</span>
              <button className="pt-cfg-connect">Connect Broker ▼</button>
              <button className="pt-cfg-snap" title="Snapshot">📷</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TCP Bar ────────────────────────────────────────────────── */}
      <div className="pt-tcp-bar" style={{margin:isEmbedMode ? "0" : "0 -24px"}}>
        <div className="pt-tcp-row">
          {/* Lots */}
          <div className="pt-tcp-card">
            <span className="pt-tcp-t">Lots</span>
            <div className="pt-tcp-body">
              <select className="pt-tcp-sel" style={{width:80}} value={lots} onChange={e=>setLots(Number(e.target.value))}>
                {Array.from({length:50},(_,i)=>i+1).map(n=><option key={n} value={n}>{n} {n===1?"Lot":"Lots"}</option>)}
              </select>
            </div>
          </div>
          {/* Trade Mode */}
          <div className="pt-tcp-card">
            <span className="pt-tcp-t">Trading Mode</span>
            <div className="pt-tcp-body">
              <select className="pt-tcp-sel" style={{minWidth:158}} value={tMode} onChange={e=>{setTMode(e.target.value as TradeMode);setPaused(false);}}>
                <option value="manual">Manual Trade</option>
                <option value="semi_auto">Semi Automatic Trade</option>
                <option value="auto">Automatic Trade</option>
              </select>
              {tMode==="semi_auto"&&<button className={`pt-pause-btn${paused?" on":""}`} onClick={()=>setPaused(p=>!p)}>{paused?"Continue":"Pause"}</button>}
            </div>
          </div>
          {/* SL */}
          <div className="pt-tcp-card">
            <div className="pt-tcp-hdr"><Tog checked={slOn} onChange={setSlOn}/><span className="pt-tcp-t">Stop Loss</span></div>
            <div className="pt-tcp-body">
              <select className="pt-tcp-sel" style={{minWidth:96}} disabled={!slOn} value={slUnit} onChange={e=>setSlUnit(e.target.value as SlUnit)}><option value="points">Points</option><option value="pct">Percentage</option></select>
              <input type="number" className="pt-tcp-num" disabled={!slOn} value={slVal} min={0} onChange={e=>setSlVal(Number(e.target.value))}/>
            </div>
          </div>
          {/* Target */}
          <div className="pt-tcp-card">
            <div className="pt-tcp-hdr"><Tog checked={tgtOn} onChange={setTgtOn}/><span className="pt-tcp-t">Target</span></div>
            <div className="pt-tcp-body">
              <select className="pt-tcp-sel" style={{minWidth:96}} disabled={!tgtOn} value={tgtUnit} onChange={e=>setTgtUnit(e.target.value as SlUnit)}><option value="points">Points</option><option value="pct">Percentage</option></select>
              <input type="number" className="pt-tcp-num" disabled={!tgtOn} value={tgtVal} min={0} onChange={e=>setTgtVal(Number(e.target.value))}/>
            </div>
          </div>
          {/* Trail SL */}
          <div className="pt-tcp-card">
            <div className="pt-tcp-hdr"><Tog checked={tslOn} onChange={setTslOn}/><span className="pt-tcp-t">Trail SL</span></div>
            <div className="pt-tcp-body">
              <select className="pt-tcp-sel" style={{width:76}} disabled={!tslOn} value={tslUnit} onChange={e=>setTslUnit(e.target.value as SlUnit)}><option value="points">Points</option><option value="pct">Pct</option></select>
              <span className="pt-tcp-xy">X</span><input type="number" className="pt-tcp-num" disabled={!tslOn} value={tslX} min={0} onChange={e=>setTslX(Number(e.target.value))}/>
              <span className="pt-tcp-xy">Y</span><input type="number" className="pt-tcp-num" disabled={!tslOn} value={tslY} min={0} onChange={e=>setTslY(Number(e.target.value))}/>
            </div>
          </div>
          {/* Hedge Strike */}
          <div className="pt-tcp-card">
            <div className="pt-tcp-hdr"><Tog checked={stOn} onChange={setStOn}/><span className="pt-tcp-t">Hedge Strike Type</span></div>
            <div className="pt-tcp-body">
              <select className="pt-tcp-sel" style={{minWidth:134}} disabled={!stOn} value={stMode} onChange={e=>setStMode(e.target.value as StrikeMode)}>
                <option value="delta">Delta</option><option value="closest_premium">Closest Premium</option><option value="strike">Strike</option>
              </select>
              {stMode!=="strike"
                ?<input type="number" className="pt-tcp-num" style={{width:68}} disabled={!stOn} placeholder={stMode==="delta"?"Delta":"Premium"} value={stVal} min={0} step={0.01} onChange={e=>setStVal(e.target.value===""?"":Number(e.target.value))}/>
                :<select className="pt-tcp-sel" style={{minWidth:100}} disabled={!stOn} value={stDrop} onChange={e=>setStDrop(e.target.value)}>{strikeDrpOpts.map(o=><option key={o} value={o}>{o.replace(/^OTM(\d+)$/,"OTM $1").replace(/^ITM(\d+)$/,"ITM $1")}</option>)}</select>
              }
            </div>
          </div>
          {/* Time Control */}
          <div className="pt-tcp-card">
            <div className="pt-tcp-hdr"><Tog checked={tcOn} onChange={setTcOn}/><span className="pt-tcp-t">Hedge Time Control</span></div>
            <div className="pt-tcp-body">
              <span style={{fontSize:10,fontWeight:700,color:"#64748b"}}>Entry</span>
              <input type="time" className="pt-tcp-time" disabled={!tcOn} value={enTime} onChange={e=>setEnTime(e.target.value)}/>
              <span style={{fontSize:10,fontWeight:700,color:"#64748b",marginLeft:4}}>Exit</span>
              <input type="time" className="pt-tcp-time" disabled={!tcOn} value={exTime} onChange={e=>setExTime(e.target.value)}/>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content — exact AnalyseView layout ─────────────── */}
      <div className={`pt-page${isEmbedMode ? " pt-embed" : ""}`} style={{padding:isEmbedMode ? "20px 12px 0" : "20px 0 0"}}>
        <div className="main-container">

          {/* ── Left: Option Chain Panel ── */}
          <div className="option-chain-panel">
            {/* Positions / OptionChain tabs */}
            <div className="left-panel-tabs">
              <button type="button" className={`left-panel-tab${leftTab==="Positions"?" active":""}`} onClick={()=>setLeftTab("Positions")}>Positions</button>
              <button type="button" className={`left-panel-tab${leftTab==="OptionChain"?" active":""}`} onClick={()=>setLeftTab("OptionChain")}>Option Chain</button>
            </div>

            {/* ── Option Chain tab ── */}
            {leftTab==="OptionChain" && (<>
              <div className="oc-header">
                <span className="oc-header-left">🗂 Add ons ▼</span>
                <span className="oc-title">
                  Option Chain
                  <span className="oc-expiry-label">{selExpiry?` (${fmtExpiry(selExpiry)})`:""}</span>
                  {ocLoading&&<span style={{fontSize:11,color:"#94a3b8",marginLeft:8}}>↻</span>}
                </span>
                <button className="oc-hide-btn" type="button">⟪ Hide</button>
              </div>

              {/* Expiry carousel */}
              <div className="expiry__viewer">
                <button type="button" className="expiry-carousel__arrow" disabled={carOff<=0} onClick={()=>setCarOff(o=>Math.max(0,o-OC_STEP))}>&#8249;</button>
                <div className="expiry-carousel__viewport">
                  <div className="expiry-carousel__track" style={{transform:`translateX(-${carOff}px)`}}>
                    {(chain?.expiries??[]).map((exp,i)=>(
                      <div key={exp} className={`expiry_button${exp===selExpiry?" selected__oc__expiry":""}`}
                        onClick={()=>{setSelExpiry(exp);setOcLoading(true);fetchChain(exp);}}>
                        <button type="button">{fmtExpiry(exp).toUpperCase()}</button>
                        <div className="expiry_indicator">{i===0?"(CW)":i===1?"(NW)":""}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <button type="button" className="expiry-carousel__arrow" disabled={carOff>=ocMaxOffset} onClick={()=>setCarOff(o=>Math.min(ocMaxOffset,o+OC_STEP))}>&#8250;</button>
              </div>

              {/* Filter row 1 */}
              <div className="oc_filter">
                <div>ATM IV:&nbsp;<span style={{color:"#464646",fontWeight:500}}>{atmIv}</span></div>
                <div>
                  <span style={{marginRight:6}}>ATM:</span>
                  <div className="squar__off__type">
                    {(["Spot","Fut","SynthFut"] as const).map(m=>(
                      <label key={m} className={`atm-radio-label${atmMode===m?" atm-radio-active":""}`} onClick={()=>setAtmMode(m)}>
                        <span className="atm-radio-dot"/><span className="atm-radio-title">{m==="SynthFut"?"Synth Fut":m}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>Straddle Prem:&nbsp;<span style={{color:"#464646",fontWeight:500}}>{straddlePrem}</span></div>
              </div>

              {/* Filter row 2 */}
              <div className="oc_filter">
                <div>PCR:&nbsp;<span style={{color:"#464646",fontWeight:500}}>{pcr}</span></div>
                <div className="total_oi">
                  <div className="total_call_oi">{fmtOI(totalCeOI)}</div>
                  <div className="oi-progress"><div className="oi-progress-call"/></div>
                  <span>OI</span>
                  <div className="oi-progress"><div className="oi-progress-put"/></div>
                  <div className="total_put_oi">{fmtOI(totalPeOI)}</div>
                </div>
                <div>Max Pain:&nbsp;<span style={{color:"#464646",fontWeight:500}}>{maxPain}</span></div>
              </div>

              {/* Error */}
              {ocError&&<div style={{padding:"8px 12px",color:"#ef4444",fontSize:12}}>⚠ {ocError}</div>}

              {/* Table */}
              <div className="oc-custom-table" ref={ocScrollRef}>
                <table>
                  <thead>
                    <tr>
                      <th className="oc-call-head">Call LTP <span className="oc-head-delta">(Δ)</span></th>
                      <th className="oc-call-oi-head">Call OI</th>
                      <th className="oc-iv-head">IV</th>
                      <th className="oc-strike-head">Strike</th>
                      <th className="oc-put-oi-head">Put OI</th>
                      <th className="oc-put-head">Put LTP <span className="oc-head-delta">(Δ)</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {strikes.map(strike=>{
                      const ce=ceMap[strike], pe=peMap[strike];
                      const isAtm=strike===atmStrike, isCallItm=strike<spotPrice, isPutItm=strike>spotPrice;
                      const avgIv=ce?.iv&&pe?.iv?(ce.iv+pe.iv)/2:(ce?.iv||pe?.iv||0);
                      const ceOIPct=`${maxCeOI>0&&ce?.oi?(ce.oi/maxCeOI*100).toFixed(1):0}%`;
                      const peOIPct=`${maxPeOI>0&&pe?.oi?(pe.oi/maxPeOI*100).toFixed(1):0}%`;
                      const activeOcLegs = slConfigOpen ? reverseConfigLegs : legs;
                      const match=(l:Leg,type:"CE"|"PE",side:"B"|"S")=>
                        !l.exited && l.strike===strike && l.optionType===type && l.side===side && l.expiry===selExpiry;
                      const bCe=activeOcLegs.some(l=>match(l,"CE","B"));
                      const sCe=activeOcLegs.some(l=>match(l,"CE","S"));
                      const bPe=activeOcLegs.some(l=>match(l,"PE","B"));
                      const sPe=activeOcLegs.some(l=>match(l,"PE","S"));
                      const isMenuOpen = (type:"CE"|"PE", side:"B"|"S") =>
                        ocActionMenu?.strike === strike && ocActionMenu?.type === type && ocActionMenu?.side === side;
                      let rowCls="oc-row";
                      if(isAtm) rowCls+=" oc-atm";
                      else if(isCallItm) rowCls+=" oc-call-itm";
                      else if(isPutItm) rowCls+=" oc-put-itm";
                      return (
                        <tr key={strike} className={rowCls} ref={isAtm?atmRowRef:undefined}>
                          {/* Call LTP */}
                          <td className="oc-call-td">
                            <div className="oc-cell-inner">
                              <div className={`oc-actions action_button${bCe||sCe?" has-active":""}`}>
                                <span className="oc-btn-wrap">
                                  <button type="button" className={`buy_button${bCe?" oc-btn-active":""}`} onClick={()=>handleOcActionClick(strike,"CE","B",bCe)}>B</button>
                                  {bCe&&<span className="oc-pos-count buy">{activeOcLegs.filter(l=>match(l,"CE","B")).length}</span>}
                                  {isMenuOpen("CE","B") && (
                                    <div className="oc-action-popover">
                                      <button type="button" className="add-option" onClick={()=>{ addLeg(strike,"CE","B"); setOcActionMenu(null); }}>
                                        <span className="menu-icon">+</span>
                                        <span>Add</span>
                                      </button>
                                      <button type="button" className="remove-option" onClick={()=>{ removeOpenLeg(strike,"CE","B"); setOcActionMenu(null); }}>
                                        <span className="menu-icon">-</span>
                                        <span>Remove</span>
                                      </button>
                                    </div>
                                  )}
                                </span>
                                <span className="oc-btn-wrap">
                                  <button type="button" className={`sell_button${sCe?" oc-btn-active":""}`} onClick={()=>handleOcActionClick(strike,"CE","S",sCe)}>S</button>
                                  {sCe&&<span className="oc-pos-count sell">{activeOcLegs.filter(l=>match(l,"CE","S")).length}</span>}
                                  {isMenuOpen("CE","S") && (
                                    <div className="oc-action-popover">
                                      <button type="button" className="add-option" onClick={()=>{ addLeg(strike,"CE","S"); setOcActionMenu(null); }}>
                                        <span className="menu-icon">+</span>
                                        <span>Add</span>
                                      </button>
                                      <button type="button" className="remove-option" onClick={()=>{ removeOpenLeg(strike,"CE","S"); setOcActionMenu(null); }}>
                                        <span className="menu-icon">-</span>
                                        <span>Remove</span>
                                      </button>
                                    </div>
                                  )}
                                </span>
                              </div>
                              {ce?(<><span className="oc-ltp">{ce.ltp.toFixed(2)}</span><span className="oc-delta">({ce.delta.toFixed(2)})</span></>):<span className="oc-empty">—</span>}
                            </div>
                          </td>
                          {/* Call OI */}
                          <td className="oc-call-oi-td">
                            <div className="oc-oi-value oc-oi-call">{fmtOI(ce?.oi??0)}</div>
                            <div className="oc-oi-bar-wrap"><div className="oc-oi-bar oc-oi-bar-call" style={{width:ceOIPct}}/></div>
                          </td>
                          {/* IV */}
                          <td className="oc-iv-td">
                            {avgIv?<span className="oc-iv-value">{avgIv.toFixed(2)}%</span>:<span className="oc-empty">—</span>}
                          </td>
                          {/* Strike */}
                          <td className="oc-strike-td">{strike}</td>
                          {/* Put OI */}
                          <td className="oc-put-oi-td">
                            <div className="oc-oi-value oc-oi-put">{fmtOI(pe?.oi??0)}</div>
                            <div className="oc-oi-bar-wrap"><div className="oc-oi-bar oc-oi-bar-put" style={{width:peOIPct}}/></div>
                          </td>
                          {/* Put LTP */}
                          <td className="oc-put-td">
                            <div className="oc-cell-inner">
                              {pe?(<><span className="oc-ltp">{pe.ltp.toFixed(2)}</span><span className="oc-delta">({pe.delta.toFixed(2)})</span></>):<span className="oc-empty">—</span>}
                              <div className={`oc-actions action_button${bPe||sPe?" has-active":""}`}>
                                <span className="oc-btn-wrap">
                                  <button type="button" className={`buy_button${bPe?" oc-btn-active":""}`} onClick={()=>handleOcActionClick(strike,"PE","B",bPe)}>B</button>
                                  {bPe&&<span className="oc-pos-count buy">{activeOcLegs.filter(l=>match(l,"PE","B")).length}</span>}
                                  {isMenuOpen("PE","B") && (
                                    <div className="oc-action-popover">
                                      <button type="button" className="add-option" onClick={()=>{ addLeg(strike,"PE","B"); setOcActionMenu(null); }}>
                                        <span className="menu-icon">+</span>
                                        <span>Add</span>
                                      </button>
                                      <button type="button" className="remove-option" onClick={()=>{ removeOpenLeg(strike,"PE","B"); setOcActionMenu(null); }}>
                                        <span className="menu-icon">-</span>
                                        <span>Remove</span>
                                      </button>
                                    </div>
                                  )}
                                </span>
                                <span className="oc-btn-wrap">
                                  <button type="button" className={`sell_button${sPe?" oc-btn-active":""}`} onClick={()=>handleOcActionClick(strike,"PE","S",sPe)}>S</button>
                                  {sPe&&<span className="oc-pos-count sell">{activeOcLegs.filter(l=>match(l,"PE","S")).length}</span>}
                                  {isMenuOpen("PE","S") && (
                                    <div className="oc-action-popover">
                                      <button type="button" className="add-option" onClick={()=>{ addLeg(strike,"PE","S"); setOcActionMenu(null); }}>
                                        <span className="menu-icon">+</span>
                                        <span>Add</span>
                                      </button>
                                      <button type="button" className="remove-option" onClick={()=>{ removeOpenLeg(strike,"PE","S"); setOcActionMenu(null); }}>
                                        <span className="menu-icon">-</span>
                                        <span>Remove</span>
                                      </button>
                                    </div>
                                  )}
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>)}

            {/* ── Positions tab ── */}
            {leftTab==="Positions" && (
              <div style={{flex:1,display:"flex",flexDirection:"column",overflowY:"hidden",overflowX:"auto"}}>
                <div className="pos-tabs">
                  {(["Positions","Greeks","TargetPnL"] as const).map(t=>(
                    <button key={t} type="button" className={`pos-tab${posTab===t?" active":""}`} onClick={()=>setPosTab(t)}>
                      {t==="TargetPnL"?"Target P&L (blue line)":t}
                    </button>
                  ))}
                  <div className="pos-tab-right">Add Notes&nbsp;&nbsp;|&nbsp;&nbsp;Add ons ▾</div>
                </div>
                {posTab==="Positions"&&(
                  <div className="position_table">
                    <table style={{width:"100%",minWidth:700,tableLayout:"fixed"}}>
                      <colgroup>
                        <col style={{width:72}}/><col style={{width:72}}/><col style={{width:"5%"}}/>
                        <col style={{width:90}}/><col style={{width:78}}/><col style={{width:80}}/>
                        <col style={{width:"8%"}}/><col style={{width:"8%"}}/><col style={{width:"6%"}}/>
                        <col style={{width:"13%"}}/><col style={{width:105}}/>
                      </colgroup>
                      <thead><tr className="sticky-top">
                        <th className="pos-first-col-head" style={{width:72}}>
                          <div className="action_button_group">
                            <label className="pos-select-wrap">
                              <input
                                type="checkbox"
                                className="pos-select-input"
                                checked={allLegsSelected}
                                onChange={(e) => setSelectedLegIds(e.target.checked ? legs.map((leg) => leg.id) : [])}
                              />
                              <span className="pos-select-box" />
                            </label>
                            <span style={{width:18,display:"inline-block"}} />
                          </div>
                        </th>
                        <th>Lots</th><th>Qty</th><th>Date ↕</th><th>Strike ◇</th>
                        <th>Expiry</th><th>Entry</th><th>LTP/Exit</th><th>Delta</th><th>P&amp;L</th><th>Lots Exit ◇</th>
                      </tr></thead>
                      <tbody>
                        {legs.length===0?(
                          <tr><td colSpan={11} className="pos-empty">No positions — click B or S on the option chain to add.</td></tr>
                        ):(
                          legs.map((leg,idx)=>{
                            const liveLtp = getLiveLtp(leg);
                            const pnl = getLegPnl(leg, liveLtp);
                            const pnlPct=leg.entry>0?Math.abs(pnl/(leg.entry*leg.qty))*100:0;
                            const pnlCls=pnl>=0?"simulator_green_text":"simulator_red_text";
                            const rowCls = leg.exited ? (pnl >= 0 ? "parent_position exited__profit" : "parent_position exited__loss") : "parent_position";
                            const exitButtonCls = leg.exited ? "pos-exit-btn exited" : "pos-exit-btn";
                            return (
                              <tr key={leg.id} className={rowCls}>
                                <td className="pos-first-col-cell">
                                  <div className="action_button_group">
                                    <label className="pos-select-wrap">
                                      <input
                                        type="checkbox"
                                        className="pos-select-input"
                                        checked={selectedLegIds.includes(leg.id)}
                                        onChange={(e) =>
                                          setSelectedLegIds((current) =>
                                            e.target.checked
                                              ? (current.includes(leg.id) ? current : [...current, leg.id])
                                              : current.filter((id) => id !== leg.id),
                                          )
                                        }
                                      />
                                      <span className="pos-select-box" />
                                    </label>
                                    <span className={leg.side==="B"?"pt-buy-btn":"pt-sell-btn"}>{leg.side}</span>
                                  </div>
                                </td>
                                <td>
                                  <div className="simulator_position_input position__strike">
                                    <button className="sign_btn" disabled={leg.exited} onClick={()=>updateLegLots(leg.id, leg.lots - 1)}>−</button>
                                    <input type="number" className="sim-input lot-input" value={leg.lots} min={1} disabled={leg.exited}
                                      onChange={e=>{const v=Math.max(1,parseInt(e.target.value)||1);updateLegLots(leg.id, v);}}/>
                                    <button className="sign_btn" disabled={leg.exited} onClick={()=>updateLegLots(leg.id, leg.lots + 1)}>+</button>
                                  </div>
                                </td>
                                <td>{leg.qty}</td>
                                <td><div style={{display:"flex",flexDirection:"column"}}><span>{leg.date}</span></div></td>
                                <td>
                                  <div className="position__strike">
                                    <span>{leg.strike}</span>
                                    <span className={leg.optionType==="CE"?"call-btn-pt":"put-btn-pt"}>{leg.optionType}</span>
                                  </div>
                                </td>
                                <td><div className="position__expiry">{fmtExpiry(leg.expiry)}</div></td>
                                <td><input type="number" step="any" className="sim-input" defaultValue={leg.entry.toFixed(2)} disabled={leg.exited} onBlur={e=>setLegs(p=>p.map((l,i)=>i===idx?{...l,entry:parseFloat(e.target.value)||l.entry}:l))}/></td>
                                <td><input type="number" step="any" className="sim-input" value={liveLtp.toFixed(2)} readOnly/></td>
                                <td style={{textAlign:"center"}}>{leg.exited ? "0.00" : leg.delta.toFixed(2)}</td>
                                <td className={pnlCls}>
                                  <div style={{whiteSpace:"nowrap"}}>
                                    <span>{pnl<0?"-":""}₹{Math.abs(pnl).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                                    <span className={`expiry_indicator ${pnlCls}`}> ({pnlPct.toFixed(0)}%)</span>
                                  </div>
                                </td>
                                <td>
                                  <div className="simulator_position_button">
                                    <select className="lot_select_space" disabled={leg.exited}>
                                      {Array.from({length:leg.lots},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}
                                    </select>
                                    <button type="button" className={exitButtonCls} title={leg.exited ? "Reopen" : "Exit"} onClick={()=>leg.exited ? reopenLeg(idx) : exitLeg(idx)}>
                                      <img src={leg.exited ? "/images/algo/re_open.svg" : "/images/algo/exit.svg"} alt={leg.exited ? "Reopen" : "Exit"} className="pos-action-icon" />
                                    </button>
                                    <button type="button" className="pos-del-btn" title="Delete" onClick={()=>setLegs(p=>p.filter((_,i)=>i!==idx))}>
                                      <svg className="pos-del-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                        <path
                                          fillRule="evenodd"
                                          clipRule="evenodd"
                                          d="M6.54142 3.7915C6.54142 2.54886 7.54878 1.5415 8.79142 1.5415H11.2081C12.4507 1.5415 13.4581 2.54886 13.4581 3.7915V4.0415H15.6252H16.666C17.0802 4.0415 17.416 4.37729 17.416 4.7915C17.416 5.20572 17.0802 5.5415 16.666 5.5415H16.3752V8.24638V13.2464V16.2082C16.3752 17.4508 15.3678 18.4582 14.1252 18.4582H5.87516C4.63252 18.4582 3.62516 17.4508 3.62516 16.2082V13.2464V8.24638V5.5415H3.3335C2.91928 5.5415 2.5835 5.20572 2.5835 4.7915C2.5835 4.37729 2.91928 4.0415 3.3335 4.0415H4.37516H6.54142V3.7915ZM14.8752 13.2464V8.24638V5.5415H13.4581H12.7081H7.29142H6.54142H5.12516V8.24638V13.2464V16.2082C5.12516 16.6224 5.46095 16.9582 5.87516 16.9582H14.1252C14.5394 16.9582 14.8752 16.6224 14.8752 16.2082V13.2464ZM8.04142 4.0415H11.9581V3.7915C11.9581 3.37729 11.6223 3.0415 11.2081 3.0415H8.79142C8.37721 3.0415 8.04142 3.37729 8.04142 3.7915V4.0415ZM8.3335 7.99984C8.74771 7.99984 9.0835 8.33562 9.0835 8.74984V13.7498C9.0835 14.1641 8.74771 14.4998 8.3335 14.4998C7.91928 14.4998 7.5835 14.1641 7.5835 13.7498V8.74984C7.5835 8.33562 7.91928 7.99984 8.3335 7.99984ZM12.4168 8.74984C12.4168 8.33562 12.081 7.99984 11.6668 7.99984C11.2526 7.99984 10.9168 8.33562 10.9168 8.74984V13.7498C10.9168 14.1641 11.2526 14.4998 11.6668 14.4998C12.081 14.4998 12.4168 14.1641 12.4168 13.7498V8.74984Z"
                                          fill="currentColor"
                                        />
                                      </svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="table_footer">
                          <th colSpan={8} style={{textAlign:"left"}}>
                            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                              <span style={{marginLeft:4}}>Multiplier:</span>
                              <div className="simulator_group_input">
                                <button type="button" className="sign_button" disabled={multiplier<=1} onClick={()=>setMultiplier(m=>Math.max(1,m-1))}>−</button>
                                <input className="mult_input" type="number" value={multiplier} min={1} onChange={e=>setMultiplier(Math.max(1,parseInt(e.target.value)||1))}/>
                                <button type="button" className="sign_button" onClick={()=>setMultiplier(m=>m+1)}>+</button>
                              </div>
                              <span style={{color:"#6b7280",marginLeft:4}}>Lot Size: {lotSize}</span>
                              <button type="button" className="btn-outline-xs" style={{marginLeft:4}}>Add Alert</button>
                              {!isEditingExistingStrategy && (
                                <button type="button" className="btn-outline-xs" onClick={() => handleOpenSaveModal("create")}>Save</button>
                              )}
                              {isEditingExistingStrategy && (
                                <button
                                  type="button"
                                  className="btn-outline-xs"
                                  onClick={() => handleOpenSaveModal("update")}
                                  disabled={portfolioSaveLoading}
                                >
                                  Update
                                </button>
                              )}
                              <button type="button" className="btn-outline-xs">Share</button>
                              {persistBanner && (
                                <span style={{ color: persistBanner.type === "error" ? "#dc2626" : "#16a34a", marginLeft: 4 }}>
                                  {persistBanner.message}
                                </span>
                              )}
                            </div>
                          </th>
                          <th style={{textAlign:"center",color:totalDelta>=0?"#03B760":"#EF6161"}}>{totalDelta.toFixed(2)}</th>
                          <th className={totalPnL>=0?"simulator_green_text":"simulator_red_text"}>
                            {totalPnL<0?"-":""}₹{Math.abs(totalPnL).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}
                          </th>
                          <th>
                            <div className="simulator_position_button">
                              <a className="pos-exit-all" style={{cursor:"pointer"}} onClick={exitAllLegs}>Exit</a>
                              <a className="pos-clear-all" style={{cursor:"pointer"}} onClick={()=>setLegs([])}>Clear</a>
                            </div>
                          </th>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
                {posTab!=="Positions"&&(
                  <div style={{padding:24,textAlign:"center",color:"#94a3b8",fontSize:13}}>
                    {posTab==="Greeks"?"Greeks view coming soon…":"Target P&L chart coming soon…"}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Right: Chart + Stats + Positions ── */}
          <div
            className="chart-section"
            style={isEmbedMode ? { overflow: "visible" } : undefined}
          >
            <div
              className="simulator-card"
              style={isEmbedMode ? { height: "auto", overflow: "visible" } : undefined}
            >
              {/* Tab bar */}
              <div className="table-tabs-container">
                <ul className="table-tabs">
                  <li><a className="nav-link-sim active">Payoff Chart</a></li>
                  <li><a className="nav-link-sim">MTM 📈</a></li>
                  <li><a className="nav-link-sim">Strategy 📈</a></li>
                  <li><a className="nav-link-sim">OI 📈</a></li>
                  <li style={{marginLeft:"auto"}}>
                    <div className="time-on-print">{now.toLocaleString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false})}</div>
                  </li>
                </ul>
              </div>
              {/* Stats row */}
              <div className="simulator-stats">
                <div><div>P&amp;L:</div><div className={`sim-stat-value${totalPnL>=0?" simulator_green_text":" simulator_red_text"}`}>{totalPnL<0?"-":""}₹{Math.abs(totalPnL).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
                <div><div>Net Credit:</div><div className={`sim-stat-value${netCredit>=0?" simulator_green_text":" simulator_red_text"}`}>{netCredit<0?"-":""}₹{Math.abs(netCredit).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
                <div><div>Net Δ:</div><div className="sim-stat-value" style={{color:totalDelta>=0?"#03B760":"#EF6161"}}>{totalDelta.toFixed(2)}</div></div>
                <div><div>Spot:</div><div className="sim-stat-value">{spotPrice?`₹${spotPrice.toLocaleString("en-IN",{minimumFractionDigits:2})}`:"—"}</div></div>
                <div><div>Instrument:</div><div className="sim-stat-value" style={{color:"#2563eb"}}>{inst}</div></div>
                <div><div>Expiry:</div><div className="sim-stat-value">{selExpiry?fmtExpiry(selExpiry):"—"}</div></div>
                <div><div>Lot Size:</div><div className="sim-stat-value">{lotSize}</div></div>
                <div className="breakeven-small"><div>Straddle:</div><div className="breakevan-box">{straddlePrem}</div></div>
                <div><div>India VIX:</div><div className="sim-stat-value" style={{color:chain?.india_vix&&chain.india_vix>20?"#EF6161":"#03B760"}}>{chain?.india_vix?chain.india_vix.toFixed(2):"—"}</div></div>
              </div>
              {/* Chart */}
              <div
                className="chart-body-wrap"
                style={isEmbedMode
                  ? { padding: "16px 20px 0", display: "flex", flexDirection: "column", overflow: "visible" }
                  : { padding: "16px 20px 0", flex: 1, display: "flex", flexDirection: "column" }}
              >
                <div className="chart-wrapper" ref={chartWrapperRef}>
                  <canvas ref={canvasRef}/>

                  {/* ── SL button ── */}
                  <button
                    className={`sl-config-btn${slMode ? " active" : ""}`}
                    onClick={() => {
                      if (slMode) {
                        setSlMode(false); setSlHoverPrice(null); setSlMarkerPrice(null);
                      } else {
                        const nextCond: StoplossCondition = !slSavedUpper && slSavedLower ? ">=" : "<=";
                        const existing = nextCond === ">=" ? slSavedUpper : slSavedLower;
                        setSlCondition(nextCond);
                        setSlMarkerPrice(existing?.price ?? null);
                        setSlHoverPrice(null);
                        setSlMode(true);
                      }
                    }}
                  >
                    {slMode ? "✕ Cancel" : "⚡ Stoploss"}
                  </button>

                  {/* ── SL hover line ── */}
                  {slMode && chartArea && slHoverPrice != null && priceToX(slHoverPrice) != null && (
                    <div className="sl-hover-line" style={{ display:"block", height: chartArea.bottom - chartArea.top, left: priceToX(slHoverPrice)!, top: chartArea.top }} />
                  )}

                  {/* ── SL editing marker + shade ── */}
                  {slMode && chartArea && editingSlPrice != null && editingSlX != null && (
                    <>
                      {slMarkerPrice != null && (
                        <div className="sl-marker-line" style={{ display:"block", height: chartArea.bottom - chartArea.top, left: priceToX(slMarkerPrice)!, top: chartArea.top }} />
                      )}
                      <div
                        className="sl-shade-region"
                        style={{
                          display:"block",
                          left: slCondition === "<=" ? chartArea.left : editingSlX,
                          top: chartArea.top,
                          width: slCondition === "<=" ? editingSlX - chartArea.left : chartArea.right - editingSlX,
                          height: chartArea.bottom - chartArea.top,
                          background: slCondition === ">=" ? "rgba(22,163,74,.10)" : "rgba(220,38,38,.10)",
                        }}
                      />
                    </>
                  )}

                  {/* ── Saved upper SL marker ── */}
                  {chartArea && slSavedUpper && priceToX(slSavedUpper.price) != null && (!slMode || slCondition !== ">=") && (
                    <>
                      <div className="sl-marker-line sl-marker-upper" style={{ display:"block", height: chartArea.bottom - chartArea.top, left: priceToX(slSavedUpper.price)!, top: chartArea.top }}>
                        <div className="sl-marker-label sl-label-upper">{renderPriceLabel(slSavedUpper.price)}</div>
                      </div>
                      <div className="sl-shade-region" style={{ display:"block", background:"rgba(22,163,74,.10)", left: priceToX(slSavedUpper.price)!, top: chartArea.top, width: chartArea.right - priceToX(slSavedUpper.price)!, height: chartArea.bottom - chartArea.top }} />
                    </>
                  )}

                  {/* ── Saved lower SL marker ── */}
                  {chartArea && slSavedLower && priceToX(slSavedLower.price) != null && (!slMode || slCondition !== "<=") && (
                    <>
                      <div className="sl-marker-line sl-marker-lower" style={{ display:"block", height: chartArea.bottom - chartArea.top, left: priceToX(slSavedLower.price)!, top: chartArea.top }}>
                        <div className="sl-marker-label sl-label-lower">{renderPriceLabel(slSavedLower.price)}</div>
                      </div>
                      <div className="sl-shade-region" style={{ display:"block", background:"rgba(220,38,38,.10)", left: chartArea.left, top: chartArea.top, width: priceToX(slSavedLower.price)! - chartArea.left, height: chartArea.bottom - chartArea.top }} />
                    </>
                  )}

                  {/* ── SL Config Panel (floating) ── */}
                  {slMode && (
                    <div
                      className="sl-config-panel"
                      style={{ display:"block", left: panelPosition.left ?? undefined, right: panelPosition.left == null ? 20 : "auto", top: panelPosition.top ?? 80 }}
                    >
                      <div
                        className="sl-panel-header"
                        onMouseDown={e => {
                          const rect = (e.currentTarget.parentElement as HTMLDivElement).getBoundingClientRect();
                          panelDragRef.current = { active:true, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
                          const onMove = (mv: MouseEvent) => {
                            if (!panelDragRef.current.active) return;
                            setPanelPosition({ left: Math.max(0, mv.clientX - panelDragRef.current.offsetX), top: Math.max(0, mv.clientY - panelDragRef.current.offsetY) });
                          };
                          const onUp = () => { panelDragRef.current.active = false; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
                          document.addEventListener("mousemove", onMove);
                          document.addEventListener("mouseup", onUp);
                        }}
                      >
                        <span className="sl-panel-title">⚡ Configure Stoploss</span>
                        <button className="sl-panel-close" onClick={() => setSlMode(false)}>×</button>
                      </div>
                      <div className="sl-panel-body">
                        <div className="sl-instruction">
                          {slMarkerPrice == null ? "Click on the chart to place stoploss level" : "Price set. Adjust or save."}
                        </div>
                        <div className="sl-panel-row">
                          <label>Trigger when {inst} goes</label>
                          <div className="sl-condition-row">
                            <select value={slCondition} onChange={e => setSlCondition(e.target.value as StoplossCondition)}>
                              <option value="<=">Below ≤</option>
                              <option value=">=">Above ≥</option>
                            </select>
                            <input type="number" placeholder="Price" step={50} value={slMarkerPrice ?? ""} onChange={e => setSlMarkerPrice(e.target.value ? Number(e.target.value) : null)} />
                          </div>
                        </div>
                        <div className="sl-panel-row">
                          <label>Current Spot</label>
                          <span className="sl-spot-value">₹{spotPrice.toLocaleString("en-IN", { maximumFractionDigits:2 })}</span>
                        </div>
                        <div className="sl-panel-row">
                          <div className="sl-diff-row">
                            <span>{activeSlPrice == null ? "— pts" : `${activeSlPrice - spotPrice >= 0 ? "+" : ""}${Math.round(activeSlPrice - spotPrice)} pts`}</span>
                            <span>{activeSlPrice == null ? "—%" : `${((activeSlPrice - spotPrice) / (spotPrice||1)) * 100 >= 0 ? "+" : ""}${(((activeSlPrice - spotPrice) / (spotPrice||1)) * 100).toFixed(2)}%`}</span>
                          </div>
                        </div>
                        <div className={`sl-pnl-box${slPnlIsProfit ? " profit" : ""}`}>
                          <div className="sl-pnl-label">Approx P&amp;L at exit</div>
                          <div className={`sl-pnl-value${slPnlIsProfit ? " profit" : ""}`}>{slPnlAtPrice == null ? "—" : fmtCurrency(slPnlAtPrice)}</div>
                        </div>
                        <div className="sl-panel-actions">
                          <button className="sl-cancel-btn" onClick={() => setSlMode(false)}>Cancel</button>
                          <button
                            className="sl-save-btn"
                            disabled={slMarkerPrice == null}
                            onClick={() => {
                              if (slMarkerPrice == null) return;
                              const entry = { condition: slCondition, price: slMarkerPrice };
                              if (slCondition === ">=") setSlSavedUpper(entry); else setSlSavedLower(entry);
                              setSlMode(false);
                            }}
                          >Save</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Spot price vertical line — same as AnalyseView ── */}
                  {spotVisible && chartArea && (
                    <>
                      <div
                        className={`spot-line${isLoss ? " loss" : " profit"}`}
                        style={{ left: spotX!, top: chartArea.top, height: chartArea.bottom - chartArea.top }}
                      />
                      <div
                        className="spot-price-label"
                        style={{ left: spotX!, top: chartArea.top + 4 }}
                      >
                        ₹{spotPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>

                      {/* ── Projected P&L badge at bottom of chart ── */}
                      {legs.length > 0 && (() => {
                        const sign  = payoffAtSpot >= 0 ? "+" : "";
                        const label = isLoss ? "Projected loss" : "Projected profit";
                        const netPremium = activeLegs.reduce((s, l) => s + l.entry * l.qty, 0) || 1;
                        const pct = ((payoffAtSpot / netPremium) * 100).toFixed(3);
                        return (
                          <div
                            className={`floating-pnl${isLoss ? " loss-bg" : " profit-bg"}`}
                            style={{ left: spotX! }}
                          >
                            <span>{label}: {sign}{payoffAtSpot.toFixed(2)} ({sign}{pct}%)</span>
                            <span style={{ opacity: 0.75 }}>ⓘ</span>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>

                {/* ── SL saved bar ── */}
                {(slSavedUpper || slSavedLower) && (
                  <>
                    <div className="sl-saved-bar">
                      <span>SL:</span>
                      {slSavedUpper && (
                        <span>
                          Above ≥ ₹{slSavedUpper.price.toLocaleString("en-IN")}{" "}
                          <span>({fmtCurrency(calcPnLAtPrice(slSavedUpper.price))})</span>{" "}
                          <button className="sl-remove-link" onClick={() => removeStoploss("upper")}>remove</button>
                        </span>
                      )}
                      {slSavedUpper && slSavedLower && <span>|</span>}
                      {slSavedLower && (
                        <span>
                          Below ≤ ₹{slSavedLower.price.toLocaleString("en-IN")}{" "}
                          <span>({fmtCurrency(calcPnLAtPrice(slSavedLower.price))})</span>{" "}
                          <button className="sl-remove-link" onClick={() => removeStoploss("lower")}>remove</button>
                        </span>
                      )}
                      <button
                        className="sl-config-link"
                        onClick={() => {
                          if (slConfigOpen) closeReverseConfigPreview();
                          else openReverseConfigPreview();
                        }}
                      >
                        {slConfigOpen ? "Close Config" : "Config"}
                      </button>
                      <button className="sl-saved-edit" onClick={() => setSlMode(true)}>Edit</button>
                    </div>
                  </>
                )}

                <div className="payoff-bottom">
                  P&amp;L at spot:&nbsp;
                  <span style={{color:totalPnL>=0?"#10b981":"#ef4444",fontWeight:800}}>
                    {totalPnL<0?"-":""}₹{Math.abs(totalPnL).toLocaleString("en-IN",{minimumFractionDigits:2})}
                  </span>
                </div>
              </div>
            </div>
            {reversePositionsPreview}
          </div>

        </div>
      </div>

      <Modal isOpen={saveModalOpen} onClose={closeSaveModal} className="m-4 max-w-[460px] overflow-hidden p-0" showCloseButton={false}>
        <div className="bg-[#4db0ca] px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <h3 className="text-[28px] font-semibold leading-none">{saveModalMode === "update" ? "Update Strategy" : "Save Portfolio"}</h3>
            <button
              type="button"
              className="text-[28px] leading-none text-white/90 hover:text-white"
              onClick={closeSaveModal}
              disabled={portfolioSaveLoading}
            >
              ×
            </button>
          </div>
        </div>
        <div className="bg-white px-6 py-7">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#444]">Select Portfolio:</label>
              <select
                className="h-[42px] w-full rounded border border-[#d5d5d5] px-4 text-sm text-[#222] outline-none"
                value={selectedPortfolio}
                onChange={(e) => setSelectedPortfolio(e.target.value)}
                disabled={portfolioLoading || portfolioSaveLoading}
              >
                {portfolioLoading && <option value="">Loading portfolios...</option>}
                {!portfolioLoading && portfolioOptions.map((portfolio) => (
                  <option key={portfolio.value} value={portfolio.value}>{portfolio.label}</option>
                ))}
              </select>
            </div>
            {isCreatingNewPortfolio && (
              <div>
                <label className="mb-2 block text-sm font-medium text-[#444]">Portfolio Name:</label>
                <input
                  type="text"
                  className="h-[42px] w-full rounded border border-[#d5d5d5] px-4 text-sm text-[#222] outline-none"
                  placeholder="Enter portfolio name..."
                  value={newPortfolioName}
                  onChange={(e) => setNewPortfolioName(e.target.value)}
                  disabled={portfolioSaveLoading}
                />
              </div>
            )}
            <div>
              <label className="mb-2 block text-sm font-medium text-[#444]">Strategy Name:</label>
              <input
                type="text"
                className="h-[42px] w-full rounded border border-[#d5d5d5] px-4 text-sm text-[#222] outline-none"
                placeholder="Enter strategy name..."
                value={strategyName}
                onChange={(e) => setStrategyName(e.target.value)}
                disabled={portfolioSaveLoading}
              />
            </div>
            {saveError && <div className="rounded border border-[#f2b8b5] bg-[#fff4f3] px-3 py-2 text-sm text-[#bb3d36]">{saveError}</div>}
          </div>
          <div className="mt-9 flex justify-end gap-3">
            <button
              type="button"
              className="min-w-[82px] rounded border border-[#d5d5d5] px-5 py-2.5 text-sm font-medium text-[#555]"
              onClick={closeSaveModal}
              disabled={portfolioSaveLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="min-w-[72px] rounded bg-[#4db0ca] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
              onClick={saveModalMode === "update" ? handleUpdateStrategy : handleSaveStrategy}
              disabled={portfolioLoading || portfolioSaveLoading || !selectedPortfolio || (isCreatingNewPortfolio && !newPortfolioName.trim())}
            >
              {portfolioSaveLoading ? (saveModalMode === "update" ? "Updating..." : "Saving...") : (saveModalMode === "update" ? "Update" : "Save")}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
