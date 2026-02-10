import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function History() {
  const navigate = useNavigate();
  const receipts = useLiveQuery(() =>
    db.receipts.orderBy("createdAt").reverse().toArray(),
  );
  const categories = useLiveQuery(() => db.categories.toArray());
  const [filterCat, setFilterCat] = useState("all");

  const filtered = receipts?.filter((r) => {
    if (filterCat === "all") return true;
    return r.items.some((i) => i.categoryId === filterCat);
  });

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Geçmiş</h1>

      <select
        value={filterCat}
        onChange={(e) => setFilterCat(e.target.value)}
        className="w-full bg-slate-800 rounded-lg px-3 py-2 mb-4 text-white"
      >
        <option value="all">Tüm Kategoriler</option>
        {categories?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.icon} {c.name}
          </option>
        ))}
      </select>

      {!filtered || filtered.length === 0 ? (
        <p className="text-slate-400 text-center py-8">Henüz fiş yok.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(`/review/${r.id}`)}
              className="w-full bg-slate-800 rounded-xl p-4 text-left"
            >
              <div className="flex justify-between items-center">
                <span className="font-medium">
                  {r.merchantName || "Bilinmeyen"}
                </span>
                <span>
                  {r.total != null ? `₺${r.total.toFixed(2)}` : "—"}
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                {r.receiptDate || r.createdAt.slice(0, 10)} · {r.items.length}{" "}
                kalem
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
