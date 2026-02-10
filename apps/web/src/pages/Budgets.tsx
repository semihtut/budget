import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { useState, useEffect } from "react";

export default function Budgets() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const categories = useLiveQuery(() => db.categories.toArray());
  const budgets = useLiveQuery(
    () =>
      db.budgets
        .where("[month+categoryId]")
        .between([currentMonth], [currentMonth + "\uffff"])
        .toArray(),
    [currentMonth],
  );

  const [limits, setLimits] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (budgets && categories) {
      const map: Record<string, string> = {};
      for (const cat of categories) {
        const b = budgets.find((b) => b.categoryId === cat.id);
        map[cat.id] = b ? String(b.limitAmount) : "";
      }
      setLimits(map);
    }
  }, [budgets, categories]);

  async function save() {
    if (!categories) return;

    for (const cat of categories) {
      const val = parseFloat(limits[cat.id] || "0");
      const existing = budgets?.find((b) => b.categoryId === cat.id);

      if (isNaN(val) || val <= 0) {
        if (existing?.id) await db.budgets.delete(existing.id);
        continue;
      }

      if (existing) {
        await db.budgets.update(existing.id!, { limitAmount: val });
      } else {
        await db.budgets.add({
          month: currentMonth,
          categoryId: cat.id,
          limitAmount: val,
          alertThreshold: 0.8,
        });
      }
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-1">Aylık Bütçe</h1>
      <p className="text-slate-400 text-sm mb-4">{currentMonth}</p>

      <div className="space-y-3 mb-6">
        {categories?.map((cat) => (
          <div key={cat.id} className="bg-slate-800 rounded-xl p-4">
            <label className="block text-sm text-slate-400 mb-1">
              {cat.icon} {cat.name}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">₺</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="Limit"
                value={limits[cat.id] || ""}
                onChange={(e) => {
                  setLimits((p) => ({ ...p, [cat.id]: e.target.value }));
                  setSaved(false);
                }}
                className="flex-1 bg-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={save}
        disabled={saved}
        className="w-full bg-blue-500 active:bg-blue-600 disabled:bg-blue-800 text-white rounded-xl py-4 text-lg font-semibold"
      >
        {saved ? "Kaydedildi ✓" : "Kaydet"}
      </button>
    </div>
  );
}
