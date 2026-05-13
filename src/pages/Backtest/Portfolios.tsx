import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { Modal } from "../../components/ui/modal";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Portfolio {
  _id: string;
  name: string;
  strategy_ids: string[];
  strategy_names: string[];
  created_at?: string;
}

interface Strategy {
  _id: string;
  name: string;
}

// ─── Three-dot menu ───────────────────────────────────────────────────────────

function PortfolioMenu({
  portfolioId,
  onDelete,
}: {
  portfolioId: string;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        className="flex items-center justify-center rounded text-gray-400 hover:text-gray-600"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
          strokeWidth="1.5" stroke="currentColor" className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-50 w-36 rounded-xl border border-gray-200 bg-white shadow-lg">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setOpen(false); onDelete(portfolioId); }}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
              strokeWidth="1.5" stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Portfolio Card ───────────────────────────────────────────────────────────

function PortfolioCard({
  portfolio,
  onDelete,
}: {
  portfolio: Portfolio;
  index: number;
  onDelete: (id: string) => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">

      {/* ── Card title row ── */}
      <div className="flex items-center justify-between px-5 py-4">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90 capitalize">
          {portfolio.name}
        </h3>
        <PortfolioMenu portfolioId={portfolio._id} onDelete={onDelete} />
      </div>

      {/* ── Column header row ── */}
      <div className="flex items-center justify-between border-t border-gray-100 px-5 py-2.5">
        <span className="text-xs text-gray-400">Strategy</span>
        <span className="text-xs text-brand-500">
          {portfolio.strategy_ids.length}{" "}
          {portfolio.strategy_ids.length === 1 ? "Strategy" : "Strategies"}
        </span>
      </div>

      {/* ── Scrollable strategy list ── */}
      <ul
        className="overflow-y-auto px-5"
        style={{ maxHeight: "200px" }}
      >
        {portfolio.strategy_names.length > 0 ? (
          portfolio.strategy_names.map((name, i) => (
            <li
              key={i}
              className="flex items-center border-b border-gray-100 py-3 last:border-0"
            >
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {name}
              </span>
            </li>
          ))
        ) : (
          <li className="py-4 text-sm text-gray-400">No strategies added yet</li>
        )}
      </ul>

      {/* ── Full-width View button ── */}
      <div className="mt-auto border-t border-gray-100 p-4">
        <button
          type="button"
          onClick={() => navigate(`/backtest/portfolio/${portfolio._id}`)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05]"
        >
          View Portfolio
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth="1.5" stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Create Portfolio Modal ───────────────────────────────────────────────────

function CreatePortfolioModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    fetch(`${API_BASE}/strategy/list`)
      .then((r) => r.json())
      .then((data) => setStrategies(data.strategies || []))
      .catch(() => setStrategies([]));
  }, [isOpen]);

  const filtered = strategies.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleStrategy = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError("Portfolio name is required"); return; }
    if (selectedIds.length === 0) { setError("Select at least one strategy"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/portfolio/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), strategy_ids: selectedIds }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.detail || "Failed to create portfolio");
        setLoading(false);
        return;
      }
      setName("");
      setSelectedIds([]);
      setSearch("");
      onCreated();
      onClose();
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  const handleClose = () => {
    setName("");
    setSelectedIds([]);
    setSearch("");
    setError("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-lg w-full">
      <div className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">
          Create New Portfolio
        </h2>

        {/* Portfolio Name */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-600">
            Portfolio Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter portfolio name"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#465fff] focus:outline-none focus:ring-1 focus:ring-[#465fff]"
          />
        </div>

        {/* Strategy search */}
        <div className="mb-2">
          <label className="mb-1 block text-sm font-medium text-gray-600">
            Select Strategies
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search strategies..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#465fff] focus:outline-none focus:ring-1 focus:ring-[#465fff]"
          />
        </div>

        {/* Strategy list */}
        <div className="mb-4 max-h-52 overflow-y-auto rounded-md border border-gray-200">
          {filtered.length === 0 ? (
            <p className="p-3 text-sm text-gray-400">No strategies found</p>
          ) : (
            filtered.map((s) => (
              <label
                key={s._id}
                className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 last:border-0"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(s._id)}
                  onChange={() => toggleStrategy(s._id)}
                  className="h-4 w-4 rounded border-gray-300 text-[#465fff] accent-[#465fff]"
                />
                {s.name}
              </label>
            ))
          )}
        </div>

        {selectedIds.length > 0 && (
          <p className="mb-3 text-xs text-gray-500">
            {selectedIds.length} strategy selected
          </p>
        )}

        {error && (
          <p className="mb-3 text-xs text-red-500">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-md bg-[#465fff] px-4 py-2 text-sm font-medium text-white hover:bg-[#3451e8] disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create Portfolio"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Portfolios() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [filtered, setFiltered] = useState<Portfolio[]>([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchPortfolios = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/portfolio/list`);
      const data = await res.json();
      const list: Portfolio[] = data.portfolios || [];
      setPortfolios(list);
      setFiltered(list);
    } catch {
      setPortfolios([]);
      setFiltered([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchPortfolios(); }, []);

  useEffect(() => {
    const q = searchText.toLowerCase();
    setFiltered(
      q ? portfolios.filter((p) => p.name.toLowerCase().includes(q)) : portfolios
    );
  }, [searchText, portfolios]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this portfolio?")) return;
    try {
      await fetch(`${API_BASE}/portfolio/${id}`, { method: "DELETE" });
      fetchPortfolios();
    } catch {
      alert("Failed to delete portfolio");
    }
  };

  return (
    <>
      <PageMeta title="Portfolios | Algo Admin" description="Manage your portfolios" />

      <div className="min-h-screen bg-gray-50 p-4">
        {/* Top bar */}
        <div className="mb-4 flex items-center justify-between bg-white px-4 py-3 shadow-sm rounded-md">
          {/* Search */}
          <div className="relative w-full max-w-[350px] overflow-hidden rounded-md border border-gray-300">
            <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                strokeWidth="1.5" stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search Portfolio"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full border-0 py-2.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-0"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 whitespace-nowrap">
            {/* Import button */}
            <button
              type="button"
              className="flex items-center gap-2 rounded border border-[#465fff] px-3 py-2 text-xs font-medium text-[#465fff] hover:bg-blue-50 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                strokeWidth="1.5" stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0 3-3m-3 3V2.25" />
              </svg>
              <span>Import .algtst</span>
            </button>

            {/* Create button */}
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 rounded bg-[#465fff] px-3 py-2 text-xs font-medium text-white hover:bg-[#3451e8] transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                strokeWidth="2" stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Create new portfolio
            </button>
          </div>
        </div>

        {/* Portfolio grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#465fff] border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
              strokeWidth="1.5" stroke="currentColor" className="mb-3 h-12 w-12 text-gray-300">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
            <p className="text-sm">
              {searchText ? "No portfolios match your search" : "No portfolios yet. Create one!"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p, i) => (
              <PortfolioCard key={p._id} portfolio={p} index={i} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      <CreatePortfolioModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={fetchPortfolios}
      />
    </>
  );
}
