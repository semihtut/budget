export function SkeletonLine({ width = "100%", height = "h-4" }: { width?: string; height?: string }) {
  return (
    <div
      className={`${height} bg-slate-700 rounded animate-pulse`}
      style={{ width }}
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={`${80 - i * 15}%`} />
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <SkeletonLine width="30%" height="h-8" />
      <div className="bg-slate-800 rounded-xl p-4 space-y-2">
        <SkeletonLine width="40%" height="h-4" />
        <SkeletonLine width="50%" height="h-10" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex justify-between">
            <SkeletonLine width="30%" />
            <SkeletonLine width="25%" />
          </div>
          <SkeletonLine width="100%" height="h-2" />
        </div>
      ))}
    </div>
  );
}

export function ReviewSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <SkeletonLine width="40%" height="h-8" />
      <div className="bg-slate-800 rounded-xl p-4 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonLine key={i} width={`${70 - i * 8}%`} />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonCard key={i} lines={2} />
      ))}
      <SkeletonLine width="100%" height="h-14" />
    </div>
  );
}

export function HistorySkeleton() {
  return (
    <div className="p-4 space-y-4">
      <SkeletonLine width="30%" height="h-8" />
      <SkeletonLine width="100%" height="h-10" />
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonCard key={i} lines={2} />
      ))}
    </div>
  );
}
