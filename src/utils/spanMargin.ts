// NSE SPAN Margin Calculator — TypeScript port of span_margin.py

// ─── Constants ────────────────────────────────────────────────────────────────

export const RISK_FREE_RATE = 0.065;
export const DEFAULT_IV = 0.15;
export const MIN_IV = 0.01;

export const SPAN_SCENARIOS: [number, number, number][] = [
  [+1.00, +1.00, 1.0], [+1.00, -1.00, 1.0],
  [-1.00, +1.00, 1.0], [-1.00, -1.00, 1.0],
  [+0.67, +1.00, 1.0], [+0.67, -1.00, 1.0],
  [-0.67, +1.00, 1.0], [-0.67, -1.00, 1.0],
  [+0.33, +1.00, 1.0], [+0.33, -1.00, 1.0],
  [-0.33, +1.00, 1.0], [-0.33, -1.00, 1.0],
  [ 0.00,  0.00, 1.0], [ 0.00,  0.00, 1.0],
  [+2.00,  0.00, 0.35], [-2.00,  0.00, 0.35],
];

export let PSR_PCT: Record<string, number> = {
  NIFTY: 0.100, BANKNIFTY: 0.105, FINNIFTY: 0.105,
  MIDCPNIFTY: 0.120, SENSEX: 0.100, BANKEX: 0.105,
};
export const PSR_PCT_DEFAULT = 0.105;

export const VSR_ABS: Record<string, number> = {
  NIFTY: 0.04, BANKNIFTY: 0.04, FINNIFTY: 0.04,
  MIDCPNIFTY: 0.04, SENSEX: 0.04, BANKEX: 0.04,
};
export const VSR_ABS_DEFAULT = 0.04;

export const SOMC_PER_LOT: Record<string, number> = {
  NIFTY: 21000, BANKNIFTY: 45000, FINNIFTY: 16000,
  MIDCPNIFTY: 14000, SENSEX: 21000, BANKEX: 45000,
};
export const SOMC_DEFAULT = 10000;

export const EXPOSURE_RATE: Record<string, number> = {
  NIFTY: 0.020, BANKNIFTY: 0.020, FINNIFTY: 0.020,
  MIDCPNIFTY: 0.020, SENSEX: 0.020, BANKEX: 0.020,
};
export const EXPOSURE_RATE_DEFAULT = 0.020;

export const MIS_MULTIPLIER: Record<string, Record<string, number>> = {
  kite:      { FUT: 0.20, CE: 0.25, PE: 0.25 },
  flattrade: { FUT: 0.20, CE: 0.25, PE: 0.25 },
};

export const LOT_SIZES: Record<string, number> = {
  NIFTY: 75, BANKNIFTY: 15, FINNIFTY: 65, MIDCPNIFTY: 120, SENSEX: 10, BANKEX: 15,
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SpanPos {
  id?: string;
  underlying: string;
  instrument_type: string;
  expiry: string;
  strike: number;
  transaction_type: string;
  quantity: number;
  lot_size: number;
  ltp: number;
  spot: number;
}

export interface LegResult {
  id?: string;
  instrument_type: string;
  expiry: string;
  strike: number;
  transaction_type: string;
  quantity: number;
  lot_size: number;
  ltp: number;
  span_contribution: number;
  exposure_margin: number;
  total_margin: number;
  implied_vol: number;
  somc_applied: boolean;
}

export interface SpanMarginResult {
  span_margin: number;
  exposure_margin: number;
  total_margin: number;
  premium_received: number;
  net_margin: number;
  legs: LegResult[];
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const a = [0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429];
  const p = 0.3275911;
  const t = 1 / (1 + p * Math.abs(x));
  let poly = 0, tp = t;
  for (const ai of a) { poly += ai * tp; tp *= t; }
  return sign * (1 - poly * Math.exp(-x * x));
}

function ncdf(x: number): number { return 0.5 * (1 + erf(x / Math.SQRT2)); }
function npdf(x: number): number { return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI); }

export function bsPrice(S: number, K: number, T: number, r: number, sigma: number, type: string): number {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0)
    return type === "CE" ? Math.max(0, S - K) : Math.max(0, K - S);
  try {
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    if (type === "CE") return S * ncdf(d1) - K * Math.exp(-r * T) * ncdf(d2);
    return K * Math.exp(-r * T) * ncdf(-d2) - S * ncdf(-d1);
  } catch { return Math.max(0, type === "CE" ? S - K : K - S); }
}

