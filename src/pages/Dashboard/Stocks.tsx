import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";

import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  MoreDotIcon,
} from "../../icons";

type StockSummary = {
  symbol: string;
  name: string;
  price: string;
  change: string;
  positive?: boolean;
  accent: string;
};

type TrendStock = {
  symbol: string;
  name: string;
  price: string;
  change: string;
  positive?: boolean;
};

type WatchItem = {
  symbol: string;
  name: string;
  price: string;
  change: string;
  positive?: boolean;
};

type TransactionItem = {
  name: string;
  symbol: string;
  date: string;
  price: string;
  category: string;
  status: "Success" | "Pending" | "Failed";
};

const summaryCards: StockSummary[] = [
  {
    symbol: "AAPL",
    name: "Apple, Inc",
    price: "$1,232.00",
    change: "11.01%",
    positive: true,
    accent: "from-sky-500 to-blue-600",
  },
  {
    symbol: "PYPL",
    name: "Paypal, Inc",
    price: "$965.00",
    change: "9.05%",
    positive: false,
    accent: "from-indigo-500 to-violet-600",
  },
  {
    symbol: "TSLA",
    name: "Tesla, Inc",
    price: "$1,232.00",
    change: "11.01%",
    positive: true,
    accent: "from-rose-500 to-orange-500",
  },
  {
    symbol: "AMZN",
    name: "Amazone.com, Inc",
    price: "$2,567.99",
    change: "11.01%",
    positive: true,
    accent: "from-amber-400 to-orange-500",
  },
];

const trendingStocks: TrendStock[] = [
  { symbol: "TSLA", name: "Tesla, Inc", price: "$192.53", change: "1.01%", positive: true },
  { symbol: "AAPL", name: "Apple, Inc", price: "$192.53", change: "3.59%", positive: true },
  { symbol: "SPOT", name: "Spotify, Inc", price: "$192.53", change: "1.01%", positive: true },
  { symbol: "PYPL", name: "Paypal, Inc", price: "$192.53", change: "1.01%", positive: true },
  { symbol: "AMZN", name: "Amazone, Inc", price: "$192.53", change: "1.01%", positive: true },
];

const watchlist: WatchItem[] = [
  { symbol: "AAPL", name: "Apple, Inc", price: "$4,008.65", change: "11.01%", positive: true },
  { symbol: "SPOT", name: "Spotify.com", price: "$11,689.00", change: "9.48%", positive: true },
  { symbol: "ABNB", name: "Airbnb, Inc", price: "$32,227.00", change: "0.29%", positive: true },
  { symbol: "ENVT", name: "Envato, Inc", price: "$13,895.00", change: "3.79%", positive: true },
  { symbol: "QIWI", name: "qiwi.com, Inc", price: "$4,008.65", change: "4.52%", positive: true },
];

const transactions: TransactionItem[] = [
  {
    name: "Bought PYPL",
    symbol: "PYPL",
    date: "Nov 23, 01:00 PM",
    price: "$2,567.88",
    category: "Finance",
    status: "Success",
  },
  {
    name: "Bought AAPL",
    symbol: "AAPL",
    date: "Nov 22, 09:00 PM",
    price: "$2,567.88",
    category: "Technology",
    status: "Pending",
  },
  {
    name: "Sell KKST",
    symbol: "KKST",
    date: "Oct 12, 03:54 PM",
    price: "$6,754.99",
    category: "Finance",
    status: "Success",
  },
  {
    name: "Bought FB",
    symbol: "FB",
    date: "Sep 09, 02:00 AM",
    price: "$1,445.41",
    category: "Social media",
    status: "Success",
  },
  {
    name: "Sell AMZN",
    symbol: "AMZN",
    date: "Feb 35, 08:00 PM",
    price: "$5,698.55",
    category: "E-commerce",
    status: "Failed",
  },
];

const portfolioOptions: ApexOptions = {
  chart: {
    type: "area",
    toolbar: { show: false },
    sparkline: { enabled: false },
    fontFamily: "Outfit, sans-serif",
  },
  colors: ["#465FFF"],
  stroke: {
    curve: "smooth",
    width: 3,
  },
  fill: {
    type: "gradient",
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.28,
      opacityTo: 0.03,
      stops: [0, 100],
    },
  },
  dataLabels: { enabled: false },
  grid: {
    borderColor: "#E4E7EC",
    strokeDashArray: 4,
    xaxis: { lines: { show: false } },
  },
  legend: { show: false },
  xaxis: {
    categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: { style: { colors: "#667085", fontSize: "12px" } },
  },
  yaxis: {
    labels: { style: { colors: "#667085", fontSize: "12px" } },
  },
  tooltip: {
    theme: "light",
    y: {
      formatter: (value) => `$${value.toFixed(2)}`,
    },
  },
};

const portfolioSeries = [
  {
    name: "Portfolio",
    data: [180, 220, 205, 248, 230, 276, 250, 298, 286, 320, 308, 344],
  },
];

