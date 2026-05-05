import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { Modal } from "../../components/ui/modal";
import AnalyseView from "../../components/common/AnalyseView";
import { fetchOptionHistory, fetchSpotHistory, getLtpAtTime, type HistoricalData } from "../../utils/replayHistory";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

// ─── Timeline constants ───────────────────────────────────────────────────────

const SOD_MINS = 9 * 60 + 15;
const EOD_MINS = 15 * 60 + 30;
const MAX_SECS = (EOD_MINS - SOD_MINS) * 60;

function secsToTimeStr(secs: number): string {
  const totalMins = SOD_MINS + Math.floor(secs / 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timeStrToSecs(time: string): number {
  const [h, m, s] = time.split(":").map(Number);
  return Math.max(0, Math.min(MAX_SECS, ((h * 60 + m) - SOD_MINS) * 60 + (s || 0)));
}

function formatDateChip(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

function nowIsoTs() { return new Date().toISOString().slice(0, 19); }

function todayDateStr() { return new Date().toISOString().slice(0, 10); }

// ─── Broker Settings types ────────────────────────────────────────────────────

type TrailingTab = "lock" | "lock-trail" | "trail-stop-loss";

interface BsModalState {
  stopLossOpen: boolean; stopLoss: number;
  targetOpen: boolean; target: number;
  trailingOpen: boolean; trailingTab: TrailingTab;
  lock: { trigger: number; profit: number };
  lockTrail: { trigger: number; profit: number; trailTrigger: number; trailProfit: number };
  trailSL: { trigger: number; stopLoss: number };
}

interface BsDisplay {
  stopLoss: number | null;
  target: number | null;
  trailing: string;
}

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

// ─── Toggle switch ────────────────────────────────────────────────────────────

function ToggleSwitch({ id, checked, onChange }: { id: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      id={id} type="button" role="switch" aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex items-center rounded-full h-3 w-6 transition-colors ${checked ? "bg-[#1580ed]" : "bg-[#9ca3af]"}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full bg-white transition-transform ${checked ? "translate-x-3.5" : "translate-x-1"}`} />
    </button>
  );
}

// ─── Broker Settings Modal ────────────────────────────────────────────────────

function BrokerSettingsModal({
  open, brokerName, modal, saving, loading,
  onClose, onChange, onSave,
}: {
  open: boolean;
  brokerName: string;
  modal: BsModalState;
  saving: boolean;
  loading?: boolean;
  onClose: () => void;
  onChange: (next: BsModalState) => void;
  onSave: () => void;
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

  if (!open) return null;

  return (
    <Modal isOpen={open} onClose={onClose} className="max-w-[540px] m-4 p-0">
      <div>
        <div className="flex items-center justify-between border-b border-gray-200 px-7 py-5 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">
            {brokerName || "Broker"} Settings
          </h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="px-7 py-6 space-y-5">
            {/* Stop Loss */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  {toggleBtn(modal.stopLossOpen, () => onChange({ ...modal, stopLossOpen: !modal.stopLossOpen }))}
                  <span className="text-sm font-medium text-slate-600">Stop Loss</span>
                </div>
                {modal.stopLossOpen && numInput("Stop Loss amount", modal.stopLoss, v => onChange({ ...modal, stopLoss: v }))}
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  {toggleBtn(modal.targetOpen, () => onChange({ ...modal, targetOpen: !modal.targetOpen }))}
                  <span className="text-sm font-medium text-slate-600">Target Profit</span>
                </div>
                {modal.targetOpen && numInput("Target Profit amount", modal.target, v => onChange({ ...modal, target: v }))}
              </div>
            </div>

            {/* Trailing */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                {toggleBtn(modal.trailingOpen, () => onChange({ ...modal, trailingOpen: !modal.trailingOpen }))}
                <span className="text-sm font-medium text-slate-600">Trailing Options</span>
              </div>
              {modal.trailingOpen && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    {tabs.map(t => (
                      <button key={t.key} type="button"
                        onClick={() => onChange({ ...modal, trailingTab: t.key })}
                        className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${modal.trailingTab === t.key ? "bg-brand-500 text-white border-brand-500" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {modal.trailingTab === "lock" && (
                    <div className="grid grid-cols-2 gap-4">
                      {numInput("Trigger (MTM profit)", modal.lock.trigger, v => onChange({ ...modal, lock: { ...modal.lock, trigger: v } }))}
                      {numInput("Lock profit at", modal.lock.profit, v => onChange({ ...modal, lock: { ...modal.lock, profit: v } }))}
                    </div>
                  )}
                  {modal.trailingTab === "lock-trail" && (
                    <div className="grid grid-cols-2 gap-4">
                      {numInput("Lock trigger", modal.lockTrail.trigger, v => onChange({ ...modal, lockTrail: { ...modal.lockTrail, trigger: v } }))}
                      {numInput("Lock profit at", modal.lockTrail.profit, v => onChange({ ...modal, lockTrail: { ...modal.lockTrail, profit: v } }))}
                      {numInput("Trail trigger", modal.lockTrail.trailTrigger, v => onChange({ ...modal, lockTrail: { ...modal.lockTrail, trailTrigger: v } }))}
                      {numInput("Trail profit by", modal.lockTrail.trailProfit, v => onChange({ ...modal, lockTrail: { ...modal.lockTrail, trailProfit: v } }))}
                    </div>
                  )}
                  {modal.trailingTab === "trail-stop-loss" && (
                    <div className="grid grid-cols-2 gap-4">
                      {numInput("Trail trigger", modal.trailSL.trigger, v => onChange({ ...modal, trailSL: { ...modal.trailSL, trigger: v } }))}
                      {numInput("Trail Stop Loss by", modal.trailSL.stopLoss, v => onChange({ ...modal, trailSL: { ...modal.trailSL, stopLoss: v } }))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3 px-7 py-4 border-t border-gray-200">
          <button type="button" onClick={onClose}
            className="h-9 px-5 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={onSave} disabled={saving}
            className="h-9 px-5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors disabled:opacity-50 inline-flex items-center gap-2">
            {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Broker Settings Row ──────────────────────────────────────────────────────

function BrokerSettingsRow({
  display, includeBrokerage, includeTaxes,
  onOpenEdit, onToggleBrokerage, onToggleTaxes,
}: {
  display: BsDisplay;
  includeBrokerage: boolean;
  includeTaxes: boolean;
  onOpenEdit: () => void;
  onToggleBrokerage: (v: boolean) => void;
  onToggleTaxes: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-stretch justify-between gap-6 w-full px-5 py-4 mb-5 bg-white rounded-xl border border-[#e5e7eb] shadow-[0_2px_8px_0_rgba(16,24,40,0.07)]">
      {/* Main — Broker Settings card */}
      <div className="flex-1 min-w-[320px]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5 pb-2.5 border-b border-[#ececec]">
            <p className="text-[18px] font-medium leading-tight tracking-tight text-[#1f2937]">Broker Settings</p>
            <span className="inline-flex items-center justify-center w-[14px] h-[14px] rounded-full border border-[#9ca3af] text-[#4b5563]">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
              </svg>
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

      {/* Side — toggles + metrics */}
      <div className="flex items-center gap-7 flex-wrap py-1">
        {/* Include Brokerage */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label htmlFor="br-brokerage-toggle" className="text-[13px] font-semibold text-[#1f2937]">Include Brokerage</label>
            <ToggleSwitch id="br-brokerage-toggle" checked={includeBrokerage} onChange={onToggleBrokerage} />
          </div>
          <div className={`flex items-center gap-2 px-1 py-1 text-[#6b7280] ${includeBrokerage ? "" : "opacity-50 pointer-events-none"}`}>
            <span className="text-[15px] font-medium">0</span>
          </div>
        </div>

        {/* Taxes & charges */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label htmlFor="br-taxes-toggle" className="text-[13px] font-semibold text-[#1f2937]">Taxes &amp; charges</label>
            <ToggleSwitch id="br-taxes-toggle" checked={includeTaxes} onChange={onToggleTaxes} />
          </div>
          <div className={`flex items-center gap-2 px-1 py-1 text-[#6b7280] ${includeTaxes ? "" : "opacity-50 pointer-events-none"}`}>
            <span className="text-[15px] font-medium">₹ 0</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="w-3 h-3 text-[#9ca3af]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Margin Blocked */}
        <div className="flex flex-col justify-center gap-2.5">
          <span className="text-[13px] text-[#6b7280]">Margin Blocked&nbsp;(approx)</span>
          <span className="text-[15px] font-medium text-[#1f2937] tabular-nums">₹ 0</span>
        </div>

        {/* Net Debit/Credit */}
        <div className="flex flex-col justify-center gap-2.5">
          <span className="flex items-center gap-1 text-[13px] text-[#6b7280]">
            Net Debit/Credit
            <span className="inline-flex items-center justify-center w-[14px] h-[14px] rounded-full border border-[#9ca3af] text-[#4b5563]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
            </span>
          </span>
          <span className="text-[15px] font-medium text-[#1f2937] tabular-nums">₹ 0</span>
        </div>
      </div>
    </div>
  );
}

// ─── Timeline marker types ────────────────────────────────────────────────────

interface TimelineMarker {
  secs: number;
  pct: number;
  kind: "entry" | "exit";
  count: number;
  timeStr: string;
}

function parseTimestampTime(ts: unknown): string | null {
  const raw = String(ts ?? "").trim();
  if (!raw) return null;
  const m = raw.match(/(\d{2}:\d{2}:\d{2})/);
  return m ? m[1] : null;
}

function buildTradeHistoryUrl(entityType: string, entityId: string): string {
  const base = String(API_BASE || "").replace(/\/+$/, "");
  const path = entityType === "portfolio"
    ? `strategy-trade-history/portfolio/${encodeURIComponent(entityId)}`
    : entityType === "group"
    ? `strategy-trade-history/group/${encodeURIComponent(entityId)}`
    : `strategy-trade-history/${encodeURIComponent(entityId)}`;
  return `${base}/${path}?status=algo-backtest`;
}

// ─── Bag marker component ─────────────────────────────────────────────────────

function BagMarker({ marker: m, onClick, tipSide }: {
  marker: TimelineMarker;
  onClick: () => void;
  tipSide: "top" | "bottom";
}) {
  const isEntry = m.kind === "entry";
  const color = isEntry ? "#22c55e" : "#ef4444";
  const bgColor = isEntry ? "#16a34a" : "#dc2626";
  const label = isEntry ? "Entry" : "Exit";

  return (
    <div
      className="absolute -translate-x-1/2 flex flex-col items-center cursor-pointer group"
      style={{ left: `${m.pct}%`, top: 0 }}
      onClick={onClick}
    >
      <div className="relative">
        {/* Bag icon (shopping-bag) */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={color}
          className="w-[13px] h-[13px] drop-shadow-sm group-hover:scale-125 transition-transform">
          <path fillRule="evenodd" d="M7.5 6v.75H5.513c-.96 0-1.764.724-1.865 1.679l-1.263 12A1.875 1.875 0 0 0 4.25 22.5h15.5a1.875 1.875 0 0 0 1.865-2.071l-1.263-12a1.875 1.875 0 0 0-1.865-1.679H16.5V6a4.5 4.5 0 1 0-9 0Zm6.75 0v.75h-4.5V6a2.25 2.25 0 0 1 4.5 0Zm-6.75 6.75a.75.75 0 0 0 0 1.5h6a.75.75 0 0 0 0-1.5h-6Z" clipRule="evenodd" />
        </svg>
        {m.count > 1 && (
          <span className="absolute -top-1 -right-1.5 text-[7px] font-bold leading-none rounded-full w-[10px] h-[10px] flex items-center justify-center text-white"
            style={{ background: bgColor }}>
            {m.count}
          </span>
        )}
      </div>

      {/* Hover tooltip */}
      <div className={`absolute ${tipSide === "top" ? "bottom-full mb-1" : "top-full mt-1"} left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none`}>
        {tipSide === "bottom" && <div className="w-1.5 h-1.5 bg-[#1f2937] rotate-45 -mb-[3px]" />}
        <div className="bg-[#1f2937] text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-lg">
          {label} {m.timeStr.slice(0, 5)}
          {m.count > 1 && <span className="ml-1 opacity-70">×{m.count}</span>}
        </div>
        {tipSide === "top" && <div className="w-1.5 h-1.5 bg-[#1f2937] rotate-45 -mt-[3px]" />}
      </div>
    </div>
  );
}

// ─── Entity label helpers ─────────────────────────────────────────────────────

function entityLabel(type: string | undefined) {
  if (type === "group") return "Group";
  if (type === "strategy") return "Strategy";
  if (type === "portfolio") return "Portfolio";
  return type ?? "";
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BarReplay() {
  const { entityType, entityId } = useParams<{ entityType: string; entityId: string }>();

  // ── control bar state
  const [autoload, setAutoload] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [speed, setSpeed] = useState("60");
  const [runNowLoading, setRunNowLoading] = useState(false);

  // ── timeline state
  const [sliderSecs, setSliderSecs] = useState(0);
  const [listenDate, setListenDate] = useState(todayDateStr);
  const [listenTime, setListenTime] = useState("09:15:00");
  const listenDateRef = useRef(todayDateStr());
  const listenTimeRef = useRef("09:15:00");
  const sliderSecsRef = useRef(0);
  const latestListenTsRef = useRef(`${todayDateStr()}T09:15:00`);
  const autoplayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoloadRef = useRef(false);
  const speedRef = useRef("60");
  const runNowRef = useRef<((ts?: string) => Promise<void>) | null>(null);

  // ── broker settings state
  const [bsDisplay, setBsDisplay] = useState<BsDisplay>({ stopLoss: 4900, target: 2000, trailing: "-" });
  const [bsModalOpen, setBsModalOpen] = useState(false);
  const [bsModal, setBsModal] = useState<BsModalState>(DEFAULT_MODAL);
  const [bsSaving, setBsSaving] = useState(false);
  const [includeBrokerage, setIncludeBrokerage] = useState(false);
  const [includeTaxes, setIncludeTaxes] = useState(false);

  // ── timeline markers + all-leg tokens for replay LTP
  const [timelineMarkers, setTimelineMarkers] = useState<TimelineMarker[]>([]);
  const allLegTokensRef = useRef<string[]>([]);
  const activationModeRef = useRef("algo-backtest");
  const spotTokenRef = useRef<string>("");          // e.g. "NSE_01" for NIFTY
  const [replayTimestamp, setReplayTimestamp] = useState<string | undefined>();
  const [replayLtpMap, setReplayLtpMap] = useState<Record<string, number> | undefined>();
  const [replaySpotPrice, setReplaySpotPrice] = useState<number | undefined>();
  // full candle history loaded once on page load
  const historicalDataRef = useRef<HistoricalData>({});
  const [histLoaded, setHistLoaded] = useState(false);

  useEffect(() => {
    if (!entityType || !entityId) return;
    fetch(buildTradeHistoryUrl(entityType, entityId))
      .then(r => r.json())
      .then((data: Record<string, unknown>) => {
        const trade = (data.trade ?? {}) as Record<string, unknown>;
        const activationMode = String(trade.activation_mode ?? "algo-backtest").toLowerCase();

        const legsObj = (data.legs ?? {}) as Record<string, unknown[]>;
        const allLegs = [
          ...(legsObj.open ?? []),
          ...(legsObj.pending_feature_legs ?? []),
          ...(legsObj.closed ?? []),
        ] as Record<string, unknown>[];

        // collect all tokens for historical-data API
        const tokens = [...new Set(
          allLegs.map(l => String((l.entry_trade as Record<string, unknown>)?.instrument_token ?? l.token ?? "").trim()).filter(Boolean)
        )];
        allLegTokensRef.current = tokens;

        activationModeRef.current = activationMode;

        // ── Set default date/time + determine candle for historical load ─────
        let defaultDate: string;
        let defaultTime: string;
        let defaultSecs: number;
        let histCandle: string;

        if (activationMode === "algo-backtest") {
          const firstLeg = allLegs[0] as Record<string, unknown> | undefined;
          const firstEt = (firstLeg?.entry_trade ?? {}) as Record<string, unknown>;
          const firstTs = String(firstLeg?.queued_at ?? firstEt.traded_timestamp ?? firstEt.trigger_timestamp ?? "");
          defaultDate = firstTs.match(/^(\d{4}-\d{2}-\d{2})/) ? firstTs.slice(0, 10) : todayDateStr();
          defaultTime = "09:15:00";   // slider starts at SOD
          defaultSecs = 0;
          histCandle = `${defaultDate}T15:30:00`; // fetch full day data
        } else {
          const now = new Date();
          defaultDate = now.toISOString().slice(0, 10);
          const hh = String(now.getHours()).padStart(2, "0");
          const mm = String(now.getMinutes()).padStart(2, "0");
          const ss = String(now.getSeconds()).padStart(2, "0");
          defaultTime = `${hh}:${mm}:${ss}`;
          defaultSecs = timeStrToSecs(defaultTime);
          histCandle = `${defaultDate}T${defaultTime}`;
        }

        setListenDate(defaultDate);   listenDateRef.current = defaultDate;
        setListenTime(defaultTime);   listenTimeRef.current = defaultTime;
        setSliderSecs(defaultSecs);   sliderSecsRef.current = defaultSecs;
        latestListenTsRef.current = `${defaultDate}T${defaultTime}`;

        // ── Fetch full candle history ONCE (option legs + spot/VIX) ─────────
        const underlying = String(trade.ticker ?? trade.underlying ?? "").toUpperCase();
        const defaultTs = `${defaultDate}T${defaultTime}`;

        if (tokens.length > 0 || underlying) {
          Promise.all([
            tokens.length ? fetchOptionHistory(tokens, histCandle, activationMode) : Promise.resolve({}),
            underlying    ? fetchSpotHistory(underlying, histCandle, activationMode) : Promise.resolve({}),
          ])
            .then(([optionHist, spotHist]) => {
              // find the underlying spot token (e.g. "NSE_01") — any key that isn't VIX
              const spotTok = Object.keys(spotHist).find(k => k !== "NSE_00") ?? "";
              spotTokenRef.current = spotTok;

              const merged = { ...optionHist, ...spotHist };
              historicalDataRef.current = merged;
              setHistLoaded(true);

              const ltpMap = getLtpAtTime(merged, defaultTs);
              setReplayTimestamp(defaultTs);
              setReplayLtpMap(ltpMap);
              if (spotTok && ltpMap[spotTok]) setReplaySpotPrice(ltpMap[spotTok]);
            })
            .catch(err => console.error("[BarReplay histLoad]", err));
        }

        // ── Build timeline markers ──────────────────────────────────────────
        const entryMap = new Map<string, number>();
        const exitMap = new Map<string, number>();

        for (const leg of allLegs) {
          const et = (leg.entry_trade ?? {}) as Record<string, unknown>;
          const xt = (leg.exit_trade ?? {}) as Record<string, unknown>;

          const entryTs = parseTimestampTime(leg.queued_at ?? et.traded_timestamp ?? et.trigger_timestamp);
          if (entryTs) entryMap.set(entryTs, (entryMap.get(entryTs) ?? 0) + 1);

          const exitTs = parseTimestampTime(xt.traded_timestamp ?? xt.trigger_timestamp);
          if (exitTs) exitMap.set(exitTs, (exitMap.get(exitTs) ?? 0) + 1);
        }

        const markers: TimelineMarker[] = [];
        for (const [timeStr, count] of entryMap) {
          const secs = timeStrToSecs(timeStr);
          if (secs >= 0 && secs <= MAX_SECS)
            markers.push({ secs, pct: (secs / MAX_SECS) * 100, kind: "entry", count, timeStr });
        }
        for (const [timeStr, count] of exitMap) {
          const secs = timeStrToSecs(timeStr);
          if (secs >= 0 && secs <= MAX_SECS)
            markers.push({ secs, pct: (secs / MAX_SECS) * 100, kind: "exit", count, timeStr });
        }
        setTimelineMarkers(markers);
      })
      .catch(() => {});
  }, [entityType, entityId]);

  // ── timeline helpers
  const updateTime = useCallback((newSecs: number) => {
    const clamped = Math.max(0, Math.min(MAX_SECS, newSecs));
    const t = secsToTimeStr(clamped);
    setSliderSecs(clamped); sliderSecsRef.current = clamped;
    setListenTime(t); listenTimeRef.current = t;
    latestListenTsRef.current = `${listenDateRef.current}T${t}`;
  }, []);

  const seekBy = useCallback((target: number | "sod" | "eod") => {
    let newSecs: number;
    let newDate = listenDateRef.current;

    if (target === "sod") { newSecs = 0; }
    else if (target === "eod") { newSecs = MAX_SECS; }
    else if (target === -1440 || target === 1440) {
      const d = new Date(listenDateRef.current + "T00:00:00");
      d.setDate(d.getDate() + (target > 0 ? 1 : -1));
      newDate = d.toISOString().slice(0, 10);
      setListenDate(newDate); listenDateRef.current = newDate;
      newSecs = sliderSecsRef.current;
    } else {
      newSecs = Math.max(0, Math.min(MAX_SECS, sliderSecsRef.current + (target as number) * 60));
    }

    const t = secsToTimeStr(newSecs);
    setSliderSecs(newSecs); sliderSecsRef.current = newSecs;
    setListenTime(t); listenTimeRef.current = t;
    const ts = `${newDate}T${t}`;
    latestListenTsRef.current = ts;
    runNowRef.current?.(ts);
  }, []);

  const handleSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateTime(Number(e.target.value));
  }, [updateTime]);

  const handleTimeInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const t = raw.length === 5 ? raw + ":00" : raw;
    setListenTime(t); listenTimeRef.current = t;
    const secs = timeStrToSecs(t);
    setSliderSecs(secs); sliderSecsRef.current = secs;
    latestListenTsRef.current = `${listenDateRef.current}T${t}`;
  }, []);

  const handleDateChange = useCallback((dateStr: string) => {
    setListenDate(dateStr); listenDateRef.current = dateStr;
    latestListenTsRef.current = `${dateStr}T${listenTimeRef.current}`;
  }, []);

  // ── Look up LTP from stored candle history at a given timestamp ──────────
  const applyReplayAt = useCallback((ts: string) => {
    if (!Object.keys(historicalDataRef.current).length) return;
    const ltpMap = getLtpAtTime(historicalDataRef.current, ts);
    setReplayTimestamp(ts);
    setReplayLtpMap(ltpMap);
    const spotTok = spotTokenRef.current;
    if (spotTok && ltpMap[spotTok]) setReplaySpotPrice(ltpMap[spotTok]);
  }, []);

  // ── Run Now — pure lookup from stored history, no API call ───────────────
  const runNow = useCallback(async (tsOverride?: string) => {
    if (!entityType || !entityId) return;
    const ts = tsOverride ?? latestListenTsRef.current ?? nowIsoTs();
    setRunNowLoading(true);
    try {
      applyReplayAt(ts);
    } finally {
      setRunNowLoading(false);
    }
  }, [entityType, entityId, applyReplayAt]);

  // keep ref current so seekBy can use latest runNow
  runNowRef.current = runNow;

  // ── autoload toggle
  const toggleAutoload = useCallback(() => {
    setAutoload(prev => { const next = !prev; autoloadRef.current = next; return next; });
  }, []);

  // ── autoplay
  const stopAutoplay = useCallback(() => {
    if (autoplayTimerRef.current) clearInterval(autoplayTimerRef.current);
    autoplayTimerRef.current = null;
    setAutoplay(false);
  }, []);

  const startAutoplay = useCallback(() => {
    setAutoplay(true);
    autoplayTimerRef.current = setInterval(() => {
      const mins = Math.max(1, Math.round(parseInt(speedRef.current) / 60));
      const dt = new Date((latestListenTsRef.current || nowIsoTs()).replace(" ", "T"));
      dt.setMinutes(dt.getMinutes() + mins);
      const ts = dt.toISOString().slice(0, 19);
      latestListenTsRef.current = ts;
      runNowRef.current?.(ts);
    }, 1000);
  }, []);

  const toggleAutoplay = useCallback(() => {
    if (autoplayTimerRef.current) stopAutoplay(); else startAutoplay();
  }, [stopAutoplay, startAutoplay]);

  // ── broker settings handlers
  const openBrokerSettings = useCallback(() => setBsModalOpen(true), []);

  const saveBrokerSettings = useCallback(async () => {
    setBsSaving(true);
    try {
      // derive display from modal
      let trailing = "-";
      if (bsModal.trailingOpen) {
        if (bsModal.trailingTab === "lock") trailing = "Lock";
        else if (bsModal.trailingTab === "lock-trail") trailing = "Lock and Trail";
        else trailing = "Trail Stop Loss";
      }
      setBsDisplay({
        stopLoss: bsModal.stopLossOpen ? bsModal.stopLoss : null,
        target: bsModal.targetOpen ? bsModal.target : null,
        trailing,
      });
    } finally {
      setBsSaving(false);
      setBsModalOpen(false);
    }
  }, [bsModal]);

  const hasEntity = Boolean(entityType && entityId);

  return (
    <>
      <PageMeta title="Bar Replay" description="Replay trades bar by bar" />

      <div className="p-5">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-5">
          <span className="text-[22px] font-semibold text-[#1f3347]">Bar Replay</span>
          {hasEntity && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eef4ff] border border-[#c7d7ff] text-[#3b5bdb] text-[13px] font-medium">
              <span className="capitalize">{entityLabel(entityType)}</span>
              <span className="text-[#6c7bc4] font-normal">/</span>
              <span className="font-mono text-[12px]">{entityId}</span>
            </span>
          )}
        </div>

        {!hasEntity ? (
          /* Landing — no entity selected */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-[#eef4ff] flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#3b5bdb" className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
              </svg>
            </div>
            <p className="text-[16px] font-medium text-[#1f3347] mb-1">No entity selected</p>
            <p className="text-[13px] text-[#6b7280] max-w-xs">
              Navigate to a group, strategy, or portfolio and choose <strong>Bar Replay</strong> to start replaying trades.
            </p>
            <p className="mt-4 text-[12px] text-[#9ca3af] font-mono">
              URL: /replay/&#123;group|strategy|portfolio&#125;/&#123;id&#125;
            </p>
          </div>
        ) : (
          <>
            {/* ── Control bar */}
            <div className="mb-5 border border-[#dbe4ee] rounded-[10px] bg-[#f8fbff] px-4 pt-3 pb-2">

              {/* Slider: 09:15 ──●────── 15:30 */}
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 mb-2">
                <span className="text-[14px] font-semibold text-[#1f3347] whitespace-nowrap select-none">09:15</span>
                <div className="flex flex-col w-full">

                  {/* Entry markers — above slider */}
                  <div className="relative h-4 w-full">
                    {timelineMarkers.filter(m => m.kind === "entry").map((m, i) => (
                      <BagMarker key={`entry-${m.timeStr}-${i}`} marker={m}
                        onClick={() => { updateTime(m.secs); runNowRef.current?.(`${listenDateRef.current}T${secsToTimeStr(m.secs)}`); }}
                        tipSide="top" />
                    ))}
                  </div>

                  {/* Slider track */}
                  <input
                    type="range" min={0} max={MAX_SECS} step={1} value={sliderSecs}
                    onChange={handleSlider}
                    className="w-full cursor-pointer bt-slider"
                    style={{
                      height: 6, borderRadius: 999, appearance: "none", outline: "none",
                      background: `linear-gradient(90deg,#4b5563 ${(sliderSecs / MAX_SECS) * 100}%,#d4dbe5 ${(sliderSecs / MAX_SECS) * 100}%)`,
                    }}
                    aria-label="Replay timeline"
                  />

                  {/* Exit markers — below slider */}
                  <div className="relative h-4 w-full">
                    {timelineMarkers.filter(m => m.kind === "exit").map((m, i) => (
                      <BagMarker key={`exit-${m.timeStr}-${i}`} marker={m}
                        onClick={() => { updateTime(m.secs); runNowRef.current?.(`${listenDateRef.current}T${secsToTimeStr(m.secs)}`); }}
                        tipSide="bottom" />
                    ))}
                  </div>

                </div>
                <span className="text-[14px] font-semibold text-[#1f3347] whitespace-nowrap select-none">15:30</span>
              </div>

              {/* Controls row */}
              <div className="flex items-center justify-between gap-2 flex-wrap">

                {/* Left — Import/Export */}
                <div className="flex items-center">
                  <button type="button"
                    className="h-[34px] px-3 border border-[#d7e0ea] rounded-[10px] bg-white text-[#0f5da8] text-[13px] font-medium whitespace-nowrap hover:bg-gray-50 transition-colors">
                    Import/Export ▾
                  </button>
                </div>

                {/* Center — seek buttons + date chip + time input */}
                <div className="flex items-center gap-[2px] flex-wrap">
                  {([-1440, "sod", -60, -30, -15, -5, -1] as const).map(v => (
                    <button key={String(v)} type="button" onClick={() => seekBy(v)}
                      className="h-[34px] px-[6px] border-0 bg-transparent text-[#31485f] text-[13px] font-medium whitespace-nowrap hover:text-[#0f5da8] transition-colors cursor-pointer">
                      {v === "sod" ? "SOD" : v === -1440 ? "-1d" : `${v}m`}
                    </button>
                  ))}

                  {/* Date chip */}
                  <div className="inline-flex items-center h-[34px] px-3 border border-[#d7e0ea] rounded-[10px] bg-white text-[#1f3347] text-[13px] font-medium whitespace-nowrap mx-1">
                    <input
                      type="date" value={listenDate} onChange={e => handleDateChange(e.target.value)}
                      className="border-0 bg-transparent text-inherit font-inherit outline-none cursor-pointer w-0 opacity-0 absolute"
                      id="br-date-input"
                    />
                    <label htmlFor="br-date-input" className="cursor-pointer">{formatDateChip(listenDate)}</label>
                  </div>

                  {/* Time chip */}
                  <div className="inline-flex items-center h-[34px] px-3 border border-[#d7e0ea] rounded-[10px] bg-white text-[#1f3347] text-[13px] font-medium gap-1.5 mx-1">
                    <input
                      type="time" step={1} value={listenTime.slice(0, 5)} onChange={handleTimeInput}
                      className="border-0 bg-transparent text-inherit font-inherit outline-none min-w-[72px] cursor-pointer"
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-[#8da0b0] shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>

                  {([1, 5, 15, 30, 60, "eod", 1440] as const).map(v => (
                    <button key={String(v)} type="button" onClick={() => seekBy(v)}
                      className="h-[34px] px-[6px] border-0 bg-transparent text-[#31485f] text-[13px] font-medium whitespace-nowrap hover:text-[#0f5da8] transition-colors cursor-pointer">
                      {v === "eod" ? "EOD" : v === 1440 ? "+1d" : `+${v}m`}
                    </button>
                  ))}
                </div>

                {/* Right — Run Now, Autoload, Autoplay, Speed */}
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => runNow()} disabled={runNowLoading}
                    className="inline-flex items-center gap-1.5 h-[34px] px-3 border border-[#d7e0ea] rounded-[10px] bg-white text-[#0f5da8] text-[13px] font-medium whitespace-nowrap hover:bg-gray-50 transition-colors disabled:opacity-50">
                    {runNowLoading && <span className="w-3 h-3 border-2 border-[#0f5da8] border-t-transparent rounded-full animate-spin inline-block" />}
                    Run Now
                  </button>
                  <button type="button" onClick={toggleAutoload}
                    className="h-[34px] px-3 border border-[#d7e0ea] rounded-[10px] bg-white text-[#0f5da8] text-[13px] font-medium whitespace-nowrap hover:bg-gray-50 transition-colors">
                    Autoload: {autoload ? "true" : "false"}
                  </button>
                  <div className="inline-flex items-center h-[34px] px-3 border border-[#d7e0ea] rounded-[10px] bg-white text-[#31485f] text-[13px] font-semibold whitespace-nowrap gap-1">
                    autoload=&nbsp;<strong className="text-[#0f5da8] lowercase">{autoload ? "true" : "false"}</strong>
                  </div>
                  <button type="button" onClick={toggleAutoplay}
                    className={`inline-flex items-center gap-2 h-[34px] px-3 border rounded-[10px] text-[13px] font-medium whitespace-nowrap transition-colors ${autoplay ? "border-[#174f72] bg-[#174f72] text-white" : "border-[#d7e0ea] bg-white text-[#1f3347] hover:bg-gray-50"}`}>
                    ▶ Autoplay
                  </button>
                  <select value={speed} onChange={e => { setSpeed(e.target.value); speedRef.current = e.target.value; }}
                    className="h-[34px] px-[10px] border border-[#d7e0ea] rounded-[10px] bg-white text-[#31485f] text-[13px] font-medium cursor-pointer outline-none">
                    <option value="60">1m/1s</option>
                    <option value="300">5m/1s</option>
                    <option value="900">15m/1s</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ── Broker Settings Row */}
            <BrokerSettingsRow
              display={bsDisplay}
              includeBrokerage={includeBrokerage}
              includeTaxes={includeTaxes}
              onOpenEdit={openBrokerSettings}
              onToggleBrokerage={setIncludeBrokerage}
              onToggleTaxes={setIncludeTaxes}
            />

            <BrokerSettingsModal
              open={bsModalOpen}
              brokerName=""
              modal={bsModal}
              saving={bsSaving}
              onClose={() => setBsModalOpen(false)}
              onChange={setBsModal}
              onSave={saveBrokerSettings}
            />

            {/* ── Replay content area — full Analyse view */}
            <AnalyseView
              entityType={entityType!}
              entityId={entityId!}
              replayTimestamp={replayTimestamp}
              replayLtpMap={replayLtpMap}
              replaySpotPrice={replaySpotPrice}
            />
          </>
        )}
      </div>
    </>
  );
}
