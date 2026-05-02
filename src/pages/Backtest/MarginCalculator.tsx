import { useCallback, useEffect, useRef, useState } from "react";
import PageMeta from "../../components/common/PageMeta";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

// ─── Constants ────────────────────────────────────────────────────────────────

const LOT_SIZES: Record<string, number> = {
  NIFTY: 65,
  BANKNIFTY: 15,
  FINNIFTY: 65,
  MIDCPNIFTY: 120,
  SENSEX: 10,
  BANKEX: 15,
};

const UNDERLYINGS = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX", "BANKEX"];
const BROKERS = [
  { value: "kite",      label: "Zerodha (Kite)" },
  { value: "flattrade", label: "Flattrade" },
];
const PRODUCTS = [
  { value: "NRML", label: "NRML (Overnight)" },
  { value: "MIS",  label: "MIS (Intraday)" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface LegForm {
  underlying: string;
  product: "Options" | "Futures";
  optionType: "CE" | "PE";
  expiry: string;
  strike: string;
  spot: string;
  ltp: string;
  quantity: string;
  side: "BUY" | "SELL";
}

interface LegRow {
  id: string;
  underlying: string;
  instrument_type: string; // CE | PE | FUT
  expiry: string;
  strike: number;
  lot_size: number;
  quantity: number;
  side: "BUY" | "SELL";
  spot: string;
  ltp: string;
  // result fields (filled after calculate)
  iv?: number;
  span?: number;
  exposure?: number;
  total?: number;
}

interface MarginResult {
  span_margin: number;
  exposure_margin: number;
  total_margin: number;
  premium_received: number;
  net_margin: number;
  legs: Array<{
    underlying: string;
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
  }>;
}

interface OptionChainContract {
  instrument: string;
  expiry: string;
  strike: number;
  option_type: "CE" | "PE" | string;
  token?: string;
  symbol?: string;
  exchange?: string;
  ltp: number;
}

interface OptionChainResponse {
  instrument: string;
  spot_price?: number;
  expiries?: string[];
  option_chain?: OptionChainContract[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Format number as Indian currency ₹1,47,329 */
function inr(value: number): string {
  if (!isFinite(value) || isNaN(value)) return "₹0";
  const n = Math.round(value);
  const s = Math.abs(n).toString();
  let result = "";
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  if (rest.length > 0) {
    result = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  } else {
    result = last3;
  }
  return (n < 0 ? "-₹" : "₹") + result;
}

function strikeToString(value: number | string): string {
  const numeric = typeof value === "number" ? value : parseFloat(String(value));
  if (!isFinite(numeric) || isNaN(numeric)) return "";
  return Number.isInteger(numeric) ? String(Math.trunc(numeric)) : String(numeric);
}

function formatPriceInput(value: number): string {
  if (!isFinite(value) || isNaN(value) || value <= 0) return "";
  return Number.isInteger(value) ? String(Math.trunc(value)) : value.toFixed(2);
}

function formatExpiryLabel(value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return raw;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const day = String(dt.getDate()).padStart(2, "0");
  return `${day}${months[dt.getMonth()]}${dt.getFullYear()}`;
}

// ─── Scoped CSS ───────────────────────────────────────────────────────────────

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

const styles = scopeCss(`
  * { box-sizing: border-box; }

  .mc-page {
    min-height: 100vh;
    background: #f4f6fa;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: #1a1a2e;
    padding: 24px;
  }

  .mc-header {
    margin-bottom: 20px;
  }

  .mc-title {
    font-size: 20px;
    font-weight: 700;
    color: #1a1a2e;
    margin: 0 0 4px 0;
  }

  .mc-subtitle {
    font-size: 13px;
    color: #64748b;
    margin: 0;
  }

  /* ── Main layout ── */
  .mc-layout {
    display: flex;
    gap: 20px;
    align-items: flex-start;
  }

  /* ── Form panel ── */
  .mc-form-panel {
    flex: 0 0 340px;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 1px 4px rgba(0,0,0,.06);
  }

  .mc-panel-title {
    font-size: 14px;
    font-weight: 600;
    color: #374151;
    margin: 0 0 16px 0;
    padding-bottom: 12px;
    border-bottom: 1px solid #f1f5f9;
  }

  .mc-field {
    margin-bottom: 12px;
  }

  .mc-label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: #6b7280;
    margin-bottom: 5px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .mc-select, .mc-input {
    width: 100%;
    height: 36px;
    padding: 0 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 13px;
    color: #1f2937;
    background: #fff;
    outline: none;
    transition: border-color .15s;
    appearance: none;
    -webkit-appearance: none;
  }

  .mc-select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%236b7280'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    background-size: 16px;
    padding-right: 28px;
    cursor: pointer;
  }

  .mc-select:focus, .mc-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59,130,246,.15);
  }

  .mc-input-hint {
    font-size: 11px;
    color: #94a3b8;
    margin-top: 4px;
  }

  /* ── Side radio ── */
  .mc-side-group {
    display: flex;
    gap: 0;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    overflow: hidden;
  }

  .mc-side-btn {
    flex: 1;
    height: 36px;
    border: none;
    background: #fff;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all .15s;
    color: #6b7280;
  }

  .mc-side-btn:first-child { border-right: 1px solid #d1d5db; }

  .mc-side-btn.buy-active {
    background: #dcfce7;
    color: #16a34a;
  }

  .mc-side-btn.sell-active {
    background: #fee2e2;
    color: #dc2626;
  }

  /* ── Form actions ── */
  .mc-form-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }

  .mc-btn-add {
    flex: 1;
    height: 38px;
    background: #3b82f6;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background .15s;
  }

  .mc-btn-add:hover { background: #2563eb; }

  .mc-btn-reset {
    height: 38px;
    padding: 0 16px;
    background: #fff;
    color: #6b7280;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all .15s;
  }

  .mc-btn-reset:hover {
    background: #f8fafc;
    border-color: #94a3b8;
    color: #374151;
  }

  /* ── Right column ── */
  .mc-right-col {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ── Summary box ── */
  .mc-summary-box {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 1px 4px rgba(0,0,0,.06);
  }

  .mc-summary-title {
    font-size: 14px;
    font-weight: 600;
    color: #374151;
    margin: 0 0 16px 0;
    padding-bottom: 12px;
    border-bottom: 1px solid #f1f5f9;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .mc-summary-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 16px;
  }

  .mc-stat-card {
    background: #f8faff;
    border: 1px solid #dbeafe;
    border-radius: 8px;
    padding: 12px 14px;
  }

  .mc-stat-label {
    font-size: 11px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .mc-stat-value {
    font-size: 18px;
    font-weight: 700;
    color: #2563eb;
  }

  .mc-stat-card.total {
    background: #eff6ff;
    border-color: #bfdbfe;
    grid-column: span 2;
  }

  .mc-stat-card.total .mc-stat-value {
    font-size: 22px;
    color: #1d4ed8;
  }

  .mc-stat-card.benefit {
    background: #f0fdf4;
    border-color: #bbf7d0;
  }

  .mc-stat-card.benefit .mc-stat-value {
    color: #16a34a;
  }

  .mc-stat-card.net {
    background: #fefce8;
    border-color: #fde68a;
  }

  .mc-stat-card.net .mc-stat-value {
    color: #b45309;
  }

  /* ── Calculate button ── */
  .mc-calc-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 38px;
    padding: 0 20px;
    background: #3b82f6;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background .15s;
  }

  .mc-calc-btn:hover { background: #2563eb; }

  .mc-calc-btn:disabled {
    background: #93c5fd;
    cursor: not-allowed;
  }

  .mc-calc-btn.loading {
    background: #60a5fa;
    cursor: wait;
  }

  /* ── Table ── */
  .mc-table-panel {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 1px 4px rgba(0,0,0,.06);
    overflow-x: auto;
  }

  .mc-table-title {
    font-size: 14px;
    font-weight: 600;
    color: #374151;
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .mc-legs-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
    min-width: 900px;
  }

  .mc-legs-table th {
    text-align: left;
    padding: 8px 10px;
    background: #f8fafc;
    border-bottom: 2px solid #e2e8f0;
    font-weight: 600;
    font-size: 11px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    white-space: nowrap;
  }

  .mc-legs-table td {
    padding: 8px 10px;
    border-bottom: 1px solid #f1f5f9;
    color: #374151;
    vertical-align: middle;
  }

  .mc-legs-table tr:hover td {
    background: #f8fafc;
  }

  .mc-legs-table tr:last-child td {
    border-bottom: none;
  }

  .mc-td-input {
    width: 80px;
    height: 28px;
    padding: 0 7px;
    border: 1px solid #d1d5db;
    border-radius: 5px;
    font-size: 12px;
    color: #1f2937;
    background: #fff;
    outline: none;
  }

  .mc-td-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59,130,246,.15);
  }

  .mc-badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .mc-badge-buy { background: #dcfce7; color: #16a34a; }
  .mc-badge-sell { background: #fee2e2; color: #dc2626; }
  .mc-badge-ce { background: #dbeafe; color: #2563eb; }
  .mc-badge-pe { background: #fce7f3; color: #be185d; }
  .mc-badge-fut { background: #fef9c3; color: #a16207; }

  .mc-remove-btn {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #fca5a5;
    border-radius: 4px;
    background: #fff;
    color: #ef4444;
    font-size: 15px;
    cursor: pointer;
    line-height: 1;
    transition: all .15s;
  }

  .mc-remove-btn:hover {
    background: #fee2e2;
    border-color: #ef4444;
  }

  .mc-empty-state {
    text-align: center;
    padding: 32px 16px;
    color: #94a3b8;
    font-size: 13px;
  }

  .mc-empty-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }

  /* ── Error banner ── */
  .mc-error {
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 13px;
    color: #dc2626;
  }

  /* ── Calc bottom row ── */
  .mc-calc-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .mc-legs-count {
    font-size: 12px;
    color: #94a3b8;
  }

  /* ── Dark mode ── */
  @media (prefers-color-scheme: dark) {
    .mc-page { background: #0f172a; color: #e2e8f0; }
    .mc-title { color: #f1f5f9; }
    .mc-form-panel, .mc-summary-box, .mc-table-panel {
      background: #1e293b;
      border-color: #334155;
    }
    .mc-panel-title, .mc-summary-title, .mc-table-title { color: #e2e8f0; }
    .mc-label { color: #94a3b8; }
    .mc-select, .mc-input {
      background: #0f172a;
      border-color: #334155;
      color: #e2e8f0;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2394a3b8'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E");
    }
    .mc-select:focus, .mc-input:focus {
      border-color: #60a5fa;
      box-shadow: 0 0 0 3px rgba(96,165,250,.15);
    }
    .mc-side-btn { background: #0f172a; color: #94a3b8; border-color: #334155; }
    .mc-side-btn:first-child { border-color: #334155; }
    .mc-stat-card { background: #0f172a; border-color: #334155; }
    .mc-stat-card.total { background: #1e3a5f; border-color: #3b82f6; }
    .mc-stat-card.benefit { background: #0f2a1a; border-color: #166534; }
    .mc-stat-card.net { background: #2a1f0a; border-color: #b45309; }
    .mc-legs-table th { background: #0f172a; border-color: #334155; color: #64748b; }
    .mc-legs-table td { color: #cbd5e1; border-color: #1e293b; }
    .mc-legs-table tr:hover td { background: #0f172a; }
    .mc-td-input { background: #0f172a; border-color: #334155; color: #e2e8f0; }
    .mc-btn-reset { background: #1e293b; border-color: #334155; color: #94a3b8; }
    .mc-btn-reset:hover { background: #0f172a; }
    .mc-remove-btn { background: #1e293b; }
  }

  @media (max-width: 1100px) {
    .mc-layout { flex-direction: column; }
    .mc-form-panel { flex: unset; width: 100%; }
    .mc-summary-grid { grid-template-columns: repeat(3, 1fr); }
    .mc-stat-card.total { grid-column: span 3; }
  }

  @media (max-width: 640px) {
    .mc-page { padding: 12px; }
    .mc-summary-grid { grid-template-columns: 1fr 1fr; }
    .mc-stat-card.total { grid-column: span 2; }
  }
`, ".mc-page");

// ─── Default form state ───────────────────────────────────────────────────────

function defaultForm(): LegForm {
  return {
    underlying: "NIFTY",
    product: "Options",
    optionType: "CE",
    expiry: "",
    strike: "",
    spot: "",
    ltp: "",
    quantity: "1",
    side: "SELL",
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MarginCalculator() {
  const [form, setForm] = useState<LegForm>(defaultForm());
  const [legs, setLegs] = useState<LegRow[]>([]);
  const [result, setResult] = useState<MarginResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [broker, setBroker] = useState<string>("kite");
  const [marginProduct, setMarginProduct] = useState<string>("NRML");
  const [optionChain, setOptionChain] = useState<OptionChainContract[]>([]);
  const [optionChainLoading, setOptionChainLoading] = useState(false);
  const [optionChainError, setOptionChainError] = useState("");
  const styleRef = useRef<HTMLStyleElement | null>(null);

  // Inject scoped styles
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = styles;
    document.head.appendChild(el);
    styleRef.current = el;
    return () => { el.remove(); };
  }, []);

  const isFutures = form.product === "Futures";
  const expiryOptions = Array.from(new Set(optionChain.map((row) => row.expiry))).sort();
  const strikeOptions = Array.from(
    new Set(
      optionChain
        .filter((row) => row.expiry === form.expiry && row.option_type === form.optionType)
        .map((row) => strikeToString(row.strike))
        .filter(Boolean)
    )
  ).sort((a, b) => parseFloat(a) - parseFloat(b));

  const fetchOptionChain = useCallback(async (underlying: string) => {
    const normalizedUnderlying = String(underlying || "").trim().toUpperCase();
    if (!normalizedUnderlying) {
      setOptionChain([]);
      setOptionChainError("");
      return;
    }

    setOptionChainLoading(true);
    setOptionChainError("");
    try {
      const res = await fetch(`${API_BASE}/get-option-chain/${encodeURIComponent(normalizedUnderlying)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const data: OptionChainResponse = await res.json();
      const nextChain = Array.isArray(data.option_chain) ? data.option_chain : [];
      setOptionChain(nextChain);

      setForm((prev) => {
        const nextExpiryOptions = Array.from(new Set(nextChain.map((row) => row.expiry))).sort();
        const nextExpiry = nextExpiryOptions.includes(prev.expiry) ? prev.expiry : (nextExpiryOptions[0] || "");
        const nextSpot =
          typeof data.spot_price === "number" && isFinite(data.spot_price) && data.spot_price > 0
            ? formatPriceInput(data.spot_price)
            : prev.spot;
        if (prev.expiry === nextExpiry && prev.spot === nextSpot) {
          return prev;
        }
        return {
          ...prev,
          expiry: nextExpiry,
          spot: nextSpot,
        };
      });
    } catch (e: unknown) {
      setOptionChain([]);
      setOptionChainError(e instanceof Error ? e.message : String(e));
    } finally {
      setOptionChainLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOptionChain(form.underlying);
  }, [fetchOptionChain, form.underlying]);

  useEffect(() => {
    if (isFutures) {
      setForm((prev) => {
        if (!prev.strike) return prev;
        return { ...prev, strike: "" };
      });
      return;
    }

    if (!optionChain.length) {
      setForm((prev) => {
        if (!prev.expiry && !prev.strike && !prev.ltp) return prev;
        return { ...prev, expiry: "", strike: "", ltp: "" };
      });
      return;
    }

    setForm((prev) => {
      const nextExpiryOptions = Array.from(new Set(optionChain.map((row) => row.expiry))).sort();
      const resolvedExpiry = nextExpiryOptions.includes(prev.expiry) ? prev.expiry : (nextExpiryOptions[0] || "");
      const contractsForSelection = optionChain
        .filter((row) => row.expiry === resolvedExpiry && row.option_type === prev.optionType)
        .sort((a, b) => a.strike - b.strike);
      const nextStrikeOptions = Array.from(
        new Set(contractsForSelection.map((row) => strikeToString(row.strike)).filter(Boolean))
      );
      const resolvedStrike = nextStrikeOptions.includes(prev.strike) ? prev.strike : (nextStrikeOptions[0] || "");
      const selectedContract = contractsForSelection.find((row) => strikeToString(row.strike) === resolvedStrike);
      const resolvedLtp = selectedContract ? formatPriceInput(selectedContract.ltp) : "";

      if (
        prev.expiry === resolvedExpiry &&
        prev.strike === resolvedStrike &&
        prev.ltp === resolvedLtp
      ) {
        return prev;
      }

      return {
        ...prev,
        expiry: resolvedExpiry,
        strike: resolvedStrike,
        ltp: resolvedLtp,
      };
    });
  }, [isFutures, optionChain, form.expiry, form.optionType, form.strike]);

  // ── Field change ──
  const setField = <K extends keyof LegForm>(key: K, value: LegForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ── Add leg ──
  const handleAdd = () => {
    const row: LegRow = {
      id: uid(),
      underlying: form.underlying,
      instrument_type: isFutures ? "FUT" : form.optionType,
      expiry: form.expiry.trim().toUpperCase(),
      strike: isFutures ? 0 : parseFloat(form.strike) || 0,
      lot_size: LOT_SIZES[form.underlying] ?? 65,
      quantity: parseInt(form.quantity) || 1,
      side: form.side,
      spot: form.spot,
      ltp: form.ltp,
    };
    setLegs((prev) => [...prev, row]);
    setResult(null);
    setError("");
  };

  // ── Reset form ──
  const handleReset = () => {
    setForm(defaultForm());
    setError("");
  };

  // ── Remove leg ──
  const removeLeg = (id: string) => {
    setLegs((prev) => prev.filter((l) => l.id !== id));
    setResult(null);
    setError("");
  };

  // ── Update leg field (spot / ltp inline edit) ──
  const updateLegField = (id: string, field: "spot" | "ltp", value: string) => {
    setLegs((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));
    setResult(null);
  };

  // ── Calculate ──
  // merging flag — prevents the setLegs inside calculate from re-triggering auto-calc
  const isMergingRef = useRef(false);

  const calculate = useCallback(async (currentLegs?: LegRow[]) => {
    const legsToUse = currentLegs ?? legs;
    if (legsToUse.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const payload = {
        broker,
        product: marginProduct,
        legs: legsToUse.map((l) => ({
          underlying: l.underlying,
          instrument_type: l.instrument_type,
          expiry: l.expiry,
          strike: l.strike,
          transaction_type: l.side,
          quantity: l.quantity,
          lot_size: l.lot_size,
          ltp: parseFloat(String(l.ltp)) || 0,
          spot: parseFloat(String(l.spot)) || 0,
        })),
      };
      const res = await fetch(`${API_BASE}/margin/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data: MarginResult = await res.json();
      setResult(data);

      // Merge per-leg results back — set flag so useEffect doesn't re-trigger
      isMergingRef.current = true;
      setLegs((prev) =>
        prev.map((row, i) => {
          const rl = data.legs[i];
          if (!rl) return row;
          return { ...row, iv: rl.implied_vol, span: rl.span_contribution, exposure: rl.exposure_margin, total: rl.total_margin };
        })
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [legs]);

  // Auto-calc only when legs change due to user actions (add/remove/edit),
  // NOT when calculate() itself merges results back into legs.
  const prevLegsLenRef = useRef(0);
  useEffect(() => {
    // Skip if this legs change was caused by calculate() merging results
    if (isMergingRef.current) {
      isMergingRef.current = false;
      return;
    }
    if (legs.length === 0) { setResult(null); return; }
    calculate(legs);
    prevLegsLenRef.current = legs.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legs]);

  // Recalculate when broker or product changes
  useEffect(() => {
    if (legs.length > 0) calculate(legs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broker, marginProduct]);

  // ── Margin benefit: sum of individual standalone totals - combined total ──
  const individualTotal = legs.reduce((sum, l) => sum + (l.total ?? 0), 0);
  const marginBenefit = result ? Math.max(0, individualTotal - result.total_margin) : 0;

  const instrumentBadge = (type: string) => {
    if (type === "CE") return <span className="mc-badge mc-badge-ce">CE</span>;
    if (type === "PE") return <span className="mc-badge mc-badge-pe">PE</span>;
    return <span className="mc-badge mc-badge-fut">FUT</span>;
  };

  const sideBadge = (side: string) => {
    return (
      <span className={`mc-badge ${side === "BUY" ? "mc-badge-buy" : "mc-badge-sell"}`}>
        {side}
      </span>
    );
  };

  return (
    <>
      <PageMeta title="Margin Calculator" description="SPAN Margin Calculator for F&O positions" />
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div className="mc-page">
        {/* Header */}
        <div className="mc-header">
          <h1 className="mc-title">SPAN Margin Calculator</h1>
          <p className="mc-subtitle">
            NSE SPAN margin — same algorithm for Zerodha (Kite) and Flattrade · NRML identical · MIS varies by broker
          </p>
        </div>

        {/* ── Broker + Product selectors (global) ── */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label className="mc-label" style={{ margin: 0, whiteSpace: "nowrap" }}>Broker</label>
            <select
              className="mc-select"
              style={{ width: 170 }}
              value={broker}
              onChange={(e) => { setBroker(e.target.value); setResult(null); }}
            >
              {BROKERS.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label className="mc-label" style={{ margin: 0, whiteSpace: "nowrap" }}>Product</label>
            <select
              className="mc-select"
              style={{ width: 180 }}
              value={marginProduct}
              onChange={(e) => { setMarginProduct(e.target.value); setResult(null); }}
            >
              {PRODUCTS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          {marginProduct === "MIS" && (
            <div style={{ display: "flex", alignItems: "center", background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#92400e", gap: 6 }}>
              <span>⚡</span>
              <span>MIS: ~{broker === "flattrade" ? "4–5x" : "4–5x"} leverage · intraday only</span>
            </div>
          )}
        </div>

        <div className="mc-layout">
          {/* ── Left: Add Leg Form ── */}
          <div className="mc-form-panel">
            <p className="mc-panel-title">Add Position</p>

            {/* Underlying */}
            <div className="mc-field">
              <label className="mc-label">Underlying</label>
              <select
                className="mc-select"
                value={form.underlying}
                onChange={(e) => setField("underlying", e.target.value)}
              >
                {UNDERLYINGS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            {/* Product */}
            <div className="mc-field">
              <label className="mc-label">Product</label>
              <select
                className="mc-select"
                value={form.product}
                onChange={(e) => setField("product", e.target.value as LegForm["product"])}
              >
                <option value="Options">Options</option>
                <option value="Futures">Futures</option>
              </select>
            </div>

            {/* Option Type (hidden for Futures) */}
            {!isFutures && (
              <div className="mc-field">
                <label className="mc-label">Option Type</label>
                <select
                  className="mc-select"
                  value={form.optionType}
                  onChange={(e) => setField("optionType", e.target.value as "CE" | "PE")}
                >
                  <option value="CE">CE — Call</option>
                  <option value="PE">PE — Put</option>
                </select>
              </div>
            )}

            {/* Expiry */}
            <div className="mc-field">
              <label className="mc-label">Expiry</label>
              <select
                className="mc-select"
                value={form.expiry}
                onChange={(e) => setField("expiry", e.target.value)}
                disabled={optionChainLoading || expiryOptions.length === 0}
              >
                <option value="">
                  {optionChainLoading ? "Loading expiry..." : "Select expiry"}
                </option>
                {expiryOptions.map((expiry) => (
                  <option key={expiry} value={expiry}>
                    {formatExpiryLabel(expiry)}
                  </option>
                ))}
              </select>
              {optionChainError && <p className="mc-input-hint" style={{ color: "#dc2626" }}>{optionChainError}</p>}
            </div>

            {/* Strike (hidden for Futures) */}
            {!isFutures && (
              <div className="mc-field">
                <label className="mc-label">Strike Price</label>
                <select
                  className="mc-select"
                  value={form.strike}
                  onChange={(e) => setField("strike", e.target.value)}
                  disabled={optionChainLoading || !form.expiry || strikeOptions.length === 0}
                >
                  <option value="">
                    {optionChainLoading ? "Loading strikes..." : "Select strike"}
                  </option>
                  {strikeOptions.map((strike) => (
                    <option key={strike} value={strike}>
                      {strike}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Spot Price */}
            <div className="mc-field">
              <label className="mc-label">Spot Price</label>
              <input
                className="mc-input"
                type="number"
                placeholder="Underlying index/spot price"
                value={form.spot}
                onChange={(e) => setField("spot", e.target.value)}
              />
            </div>

            {/* LTP */}
            <div className="mc-field">
              <label className="mc-label">LTP</label>
              <input
                className="mc-input"
                type="number"
                placeholder={isFutures ? "Futures price" : "Option premium"}
                value={form.ltp}
                onChange={(e) => setField("ltp", e.target.value)}
              />
            </div>

            {/* Quantity */}
            <div className="mc-field">
              <label className="mc-label">Net Quantity (Lots)</label>
              <input
                className="mc-input"
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setField("quantity", e.target.value)}
              />
              <p className="mc-input-hint">
                Lot size: {LOT_SIZES[form.underlying] ?? "—"} &nbsp;|&nbsp; Total qty:{" "}
                {(parseInt(form.quantity) || 1) * (LOT_SIZES[form.underlying] ?? 1)}
              </p>
            </div>

            {/* Buy / Sell */}
            <div className="mc-field">
              <label className="mc-label">Side</label>
              <div className="mc-side-group">
                <button
                  type="button"
                  className={`mc-side-btn${form.side === "BUY" ? " buy-active" : ""}`}
                  onClick={() => setField("side", "BUY")}
                >
                  Buy
                </button>
                <button
                  type="button"
                  className={`mc-side-btn${form.side === "SELL" ? " sell-active" : ""}`}
                  onClick={() => setField("side", "SELL")}
                >
                  Sell
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="mc-form-actions">
              <button type="button" className="mc-btn-add" onClick={handleAdd}>
                + Add
              </button>
              <button type="button" className="mc-btn-reset" onClick={handleReset}>
                Reset Form
              </button>
            </div>
          </div>

          {/* ── Right: Summary + Table ── */}
          <div className="mc-right-col">
            {/* Summary box */}
            <div className="mc-summary-box">
              <div className="mc-summary-title">
                <span>Combined Margin Requirements</span>
                {legs.length > 0 && (
                  <button
                    type="button"
                    className={`mc-calc-btn${loading ? " loading" : ""}`}
                    onClick={() => calculate()}
                    disabled={loading || legs.length === 0}
                  >
                    {loading ? (
                      <>
                        <svg
                          className="mc-spin"
                          style={{ animation: "spin 1s linear infinite", display: "inline-block" }}
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          width="14"
                          height="14"
                        >
                          <circle
                            cx="12" cy="12" r="10"
                            stroke="currentColor" strokeWidth="3"
                            strokeDasharray="30 70"
                          />
                        </svg>
                        Calculating…
                      </>
                    ) : (
                      "Calculate"
                    )}
                  </button>
                )}
              </div>

              {error && (
                <div className="mc-error" style={{ marginBottom: 14 }}>
                  {error}
                </div>
              )}

              <div className="mc-summary-grid">
                {/* SPAN */}
                <div className="mc-stat-card">
                  <div className="mc-stat-label">SPAN Margin</div>
                  <div className="mc-stat-value">
                    {result ? inr(result.span_margin) : "—"}
                  </div>
                </div>

                {/* Exposure */}
                <div className="mc-stat-card">
                  <div className="mc-stat-label">Exposure Margin</div>
                  <div className="mc-stat-value">
                    {result ? inr(result.exposure_margin) : "—"}
                  </div>
                </div>

                {/* Premium receivable */}
                <div className="mc-stat-card">
                  <div className="mc-stat-label">Premium Receivable</div>
                  <div className="mc-stat-value">
                    {result ? inr(result.premium_received) : "—"}
                  </div>
                </div>

                {/* Net margin */}
                <div className="mc-stat-card net">
                  <div className="mc-stat-label">Net Margin</div>
                  <div className="mc-stat-value">
                    {result ? inr(result.net_margin) : "—"}
                  </div>
                </div>

                {/* Total (full width) */}
                <div className="mc-stat-card total">
                  <div className="mc-stat-label">Total Margin Required</div>
                  <div className="mc-stat-value">
                    {result ? inr(result.total_margin) : "—"}
                  </div>
                </div>

                {/* Margin benefit (only when > 0 and result available) */}
                {result && marginBenefit > 0 && (
                  <div className="mc-stat-card benefit" style={{ gridColumn: "span 2" }}>
                    <div className="mc-stat-label">Margin Benefit (Hedge)</div>
                    <div className="mc-stat-value">
                      {inr(marginBenefit)}
                    </div>
                  </div>
                )}
              </div>

              {legs.length === 0 && (
                <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", marginTop: 8 }}>
                  Add one or more legs to calculate margin
                </p>
              )}
            </div>

            {/* Legs table */}
            <div className="mc-table-panel">
              <div className="mc-table-title">
                <span>Positions Added</span>
                {legs.length > 0 && (
                  <span className="mc-legs-count">{legs.length} leg{legs.length !== 1 ? "s" : ""}</span>
                )}
              </div>

              {legs.length === 0 ? (
                <div className="mc-empty-state">
                  <div className="mc-empty-icon">📋</div>
                  <p>No positions added yet</p>
                  <p style={{ fontSize: 11, marginTop: 4 }}>Use the form on the left to add legs</p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="mc-legs-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Underlying</th>
                        <th>Type</th>
                        <th>Expiry</th>
                        <th>Strike</th>
                        <th>Qty</th>
                        <th>Side</th>
                        <th>Spot</th>
                        <th>LTP</th>
                        <th>IV %</th>
                        <th>SPAN</th>
                        <th>Exposure</th>
                        <th>Total</th>
                        <th>Remove</th>
                      </tr>
                    </thead>
                    <tbody>
                      {legs.map((leg, idx) => (
                        <tr key={leg.id}>
                          <td style={{ color: "#94a3b8", fontSize: 11 }}>{idx + 1}</td>
                          <td style={{ fontWeight: 600 }}>{leg.underlying}</td>
                          <td>{instrumentBadge(leg.instrument_type)}</td>
                          <td style={{ fontFamily: "monospace", fontSize: 11 }}>{leg.expiry || "—"}</td>
                          <td style={{ fontFamily: "monospace" }}>
                            {leg.instrument_type === "FUT" ? "—" : (leg.strike || "—")}
                          </td>
                          <td>
                            {leg.quantity}
                            <span style={{ color: "#94a3b8", fontSize: 10, marginLeft: 3 }}>
                              ×{leg.lot_size}
                            </span>
                          </td>
                          <td>{sideBadge(leg.side)}</td>
                          {/* Editable Spot */}
                          <td>
                            <input
                              className="mc-td-input"
                              type="number"
                              value={leg.spot}
                              onChange={(e) => updateLegField(leg.id, "spot", e.target.value)}
                              placeholder="0"
                            />
                          </td>
                          {/* Editable LTP */}
                          <td>
                            <input
                              className="mc-td-input"
                              type="number"
                              value={leg.ltp}
                              onChange={(e) => updateLegField(leg.id, "ltp", e.target.value)}
                              placeholder="0"
                            />
                          </td>
                          <td style={{ color: "#6b7280" }}>
                            {leg.iv != null ? `${leg.iv.toFixed(1)}%` : "—"}
                          </td>
                          <td style={{ fontWeight: 500 }}>
                            {leg.span != null ? inr(leg.span) : "—"}
                          </td>
                          <td style={{ color: "#6b7280" }}>
                            {leg.exposure != null ? inr(leg.exposure) : "—"}
                          </td>
                          <td style={{ fontWeight: 600, color: "#2563eb" }}>
                            {leg.total != null ? inr(leg.total) : "—"}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="mc-remove-btn"
                              onClick={() => removeLeg(leg.id)}
                              title="Remove leg"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {legs.length > 0 && (
                <div className="mc-calc-row" style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    className={`mc-calc-btn${loading ? " loading" : ""}`}
                    onClick={() => calculate()}
                    disabled={loading}
                  >
                    {loading ? "Calculating…" : "Calculate Margin"}
                  </button>
                  <span className="mc-legs-count">
                    {legs.length} leg{legs.length !== 1 ? "s" : ""} · auto-recalculates on change
                  </span>
                  <button
                    type="button"
                    className="mc-btn-reset"
                    onClick={() => { setLegs([]); setResult(null); setError(""); }}
                    style={{ marginLeft: "auto" }}
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
