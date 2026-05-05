import { useEffect, useRef, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import {
  calculateMargin, updatePsrFromVix, LOT_SIZES,
  SpanPos, SpanMarginResult, PSR_PCT,
} from "../../utils/spanMargin";

const UNDERLYINGS = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX", "BANKEX"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface LegRow {
  id: string;
  underlying: string;
  instrument_type: "CE" | "PE" | "FUT";
  expiry: string;
  strike: string;
  quantity: string;
  side: "BUY" | "SELL";
  spot: string;
  ltp: string;
}

function fmt(n: number) {
  return "₹ " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function uid() { return Math.random().toString(36).slice(2); }

function defaultLeg(): LegRow {
  return { id: uid(), underlying: "NIFTY", instrument_type: "CE", expiry: "", strike: "", quantity: "1", side: "SELL", spot: "", ltp: "" };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MarginCalculator({ socketVix }: { socketVix?: number }) {
  const [legs, setLegs] = useState<LegRow[]>([defaultLeg()]);
  const [product, setProduct] = useState<"NRML" | "MIS">("NRML");
  const [broker, setBroker] = useState("kite");
  const [vix, setVix] = useState("");
  const [useVix, setUseVix] = useState(false);
  const [result, setResult] = useState<SpanMarginResult | null>(null);
  const calcRef = useRef(0);

  function updateLeg(id: string, patch: Partial<LegRow>) {
    setLegs(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  }

  function addLeg() { setLegs(prev => [...prev, defaultLeg()]); }
  function removeLeg(id: string) { setLegs(prev => prev.filter(l => l.id !== id)); }

  function calculate() {
    const token = ++calcRef.current;
    const vixVal = parseFloat(vix);
    if (useVix && vixVal > 0) updatePsrFromVix(vixVal);
    else Object.assign(PSR_PCT, { NIFTY: 0.100, BANKNIFTY: 0.105, FINNIFTY: 0.105, MIDCPNIFTY: 0.120, SENSEX: 0.100, BANKEX: 0.105 });

    const positions: SpanPos[] = legs
      .filter(l => l.strike && l.expiry && parseFloat(l.spot || "0") > 0)
      .map(l => ({
        id: l.id,
        underlying: l.underlying,
        instrument_type: l.instrument_type,
        expiry: l.expiry,
        strike: parseFloat(l.strike) || 0,
        transaction_type: l.side,
        quantity: parseInt(l.quantity) || 1,
        lot_size: LOT_SIZES[l.underlying] ?? 1,
        ltp: parseFloat(l.ltp) || 0,
        spot: parseFloat(l.spot) || 0,
      }));

    if (!positions.length || token !== calcRef.current) { setResult(null); return; }
    setResult(calculateMargin(positions, product, broker));
  }

  useEffect(() => {
    if (socketVix && socketVix > 0) setVix(String(socketVix));
  }, [socketVix]);

  useEffect(() => {
    const filled = legs.filter(l => l.strike && l.expiry && parseFloat(l.spot || "0") > 0);
    if (filled.length) calculate();
    else setResult(null);
  }, [legs, product, broker, useVix, vix]);

  const vixVal = parseFloat(vix) || 0;
  const psrIfVix = vixVal > 0 ? 3.5 * (vixVal / 100) / Math.sqrt(252) : null;

  return (
    <>
      <PageMeta title="Margin Calculator" description="SPAN Margin Calculator with India VIX" />
      <div className="min-h-screen bg-[#f4f7fa] p-5">
        <div className="max-w-[1200px] mx-auto">

          <div className="mb-5">
            <h1 className="text-[22px] font-semibold text-[#1f2937]">SPAN Margin Calculator</h1>
            <p className="text-[13px] text-[#6b7280] mt-0.5">Client-side NSE SPAN — Black-Scholes, 16 scenarios, no API call</p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-end gap-4 mb-5 bg-white rounded-xl border border-[#e5e7eb] shadow-sm px-5 py-4">

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[#374151]">
                India VIX
                {socketVix && socketVix > 0 && <span className="ml-1.5 text-[10px] font-normal text-[#16a34a]">● live</span>}
              </label>
              <input type="number" step="0.01" min="0" placeholder="e.g. 15.5"
                value={vix} onChange={e => setVix(e.target.value)}
                className="w-[100px] rounded-lg border border-[#d1d5db] px-2.5 py-1.5 text-[13px] text-[#111827] focus:outline-none focus:border-[#2563eb]" />
              {psrIfVix && (
                <span className="text-[11px] text-[#6b7280]">
                  PSR: NIFTY {(psrIfVix * 100).toFixed(2)}% • BNF {(psrIfVix * 1.05 * 100).toFixed(2)}%
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[#374151]">Use VIX for PSR</label>
              <button type="button" onClick={() => setUseVix(v => !v)}
                className={`w-[46px] h-6 rounded-full border-2 transition-colors relative ${useVix ? "bg-[#2563eb] border-[#2563eb]" : "bg-[#e5e7eb] border-[#d1d5db]"}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${useVix ? "left-6" : "left-0.5"}`} />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[#374151]">Product</label>
              <select value={product} onChange={e => setProduct(e.target.value as "NRML" | "MIS")}
                className="rounded-lg border border-[#d1d5db] px-2.5 py-1.5 text-[13px] text-[#111827] focus:outline-none focus:border-[#2563eb] bg-white">
                <option value="NRML">NRML (Overnight)</option>
                <option value="MIS">MIS (Intraday)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[#374151]">Broker (MIS leverage)</label>
              <select value={broker} onChange={e => setBroker(e.target.value)}
                className="rounded-lg border border-[#d1d5db] px-2.5 py-1.5 text-[13px] text-[#111827] focus:outline-none focus:border-[#2563eb] bg-white">
                <option value="kite">Zerodha (Kite)</option>
                <option value="flattrade">Flattrade</option>
              </select>
            </div>

            <button onClick={calculate}
              className="h-9 px-5 rounded-lg bg-[#2563eb] text-white text-[13px] font-semibold hover:bg-[#1d4ed8] transition-colors shadow-sm">
              Calculate
            </button>
          </div>

          {/* Legs table */}
          <div className="bg-white rounded-xl border border-[#e5e7eb] shadow-sm mb-5 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e5e7eb]">
              <span className="text-[14px] font-semibold text-[#1f2937]">Legs</span>
              <button onClick={addLeg}
                className="h-8 px-4 rounded-lg bg-[#eff6ff] border border-[#bfdbfe] text-[#2563eb] text-[12px] font-medium hover:bg-[#dbeafe] transition-colors">
                + Add Leg
              </button>
            </div>
            <div className="grid grid-cols-[1fr_80px_80px_90px_100px_80px_90px_90px_40px] gap-2 px-4 py-2 bg-[#f9fafb] text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide border-b border-[#e5e7eb]">
              <span>Underlying</span><span>Type</span><span>Side</span>
              <span>Expiry</span><span>Strike</span><span>Qty(lots)</span>
              <span>Spot</span><span>LTP</span><span></span>
            </div>

            {legs.map(leg => (
              <div key={leg.id} className="grid grid-cols-[1fr_80px_80px_90px_100px_80px_90px_90px_40px] gap-2 items-center px-4 py-2 border-b border-[#f3f4f6] last:border-0 hover:bg-[#f9fafb]">
                <select value={leg.underlying} onChange={e => updateLeg(leg.id, { underlying: e.target.value, strike: "" })}
                  className="rounded border border-[#d1d5db] px-2 py-1 text-[12px] focus:outline-none focus:border-[#2563eb] bg-white text-[#111827]">
                  {UNDERLYINGS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <select value={leg.instrument_type} onChange={e => updateLeg(leg.id, { instrument_type: e.target.value as "CE" | "PE" | "FUT" })}
                  className="rounded border border-[#d1d5db] px-2 py-1 text-[12px] focus:outline-none focus:border-[#2563eb] bg-white text-[#111827]">
                  <option value="CE">CE</option><option value="PE">PE</option><option value="FUT">FUT</option>
                </select>
                <select value={leg.side} onChange={e => updateLeg(leg.id, { side: e.target.value as "BUY" | "SELL" })}
                  className="rounded border border-[#d1d5db] px-2 py-1 text-[12px] focus:outline-none focus:border-[#2563eb] bg-white text-[#111827]">
                  <option value="SELL">SELL</option><option value="BUY">BUY</option>
                </select>
                <input type="text" placeholder="29MAY2025" value={leg.expiry}
                  onChange={e => updateLeg(leg.id, { expiry: e.target.value })}
                  className="rounded border border-[#d1d5db] px-2 py-1 text-[12px] focus:outline-none focus:border-[#2563eb] w-full" />
                <input type="number" placeholder="24000" value={leg.strike}
                  onChange={e => updateLeg(leg.id, { strike: e.target.value })}
                  className="rounded border border-[#d1d5db] px-2 py-1 text-[12px] focus:outline-none focus:border-[#2563eb] w-full" />
                <input type="number" min="1" placeholder="1" value={leg.quantity}
                  onChange={e => updateLeg(leg.id, { quantity: e.target.value })}
                  className="rounded border border-[#d1d5db] px-2 py-1 text-[12px] focus:outline-none focus:border-[#2563eb] w-full" />
                <input type="number" placeholder="24500" value={leg.spot}
                  onChange={e => updateLeg(leg.id, { spot: e.target.value })}
                  className="rounded border border-[#d1d5db] px-2 py-1 text-[12px] focus:outline-none focus:border-[#2563eb] w-full" />
                <input type="number" placeholder="120" value={leg.ltp}
                  onChange={e => updateLeg(leg.id, { ltp: e.target.value })}
                  className="rounded border border-[#d1d5db] px-2 py-1 text-[12px] focus:outline-none focus:border-[#2563eb] w-full" />
                <button onClick={() => removeLeg(leg.id)}
                  className="flex items-center justify-center w-7 h-7 rounded-lg text-[#9ca3af] hover:text-[#ef4444] hover:bg-[#fef2f2] transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: "SPAN Margin",       value: fmt(result.span_margin),      color: "#1e3a5f" },
                  { label: "Exposure Margin",    value: fmt(result.exposure_margin),  color: "#1e3a5f" },
                  { label: "Total Margin",       value: fmt(result.total_margin),     color: "#1e3a5f", bold: true },
                  { label: "Premium Received",   value: fmt(result.premium_received), color: "#059669" },
                  { label: "Net Margin",         value: fmt(result.net_margin),       color: result.net_margin > 0 ? "#2563eb" : "#059669", bold: true },
                ].map(c => (
                  <div key={c.label} className="bg-white rounded-xl border border-[#e5e7eb] shadow-sm px-4 py-3.5">
                    <div className="text-[11px] text-[#6b7280] mb-1">{c.label}</div>
                    <div className={`text-[15px] font-${c.bold ? "bold" : "semibold"} tabular-nums`} style={{ color: c.color }}>{c.value}</div>
                  </div>
                ))}
              </div>

              {result.legs.length > 0 && (
                <div className="bg-white rounded-xl border border-[#e5e7eb] shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#e5e7eb]">
                    <span className="text-[14px] font-semibold text-[#1f2937]">Per-Leg Breakdown</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="bg-[#f9fafb] text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide">
                          {["Type","Side","Expiry","Strike","Qty","LTP","IV %","SPAN","Exposure","Total","SOMC"].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.legs.map((leg, i) => (
                          <tr key={i} className="border-t border-[#f3f4f6] hover:bg-[#f9fafb]">
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${leg.instrument_type === "CE" ? "bg-[#dcfce7] text-[#16a34a]" : leg.instrument_type === "PE" ? "bg-[#fee2e2] text-[#dc2626]" : "bg-[#eff6ff] text-[#2563eb]"}`}>
                                {leg.instrument_type}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-[11px] font-semibold ${leg.transaction_type === "SELL" ? "text-[#dc2626]" : "text-[#16a34a]"}`}>{leg.transaction_type}</span>
                            </td>
                            <td className="px-3 py-2 text-[#374151] whitespace-nowrap">{leg.expiry}</td>
                            <td className="px-3 py-2 text-[#374151] tabular-nums">{leg.strike.toLocaleString("en-IN")}</td>
                            <td className="px-3 py-2 text-[#374151] tabular-nums">{leg.quantity} × {leg.lot_size}</td>
                            <td className="px-3 py-2 text-[#374151] tabular-nums">{leg.ltp.toFixed(2)}</td>
                            <td className="px-3 py-2 text-[#374151] tabular-nums">{leg.implied_vol.toFixed(2)}%</td>
                            <td className="px-3 py-2 text-[#374151] tabular-nums">{leg.span_contribution > 0 ? fmt(leg.span_contribution) : "—"}</td>
                            <td className="px-3 py-2 text-[#374151] tabular-nums">{leg.exposure_margin > 0 ? fmt(leg.exposure_margin) : "—"}</td>
                            <td className="px-3 py-2 font-semibold text-[#1e3a5f] tabular-nums">{leg.total_margin > 0 ? fmt(leg.total_margin) : "—"}</td>
                            <td className="px-3 py-2">
                              {leg.somc_applied && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#fef3c7] text-[#92400e] font-medium">SOMC</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {useVix && vixVal > 0 && psrIfVix && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-[#eff6ff] border border-[#bfdbfe] text-[12px] text-[#1e40af]">
                  <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
                  </svg>
                  <span>PSR from India VIX {vixVal.toFixed(2)}% → NIFTY {(psrIfVix * 100).toFixed(2)}% (3.5 × VIX / √252)</span>
                </div>
              )}
            </div>
          )}

          {!result && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-[14px] font-medium text-[#374151]">Add legs with spot price to see margin</p>
              <p className="text-[12px] text-[#9ca3af] mt-1">Fill in Underlying, Expiry, Strike, Spot, and LTP</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
