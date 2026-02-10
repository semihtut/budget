import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const categories = useLiveQuery(() => db.categories.toArray());
  const budgets = useLiveQuery(
    () => db.budgets.where("[month+categoryId]").between([currentMonth], [currentMonth + "\uffff"]).toArray(),
    [currentMonth],
  );
  const receipts = useLiveQuery(() => db.receipts.toArray());

  const spending = new Map<string, number>();
  let totalSpent = 0;

  if (receipts) {
    for (const r of receipts) {
      const month = r.receiptDate?.slice(0, 7) || r.createdAt.slice(0, 7);
      if (month === currentMonth) {
        for (const item of r.items) {
          const prev = spending.get(item.categoryId) || 0;
          spending.set(item.categoryId, prev + item.lineTotal);
          totalSpent += item.lineTotal;
        }
      }
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Bu Ay</h1>

      <div className="bg-slate-800 rounded-xl p-4 mb-6">
        <p className="text-slate-400 text-sm">Toplam Harcama</p>
        <p className="text-3xl font-bold">
          ₺{totalSpent.toFixed(2)}
        </p>
      </div>

      <div className="space-y-3">
        {categories?.map((cat) => {
          const spent = spending.get(cat.id) || 0;
          const budget = budgets?.find((b) => b.categoryId === cat.id);
          const limit = budget?.limitAmount || 0;
          const threshold = budget?.alertThreshold ?? 0.8;
          const ratio = limit > 0 ? spent / limit : 0;
          const isWarning = limit > 0 && ratio >= threshold;

          return (
            <div key={cat.id} className="bg-slate-800 rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span>
                  {cat.icon} {cat.name}
                </span>
                <span className={isWarning ? "text-red-400 font-bold" : ""}>
                  ₺{spent.toFixed(2)}
                  {limit > 0 ? ` / ₺${limit.toFixed(2)}` : ""}
                </span>
              </div>
              {limit > 0 && (
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${isWarning ? "bg-red-500" : "bg-blue-500"}`}
                    style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => navigate("/scan")}
        className="w-full mt-6 bg-blue-500 active:bg-blue-600 text-white rounded-xl py-4 text-lg font-semibold"
      >
        📷 Fiş Tara
      </button>
    </div>
  );
}
