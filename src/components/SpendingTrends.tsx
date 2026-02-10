import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TrendItem {
  categoryId: string;
  name: string;
  icon?: string;
  current: number;
  previous: number;
}

interface SpendingTrendsProps {
  trends: TrendItem[];
  currency?: string;
}

export default function SpendingTrends({ trends, currency = "€" }: SpendingTrendsProps) {
  const sorted = [...trends]
    .filter((t) => t.current > 0 || t.previous > 0)
    .sort((a, b) => {
      const diffA = a.current - a.previous;
      const diffB = b.current - b.previous;
      return Math.abs(diffB) - Math.abs(diffA);
    });

  if (sorted.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Geçen Aya Göre
      </h2>
      <div className="space-y-2">
        {sorted.map((item) => {
          const diff = item.current - item.previous;
          const pctChange = item.previous > 0
            ? ((diff / item.previous) * 100)
            : item.current > 0 ? 100 : 0;

          const isUp = diff > 0;
          const isDown = diff < 0;
          const isNew = item.previous === 0 && item.current > 0;
          const isGone = item.previous > 0 && item.current === 0;

          return (
            <div
              key={item.categoryId}
              className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3"
            >
              <span className="text-lg shrink-0">{item.icon}</span>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-slate-400 tabular-nums">
                  {currency}{item.current.toFixed(2)}
                  {item.previous > 0 && (
                    <span className="text-slate-500"> ← {currency}{item.previous.toFixed(2)}</span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isNew ? (
                  <span className="text-xs font-medium text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">
                    Yeni
                  </span>
                ) : isGone ? (
                  <span className="text-xs font-medium text-slate-400 bg-slate-700 px-2 py-0.5 rounded-full">
                    —
                  </span>
                ) : isUp ? (
                  <div className="flex items-center gap-1 text-red-400">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs font-semibold tabular-nums">
                      +%{Math.abs(pctChange).toFixed(0)}
                    </span>
                  </div>
                ) : isDown ? (
                  <div className="flex items-center gap-1 text-green-400">
                    <TrendingDown className="w-4 h-4" />
                    <span className="text-xs font-semibold tabular-nums">
                      -%{Math.abs(pctChange).toFixed(0)}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-slate-400">
                    <Minus className="w-4 h-4" />
                    <span className="text-xs">Aynı</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
