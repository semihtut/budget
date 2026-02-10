import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Receipt, Search, ArrowUpDown, Trash2 } from "lucide-react";
import { HistorySkeleton } from "../components/Skeleton";
import PageTransition from "../components/PageTransition";
import EmptyState from "../components/EmptyState";
import Button from "../components/Button";

type SortMode = "newest" | "oldest" | "highest" | "lowest";

export default function History() {
  const navigate = useNavigate();
  const receipts = useLiveQuery(() =>
    db.receipts.orderBy("createdAt").reverse().toArray(),
  );
  const categories = useLiveQuery(() => db.categories.toArray());
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (!receipts || !categories) {
    return <HistorySkeleton />;
  }

  let filtered = receipts.filter((r) => {
    if (filterCat !== "all" && !r.items.some((i) => i.categoryId === filterCat)) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = r.merchantName?.toLowerCase().includes(q);
      const matchItem = r.items.some((i) => i.name.toLowerCase().includes(q));
      if (!matchName && !matchItem) return false;
    }
    return true;
  });

  filtered = [...filtered].sort((a, b) => {
    switch (sortMode) {
      case "oldest":
        return a.createdAt.localeCompare(b.createdAt);
      case "highest":
        return (b.total || 0) - (a.total || 0);
      case "lowest":
        return (a.total || 0) - (b.total || 0);
      default:
        return b.createdAt.localeCompare(a.createdAt);
    }
  });

  async function handleDelete(id: string) {
    await db.receipts.delete(id);
    setDeleteId(null);
  }

  return (
    <PageTransition>
      <div className="p-4 pb-6">
        <h1 className="text-2xl font-bold mb-4">Geçmiş</h1>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Mağaza veya ürün ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-500
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          />
        </div>

        <div className="flex gap-2 mb-4">
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="flex-1 bg-slate-800 rounded-lg px-3 py-2 text-sm text-white
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <option value="all">Tüm Kategoriler</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              const modes: SortMode[] = ["newest", "oldest", "highest", "lowest"];
              const next = modes[(modes.indexOf(sortMode) + 1) % modes.length];
              setSortMode(next);
            }}
            className="bg-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 flex items-center gap-1.5
              active:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            title={`Sırala: ${sortMode}`}
          >
            <ArrowUpDown className="w-4 h-4" />
            <span className="text-xs">
              {sortMode === "newest" && "Yeni"}
              {sortMode === "oldest" && "Eski"}
              {sortMode === "highest" && "Pahalı"}
              {sortMode === "lowest" && "Ucuz"}
            </span>
          </button>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Fiş bulunamadı"
            description={search || filterCat !== "all" ? "Filtrelerinizi değiştirmeyi deneyin" : "İlk fişinizi tarayarak başlayın"}
            action={
              !search && filterCat === "all" ? (
                <Button
                  onClick={() => navigate("/scan")}
                  className="mt-2 w-auto px-6"
                >
                  Fiş Tara
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <div key={r.id} className="relative">
                <button
                  onClick={() => navigate(`/review/${r.id}`)}
                  className="w-full bg-slate-800 rounded-xl p-4 text-left active:bg-slate-750 transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">
                      {r.merchantName || "Bilinmeyen"}
                    </span>
                    <span className="text-sm tabular-nums">
                      {r.total != null ? `€${r.total.toFixed(2)}` : "—"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {r.receiptDate || r.createdAt.slice(0, 10)} · {r.items.length}{" "}
                    kalem
                  </p>
                </button>

                {deleteId === r.id ? (
                  <div className="absolute inset-0 bg-slate-800/95 rounded-xl flex items-center justify-center gap-3 p-4">
                    <p className="text-sm text-red-300">Silinsin mi?</p>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="bg-red-500 text-white text-sm rounded-lg px-3 py-1.5 active:bg-red-600"
                    >
                      Evet
                    </button>
                    <button
                      onClick={() => setDeleteId(null)}
                      className="bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 active:bg-slate-600"
                    >
                      İptal
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteId(r.id)}
                    className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-500 active:text-red-400
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                    aria-label="Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
