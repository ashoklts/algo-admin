import { useEffect, useRef, useState } from "react";

type AtmMode = "Spot" | "Fut" | "SynthFut";

interface OptionChainRow {
  close: number;
  expiry: string;
  iv?: number;
  oi?: number;
  spot_price?: number;
  strike: number;
  timestamp?: string;
  type: "CE" | "PE";
  delta?: number;
}

interface Leg {
  expiry: string;
  optionType: "Call" | "Put";
  premium: number;
  quantity: number;
  strike: number;
  type: "Buy" | "Sell";
}

const ITEM_WIDTH = 104;
const ITEM_GAP = 8;
const CAROUSEL_STEP = ITEM_WIDTH + ITEM_GAP;

const styles = scopeCss(`
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .os-page { min-height: 100vh; background: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
  .os-main { display: flex; gap: 20px; align-items: flex-start; }

  /* ── Panel shell ── */
  .oc-panel { width: 500px; flex-shrink: 0; background: #fff; border-radius: 8px; border: 1px solid #e5e7eb; box-shadow: 0 2px 10px rgba(0,0,0,.08); overflow: hidden; display: flex; flex-direction: column; }

  /* ── Panel header ── */
  .oc-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid #D9D9D9; font-size: 13px; }
  .oc-header-left { color: #6b7280; font-size: 12px; }
  .oc-title { font-weight: 700; font-size: 13px; color: #333; }
  .oc-expiry-label { font-size: 11px; font-weight: 400; opacity: 0.8; color: #333; margin-left: 2px; }
  .oc-hide-btn { color: #38bdf8; font-size: 12px; background: none; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 3px; }

  /* ── Expiry carousel ── */
  .expiry__viewer { width: 100%; min-height: 56px; border-bottom: 1px solid #D9D9D9; display: flex; align-items: center; gap: 8px; padding: 4px 8px; }
  .expiry-carousel__viewport { flex: 1; overflow: hidden; }
  .expiry-carousel__track { display: flex; align-items: flex-start; gap: 8px; transition: transform 0.25s ease; will-change: transform; }
  .expiry_button { text-align: center; flex: 0 0 104px; width: 104px; padding: 4px 0; cursor: pointer; }
  .expiry_button button { width: 100%; padding: 4px 8px; color: #646464; background: #F4F4F4; border-radius: 2px; border: 0; font-size: 12px; cursor: pointer; font-family: inherit; text-transform: uppercase; }
  .expiry_button .expiry_indicator { margin-top: 2px; color: #646464; font-size: 10px; }
  .selected__oc__expiry button { color: #4DA1C7 !important; background-color: #DDF8FF !important; }
  .expiry-carousel__arrow { flex: 0 0 24px; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; background: transparent; color: #565656; font-size: 28px; line-height: 1; cursor: pointer; }
  .expiry-carousel__arrow:disabled { opacity: 0.2; cursor: default; }

  /* ── Filter/meta rows ── */
  .oc_filter { padding: 4px 10px; min-height: 36px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #646464; }
  .oc_filter > div { display: flex; align-items: center; min-width: 110px; }
  .oc_filter > div:last-child { justify-content: flex-end; }

  /* ATM radio group */
  .squar__off__type { display: flex; align-items: center; gap: 8px; }
  .checkbox-container { display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 12px; }
  .checkbox-label { display: flex; align-items: center; }
  .checkbox-custom.radio__type { width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid #94a3b8; background: #fff; display: inline-block; flex-shrink: 0; transition: all .15s; }
  .radio__active .checkbox-custom.radio__type { border-color: #2563eb; background: #2563eb; box-shadow: inset 0 0 0 2px #fff; }
  .checkbox__title { font-size: 12px; color: #646464; }

  /* Total OI strip */
  .total_oi { display: flex; align-items: center; justify-content: center; font-size: 13px; color: #646464; gap: 4px; }
  .total_call_oi { min-width: 48px; text-align: right; font-size: 11px; color: #000; }
  .total_put_oi { min-width: 50px; text-align: left; font-size: 11px; color: #000; }
  .total_call_oi span, .total_put_oi span { color: #34A66D; font-size: 10px; padding-left: 2px; }
  .oi-progress { width: 14px; height: 5px; margin: 0 3px; border-radius: 2px; overflow: hidden; background: #e2e8f0; }
  .oi-progress-call { background: #FBE2E2; width: 100%; height: 100%; }
  .oi-progress-put { background: #CDF1DF; width: 100%; height: 100%; }

  /* ── Table ── */
  .oc-custom-table { width: 100%; overflow-x: auto; overflow-y: auto; max-height: 520px; font-size: 13px; }
  .oc-custom-table table { min-width: 460px; width: 100%; border-collapse: collapse; table-layout: fixed; }
  .oc-custom-table thead tr { position: sticky; top: 0; z-index: 2; background: #f1f5f9; }
  .oc-custom-table th { padding: 8px 10px; font-weight: 600; font-size: 12px; color: #475569; border-bottom: 2px solid #e2e8f0; letter-spacing: 0.03em; }
  .oc-call-head { text-align: right; color: #16a34a !important; width: 25%; }
  .oc-call-oi-head { text-align: right; color: #ef4444 !important; width: 12%; font-size: 11px; }
  .oc-iv-head { text-align: center; color: #7c3aed !important; width: 10%; font-size: 11px; }
  .oc-strike-head { text-align: center; width: 16%; color: #1e293b !important; }
  .oc-put-oi-head { text-align: left; color: #22c55e !important; width: 12%; font-size: 11px; }
  .oc-put-head { text-align: left; color: #dc2626 !important; width: 25%; }
  .oc-head-delta { font-weight: 400; opacity: 0.7; font-size: 11px; }

  /* Row cells */
  .oc-row td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  .oc-row:hover .oc-strike, .oc-row:hover .oc-ltp { font-weight: 600; }

  .oc-call { text-align: right; }
  .oc-put { text-align: left; }
  .oc-iv { text-align: center; padding: 4px 4px !important; }
  .oc-iv-value { font-size: 11px; font-weight: 200; color: #1e293b; white-space: nowrap; }
  .oc-strike { text-align: center; font-weight: 300; font-size: 13px; color: #334155; background: #f8fafc; }
  .oc-ltp { font-weight: 300; color: #1e293b; margin-right: 3px; }
  .oc-delta { font-size: 11px; color: #64748b; }
  .oc-empty { color: #94a3b8; }

  /* ATM row */
  .oc-row.oc-atm td { background: #EBFBFF !important; }
  .oc-row.oc-atm .oc-strike { background: #c7f2ff !important; font-weight: 300; }

  /* ITM highlights */
  .oc-row.oc-call-itm .oc-call { background: #fefce8 !important; }
  .oc-row.oc-put-itm .oc-put { background: #fefce8 !important; }

  /* OI cells */
  .oc-call-oi { text-align: right; padding: 4px 6px !important; }
  .oc-put-oi { text-align: left; padding: 4px 6px !important; }
  .oc-oi-value { font-size: 11px; font-weight: 600; line-height: 1.4; white-space: nowrap; opacity: 0.6; }
  .oc-oi-call { color: #ef4444; }
  .oc-oi-put { color: #22c55e; }
  .oc-oi-bar-wrap { height: 3px; background: #e2e8f0; border-radius: 2px; margin-top: 3px; overflow: hidden; opacity: 0.4; }
  .oc-call-oi .oc-oi-bar-wrap { display: flex; justify-content: flex-end; }
  .oc-oi-bar { height: 100%; border-radius: 2px; transition: width 0.3s; }
  .oc-oi-bar-call { background: #ef4444; }
  .oc-oi-bar-put { background: #22c55e; }

  /* B/S buttons — hidden by default, show on row hover or when active */
  .oc-actions { display: none; align-items: center; gap: 3px; }
  .oc-row:hover .oc-actions { display: inline-flex; }
  .oc-actions.has-active { display: inline-flex !important; }
  .oc-custom-table .action_button button { background: #fff; color: #999; border: 1px solid #ccc; font-size: 11px; padding: 1px 5px; border-radius: 2px; cursor: pointer; font-family: inherit; line-height: 1.5; }
  .oc-custom-table .buy_button:hover { color: #03B760 !important; border-color: #03B760 !important; }
  .oc-custom-table .sell_button:hover { color: #EF6161 !important; border-color: #EF6161 !important; }
  .oc-custom-table .buy_button.oc-btn-active { background: #03B760 !important; color: #fff !important; border-color: #03B760 !important; }
  .oc-custom-table .sell_button.oc-btn-active { background: #EF6161 !important; color: #fff !important; border-color: #EF6161 !important; }

  /* Call cell: B/S on LEFT, ltp/delta on RIGHT */
  .oc-call .oc-cell-inner { display: flex; align-items: center; justify-content: flex-end; gap: 4px; white-space: nowrap; width: 100%; }
  .oc-call .oc-actions { margin-right: auto; }

  /* Put cell: ltp/delta on LEFT, B/S on RIGHT */
  .oc-put .oc-cell-inner { display: flex; align-items: center; justify-content: flex-start; gap: 4px; white-space: nowrap; width: 100%; }
  .oc-put .oc-actions { margin-left: auto; }

  /* ── Right panel ── */
  .os-right-panel { flex: 1; min-width: 0; background: #fff; border-radius: 8px; border: 1px solid #e5e7eb; box-shadow: 0 2px 10px rgba(0,0,0,.08); padding: 24px; min-height: 400px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 14px; }

  @media (max-width: 900px) {
    .os-main { flex-direction: column; }
    .oc-panel { width: 100%; }
  }
`, ".os-page");

