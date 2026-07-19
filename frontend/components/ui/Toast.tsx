'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastData {
  id: string
  type: ToastType
  message: string
  /** Optional action, e.g. "Undo". */
  actionLabel?: string
  onAction?: () => void
  /** Auto-dismiss delay in ms. */
  duration?: number
}

const STYLES: Record<ToastType, { ring: string; icon: typeof CheckCircle2; iconClass: string }> = {
  success: {
    ring: 'ring-green-500/30',
    icon: CheckCircle2,
    iconClass: 'text-green-600 dark:text-green-400',
  },
  error: {
    ring: 'ring-red-500/30',
    icon: AlertCircle,
    iconClass: 'text-red-600 dark:text-red-400',
  },
  info: {
    ring: 'ring-blue-500/30',
    icon: Info,
    iconClass: 'text-blue-600 dark:text-blue-400',
  },
}

function Toast({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: string) => void }) {
  const style = STYLES[toast.type]
  const Icon = style.icon
  const duration = toast.duration ?? 4000

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), duration)
    return () => clearTimeout(timer)
  }, [toast.id, duration, onDismiss])

  return (
    <div
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl bg-white p-3 shadow-lg ring-1 ${style.ring} animate-fade-in dark:bg-slate-900`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.iconClass}`} aria-hidden="true" />
      <p className="flex-1 text-sm text-slate-900 dark:text-white">{toast.message}</p>

      {toast.actionLabel && toast.onAction && (
        <button
          type="button"
          onClick={() => {
            toast.onAction?.()
            onDismiss(toast.id)
          }}
          className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400 dark:hover:bg-blue-500/10"
        >
          {toast.actionLabel}
        </button>
      )}

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

interface ToastContextValue {
  /** Show a toast. Returns its id so it can be dismissed early. */
  toast: (t: Omit<ToastData, 'id'>) => string
  success: (message: string, opts?: Partial<Omit<ToastData, 'id' | 'type' | 'message'>>) => string
  error: (message: string, opts?: Partial<Omit<ToastData, 'id' | 'type' | 'message'>>) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

/**
 * App-wide toast host. Mounted once in the root layout so any page can fire a
 * toast without owning the state or rendering its own viewport.
 *
 * Toasts are for actions the user takes (POST/PATCH/PUT/DELETE). Data loading
 * (GET) is communicated with skeleton loaders instead.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([])
  const seq = useRef(0)

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((t: Omit<ToastData, 'id'>) => {
    const id = `toast-${(seq.current += 1)}`
    setToasts((prev) => [...prev, { ...t, id }])
    return id
  }, [])

  const success = useCallback(
    (message: string, opts?: Partial<Omit<ToastData, 'id' | 'type' | 'message'>>) =>
      toast({ type: 'success', message, ...opts }),
    [toast]
  )

  const error = useCallback(
    (message: string, opts?: Partial<Omit<ToastData, 'id' | 'type' | 'message'>>) =>
      // Failures get a little longer on screen than confirmations.
      toast({ type: 'error', message, duration: 6000, ...opts }),
    [toast]
  )

  return (
    <ToastContext.Provider value={{ toast, success, error, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}

/**
 * Fixed viewport for stacked toasts. Uses aria-live so screen readers announce
 * messages without stealing focus from whatever the user is doing.
 */
export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastData[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
    >
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
