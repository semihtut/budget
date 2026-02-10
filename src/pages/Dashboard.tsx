import { useLiveQuery } from "dexie-react-hooks";
import { db, type BillingCycle } from "../db";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { Camera, TrendingUp, CalendarClock } from "lucide-react";
import { DashboardSkeleton } from "../components/Skeleton";
import PageTransition from "../components/PageTransition";
import EmptyState from "../components/EmptyState";
import Button from "../components/Button";
import DonutChart, { getCategoryColor } from "../components/DonutChart";
import SpendingTrends from "../components/SpendingTrends";

function getPrevMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthlyAmount(amount: number, cycle: BillingCycle) {
  return cycle === "yearly" ? amount / 12 : amount;
}

export default function Dashboard() {
  const navigate = useNavigate();

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevMonth = getPrevMonth(currentMonth);

  const categories = useLiveQuery(() => db.categories.toArray());
  const budgets = useLiveQuery(
    () => db.budgets.where("[month+categoryId]").between([currentMonth], [currentMonth + "\uffff"]).toArray(),
    [currentMonth],
  );
  const receipts = useLiveQuery(() => db.receipts.toArray());
  const subscriptions = useLiveQuery(() =>
    db.subscriptions.where("isActive").equals(1).toArray(),
  );

  const { spending, prevSpending, totalSpent, subsTotal, subsSpending } = useMemo(() => {
    const spending = new Map<string, number>();
    const prevSpending = new Map<string, number>();
    const subsSpending = new Map<string, number>();
    let totalSpent = 0;
    let subsTotal = 0;

    if (receipts) {
      for (const r of receipts) {
        const month = r.receiptDate?.slice(0, 7) || r.createdAt.slice(0, 7);
        if (month === currentMonth) {
          for (const item of r.items) {
            spending.set(item.categoryId, (spending.get(item.categoryId) || 0) + item.lineTotal);
            totalSpent += item.lineTotal;
          }
        } else if (month === prevMonth) {
          for (const item of r.items) {
            prevSpending.set(item.categoryId, (prevSpending.get(item.categoryId) || 0) + item.lineTotal);
          }
        }
      }
    }

    if (subscriptions) {
      for (const sub of subscriptions) {
        const monthly = getMonthlyAmount(sub.amount, sub.cycle);
        subsSpending.set(sub.categoryId, (subsSpending.get(sub.categoryId) || 0) + monthly);
        spending.set(sub.categoryId, (spending.get(sub.categoryId) || 0) + monthly);
        totalSpent += monthly;
        subsTotal += monthly;
      }
    }

    return { spending, prevSpending, totalSpent, subsTotal, subsSpending };
  }, [receipts, subscriptions, currentMonth, prevMonth]);

  if (!categories || !budgets || !receipts || !subscriptions) {
    return <DashboardSkeleton />;
  }

  const totalBudget = budgets.reduce((sum, b) => sum + b.limitAmount, 0);

  const donutSegments = categories
    .map((cat) => ({
      label: cat.name,
      value: spending.get(cat.id) || 0,
      color: getCategoryColor(cat.id),
      icon: cat.icon,
    }))
    .filter((s) => s.value > 0);

  const trends = categories.map((cat) => ({
    categoryId: cat.id,
    name: cat.name,
    icon: cat.icon,
    current: spending.get(cat.id) || 0,
    previous: prevSpending.get(cat.id) || 0,
  }));

  function getBarColor(ratio: number) {
    if (ratio >= 0.8) return "bg-red-500";
    if (ratio >= 0.6) return "bg-yellow-500";
    return "bg-green-500";
  }

  const monthLabel = new Date(now.getFullYear(), now.getMonth()).toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric",
  });

  const hasData = totalSpent > 0 || receipts.length > 0 || subscriptions.length > 0;

  return (
    <PageTransition>
      <div className="p-4 pb-6">
        <h1 className="text-2xl font-bold mb-1">Bu Ay</h1>
        <p className="text-slate-400 text-sm mb-4 capitalize">{monthLabel}</p>

        {!hasData ? (
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
            {/* Donut Chart */}
            <div className="bg-slate-800 rounded-xl p-5 mb-5">
              <DonutChart segments={donutSegments} total={totalSpent} />
              {totalBudget > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-700">
                  <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                    <span>Bütçe kullanımı</span>
                    <span className="tabular-nums">
                      €{totalSpent.toFixed(2)} / €{totalBudget.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-700 ${getBarColor(totalBudget > 0 ? totalSpent / totalBudget : 0)}`}
                      style={{ width: `${Math.min((totalSpent / totalBudget) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Fixed Costs Summary */}
            {subsTotal > 0 && (
              <button
                onClick={() => navigate("/subscriptions")}
                className="w-full bg-slate-800 rounded-xl p-4 mb-5 flex items-center gap-3 text-left
                  active:bg-slate-750 transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                  <CalendarClock className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Sabit Giderler</p>
                  <p className="text-xs text-slate-400">
                    {subscriptions.length} aktif gider
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums">€{subsTotal.toFixed(2)}/ay</p>
              </button>
            )}

            {/* Category Budget Breakdown */}
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Kategori Bütçeleri
            </h2>
            <div className="space-y-2.5 mb-5">
              {categories.map((cat) => {
                const spent = spending.get(cat.id) || 0;
                const subAmt = subsSpending.get(cat.id) || 0;
                const budget = budgets.find((b) => b.categoryId === cat.id);
                const limit = budget?.limitAmount || 0;
                const ratio = limit > 0 ? spent / limit : 0;
                const pct = Math.min(ratio * 100, 100);

                if (spent === 0 && limit === 0) return null;

                return (
                  <div key={cat.id} className="bg-slate-800 rounded-xl p-3.5">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm font-medium">
                        {cat.icon} {cat.name}
                      </span>
                      <span className={`text-sm tabular-nums ${ratio >= 0.8 ? "text-red-400 font-bold" : ""}`}>
                        €{spent.toFixed(2)}
                        {limit > 0 ? ` / €${limit.toFixed(2)}` : ""}
                      </span>
                    </div>
                    {subAmt > 0 && (
                      <p className="text-[10px] text-purple-400 mb-1">
                        abonelik: €{subAmt.toFixed(2)} dahil
                      </p>
                    )}
                    {limit > 0 && (
                      <div className="relative">
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${getBarColor(ratio)}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="absolute right-0 -top-4 text-[10px] text-slate-500 tabular-nums">
                          %{pct.toFixed(0)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Month-over-Month Trends */}
            <div className="mb-6">
              <SpendingTrends trends={trends} />
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