function BrandBadge({ symbol, accent }: { symbol: string; accent: string }) {
  return (
    <div
      className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-sm font-semibold text-white shadow-theme-xs`}
    >
      {symbol.slice(0, 2)}
    </div>
  );
}

function ChangePill({ positive = true, value }: { positive?: boolean; value: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
        positive
          ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500"
          : "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500"
      }`}
    >
      {positive ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />}
      {value}
    </span>
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] ${className}`}>
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-gray-800 sm:px-6">
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{title}</h3>
          {subtitle ? (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  );
}

function StockRow({ stock }: { stock: TrendStock | WatchItem }) {
  const accent = stock.symbol === "AAPL"
    ? "from-sky-500 to-blue-600"
    : stock.symbol === "SPOT"
      ? "from-emerald-500 to-green-600"
      : stock.symbol === "ABNB"
        ? "from-rose-500 to-pink-600"
        : stock.symbol === "ENVT"
          ? "from-violet-500 to-indigo-600"
          : "from-amber-400 to-orange-500";

  return (
    <div className="flex items-center gap-4 py-3">
      <BrandBadge symbol={stock.symbol} accent={accent} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-800 dark:text-white/90">{stock.symbol}</p>
        <p className="truncate text-sm text-gray-500 dark:text-gray-400">{stock.name}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-gray-800 dark:text-white/90">{stock.price}</p>
        <p className={`mt-1 text-xs font-medium ${stock.positive ? "text-success-600" : "text-error-600"}`}>
          {stock.change}
        </p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TransactionItem["status"] }) {
  const classes =
    status === "Success"
      ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500"
      : status === "Pending"
        ? "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400"
        : "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-500";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}>{status}</span>;
}

export default function Stocks() {
  return (
    <>
      <PageMeta
        title="React.js Stocks Dashboard | TailAdmin - React.js Admin Dashboard Template"
        description="This is React.js Stocks dashboard page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <PageBreadcrumb pageTitle="Stocks" />

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {summaryCards.map((stock) => (
          <div key={stock.symbol} className="col-span-12 sm:col-span-6 xl:col-span-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <BrandBadge symbol={stock.symbol} accent={stock.accent} />
                <ChangePill positive={stock.positive} value={stock.change} />
              </div>
              <div className="mt-5">
                <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{stock.symbol}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{stock.name}</p>
                <p className="mt-4 text-2xl font-semibold text-gray-900 dark:text-white">{stock.price}</p>
              </div>
            </div>
          </div>
        ))}

        <div className="col-span-12 xl:col-span-8">
          <SectionCard
            title="Portfolio Performance"
            subtitle="Here is your performance stats of each month"
            action={
              <div className="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-white/[0.03]">
                <button className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-800 shadow-theme-xs dark:bg-gray-800 dark:text-white">
                  Monthly
                </button>
                <button className="px-3 py-1.5 text-xs font-medium text-gray-500">Quarterly</button>
                <button className="px-3 py-1.5 text-xs font-medium text-gray-500">Annually</button>
              </div>
            }
          >
            <Chart options={portfolioOptions} series={portfolioSeries} type="area" height={320} />
          </SectionCard>
        </div>

        <div className="col-span-12 xl:col-span-4">
          <SectionCard title="Trending Stocks" action={<MoreDotIcon className="text-gray-400" />}>
            <div className="space-y-1">
              {trendingStocks.map((stock) => (
                <div key={stock.symbol} className="border-b border-gray-100 last:border-b-0 dark:border-gray-800">
                  <StockRow stock={stock} />
                  <div className="mb-3 flex gap-2 pl-[60px]">
                    <button className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300">
                      Short Stock
                    </button>
                    <button className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-medium text-white">
                      Buy Stock
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="col-span-12 xl:col-span-4">
          <SectionCard
            title="Dividend"
            action={
              <div className="flex items-center gap-3 text-sm">
                <button className="text-gray-500 hover:text-gray-700">View More</button>
                <button className="text-error-500 hover:text-error-600">Delete</button>
              </div>
            }
          >
            <div className="space-y-4">
              <div className="rounded-xl bg-brand-50 p-4 dark:bg-brand-500/10">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Dividend Earned</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">$24,590.00</p>
                <p className="mt-2 text-sm text-success-600">+8.45% this month</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800">
                  <span className="text-sm text-gray-500">Technology</span>
                  <span className="text-sm font-semibold text-gray-800 dark:text-white/90">$8,450</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800">
                  <span className="text-sm text-gray-500">Retail</span>
                  <span className="text-sm font-semibold text-gray-800 dark:text-white/90">$6,120</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800">
                  <span className="text-sm text-gray-500">Entertainment</span>
                  <span className="text-sm font-semibold text-gray-800 dark:text-white/90">$10,020</span>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="col-span-12 xl:col-span-8">
          <SectionCard
            title="My Watchlist"
            action={
              <div className="flex items-center gap-3 text-sm">
                <button className="text-gray-500 hover:text-gray-700">View More</button>
                <button className="text-error-500 hover:text-error-600">Delete</button>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-x-6 divide-y divide-gray-100 dark:divide-gray-800 sm:grid-cols-2 sm:divide-y-0">
              <div className="sm:pr-3">
                {watchlist.map((stock) => (
                  <StockRow key={`${stock.symbol}-left`} stock={stock} />
                ))}
              </div>
              <div className="sm:pl-3">
                {watchlist.map((stock) => (
                  <StockRow key={`${stock.symbol}-right`} stock={stock} />
                ))}
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="col-span-12">
          <SectionCard title="Latest Transactions">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((item) => (
                    <tr key={`${item.symbol}-${item.date}`} className="border-b border-gray-100 last:border-b-0 dark:border-gray-800">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <BrandBadge symbol={item.symbol} accent="from-brand-500 to-brand-600" />
                          <div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-white/90">{item.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{item.symbol}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">{item.date}</td>
                      <td className="px-4 py-4 text-sm font-medium text-gray-800 dark:text-white/90">{item.price}</td>
                      <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">{item.category}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={item.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
