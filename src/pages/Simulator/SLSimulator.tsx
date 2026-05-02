import { useEffect, useRef, useState } from "react";
import { Chart } from "chart.js/auto";

type OptionType = "Call" | "Put";
type TradeType = "Buy" | "Sell";
type StoplossCondition = "<=" | ">=";

interface OptionChainRow {
  close: number;
  delta?: number;
  expiry: string;
  iv?: number;
  oi?: number;
  spot_price?: number;
  strike: number;
  timestamp?: string;
  type: "CE" | "PE";
}

interface Leg {
  entryDate: string;
  exited?: boolean;
  exitDelta?: number | null;
  exitPrice?: number | null;
  expiry: string;
  includeInPnl?: boolean;
  optionType: OptionType;
  premium: number;
  quantity: number;
  strike: number;
  type: TradeType;
}

interface TooltipState {
  callOi: number | null;
  expiryPnl: number | null;
  left: number;
  pnl: number | null;
  price: number;
  putOi: number | null;
  title: string;
  top: number;
  visible: boolean;
}

interface ChartArea {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

interface StoplossConfig {
  condition: StoplossCondition;
  price: number;
}

interface PanelPosition {
  left: number | null;
  top: number | null;
}

const PNL_STEP = 5;
const OI_STEP = 50;
const OC_ITEM_WIDTH = 104;
const OC_ITEM_GAP = 8;
const OC_CAROUSEL_STEP = OC_ITEM_WIDTH + OC_ITEM_GAP;

const styles = scopeCss(`
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .sl-page { min-height: 100vh; background: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
  .main-container { display: flex; gap: 20px; align-items: flex-start; }
  /* ── Option Chain Panel ── */
  .option-chain-panel { width: 500px; flex-shrink: 0; background: #fff; border-radius: 8px; border: 1px solid #e5e7eb; box-shadow: 0 2px 10px rgba(0,0,0,.08); overflow: hidden; display: flex; flex-direction: column; }
  .oc-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid #D9D9D9; font-size: 13px; }
  .oc-header-left { color: #6b7280; font-size: 12px; }
  .oc-title { font-weight: 700; font-size: 13px; color: #333; }
  .oc-expiry-label { font-size: 11px; font-weight: 400; opacity: 0.8; color: #333; margin-left: 2px; }
  .oc-hide-btn { color: #38bdf8; font-size: 12px; background: none; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 3px; }
  /* Expiry carousel */
  .expiry__viewer { width: 100%; min-height: 56px; border-bottom: 1px solid #D9D9D9; display: flex; align-items: center; gap: 8px; padding: 4px 8px; }
  .expiry-carousel__viewport { flex: 1; overflow: hidden; }
  .expiry-carousel__track { display: flex; align-items: flex-start; gap: 8px; transition: transform 0.25s ease; will-change: transform; }
  .expiry_button { text-align: center; flex: 0 0 104px; width: 104px; padding: 4px 0; cursor: pointer; }
  .expiry_button button { width: 100%; padding: 4px 8px; color: #646464; background: #F4F4F4; border-radius: 2px; border: 0; font-size: 12px; cursor: pointer; font-family: inherit; text-transform: uppercase; }
  .expiry_button .expiry_indicator { margin-top: 2px; color: #646464; font-size: 10px; }
  .selected__oc__expiry button { color: #4DA1C7 !important; background-color: #DDF8FF !important; }
  .expiry-carousel__arrow { flex: 0 0 24px; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; background: transparent; color: #565656; font-size: 28px; line-height: 1; cursor: pointer; }
  .expiry-carousel__arrow:disabled { opacity: 0.2; cursor: default; }
  /* Filter rows */
  .oc_filter { padding: 4px 10px; min-height: 36px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #646464; }
  .oc_filter > div { display: flex; align-items: center; min-width: 110px; }
  .oc_filter > div:last-child { justify-content: flex-end; }
  .squar__off__type { display: flex; align-items: center; gap: 8px; }
  .atm-radio-label { display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 12px; }
  .atm-radio-dot { width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid #94a3b8; background: #fff; display: inline-block; flex-shrink: 0; transition: all .15s; }
  .atm-radio-active .atm-radio-dot { border-color: #2563eb; background: #2563eb; box-shadow: inset 0 0 0 2px #fff; }
  .atm-radio-title { font-size: 12px; color: #646464; }
  /* OI strip */
  .total_oi { display: flex; align-items: center; justify-content: center; font-size: 13px; color: #646464; gap: 4px; }
  .total_call_oi { min-width: 48px; text-align: right; font-size: 11px; color: #000; }
  .total_put_oi { min-width: 50px; text-align: left; font-size: 11px; color: #000; }
  .oi-progress { width: 14px; height: 5px; margin: 0 3px; border-radius: 2px; overflow: hidden; background: #e2e8f0; }
  .oi-progress-call { background: #FBE2E2; width: 100%; height: 100%; }
  .oi-progress-put { background: #CDF1DF; width: 100%; height: 100%; }
  /* Table */
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
  .oc-row td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  .oc-row:hover .oc-strike-td, .oc-row:hover .oc-ltp { font-weight: 600; }
  .oc-call-td { text-align: right; }
  .oc-put-td { text-align: left; }
  .oc-iv-td { text-align: center; padding: 4px 4px !important; }
  .oc-iv-value { font-size: 11px; font-weight: 200; color: #1e293b; white-space: nowrap; }
  .oc-strike-td { text-align: center; font-weight: 300; font-size: 13px; color: #334155; background: #f8fafc; }
  .oc-ltp { font-weight: 300; color: #1e293b; margin-right: 3px; }
  .oc-delta { font-size: 11px; color: #64748b; }
  .oc-empty { color: #94a3b8; }
  .oc-row.oc-atm td { background: #EBFBFF !important; }
  .oc-row.oc-atm .oc-strike-td { background: #c7f2ff !important; font-weight: 300; }
  .oc-row.oc-call-itm .oc-call-td { background: #fefce8 !important; }
  .oc-row.oc-put-itm .oc-put-td { background: #fefce8 !important; }
  /* OI cells */
  .oc-call-oi-td { text-align: right; padding: 4px 6px !important; }
  .oc-put-oi-td { text-align: left; padding: 4px 6px !important; }
  .oc-oi-value { font-size: 11px; font-weight: 600; line-height: 1.4; white-space: nowrap; opacity: 0.6; }
  .oc-oi-call { color: #ef4444; }
  .oc-oi-put { color: #22c55e; }
  .oc-oi-bar-wrap { height: 3px; background: #e2e8f0; border-radius: 2px; margin-top: 3px; overflow: hidden; opacity: 0.4; }
  .oc-call-oi-td .oc-oi-bar-wrap { display: flex; justify-content: flex-end; }
  .oc-oi-bar { height: 100%; border-radius: 2px; transition: width 0.3s; }
  .oc-oi-bar-call { background: #ef4444; }
  .oc-oi-bar-put { background: #22c55e; }
  /* B/S buttons */
  .oc-actions { display: none; align-items: center; gap: 3px; }
  .oc-row:hover .oc-actions { display: inline-flex; }
  .oc-actions.has-active { display: inline-flex !important; }
  .oc-custom-table .action_button button { background: #fff; color: #999; border: 1px solid #ccc; font-size: 11px; padding: 1px 5px; border-radius: 2px; cursor: pointer; font-family: inherit; line-height: 1.5; }
  .oc-custom-table .buy_button:hover { color: #03B760 !important; border-color: #03B760 !important; }
  .oc-custom-table .sell_button:hover { color: #EF6161 !important; border-color: #EF6161 !important; }
  .oc-custom-table .buy_button.oc-btn-active { background: #03B760 !important; color: #fff !important; border-color: #03B760 !important; }
  .oc-custom-table .sell_button.oc-btn-active { background: #EF6161 !important; color: #fff !important; border-color: #EF6161 !important; }
  .oc-call-td .oc-cell-inner { display: flex; align-items: center; justify-content: flex-end; gap: 4px; white-space: nowrap; width: 100%; }
  .oc-call-td .oc-actions { margin-right: auto; }
  .oc-put-td .oc-cell-inner { display: flex; align-items: center; justify-content: flex-start; gap: 4px; white-space: nowrap; width: 100%; }
  .oc-put-td .oc-actions { margin-left: auto; }
  .chart-section { flex: 1; min-width: 0; background: #fff; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,.08); }
  .chart-wrapper { position: relative; height: 450px; margin-bottom: 20px; }
  .payoff-tooltip { position: absolute; background: #1f2937; color: #f9fafb; border-radius: 8px; padding: 12px 16px; font-size: 13px; pointer-events: none; z-index: 20; min-width: 190px; box-shadow: 0 4px 20px rgba(0,0,0,.4); border: 1px solid rgba(255,255,255,.1); }
  .payoff-tooltip-title { font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: .6px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,.1); }
  .payoff-tooltip-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 12px; }
  .payoff-tooltip-label { color: #9ca3af; font-size: 12px; }
  .payoff-tooltip-value { font-weight: 600; font-size: 13px; text-align: right; }
  .payoff-tooltip-divider { margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,.08); }
  .spot-line { position: absolute; width: 2px; background: #374151; pointer-events: none; z-index: 10; box-shadow: 0 0 8px rgba(0,0,0,.2); }
  .spot-line::before { content: ''; position: absolute; top: 0; left: -3px; width: 8px; height: 8px; background: #374151; border-radius: 50%; border: 2px solid #fff; }
  .spot-price-label { position: absolute; background: #374151; color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; white-space: nowrap; pointer-events: none; z-index: 12; transform: translateX(-50%); box-shadow: 0 2px 6px rgba(0,0,0,.2); }
  .spot-price-label::after { content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid #374151; }
  .adj-line { position: absolute; width: 0; pointer-events: none; z-index: 9; }
  .adj-line-upper { border-left: 2px dashed #16a34a; }
  .adj-line-lower { border-left: 2px dashed #dc2626; }
  .adj-line-label { position: absolute; top: 10px; left: 5px; color: #fff; font-size: 11px; font-weight: 700; padding: 5px 9px; border-radius: 5px; white-space: nowrap; line-height: 1.5; }
  .adj-line-upper .adj-line-label { background: #16a34a; }
  .adj-line-lower .adj-line-label { background: #dc2626; left: auto; right: 5px; text-align: right; }
  .adj-label-price, .sl-lbl-price { display: block; font-size: 12px; font-weight: 800; }
  .adj-label-dist, .sl-lbl-dist { display: block; font-size: 10px; font-weight: 600; opacity: .92; }
  .floating-pnl { position: absolute; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; box-shadow: 0 4px 16px rgba(0,0,0,.2); pointer-events: none; z-index: 11; white-space: nowrap; display: flex; align-items: center; gap: 8px; border: 2px solid #fff; }
  .floating-pnl.loss { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
  .floating-pnl::before { content: ''; position: absolute; top: -10px; left: 50%; transform: translateX(-50%); border-left: 10px solid transparent; border-right: 10px solid transparent; border-bottom: 10px solid #059669; }
  .floating-pnl.loss::before { border-bottom-color: #dc2626; }
  .zoom-selection { position: absolute; border: 2px dashed #3b82f6; background: rgba(59,130,246,.1); pointer-events: none; z-index: 12; }
  .zoom-reset-btn { position: absolute; top: 10px; right: 10px; padding: 6px 12px; background: #3b82f6; color: #fff; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; z-index: 13; }
  .zoom-controls { position: absolute; top: 10px; left: 10px; display: flex; gap: 4px; z-index: 13; }
  .zoom-ctrl-btn { width: 28px; height: 28px; background: #fff; border: 1px solid #d1d5db; border-radius: 4px; font-size: 16px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #374151; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
  .zoom-ctrl-btn:hover, .zoom-reset-btn:hover { filter: brightness(.97); }
  .sl-config-btn { position: absolute; top: 10px; right: 100px; padding: 5px 11px; background: #1e40af; color: #fff; border: none; border-radius: 5px; font-size: 12px; font-weight: 600; cursor: pointer; z-index: 14; display: flex; align-items: center; gap: 5px; box-shadow: 0 1px 4px rgba(0,0,0,.18); }
  .sl-config-btn.active { background: #dc2626; }
  .sl-hover-line, .sl-marker-line { position: absolute; top: 0; width: 0; pointer-events: none; z-index: 15; }
  .sl-hover-line { border-left: 2px dashed #f59e0b; }
  .sl-marker-line { border-left: 2px solid #f59e0b; }
  .sl-marker-upper { border-left: 2px solid #16a34a !important; }
  .sl-marker-lower { border-left: 2px solid #dc2626 !important; }
  .sl-marker-label { position: absolute; top: 12px; white-space: nowrap; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 5px; line-height: 1.5; pointer-events: none; }
  .sl-label-upper { left: 5px; background: #16a34a; color: #fff; }
  .sl-label-lower { right: 5px; left: auto; background: #dc2626; color: #fff; text-align: right; }
  .sl-shade-region { position: absolute; top: 0; pointer-events: none; z-index: 8; background: rgba(220,38,38,.1); }
  .sl-config-panel { position: fixed; width: 270px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,.18); z-index: 30; font-size: 13px; overflow: hidden; user-select: none; }
  .sl-panel-header { background: #1e3a8a; cursor: grab; color: #fff; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; }
  .sl-panel-title { font-weight: 700; font-size: 13px; }
  .sl-panel-close { background: none; border: none; color: #fff; font-size: 18px; cursor: pointer; line-height: 1; padding: 0; }
  .sl-panel-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
  .sl-instruction { font-size: 11px; color: #6b7280; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 5px; padding: 6px 9px; text-align: center; }
  .sl-panel-row { display: flex; flex-direction: column; gap: 4px; }
  .sl-panel-row label { font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; }
  .sl-condition-row { display: flex; gap: 6px; }
  .sl-condition-row select, .sl-condition-row input { padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 5px; font-size: 13px; background: #f9fafb; }
  .sl-condition-row select { flex: 0 0 110px; }
  .sl-condition-row input { flex: 1; font-weight: 600; }
  .sl-spot-value { font-weight: 700; color: #1e3a8a; font-size: 14px; }
  .sl-diff-row { display: flex; gap: 8px; }
  .sl-diff-row span { flex: 1; text-align: center; padding: 4px 0; background: #f3f4f6; border-radius: 4px; font-size: 12px; font-weight: 600; color: #374151; }
  .sl-pnl-box { background: #fff1f2; border: 1px solid #fecaca; border-radius: 6px; padding: 8px 10px; }
  .sl-pnl-box.profit { background: #f0fdf4; border-color: #bbf7d0; }
  .sl-pnl-label { font-size: 10px; color: #9ca3af; font-weight: 600; text-transform: uppercase; }
  .sl-pnl-value { font-size: 18px; font-weight: 800; color: #dc2626; margin-top: 2px; }
  .sl-pnl-value.profit { color: #16a34a; }
  .sl-panel-actions { display: flex; gap: 8px; }
  .sl-cancel-btn, .sl-save-btn { flex: 1; padding: 7px; border-radius: 5px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .sl-cancel-btn { border: 1px solid #d1d5db; background: #fff; color: #374151; }
  .sl-save-btn { border: none; background: #1e40af; color: #fff; }
  .sl-save-btn:disabled { background: #93c5fd; cursor: not-allowed; }
  .sl-saved-bar { display: flex; align-items: center; gap: 8px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; padding: 5px 10px; font-size: 12px; font-weight: 600; color: #92400e; margin-top: 4px; flex-wrap: wrap; }
  .sl-saved-edit, .sl-remove-link { color: #1d4ed8; cursor: pointer; text-decoration: underline; font-weight: 700; background: none; border: none; padding: 0; font: inherit; }
  .sl-saved-edit { margin-left: auto; }
  .payoff-bottom { text-align: center; font-size: 13px; font-weight: 600; color: #374151; padding: 6px 0 2px; letter-spacing: .3px; }
  .info-icon { width: 16px; height: 16px; background: rgba(255,255,255,.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
  .legs-section { max-width: 1600px; margin: 20px auto 0; background: #fff; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,.08); display: none; }
  .legs-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .legs-title { font-size: 20px; font-weight: 600; color: #111827; }
  .add-leg-btn { padding: 10px 20px; background: #3b82f6; color: #fff; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; }
  .spot-price-slider { background: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #fbbf24; }
  .spot-label { font-size: 14px; font-weight: 600; color: #92400e; margin-bottom: 10px; }
  .slider-container { position: relative; height: 30px; }
  .slider { width: 100%; height: 6px; background: linear-gradient(to right, #fbbf24 0%, #f59e0b 100%); border-radius: 3px; outline: none; -webkit-appearance: none; }
  .slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 24px; height: 24px; background: #f59e0b; cursor: pointer; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,.2); }
  .legs-list { display: flex; flex-direction: column; gap: 15px; }
  .leg-row { display: grid; grid-template-columns: 150px 150px 200px 180px 120px 170px 170px 50px; gap: 15px; align-items: center; padding: 15px; background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb; }
  .leg-input, .leg-select { padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: #fff; }
  .delete-btn { width: 40px; height: 40px; background: #ef4444; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 18px; }
  canvas { background: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,.01) 10px, rgba(0,0,0,.01) 20px); }
  @media (max-width: 900px) {
    .main-container { flex-direction: column; }
    .option-chain-panel { width: 100%; }
    .chart-section { padding: 16px; }
    .chart-wrapper { height: 360px; }
    .sl-config-btn { right: 74px; }
  }

  /* ── Position Table ── */
  .pos-section { margin-top: 16px; background: #fff; border-radius: 8px; border: 1px solid #e5e7eb; box-shadow: 0 2px 10px rgba(0,0,0,.08); overflow: hidden; }
  .pos-tabs { display: flex; align-items: center; border-bottom: 1px solid #e5e7eb; background: #fff; padding: 0 12px; overflow-x: auto; scrollbar-width: none; }
  .pos-tabs::-webkit-scrollbar { display: none; }
  .pos-tab { padding: 10px 12px; font-size: 13px; color: #6b7280; cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; background: none; border-top: none; border-left: none; border-right: none; font-family: inherit; }
  .pos-tab.active { color: #3b82f6; border-bottom-color: #3b82f6; font-weight: 500; }
  .pos-tab-right { margin-left: auto; display: flex; align-items: center; gap: 8px; padding: 0 4px; font-size: 12px; color: #6b7280; white-space: nowrap; }
  .position_table { overflow-x: auto; overflow-y: auto; max-height: 260px; }
  .position_table table { width: 100%; min-width: 700px; table-layout: fixed; border-collapse: collapse; }
  .position_table .sticky-top { position: sticky; top: 0; z-index: 2; }
  .position_table th { padding: 5px 4px; color: #9B9B9B; background-color: #fff !important; font-size: 12px; font-weight: 500; white-space: nowrap; text-align: left; }
  .position_table tr:not(.table_footer):not(.sticky-top):hover td { background: #f7f8f9 !important; }
  .action_head { width: 65px; }
  .lotsize_head { width: 72px; }
  .action_button_group { display: flex; align-items: center; gap: 4px; }
  .checkbox-container-pt { display: flex; align-items: center; cursor: pointer; }
  .checkbox-custom-pt { width: 13px; height: 13px; border: 1.5px solid #94a3b8; border-radius: 2px; background: #fff; display: inline-block; flex-shrink: 0; transition: all .15s; }
  .checkbox-custom-pt.checked { background: #3b82f6; border-color: #3b82f6; }
  .pt-buy-btn { width: 18px; height: 18px; background: #03B760; color: #fff; border: 1px solid #03B760; border-radius: 3px; font-size: 10px; display: flex; align-items: center; justify-content: center; cursor: default; flex-shrink: 0; }
  .pt-sell-btn { width: 18px; height: 18px; background: #EF6161; color: #fff; border: 1px solid #EF6161; border-radius: 3px; font-size: 10px; display: flex; align-items: center; justify-content: center; cursor: default; flex-shrink: 0; }
  .parent_position td { padding: 4px 4px; font-size: 12px; color: #333; border-bottom: 1px solid #f4f4f4; vertical-align: middle; }
  .parent_position.exited__SL { opacity: 0.75; }
  .position__strike { display: flex; align-items: center; gap: 2px; user-select: none; white-space: nowrap; }
  .call-btn-pt { font-size: 11px; font-weight: 600; color: #16a34a; }
  .put-btn-pt { font-size: 11px; font-weight: 600; color: #ef4444; }
  .sign_btn { width: 14px; height: 16px; font-size: 11px; color: #555; background: #F4F4F4; border: 0; border-radius: 2px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0; transition: opacity 0.2s; padding: 0; line-height: 1; }
  .parent_position:hover .sign_btn { opacity: 1; }
  .position__expiry { white-space: nowrap; text-align: center; font-size: 12px; }
  .sim-input { width: 55px; height: 20px; border: 1px solid transparent; border-radius: 2px; text-align: center; outline: 0; font-size: 12px; background: transparent; transition: border-color .2s, background .2s; }
  .sim-input:hover, .sim-input:focus { border-color: #C4C4C4; background: #fff; }
  .lot-input { width: 32px !important; }
  .simulator_green_text { color: #03B760 !important; }
  .simulator_red_text { color: #EF6161 !important; }
  .expiry_indicator { font-size: 11px; }
  .simulator_position_button { display: flex; align-items: center; gap: 4px; }
  .pos-exit-btn { background: none; border: none; cursor: pointer; font-size: 11px; color: #6b7280; padding: 2px 4px; border-radius: 3px; }
  .pos-exit-btn:hover { color: #ef4444; }
  .pos-del-btn { background: none; border: none; cursor: pointer; font-size: 13px; color: #9ca3af; padding: 0 2px; line-height: 1; }
  .pos-del-btn:hover { color: #ef4444; }
  .lot_select_space { font-size: 11px; border: 1px solid #d1d5db; border-radius: 2px; padding: 1px 2px; background: #fff; max-width: 40px; }
  .position_table tr.table_footer { position: sticky; bottom: 0; z-index: 1; box-shadow: 0 -2px 6px rgba(154,154,154,.15); }
  .position_table tr.table_footer th { height: 38px; background: rgba(255,255,255,.97) !important; padding: 4px; font-size: 12px; color: #333; font-weight: 400; }
  .simulator_group_input { display: inline-flex; align-items: center; border: 1px solid #d1d5db; border-radius: 3px; overflow: hidden; }
  .sign_button { width: 18px; height: 22px; background: #f3f4f6; border: none; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 0; color: #374151; }
  .sign_button:disabled { opacity: 0.3; cursor: not-allowed; }
  .mult_input { width: 28px; height: 22px; border: none; text-align: center; font-size: 12px; outline: none; background: #fff; }
  .btn-outline-xs { padding: 2px 8px; font-size: 12px; border: 1px solid #3b82f6; border-radius: 3px; background: #fff; color: #3b82f6; cursor: pointer; white-space: nowrap; }
  .btn-outline-xs:hover { background: #eff6ff; }
  .pos-exit-all { font-size: 12px; color: #ef4444; cursor: pointer; text-decoration: none; }
  .pos-clear-all { font-size: 12px; color: #6b7280; cursor: pointer; text-decoration: none; margin-left: 6px; }
  .pos-footer-right { text-align: right; }
  .pos-empty { padding: 20px; text-align: center; color: #94a3b8; font-size: 13px; }
`, ".sl-page");

function scopeCss(css: string, scope: string): string {
  return css.replace(/(^|[{}])\s*([^@{}][^{]*)\{/g, (match, prefix: string, selectors: string) => {
    const scopedSelectors = selectors
      .split(",")
      .map((selector) => selector.trim())
      .filter(Boolean)
      .map((selector) => (selector.startsWith(scope) ? selector : `${scope} ${selector}`))
      .join(", ");

    if (!scopedSelectors) return match;
    return `${prefix}\n  ${scopedSelectors} {`;
  });
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const prob =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}

function blackScholesCall(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0.001) return Math.max(0, S - K);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
}

function blackScholesPut(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0.001) return Math.max(0, K - S);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
}

function fmtCurrency(value: number, digits = 0): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}₹${Math.abs(value).toLocaleString("en-IN", { maximumFractionDigits: digits })}`;
}

function formatDateLabel(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${match[3]} ${months[Number(match[2]) - 1]}`;
}


