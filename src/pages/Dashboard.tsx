import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { useNavigate } from "react-router-dom";
import { Camera, TrendingUp } from "lucide-react";
import { DashboardSkeleton } from "../components/Skeleton";
import PageTransition from "../components/PageTransition";
import EmptyState from "../components/EmptyState";
import Button from "../components/Button";

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

  if (!categories || !budgets || !receipts) {
    return <DashboardSkeleton />;
  }

  const spending = new Map<string, number>();
  let totalSpent = 0;

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

  const totalBudget = budgets.reduce((sum, b) => sum + b.limitAmount, 0);

  function getBarColor(ratio: number) {
    if (ratio >= 0.8) return "bg-red-500";
    if (ratio >= 0.6) return "bg-yellow-500";
    return "bg-green-500";
  }

  return (
    <PageTransition>
      <div className="p-4 pb-6">
        <h1 className="text-2xl font-bold mb-4">Bu Ay</h1>

        <div className="bg-slate-800 rounded-xl p-4 mb-6">
          <p className="text-slate-400 text-sm">Toplam Harcama</p>
          <p className="text-3xl font-bold tabular-nums">
            €{totalSpent.toFixed(2)}
          </p>
          {totalBudget > 0 && (
            <p className="text-slate-400 text-xs mt-1">
              Toplam bütçe: €{totalBudget.toFixed(2)}
            </p>
          )}
        </div>

        {totalSpent === 0 && receipts.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="Henüz harcama yok"
            description="İlk fişinizi tarayarak başlayın"
            action={
              <Button
                onClick={() => navigate("/scan")}
                icon={<Camera className="w-5 h-5" />}
                className="mt-2 w-auto px-6"
              >
                Fiş Tara
              </Button>
            }
          />
        ) : (
          <>
            <div className="space-y-3 mb-6">
              {categories.map((cat) => {
                const spent = spending.get(cat.id) || 0;
                const budget = budgets.find((b) => b.categoryId === cat.id);
                const limit = budget?.limitAmount || 0;
                const ratio = limit > 0 ? spent / limit : 0;
                const pct = Math.min(ratio * 100, 100);

                return (
                  <div key={cat.id} className="bg-slate-800 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">
                        {cat.icon} {cat.name}
                      </span>
                      <span className={`text-sm tabular-nums ${ratio >= 0.8 ? "text-red-400 font-bold" : ""}`}>
                        €{spent.toFixed(2)}
                        {limit > 0 ? ` / €${limit.toFixed(2)}` : ""}
                      </span>
                    </div>
                    {limit > 0 && (
                      <div className="relative">
                        <div className="w-full bg-slate-700 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full transition-all duration-500 ${getBarColor(ratio)}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="absolute right-0 -top-5 text-[10px] text-slate-400 tabular-nums">
                          %{pct.toFixed(0)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <Button
              onClick={() => navigate("/scan")}
              icon={<Camera className="w-5 h-5" />}
            >
              Fiş Tara
            </Button>
          </>
        )}
      </div>
    </PageTransition>
  );
}
