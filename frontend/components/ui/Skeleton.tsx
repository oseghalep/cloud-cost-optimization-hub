import { clsx } from 'clsx'

/**
 * Base skeleton placeholder.
 *
 * A light sweep travels across the tinted base while content loads. Under
 * prefers-reduced-motion the sweep is hidden and the static tint remains, so
 * the placeholder still reads as "loading" without animation.
 *
 * `delayMs` staggers the sweep so a row of skeletons ripples instead of
 * flashing in unison.
 */
export function Skeleton({ className, delayMs = 0 }: { className?: string; delayMs?: number }) {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        'relative overflow-hidden rounded bg-slate-200 dark:bg-slate-800',
        className
      )}
    >
      <div
        style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
        className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent motion-reduce:hidden dark:via-white/10"
      />
    </div>
  )
}

/**
 * Skeleton for a dashboard stat card.
 *
 * Mirrors the real card exactly: a 36px icon chip beside the label on the first
 * row, then the value. The chip placeholder matters - without it the skeleton
 * is ~20px shorter than the loaded card and everything below it jumps.
 */
export function StatCardSkeleton({ delayMs = 0 }: { delayMs?: number }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 dark:shadow-none dark:hover:border-slate-700">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="h-9 w-9 shrink-0 rounded-lg" delayMs={delayMs} />
        <Skeleton className="h-4 w-24" delayMs={delayMs} />
      </div>
      <Skeleton className="h-9 w-32" delayMs={delayMs} />
    </div>
  )
}

// Fixed silhouette so server and client render identically (no Math.random).
const BAR_HEIGHTS = [
  'h-[35%]', 'h-[55%]', 'h-[45%]', 'h-[70%]', 'h-[60%]', 'h-[85%]',
  'h-[50%]', 'h-[75%]', 'h-[40%]', 'h-[65%]', 'h-[80%]', 'h-[55%]',
]

/**
 * Skeleton for a dashboard chart panel.
 *
 * Suggests the shape of what's coming - a plotted series or a donut - rather
 * than a flat grey block, so the loading state reads as "a chart is arriving".
 */
export function ChartSkeleton({ variant = 'bars' }: { variant?: 'bars' | 'donut' }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 dark:shadow-none dark:hover:border-slate-700">
      <Skeleton className="h-5 w-40 mb-4" />

      {variant === 'donut' ? (
        <div className="flex h-80 items-center justify-center">
          <div className="relative h-48 w-48">
            <Skeleton className="h-48 w-48 rounded-full" />
            {/* Punches the ring's hole using the card's own background. */}
            <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white dark:bg-slate-900" />
          </div>
        </div>
      ) : (
        <div className="flex h-80 items-end gap-1.5 border-b border-l border-slate-200 pb-2 pl-2 dark:border-slate-800">
          {BAR_HEIGHTS.map((h, i) => (
            <Skeleton key={i} className={`flex-1 ${h}`} delayMs={i * 40} />
          ))}
        </div>
      )}
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

/** Skeleton card for a connected cloud account on the Accounts page. */
export function AccountCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div>
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-7 w-20 rounded-lg" />
      </div>
    </div>
  )
}
