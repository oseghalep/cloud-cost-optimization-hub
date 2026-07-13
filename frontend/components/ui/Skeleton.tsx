import { clsx } from 'clsx'

/**
 * Base skeleton placeholder. Pulses while content loads; respects
 * prefers-reduced-motion (motion-reduce:animate-none).
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        'animate-pulse rounded bg-slate-200 dark:bg-slate-700/50 motion-reduce:animate-none',
        className
      )}
    />
  )
}

/** Skeleton for a dashboard stat card. Matches the real card's footprint. */
export function StatCardSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 dark:shadow-none dark:hover:border-slate-700">
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-9 w-32" />
    </div>
  )
}

/** Skeleton for a dashboard chart panel (line or pie). */
export function ChartSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 dark:shadow-none dark:hover:border-slate-700">
      <Skeleton className="h-5 w-40 mb-4" />
      <Skeleton className="h-80 w-full" />
    </div>
  )
}

/** Compact skeleton row for the dashboard "Top Recommendations" list. */
export function RecRowSkeleton() {
  return (
    <div className="px-6 py-4 flex items-center justify-between">
      <div className="flex-1">
        <Skeleton className="h-5 w-2/3 mb-2" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-5 w-20" />
    </div>
  )
}

/** Full recommendation card skeleton for the Recommendations page. */
export function RecCardSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 dark:shadow-none dark:hover:border-slate-700 p-6">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-16" />
      </div>
      <Skeleton className="h-6 w-1/2 mb-3" />
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-3/4 mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Skeleton row for a connected cloud account on the Accounts page. */
export function AccountRowSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 dark:shadow-none dark:hover:border-slate-700 p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-14" />
        <div>
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <Skeleton className="h-6 w-16" />
    </div>
  )
}