function daysToExpiry(expiry: string, fromDate: Date): number {
  const diff = new Date(expiry).getTime() - new Date(fromDate.toDateString()).getTime();
  return Math.max(0, Math.ceil(diff / 86400000));
}

export default function SLSimulatorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const pnlPriceRangeRef = useRef<number[]>([]);
  const callOIRef = useRef<number[]>([]);
  const putOIRef = useRef<number[]>([]);
  const chartAreaRef = useRef<ChartArea | null>(null);
  const dragRef = useRef<{ startPrice: number; startX: number; active: boolean }>({ startPrice: 0, startX: 0, active: false });
  const panelDragRef = useRef<{ active: boolean; offsetX: number; offsetY: number }>({ active: false, offsetX: 0, offsetY: 0 });
  const ocViewportRef = useRef<HTMLDivElement>(null);

  const [optionChainData, setOptionChainData] = useState<OptionChainRow[]>([]);
  const [currentSpotPrice, setCurrentSpotPrice] = useState(23589.5);
  const [currentMarketTime, setCurrentMarketTime] = useState(new Date());
  const [selectedExpiry, setSelectedExpiry] = useState("");
  const [optionLegs, setOptionLegs] = useState<Leg[]>([]);
  const [ivShiftPct, _setIvShiftPct] = useState(0);
  const [riskFreeRate, _setRiskFreeRate] = useState(6);
  const [tooltip, setTooltip] = useState<TooltipState>({ callOi: null, expiryPnl: null, left: 0, pnl: null, price: 0, putOi: null, title: "", top: 0, visible: false });
  const [chartArea, setChartArea] = useState<ChartArea | null>(null);
  const [zoomSelection, setZoomSelection] = useState<{ left: number; top: number; width: number; height: number; visible: boolean }>({ left: 0, top: 0, width: 0, height: 0, visible: false });
  const [zoomStartPrice, setZoomStartPrice] = useState(0);
  const [zoomEndPrice, setZoomEndPrice] = useState(0);
  const [userCustomZoom, setUserCustomZoom] = useState(false);
  const [payoffAtSpot, setPayoffAtSpot] = useState(0);
  const [slMode, setSlMode] = useState(false);
  const [slCondition, setSlCondition] = useState<StoplossCondition>("<=");
  const [slHoverPrice, setSlHoverPrice] = useState<number | null>(null);
  const [slMarkerPrice, setSlMarkerPrice] = useState<number | null>(null);
  const [slSavedUpper, setSlSavedUpper] = useState<StoplossConfig | null>(null);
  const [slSavedLower, setSlSavedLower] = useState<StoplossConfig | null>(null);
  const [panelPosition, setPanelPosition] = useState<PanelPosition>({ left: null, top: null });
  const [frozenAdjLevels, setFrozenAdjLevels] = useState<{ upper: number | null; lower: number | null } | null>(null);
  const [ocCarouselOffset, setOcCarouselOffset] = useState(0);
  const [ocAtmMode, setOcAtmMode] = useState<"Spot" | "Fut" | "SynthFut">("Spot");
  const [posActiveTab, setPosActiveTab] = useState<"Positions" | "Greeks" | "TargetPnL" | "Notes">("Positions");
  const [multiplier, setMultiplier] = useState(1);
  const expiries = Array.from(new Set(optionChainData.map((row) => row.expiry))).sort();

  function getRowsForExpiry(expiry: string): OptionChainRow[] {
    return optionChainData.filter((row) => row.expiry === expiry);
  }

  function getNearestStrike(expiry: string, spotPrice = currentSpotPrice): number | null {
    const strikes = Array.from(new Set(getRowsForExpiry(expiry).map((row) => row.strike))).sort((a, b) => a - b);
    if (!strikes.length) return null;
    return strikes.reduce((best, current) =>
      Math.abs(current - spotPrice) < Math.abs(best - spotPrice) ? current : best
    );
  }


  function getATMIV(expiry: string): number {
    const atmStrike = getNearestStrike(expiry);
    if (atmStrike == null) return 0.15;
    const ce = optionChainData.find((row) => row.expiry === expiry && row.strike === atmStrike && row.type === "CE");
    const pe = optionChainData.find((row) => row.expiry === expiry && row.strike === atmStrike && row.type === "PE");
    const ivs = [ce?.iv, pe?.iv].filter((value): value is number => typeof value === "number" && value > 0);
    if (!ivs.length) return 0.15;
    return ivs.reduce((sum, value) => sum + value, 0) / ivs.length;
  }

  function getEffectiveIV(expiry: string): number {
    return Math.max(0.01, getATMIV(expiry) * (1 + ivShiftPct / 100));
  }

  function getLegIV(leg: Pick<Leg, "expiry" | "strike" | "optionType">): number {
    const chainType = leg.optionType === "Call" ? "CE" : "PE";
    const exactRow = optionChainData.find(
      (row) =>
        row.expiry === leg.expiry &&
        row.strike === leg.strike &&
        row.type === chainType &&
        typeof row.iv === "number" &&
        row.iv > 0
    );
    if (exactRow?.iv) {
      return Math.max(0.01, exactRow.iv * (1 + ivShiftPct / 100));
    }
    return getEffectiveIV(leg.expiry);
  }

  function calcZoomHalf(spotPrice: number): number {
    const expiry = selectedExpiry || expiries[0];
    if (!expiry) return 1500;
    const rows = getRowsForExpiry(expiry);
    const strikes = Array.from(new Set(rows.map((row) => row.strike))).sort((a, b) => a - b);
    if (!strikes.length) return 1500;
    const atm = strikes.reduce((best, current) =>
      Math.abs(current - spotPrice) < Math.abs(best - spotPrice) ? current : best
    );
    const ce = rows.find((row) => row.strike === atm && row.type === "CE");
    const pe = rows.find((row) => row.strike === atm && row.type === "PE");
    const straddle = (ce?.close || 0) + (pe?.close || 0);
    if (straddle <= 500) return 1500;
    if (straddle <= 800) return 2200;
    if (straddle <= 1000) return 2700;
    if (straddle <= 1500) return 5000;
    if (straddle <= 1800) return 6000;
    if (straddle <= 2200) return 7000;
    if (straddle <= 2600) return 8000;
    return 10000;
  }

  function calcZoomRange(spotPrice: number): { start: number; end: number } {
    const half = calcZoomHalf(spotPrice);
    return {
      start: Math.floor((spotPrice - half) / 50) * 50,
      end: Math.ceil((spotPrice + half) / 50) * 50,
    };
  }

  function calculatePnL(spotPrice: number): number {
    return optionLegs.reduce((total, leg) => {
      if (leg.includeInPnl === false) return total;
      if (leg.exited) {
        const exitPrice = leg.exitPrice ?? leg.premium;
        const frozenPnl =
          leg.type === "Buy"
            ? (exitPrice - leg.premium) * leg.quantity
            : (leg.premium - exitPrice) * leg.quantity;
        return total + frozenPnl;
      }
      const intrinsic =
        leg.optionType === "Call" ? Math.max(0, spotPrice - leg.strike) : Math.max(0, leg.strike - spotPrice);
      const pnl = leg.type === "Buy" ? (intrinsic - leg.premium) * leg.quantity : (leg.premium - intrinsic) * leg.quantity;
      return total + pnl;
    }, 0);
  }

  function calculateCurrentDayPnL(spotPrice: number): number {
    return optionLegs.reduce((total, leg) => {
      if (leg.includeInPnl === false) return total;
      if (leg.exited) {
        const exitPrice = leg.exitPrice ?? leg.premium;
        const frozenPnl =
          leg.type === "Buy"
            ? (exitPrice - leg.premium) * leg.quantity
            : (leg.premium - exitPrice) * leg.quantity;
        return total + frozenPnl;
      }
      const expiryDate = new Date(leg.expiry);
      expiryDate.setUTCHours(10, 0, 0, 0);
      const msToExpiry = expiryDate.getTime() - currentMarketTime.getTime();
      const T = Math.max(1 / (365 * 24 * 60), msToExpiry / (1000 * 60 * 60 * 24 * 365));
      const sigma = getLegIV(leg);
      const isCurrentSpot = Math.abs(spotPrice - currentSpotPrice) < 0.0001;
      const liveLtp = isCurrentSpot ? getLTP(leg.strike, leg.expiry, leg.optionType) : null;
      const optionValue =
        liveLtp != null
          ? liveLtp
          : leg.optionType === "Call"
            ? blackScholesCall(spotPrice, leg.strike, T, riskFreeRate / 100, sigma)
            : blackScholesPut(spotPrice, leg.strike, T, riskFreeRate / 100, sigma);
      const pnl = leg.type === "Buy" ? (optionValue - leg.premium) * leg.quantity : (leg.premium - optionValue) * leg.quantity;
      return total + pnl;
    }, 0);
  }

  function generateOIData(priceRange: number[], isCall: boolean): number[] {
    const rows = getRowsForExpiry(selectedExpiry || expiries[0] || "");
    const map = new Map<number, number>();
    rows.forEach((row) => {
      if (isCall && row.type === "CE") map.set(row.strike, row.oi || 0);
      if (!isCall && row.type === "PE") map.set(row.strike, row.oi || 0);
    });
    return priceRange.map((price) => {
      const strikePrice = isCall ? price - 10 : price + 10;
      if (strikePrice % OI_STEP !== 0) return 0;
      return map.get(strikePrice) || 0;
    });
  }

  function priceToX(price: number): number | null {
    const area = chartAreaRef.current;
    const range = pnlPriceRangeRef.current;
    if (!area || !range.length) return null;
    let best = -1;
    let bestDiff = Number.POSITIVE_INFINITY;
    range.forEach((value, index) => {
      const diff = Math.abs(value - price);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = index;
      }
    });
    if (best < 0) return null;
    return area.left + (best / (range.length - 1)) * (area.right - area.left);
  }

  function xToPrice(x: number): number | null {
    const area = chartAreaRef.current;
    const range = pnlPriceRangeRef.current;
    if (!area || !range.length) return null;
    const ratio = Math.max(0, Math.min(1, (x - area.left) / (area.right - area.left)));
    const index = Math.round(ratio * (range.length - 1));
    return range[index] ?? null;
  }

  function buildAdjLevels() {
    if (!selectedExpiry || !optionLegs.length) return null;
    const rows = getRowsForExpiry(selectedExpiry);
    const strikes = Array.from(new Set(rows.map((row) => row.strike))).sort((a, b) => a - b);
    const atmStrike = getNearestStrike(selectedExpiry);
    if (!strikes.length || atmStrike == null) return null;
    const atmIdx = strikes.indexOf(atmStrike);
    const row5th = atmIdx >= 0 ? rows.find((row) => row.strike === strikes[atmIdx + 5] && row.type === "CE") : undefined;
    const fifthPremium = row5th?.close || 0;
    const adjShift = fifthPremium <= 190 ? 1 : fifthPremium <= 300 ? 2 : 3;
    const soldCE = optionLegs.filter((leg) => leg.type === "Sell" && leg.optionType === "Call" && leg.expiry === selectedExpiry).map((leg) => leg.strike);
    const soldPE = optionLegs.filter((leg) => leg.type === "Sell" && leg.optionType === "Put" && leg.expiry === selectedExpiry).map((leg) => leg.strike);
    if (!soldCE.length && !soldPE.length) return null;
    return {
      upper: soldCE.length ? Math.min(...soldCE) - adjShift * OI_STEP : null,
      lower: soldPE.length ? Math.max(...soldPE) + adjShift * OI_STEP : null,
    };
  }

  function applyZoomRange(newStart: number, newEnd: number) {
    let start = Math.floor(newStart / 50) * 50;
    let end = Math.ceil(newEnd / 50) * 50;
    if (end - start < 200) {
      const center = (start + end) / 2;
      start = Math.floor((center - 100) / 50) * 50;
      end = Math.ceil((center + 100) / 50) * 50;
    }
    setZoomStartPrice(start);
    setZoomEndPrice(end);
    setUserCustomZoom(true);
  }

  function removeLeg(index: number) {
    setOptionLegs((current) => current.filter((_, legIndex) => legIndex !== index));
  }

  function resetZoom() {
    const range = calcZoomRange(currentSpotPrice);
    setZoomStartPrice(range.start);
    setZoomEndPrice(range.end);
    setUserCustomZoom(false);
  }

  function removeStoploss(side: "upper" | "lower") {
    if (side === "upper") setSlSavedUpper(null);
    else setSlSavedLower(null);
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const response = await fetch("/js/option-chain.json");
        const rows = (await response.json()) as OptionChainRow[];
        if (!mounted) return;
        setOptionChainData(rows);
        const first = rows[0];
        if (first?.spot_price) setCurrentSpotPrice(first.spot_price);
        if (first?.timestamp) setCurrentMarketTime(new Date(first.timestamp));
        if (first?.expiry) setSelectedExpiry(first.expiry);
        const preloadRaw = localStorage.getItem("simulator_preload");
        if (preloadRaw) {
          try {
            const preload = JSON.parse(preloadRaw);
            localStorage.removeItem("simulator_preload");
            if (Array.isArray(preload.legs)) {
              setOptionLegs(
                preload.legs.map((leg: Partial<Leg>) => ({
                  entryDate: leg.entryDate || today(),
                  expiry: leg.expiry || first?.expiry || "",
                  optionType: leg.optionType === "Put" ? "Put" : "Call",
                  premium: Number(leg.premium) || 0,
                  quantity: Number(leg.quantity) || 1,
                  strike: Number(leg.strike) || first?.spot_price || 0,
                  type: leg.type === "Buy" ? "Buy" : "Sell",
                }))
              );
            }
            if (preload.spot_price) setCurrentSpotPrice(Number(preload.spot_price));
          } catch {
            // ignore malformed preload data
          }
        }
      } catch (error) {
        console.warn("Failed to load option chain data", error);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedExpiry && expiries[0]) {
      setSelectedExpiry(expiries[0]);
    }
  }, [expiries, selectedExpiry]);

  useEffect(() => {
    if (!zoomStartPrice && !zoomEndPrice && optionChainData.length) {
      const range = calcZoomRange(currentSpotPrice);
      setZoomStartPrice(range.start);
      setZoomEndPrice(range.end);
    }
  }, [optionChainData, currentSpotPrice, zoomEndPrice, zoomStartPrice]);

  useEffect(() => {
    if (!userCustomZoom && optionChainData.length) {
      const range = calcZoomRange(currentSpotPrice);
      setZoomStartPrice(range.start);
      setZoomEndPrice(range.end);
    }
  }, [currentSpotPrice, optionChainData, selectedExpiry, userCustomZoom]);

  useEffect(() => {
    if (!optionLegs.some((leg) => leg.type === "Sell")) {
      setFrozenAdjLevels(null);
      return;
    }
    setFrozenAdjLevels((current) => current ?? buildAdjLevels());
  }, [optionLegs, selectedExpiry]);

  useEffect(() => {
    if (!slMode) return;
    const existing = slCondition === ">=" ? slSavedUpper : slSavedLower;
    setSlMarkerPrice(existing?.price ?? null);
  }, [slCondition, slMode, slSavedLower, slSavedUpper]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedExpiry || !zoomStartPrice || !zoomEndPrice) return;

    const priceRange: number[] = [];
    for (let price = zoomStartPrice; price <= zoomEndPrice; price += PNL_STEP) {
      priceRange.push(price);
    }
    pnlPriceRangeRef.current = priceRange;

    const expiryPayoff = priceRange.map((price) => calculatePnL(price));
    const currentDayPayoff = priceRange.map((price) => calculateCurrentDayPnL(price));
    const putOI = generateOIData(priceRange, false);
    const callOI = generateOIData(priceRange, true);
    putOIRef.current = putOI;
    callOIRef.current = callOI;

    const maxPnL = Math.max(...expiryPayoff, 0);
    const minPnL = Math.min(...expiryPayoff, 0);
    const pnlAxisMax = Math.max(Math.abs(maxPnL), Math.abs(minPnL)) || 1000;
    const maxOI = Math.max(...putOI, ...callOI, 0);
    const oiAxisMax = Math.ceil((maxOI * 1.2) / 5000) * 5000 || 5000;
    const bluePnLAtSpot = calculateCurrentDayPnL(currentSpotPrice);
    setPayoffAtSpot(bluePnLAtSpot);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const externalTooltip = ({ tooltip: chartTooltip, chart }: any) => {
      if (!chartTooltip?.dataPoints?.length || chartTooltip.opacity === 0) {
        setTooltip((current) => ({ ...current, visible: false }));
        return;
      }
      const point = chartTooltip.dataPoints[0];
      const price = parseFloat(point.label);
      const strike = Math.round(price / OI_STEP) * OI_STEP;
      const currentPoint = chartTooltip.dataPoints.find((entry: any) => entry.datasetIndex === 3);
      const expiryPoint = chartTooltip.dataPoints.find((entry: any) => entry.datasetIndex === 2);
      const putIndex = priceRange.indexOf(strike - 10);
      const callIndex = priceRange.indexOf(strike + 10);
      const tooltipWidth = 210;
      const tooltipHeight = 180;
      const left =
        chartTooltip.caretX + tooltipWidth + 12 <= chart.canvas.offsetWidth
          ? chartTooltip.caretX + 12
          : chartTooltip.caretX - tooltipWidth - 12;
      const top = Math.min(
        Math.max(chartTooltip.caretY - tooltipHeight / 2, 0),
        chart.canvas.offsetHeight - tooltipHeight
      );
      setTooltip({
        callOi: callIndex >= 0 ? callOI[callIndex] : null,
        expiryPnl: expiryPoint ? expiryPoint.parsed.y : null,
        left,
        pnl: currentPoint ? currentPoint.parsed.y : null,
        price,
        putOi: putIndex >= 0 ? putOI[putIndex] : null,
        title: `Target (${formatDateLabel(currentMarketTime.toISOString())})`,
        top,
        visible: true,
      });
    };

    if (chartRef.current) {
      chartRef.current.data.labels = priceRange as any;
      chartRef.current.data.datasets[0].data = putOI as any;
      chartRef.current.data.datasets[1].data = callOI as any;
      chartRef.current.data.datasets[2].data = expiryPayoff as any;
      chartRef.current.data.datasets[3].data = currentDayPayoff as any;
      (chartRef.current.options.scales as any).yPnL.min = -pnlAxisMax;
      (chartRef.current.options.scales as any).yPnL.max = pnlAxisMax;
      (chartRef.current.options.scales as any).yOI.min = -oiAxisMax;
      (chartRef.current.options.scales as any).yOI.max = oiAxisMax;
      (chartRef.current.options.plugins as any).tooltip.external = externalTooltip;
      chartRef.current.update();
    } else {
      chartRef.current = new Chart(ctx, {
        type: "bar",
        data: {
          labels: priceRange,
          datasets: [
            {
              type: "bar",
              label: "Put OI",
              data: putOI,
              backgroundColor: "rgba(16, 185, 129, 0.7)",
              borderWidth: 0,
              yAxisID: "yOI",
              order: 4,
              barPercentage: 6,
              categoryPercentage: 1,
            },
            {
              type: "bar",
              label: "Call OI",
              data: callOI,
              backgroundColor: "rgba(239, 68, 68, 0.7)",
              borderWidth: 0,
              yAxisID: "yOI",
              order: 3,
              barPercentage: 6,
              categoryPercentage: 1,
            },
            {
              type: "line",
              label: "Expiry Payoff",
              data: expiryPayoff,
              borderColor: "rgba(16, 185, 129, 1)",
              borderWidth: 2.5,
              pointRadius: 0,
              pointHoverRadius: 5,
              fill: { target: "origin", above: "rgba(16, 185, 129, 0.15)", below: "#fff3f4" },
              segment: {
                borderColor: (segmentContext: any) => {
                  const y0 = segmentContext.p0.parsed.y;
                  const y1 = segmentContext.p1.parsed.y;
                  if (y0 >= 0 && y1 >= 0) return "rgba(16, 185, 129, 1)";
                  if (y0 < 0 && y1 < 0) return "#c85a5a";
                  return (y0 + y1) / 2 >= 0 ? "rgba(16, 185, 129, 1)" : "#c85a5a";
                },
              },
              tension: 0.1,
              yAxisID: "yPnL",
              order: 2,
            },
            {
              type: "line",
              label: "Current Day Payoff",
              data: currentDayPayoff,
              borderColor: "#006ce6",
              borderWidth: 2.5,
              pointRadius: 0,
              pointHoverRadius: 5,
              fill: false,
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
              enabled: false,
              external: externalTooltip,
            },
          },
          scales: {
            x: {
              offset: true,
              grid: { display: true, color: "rgba(0, 0, 0, 0.05)" },
              ticks: {
                callback(this: any, value: any) {
                  const price = Number(this.getLabelForValue(value));
                  return price % 100 === 0 ? price : "";
                },
                color: "#6b7280",
                font: { size: 11 },
              },
              border: { display: false },
            },
            yPnL: {
              type: "linear",
              position: "left",
              min: -pnlAxisMax,
              max: pnlAxisMax,
              title: { display: true, text: "Profit / Loss", color: "#6b7280", font: { size: 12, weight: 500 } },
              grid: {
                display: true,
                color(context: any) {
                  return context.tick.value === 0 ? "rgba(0, 0, 0, 0.3)" : "rgba(0, 0, 0, 0.05)";
                },
                lineWidth(context: any) {
                  return context.tick.value === 0 ? 2 : 1;
                },
              },
              ticks: {
                callback(value: any) {
                  return Number(value).toLocaleString();
                },
                color: "#6b7280",
                font: { size: 11 },
              },
              border: { display: false },
            },
            yOI: {
              type: "linear",
              position: "right",
              min: -oiAxisMax,
              max: oiAxisMax,
              title: { display: true, text: "Open Interest", color: "#6b7280", font: { size: 12, weight: 500 } },
              grid: { display: false },
              ticks: {
                callback(value: any) {
                  const absValue = Math.abs(Number(value));
                  if (absValue === 0) return "0";
                  if (absValue >= 10000) return `${(absValue / 10000).toFixed(0)}Cr`;
                  return absValue.toLocaleString();
                },
                color: "#6b7280",
                font: { size: 11 },
              },
              border: { display: false },
            },
          },
        },
      });
    }

    const syncChartArea = () => {
      const nextArea = chartRef.current?.chartArea;
      if (!nextArea) return;
      const value = { bottom: nextArea.bottom, left: nextArea.left, right: nextArea.right, top: nextArea.top };
      chartAreaRef.current = value;
      setChartArea(value);
    };

    requestAnimationFrame(() => {
      chartRef.current?.resize();
      chartRef.current?.update("none");
      syncChartArea();
    });
  }, [currentMarketTime, currentSpotPrice, ivShiftPct, optionLegs, riskFreeRate, selectedExpiry, zoomEndPrice, zoomStartPrice]);

  useEffect(() => {
    const wrapper = chartWrapperRef.current;
    if (!wrapper || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      if (!chartRef.current) return;
      chartRef.current.resize();
      chartRef.current.update("none");
      const nextArea = chartRef.current.chartArea;
      if (!nextArea) return;
      const value = { bottom: nextArea.bottom, left: nextArea.left, right: nextArea.right, top: nextArea.top };
      chartAreaRef.current = value;
      setChartArea(value);
    });

    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (event: MouseEvent) => {
      const area = chartAreaRef.current;
      if (!area || slMode) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      if (x < area.left || x > area.right) return;
      const price = xToPrice(x);
      if (price == null) return;
      dragRef.current = { active: true, startPrice: price, startX: x };
      setZoomSelection({ left: x, top: area.top, width: 0, height: area.bottom - area.top, visible: true });
    };

    const onMouseMove = (event: MouseEvent) => {
      const area = chartAreaRef.current;
      if (!area) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;

      if (slMode) {
        if (x < area.left || x > area.right) {
          setSlHoverPrice(null);
          return;
        }
        setSlHoverPrice(xToPrice(x));
        return;
      }

      if (!dragRef.current.active) return;
      const clampedX = Math.max(area.left, Math.min(x, area.right));
      setZoomSelection((current) => ({
        ...current,
        left: Math.min(dragRef.current.startX, clampedX),
        width: Math.abs(clampedX - dragRef.current.startX),
      }));
    };

    const onMouseUp = (event: MouseEvent) => {
      const area = chartAreaRef.current;
      if (!area || !dragRef.current.active || slMode) return;
      dragRef.current.active = false;
      setZoomSelection((current) => ({ ...current, visible: false }));
      const rect = canvas.getBoundingClientRect();
      const endX = Math.max(area.left, Math.min(event.clientX - rect.left, area.right));
      if (Math.abs(endX - dragRef.current.startX) < 10) return;
      const endPrice = xToPrice(endX);
      if (endPrice == null) return;
      applyZoomRange(Math.min(dragRef.current.startPrice, endPrice), Math.max(dragRef.current.startPrice, endPrice));
    };

    const onMouseLeave = () => {
      dragRef.current.active = false;
      setZoomSelection((current) => ({ ...current, visible: false }));
      setSlHoverPrice(null);
    };

    const onClick = (event: MouseEvent) => {
      if (!slMode) return;
      const area = chartAreaRef.current;
      if (!area) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      if (x < area.left || x > area.right) return;
      const price = xToPrice(x);
      if (price == null) return;
      setSlMarkerPrice(price);
    };

    const onWheel = (event: WheelEvent) => {
      const area = chartAreaRef.current;
      if (!area || slMode) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(area.left, Math.min(event.clientX - rect.left, area.right));
      const xRatio = (x - area.left) / (area.right - area.left);
      const centerPrice = zoomStartPrice + xRatio * (zoomEndPrice - zoomStartPrice);
      const factor = event.deltaY > 0 ? 1.25 : 0.8;
      const nextRange = (zoomEndPrice - zoomStartPrice) * factor;
      applyZoomRange(centerPrice - xRatio * nextRange, centerPrice + (1 - xRatio) * nextRange);
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [slMode, zoomEndPrice, zoomStartPrice]);

  useEffect(() => {
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, []);

  const spotX = priceToX(currentSpotPrice);
  const spotVisible = spotX != null && chartArea != null;
  const floatingLoss = payoffAtSpot < 0;
  const activeSlPrice = slMarkerPrice ?? slHoverPrice;
  const activeSlPnl = activeSlPrice == null ? null : calculatePnL(activeSlPrice);
  const activeSlProfit = activeSlPnl != null && activeSlPnl >= 0;
  const editingSlPrice = slMode ? (slMarkerPrice ?? slHoverPrice) : null;
  const editingSlX = editingSlPrice == null ? null : priceToX(editingSlPrice);
  const selectedRows = selectedExpiry ? getRowsForExpiry(selectedExpiry) : [];
  const selectedStrikes = Array.from(new Set(selectedRows.map((row) => row.strike))).sort((a, b) => a - b);
  const atmStrike = selectedExpiry ? getNearestStrike(selectedExpiry) : null;

  const atmIndex = atmStrike == null ? -1 : selectedStrikes.indexOf(atmStrike);
  const visibleStart = Math.max(0, atmIndex - 12);
  const visibleEnd = atmIndex >= 0 ? Math.min(selectedStrikes.length, atmIndex + 13) : Math.min(selectedStrikes.length, 25);
  const optionChainView = selectedStrikes.slice(visibleStart, visibleEnd).map((strike) => {
    const call = selectedRows.find((row) => row.strike === strike && row.type === "CE");
    const put = selectedRows.find((row) => row.strike === strike && row.type === "PE");
    return { call, put, strike };
  });
  const totalCallOi = selectedRows.filter((row) => row.type === "CE").reduce((sum, row) => sum + (row.oi || 0), 0);
  const totalPutOi = selectedRows.filter((row) => row.type === "PE").reduce((sum, row) => sum + (row.oi || 0), 0);
  const pcr = totalCallOi > 0 ? totalPutOi / totalCallOi : 0;
  const atmCall = atmStrike == null ? undefined : selectedRows.find((row) => row.strike === atmStrike && row.type === "CE");
  const atmPut = atmStrike == null ? undefined : selectedRows.find((row) => row.strike === atmStrike && row.type === "PE");
  const atmIvCandidates = [atmCall?.iv, atmPut?.iv].filter((value): value is number => typeof value === "number");
  const atmIv = atmIvCandidates.length ? (atmIvCandidates.reduce((sum, value) => sum + value, 0) / atmIvCandidates.length) * 100 : 0;
  const straddlePremium = (atmCall?.close || 0) + (atmPut?.close || 0);

  const maxPain = selectedStrikes.reduce(
    (best, strike) => {
      const pain = selectedStrikes.reduce((sum, testStrike) => {
        const ceOi = selectedRows.find((row) => row.strike === testStrike && row.type === "CE")?.oi || 0;
        const peOi = selectedRows.find((row) => row.strike === testStrike && row.type === "PE")?.oi || 0;
        return sum + Math.max(0, strike - testStrike) * peOi + Math.max(0, testStrike - strike) * ceOi;
      }, 0);
      return pain < best.pain ? { pain, strike } : best;
    },
    { pain: Number.POSITIVE_INFINITY, strike: atmStrike || 0 }
  ).strike;

  /* ── Position table helpers ── */
  const LOT_SIZE = 1;

  function getLTP(strike: number, expiry: string, optionType: "Call" | "Put"): number | null {
    const type = optionType === "Call" ? "CE" : "PE";
    const row = optionChainData.find((r) => r.expiry === expiry && r.strike === strike && r.type === type);
    return row ? row.close : null;
  }

  function getLegDelta(leg: Leg): number | null {
    if (leg.exited) return leg.exitDelta ?? null;
    const type = leg.optionType === "Call" ? "CE" : "PE";
    const row = optionChainData.find((r) => r.expiry === leg.expiry && r.strike === leg.strike && r.type === type);
    return row?.delta ?? null;
  }

  function getLegLTP(leg: Leg): number {
    if (leg.exited && leg.exitPrice != null) return leg.exitPrice;
    return getLTP(leg.strike, leg.expiry, leg.optionType) ?? leg.premium;
  }

  function getLegPnl(leg: Leg): number {
    const ltp = getLegLTP(leg);
    return leg.type === "Buy"
      ? (ltp - leg.premium) * leg.quantity
      : (leg.premium - ltp) * leg.quantity;
  }

  function exitLeg(index: number) {
    setOptionLegs((prev) =>
      prev.map((leg, i) => {
        if (i !== index) return leg;
        const ltp = getLTP(leg.strike, leg.expiry, leg.optionType);
        const delta = getLegDelta(leg);
        return { ...leg, exited: true, exitPrice: ltp ?? leg.premium, exitDelta: delta };
      })
    );
  }

  function reopenLeg(index: number) {
    setOptionLegs((prev) =>
      prev.map((leg, i) => i !== index ? leg : { ...leg, exited: false, exitPrice: null, exitDelta: null })
    );
  }

  function toggleInclude(index: number) {
    setOptionLegs((prev) =>
      prev.map((leg, i) => i !== index ? leg : { ...leg, includeInPnl: leg.includeInPnl === false ? true : false })
    );
  }

  function updateLots(index: number, lots: number) {
    const newLots = Math.max(1, lots);
    setOptionLegs((prev) =>
      prev.map((leg, i) => i !== index ? leg : { ...leg, quantity: newLots * LOT_SIZE })
    );
  }

  function updateEntryPrice(index: number, price: number) {
    setOptionLegs((prev) =>
      prev.map((leg, i) => i !== index ? leg : { ...leg, premium: price })
    );
  }

  const totalDelta = optionLegs
    .filter((l) => !l.exited && l.includeInPnl !== false)
    .reduce((sum, leg) => {
      const d = getLegDelta(leg);
      if (d == null) return sum;
      return sum + (leg.type === "Buy" ? d : -d) * leg.quantity;
    }, 0);

  const totalPositionPnl = optionLegs
    .filter((l) => l.includeInPnl !== false)
    .reduce((sum, leg) => sum + getLegPnl(leg), 0);

  function fmtEntryDate(dateStr: string): string {
    const d = new Date(dateStr);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${d.getDate()} ${months[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function fmtExpiry(dateStr: string): string {
    const d = new Date(dateStr);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${d.getUTCDate()} ${months[d.getUTCMonth()]}'${String(d.getUTCFullYear()).slice(2)}`;
  }

  /* ── Option chain helpers ── */
  function formatExpiryLabel(dateStr: string): string {
    const d = new Date(dateStr);
    const day = String(d.getUTCDate()).padStart(2, "0");
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    return `${day} ${months[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(2)}`;
  }

  function dteSuffix(expiry: string, idx: number): string {
    const dte = daysToExpiry(expiry, currentMarketTime);
    if (idx === 0) return `CW: ${dte} DTE`;
    if (idx === 1) return `NW: ${dte} DTE`;
    const d = new Date(expiry);
    const next = new Date(expiry);
    next.setUTCDate(next.getUTCDate() + 7);
    if (next.getUTCMonth() !== d.getUTCMonth()) return `CM: ${dte} DTE`;
    return `${dte} DTE`;
  }

  function fmtOI(v: number): string {
    if (v >= 10000000) return `${(v / 10000000).toFixed(1).replace(/\.0$/, "")}Cr`;
    if (v >= 100000) return `${(v / 100000).toFixed(1).replace(/\.0$/, "")}L`;
    if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}K`;
    return v.toString();
  }

  function hasOcPos(strike: number, optionType: "Call" | "Put", type: "Buy" | "Sell"): boolean {
    return optionLegs.some(
      (l) => l.expiry === selectedExpiry && l.strike === strike && l.optionType === optionType && l.type === type
    );
  }

  function toggleOcPos(strike: number, optionType: "Call" | "Put", type: "Buy" | "Sell", premium: number) {
    setOptionLegs((prev) => {
      const idx = prev.findIndex(
        (l) => l.expiry === selectedExpiry && l.strike === strike && l.optionType === optionType && l.type === type
      );
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      return [
        ...prev,
        {
          entryDate: currentMarketTime.toISOString().split("T")[0],
          expiry: selectedExpiry,
          optionType,
          premium,
          quantity: 1,
          strike,
          type,
        },
      ];
    });
  }

  const maxCallOI = Math.max(1, ...selectedStrikes.map((s) => selectedRows.find((r) => r.strike === s && r.type === "CE")?.oi || 0));
  const maxPutOI = Math.max(1, ...selectedStrikes.map((s) => selectedRows.find((r) => r.strike === s && r.type === "PE")?.oi || 0));
  const ocViewportWidth = ocViewportRef.current?.clientWidth || 400;
  const ocTrackWidth = expiries.length * OC_CAROUSEL_STEP - OC_ITEM_GAP;
  const ocMaxCarouselOffset = Math.max(0, ocTrackWidth - ocViewportWidth);

  function renderPriceLabel(price: number, variant: "adj" | "sl") {
    const points = Math.round(price - currentSpotPrice);
    const percent = ((price - currentSpotPrice) / currentSpotPrice) * 100;
    if (variant === "adj") {
      return (
        <>
          <span className="adj-label-price">Adj: ₹{price.toLocaleString("en-IN")}</span>
          <span className="adj-label-dist">
            {points >= 0 ? "+" : ""}
            {points} pts ({percent >= 0 ? "+" : ""}
            {percent.toFixed(2)}%)
          </span>
        </>
      );
    }
    return (
      <>
        <span className="sl-lbl-price">₹{price.toLocaleString("en-IN")}</span>
        <span className="sl-lbl-dist">
          {points >= 0 ? "+" : ""}
          {points} pts ({percent >= 0 ? "+" : ""}
          {percent.toFixed(2)}%)
        </span>
      </>
    );
  }

  return (
    <div className="sl-page" style={{ margin: "-24px", padding: "24px" }}>
      <style>{styles}</style>

      <div className="main-container">
        <div className="option-chain-panel">

          {/* ── Header ── */}
          <div className="oc-header">
            <span className="oc-header-left">🗂 Add ons ▼</span>
            <span className="oc-title">
              Option Chain
              <span className="oc-expiry-label">
                {selectedExpiry ? ` (${formatExpiryLabel(selectedExpiry)})` : ""}
              </span>
            </span>
            <button className="oc-hide-btn" type="button">⟪ Hide</button>
          </div>

          {/* ── Expiry carousel ── */}
          <div className="expiry__viewer expiry-carousel">
            <button
              type="button"
              className="expiry-carousel__arrow"
              disabled={ocCarouselOffset <= 0}
              onClick={() => setOcCarouselOffset((o) => Math.max(0, o - OC_CAROUSEL_STEP))}
            >&#8249;</button>
            <div className="expiry-carousel__viewport" ref={ocViewportRef}>
              <div
                className="expiry-carousel__track"
                style={{ transform: `translateX(-${ocCarouselOffset}px)` }}
              >
                {expiries.map((exp, idx) => (
                  <div
                    key={exp}
                    className={`expiry_button${exp === selectedExpiry ? " selected__oc__expiry" : ""}`}
                    onClick={() => {
                      setSelectedExpiry(exp);
                      if (!userCustomZoom) {
                        const range = calcZoomRange(currentSpotPrice);
                        setZoomStartPrice(range.start);
                        setZoomEndPrice(range.end);
                      }
                    }}
                  >
                    <button type="button">{formatExpiryLabel(exp)}</button>
                    <div className="expiry_indicator">({dteSuffix(exp, idx)})</div>
                  </div>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="expiry-carousel__arrow"
              disabled={ocCarouselOffset >= ocMaxCarouselOffset}
              onClick={() => setOcCarouselOffset((o) => Math.min(ocMaxCarouselOffset, o + OC_CAROUSEL_STEP))}
            >&#8250;</button>
          </div>

          {/* ── Filter row 1: ATM IV | ATM mode | Straddle Prem ── */}
          <div className="oc_filter">
            <div>
              ATM IV:&nbsp;
              <span style={{ color: "#464646", fontWeight: 500 }}>{atmIv.toFixed(0)}</span>
            </div>
            <div>
              <span style={{ marginRight: 6 }}>ATM:</span>
              <div className="squar__off__type">
                {(["Spot", "Fut", "SynthFut"] as const).map((mode) => (
                  <label
                    key={mode}
                    className={`atm-radio-label${ocAtmMode === mode ? " atm-radio-active" : ""}`}
                    onClick={() => setOcAtmMode(mode)}
                  >
                    <span className="atm-radio-dot" />
                    <span className="atm-radio-title">{mode === "SynthFut" ? "Synth Fut" : mode}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              Straddle Prem:&nbsp;
              <span style={{ color: "#464646", fontWeight: 500 }}>{straddlePremium.toFixed(2)}</span>
            </div>
          </div>

          {/* ── Filter row 2: PCR | OI strip | Max Pain ── */}
          <div className="oc_filter">
            <div>
              PCR:&nbsp;
              <span style={{ color: "#464646", fontWeight: 500 }}>{pcr.toFixed(2)}</span>
            </div>
            <div className="total_oi">
              <div className="total_call_oi">{fmtOI(totalCallOi)}</div>
              <div className="oi-progress"><div className="oi-progress-call" /></div>
              <span>OI</span>
              <div className="oi-progress"><div className="oi-progress-put" /></div>
              <div className="total_put_oi">{fmtOI(totalPutOi)}</div>
            </div>
            <div>
              Max Pain:&nbsp;
              <span style={{ color: "#464646", fontWeight: 500 }}>{maxPain || "—"}</span>
            </div>
          </div>

          {/* ── Table ── */}
          <div className="oc-custom-table">
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
                {optionChainView.map(({ call, put, strike }) => {
                  const isAtm = strike === atmStrike;
                  const isCallItm = strike < currentSpotPrice;
                  const isPutItm = strike > currentSpotPrice;
                  const callOI = call?.oi || 0;
                  const putOI = put?.oi || 0;
                  const callOIPct = `${((callOI / maxCallOI) * 100).toFixed(1)}%`;
                  const putOIPct = `${((putOI / maxPutOI) * 100).toFixed(1)}%`;
                  const callIV = call?.iv || 0;
                  const putIV = put?.iv || 0;
                  const combinedIV = callIV && putIV ? (callIV + putIV) / 2 : callIV || putIV;
                  const buyCallActive = hasOcPos(strike, "Call", "Buy");
                  const sellCallActive = hasOcPos(strike, "Call", "Sell");
                  const buyPutActive = hasOcPos(strike, "Put", "Buy");
                  const sellPutActive = hasOcPos(strike, "Put", "Sell");
                  let rowCls = "oc-row";
                  if (isAtm) rowCls += " oc-atm";
                  else if (isCallItm) rowCls += " oc-call-itm";
                  else if (isPutItm) rowCls += " oc-put-itm";
                  return (
                    <tr key={strike} className={rowCls}>
                      {/* Call LTP — [B][S] left, ltp delta right */}
                      <td className="oc-call-td">
                        <div className="oc-cell-inner">
                          <div className={`oc-actions action_button${buyCallActive || sellCallActive ? " has-active" : ""}`}>
                            <button type="button" className={`buy_button${buyCallActive ? " oc-btn-active" : ""}`} onClick={() => toggleOcPos(strike, "Call", "Buy", call?.close || 0)}>B</button>
                            <button type="button" className={`sell_button${sellCallActive ? " oc-btn-active" : ""}`} onClick={() => toggleOcPos(strike, "Call", "Sell", call?.close || 0)}>S</button>
                          </div>
                          {call ? (<><span className="oc-ltp">{call.close.toFixed(2)}</span><span className="oc-delta">({call.delta != null ? call.delta.toFixed(2) : "—"})</span></>) : <span className="oc-empty">—</span>}
                        </div>
                      </td>
                      {/* Call OI — bar fills right-to-left */}
                      <td className="oc-call-oi-td">
                        <div className="oc-oi-value oc-oi-call">{fmtOI(callOI)}</div>
                        <div className="oc-oi-bar-wrap"><div className="oc-oi-bar oc-oi-bar-call" style={{ width: callOIPct }} /></div>
                      </td>
                      {/* IV */}
                      <td className="oc-iv-td">
                        {combinedIV ? <span className="oc-iv-value">{(combinedIV * 100).toFixed(2)}%</span> : <span className="oc-empty">—</span>}
                      </td>
                      {/* Strike */}
                      <td className="oc-strike-td">{strike}</td>
                      {/* Put OI — bar fills left-to-right */}
                      <td className="oc-put-oi-td">
                        <div className="oc-oi-value oc-oi-put">{fmtOI(putOI)}</div>
                        <div className="oc-oi-bar-wrap"><div className="oc-oi-bar oc-oi-bar-put" style={{ width: putOIPct }} /></div>
                      </td>
                      {/* Put LTP — ltp delta left, [B][S] right */}
                      <td className="oc-put-td">
                        <div className="oc-cell-inner">
                          {put ? (<><span className="oc-ltp">{put.close.toFixed(2)}</span><span className="oc-delta">({put.delta != null ? put.delta.toFixed(2) : "—"})</span></>) : <span className="oc-empty">—</span>}
                          <div className={`oc-actions action_button${buyPutActive || sellPutActive ? " has-active" : ""}`}>
                            <button type="button" className={`buy_button${buyPutActive ? " oc-btn-active" : ""}`} onClick={() => toggleOcPos(strike, "Put", "Buy", put?.close || 0)}>B</button>
                            <button type="button" className={`sell_button${sellPutActive ? " oc-btn-active" : ""}`} onClick={() => toggleOcPos(strike, "Put", "Sell", put?.close || 0)}>S</button>
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

          <div className="chart-section">
          <div className="chart-wrapper" ref={chartWrapperRef}>
            <canvas ref={canvasRef} id="payoffChart" />

            {tooltip.visible && (
              <div className="payoff-tooltip" style={{ display: "block", left: tooltip.left, top: tooltip.top }}>
                <div className="payoff-tooltip-title">{tooltip.title}</div>
                <div className="payoff-tooltip-row">
                  <span className="payoff-tooltip-label">Price</span>
                  <span className="payoff-tooltip-value">₹{tooltip.price.toFixed(2)}</span>
                </div>
                {tooltip.pnl != null && (
                  <div className="payoff-tooltip-row">
                    <span className="payoff-tooltip-label">P&amp;L</span>
                    <span className="payoff-tooltip-value" style={{ color: tooltip.pnl >= 0 ? "#22c55e" : "#ef4444" }}>
                      ₹{tooltip.pnl.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {tooltip.expiryPnl != null && (
                  <div className="payoff-tooltip-row payoff-tooltip-divider">
                    <span className="payoff-tooltip-label">At Expiry</span>
                    <span className="payoff-tooltip-value" style={{ color: tooltip.expiryPnl >= 0 ? "#22c55e" : "#ef4444" }}>
                      ₹{tooltip.expiryPnl.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="payoff-tooltip-row payoff-tooltip-divider">
                  <span className="payoff-tooltip-label">Put OI</span>
                  <span className="payoff-tooltip-value" style={{ color: "#f87171" }}>
                    {tooltip.putOi != null ? Math.round(tooltip.putOi).toLocaleString() : "—"}
                  </span>
                </div>
                <div className="payoff-tooltip-row">
                  <span className="payoff-tooltip-label">Call OI</span>
                  <span className="payoff-tooltip-value" style={{ color: "#60a5fa" }}>
                    {tooltip.callOi != null ? Math.round(tooltip.callOi).toLocaleString() : "—"}
                  </span>
                </div>
              </div>
            )}

            {chartArea && frozenAdjLevels?.upper != null && priceToX(frozenAdjLevels.upper) != null && (
              <div
                className="adj-line adj-line-upper"
                style={{
                  display: "block",
                  height: chartArea.bottom - chartArea.top,
                  left: priceToX(frozenAdjLevels.upper) || 0,
                  top: chartArea.top,
                }}
              >
                <div className="adj-line-label">{renderPriceLabel(frozenAdjLevels.upper, "adj")}</div>
              </div>
            )}

            {chartArea && frozenAdjLevels?.lower != null && priceToX(frozenAdjLevels.lower) != null && (
              <div
                className="adj-line adj-line-lower"
                style={{
                  display: "block",
                  height: chartArea.bottom - chartArea.top,
                  left: priceToX(frozenAdjLevels.lower) || 0,
                  top: chartArea.top,
                }}
              >
                <div className="adj-line-label">{renderPriceLabel(frozenAdjLevels.lower, "adj")}</div>
              </div>
            )}

            {spotVisible && (
              <>
                <div className="spot-line" style={{ display: "block", height: chartArea.bottom - chartArea.top, left: spotX || 0, top: chartArea.top }} />
                <div className="spot-price-label" style={{ display: "block", left: spotX || 0, top: chartArea.top - 30 }}>
                  ₹{currentSpotPrice.toFixed(2)}
                </div>
                <div
                  className={`floating-pnl${floatingLoss ? " loss" : ""}`}
                  style={{ display: "flex", left: (spotX || 0) - 70, top: chartArea.bottom + 50 }}
                >
                  <span>{fmtCurrency(payoffAtSpot)}</span>
                  <span className="info-icon">ⓘ</span>
                </div>
              </>
            )}

            {zoomSelection.visible && (
              <div className="zoom-selection" style={{ display: "block", ...zoomSelection }} />
            )}

            {userCustomZoom && (
              <button className="zoom-reset-btn" onClick={resetZoom}>
                Reset Zoom
              </button>
            )}

            <div className="zoom-controls">
              <button
                type="button"
                className="zoom-ctrl-btn"
                title="Zoom In"
                onClick={() => {
                  const center = (zoomStartPrice + zoomEndPrice) / 2;
                  const half = (zoomEndPrice - zoomStartPrice) / 2;
                  applyZoomRange(center - half * 0.7, center + half * 0.7);
                }}
              >
                +
              </button>
              <button
                type="button"
                className="zoom-ctrl-btn"
                title="Zoom Out"
                onClick={() => {
                  const center = (zoomStartPrice + zoomEndPrice) / 2;
                  const half = (zoomEndPrice - zoomStartPrice) / 2;
                  applyZoomRange(center - half * 1.4, center + half * 1.4);
                }}
              >
                −
              </button>
            </div>

            <button
              className={`sl-config-btn${slMode ? " active" : ""}`}
              onClick={() => {
                if (slMode) {
                  setSlMode(false);
                  setSlHoverPrice(null);
                  setSlMarkerPrice(null);
                } else {
                  const nextCondition: StoplossCondition = !slSavedUpper && slSavedLower ? ">=" : "<=";
                  const existing = nextCondition === ">=" ? slSavedUpper : slSavedLower;
                  setSlCondition(nextCondition);
                  setSlMarkerPrice(existing?.price ?? null);
                  setSlHoverPrice(null);
                  setSlMode(true);
                }
              }}
            >
              {slMode ? "✕ Cancel" : "⚡ Stoploss"}
            </button>

            {slMode && chartArea && slHoverPrice != null && priceToX(slHoverPrice) != null && (
              <div className="sl-hover-line" style={{ display: "block", height: chartArea.bottom - chartArea.top, left: priceToX(slHoverPrice) || 0, top: chartArea.top }} />
            )}

            {slMode && chartArea && editingSlPrice != null && editingSlX != null && (
              <>
                {slMarkerPrice != null && (
                  <div
                    className="sl-marker-line"
                    style={{
                      display: "block",
                      height: chartArea.bottom - chartArea.top,
                      left: priceToX(slMarkerPrice) ?? 0,
                      top: chartArea.top,
                    }}
                  />
                )}
                <div
                  className="sl-shade-region"
                  style={{
                    display: "block",
                    left: slCondition === "<=" ? chartArea.left : editingSlX,
                    top: chartArea.top,
                    width:
                      slCondition === "<="
                        ? editingSlX - chartArea.left
                        : chartArea.right - editingSlX,
                    height: chartArea.bottom - chartArea.top,
                    background: slCondition === ">=" ? "rgba(22,163,74,.10)" : "rgba(220,38,38,.10)",
                  }}
                />
              </>
            )}

            {chartArea && slSavedUpper && priceToX(slSavedUpper.price) != null && (!slMode || slCondition !== ">=") && (
              <>
                <div className="sl-marker-line sl-marker-upper" style={{ display: "block", height: chartArea.bottom - chartArea.top, left: priceToX(slSavedUpper.price) || 0, top: chartArea.top }}>
                  <div className="sl-marker-label sl-label-upper">{renderPriceLabel(slSavedUpper.price, "sl")}</div>
                </div>
                <div
                  className="sl-shade-region"
                  style={{
                    background: "rgba(22,163,74,.10)",
                    display: "block",
                    left: priceToX(slSavedUpper.price) || 0,
                    top: chartArea.top,
                    width: chartArea.right - (priceToX(slSavedUpper.price) || chartArea.right),
                    height: chartArea.bottom - chartArea.top,
                  }}
                />
              </>
            )}

            {chartArea && slSavedLower && priceToX(slSavedLower.price) != null && (!slMode || slCondition !== "<=") && (
              <>
                <div className="sl-marker-line sl-marker-lower" style={{ display: "block", height: chartArea.bottom - chartArea.top, left: priceToX(slSavedLower.price) || 0, top: chartArea.top }}>
                  <div className="sl-marker-label sl-label-lower">{renderPriceLabel(slSavedLower.price, "sl")}</div>
                </div>
                <div
                  className="sl-shade-region"
                  style={{
                    background: "rgba(220,38,38,.10)",
                    display: "block",
                    left: chartArea.left,
                    top: chartArea.top,
                    width: (priceToX(slSavedLower.price) || chartArea.left) - chartArea.left,
                    height: chartArea.bottom - chartArea.top,
                  }}
                />
              </>
            )}

            {slMode && (
              <div
                className="sl-config-panel"
                style={{
                  display: "block",
                  left: panelPosition.left ?? undefined,
                  right: panelPosition.left == null ? 20 : "auto",
                  top: panelPosition.top ?? 80,
                }}
              >
                <div
                  className="sl-panel-header"
                  onMouseDown={(event) => {
                    const rect = (event.currentTarget.parentElement as HTMLDivElement).getBoundingClientRect();
                    panelDragRef.current = {
                      active: true,
                      offsetX: event.clientX - rect.left,
                      offsetY: event.clientY - rect.top,
                    };
                    const onMove = (moveEvent: MouseEvent) => {
                      if (!panelDragRef.current.active) return;
                      setPanelPosition({
                        left: Math.max(0, moveEvent.clientX - panelDragRef.current.offsetX),
                        top: Math.max(0, moveEvent.clientY - panelDragRef.current.offsetY),
                      });
                    };
                    const onUp = () => {
                      panelDragRef.current.active = false;
                      document.removeEventListener("mousemove", onMove);
                      document.removeEventListener("mouseup", onUp);
                    };
                    document.addEventListener("mousemove", onMove);
                    document.addEventListener("mouseup", onUp);
                  }}
                >
                  <span className="sl-panel-title">⚡ Configure Stoploss</span>
                  <button className="sl-panel-close" onClick={() => setSlMode(false)}>
                    ×
                  </button>
                </div>
                <div className="sl-panel-body">
                  <div className="sl-instruction">
                    {slMarkerPrice == null ? "Click on the chart to place stoploss level" : "Price set. Adjust or save."}
                  </div>
                  <div className="sl-panel-row">
                    <label>Trigger when NIFTY goes</label>
                    <div className="sl-condition-row">
                      <select value={slCondition} onChange={(event) => setSlCondition(event.target.value as StoplossCondition)}>
                        <option value="<=">Below ≤</option>
                        <option value=">=">Above ≥</option>
                      </select>
                      <input
                        type="number"
                        placeholder="Price"
                        step={50}
                        value={slMarkerPrice ?? ""}
                        onChange={(event) => setSlMarkerPrice(event.target.value ? Number(event.target.value) : null)}
                      />
                    </div>
                  </div>
                  <div className="sl-panel-row">
                    <label>Current Spot</label>
                    <span className="sl-spot-value">₹{currentSpotPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="sl-panel-row">
                    <div className="sl-diff-row">
                      <span>
                        {activeSlPrice == null
                          ? "— pts"
                          : `${activeSlPrice - currentSpotPrice >= 0 ? "+" : ""}${Math.round(activeSlPrice - currentSpotPrice)} pts`}
                      </span>
                      <span>
                        {activeSlPrice == null
                          ? "—%"
                          : `${((activeSlPrice - currentSpotPrice) / currentSpotPrice) * 100 >= 0 ? "+" : ""}${(((activeSlPrice - currentSpotPrice) / currentSpotPrice) * 100).toFixed(2)}%`}
                      </span>
                    </div>
                  </div>
                  <div className={`sl-pnl-box${activeSlProfit ? " profit" : ""}`}>
                    <div className="sl-pnl-label">Approx P&amp;L at exit</div>
                    <div className={`sl-pnl-value${activeSlProfit ? " profit" : ""}`}>{activeSlPnl == null ? "—" : fmtCurrency(activeSlPnl)}</div>
                  </div>
                  <div className="sl-panel-actions">
                    <button className="sl-cancel-btn" onClick={() => setSlMode(false)}>
                      Cancel
                    </button>
                    <button
                      className="sl-save-btn"
                      disabled={slMarkerPrice == null}
                      onClick={() => {
                        if (slMarkerPrice == null) return;
                        const nextValue = { condition: slCondition, price: slMarkerPrice };
                        if (slCondition === ">=") setSlSavedUpper(nextValue);
                        else setSlSavedLower(nextValue);
                        setSlMode(false);
                      }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="payoff-bottom">
            P&amp;L : <span style={{ color: payoffAtSpot >= 0 ? "#16a34a" : "#dc2626" }}>{fmtCurrency(payoffAtSpot)}</span>
          </div>

          {(slSavedUpper || slSavedLower) && (
            <div className="sl-saved-bar">
              <span>SL:</span>
              {slSavedUpper && (
                <span>
                  Above ≥ ₹{slSavedUpper.price.toLocaleString("en-IN")}{" "}
                  <span>({fmtCurrency(calculatePnL(slSavedUpper.price))})</span>{" "}
                  <button className="sl-remove-link" onClick={() => removeStoploss("upper")}>
                    remove
                  </button>
                </span>
              )}
              {slSavedUpper && slSavedLower && <span>|</span>}
              {slSavedLower && (
                <span>
                  Below ≤ ₹{slSavedLower.price.toLocaleString("en-IN")}{" "}
                  <span>({fmtCurrency(calculatePnL(slSavedLower.price))})</span>{" "}
                  <button className="sl-remove-link" onClick={() => removeStoploss("lower")}>
                    remove
                  </button>
                </span>
              )}
              <button className="sl-saved-edit" onClick={() => setSlMode(true)}>
                Edit
              </button>
            </div>
          )}

        {/* ─────────── Position Table ─────────── */}
        <div className="pos-section">

        {/* Tab bar */}
        <div className="pos-tabs">
          {(["Positions", "Greeks", "TargetPnL", "Notes"] as const).map((tab) => (
            <button key={tab} type="button"
              className={`pos-tab${posActiveTab === tab ? " active" : ""}`}
              onClick={() => setPosActiveTab(tab)}
            >
              {tab === "TargetPnL" ? "Target P&L (blue line)" : tab}
            </button>
          ))}
          <div className="pos-tab-right">Add Notes&nbsp;&nbsp;|&nbsp;&nbsp;Add ons ▾</div>
        </div>

        {posActiveTab === "Positions" && (
          <div className="position_table">
            <table style={{ width: "100%", minWidth: 700, tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: 65 }} /><col style={{ width: 72 }} /><col style={{ width: "5%" }} />
                <col style={{ width: 90 }} /><col style={{ width: 78 }} /><col style={{ width: 80 }} />
                <col style={{ width: "8%" }} /><col style={{ width: "8%" }} /><col style={{ width: "6%" }} />
                <col style={{ width: "13%" }} /><col style={{ width: 105 }} />
              </colgroup>
              <thead>
                <tr className="sticky-top">
                  <th className="action_head" style={{ padding: 0 }}>
                    <div className="action_button_group" style={{ paddingLeft: 4 }}>
                      <label className="checkbox-container-pt"><span className="checkbox-custom-pt checked" /></label>
                      <span style={{ width: 18, display: "inline-block" }} />
                    </div>
                  </th>
                  <th className="lotsize_head">Lots</th>
                  <th>Qty</th>
                  <th>Date &nbsp;↕</th>
                  <th>Strike &nbsp;◇</th>
                  <th>Expiry</th>
                  <th>Entry</th>
                  <th>LTP/Exit</th>
                  <th>Delta</th>
                  <th>P&amp;L</th>
                  <th>Lots Exit &nbsp;◇</th>
                </tr>
              </thead>
              <tbody>
                {optionLegs.length === 0 ? (
                  <tr><td colSpan={11} className="pos-empty">No positions — click B or S on the option chain to add.</td></tr>
                ) : (
                  optionLegs.map((leg, index) => {
                    const ltp = getLegLTP(leg);
                    const delta = getLegDelta(leg);
                    const pnl = getLegPnl(leg);
                    const pnlPct = leg.premium > 0 ? Math.abs(pnl / (leg.premium * leg.quantity)) * 100 : 0;
                    const pnlCls = pnl >= 0 ? "simulator_green_text" : "simulator_red_text";
                    const lots = Math.max(1, Math.round(leg.quantity / LOT_SIZE));
                    const typeCode = leg.optionType === "Call" ? "CE" : "PE";
                    const typeCls = leg.optionType === "Call" ? "call-btn-pt" : "put-btn-pt";
                    const isIncluded = leg.includeInPnl !== false;
                    return (
                      <tr key={`${index}-${leg.expiry}-${leg.strike}-${leg.type}`}
                        className={`parent_position${leg.exited ? " exited__SL" : ""}`}
                        style={{ opacity: leg.exited ? 0.8 : 1 }}
                      >
                        {/* Checkbox + B/S */}
                        <td style={{ padding: 0, paddingLeft: 4 }}>
                          <div className="action_button_group">
                            <label className="checkbox-container-pt" onClick={() => toggleInclude(index)}>
                              <span className={`checkbox-custom-pt${isIncluded ? " checked" : ""}`} />
                            </label>
                            <div className={leg.type === "Buy" ? "pt-buy-btn" : "pt-sell-btn"}>
                              {leg.type === "Buy" ? "B" : "S"}
                            </div>
                          </div>
                        </td>
                        {/* Lots */}
                        <td>
                          <div className="simulator_position_input position__strike">
                            <button className="sign_btn" onClick={() => updateLots(index, lots - 1)}>−</button>
                            <input type="number" className="sim-input lot-input" value={lots} min={1}
                              onChange={(e) => updateLots(index, parseInt(e.target.value) || 1)} />
                            <button className="sign_btn" onClick={() => updateLots(index, lots + 1)}>+</button>
                          </div>
                        </td>
                        {/* Qty */}
                        <td>{leg.quantity}</td>
                        {/* Date */}
                        <td><div style={{ display: "flex", flexDirection: "column" }}><span>{fmtEntryDate(leg.entryDate)}</span></div></td>
                        {/* Strike */}
                        <td>
                          <div className="position__strike">
                            <span>{leg.strike}</span>
                            <span className={typeCls}>{typeCode}</span>
                          </div>
                        </td>
                        {/* Expiry */}
                        <td><div className="position__expiry">{fmtExpiry(leg.expiry)}</div></td>
                        {/* Entry */}
                        <td>
                          <input type="number" step="any" className="sim-input"
                            defaultValue={leg.premium.toFixed(2)}
                            onBlur={(e) => updateEntryPrice(index, parseFloat(e.target.value) || leg.premium)} />
                        </td>
                        {/* LTP/Exit */}
                        <td><input type="number" step="any" className="sim-input" value={ltp.toFixed(2)} readOnly /></td>
                        {/* Delta */}
                        <td style={{ textAlign: "center" }}>{delta != null ? delta.toFixed(2) : "—"}</td>
                        {/* P&L */}
                        <td className={pnlCls}>
                          <div style={{ whiteSpace: "nowrap" }}>
                            <span>{pnl < 0 ? "-" : ""}₹{Math.abs(pnl).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span className={`expiry_indicator ${pnlCls}`}> ({pnlPct.toFixed(0)}%)</span>
                          </div>
                        </td>
                        {/* Lots Exit */}
                        <td>
                          <div className="simulator_position_button">
                            <select className="lot_select_space">
                              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                            {leg.exited
                              ? <button type="button" className="pos-exit-btn" title="Reopen" onClick={() => reopenLeg(index)}>↺</button>
                              : <button type="button" className="pos-exit-btn" title="Exit" onClick={() => exitLeg(index)}>⊗</button>
                            }
                            <button type="button" className="pos-del-btn" title="Delete" onClick={() => removeLeg(index)}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="table_footer">
                  <th colSpan={8} style={{ textAlign: "left" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ marginLeft: 4 }}>Multiplier:</span>
                      <div className="simulator_group_input">
                        <button type="button" className="sign_button" disabled={multiplier <= 1} onClick={() => setMultiplier((m) => Math.max(1, m - 1))}>−</button>
                        <input className="mult_input" type="number" value={multiplier} min={1}
                          onChange={(e) => setMultiplier(Math.max(1, parseInt(e.target.value) || 1))} />
                        <button type="button" className="sign_button" onClick={() => setMultiplier((m) => m + 1)}>+</button>
                      </div>
                      <span style={{ color: "#6b7280", marginLeft: 4 }}>Lot Size: {LOT_SIZE}</span>
                      <button type="button" className="btn-outline-xs" style={{ marginLeft: 4 }}>Add Alert</button>
                      <button type="button" className="btn-outline-xs">Save</button>
                      <button type="button" className="btn-outline-xs">Share</button>
                    </div>
                  </th>
                  <th style={{ textAlign: "center", color: totalDelta >= 0 ? "#03B760" : "#EF6161" }}>
                    {totalDelta.toFixed(2)}
                  </th>
                  <th className={totalPositionPnl >= 0 ? "simulator_green_text" : "simulator_red_text"}>
                    {totalPositionPnl < 0 ? "-" : ""}₹{Math.abs(totalPositionPnl).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </th>
                  <th>
                    <div className="simulator_position_button">
                      <a className="pos-exit-all" style={{ cursor: "pointer" }} onClick={() => setOptionLegs((prev) => prev.map((leg) => { const ltp2 = getLTP(leg.strike, leg.expiry, leg.optionType); const d2 = getLegDelta(leg); return { ...leg, exited: true, exitPrice: ltp2 ?? leg.premium, exitDelta: d2 }; }))}>Exit</a>
                      <a className="pos-clear-all" style={{ cursor: "pointer" }} onClick={() => setOptionLegs([])}>Clear</a>
                    </div>
                  </th>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {posActiveTab !== "Positions" && (
          <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
            {posActiveTab === "Greeks" && "Greeks view coming soon…"}
            {posActiveTab === "TargetPnL" && "Target P&L chart coming soon…"}
            {posActiveTab === "Notes" && "Notes coming soon…"}
          </div>
        )}
        </div>
      </div>
    </div>
  </div>
  );
}