function bsVega(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0 || sigma <= 0 || S <= 0) return 0;
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  return S * npdf(d1) * Math.sqrt(T);
}

export function impliedVol(S: number, K: number, T: number, r: number, mktPrice: number, type: string): number {
  if (T <= 0 || mktPrice <= 0 || S <= 0 || K <= 0) return DEFAULT_IV;
  const intrinsic = type === "CE" ? Math.max(0, S - K) : Math.max(0, K - S);
  if (mktPrice <= intrinsic) return MIN_IV;
  let sigma = DEFAULT_IV;
  for (let i = 0; i < 100; i++) {
    const price = bsPrice(S, K, T, r, sigma, type);
    const vega = bsVega(S, K, T, r, sigma);
    const diff = price - mktPrice;
    if (Math.abs(diff) < 1e-6) break;
    if (Math.abs(vega) < 1e-8) break;
    sigma -= diff / vega;
    sigma = Math.max(MIN_IV, Math.min(sigma, 5.0));
  }
  return Math.max(MIN_IV, sigma);
}

export function updatePsrFromVix(vixPct: number): void {
  const psr = 3.5 * (vixPct / 100) / Math.sqrt(252);
  PSR_PCT = {
    NIFTY: psr, BANKNIFTY: psr * 1.05, FINNIFTY: psr * 1.05,
    MIDCPNIFTY: psr * 1.20, SENSEX: psr, BANKEX: psr * 1.05,
  };
}

// ─── SPAN core ────────────────────────────────────────────────────────────────

function parseExpiry(exp: string): Date {
  let clean = exp.trim();
  // Strip time component: "2025-11-04 15:30:00" or "2025-11-04T15:30:00"
  if (clean.length > 10 && (clean[10] === ' ' || clean[10] === 'T')) clean = clean.slice(0, 10);
  // YYYY-MM-DD — use local date constructor to avoid UTC midnight shift
  const iso = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  // DDMMMYYYY e.g. 04NOV2025
  const m = clean.match(/^(\d{2})([A-Z]{3})(\d{4})$/);
  if (m) {
    const months: Record<string, number> = {
      JAN:0, FEB:1, MAR:2, APR:3, MAY:4, JUN:5,
      JUL:6, AUG:7, SEP:8, OCT:9, NOV:10, DEC:11,
    };
    return new Date(+m[3], months[m[2]] ?? 0, +m[1]);
  }
  return new Date(clean);
}

export function daysToExpiry(expiry: string): number {
  try {
    const exp = parseExpiry(expiry);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.max(1, Math.round((exp.getTime() - today.getTime()) / 86400000));
  } catch { return 30; }
}

function effectiveSpot(pos: SpanPos): number {
  if (pos.spot > 0) return pos.spot;
  if (pos.instrument_type.toUpperCase() === "FUT" && pos.ltp > 0) return pos.ltp;
  if (pos.strike > 0) return pos.strike;
  return pos.ltp || 1;
}

function psrValue(pos: SpanPos): number {
  return effectiveSpot(pos) * (PSR_PCT[pos.underlying.toUpperCase()] ?? PSR_PCT_DEFAULT);
}

function vsrValue(pos: SpanPos): number {
  return VSR_ABS[pos.underlying.toUpperCase()] ?? VSR_ABS_DEFAULT;
}

function signedQty(pos: SpanPos): number {
  return pos.transaction_type.toUpperCase() === "BUY" ? pos.quantity : -pos.quantity;
}

function totalQty(pos: SpanPos): number {
  return Math.abs(pos.quantity) * pos.lot_size;
}

function isShort(pos: SpanPos): boolean { return pos.transaction_type.toUpperCase() === "SELL"; }
function isOption(pos: SpanPos): boolean {
  const t = pos.instrument_type.toUpperCase();
  return t === "CE" || t === "PE";
}
function isFutures(pos: SpanPos): boolean { return pos.instrument_type.toUpperCase() === "FUT"; }

