/**
 * replayHistory.ts
 * ─────────────────
 * Separate fetch utilities for Bar Replay historical data.
 *
 * Three independent functions — each hits a different API route:
 *   fetchOptionHistory   → /algo/mtm/historical-data       (leg OHLCV)
 *   fetchSpotHistory     → /algo/spot/historical-data      (underlying + VIX)
 *   fetchIVHistory       → /algo/option-chain/historical-iv (leg IV + Delta)
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string || "").replace(/\/+$/, "");

export type CandleSeries = {
  timestamp: string[];
  close: number[];
  iv?: number[];
  delta?: number[];
  oi?: number[];
};

export type HistoricalData = Record<string, CandleSeries>;

// ─── 1. Option leg OHLCV (existing API, called from here for consistency) ────

export async function fetchOptionHistory(
  tokens: string[],
  candle: string,
  activationMode: string,
): Promise<HistoricalData> {
  if (!tokens.length) return {};
  const url =
    `${API_BASE}/mtm/historical-data` +
    `?tokens=${encodeURIComponent(tokens.join(","))}` +
    `&candle=${encodeURIComponent(candle)}` +
    `&activation_mode=${encodeURIComponent(activationMode)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchOptionHistory: HTTP ${res.status}`);
  return res.json() as Promise<HistoricalData>;
}

// ─── 2. Underlying spot price + India VIX ────────────────────────────────────

export async function fetchSpotHistory(
  underlying: string,
  candle: string,
  activationMode: string,
): Promise<HistoricalData> {
  if (!underlying) return {};
  const url =
    `${API_BASE}/spot/historical-data` +
    `?underlying=${encodeURIComponent(underlying)}` +
    `&candle=${encodeURIComponent(candle)}` +
    `&activation_mode=${encodeURIComponent(activationMode)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchSpotHistory: HTTP ${res.status}`);
  return res.json() as Promise<HistoricalData>;
}

// ─── 3. Option leg IV + Delta (separate route, includes iv/delta fields) ──────

export async function fetchIVHistory(
  tokens: string[],
  candle: string,
  activationMode: string,
): Promise<HistoricalData> {
  if (!tokens.length) return {};
  const url =
    `${API_BASE}/option-chain/historical-iv` +
    `?tokens=${encodeURIComponent(tokens.join(","))}` +
    `&candle=${encodeURIComponent(candle)}` +
    `&activation_mode=${encodeURIComponent(activationMode)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchIVHistory: HTTP ${res.status}`);
  return res.json() as Promise<HistoricalData>;
}

// ─── Helper: look up price from stored series at a given timestamp ────────────

export function getLtpAtTime(
  historicalData: HistoricalData,
  isoTs: string,
): Record<string, number> {
  const target = isoTs.replace(" ", "T");
  const ltpMap: Record<string, number> = {};

  for (const [tokenKey, series] of Object.entries(historicalData)) {
    const timestamps = series.timestamp ?? [];
    const closes     = series.close ?? [];
    let price: number | undefined;

    for (let i = timestamps.length - 1; i >= 0; i--) {
      if (timestamps[i].replace(" ", "T") <= target) {
        price = closes[i];
        break;
      }
    }

    if (price != null) {
      ltpMap[tokenKey] = price;
      // also store the numeric part so both "NSE_TOKEN" and "TOKEN" lookups work
      const numPart = tokenKey.includes("_") ? tokenKey.split("_").pop()! : tokenKey;
      if (numPart !== tokenKey) ltpMap[numPart] = price;
    }
  }

  return ltpMap;
}
