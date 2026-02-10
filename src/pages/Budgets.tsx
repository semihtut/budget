import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import PageTransition from "../components/PageTransition";
import Button from "../components/Button";

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
  const [saving, setSaving] = useState(false);
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
    setSaving(true);

    try {
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
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const totalBudget = Object.values(limits).reduce((s, v) => {
    const n = parseFloat(v);
    return s + (isNaN(n) ? 0 : n);
  }, 0);

  return (
    <PageTransition>
      <div className="p-4 pb-6">
        <h1 className="text-2xl font-bold mb-1">Aylık Bütçe</h1>
        <div className="flex items-center justify-between mb-4">
          <p className="text-slate-400 text-sm">{currentMonth}</p>
          {totalBudget > 0 && (
            <p className="text-slate-400 text-sm tabular-nums">
              Toplam: €{totalBudget.toFixed(2)}
            </p>
          )}
        </div>

        <div className="space-y-3 mb-6">
          {categories?.map((cat) => (
            <div key={cat.id} className="bg-slate-800 rounded-xl p-4">
              <label
                htmlFor={`budget-${cat.id}`}
                className="block text-sm text-slate-300 mb-2 font-medium"
              >
                {cat.icon} {cat.name}
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-300 text-lg">€</span>
                <input
                  id={`budget-${cat.id}`}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="0.00"
                  value={limits[cat.id] || ""}
                  onChange={(e) => {
                    setLimits((p) => ({ ...p, [cat.id]: e.target.value }));
                    setSaved(false);
                  }}
                  className="flex-1 bg-slate-700 rounded-lg px-3 py-2.5 text-white tabular-nums
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
                    placeholder:text-slate-500"
                />
              </div>
            </div>
          ))}
        </div>

        <Button
          variant={saved ? "success" : "primary"}
          onClick={save}
          loading={saving}
          disabled={saved}
          icon={saved ? <Check className="w-5 h-5" /> : undefined}
        >
          {saved ? "Kaydedildi" : "Kaydet"}
        </Button>
      </div>
    </PageTransition>
  );
}