function scenarioPnl(pos: SpanPos): number[] {
  const psr = psrValue(pos);
  const vsr = vsrValue(pos);
  const spot = effectiveSpot(pos);
  const T = daysToExpiry(pos.expiry) / 365;
  const r = RISK_FREE_RATE;
  const sq = signedQty(pos);
  const qty = totalQty(pos);

  if (isFutures(pos)) {
    return SPAN_SCENARIOS.map(([pf, , w]) => pf * psr * qty * sq * w);
  }

  const K = pos.strike;
  const otype = pos.instrument_type.toUpperCase();
  let iv: number, currentPrice: number;
  if (pos.ltp > 0) {
    iv = impliedVol(spot, K, T, r, pos.ltp, otype);
    currentPrice = pos.ltp;
  } else {
    iv = DEFAULT_IV;
    currentPrice = Math.max(0.01, bsPrice(spot, K, T, r, DEFAULT_IV, otype));
  }

  return SPAN_SCENARIOS.map(([pf, vf, w]) => {
    const sSpot = Math.max(0.01, spot + pf * psr);
    const sVol  = Math.max(MIN_IV, iv + vf * vsr);
    return (bsPrice(sSpot, K, T, r, sVol, otype) - currentPrice) * qty * sq * w;
  });
}

function standaloneSpan(pos: SpanPos): number {
  const s = scenarioPnl(pos);
  return Math.max(0, Math.max(...s.map(v => -v)));
}

// ─── Main calculation ─────────────────────────────────────────────────────────