function scopeCss(css: string, scope: string): string {
  return css.replace(/(^|[{}])\s*([^@{}][^{]*)\{/g, (match, prefix: string, selectors: string) => {
    const scopedSelectors = selectors
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s.startsWith(scope) ? s : `${scope} ${s}`))
      .join(", ");
    if (!scopedSelectors) return match;
    return `${prefix}\n  ${scopedSelectors} {`;
  });
}

function formatExpiryLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const mon = months[d.getUTCMonth()];
  const yr = String(d.getUTCFullYear()).slice(2);
  return `${day} ${mon} '${yr}`;
}

function daysToExpiry(expiry: string, from: Date): number {
  const diff = new Date(expiry).getTime() - new Date(from.toDateString()).getTime();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function dteSuffix(expiry: string, index: number, _totalExpiries: string[]): string {
  const dte = daysToExpiry(expiry, new Date());
  if (index === 0) return `CW: ${dte} DTE`;
  if (index === 1) return `NW: ${dte} DTE`;
  const isMonthEnd = (() => {
    const d = new Date(expiry);
    const next = new Date(expiry);
    next.setUTCDate(next.getUTCDate() + 7);
    return next.getUTCMonth() !== d.getUTCMonth();
  })();
  if (isMonthEnd) return `CM: ${dte} DTE`;
  return `${dte} DTE`;
}

function fmtOI(value: number): string {
  if (value >= 10000000) return `${(value / 10000000).toFixed(1).replace(/\.0$/, "")}Cr`;
  if (value >= 100000) return `${(value / 100000).toFixed(1).replace(/\.0$/, "")}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return value.toString();
}

export default function OptionSimulatorPage() {
  const [data, setData] = useState<OptionChainRow[]>([]);
  const [selectedExpiry, setSelectedExpiry] = useState("");
  const [spotPrice, setSpotPrice] = useState(0);
  const [marketTime, setMarketTime] = useState<Date | null>(null);
const [atmMode, setAtmMode] = useState<AtmMode>("Spot");
  const [carouselOffset, setCarouselOffset] = useState(0);
  const [legs, setLegs] = useState<Leg[]>([]);

  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/js/option-chain.json")
      .then((r) => r.json())
      .then((rows: OptionChainRow[]) => {
        setData(rows);
        const firstExpiry = [...new Set(rows.map((r) => r.expiry))].sort()[0] || "";
        setSelectedExpiry(firstExpiry);
        if (rows[0]?.spot_price) setSpotPrice(rows[0].spot_price);
        if (rows[0]?.timestamp) setMarketTime(new Date(rows[0].timestamp));
      })
      .catch(() => {});
  }, []);

  /* ── derived data ── */
  const expiries = [...new Set(data.map((r) => r.expiry))].sort();

  const strikeMap = new Map<number, { call?: OptionChainRow; put?: OptionChainRow }>();
  data
    .filter((r) => r.expiry === selectedExpiry)
    .forEach((r) => {
      if (!strikeMap.has(r.strike)) strikeMap.set(r.strike, {});
      const entry = strikeMap.get(r.strike)!;
      if (r.type === "CE") entry.call = r;
      else entry.put = r;
    });
  const strikes = [...strikeMap.keys()].sort((a, b) => a - b);

  const atmStrike = strikes.length
    ? strikes.reduce((best, cur) =>
        Math.abs(cur - spotPrice) < Math.abs(best - spotPrice) ? cur : best
      )
    : 0;

  const atmEntry = strikeMap.get(atmStrike);
  const straddlePrem = (atmEntry?.call?.close || 0) + (atmEntry?.put?.close || 0);
  const atmIV = (() => {
    const ivs = [atmEntry?.call?.iv, atmEntry?.put?.iv].filter((v): v is number => typeof v === "number" && v > 0);
    return ivs.length ? ivs.reduce((s, v) => s + v, 0) / ivs.length : 0;
  })();

  let totalCallOI = 0;
  let totalPutOI = 0;
  let maxCallOI = 0;
  let maxPutOI = 0;
  strikes.forEach((s) => {
    const cOI = strikeMap.get(s)?.call?.oi || 0;
    const pOI = strikeMap.get(s)?.put?.oi || 0;
    totalCallOI += cOI;
    totalPutOI += pOI;
    if (cOI > maxCallOI) maxCallOI = cOI;
    if (pOI > maxPutOI) maxPutOI = pOI;
  });

  const pcr = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;

  const maxPain = strikes.reduce(
    (best, price) => {
      const loss = strikes.reduce((sum, s) => {
        const e = strikeMap.get(s)!;
        return sum + (e.call?.oi || 0) * Math.max(0, s - price) + (e.put?.oi || 0) * Math.max(0, price - s);
      }, 0);
      return loss < best.loss ? { strike: price, loss } : best;
    },
    { strike: strikes[0] || 0, loss: Infinity }
  ).strike;

  /* ── carousel ── */
  const viewportWidth = viewportRef.current?.clientWidth || 400;
  const trackWidth = expiries.length * CAROUSEL_STEP - ITEM_GAP;
  const maxOffset = Math.max(0, trackWidth - viewportWidth);

  /* ── positions ── */
  function hasPos(strike: number, optionType: "Call" | "Put", type: "Buy" | "Sell") {
    return legs.some(
      (l) => l.expiry === selectedExpiry && l.strike === strike && l.optionType === optionType && l.type === type
    );
  }

  function togglePos(strike: number, optionType: "Call" | "Put", type: "Buy" | "Sell", premium: number) {
    setLegs((prev) => {
      const idx = prev.findIndex(
        (l) => l.expiry === selectedExpiry && l.strike === strike && l.optionType === optionType && l.type === type
      );
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      return [...prev, { expiry: selectedExpiry, strike, optionType, type, premium, quantity: 1 }];
    });
  }

  return (
    <div className="os-page" style={{ margin: "-24px", padding: "24px" }}>
      <style>{styles}</style>

      <div className="os-main">
        {/* ───────────── Option Chain Panel ───────────── */}
        <div className="oc-panel">

          {/* Header */}
          <div className="oc-header">
            <span className="oc-header-left">🗂 Add ons ▼</span>
            <span className="oc-title">
              Option Chain
              <span className="oc-expiry-label">
                {selectedExpiry ? ` (${formatExpiryLabel(selectedExpiry)})` : ""}
              </span>
              {marketTime && (
                <span className="oc-market-time">
                  {marketTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </span>
            <button className="oc-hide-btn" type="button">⟪ Hide</button>
          </div>

          {/* Expiry carousel */}
          <div className="expiry__viewer expiry-carousel">
            <button
              type="button"
              className="expiry-carousel__arrow"
              disabled={carouselOffset <= 0}
              onClick={() => setCarouselOffset((o) => Math.max(0, o - CAROUSEL_STEP))}
            >
              &#8249;
            </button>
            <div className="expiry-carousel__viewport" ref={viewportRef}>
              <div
                className="expiry-carousel__track"
                style={{ transform: `translateX(-${carouselOffset}px)` }}
              >
                {expiries.map((exp, idx) => {
                  const suffix = dteSuffix(exp, idx, expiries);
                  return (
                    <div
                      key={exp}
                      className={`expiry_button${exp === selectedExpiry ? " selected__oc__expiry" : ""}`}
                      onClick={() => setSelectedExpiry(exp)}
                    >
                      <button type="button">{formatExpiryLabel(exp)}</button>
                      <div className="expiry_indicator">({suffix})</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              className="expiry-carousel__arrow"
              disabled={carouselOffset >= maxOffset}
              onClick={() => setCarouselOffset((o) => Math.min(maxOffset, o + CAROUSEL_STEP))}
            >
              &#8250;
            </button>
          </div>

          {/* Filter row 1: ATM IV | ATM mode radio | Straddle Prem */}
          <div className="oc_filter">
            <div>
              ATM IV:&nbsp;
              <span style={{ color: "#464646", fontWeight: 500 }}>
                {atmIV > 0 ? (atmIV * 100).toFixed(0) : "—"}
              </span>
            </div>
            <div>
              <span style={{ marginRight: 6 }}>ATM:</span>
              <div className="squar__off__type">
                {(["Spot", "Fut", "SynthFut"] as AtmMode[]).map((mode) => (
                  <label
                    key={mode}
                    className={`checkbox-container${atmMode === mode ? " radio__active" : ""}`}
                    onClick={() => setAtmMode(mode)}
                  >
                    <div className="checkbox-label">
                      <span className="checkbox-custom radio__type" />
                    </div>
                    <div className="checkbox__title">
                      {mode === "SynthFut" ? "Synth Fut" : mode}
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div>
              Straddle Prem:&nbsp;
              <span style={{ color: "#464646", fontWeight: 500 }}>
                {straddlePrem > 0 ? straddlePrem.toFixed(2) : "—"}
              </span>
            </div>
          </div>

          {/* Filter row 2: PCR | OI bar | Max Pain */}
          <div className="oc_filter">
            <div>
              PCR:&nbsp;
              <span style={{ color: "#464646", fontWeight: 500 }}>{pcr.toFixed(2)}</span>
            </div>
            <div className="total_oi">
              <div className="total_call_oi">{fmtOI(totalCallOI)}</div>
              <div className="oi-progress">
                <div className="oi-progress-call" />
              </div>
              <span>OI</span>
              <div className="oi-progress">
                <div className="oi-progress-put" />
              </div>
              <div className="total_put_oi">{fmtOI(totalPutOI)}</div>
            </div>
            <div>
              Max Pain:&nbsp;
              <span style={{ color: "#464646", fontWeight: 500 }}>{maxPain || "—"}</span>
            </div>
          </div>

          {/* Option chain table */}
          <div className="oc-custom-table">
            <table>
              <thead>
                <tr>
                  <th className="oc-call-head">
                    Call LTP <span className="oc-head-delta">(Δ)</span>
                  </th>
                  <th className="oc-call-oi-head">Call OI</th>
                  <th className="oc-iv-head">IV</th>
                  <th className="oc-strike-head">Strike</th>
                  <th className="oc-put-oi-head">Put OI</th>
                  <th className="oc-put-head">
                    Put LTP <span className="oc-head-delta">(Δ)</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {strikes.map((strike) => {
                  const entry = strikeMap.get(strike)!;
                  const { call, put } = entry;
                  const isAtm = strike === atmStrike;
                  const isCallItm = strike < spotPrice;
                  const isPutItm = strike > spotPrice;

                  const callOI = call?.oi || 0;
                  const putOI = put?.oi || 0;
                  const callOIPct = maxCallOI > 0 ? ((callOI / maxCallOI) * 100).toFixed(1) : "0";
                  const putOIPct = maxPutOI > 0 ? ((putOI / maxPutOI) * 100).toFixed(1) : "0";

                  const callIV = call?.iv || 0;
                  const putIV = put?.iv || 0;
                  const combinedIV = callIV && putIV ? (callIV + putIV) / 2 : callIV || putIV;

                  const buyCallActive = hasPos(strike, "Call", "Buy");
                  const sellCallActive = hasPos(strike, "Call", "Sell");
                  const buyPutActive = hasPos(strike, "Put", "Buy");
                  const sellPutActive = hasPos(strike, "Put", "Sell");
                  const callHasActive = buyCallActive || sellCallActive;
                  const putHasActive = buyPutActive || sellPutActive;

                  let rowCls = "oc-row";
                  if (isAtm) rowCls += " oc-atm";
                  else if (isCallItm) rowCls += " oc-call-itm";
                  else if (isPutItm) rowCls += " oc-put-itm";

                  return (
                    <tr key={strike} className={rowCls}>

                      {/* Call LTP — [B][S] left, ltp delta right */}
                      <td className="oc-call">
                        <div className="oc-cell-inner">
                          <div className={`oc-actions action_button${callHasActive ? " has-active" : ""}`}>
                            <button
                              type="button"
                              className={`buy_button${buyCallActive ? " oc-btn-active" : ""}`}
                              onClick={() => togglePos(strike, "Call", "Buy", call?.close || 0)}
                            >
                              B
                            </button>
                            <button
                              type="button"
                              className={`sell_button${sellCallActive ? " oc-btn-active" : ""}`}
                              onClick={() => togglePos(strike, "Call", "Sell", call?.close || 0)}
                            >
                              S
                            </button>
                          </div>
                          {call ? (
                            <>
                              <span className="oc-ltp">{call.close.toFixed(2)}</span>
                              <span className="oc-delta">
                                ({call.delta != null ? call.delta.toFixed(2) : "—"})
                              </span>
                            </>
                          ) : (
                            <span className="oc-empty">—</span>
                          )}
                        </div>
                      </td>

                      {/* Call OI — bar fills right-to-left */}
                      <td className="oc-call-oi">
                        <div className="oc-oi-value oc-oi-call">{fmtOI(callOI)}</div>
                        <div className="oc-oi-bar-wrap">
                          <div
                            className="oc-oi-bar oc-oi-bar-call"
                            style={{ width: `${callOIPct}%` }}
                          />
                        </div>
                      </td>

                      {/* IV */}
                      <td className="oc-iv">
                        {combinedIV ? (
                          <span className="oc-iv-value">{(combinedIV * 100).toFixed(2)}%</span>
                        ) : (
                          <span className="oc-empty">—</span>
                        )}
                      </td>

                      {/* Strike */}
                      <td className="oc-strike">{strike}</td>

                      {/* Put OI — bar fills left-to-right */}
                      <td className="oc-put-oi">
                        <div className="oc-oi-value oc-oi-put">{fmtOI(putOI)}</div>
                        <div className="oc-oi-bar-wrap">
                          <div
                            className="oc-oi-bar oc-oi-bar-put"
                            style={{ width: `${putOIPct}%` }}
                          />
                        </div>
                      </td>

                      {/* Put LTP — ltp delta left, [B][S] right */}
                      <td className="oc-put">
                        <div className="oc-cell-inner">
                          {put ? (
                            <>
                              <span className="oc-ltp">{put.close.toFixed(2)}</span>
                              <span className="oc-delta">
                                ({put.delta != null ? put.delta.toFixed(2) : "—"})
                              </span>
                            </>
                          ) : (
                            <span className="oc-empty">—</span>
                          )}
                          <div className={`oc-actions action_button${putHasActive ? " has-active" : ""}`}>
                            <button
                              type="button"
                              className={`buy_button${buyPutActive ? " oc-btn-active" : ""}`}
                              onClick={() => togglePos(strike, "Put", "Buy", put?.close || 0)}
                            >
                              B
                            </button>
                            <button
                              type="button"
                              className={`sell_button${sellPutActive ? " oc-btn-active" : ""}`}
                              onClick={() => togglePos(strike, "Put", "Sell", put?.close || 0)}
                            >
                              S
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ───────────── Right panel ───────────── */}
        <div className="os-right-panel">
          <p>Payoff chart coming soon…</p>
        </div>
      </div>
    </div>
  );
}
