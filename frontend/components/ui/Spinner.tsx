import { clsx } from 'clsx'

/**
 * Inline loading spinner for buttons and small async regions.
 * Spins via Tailwind's animate-spin; respects prefers-reduced-motion.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={clsx('h-4 w-4 animate-spin motion-reduce:animate-none', className)}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        className="opacity-90"
      />
    </svg>
  )
}