export function calculateMargin(
  positions: SpanPos[],
  product = "NRML",
  broker = "kite",
): SpanMarginResult {
  const empty: SpanMarginResult = { span_margin: 0, exposure_margin: 0, total_margin: 0, premium_received: 0, net_margin: 0, legs: [] };
  if (!positions.length) return empty;

  const grouped = new Map<string, SpanPos[]>();
  for (const pos of positions) {
    const key = pos.underlying.toUpperCase();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(pos);
  }

  let totalSpan = 0, totalExposure = 0, premiumRcvd = 0;
  const legDetails: LegResult[] = [];

  for (const [underlying, legs] of grouped) {
    const expRate = EXPOSURE_RATE[underlying] ?? EXPOSURE_RATE_DEFAULT;
    const somcLot = SOMC_PER_LOT[underlying]  ?? SOMC_DEFAULT;
    const r = RISK_FREE_RATE;

    const legIvs   = legs.map(pos => isOption(pos) ? impliedVol(effectiveSpot(pos), pos.strike, daysToExpiry(pos.expiry) / 365, r, pos.ltp, pos.instrument_type.toUpperCase()) : 0);
    const legSpans = legs.map(pos => standaloneSpan(pos));

    const idx = (arr: SpanPos[], fn: (p: SpanPos) => boolean) => arr.map((_, i) => i).filter(i => fn(arr[i]));
    const ceShorts = idx(legs, p => isOption(p) && p.instrument_type.toUpperCase() === "CE" && isShort(p));
    const ceLongs  = idx(legs, p => isOption(p) && p.instrument_type.toUpperCase() === "CE" && !isShort(p));
    const peShorts = idx(legs, p => isOption(p) && p.instrument_type.toUpperCase() === "PE" && isShort(p));
    const peLongs  = idx(legs, p => isOption(p) && p.instrument_type.toUpperCase() === "PE" && !isShort(p));
    const futs     = idx(legs, p => isFutures(p));

    function matchSpreads(shorts: number[], longs: number[], isCall: boolean): [number, Set<number>, Set<number>] {
      const matchedS = new Set<number>(), matchedL = new Set<number>();
      let span = 0;
      const avail = [...longs].sort((a, b) => isCall ? legs[a].strike - legs[b].strike : legs[b].strike - legs[a].strike);
      for (const si of shorts) {
        for (const li of avail) {
          if (matchedL.has(li)) continue;
          const [sp, lp] = [legs[si], legs[li]];
          if (lp.lot_size !== sp.lot_size || lp.quantity < sp.quantity) continue;
          span += Math.min(legSpans[si], Math.abs(lp.strike - sp.strike) * totalQty(sp));
          matchedS.add(si); matchedL.add(li); break;
        }
      }
      return [span, matchedS, matchedL];
    }

    const [ceSpan, ceMS, ] = matchSpreads(ceShorts, ceLongs, true);
    const [peSpan, peMS, ] = matchSpreads(peShorts, peLongs, false);
    const nakedCe = ceShorts.filter(i => !ceMS.has(i));
    const nakedPe = peShorts.filter(i => !peMS.has(i));

    let nkCeSpan = nakedCe.length ? Math.max(...nakedCe.map(i => legSpans[i])) : 0;
    let nkPeSpan = nakedPe.length ? Math.max(...nakedPe.map(i => legSpans[i])) : 0;
    for (const i of nakedCe) nkCeSpan = Math.max(nkCeSpan, somcLot * legs[i].quantity);
    for (const i of nakedPe) nkPeSpan = Math.max(nkPeSpan, somcLot * legs[i].quantity);

    const optionsSpan = Math.max(nkCeSpan + ceSpan, nkPeSpan + peSpan);

    let futSpan = 0;
    let unhedged = [...futs];
    for (const fi of futs) {
      const fpos = legs[fi];
      for (const li of [...ceLongs, ...peLongs]) {
        const lpos = legs[li];
        if (lpos.lot_size !== fpos.lot_size) continue;
        const combined = scenarioPnl(fpos).map((v, i) => v + scenarioPnl(lpos)[i]);
        futSpan += Math.max(0, Math.max(...combined.map(v => -v)));
        unhedged = unhedged.filter(x => x !== fi);
        break;
      }
    }
    for (const fi of unhedged) futSpan += legSpans[fi];

    totalSpan += optionsSpan + futSpan;

    let groupExposure = 0;
    for (const pos of legs) {
      if (isShort(pos) || isFutures(pos)) groupExposure += effectiveSpot(pos) * totalQty(pos) * expRate;
      if (isShort(pos) && isOption(pos))  premiumRcvd    += pos.ltp * totalQty(pos);
    }
    totalExposure += groupExposure;

    const somcSet = new Set([...nakedCe, ...nakedPe]);
    legs.forEach((pos, i) => {
      const legExp  = (isShort(pos) || isFutures(pos)) ? effectiveSpot(pos) * totalQty(pos) * expRate : 0;
      const legSpan = (isShort(pos) || isFutures(pos)) ? legSpans[i] : 0;
      legDetails.push({
        id: pos.id,
        instrument_type:  pos.instrument_type.toUpperCase(),
        expiry:           pos.expiry,
        strike:           pos.strike,
        transaction_type: pos.transaction_type.toUpperCase(),
        quantity:         pos.quantity,
        lot_size:         pos.lot_size,
        ltp:              pos.ltp,
        span_contribution: Math.round(legSpan * 100) / 100,
        exposure_margin:   Math.round(legExp  * 100) / 100,
        total_margin:      Math.round((legSpan + legExp) * 100) / 100,
        implied_vol:       Math.round(legIvs[i] * 10000) / 100,
        somc_applied:      somcSet.has(i),
      });
    });
  }

  let totalMargin = totalSpan + totalExposure;
  let netMargin   = Math.max(0, totalMargin - premiumRcvd);

  if (product.toUpperCase() === "MIS") {
    const bm   = MIS_MULTIPLIER[broker.toLowerCase()] ?? MIS_MULTIPLIER.kite;
    const shFt = positions.filter(p => isShort(p) || isFutures(p));
    const mult = shFt.length ? Math.min(...shFt.map(p => bm[p.instrument_type.toUpperCase()] ?? 0.25)) : 1.0;
    totalSpan     = Math.round(totalSpan     * mult * 100) / 100;
    totalExposure = Math.round(totalExposure * mult * 100) / 100;
    totalMargin   = Math.round(totalMargin   * mult * 100) / 100;
    netMargin     = Math.round(netMargin     * mult * 100) / 100;
  }

  return {
    span_margin:      Math.round(totalSpan     * 100) / 100,
    exposure_margin:  Math.round(totalExposure * 100) / 100,
    total_margin:     Math.round(totalMargin   * 100) / 100,
    premium_received: Math.round(premiumRcvd   * 100) / 100,
    net_margin:       Math.round(netMargin     * 100) / 100,
    legs: legDetails,
  };
}
