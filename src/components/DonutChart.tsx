interface Segment {
  label: string;
  value: number;
  color: string;
  icon?: string;
}

interface DonutChartProps {
  segments: Segment[];
  total: number;
  currency?: string;
  size?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  market: "#3b82f6",
  food: "#f59e0b",
  transport: "#10b981",
  health: "#ef4444",
  entertainment: "#8b5cf6",
  subscriptions: "#d946ef",
  bills: "#06b6d4",
  other: "#6b7280",
};

export function getCategoryColor(categoryId: string): string {
  return CATEGORY_COLORS[categoryId] || "#6b7280";
}

export default function DonutChart({
  segments,
  total,
  currency = "€",
  size = 200,
}: DonutChartProps) {
  const strokeWidth = 28;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const activeSegments = segments.filter((s) => s.value > 0);

  let cumulativeOffset = 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background ring */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#334155"
            strokeWidth={strokeWidth}
          />

          {activeSegments.length === 0 ? (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="#475569"
              strokeWidth={strokeWidth}
              strokeDasharray={`${circumference} ${circumference}`}
            />
          ) : (
            activeSegments.map((seg) => {
              const ratio = total > 0 ? seg.value / total : 0;
              const segLength = ratio * circumference;
              const gap = activeSegments.length > 1 ? 4 : 0;
              const offset = cumulativeOffset;
              cumulativeOffset += segLength + gap;

              return (
                <circle
                  key={seg.label}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${Math.max(segLength - gap, 0)} ${circumference}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              );
            })
          )}
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-slate-400">Toplam</span>
          <span className="text-2xl font-bold tabular-nums">
            {currency}{total.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Legend */}
      {activeSegments.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-4 w-full max-w-[280px]">
          {activeSegments.map((seg) => (
            <div key={seg.label} className="flex items-center gap-2 text-xs">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <span className="text-slate-300 truncate">{seg.icon} {seg.label}</span>
              <span className="text-slate-400 tabular-nums ml-auto">
                {currency}{seg.value.toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
