import { useEffect, useRef, useState } from "react";
import {
  Chart,
  BarController,
  LineController,
  BarElement,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
} from "chart.js";

Chart.register(
  BarController,
  LineController,
  BarElement,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler
);

// ─── Types ───────────────────────────────────────────────────────────────────

interface Leg {
  type: "Buy" | "Sell";
  optionType: "Call" | "Put";
  strike: number;
  premium: number;
  quantity: number;
  entryDate: string;
}

interface Stats {
  maxProfit: number;
  maxLoss: number;
  currentPnL: number;
  breakevenPoints: number[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function bsCall(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0.001) return Math.max(0, S - K);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
}

function bsPut(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0.001) return Math.max(0, K - S);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
}

// ─── Component ───────────────────────────────────────────────────────────────

const DEFAULT_LEGS: Leg[] = [
  { type: "Sell", optionType: "Call", strike: 25900, premium: 183.8, quantity: 1, entryDate: today() },
  { type: "Sell", optionType: "Put", strike: 25400, premium: 130, quantity: 1, entryDate: today() },
];

const PNL_STEP = 5;
const OI_STEP = 50;

export default function SimulatorPage() {
  const [spotPrice, setSpotPrice] = useState(25670.5);
  const [legs, setLegs] = useState<Leg[]>(DEFAULT_LEGS);
  const [targetDate, setTargetDate] = useState(today());
  const [volatility, setVolatility] = useState(15);
  const [riskFreeRate, setRiskFreeRate] = useState(6);
  const [stats, setStats] = useState<Stats>({
    maxProfit: 0, maxLoss: 0, currentPnL: 0, breakevenPoints: [],
  });
  const [projectedText, setProjectedText] = useState("");
  const [projectedIsProfit, setProjectedIsProfit] = useState(true);
  const [zoomedIn, setZoomedIn] = useState(false);

  // refs for values used inside canvas event closures
  const chartInstanceRef = useRef<Chart | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pnlRangeRef = useRef<number[]>([]);
  const callOIRef = useRef<number[]>([]);
  const putOIRef = useRef<number[]>([]);
  const isZoomedRef = useRef(false);
  const zoomStartRef = useRef(24800);
  const zoomEndRef = useRef(26500);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartPriceRef = useRef(0);
  // keep live copies of state for event handlers
  const spotRef = useRef(spotPrice);
  const legsRef = useRef(legs);
  const targetDateRef = useRef(targetDate);
  const volRef = useRef(volatility);
  const rateRef = useRef(riskFreeRate);

  useEffect(() => { spotRef.current = spotPrice; }, [spotPrice]);
  useEffect(() => { legsRef.current = legs; }, [legs]);
  useEffect(() => { targetDateRef.current = targetDate; }, [targetDate]);
  useEffect(() => { volRef.current = volatility; }, [volatility]);
  useEffect(() => { rateRef.current = riskFreeRate; }, [riskFreeRate]);

  // ── P&L calculations ────────────────────────────────────────────────────

  function calcPnL(spot: number, legList = legsRef.current): number {
    return legList.reduce((total, leg) => {
      const iv = leg.optionType === "Call"
        ? Math.max(0, spot - leg.strike)
        : Math.max(0, leg.strike - spot);
      const legPnL = leg.type === "Buy"
        ? (iv - leg.premium) * leg.quantity
        : (leg.premium - iv) * leg.quantity;
      return total + legPnL;
    }, 0);
  }

  function calcCurrentDayPnL(spot: number, legList = legsRef.current): number {
    const tDate = new Date(targetDateRef.current);
    const r = rateRef.current / 100;
    const sigma = volRef.current / 100;
    return legList.reduce((total, leg) => {
      const entry = new Date(leg.entryDate || today());
      const daysLeft = Math.max(0, Math.ceil((tDate.getTime() - entry.getTime()) / 86400000));
      const T = Math.max(0.001, daysLeft / 365);
      const optVal = leg.optionType === "Call"
        ? bsCall(spot, leg.strike, T, r, sigma)
        : bsPut(spot, leg.strike, T, r, sigma);
      const legPnL = leg.type === "Buy"
        ? (optVal - leg.premium) * leg.quantity
        : (leg.premium - optVal) * leg.quantity;
      return total + legPnL;
    }, 0);
  }

  function netPremium(legList = legsRef.current): number {
    return legList.reduce((sum, leg) => {
      return sum + (leg.type === "Sell" ? 1 : -1) * leg.premium * leg.quantity;
    }, 0);
  }

  // ── OI generation ────────────────────────────────────────────────────────

  function generateOI(priceRange: number[], isCall: boolean): number[] {
    const spot = spotRef.current;
    return priceRange.map((price) => {
      const strikePrice = isCall ? price - 10 : price + 10;
      if (strikePrice % OI_STEP !== 0) return 0;
      const distance = isCall ? strikePrice - spot : spot - strikePrice;
      let value: number;
      if (Math.abs(distance) > 500) value = Math.random() * 8000 + 12000;
      else if (Math.abs(distance) > 200) value = Math.random() * 6000 + 8000;
      else value = Math.random() * 4000 + 3000;
      if (isCall) {
        if (strikePrice === 26000) value = 24000;
        if (strikePrice === 25950) value = 18000;
        if (strikePrice === 26050) value = 20000;
      } else {
        if (strikePrice === 25500) value = 18000;
        if (strikePrice === 25450) value = 15000;
        if (strikePrice === 25400) value = 12000;
      }
      return value;
    });
  }

  // ── Spot line update ─────────────────────────────────────────────────────

  function updateSpotLine() {
    const chart = chartInstanceRef.current;
    const canvas = canvasRef.current;
    if (!chart || !chart.chartArea || !canvas) return;

    const spotLine = document.getElementById("spotLine") as HTMLElement;
    const spotLabel = document.getElementById("spotPriceLabel") as HTMLElement;
    const floatingPnL = document.getElementById("floatingPnL") as HTMLElement;
    const floatingText = document.getElementById("floatingPnLText") as HTMLElement;

    const spot = spotRef.current;
    const range = pnlRangeRef.current;

    if (spot < range[0] || spot > range[range.length - 1]) {
      spotLine.style.display = "none";
      floatingPnL.style.display = "none";
      spotLabel.style.display = "none";
      return;
    }

    let idx = range.findIndex((p) => p === spot);
    if (idx === -1) {
      let minD = Infinity;
      range.forEach((p, i) => {
        const d = Math.abs(p - spot);
        if (d < minD) { minD = d; idx = i; }
      });
    }

    const ca = chart.chartArea;
    const xPos = ca.left + (idx / (range.length - 1)) * (ca.right - ca.left);

    spotLine.style.display = "block";
    spotLine.style.left = xPos + "px";
    spotLine.style.top = ca.top + "px";
    spotLine.style.height = ca.bottom - ca.top + "px";

    spotLabel.style.display = "block";
    spotLabel.style.left = xPos + "px";
    spotLabel.style.top = ca.top - 30 + "px";
    spotLabel.textContent = "₹" + spot.toFixed(2);

    const pnl = calcCurrentDayPnL(spot);
    const np = netPremium();
    const pct = np !== 0 ? ((pnl / Math.abs(np)) * 100).toFixed(2) : "0.00";
    const prefix = pnl >= 0 ? "+" : "";

    floatingPnL.style.display = "flex";
    floatingPnL.style.left = xPos - floatingPnL.offsetWidth / 2 + "px";
    floatingPnL.style.top = ca.bottom + 50 + "px";
    floatingPnL.className = "payoff-floating-pnl" + (pnl >= 0 ? "" : " loss");
    floatingText.textContent = `${prefix}₹${pnl.toFixed(2)} (${prefix}${pct}%)`;
  }

  // ── Chart update ─────────────────────────────────────────────────────────

  function updateChart(legList = legsRef.current) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const start = isZoomedRef.current ? zoomStartRef.current : 24800;
    const end = isZoomedRef.current ? zoomEndRef.current : 26500;
    const range: number[] = [];
    for (let p = start; p <= end; p += PNL_STEP) range.push(p);
    pnlRangeRef.current = range;

    const expiryPnL = range.map((p) => calcPnL(p, legList));
    const currentPnL = range.map((p) => calcCurrentDayPnL(p, legList));
    const callOI = generateOI(range, true);
    const putOI = generateOI(range, false);
    callOIRef.current = callOI;
    putOIRef.current = putOI;

    const maxPnL = Math.max(...expiryPnL, ...currentPnL);
    const minPnL = Math.min(...expiryPnL, ...currentPnL);
    const pnlRange = Math.max(Math.abs(maxPnL), Math.abs(minPnL));
    const pnlMax = Math.ceil((pnlRange * 1.2) / 1000) * 1000;
    const pnlMin = -pnlMax;

    const maxOI = Math.max(...callOI, ...putOI);
    const oiMax = Math.ceil((maxOI * 1.2) / 5000) * 5000;
    const oiMin = -oiMax;

    // Stats
    const maxProfit = Math.max(...expiryPnL);
    const maxLoss = Math.min(...expiryPnL);
    const curPnL = calcPnL(spotRef.current, legList);
    const bps: number[] = [];
    for (let i = 1; i < expiryPnL.length; i++) {
      const prev = expiryPnL[i - 1], curr = expiryPnL[i];
      if ((prev < 0 && curr >= 0) || (prev >= 0 && curr < 0)) {
        const pPr = range[i - 1], cPr = range[i];
        bps.push(Math.round(pPr + (cPr - pPr) * (0 - prev) / (curr - prev)));
      }
    }
    setStats({ maxProfit, maxLoss, currentPnL: curPnL, breakevenPoints: bps });

    const np = netPremium(legList);
    const pct = np !== 0 ? ((curPnL / Math.abs(np)) * 100).toFixed(2) : "0.00";
    const prefix = curPnL >= 0 ? "+" : "";
    setProjectedIsProfit(curPnL >= 0);
    setProjectedText(
      curPnL >= 0
        ? `Projected profit: ${prefix}${curPnL.toFixed(0)} (${prefix}${pct}%)`
        : `Projected loss: ${curPnL.toFixed(0)} (${pct}%)`
    );

    // Dataset config
    const datasets = [
      {
        type: "bar" as const,
        label: "Put OI",
        data: putOI,
        backgroundColor: "rgba(16,185,129,0.7)",
        borderWidth: 0,
        yAxisID: "yOI",
        order: 4,
        barPercentage: 6.0,
        categoryPercentage: 1.0,
        xAxisID: "x",
      },
      {
        type: "bar" as const,
        label: "Call OI",
        data: callOI,
        backgroundColor: "rgba(239,68,68,0.7)",
        borderWidth: 0,
        yAxisID: "yOI",
        order: 3,
        barPercentage: 6.0,
        categoryPercentage: 1.0,
        xAxisID: "x",
      },
      {
        type: "line" as const,
        label: "Expiry Payoff",
        data: expiryPnL,
        borderColor: "rgba(16,185,129,1)",
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 5,
        fill: { target: "origin", above: "rgba(16,185,129,0.15)", below: "rgba(239,68,68,0.15)" },
        segment: {
          borderColor: (ctx: any) => {
            const y0 = ctx.p0.parsed.y, y1 = ctx.p1.parsed.y;
            if (y0 >= 0 && y1 >= 0) return "rgba(16,185,129,1)";
            if (y0 < 0 && y1 < 0) return "rgba(239,68,68,1)";
            return (y0 + y1) / 2 >= 0 ? "rgba(16,185,129,1)" : "rgba(239,68,68,1)";
          },
        },
        tension: 0.1,
        yAxisID: "yPnL",
        order: 1,
      },
      {
        type: "line" as const,
        label: "Current Day Payoff",
        data: currentPnL,
        borderColor: "rgba(59,130,246,1)",
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 5,
        fill: { target: "origin", above: "rgba(59,130,246,0.15)", below: "rgba(239,68,68,0.15)" },
        segment: {
          borderColor: (ctx: any) => {
            const y0 = ctx.p0.parsed.y, y1 = ctx.p1.parsed.y;
            if (y0 >= 0 && y1 >= 0) return "rgba(59,130,246,1)";
            if (y0 < 0 && y1 < 0) return "rgba(239,68,68,1)";
            return (y0 + y1) / 2 >= 0 ? "rgba(59,130,246,1)" : "rgba(239,68,68,1)";
          },
        },
        tension: 0.1,
        yAxisID: "yPnL",
        order: 2,
      },
    ];

    if (chartInstanceRef.current) {
      const c = chartInstanceRef.current;
      c.data.labels = range;
      c.data.datasets[0].data = putOI;
      c.data.datasets[1].data = callOI;
      c.data.datasets[2].data = expiryPnL;
      c.data.datasets[3].data = currentPnL;
      (c.options.scales as any).yPnL.min = pnlMin;
      (c.options.scales as any).yPnL.max = pnlMax;
      (c.options.scales as any).yOI.min = oiMin;
      (c.options.scales as any).yOI.max = oiMax;
      c.update();
      setTimeout(updateSpotLine, 200);
      return;
    }

    const ctx = canvas.getContext("2d")!;
    chartInstanceRef.current = new Chart(ctx, {
      type: "bar",
      data: { labels: range, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: "rgba(0,0,0,0.8)",
            padding: 12,
            displayColors: true,
            callbacks: {
              title: (ctx) => {
                const price = parseFloat(ctx[0].label);
                const strike = Math.round(price / OI_STEP) * OI_STEP;
                return `Price: ${price} | Strike: ${strike}`;
              },
              label: (ctx) => {
                const di = ctx.datasetIndex;
                const price = parseFloat(ctx.label);
                const strike = Math.round(price / OI_STEP) * OI_STEP;
                if (di === 0 || di === 1) {
                  const range = pnlRangeRef.current;
                  const co = callOIRef.current;
                  const po = putOIRef.current;
                  if (di === 0) {
                    const i = range.indexOf(strike - 10);
                    return `Put OI: ${Math.round(i !== -1 ? po[i] : 0).toLocaleString()}`;
                  } else {
                    const i = range.indexOf(strike + 10);
                    return `Call OI: ${Math.round(i !== -1 ? co[i] : 0).toLocaleString()}`;
                  }
                }
                return `${ctx.dataset.label}: ₹${(ctx.parsed.y ?? 0).toFixed(2)}`;
              },
            },
          },
        },
        scales: {
          x: {
            offset: true,
            grid: { display: true, color: "rgba(0,0,0,0.05)" },
            ticks: {
              callback: function (value) {
                const price = this.getLabelForValue(value as number);
                return Number(price) % 100 === 0 ? price : "";
              },
              color: "#6b7280",
              font: { size: 11 },
            },
            border: { display: false },
          },
          yPnL: {
            type: "linear",
            position: "left",
            min: pnlMin,
            max: pnlMax,
            title: { display: true, text: "Profit / Loss", color: "#6b7280", font: { size: 12, weight: 500 } },
            grid: {
              display: true,
              color: (ctx) => ctx.tick.value === 0 ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.05)",
              lineWidth: (ctx) => ctx.tick.value === 0 ? 2 : 1,
            },
            ticks: { callback: (v) => Number(v).toLocaleString(), color: "#6b7280", font: { size: 11 } },
            border: { display: false },
          },
          yOI: {
            type: "linear",
            position: "right",
            min: oiMin,
            max: oiMax,
            title: { display: true, text: "Open Interest", color: "#6b7280", font: { size: 12, weight: 500 } },
            grid: { display: false },
            ticks: {
              callback: (v) => {
                const a = Math.abs(Number(v));
                if (a === 0) return "0";
                if (a >= 10000) return (a / 10000).toFixed(0) + "Cr";
                return a.toLocaleString();
              },
              color: "#6b7280",
              font: { size: 11 },
            },
            border: { display: false },
          },
        },
      },
    });
    setTimeout(updateSpotLine, 200);
  }

  // ── Zoom drag setup ──────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const zoomSel = document.getElementById("zoomSelection") as HTMLElement;

    let startX = 0;
    let startPrice = 0;

    const onDown = (e: MouseEvent) => {
      const chart = chartInstanceRef.current;
      if (!chart?.chartArea) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ca = chart.chartArea;
      if (x < ca.left || x > ca.right) return;
      isDraggingRef.current = true;
      startX = x;
      const idx = Math.round(((x - ca.left) / (ca.right - ca.left)) * (pnlRangeRef.current.length - 1));
      startPrice = pnlRangeRef.current[Math.max(0, Math.min(idx, pnlRangeRef.current.length - 1))];
      dragStartPriceRef.current = startPrice;
      dragStartXRef.current = x;
      zoomSel.style.display = "block";
      zoomSel.style.left = x + "px";
      zoomSel.style.top = ca.top + "px";
      zoomSel.style.width = "0px";
      zoomSel.style.height = ca.bottom - ca.top + "px";
    };

    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !chartInstanceRef.current?.chartArea) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(chartInstanceRef.current.chartArea.left,
        Math.min(e.clientX - rect.left, chartInstanceRef.current.chartArea.right));
      const left = Math.min(startX, x);
      zoomSel.style.left = left + "px";
      zoomSel.style.width = Math.abs(x - startX) + "px";
    };

    const onUp = (e: MouseEvent) => {
      if (!isDraggingRef.current || !chartInstanceRef.current?.chartArea) return;
      isDraggingRef.current = false;
      zoomSel.style.display = "none";
      const rect = canvas.getBoundingClientRect();
      const endX = e.clientX - rect.left;
      if (Math.abs(endX - startX) < 10) return;
      const ca = chartInstanceRef.current.chartArea;
      const endIdx = Math.round(
        ((Math.max(ca.left, Math.min(endX, ca.right)) - ca.left) / (ca.right - ca.left)) *
        (pnlRangeRef.current.length - 1)
      );
      const endPrice = pnlRangeRef.current[Math.max(0, Math.min(endIdx, pnlRangeRef.current.length - 1))];
      let zs = Math.floor(Math.min(startPrice, endPrice) / 50) * 50;
      let ze = Math.ceil(Math.max(startPrice, endPrice) / 50) * 50;
      if (ze - zs < 200) { const c = (zs + ze) / 2; zs = Math.floor((c - 100) / 50) * 50; ze = Math.ceil((c + 100) / 50) * 50; }
      zoomStartRef.current = zs;
      zoomEndRef.current = ze;
      isZoomedRef.current = true;
      setZoomedIn(true);
      updateChart();
    };

    const onLeave = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        zoomSel.style.display = "none";
      }
    };

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("mouseleave", onLeave);
    return () => {
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  // ── Initial chart render ─────────────────────────────────────────────────

  useEffect(() => {
    updateChart(legs);
    return () => {
      chartInstanceRef.current?.destroy();
      chartInstanceRef.current = null;
    };
  }, []);

  // Re-render chart when inputs change
  useEffect(() => {
    if (chartInstanceRef.current) updateChart(legs);
  }, [spotPrice, legs, targetDate, volatility, riskFreeRate]);

  // ── Leg helpers ──────────────────────────────────────────────────────────

  function addLeg() {
    setLegs((prev) => [
      ...prev,
      {
        type: "Buy",
        optionType: "Call",
        strike: Math.round(spotRef.current / 50) * 50,
        premium: 100,
        quantity: 1,
        entryDate: today(),
      },
    ]);
  }

  function removeLeg(i: number) {
    setLegs((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateLeg(i: number, field: keyof Leg, value: string) {
    setLegs((prev) =>
      prev.map((leg, idx) => {
        if (idx !== i) return leg;
        if (field === "type" || field === "optionType" || field === "entryDate") {
          return { ...leg, [field]: value };
        }
        return { ...leg, [field]: parseFloat(value) };
      })
    );
  }

  function resetZoom() {
    isZoomedRef.current = false;
    zoomStartRef.current = 24800;
    zoomEndRef.current = 26500;
    setZoomedIn(false);
    updateChart(legs);
  }

  // ── Slider range ─────────────────────────────────────────────────────────

  const sliderMin = isZoomedRef.current ? Math.floor(zoomStartRef.current * 0.95) : 24000;
  const sliderMax = isZoomedRef.current ? Math.ceil(zoomEndRef.current * 1.05) : 27000;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        .payoff-page { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background:#f8f9fa; }
        .payoff-main { max-width:1600px; margin:0 auto; display:flex; gap:20px; }
        .payoff-chart-section { flex:1; background:#fff; padding:25px; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,.08); }
        .payoff-stats-panel { width:350px; display:flex; flex-direction:column; gap:15px; }
        .payoff-stat-card { background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,.08); }
        .payoff-stat-card.profit { background:linear-gradient(135deg,#d1fae5,#a7f3d0); border-left:4px solid #10b981; }
        .payoff-stat-card.loss   { background:linear-gradient(135deg,#fee2e2,#fecaca); border-left:4px solid #ef4444; }
        .payoff-stat-card.current{ background:linear-gradient(135deg,#dbeafe,#bfdbfe); border-left:4px solid #3b82f6; }
        .payoff-stat-card.be     { background:linear-gradient(135deg,#e9d5ff,#d8b4fe); border-left:4px solid #a855f7; }
        .payoff-stat-label { font-size:13px; font-weight:600; margin-bottom:8px; opacity:.8; }
        .payoff-stat-value { font-size:28px; font-weight:700; }
        .payoff-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; }
        .payoff-sd-labels { display:flex; gap:40px; font-size:13px; color:#666; }
        .payoff-current-price { padding:6px 14px; border:1px solid #d1d5db; border-radius:4px; font-size:13px; color:#374151; }
        .payoff-zoom-btn { padding:6px 14px; border:1px solid #d1d5db; border-radius:4px; background:#fff; cursor:pointer; font-size:13px; display:flex; align-items:center; gap:6px; color:#374151; }
        .payoff-zoom-btn:hover { background:#f9fafb; border-color:#9ca3af; }
        .payoff-chart-wrapper { position:relative; height:450px; margin-bottom:20px; }
        .payoff-spot-line { position:absolute; width:2px; background:#374151; pointer-events:none; z-index:10; box-shadow:0 0 8px rgba(0,0,0,.2); }
        .payoff-spot-label { position:absolute; background:#374151; color:#fff; padding:4px 10px; border-radius:4px; font-size:12px; font-weight:600; white-space:nowrap; pointer-events:none; z-index:12; transform:translateX(-50%); box-shadow:0 2px 6px rgba(0,0,0,.2); }
        .payoff-spot-label::after { content:''; position:absolute; top:100%; left:50%; transform:translateX(-50%); border:5px solid transparent; border-top-color:#374151; }
        .payoff-floating-pnl { position:absolute; background:linear-gradient(135deg,#10b981,#059669); color:#fff; padding:10px 18px; border-radius:8px; font-size:14px; font-weight:600; box-shadow:0 4px 16px rgba(0,0,0,.2); pointer-events:none; z-index:11; white-space:nowrap; align-items:center; gap:8px; border:2px solid #fff; }
        .payoff-floating-pnl.loss { background:linear-gradient(135deg,#ef4444,#dc2626); }
        .payoff-zoom-sel { position:absolute; border:2px dashed #3b82f6; background:rgba(59,130,246,.1); pointer-events:none; z-index:12; display:none; }
        .payoff-zoom-reset { position:absolute; top:10px; right:10px; padding:6px 12px; background:#3b82f6; color:#fff; border:none; border-radius:4px; font-size:12px; cursor:pointer; z-index:13; }
        .payoff-zoom-reset:hover { background:#2563eb; }
        .payoff-projected { display:inline-flex; align-items:center; gap:8px; color:#fff; padding:8px 16px; border-radius:6px; font-size:13px; font-weight:500; margin-top:10px; }
        .payoff-oi-info { font-size:12px; color:#6b7280; margin-top:-10px; margin-bottom:15px; }
        .payoff-oi-info .call-c { color:#10b981; font-weight:600; margin-right:15px; }
        .payoff-oi-info .put-c  { color:#ef4444; font-weight:600; margin-right:15px; }
        .payoff-legs-section { max-width:1600px; margin:20px auto 0; background:#fff; padding:25px; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,.08); }
        .payoff-legs-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; }
        .payoff-legs-title { font-size:20px; font-weight:600; color:#111827; }
        .payoff-add-btn { padding:10px 20px; background:#3b82f6; color:#fff; border:none; border-radius:6px; font-size:14px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:8px; }
        .payoff-add-btn:hover { background:#2563eb; }
        .payoff-slider-box { background:#fef3c7; padding:20px; border-radius:8px; margin-bottom:20px; border:1px solid #fbbf24; }
        .payoff-slider-label { font-size:14px; font-weight:600; color:#92400e; margin-bottom:10px; }
        .payoff-slider { width:100%; height:6px; background:linear-gradient(to right,#fbbf24,#f59e0b); border-radius:3px; outline:none; -webkit-appearance:none; }
        .payoff-slider::-webkit-slider-thumb { -webkit-appearance:none; width:24px; height:24px; background:#f59e0b; cursor:pointer; border-radius:50%; border:3px solid #fff; box-shadow:0 2px 4px rgba(0,0,0,.2); }
        .payoff-legs-list { display:flex; flex-direction:column; gap:15px; }
        .payoff-leg-row { display:grid; grid-template-columns:150px 150px 200px 180px 120px 150px 50px; gap:15px; align-items:center; padding:15px; background:#f9fafb; border-radius:6px; border:1px solid #e5e7eb; }
        .payoff-leg-input, .payoff-leg-select { padding:10px 12px; border:1px solid #d1d5db; border-radius:6px; font-size:14px; background:#fff; width:100%; }
        .payoff-del-btn { width:40px; height:40px; background:#ef4444; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:18px; display:flex; align-items:center; justify-content:center; }
        .payoff-del-btn:hover { background:#dc2626; }
        .payoff-params-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:15px; margin-top:15px; }
        .payoff-params-label { font-size:12px; color:#92400e; display:block; margin-bottom:5px; }
        .payoff-params-input { width:100%; padding:8px; border:1px solid #fbbf24; border-radius:4px; background:#fff; }
        .payoff-params-hint { margin-top:10px; font-size:11px; color:#92400e; opacity:.8; }
      `}</style>

      <div className="payoff-page" style={{ padding: "20px" }}>
        {/* ── Main row: chart + stats ── */}
        <div className="payoff-main">

          {/* Chart section */}
          <div className="payoff-chart-section">
            <div className="payoff-header">
              <div className="payoff-sd-labels">
                <span>-2SD</span>
                <span style={{ marginLeft: 120 }}>-1SD</span>
                <span style={{ marginLeft: 240 }}>1SD</span>
                <span style={{ marginLeft: 120 }}>2SD</span>
              </div>
              <div className="payoff-current-price">
                Current price: <strong>{spotPrice.toFixed(2)}</strong>
              </div>
              <button className="payoff-zoom-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
                Zoom Out
              </button>
            </div>

            <div className="payoff-oi-info">
              OI data at <strong>{Math.round(spotPrice / 50) * 50}</strong> |{" "}
              <span className="put-c">Call OI 761.26L</span>
              <span className="call-c">Put OI 607.50L</span>
              <span style={{ color: "#10b981", marginRight: 15 }}>— On Expiry</span>
              <span style={{ color: "#3b82f6" }}>— On Target Date</span>
            </div>

            <div className="payoff-chart-wrapper">
              <canvas ref={canvasRef} id="payoffChart" />
              <div className="payoff-spot-line" id="spotLine" style={{ display: "none" }} />
              <div className="payoff-spot-label" id="spotPriceLabel" style={{ display: "none" }}>
                ₹{spotPrice.toFixed(2)}
              </div>
              <div className="payoff-floating-pnl" id="floatingPnL" style={{ display: "none" }}>
                <span id="floatingPnLText">Projected: ₹0</span>
                <span style={{ width:16,height:16,background:"rgba(255,255,255,.3)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:"bold" }}>ⓘ</span>
              </div>
              <div className="payoff-zoom-sel" id="zoomSelection" />
              {zoomedIn && (
                <button className="payoff-zoom-reset" onClick={resetZoom}>
                  Reset Zoom
                </button>
              )}
            </div>

            <div style={{ textAlign: "center" }}>
              <div
                className="payoff-projected"
                style={{ background: projectedIsProfit ? "#10b981" : "#ef4444" }}
              >
                <span>{projectedText}</span>
                <span style={{ width:16,height:16,background:"rgba(255,255,255,.3)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:"bold" }}>ⓘ</span>
              </div>
            </div>
          </div>

          {/* Stats panel */}
          <div className="payoff-stats-panel">
            <div className="payoff-stat-card profit">
              <div className="payoff-stat-label">Max Profit</div>
              <div className="payoff-stat-value">₹{stats.maxProfit.toFixed(2)}</div>
            </div>
            <div className="payoff-stat-card loss">
              <div className="payoff-stat-label">Max Loss</div>
              <div className="payoff-stat-value">₹{stats.maxLoss.toFixed(2)}</div>
            </div>
            <div className="payoff-stat-card current">
              <div className="payoff-stat-label">Current P&L</div>
              <div className="payoff-stat-value">₹{stats.currentPnL.toFixed(2)}</div>
            </div>
            <div className="payoff-stat-card be">
              <div className="payoff-stat-label">Breakeven Points</div>
              <div className="payoff-stat-value" style={{ fontSize: 18 }}>
                {stats.breakevenPoints.length > 0
                  ? stats.breakevenPoints.map((b) => "₹" + b).join(", ")
                  : "No breakeven"}
              </div>
            </div>
          </div>
        </div>

        {/* ── Legs section ── */}
        <div className="payoff-legs-section">
          <div className="payoff-legs-header">
            <h2 className="payoff-legs-title">Option Legs</h2>
            <button className="payoff-add-btn" onClick={addLeg}>
              <span>+</span> Add Leg
            </button>
          </div>

          {/* Spot + params */}
          <div className="payoff-slider-box">
            <div className="payoff-slider-label">
              Current Spot Price: ₹{spotPrice.toFixed(2)}
            </div>
            <input
              type="range"
              className="payoff-slider"
              min={sliderMin}
              max={sliderMax}
              step={10}
              value={spotPrice}
              onChange={(e) => setSpotPrice(parseFloat(e.target.value))}
            />
            <div className="payoff-params-grid">
              <div>
                <label className="payoff-params-label">Target Date (Blue Line)</label>
                <input
                  type="date"
                  className="payoff-params-input"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>
              <div>
                <label className="payoff-params-label">Volatility (%)</label>
                <input
                  type="number"
                  className="payoff-params-input"
                  value={volatility}
                  min={5}
                  max={100}
                  step={1}
                  onChange={(e) => setVolatility(parseFloat(e.target.value))}
                />
              </div>
              <div>
                <label className="payoff-params-label">Risk-free Rate (%)</label>
                <input
                  type="number"
                  className="payoff-params-input"
                  value={riskFreeRate}
                  min={0}
                  max={20}
                  step={0.5}
                  onChange={(e) => setRiskFreeRate(parseFloat(e.target.value))}
                />
              </div>
            </div>
            <div className="payoff-params-hint">
              Blue line shows P&L at Target Date. Time remaining calculated from entry date of each leg.
            </div>
          </div>

          {/* Legs list */}
          <div className="payoff-legs-list">
            {legs.map((leg, i) => (
              <div key={i} className="payoff-leg-row">
                <select
                  className="payoff-leg-select"
                  value={leg.type}
                  onChange={(e) => updateLeg(i, "type", e.target.value)}
                >
                  <option value="Buy">Buy</option>
                  <option value="Sell">Sell</option>
                </select>
                <select
                  className="payoff-leg-select"
                  value={leg.optionType}
                  onChange={(e) => updateLeg(i, "optionType", e.target.value)}
                >
                  <option value="Call">Call</option>
                  <option value="Put">Put</option>
                </select>
                <input
                  type="number"
                  className="payoff-leg-input"
                  value={leg.strike}
                  step={50}
                  placeholder="Strike Price"
                  onChange={(e) => updateLeg(i, "strike", e.target.value)}
                />
                <input
                  type="number"
                  className="payoff-leg-input"
                  value={leg.premium}
                  step={10}
                  placeholder="Premium"
                  onChange={(e) => updateLeg(i, "premium", e.target.value)}
                />
                <input
                  type="number"
                  className="payoff-leg-input"
                  value={leg.quantity}
                  step={1}
                  placeholder="Quantity"
                  onChange={(e) => updateLeg(i, "quantity", e.target.value)}
                />
                <input
                  type="date"
                  className="payoff-leg-input"
                  value={leg.entryDate}
                  title="Entry Date"
                  onChange={(e) => updateLeg(i, "entryDate", e.target.value)}
                />
                <button className="payoff-del-btn" onClick={() => removeLeg(i)}>
                  🗑
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
