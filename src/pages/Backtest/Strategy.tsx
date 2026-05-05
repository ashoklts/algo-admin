import { useState, useRef, useEffect, type ReactNode } from "react";
import PageMeta from "../../components/common/PageMeta";
import Select, { type Option } from "../../components/form/Select";
import { Modal } from "../../components/ui/modal";
import Button from "../../components/ui/button/Button";

// ─── Primitive UI helpers ────────────────────────────────────────────────────

function ActionButton({ label, icon }: { label: string; icon: ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-[#465fff] transition hover:border-[#465fff]/30 hover:bg-[#1284d0]/10"
    >
      <span className="text-slate-500">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function StatBlock({
  label,
  value,
  action,
}: {
  label: string;
  value: string;
  action: string;
}) {
  return (
    <div className="text-right">
      <p className="text-xs text-slate-400">{label}</p>
      <div className="mt-1 flex items-center justify-end gap-3">
        <span className="text-base font-bold text-slate-900">{value}</span>
        <button
          type="button"
          className="text-xs font-medium text-[#465fff] hover:text-[#465fff]"
        >
          {action}
        </button>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-sm font-normal text-slate-600">{children}</label>;
}

function InfoIcon() {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-xs text-slate-400">
      i
    </span>
  );
}

function ToggleSwitch({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle?: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
        enabled ? "bg-[#1284d0]" : "bg-slate-400"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition ${
          enabled ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  compact = false,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  compact?: boolean;
}) {
  return (
    <div className="inline-flex rounded-md border border-[#465fff] bg-white p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-[4px] px-3 py-1 text-sm font-medium transition ${
            value === opt.value
              ? "bg-[#1284d0] text-white"
              : "text-[#465fff] hover:bg-[#1284d0]/10"
          } ${compact ? "px-2.5 py-1 text-xs" : ""}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}


function CompactSelect({
  value,
  options,
  onChange,
  wide = false,
  placeholder,
  className = "",
  menuClassName = "",
  optionClassName = "",
  selectedOptionClassName = "",
  iconClassName = "",
  triggerStyle,
  menuStyle,
  optionStyle,
  selectedOptionStyle,
  iconStyle,
}: {
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  wide?: boolean;
  placeholder?: string;
  className?: string;
  menuClassName?: string;
  optionClassName?: string;
  selectedOptionClassName?: string;
  iconClassName?: string;
  triggerStyle?: React.CSSProperties;
  menuStyle?: React.CSSProperties;
  optionStyle?: React.CSSProperties;
  selectedOptionStyle?: React.CSSProperties;
  iconStyle?: React.CSSProperties;
}) {
  return (
    <Select
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`h-9 min-h-9 rounded-md border-slate-200 px-3 py-2 text-sm shadow-none ${
        wide ? "min-w-[146px]" : "min-w-[104px]"
      } ${className}`}
      menuClassName={menuClassName}
      optionClassName={optionClassName}
      selectedOptionClassName={selectedOptionClassName}
      iconClassName={iconClassName}
      triggerStyle={triggerStyle}
      menuStyle={menuStyle}
      optionStyle={optionStyle}
      selectedOptionStyle={selectedOptionStyle}
      iconStyle={iconStyle}
    />
  );
}

function NativeSelect({
  value,
  options,
  onChange,
  className = "",
}: {
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className="relative w-max">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`cursor-pointer appearance-none rounded border border-slate-300 bg-white py-1.5 pl-3 pr-8 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#465fff]/60 ${className}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-slate-500"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

function TextInput({
  value,
  onChange,
  className = "",
  type = "text",
  placeholder,
}: {
  value: string;
  onChange?: (v: string) => void;
  className?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      className={`h-9 min-w-[78px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-hidden transition focus:border-[#465fff] focus:ring-3 focus:ring-[#465fff]/10 ${className}`}
    />
  );
}

// ─── Option data (exact values from HTML) ───────────────────────────────────

const indexOptions: Option[] = [
  { value: "NIFTY", label: "NIFTY" },
  { value: "BANKNIFTY", label: "BANKNIFTY" },
  { value: "FINNIFTY", label: "FINNIFTY" },
  { value: "MIDCPNIFTY", label: "MIDCPNIFTY" },
  { value: "SENSEX", label: "SENSEX" },
  { value: "BANKEX", label: "BANKEX" },
];

const overallMomentumTypeOptions: Option[] = [
  { value: "OverallMomentumType.PointsUp", label: "Points (Pts) ↑" },
  { value: "OverallMomentumType.PointsDown", label: "Points (Pts) ↓" },
  { value: "OverallMomentumType.PercentageUp", label: "Percent (%) ↑" },
  { value: "OverallMomentumType.PercentageDown", label: "Percent (%) ↓" },
];

const expiryOptions: Option[] = [
  { value: "ExpiryType.Weekly", label: "Weekly" },
  { value: "ExpiryType.NextWeekly", label: "Next Weekly" },
  { value: "ExpiryType.Monthly", label: "Monthly" },
  { value: "ExpiryType.NextMonthly", label: "Next Monthly" },
];

const strikeTypeOptions: Option[] = [
  ...Array.from({ length: 20 }, (_, i) => ({
    value: `StrikeType.ITM${20 - i}`,
    label: `ITM${20 - i}`,
  })),
  { value: "StrikeType.ATM", label: "ATM" },
  ...Array.from({ length: 30 }, (_, i) => ({
    value: `StrikeType.OTM${i + 1}`,
    label: `OTM${i + 1}`,
  })),
];

const strikeCriteriaOptions: Option[] = [
  { value: "EntryType.EntryByStrikeType", label: "Strike Type" },
  { value: "EntryType.EntryByPremiumRange", label: "Premium Range" },
  { value: "EntryType.EntryByPremium", label: "Closest Premium" },
  { value: "EntryType.EntryByPremiumGEQ", label: "Premium >=" },
  { value: "EntryType.EntryByPremiumLEQ", label: "Premium <=" },
  { value: "EntryType.EntryByStraddlePrice", label: "Straddle Width" },
  { value: "EntryType.EntryByAtmMultiplier", label: "% of ATM" },
  { value: "EntryType.EntryBySyntheticFuture", label: "Synthetic Future" },
  {
    value: "EntryType.EntryByPremiumCloseToStraddle",
    label: "ATM Straddle Premium %",
  },
  { value: "EntryType.EntryByDelta", label: "Closest Delta" },
  { value: "EntryType.EntryByDeltaRange", label: "Delta Range" },
];

const adjustmentOptions: Option[] = [
  { value: "AdjustmentType.Plus", label: "Plus" },
  { value: "AdjustmentType.Minus", label: "Minus" },
];

const positionOptions: Option[] = [
  { value: "PositionType.Buy", label: "Buy" },
  { value: "PositionType.Sell", label: "Sell" },
];

const optionTypeOptions: Option[] = [
  { value: "LegType.CE", label: "Call" },
  { value: "LegType.PE", label: "Put" },
];

const legTgtSLTypeOptions: Option[] = [
  { value: "LegTgtSLType.Points", label: "Points (Pts)" },
  { value: "LegTgtSLType.UnderlyingPoints", label: "Underlying Pts" },
  { value: "LegTgtSLType.Percentage", label: "Percent (%)" },
  { value: "LegTgtSLType.UnderlyingPercentage", label: "Underlying %" },
];

const legReentryActionOptions: Option[] = [
  { value: "ReentryType.Immediate", label: "RE ASAP" },
  { value: "ReentryType.ImmediateReverse", label: "RE ASAP ↩" },
  { value: "ReentryType.LikeOriginal", label: "RE MOMENTUM" },
  { value: "ReentryType.LikeOriginalReverse", label: "RE MOMENTUM ↩" },
  { value: "ReentryType.AtCost", label: "RE COST" },
  { value: "ReentryType.AtCostReverse", label: "RE COST ↩" },
  { value: "ReentryType.NextLeg", label: "Lazy Leg" },
];

const trailSLTypeOptions: Option[] = [
  { value: "TrailStopLossType.Points", label: "Points" },
  { value: "TrailStopLossType.Percentage", label: "Percentage" },
];

const simpleMomentumTypeOptions: Option[] = [
  { value: "MomentumType.PointsUp", label: "Points (Pts) ↑" },
  { value: "MomentumType.PointsDown", label: "Points (Pts) ↓" },
  { value: "MomentumType.PercentageUp", label: "Percent (%) ↑" },
  { value: "MomentumType.PercentageDown", label: "Percent (%) ↓" },
  { value: "MomentumType.UnderlyingPointsUp", label: "Underlying Pts ↑" },
  { value: "MomentumType.UnderlyingPointsDown", label: "Underlying Pts ↓" },
  { value: "MomentumType.UnderlyingPercentageUp", label: "Underlying % ↑" },
  { value: "MomentumType.UnderlyingPercentageDown", label: "Underlying % ↓" },
];

const rangeBreakoutTrackingOptions: Option[] = [
  { value: "true", label: "Underlying" },
  { value: "false", label: "Strike Price" },
];

const rangeBreakoutModalTrackingOptions: Option[] = [
  { value: "false", label: "Strike Price" },
  { value: "true", label: "Underlying" },
];

const overallTgtSLTypeOptions: Option[] = [
  { value: "OverallTgtSLType.MTM", label: "Max Loss" },
  { value: "OverallTgtSLType.PremiumPercentage", label: "Total Premium %" },
];

const overallActionOptions: Option[] = [
  { value: "ReentryType.Immediate", label: "RE ASAP" },
  { value: "ReentryType.ImmediateReverse", label: "RE ASAP ↩" },
  { value: "ReentryType.LikeOriginal", label: "RE MOMENTUM" },
  { value: "ReentryType.LikeOriginalReverse", label: "RE MOMENTUM ↩" },
];

const reentryCountOptions: Option[] = Array.from({ length: 10 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

const trailingTypeOptions: Option[] = [
  { value: "TrailingOption.Lock", label: "Lock" },
  { value: "TrailingOption.LockAndTrail", label: "Lock and Trail" },
  { value: "TrailingOption.OverallTrailSL", label: "Overall Trail SL" },
];

// ─── Leg state ───────────────────────────────────────────────────────────────

type LegState = {
  id: number;
  lots: string;
  position: string;
  optionType: string;
  expiry: string;
  strikeCriteria: string;
  strikeValue: string;
  straddleMultiplier: string;
  straddleAdjustment: string;
  straddleStrikeKind: string;
  atmMultiplier: string;
  atmStrikeKind: string;
  rangeLower: string;
  rangeUpper: string;
  targetProfitEnabled: boolean;
  targetProfitType: string;
  targetProfitValue: string;
  stopLossEnabled: boolean;
  stopLossType: string;
  stopLossValue: string;
  trailSLEnabled: boolean;
  trailSLType: string;
  trailSLInput1: string;
  trailSLInput2: string;
  reentryTgtEnabled: boolean;
  reentryTgtAction: string;
  reentryTgtCount: string;
  reentrySLEnabled: boolean;
  reentrySLAction: string;
  reentrySLCount: string;
  simpleMomentumEnabled: boolean;
  simpleMomentumType: string;
  simpleMomentumValue: string;
  rangeBreakoutEnabled: boolean;
  rangeBreakoutTime: string;
  rangeBreakoutHighLow: string;
  rangeBreakoutTracking: string;
  reentryTgtLazyLegName: string;
  reentrySLLazyLegName: string;
};

function createDefaultLeg(id: number): LegState {
  return {
    id,
    lots: "1",
    position: "PositionType.Sell",
    optionType: "LegType.CE",
    expiry: "ExpiryType.Weekly",
    strikeCriteria: "EntryType.EntryByStrikeType",
    strikeValue: "StrikeType.ATM",
    straddleMultiplier: "0.4",
    straddleAdjustment: "AdjustmentType.Plus",
    straddleStrikeKind: "StrikeType.ATM",
    atmMultiplier: "0.66",
    atmStrikeKind: "StrikeType.ATM",
    rangeLower: "50",
    rangeUpper: "200",
    targetProfitEnabled: false,
    targetProfitType: "LegTgtSLType.Points",
    targetProfitValue: "",
    stopLossEnabled: false,
    stopLossType: "LegTgtSLType.Points",
    stopLossValue: "",
    trailSLEnabled: false,
    trailSLType: "TrailStopLossType.Points",
    trailSLInput1: "",
    trailSLInput2: "",
    reentryTgtEnabled: false,
    reentryTgtAction: "ReentryType.Immediate",
    reentryTgtCount: "1",
    reentrySLEnabled: false,
    reentrySLAction: "ReentryType.Immediate",
    reentrySLCount: "1",
    reentryTgtLazyLegName: "",
    reentrySLLazyLegName: "",
    simpleMomentumEnabled: false,
    simpleMomentumType: "MomentumType.PointsUp",
    simpleMomentumValue: "",
    rangeBreakoutEnabled: false,
    rangeBreakoutTime: "",
    rangeBreakoutHighLow: "High",
    rangeBreakoutTracking: "true",
  };
}

// ─── Strike parameter controls (reused in builder + leg cards) ───────────────

// ─── Builder strike param (inline single-row style) ─────────────────────────

function BuilderStrikeParam({
  strikeCriteria,
  strikeValue,
  rangeLower,
  rangeUpper,
  straddleMultiplier,
  straddleAdjustment,
  straddleStrikeKind,
  atmMultiplier,
  atmStrikeKind,
  onChange,
}: {
  strikeCriteria: string;
  strikeValue: string;
  rangeLower: string;
  rangeUpper: string;
  straddleMultiplier: string;
  straddleAdjustment: string;
  straddleStrikeKind: string;
  atmMultiplier: string;
  atmStrikeKind: string;
  onChange: (key: string, val: string) => void;
}) {
  const numInput = (val: string, key: string, label: string) => (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number"
        value={val}
        onChange={(e) => onChange(key, e.target.value)}
        className="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#465fff]/60"
      />
    </div>
  );

  const numberCriterias = new Set([
    "EntryType.EntryByPremium",
    "EntryType.EntryByPremiumGEQ",
    "EntryType.EntryByPremiumLEQ",
    "EntryType.EntryByAtmMultiplier",
    "EntryType.EntryByDelta",
  ]);
  const rangeCriterias = new Set([
    "EntryType.EntryByPremiumRange",
    "EntryType.EntryByDeltaRange",
  ]);

  if (
    strikeCriteria === "EntryType.EntryByStrikeType" ||
    strikeCriteria === "EntryType.EntryBySyntheticFuture"
  ) {
    return (
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Strike Type</FieldLabel>
        <NativeSelect
          value={strikeValue}
          options={strikeTypeOptions}
          onChange={(v) => onChange("strikeValue", v)}
          className="min-w-[90px]"
        />
      </div>
    );
  }

  if (numberCriterias.has(strikeCriteria)) {
    return numInput(strikeValue, "strikeValue", "Strike Parameter");
  }

  if (rangeCriterias.has(strikeCriteria)) {
    return (
      <>
        {numInput(rangeLower, "rangeLower", "Lower Range")}
        {numInput(rangeUpper, "rangeUpper", "Upper Range")}
      </>
    );
  }

  if (strikeCriteria === "EntryType.EntryByStraddlePrice") {
    return (
      <>
        {numInput(straddleMultiplier, "straddleMultiplier", "Multiplier")}
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Adjustment</FieldLabel>
          <NativeSelect
            value={straddleAdjustment}
            options={adjustmentOptions}
            onChange={(v) => onChange("straddleAdjustment", v)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Strike Kind</FieldLabel>
          <NativeSelect
            value={straddleStrikeKind}
            options={strikeTypeOptions}
            onChange={(v) => onChange("straddleStrikeKind", v)}
            className="min-w-[90px]"
          />
        </div>
      </>
    );
  }

  if (strikeCriteria === "EntryType.EntryByPremiumCloseToStraddle") {
    return (
      <>
        {numInput(atmMultiplier, "atmMultiplier", "Multiplier")}
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Strike Kind</FieldLabel>
          <NativeSelect
            value={atmStrikeKind}
            options={strikeTypeOptions}
            onChange={(v) => onChange("atmStrikeKind", v)}
            className="min-w-[90px]"
          />
        </div>
      </>
    );
  }

  return null;
}

// ─── Lazy Leg Modal ──────────────────────────────────────────────────────────

function uniqueLazyName(existingNames: string[]): string {
  let i = 1;
  while (existingNames.includes(`lazy${i}`)) i++;
  return `lazy${i}`;
}

function subtractOneSecond(time: string): string {
  if (!time || !time.includes(":")) return "09:44:59";
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return "09:44:59";
  const totalSeconds = Math.max(0, hours * 3600 + minutes * 60 - 1);
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

type LazyLegForm = {
  legName: string;
  lots: string;
  position: string;
  optionType: string;
  expiry: string;
  strikeCriteria: string;
  strikeValue: string;
  rangeLower: string;
  rangeUpper: string;
  straddleMultiplier: string;
  straddleAdjustment: string;
  straddleStrikeKind: string;
  atmMultiplier: string;
  atmStrikeKind: string;
  targetProfitEnabled: boolean;
  targetProfitType: string;
  targetProfitValue: string;
  stopLossEnabled: boolean;
  stopLossType: string;
  stopLossValue: string;
  trailSLEnabled: boolean;
  trailSLType: string;
  trailSLInput1: string;
  trailSLInput2: string;
  reentryTgtEnabled: boolean;
  reentryTgtAction: string;
  reentryTgtCount: string;
  reentryTgtLazyLegName: string;
  reentrySLEnabled: boolean;
  reentrySLAction: string;
  reentrySLCount: string;
  reentrySLLazyLegName: string;
  simpleMomentumEnabled: boolean;
  simpleMomentumType: string;
  simpleMomentumValue: string;
};

function defaultLazyLegForm(): LazyLegForm {
  return {
    legName: "lazy1",
    lots: "1",
    position: "PositionType.Buy",
    optionType: "LegType.CE",
    expiry: "ExpiryType.Weekly",
    strikeCriteria: "EntryType.EntryByStrikeType",
    strikeValue: "StrikeType.ATM",
    rangeLower: "50",
    rangeUpper: "200",
    straddleMultiplier: "0.4",
    straddleAdjustment: "AdjustmentType.Plus",
    straddleStrikeKind: "StrikeType.ATM",
    atmMultiplier: "0.66",
    atmStrikeKind: "StrikeType.ATM",
    targetProfitEnabled: false,
    targetProfitType: "LegTgtSLType.Points",
    targetProfitValue: "",
    stopLossEnabled: false,
    stopLossType: "LegTgtSLType.Points",
    stopLossValue: "",
    trailSLEnabled: false,
    trailSLType: "TrailStopLossType.Points",
    trailSLInput1: "",
    trailSLInput2: "",
    reentryTgtEnabled: false,
    reentryTgtAction: "ReentryType.Immediate",
    reentryTgtCount: "1",
    reentryTgtLazyLegName: "",
    reentrySLEnabled: false,
    reentrySLAction: "ReentryType.Immediate",
    reentrySLCount: "1",
    reentrySLLazyLegName: "",
    simpleMomentumEnabled: false,
    simpleMomentumType: "MomentumType.PointsUp",
    simpleMomentumValue: "",
  };
}

function LegSelect({
  value,
  options,
  onChange,
  enabled,
  className = "",
}: {
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  enabled: boolean;
  className?: string;
}) {
  return (
    <div className="relative w-max">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!enabled}
        className={`cursor-pointer appearance-none rounded border border-[#1284d0] bg-[#1284d0] py-1.5 pl-3 pr-8 text-sm text-white focus:outline-none ${
          enabled ? "opacity-100" : "opacity-40 cursor-not-allowed"
        } ${className}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} style={{ backgroundColor: "#1284d0", color: "white" }}>
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-white"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

function LazyLegReentryPicker({
  selectedName,
  lazyLegs,
  enabled,
  onSelect,
  onCreateNew,
}: {
  selectedName: string;
  lazyLegs: LazyLegForm[];
  enabled: boolean;
  onSelect: (name: string) => void;
  onCreateNew: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const label = selectedName || "Lazy Leg";

  return (
    <div ref={ref} className="relative w-max">
      <button
        type="button"
        disabled={!enabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 rounded border border-[#1284d0] bg-[#1284d0] py-1.5 pl-3 pr-2 text-sm text-white focus:outline-none ${
          enabled ? "opacity-100 cursor-pointer" : "opacity-40 cursor-not-allowed"
        }`}
      >
        <span>{label}</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" className="h-4 w-4 text-white">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="p-2">
            <button
              type="button"
              onClick={() => { setOpen(false); onCreateNew(); }}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[#465fff] px-3 py-2 text-sm font-semibold text-white hover:bg-[#3550ee]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New
            </button>
          </div>

          {lazyLegs.length > 0 && (
            <>
              <div className="flex items-center gap-2 px-3 py-1">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400">OR</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="px-2 pb-1">
                <p className="mb-1 px-1 text-xs font-medium text-slate-500">Select from existing</p>
                {lazyLegs
                  .filter((ll, i, arr) => arr.findIndex((x) => x.legName === ll.legName) === i)
                  .map((ll) => (
                    <button
                      key={ll.legName}
                      type="button"
                      onClick={() => { onSelect(ll.legName); setOpen(false); }}
                      className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      <span>{ll.legName}</span>
                      {selectedName === ll.legName && (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                          stroke="currentColor" className="h-4 w-4 text-[#465fff]">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LazyLegModal({
  onClose,
  onConfirm,
  existingNames = [],
  lazyLegs = [],
  onAddLazyLeg,
}: {
  onClose: () => void;
  onConfirm: (form: LazyLegForm) => void;
  existingNames?: string[];
  lazyLegs?: LazyLegForm[];
  onAddLazyLeg?: (form: LazyLegForm) => void;
}) {
  const [form, setForm] = useState<LazyLegForm>(() => ({
    ...defaultLazyLegForm(),
    legName: uniqueLazyName(existingNames),
  }));
  const nameError = existingNames.includes(form.legName.trim());
  const upd = <K extends keyof LazyLegForm>(key: K, val: LazyLegForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));
  const tog = (key: keyof LazyLegForm) =>
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));

  const [nestedFor, setNestedFor] = useState<"tgt" | "sl" | null>(null);

  const handleReentryChange = (which: "tgt" | "sl", value: string) => {
    upd(which === "tgt" ? "reentryTgtAction" : "reentrySLAction", value as LazyLegForm["reentryTgtAction"]);
    if (value !== "ReentryType.NextLeg") {
      upd(which === "tgt" ? "reentryTgtLazyLegName" : "reentrySLLazyLegName", "");
    } else if (lazyLegs.length === 0) {
      setNestedFor(which);
    }
  };

  const handleNestedConfirm = (newForm: LazyLegForm) => {
    onAddLazyLeg?.(newForm);
    upd(nestedFor === "tgt" ? "reentryTgtLazyLegName" : "reentrySLLazyLegName", newForm.legName);
    setNestedFor(null);
  };

  const modalInput = (val: string, key: keyof LazyLegForm, enabled: boolean) => (
    <input
      type="number"
      value={val}
      onChange={(e) => upd(key, e.target.value as LazyLegForm[typeof key])}
      disabled={!enabled}
      className={`w-16 rounded border px-2 py-1.5 text-sm focus:outline-none ${
        enabled ? "border-slate-300 text-slate-700" : "border-slate-200 text-slate-400 opacity-40"
      }`}
    />
  );

  return (
    <>
    <Modal isOpen onClose={onClose} className="max-w-[1100px] m-4 p-0">
      <div>

        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-gray-200 px-7 py-5 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Create New Lazy Leg</h2>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-col gap-5 px-7 pb-6">

          {/* Leg Name */}
          <div className="flex items-center gap-5">
            <label className="whitespace-nowrap text-sm font-normal text-slate-600">
              Enter Leg Name
            </label>
            <div className="flex flex-col gap-1">
              <input type="text" value={form.legName}
                onChange={(e) => upd("legName", e.target.value)}
                className={`rounded border px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 w-44 ${
                  nameError
                    ? "border-red-400 focus:ring-red-400/60"
                    : "border-slate-300 focus:ring-[#465fff]/60"
                }`} />
              {nameError && (
                <span className="text-xs text-red-500">Name already exists</span>
              )}
            </div>
          </div>

          {/* ── Inner card ── */}
          <div className="rounded-xl border border-slate-200 p-5">

            {/* Row 1 — all fields in one scrollable line */}
            <div className="overflow-x-auto">
              <div className="flex min-w-max items-end gap-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-[#465fff]">Lots</label>
                  <input type="number" min="1" value={form.lots}
                    onChange={(e) => upd("lots", e.target.value)}
                    className="w-16 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-slate-500">Position</label>
                  <NativeSelect value={form.position} options={positionOptions}
                    onChange={(v) => upd("position", v)} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-slate-500">Option Type</label>
                  <NativeSelect value={form.optionType} options={optionTypeOptions}
                    onChange={(v) => upd("optionType", v)} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-normal text-slate-500">Expiry</label>
                  <NativeSelect value={form.expiry} options={expiryOptions}
                    onChange={(v) => upd("expiry", v)} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1">
                    <label className="text-xs font-normal text-slate-500">Select Strike Criteria</label>
                    <InfoIcon />
                  </div>
                  <NativeSelect value={form.strikeCriteria} options={strikeCriteriaOptions}
                    onChange={(v) => upd("strikeCriteria", v)} className="min-w-[160px]" />
                </div>

                <BuilderStrikeParam
                  strikeCriteria={form.strikeCriteria}
                  strikeValue={form.strikeValue}
                  rangeLower={form.rangeLower}
                  rangeUpper={form.rangeUpper}
                  straddleMultiplier={form.straddleMultiplier}
                  straddleAdjustment={form.straddleAdjustment}
                  straddleStrikeKind={form.straddleStrikeKind}
                  atmMultiplier={form.atmMultiplier}
                  atmStrikeKind={form.atmStrikeKind}
                  onChange={(key, val) =>
                    upd(key as keyof LazyLegForm, val as LazyLegForm[keyof LazyLegForm])
                  }
                />
              </div>
            </div>

            {/* Row 2 — Target Profit | Stop Loss | Trail SL */}
            <div className="mt-5 flex flex-wrap items-start gap-8">
              {/* Target Profit */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-normal text-slate-600">Target Profit</label>
                  <ToggleSwitch enabled={form.targetProfitEnabled}
                    onToggle={() => tog("targetProfitEnabled")} />
                </div>
                <div className="flex items-center gap-1.5">
                  <LegSelect value={form.targetProfitType} options={legTgtSLTypeOptions}
                    onChange={(v) => upd("targetProfitType", v)}
                    enabled={form.targetProfitEnabled} className="min-w-[130px]" />
                  {modalInput(form.targetProfitValue, "targetProfitValue", form.targetProfitEnabled)}
                </div>
              </div>

              {/* Stop Loss */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-normal text-slate-600">Stop Loss</label>
                  <ToggleSwitch enabled={form.stopLossEnabled}
                    onToggle={() => tog("stopLossEnabled")} />
                </div>
                <div className="flex items-center gap-1.5">
                  <LegSelect value={form.stopLossType} options={legTgtSLTypeOptions}
                    onChange={(v) => upd("stopLossType", v)}
                    enabled={form.stopLossEnabled} className="min-w-[130px]" />
                  {modalInput(form.stopLossValue, "stopLossValue", form.stopLossEnabled)}
                </div>
              </div>

              {/* Trail SL */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-normal text-slate-600">Trail SL</label>
                  <InfoIcon />
                  <ToggleSwitch enabled={form.trailSLEnabled}
                    onToggle={() => tog("trailSLEnabled")} />
                </div>
                <div className="flex items-center gap-1.5">
                  <LegSelect value={form.trailSLType} options={trailSLTypeOptions}
                    onChange={(v) => upd("trailSLType", v)}
                    enabled={form.trailSLEnabled} className="min-w-[100px]" />
                  {modalInput(form.trailSLInput1, "trailSLInput1", form.trailSLEnabled)}
                  {modalInput(form.trailSLInput2, "trailSLInput2", form.trailSLEnabled)}
                </div>
              </div>
            </div>

            {/* Row 3 — Re-entry on Tgt | Re-entry on SL | Simple Momentum */}
            <div className="mt-5 flex flex-wrap items-start gap-8">
              {/* Re-entry on Tgt */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-normal text-slate-600">Re-entry on Tgt</label>
                  <InfoIcon />
                  <ToggleSwitch enabled={form.reentryTgtEnabled}
                    onToggle={() => tog("reentryTgtEnabled")} />
                </div>
                <div className="flex items-center gap-1.5">
                  <LegSelect value={form.reentryTgtAction} options={legReentryActionOptions}
                    onChange={(v) => handleReentryChange("tgt", v)}
                    enabled={form.reentryTgtEnabled} className="min-w-[120px]" />
                  {form.reentryTgtAction === "ReentryType.NextLeg" ? (
                    <LazyLegReentryPicker
                      selectedName={form.reentryTgtLazyLegName}
                      lazyLegs={lazyLegs}
                      enabled={form.reentryTgtEnabled}
                      onSelect={(name) => upd("reentryTgtLazyLegName", name)}
                      onCreateNew={() => setNestedFor("tgt")}
                    />
                  ) : (
                    <LegCountSelect value={form.reentryTgtCount}
                      onChange={(v) => upd("reentryTgtCount", v)} enabled={form.reentryTgtEnabled} />
                  )}
                </div>
              </div>

              {/* Re-entry on SL */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-normal text-slate-600">Re-entry on SL</label>
                  <InfoIcon />
                  <ToggleSwitch enabled={form.reentrySLEnabled}
                    onToggle={() => tog("reentrySLEnabled")} />
                </div>
                <div className="flex items-center gap-1.5">
                  <LegSelect value={form.reentrySLAction} options={legReentryActionOptions}
                    onChange={(v) => handleReentryChange("sl", v)}
                    enabled={form.reentrySLEnabled} className="min-w-[120px]" />
                  {form.reentrySLAction === "ReentryType.NextLeg" ? (
                    <LazyLegReentryPicker
                      selectedName={form.reentrySLLazyLegName}
                      lazyLegs={lazyLegs}
                      enabled={form.reentrySLEnabled}
                      onSelect={(name) => upd("reentrySLLazyLegName", name)}
                      onCreateNew={() => setNestedFor("sl")}
                    />
                  ) : (
                    <LegCountSelect value={form.reentrySLCount}
                      onChange={(v) => upd("reentrySLCount", v)} enabled={form.reentrySLEnabled} />
                  )}
                </div>
              </div>

              {/* Simple Momentum */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-normal text-slate-600">Simple Momentum</label>
                  <InfoIcon />
                  <ToggleSwitch enabled={form.simpleMomentumEnabled}
                    onToggle={() => tog("simpleMomentumEnabled")} />
                </div>
                <div className="flex items-center gap-1.5">
                  <LegSelect value={form.simpleMomentumType} options={simpleMomentumTypeOptions}
                    onChange={(v) => upd("simpleMomentumType", v)}
                    enabled={form.simpleMomentumEnabled} className="min-w-[150px]" />
                  {modalInput(form.simpleMomentumValue, "simpleMomentumValue", form.simpleMomentumEnabled)}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-7 py-4 dark:border-gray-700">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm(form)} disabled={nameError || !form.legName.trim()}>Create and Select</Button>
        </div>

      </div>
    </Modal>

    {nestedFor && (
      <LazyLegModal
        onClose={() => setNestedFor(null)}
        onConfirm={handleNestedConfirm}
        existingNames={[...existingNames, form.legName, ...lazyLegs.map((l) => l.legName)]}
        lazyLegs={lazyLegs}
        onAddLazyLeg={onAddLazyLeg}
      />
    )}
    </>
  );
}

// ─── Per-leg card ────────────────────────────────────────────────────────────

// Blue select when enabled, grey+opacity when disabled
// Small count select (plain style)
function LegCountSelect({
  value,
  onChange,
  enabled,
}: {
  value: string;
  onChange: (v: string) => void;
  enabled: boolean;
}) {
  return (
    <div className="relative w-max">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!enabled}
        className={`cursor-pointer appearance-none rounded border border-slate-300 bg-white py-1.5 pl-2 pr-6 text-sm text-slate-700 focus:outline-none ${
          enabled ? "opacity-100" : "opacity-40"
        }`}
      >
        {reentryCountOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        className="pointer-events-none absolute right-1 top-2.5 h-3 w-3 text-slate-500"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

// ─── Lazy Leg display card ────────────────────────────────────────────────────

function LazyLegCard({
  form,
  onRemove,
  onCopy,
  lazyLegs = [],
  onAddLazyLeg,
}: {
  form: LazyLegForm;
  onRemove: () => void;
  onCopy: () => void;
  lazyLegs?: LazyLegForm[];
  onAddLazyLeg?: (f: LazyLegForm) => void;
}) {
  const [data, setData] = useState<LazyLegForm>(form);
  const upd = <K extends keyof LazyLegForm>(key: K, val: LazyLegForm[K]) =>
    setData((prev) => ({ ...prev, [key]: val }));
  const tog = (key: keyof LazyLegForm) =>
    setData((prev) => ({ ...prev, [key]: !prev[key] }));

  const [cardLazyModal, setCardLazyModal] = useState<"tgt" | "sl" | null>(null);

  const handleCardReentryChange = (which: "tgt" | "sl", value: string) => {
    upd(which === "tgt" ? "reentryTgtAction" : "reentrySLAction", value);
    if (value !== "ReentryType.NextLeg") {
      upd(which === "tgt" ? "reentryTgtLazyLegName" : "reentrySLLazyLegName", "");
    } else if (lazyLegs.length === 0) {
      setCardLazyModal(which);
    }
  };

  const handleCardLazyConfirm = (newForm: LazyLegForm) => {
    onAddLazyLeg?.(newForm);
    upd(cardLazyModal === "tgt" ? "reentryTgtLazyLegName" : "reentrySLLazyLegName", newForm.legName);
    setCardLazyModal(null);
  };

  const disabledInput = (val: string, key: keyof LazyLegForm, enabled: boolean) => (
    <input
      type="number"
      value={val}
      onChange={(e) => upd(key, e.target.value as LazyLegForm[typeof key])}
      disabled={!enabled}
      className={`w-16 rounded border px-2 py-1.5 text-sm focus:outline-none ${
        enabled ? "border-slate-300 text-slate-700" : "border-slate-200 text-slate-400 opacity-40"
      }`}
    />
  );

  return (
    <div className="relative rounded-md border border-slate-200 bg-white p-5 md:p-6">
      {/* Name badge */}
      <div className="absolute left-0 top-0">
        <div className="rounded rounded-bl-none rounded-tr-none bg-slate-300 px-2 py-0.5">
          <span className="text-xs font-semibold text-slate-700">{data.legName}</span>
        </div>
      </div>

      {/* Remove button */}
      <div className="absolute -right-3 -top-3 flex flex-col items-center gap-1">
        <button type="button" onClick={onRemove}
          className="rounded-full border-2 border-white bg-red-500 p-1 shadow">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth="1.5" stroke="currentColor" className="h-3.5 w-3.5 text-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <button type="button" onClick={onCopy} className="rounded-full border-2 border-white bg-slate-500 p-1 shadow">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth="1.5" stroke="currentColor" className="h-3.5 w-3.5 text-white">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
          </svg>
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-6">
        {/* Row 1 */}
        <div className="flex flex-wrap items-end justify-center gap-6">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Lots</FieldLabel>
            <input type="number" min="1" value={data.lots}
              onChange={(e) => upd("lots", e.target.value)}
              className="w-16 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Position</FieldLabel>
            <NativeSelect value={data.position} options={positionOptions}
              onChange={(v) => upd("position", v)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Option Type</FieldLabel>
            <NativeSelect value={data.optionType} options={optionTypeOptions}
              onChange={(v) => upd("optionType", v)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Expiry</FieldLabel>
            <NativeSelect value={data.expiry} options={expiryOptions}
              onChange={(v) => upd("expiry", v)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <FieldLabel>Select Strike Criteria</FieldLabel>
              <InfoIcon />
            </div>
            <NativeSelect value={data.strikeCriteria} options={strikeCriteriaOptions}
              onChange={(v) => upd("strikeCriteria", v)} className="min-w-[160px]" />
          </div>
          <BuilderStrikeParam
            strikeCriteria={data.strikeCriteria}
            strikeValue={data.strikeValue}
            rangeLower={data.rangeLower}
            rangeUpper={data.rangeUpper}
            straddleMultiplier={data.straddleMultiplier}
            straddleAdjustment={data.straddleAdjustment}
            straddleStrikeKind={data.straddleStrikeKind}
            atmMultiplier={data.atmMultiplier}
            atmStrikeKind={data.atmStrikeKind}
            onChange={(key, val) => upd(key as keyof LazyLegForm, val as LazyLegForm[keyof LazyLegForm])}
          />
        </div>

        {/* Row 2: Target Profit | Stop Loss | Trail SL | Re-entry on Tgt | Re-entry on SL | Simple Momentum */}
        <div className="flex flex-wrap items-start justify-center gap-6">
          {/* Target Profit */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Target Profit</FieldLabel>
              <ToggleSwitch enabled={data.targetProfitEnabled} onToggle={() => tog("targetProfitEnabled")} />
            </div>
            <div className="flex items-center gap-1.5">
              <LegSelect value={data.targetProfitType} options={legTgtSLTypeOptions}
                onChange={(v) => upd("targetProfitType", v)} enabled={data.targetProfitEnabled} className="min-w-[130px]" />
              {disabledInput(data.targetProfitValue, "targetProfitValue", data.targetProfitEnabled)}
            </div>
          </div>

          {/* Stop Loss */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Stop Loss</FieldLabel>
              <ToggleSwitch enabled={data.stopLossEnabled} onToggle={() => tog("stopLossEnabled")} />
            </div>
            <div className="flex items-center gap-1.5">
              <LegSelect value={data.stopLossType} options={legTgtSLTypeOptions}
                onChange={(v) => upd("stopLossType", v)} enabled={data.stopLossEnabled} className="min-w-[130px]" />
              {disabledInput(data.stopLossValue, "stopLossValue", data.stopLossEnabled)}
            </div>
          </div>

          {/* Trail SL */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Trail SL</FieldLabel>
              <InfoIcon />
              <ToggleSwitch enabled={data.trailSLEnabled} onToggle={() => tog("trailSLEnabled")} />
            </div>
            <div className="flex items-center gap-1.5">
              <LegSelect value={data.trailSLType} options={trailSLTypeOptions}
                onChange={(v) => upd("trailSLType", v)} enabled={data.trailSLEnabled} className="min-w-[100px]" />
              {disabledInput(data.trailSLInput1, "trailSLInput1", data.trailSLEnabled)}
              {disabledInput(data.trailSLInput2, "trailSLInput2", data.trailSLEnabled)}
            </div>
          </div>

          {/* Re-entry on Tgt */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Re-entry on Tgt</FieldLabel>
              <InfoIcon />
              <ToggleSwitch enabled={data.reentryTgtEnabled} onToggle={() => tog("reentryTgtEnabled")} />
            </div>
            <div className="flex items-center gap-1.5">
              <LegSelect value={data.reentryTgtAction} options={legReentryActionOptions}
                onChange={(v) => handleCardReentryChange("tgt", v)} enabled={data.reentryTgtEnabled} className="min-w-[110px]" />
              {data.reentryTgtAction === "ReentryType.NextLeg" ? (
                <LazyLegReentryPicker
                  selectedName={data.reentryTgtLazyLegName}
                  lazyLegs={lazyLegs}
                  enabled={data.reentryTgtEnabled}
                  onSelect={(name) => upd("reentryTgtLazyLegName", name)}
                  onCreateNew={() => setCardLazyModal("tgt")}
                />
              ) : (
                <LegCountSelect value={data.reentryTgtCount}
                  onChange={(v) => upd("reentryTgtCount", v)} enabled={data.reentryTgtEnabled} />
              )}
            </div>
          </div>

          {/* Re-entry on SL */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Re-entry on SL</FieldLabel>
              <InfoIcon />
              <ToggleSwitch enabled={data.reentrySLEnabled} onToggle={() => tog("reentrySLEnabled")} />
            </div>
            <div className="flex items-center gap-1.5">
              <LegSelect value={data.reentrySLAction} options={legReentryActionOptions}
                onChange={(v) => handleCardReentryChange("sl", v)} enabled={data.reentrySLEnabled} className="min-w-[110px]" />
              {data.reentrySLAction === "ReentryType.NextLeg" ? (
                <LazyLegReentryPicker
                  selectedName={data.reentrySLLazyLegName}
                  lazyLegs={lazyLegs}
                  enabled={data.reentrySLEnabled}
                  onSelect={(name) => upd("reentrySLLazyLegName", name)}
                  onCreateNew={() => setCardLazyModal("sl")}
                />
              ) : (
                <LegCountSelect value={data.reentrySLCount}
                  onChange={(v) => upd("reentrySLCount", v)} enabled={data.reentrySLEnabled} />
              )}
            </div>
          </div>

          {/* Simple Momentum */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Simple Momentum</FieldLabel>
              <InfoIcon />
              <ToggleSwitch enabled={data.simpleMomentumEnabled} onToggle={() => tog("simpleMomentumEnabled")} />
            </div>
            <div className="flex items-center gap-1.5">
              <LegSelect value={data.simpleMomentumType} options={simpleMomentumTypeOptions}
                onChange={(v) => upd("simpleMomentumType", v)} enabled={data.simpleMomentumEnabled} className="min-w-[150px]" />
              {disabledInput(data.simpleMomentumValue, "simpleMomentumValue", data.simpleMomentumEnabled)}
            </div>
          </div>
        </div>
      </div>

      {cardLazyModal && (
        <LazyLegModal
          onClose={() => setCardLazyModal(null)}
          onConfirm={handleCardLazyConfirm}
          existingNames={lazyLegs.map((l) => l.legName)}
          lazyLegs={lazyLegs}
          onAddLazyLeg={onAddLazyLeg}
        />
      )}
    </div>
  );
}

function LegCard({
  leg,
  index,
  onUpdate,
  onRemove,
  onCopy,
  onAddLazyLeg,
  lazyLegs,
}: {
  leg: LegState;
  index: number;
  onUpdate: (id: number, key: keyof LegState, val: string | boolean) => void;
  onRemove: (id: number) => void;
  onCopy: (id: number) => void;
  onAddLazyLeg: (form: LazyLegForm) => void;
  lazyLegs: LazyLegForm[];
}) {
  const set = (key: keyof LegState, val: string | boolean) =>
    onUpdate(leg.id, key, val);
  const toggle = (key: keyof LegState) => set(key, !(leg[key] as boolean));

  const [lazyLegModal, setLazyLegModal] = useState<"tgt" | "sl" | null>(null);
  const [rangeBreakoutModalOpen, setRangeBreakoutModalOpen] = useState(false);

  const handleReentryChange = (which: "tgt" | "sl", value: string) => {
    set(which === "tgt" ? "reentryTgtAction" : "reentrySLAction", value);
    if (value !== "ReentryType.NextLeg") {
      set(which === "tgt" ? "reentryTgtLazyLegName" : "reentrySLLazyLegName", "");
    } else if (lazyLegs.length === 0) {
      setLazyLegModal(which);
    }
  };

  const handleLazyConfirm = (form: LazyLegForm) => {
    if (lazyLegModal) {
      set(lazyLegModal === "tgt" ? "reentryTgtAction" : "reentrySLAction", "ReentryType.NextLeg");
      set(lazyLegModal === "tgt" ? "reentryTgtLazyLegName" : "reentrySLLazyLegName", form.legName);
    }
    onAddLazyLeg(form);
    setLazyLegModal(null);
  };

  const disabledInput = (val: string, key: keyof LegState, enabled: boolean) => (
    <input
      type="number"
      value={val}
      onChange={(e) => set(key, e.target.value)}
      disabled={!enabled}
      className={`w-16 rounded border px-2 py-1.5 text-sm focus:outline-none ${
        enabled ? "border-slate-300 text-slate-700" : "border-slate-200 text-slate-400 opacity-40"
      }`}
    />
  );

  const handleRangeBreakoutToggle = () => {
    if (leg.rangeBreakoutEnabled) {
      set("rangeBreakoutEnabled", false);
      return;
    }
    setRangeBreakoutModalOpen(true);
  };

  return (
    <div className="relative rounded-md border border-slate-200 bg-white p-5 md:p-6">
      {/* #N badge */}
      <div className="absolute left-0 top-0">
        <div className="rounded rounded-bl-none rounded-tr-none bg-slate-300 px-2 py-0.5">
          <span className="text-xs font-semibold text-slate-700">#{index + 1}</span>
        </div>
      </div>

      {/* X + copy buttons */}
      <div className="absolute -right-3 -top-3 flex flex-col items-center gap-1">
        <button type="button" onClick={() => onRemove(leg.id)}
          className="rounded-full border-2 border-white bg-red-500 p-1 shadow">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth="1.5" stroke="currentColor" className="h-3.5 w-3.5 text-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <button type="button" onClick={() => onCopy(leg.id)}
          className="rounded-full border-2 border-white bg-slate-500 p-1 shadow">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth="1.5" stroke="currentColor" className="h-3.5 w-3.5 text-white">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
          </svg>
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-6">

        {/* ── Row 1: centered, all fields in one line ── */}
        <div className="flex flex-wrap items-end justify-center gap-6">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Lots</FieldLabel>
            <input type="number" min="1" value={leg.lots}
              onChange={(e) => set("lots", e.target.value)}
              className="w-16 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none" />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel>Position</FieldLabel>
            <NativeSelect value={leg.position} options={positionOptions}
              onChange={(v) => set("position", v)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel>Option Type</FieldLabel>
            <NativeSelect value={leg.optionType} options={optionTypeOptions}
              onChange={(v) => set("optionType", v)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel>Expiry</FieldLabel>
            <NativeSelect value={leg.expiry} options={expiryOptions}
              onChange={(v) => set("expiry", v)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <FieldLabel>Select Strike Criteria</FieldLabel>
              <InfoIcon />
            </div>
            <NativeSelect value={leg.strikeCriteria} options={strikeCriteriaOptions}
              onChange={(v) => set("strikeCriteria", v)} className="min-w-[160px]" />
          </div>

          <BuilderStrikeParam
            strikeCriteria={leg.strikeCriteria}
            strikeValue={leg.strikeValue}
            rangeLower={leg.rangeLower}
            rangeUpper={leg.rangeUpper}
            straddleMultiplier={leg.straddleMultiplier}
            straddleAdjustment={leg.straddleAdjustment}
            straddleStrikeKind={leg.straddleStrikeKind}
            atmMultiplier={leg.atmMultiplier}
            atmStrikeKind={leg.atmStrikeKind}
            onChange={(key, val) => set(key as keyof LegState, val)}
          />
        </div>

        {/* ── Row 2: Target Profit | Stop Loss | Trail SL — centered ── */}
        <div className="flex flex-wrap items-start justify-center gap-8">
          {/* Target Profit */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Target Profit</FieldLabel>
              <ToggleSwitch enabled={leg.targetProfitEnabled}
                onToggle={() => toggle("targetProfitEnabled")} />
            </div>
            <div className="flex items-center gap-1.5">
              <LegSelect value={leg.targetProfitType} options={legTgtSLTypeOptions}
                onChange={(v) => set("targetProfitType", v)}
                enabled={leg.targetProfitEnabled} className="min-w-[130px]" />
              {disabledInput(leg.targetProfitValue, "targetProfitValue", leg.targetProfitEnabled)}
            </div>
          </div>

          {/* Stop Loss */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Stop Loss</FieldLabel>
              <ToggleSwitch enabled={leg.stopLossEnabled}
                onToggle={() => toggle("stopLossEnabled")} />
            </div>
            <div className="flex items-center gap-1.5">
              <LegSelect value={leg.stopLossType} options={legTgtSLTypeOptions}
                onChange={(v) => set("stopLossType", v)}
                enabled={leg.stopLossEnabled} className="min-w-[130px]" />
              {disabledInput(leg.stopLossValue, "stopLossValue", leg.stopLossEnabled)}
            </div>
          </div>

          {/* Trail SL */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Trail SL</FieldLabel>
              <InfoIcon />
              <ToggleSwitch enabled={leg.trailSLEnabled}
                onToggle={() => toggle("trailSLEnabled")} />
            </div>
            <div className="flex items-center gap-1.5">
              <LegSelect value={leg.trailSLType} options={trailSLTypeOptions}
                onChange={(v) => set("trailSLType", v)}
                enabled={leg.trailSLEnabled} className="min-w-[100px]" />
              {disabledInput(leg.trailSLInput1, "trailSLInput1", leg.trailSLEnabled)}
              {disabledInput(leg.trailSLInput2, "trailSLInput2", leg.trailSLEnabled)}
            </div>
          </div>
        </div>

        {/* ── Row 3: Re-entry on Tgt | Re-entry on SL | Simple Momentum | Range Breakout — centered ── */}
        <div className="flex flex-wrap items-start justify-center gap-8">
          {/* Re-entry on Tgt */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Re-entry on Tgt</FieldLabel>
              <InfoIcon />
              <ToggleSwitch enabled={leg.reentryTgtEnabled}
                onToggle={() => toggle("reentryTgtEnabled")} />
            </div>
            <div className="flex items-center gap-1.5">
              <LegSelect value={leg.reentryTgtAction} options={legReentryActionOptions}
                onChange={(v) => handleReentryChange("tgt", v)}
                enabled={leg.reentryTgtEnabled} className="min-w-[110px]" />
              {leg.reentryTgtAction === "ReentryType.NextLeg" ? (
                <LazyLegReentryPicker
                  selectedName={leg.reentryTgtLazyLegName}
                  lazyLegs={lazyLegs}
                  enabled={leg.reentryTgtEnabled}
                  onSelect={(name) => set("reentryTgtLazyLegName", name)}
                  onCreateNew={() => setLazyLegModal("tgt")}
                />
              ) : (
                <LegCountSelect value={leg.reentryTgtCount}
                  onChange={(v) => set("reentryTgtCount", v)} enabled={leg.reentryTgtEnabled} />
              )}
            </div>
          </div>

          {/* Re-entry on SL */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Re-entry on SL</FieldLabel>
              <InfoIcon />
              <ToggleSwitch enabled={leg.reentrySLEnabled}
                onToggle={() => toggle("reentrySLEnabled")} />
            </div>
            <div className="flex items-center gap-1.5">
              <LegSelect value={leg.reentrySLAction} options={legReentryActionOptions}
                onChange={(v) => handleReentryChange("sl", v)}
                enabled={leg.reentrySLEnabled} className="min-w-[110px]" />
              {leg.reentrySLAction === "ReentryType.NextLeg" ? (
                <LazyLegReentryPicker
                  selectedName={leg.reentrySLLazyLegName}
                  lazyLegs={lazyLegs}
                  enabled={leg.reentrySLEnabled}
                  onSelect={(name) => set("reentrySLLazyLegName", name)}
                  onCreateNew={() => setLazyLegModal("sl")}
                />
              ) : (
                <LegCountSelect value={leg.reentrySLCount}
                  onChange={(v) => set("reentrySLCount", v)} enabled={leg.reentrySLEnabled} />
              )}
            </div>
          </div>

          {/* Simple Momentum */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Simple Momentum</FieldLabel>
              <InfoIcon />
              <ToggleSwitch enabled={leg.simpleMomentumEnabled}
                onToggle={() => toggle("simpleMomentumEnabled")} />
            </div>
            <div className="flex items-center gap-1.5">
              <LegSelect value={leg.simpleMomentumType} options={simpleMomentumTypeOptions}
                onChange={(v) => set("simpleMomentumType", v)}
                enabled={leg.simpleMomentumEnabled} className="min-w-[150px]" />
              {disabledInput(leg.simpleMomentumValue, "simpleMomentumValue", leg.simpleMomentumEnabled)}
            </div>
          </div>

          {/* Range Breakout */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>Range Breakout</FieldLabel>
              <ToggleSwitch enabled={leg.rangeBreakoutEnabled}
                onToggle={handleRangeBreakoutToggle} />
            </div>
            <div className={`flex items-center gap-2 ${
              leg.rangeBreakoutEnabled ? "" : "pointer-events-none opacity-40"
            }`}>
              <input type="time" value={leg.rangeBreakoutTime}
                onChange={(e) => set("rangeBreakoutTime", e.target.value)}
                className="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none" />
              <div className="inline-flex overflow-hidden rounded border border-[#465fff]/60">
                {(["High", "Low"] as const).map((opt) => (
                  <button key={opt} type="button"
                    onClick={() => set("rangeBreakoutHighLow", opt)}
                    className={`px-3 py-1.5 text-sm font-medium transition ${
                      leg.rangeBreakoutHighLow === opt
                        ? "bg-[#1284d0]/15 text-[#465fff]"
                        : "text-slate-500 hover:bg-slate-50"
                    }`}>
                    {opt}
                  </button>
                ))}
              </div>
              <NativeSelect value={leg.rangeBreakoutTracking}
                options={rangeBreakoutTrackingOptions}
                onChange={(v) => set("rangeBreakoutTracking", v)} />
            </div>
          </div>
        </div>

      </div>

      {lazyLegModal && (
        <LazyLegModal
          onClose={() => setLazyLegModal(null)}
          onConfirm={handleLazyConfirm}
          existingNames={lazyLegs.map((l) => l.legName)}
          lazyLegs={lazyLegs}
          onAddLazyLeg={onAddLazyLeg}
        />
      )}

      {rangeBreakoutModalOpen && (
        <RangeBreakoutModal
          initialEndTime={leg.rangeBreakoutTime || "09:45"}
          initialEntryOn={(leg.rangeBreakoutHighLow as "High" | "Low") || "High"}
          initialTracking={leg.rangeBreakoutTracking || "false"}
          onClose={() => {
            setRangeBreakoutModalOpen(false);
            set("rangeBreakoutEnabled", false);
          }}
          onConfirm={({ endTime, entryOn, tracking }) => {
            set("rangeBreakoutTime", endTime);
            set("rangeBreakoutHighLow", entryOn);
            set("rangeBreakoutTracking", tracking);
            set("rangeBreakoutEnabled", true);
            setRangeBreakoutModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function RangeBreakoutModal({
  initialEndTime,
  initialEntryOn,
  initialTracking,
  onClose,
  onConfirm,
}: {
  initialEndTime: string;
  initialEntryOn: "High" | "Low";
  initialTracking: string;
  onClose: () => void;
  onConfirm: (config: {
    endTime: string;
    entryOn: "High" | "Low";
    tracking: string;
  }) => void;
}) {
  const [endTime, setEndTime] = useState(initialEndTime || "09:45");
  const [entryOn, setEntryOn] = useState<"High" | "Low">(initialEntryOn || "High");
  const [tracking, setTracking] = useState(initialTracking || "false");
  const trackingLabel =
    rangeBreakoutModalTrackingOptions.find((opt) => opt.value === tracking)?.label || "Strike Price";
  const trackingUntil = subtractOneSecond(endTime);

  return (
    <Modal isOpen onClose={onClose} className="max-w-[640px] m-4 p-0" showCloseButton={false}>
      <div className="rounded-2xl bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <h2 className="text-[30px] leading-none text-slate-900">Range Breakout</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 transition hover:text-slate-700"
            aria-label="Close range breakout modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-8 px-6 py-5">
          <div className="flex flex-wrap gap-4 md:gap-8">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-normal text-slate-500">Start Time</label>
              <input
                type="text"
                value="09:35"
                disabled
                className="w-[104px] rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-normal text-slate-700">End Time</label>
              <div className="relative">
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-[104px] rounded-md border border-slate-300 px-3 py-2 pr-9 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#465fff]/60"
                />
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-500">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 6v6l4 2" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 md:gap-10">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-normal text-slate-700">Entry on</label>
              <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
                {(["High", "Low"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setEntryOn(opt)}
                    className={`min-w-[56px] px-4 py-2 text-sm transition ${
                      entryOn === opt
                        ? "bg-[#1284d0]/15 text-[#1284d0]"
                        : "bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-normal text-slate-700">Tracking</label>
              <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
                {rangeBreakoutModalTrackingOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTracking(opt.value)}
                    className={`min-w-[96px] px-4 py-2 text-sm transition ${
                      tracking === opt.value
                        ? "bg-[#1284d0]/15 text-[#1284d0]"
                        : "bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="max-w-[560px] text-[15px] leading-8 text-slate-800">
            We will start by tracking the <span className="font-semibold">Selected {trackingLabel}</span> between{" "}
            <span className="font-semibold">09:35:00</span> and <span className="font-semibold">{trackingUntil}</span>.
            We will take entry after <span className="font-semibold">{trackingUntil}</span> once the{" "}
            <span className="font-semibold">{entryOn}</span> price of the{" "}
            <span className="font-semibold">Selected Strike</span> in the range is breached.
          </p>
        </div>

        <div className="flex items-center justify-end gap-4 px-6 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm text-slate-600 transition hover:text-slate-900"
          >
            Cancel
          </button>
          <Button
            onClick={() => onConfirm({ endTime, entryOn, tracking })}
            className="rounded-md bg-[#0f4c81] px-6 py-2.5 text-sm hover:bg-[#0b3f6b]"
          >
            Confirm
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function BacktestStrategy() {
  type TabItem = {
    title: string;
    subtitle: string;
    active?: boolean;
    badge?: ReactNode;
  };

  const topTabs: TabItem[] = [
    { title: "Weekly & Monthly Expiries", subtitle: "NIFTY | SENSEX", active: true },
    {
      title: "Monthly Only Expiry",
      subtitle: "MIDCPNIFTY | BANKNIFTY | FINNIFTY | BANKEX",
    },
    { title: "Stocks - Cash / F&O", subtitle: "ALL NIFTY 500 STOCKS" },
    {
      title: "Delta Exchange",
      subtitle: "BTCUSD | ETHUSD",
      badge: (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-center">
          <p className="text-xs font-semibold text-emerald-500">New</p>
          <p className="mt-1 text-xs text-slate-500">Algo Trading</p>
        </div>
      ),
    },
  ];

  // ── Instrument settings ──
  const [selectedIndex, setSelectedIndex] = useState("NIFTY");
  const [underlyingFrom, setUnderlyingFrom] = useState<"Cash" | "Futures">("Cash");

  // ── Entry settings ──
  const [strategyType, setStrategyType] = useState<"Intraday" | "BTST" | "Positional">(
    "Intraday"
  );
  const [entryTime, setEntryTime] = useState("09:16");
  const [exitTime, setExitTime] = useState("15:15");
  const [noReentryAfterEnabled, setNoReentryAfterEnabled] = useState(false);
  const [noReentryAfterTime, setNoReentryAfterTime] = useState("");
  const [overallMomentumEnabled, setOverallMomentumEnabled] = useState(false);
  const [overallMomentumType, setOverallMomentumType] = useState(
    "OverallMomentumType.PointsUp"
  );
  const [overallMomentumValue, setOverallMomentumValue] = useState("");

  // ── Legwise settings ──
  const [squareOff, setSquareOff] = useState<"Partial" | "Complete">("Partial");
  const [trailSLBreakeven, setTrailSLBreakeven] = useState(false);
  const [trailSLBreakevenScope, setTrailSLBreakevenScope] = useState<
    "All Legs" | "SL Legs"
  >("All Legs");

  // ── Leg builder form ──
  const [builderSegment, setBuilderSegment] = useState<"Futures" | "Options">("Options");
  const [builderTotalLot, setBuilderTotalLot] = useState("1");
  const [builderPosition, setBuilderPosition] = useState<"Buy" | "Sell">("Sell");
  const [builderOptionType, setBuilderOptionType] = useState<"Call" | "Put">("Call");
  const [builderExpiry, setBuilderExpiry] = useState("ExpiryType.Weekly");
  const [builderStrikeCriteria, setBuilderStrikeCriteria] = useState(
    "EntryType.EntryByStrikeType"
  );
  const [builderStrikeValue, setBuilderStrikeValue] = useState("StrikeType.ATM");
  const [builderRangeLower, setBuilderRangeLower] = useState("50");
  const [builderRangeUpper, setBuilderRangeUpper] = useState("200");
  const [builderStraddleMultiplier, setBuilderStraddleMultiplier] = useState("0.4");
  const [builderStraddleAdjustment, setBuilderStraddleAdjustment] = useState(
    "AdjustmentType.Plus"
  );
  const [builderStraddleStrikeKind, setBuilderStraddleStrikeKind] =
    useState("StrikeType.ATM");
  const [builderAtmMultiplier, setBuilderAtmMultiplier] = useState("0.66");
  const [builderAtmStrikeKind, setBuilderAtmStrikeKind] = useState("StrikeType.ATM");

  // ── Leg instances ──
  const [legs, setLegs] = useState<LegState[]>([]);
  const [nextLegId, setNextLegId] = useState(1);

  const addLeg = () => {
    setLegs((prev) => [...prev, createDefaultLeg(nextLegId)]);
    setNextLegId((n) => n + 1);
  };

  const updateLeg = (id: number, key: keyof LegState, val: string | boolean) => {
    setLegs((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [key]: val } : l))
    );
  };

  const removeLeg = (id: number) => {
    setLegs((prev) => prev.filter((l) => l.id !== id));
  };

  const copyLeg = (id: number) => {
    const src = legs.find((l) => l.id === id);
    if (!src) return;
    setLegs((prev) => [...prev, { ...src, id: nextLegId }]);
    setNextLegId((n) => n + 1);
  };

  // ── Lazy Leg instances ──
  const [lazyLegs, setLazyLegs] = useState<LazyLegForm[]>([]);

  const addLazyLeg = (form: LazyLegForm) => {
    setLazyLegs((prev) =>
      prev.some((l) => l.legName === form.legName) ? prev : [...prev, form]
    );
  };

  const removeLazyLeg = (index: number) => {
    setLazyLegs((prev) => prev.filter((_, i) => i !== index));
  };

  const copyLazyLeg = (form: LazyLegForm) => {
    setLazyLegs((prev) => {
      const newName = uniqueLazyName(prev.map((l) => l.legName));
      return [...prev, { ...form, legName: newName }];
    });
  };

  // ── Overall strategy settings ──
  const [overallSLEnabled, setOverallSLEnabled] = useState(false);
  const [overallSLType, setOverallSLType] = useState("OverallTgtSLType.MTM");
  const [overallSLValue, setOverallSLValue] = useState("");
  const [overallSLReentryEnabled, setOverallSLReentryEnabled] = useState(false);
  const [overallSLReentryAction, setOverallSLReentryAction] =
    useState("ReentryType.Immediate");
  const [overallSLReentryCount, setOverallSLReentryCount] = useState("1");

  const [overallTgtEnabled, setOverallTgtEnabled] = useState(false);
  const [overallTgtType, setOverallTgtType] = useState("OverallTgtSLType.MTM");
  const [overallTgtValue, setOverallTgtValue] = useState("");
  const [overallTgtReentryEnabled, setOverallTgtReentryEnabled] = useState(false);
  const [overallTgtReentryAction, setOverallTgtReentryAction] =
    useState("ReentryType.Immediate");
  const [overallTgtReentryCount, setOverallTgtReentryCount] = useState("1");

  const [trailingEnabled, setTrailingEnabled] = useState(false);
  const [trailingType, setTrailingType] = useState("TrailingOption.Lock");
  const [trailingProfitReaches, setTrailingProfitReaches] = useState("0");
  const [trailingLockProfit, setTrailingLockProfit] = useState("1");
  const [trailingIncreaseBy, setTrailingIncreaseBy] = useState("0");
  const [trailingTrailBy, setTrailingTrailBy] = useState("0");

  // ── Backtest dates ──
  const [startDate, setStartDate] = useState("2025-10-01");
  const [endDate, setEndDate] = useState("2025-10-30");

  const builderStraddleOnChange = (key: string, val: string) => {
    if (key === "strikeValue") setBuilderStrikeValue(val);
    if (key === "rangeLower") setBuilderRangeLower(val);
    if (key === "rangeUpper") setBuilderRangeUpper(val);
    if (key === "straddleMultiplier") setBuilderStraddleMultiplier(val);
    if (key === "straddleAdjustment") setBuilderStraddleAdjustment(val);
    if (key === "straddleStrikeKind") setBuilderStraddleStrikeKind(val);
    if (key === "atmMultiplier") setBuilderAtmMultiplier(val);
    if (key === "atmStrikeKind") setBuilderAtmStrikeKind(val);
  };

  return (
    <div>
      <PageMeta
        title="Backtest Strategy | Algo Admin"
        description="Backtest strategy builder page"
      />

      <div className="space-y-5">
        <div className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
          {/* ── Header ── */}
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-[32px] font-medium leading-none text-slate-900">
                  Backtest
                </h1>
                <ActionButton
                  label="Import .algtst"
                  icon={
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 3V15M12 15L7 10M12 15L17 10M5 19H19"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  }
                />
                <ActionButton
                  label="Export .algtst"
                  icon={
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 15V3M12 3L7 8M12 3L17 8M5 19H19"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  }
                />
                <ActionButton
                  label="PDF"
                  icon={
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 16V4M12 16L7 11M12 16L17 11M5 20H19"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  }
                />
              </div>
            </div>

            <div className="flex flex-wrap items-start gap-8 xl:gap-10">
              <StatBlock label="Credits Available" value="265" action="Add" />
              <StatBlock
                label="Weekly Backtests"
                value="21"
                action="Buy Backtests"
              />
            </div>
          </div>

          {/* ── Top tabs ── */}
          <div className="flex flex-wrap border-b border-slate-200 bg-white">
            {topTabs.map((item) => (
              <button
                key={item.title}
                type="button"
                className={`flex min-w-[220px] flex-1 items-start justify-between gap-3 border-b-2 px-4 py-3 text-left transition ${
                  item.active
                    ? "border-[#465fff] bg-[#1284d0]/10 text-[#465fff]"
                    : "border-transparent text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div>
                  <p
                    className={`text-sm ${item.active ? "font-semibold" : "font-medium"}`}
                  >
                    {item.title}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                    {item.subtitle}
                  </p>
                </div>
                {item.badge}
              </button>
            ))}
          </div>

          {/* ── Body ── */}
          <div className="space-y-5 bg-slate-50 px-4 py-5 xl:px-5 xl:py-6">
            {/* Instrument (left) + Entry (right, row-span-2) + Legwise (left below) */}
            <div className="grid grid-cols-10 gap-5">
              {/* Left column: Instrument + Legwise stacked */}
              <div className="col-span-10 flex flex-col justify-between gap-5 md:col-span-4">
                {/* Instrument settings */}
                <div className="flex flex-col gap-2">
                  <h6 className="text-base font-medium leading-7 text-slate-800">
                    Instrument settings
                  </h6>
                  <div className="flex h-full flex-col items-center justify-center gap-10 rounded-md border border-slate-200 bg-white py-6">
                    <div className="flex w-full max-w-sm flex-wrap items-center justify-between gap-5 px-6">
                      <FieldLabel>Index</FieldLabel>
                      <div className="min-w-32 flex-1">
                        <CompactSelect
                          value={selectedIndex}
                          options={indexOptions}
                          onChange={setSelectedIndex}
                          wide
                        />
                      </div>
                    </div>
                    <div className="flex w-full max-w-sm flex-wrap items-center justify-between gap-5 px-6">
                      <div className="flex items-center gap-2">
                        <FieldLabel>Underlying from</FieldLabel>
                        <InfoIcon />
                      </div>
                      <SegmentedControl
                        options={[
                          { label: "Cash", value: "Cash" },
                          { label: "Futures", value: "Futures" },
                        ]}
                        value={underlyingFrom}
                        onChange={setUnderlyingFrom}
                        compact
                      />
                    </div>
                  </div>
                </div>

                {/* Legwise settings */}
                <div className="flex flex-col gap-2">
                  <h6 className="text-base font-medium leading-7 text-slate-800">
                    Legwise settings
                  </h6>
                  <div className="flex h-full flex-col items-center justify-center gap-8 rounded-md border border-slate-200 bg-white p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-sm font-normal text-slate-600">
                        Square Off
                        <InfoIcon />
                      </label>
                      <SegmentedControl
                        options={[
                          { label: "Partial", value: "Partial" },
                          { label: "Complete", value: "Complete" },
                        ]}
                        value={squareOff}
                        onChange={setSquareOff}
                        compact
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={trailSLBreakeven}
                          onChange={(e) => setTrailSLBreakeven(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-[#465fff] focus:ring-[#465fff]"
                        />
                        Trail SL to Break-even price
                        <InfoIcon />
                      </label>
                      <div
                        className={
                          trailSLBreakeven ? "" : "pointer-events-none opacity-80"
                        }
                      >
                        <SegmentedControl
                          options={[
                            { label: "All Legs", value: "All Legs" },
                            { label: "SL Legs", value: "SL Legs" },
                          ]}
                          value={trailSLBreakevenScope}
                          onChange={setTrailSLBreakevenScope}
                          compact
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column: Entry settings spanning both rows */}
              <div className="col-span-10 md:col-span-6">
                <div className="flex h-full flex-col gap-2">
                  <h6 className="text-base font-medium leading-7 text-slate-800">
                    Entry settings
                  </h6>
                  <div className="flex h-full flex-col items-center justify-center gap-8 rounded-md border border-slate-200 bg-white p-6">
                    {/* Strategy Type */}
                    <div className="flex w-full max-w-sm items-center justify-between">
                      <FieldLabel>Strategy Type</FieldLabel>
                      <SegmentedControl
                        options={[
                          { label: "Intraday", value: "Intraday" },
                          { label: "BTST", value: "BTST" },
                          { label: "Positional", value: "Positional" },
                        ]}
                        value={strategyType}
                        onChange={setStrategyType}
                        compact
                      />
                    </div>

                    {/* Entry Time + Exit Time */}
                    <div className="flex flex-wrap items-center justify-center gap-10">
                      <div className="flex items-center gap-3">
                        <FieldLabel>Entry Time</FieldLabel>
                        <TextInput
                          value={entryTime}
                          onChange={setEntryTime}
                          type="time"
                          className="min-w-[90px]"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <FieldLabel>Exit Time</FieldLabel>
                        <TextInput
                          value={exitTime}
                          onChange={setExitTime}
                          type="time"
                          className="min-w-[90px]"
                        />
                      </div>
                    </div>

                    {/* No re-entry after + Overall Momentum */}
                    <div className="flex w-full flex-col items-center justify-center gap-8 md:flex-row">
                      {/* No re-entry after */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <FieldLabel>No re-entry after</FieldLabel>
                          <ToggleSwitch
                            enabled={noReentryAfterEnabled}
                            onToggle={() => setNoReentryAfterEnabled((v) => !v)}
                          />
                        </div>
                        <div
                          className={
                            noReentryAfterEnabled
                              ? ""
                              : "pointer-events-none opacity-40"
                          }
                        >
                          <TextInput
                            value={noReentryAfterTime}
                            onChange={setNoReentryAfterTime}
                            type="time"
                            className="min-w-[110px]"
                          />
                        </div>
                      </div>

                      <div className="hidden h-12 w-px bg-slate-200 md:block" />

                      {/* Overall Momentum */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <FieldLabel>Overall Momentum</FieldLabel>
                          <InfoIcon />
                          <ToggleSwitch
                            enabled={overallMomentumEnabled}
                            onToggle={() => setOverallMomentumEnabled((v) => !v)}
                          />
                        </div>
                        <div
                          className={`flex items-center gap-2 transition ${
                            overallMomentumEnabled
                              ? ""
                              : "pointer-events-none opacity-40"
                          }`}
                        >
                          <div className="w-[170px]">
                            <CompactSelect
                              value={overallMomentumType}
                              options={overallMomentumTypeOptions}
                              onChange={setOverallMomentumType}
                              wide
                              className="rounded-[4px] border-[#2d77c7] bg-[#1b6ca8] text-white focus:border-[#2d77c7] focus:ring-0"
                              menuClassName="rounded-none border-[#1b6ca8] bg-[#165f95] py-0 shadow-none"
                              optionClassName="border-b border-[#2d77c7]/20 bg-[#165f95] py-1.5 text-white hover:bg-[#1e73af] dark:bg-[#165f95] dark:text-white dark:hover:bg-[#1e73af]"
                              selectedOptionClassName="border-b border-[#2d77c7]/20 bg-[#2f74db] py-1.5 font-semibold text-white dark:bg-[#2f74db] dark:text-white"
                              iconClassName="text-white"
                            />
                          </div>
                          <TextInput
                            value={overallMomentumValue}
                            onChange={setOverallMomentumValue}
                            type="number"
                            className="min-w-[70px]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Leg Builder */}
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-medium text-slate-800">
                    Leg Builder
                  </h3>
                  <InfoIcon />
                </div>
                <button
                  type="button"
                  className="text-sm font-semibold text-[#465fff]"
                >
                  Collapse
                </button>
              </div>

              <div className="rounded-md border border-slate-200 bg-white px-6 py-8">
                {/* Single horizontal row — centered */}
                <div className="flex flex-wrap items-end justify-center gap-6">
                    {/* Select segments */}
                    <div className="flex flex-col gap-1.5">
                      <FieldLabel>Select segments</FieldLabel>
                      <SegmentedControl
                        options={[
                          { label: "Futures", value: "Futures" },
                          { label: "Options", value: "Options" },
                        ]}
                        value={builderSegment}
                        onChange={setBuilderSegment}
                        compact
                      />
                    </div>

                    {/* Total Lot */}
                    <div className="flex flex-col gap-1.5">
                      <FieldLabel>Total Lot</FieldLabel>
                      <input
                        type="number"
                        min="1"
                        value={builderTotalLot}
                        onChange={(e) => setBuilderTotalLot(e.target.value)}
                        className="w-16 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#465fff]/60"
                      />
                    </div>

                    {/* Position */}
                    <div className="flex flex-col gap-1.5">
                      <FieldLabel>Position</FieldLabel>
                      <SegmentedControl
                        options={[
                          { label: "Buy", value: "Buy" },
                          { label: "Sell", value: "Sell" },
                        ]}
                        value={builderPosition}
                        onChange={setBuilderPosition}
                        compact
                      />
                    </div>

                    {/* Option Type */}
                    <div className="flex flex-col gap-1.5">
                      <FieldLabel>Option Type</FieldLabel>
                      <SegmentedControl
                        options={[
                          { label: "Call", value: "Call" },
                          { label: "Put", value: "Put" },
                        ]}
                        value={builderOptionType}
                        onChange={setBuilderOptionType}
                        compact
                      />
                    </div>

                    {/* Expiry */}
                    <div className="flex flex-col gap-1.5">
                      <FieldLabel>Expiry</FieldLabel>
                      <NativeSelect
                        value={builderExpiry}
                        options={expiryOptions}
                        onChange={setBuilderExpiry}
                      />
                    </div>

                    {/* Strike Criteria */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1">
                        <FieldLabel>Strike Criteria</FieldLabel>
                        <InfoIcon />
                      </div>
                      <NativeSelect
                        value={builderStrikeCriteria}
                        options={strikeCriteriaOptions}
                        onChange={setBuilderStrikeCriteria}
                        className="min-w-[160px]"
                      />
                    </div>

                    {/* Strike Type / Parameter */}
                    <BuilderStrikeParam
                      strikeCriteria={builderStrikeCriteria}
                      strikeValue={builderStrikeValue}
                      rangeLower={builderRangeLower}
                      rangeUpper={builderRangeUpper}
                      straddleMultiplier={builderStraddleMultiplier}
                      straddleAdjustment={builderStraddleAdjustment}
                      straddleStrikeKind={builderStraddleStrikeKind}
                      atmMultiplier={builderAtmMultiplier}
                      atmStrikeKind={builderAtmStrikeKind}
                      onChange={builderStraddleOnChange}
                    />
                </div>

                {/* Add Leg button */}
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    onClick={addLeg}
                    className="rounded-md bg-[#1284d0] px-7 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0e6fad]"
                  >
                    Add Leg
                  </button>
                </div>
              </div>

              {/* Added leg cards */}
              {legs.length > 0 && (
                <div className="mt-4 flex flex-col gap-4">
                  <h6 className="text-base font-medium leading-7 text-slate-700">
                    Legs
                  </h6>
                  {legs.map((leg, idx) => (
                    <LegCard
                      key={leg.id}
                      leg={leg}
                      index={idx}
                      onUpdate={updateLeg}
                      onRemove={removeLeg}
                      onCopy={copyLeg}
                      onAddLazyLeg={addLazyLeg}
                      lazyLegs={lazyLegs}
                    />
                  ))}
                </div>
              )}

              {/* Lazy Legs section */}
              {lazyLegs.length > 0 && (
                <div className="mt-4 flex flex-col gap-4">
                  <h6 className="text-base font-medium leading-7 text-slate-700">
                    Lazy Legs
                  </h6>
                  {lazyLegs.map((form, idx) => (
                    <LazyLegCard
                      key={idx}
                      form={form}
                      onRemove={() => removeLazyLeg(idx)}
                      onCopy={() => copyLazyLeg(form)}
                      lazyLegs={lazyLegs}
                      onAddLazyLeg={addLazyLeg}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Overall strategy settings */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-[15px] font-medium text-slate-800">
                  Overall strategy settings
                </h3>
                <InfoIcon />
              </div>

              <div className="flex flex-wrap gap-4">

                {/* ── Overall Stop Loss ── */}
                <div className="rounded-md border border-slate-200 bg-white p-5 min-w-[240px]">
                  <div className="flex items-center justify-between gap-4">
                    <FieldLabel>Overall Stop Loss</FieldLabel>
                    <ToggleSwitch enabled={overallSLEnabled} onToggle={() => setOverallSLEnabled((v) => !v)} />
                  </div>
                  <div className={`mt-4 flex flex-col gap-4 ${overallSLEnabled ? "" : "pointer-events-none opacity-40"}`}>
                    <div className="flex items-center gap-2">
                      <LegSelect value={overallSLType} options={overallTgtSLTypeOptions}
                        onChange={setOverallSLType} enabled={overallSLEnabled} className="min-w-[140px]" />
                      <input type="number" value={overallSLValue}
                        onChange={(e) => setOverallSLValue(e.target.value)}
                        className="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none" />
                    </div>
                    <div className="border-t border-slate-100 pt-4">
                      <div className="flex items-center gap-2">
                        <FieldLabel>Re-entry on SL</FieldLabel>
                        <InfoIcon />
                        <ToggleSwitch enabled={overallSLReentryEnabled}
                          onToggle={() => setOverallSLReentryEnabled((v) => !v)} />
                      </div>
                      <div className={`mt-2 flex items-center gap-2 ${overallSLReentryEnabled ? "" : "pointer-events-none opacity-40"}`}>
                        <LegSelect value={overallSLReentryAction} options={overallActionOptions}
                          onChange={setOverallSLReentryAction} enabled={overallSLReentryEnabled} className="min-w-[110px]" />
                        <LegCountSelect value={overallSLReentryCount}
                          onChange={setOverallSLReentryCount} enabled={overallSLReentryEnabled} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Overall Target ── */}
                <div className="rounded-md border border-slate-200 bg-white p-5 min-w-[240px]">
                  <div className="flex items-center justify-between gap-4">
                    <FieldLabel>Overall Target</FieldLabel>
                    <ToggleSwitch enabled={overallTgtEnabled} onToggle={() => setOverallTgtEnabled((v) => !v)} />
                  </div>
                  <div className={`mt-4 flex flex-col gap-4 ${overallTgtEnabled ? "" : "pointer-events-none opacity-40"}`}>
                    <div className="flex items-center gap-2">
                      <LegSelect value={overallTgtType} options={overallTgtSLTypeOptions}
                        onChange={setOverallTgtType} enabled={overallTgtEnabled} className="min-w-[140px]" />
                      <input type="number" value={overallTgtValue}
                        onChange={(e) => setOverallTgtValue(e.target.value)}
                        className="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none" />
                    </div>
                    <div className="border-t border-slate-100 pt-4">
                      <div className="flex items-center gap-2">
                        <FieldLabel>Re-entry on Tgt</FieldLabel>
                        <InfoIcon />
                        <ToggleSwitch enabled={overallTgtReentryEnabled}
                          onToggle={() => setOverallTgtReentryEnabled((v) => !v)} />
                      </div>
                      <div className={`mt-2 flex items-center gap-2 ${overallTgtReentryEnabled ? "" : "pointer-events-none opacity-40"}`}>
                        <LegSelect value={overallTgtReentryAction} options={overallActionOptions}
                          onChange={setOverallTgtReentryAction} enabled={overallTgtReentryEnabled} className="min-w-[110px]" />
                        <LegCountSelect value={overallTgtReentryCount}
                          onChange={setOverallTgtReentryCount} enabled={overallTgtReentryEnabled} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Trailing Options ── */}
                <div className="rounded-md border border-slate-200 bg-white p-5 min-w-[300px]">
                  <div className="flex items-center justify-between gap-4">
                    <FieldLabel>Trailing Options</FieldLabel>
                    <ToggleSwitch enabled={trailingEnabled} onToggle={() => setTrailingEnabled((v) => !v)} />
                  </div>
                  <div className={`mt-4 flex flex-col gap-4 ${trailingEnabled ? "" : "pointer-events-none opacity-40"}`}>
                    <NativeSelect value={trailingType} options={trailingTypeOptions}
                      onChange={setTrailingType} className="min-w-[180px]" />
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <FieldLabel>If profit reaches</FieldLabel>
                        <input type="number" value={trailingProfitReaches}
                          onChange={(e) => setTrailingProfitReaches(e.target.value)}
                          className="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none" />
                      </div>
                      <div className="flex items-center gap-2">
                        <FieldLabel>Lock profit</FieldLabel>
                        <input type="number" value={trailingLockProfit}
                          onChange={(e) => setTrailingLockProfit(e.target.value)}
                          className="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none" />
                      </div>
                    </div>
                    {trailingType === "TrailingOption.LockAndTrail" && (
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                          <FieldLabel>Increase profit by</FieldLabel>
                          <input type="number" value={trailingIncreaseBy}
                            onChange={(e) => setTrailingIncreaseBy(e.target.value)}
                            className="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none" />
                        </div>
                        <div className="flex items-center gap-2">
                          <FieldLabel>Trail profit by</FieldLabel>
                          <input type="number" value={trailingTrailBy}
                            onChange={(e) => setTrailingTrailBy(e.target.value)}
                            className="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </section>

            {/* Backtest date range */}
            <div className="flex h-full flex-col items-start justify-between gap-4 rounded-md border border-slate-200 bg-white p-5 md:flex-row md:items-center md:gap-10">
              <span className="text-sm font-light leading-4 text-slate-700 md:text-base md:leading-7">
                Enter the duration of your backtest
              </span>
              <div className="relative flex w-full items-center gap-4 md:w-max md:flex-row md:gap-10">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-normal leading-6 text-slate-700">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded border border-[#465fff]/20 px-2 py-1 text-sm text-slate-700 focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-normal leading-6 text-slate-700">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded border border-[#465fff]/20 px-2 py-1 text-sm text-slate-700 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Info note */}
            <p className="flex items-center justify-end gap-2 rounded bg-amber-50 p-2 px-4 text-sm font-semibold text-amber-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                />
              </svg>
              Latest Backtest data is available for 24-Mar-26
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
