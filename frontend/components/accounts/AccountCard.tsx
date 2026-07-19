'use client'

import { useState } from 'react'
import { RefreshCw, Trash2, Copy, Check } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ProviderIcon } from '@/components/accounts/ProviderIcon'
import { useToast } from '@/components/ui/Toast'

export interface AccountCardData {
  id: string
  provider: string
  name: string
  account_id: string
  status: string
  last_sync_at: string | null
}

const PROVIDERS: Record<
  string,
  { label: string; chip: string; ring: string; glow: string }
> = {
  aws: {
    label: 'AWS',
    chip: 'from-orange-500/25 to-orange-500/5 text-orange-700 dark:text-orange-400',
    ring: 'ring-orange-500/30',
    glow: 'bg-orange-500',
  },
  gcp: {
    label: 'Google Cloud',
    chip: 'from-blue-500/25 to-blue-500/5 text-blue-700 dark:text-blue-400',
    ring: 'ring-blue-500/30',
    glow: 'bg-blue-500',
  },
  azure: {
    label: 'Azure',
    chip: 'from-cyan-500/25 to-cyan-500/5 text-cyan-700 dark:text-cyan-400',
    ring: 'ring-cyan-500/30',
    glow: 'bg-cyan-500',
  },
}

const FALLBACK = {
  label: 'Cloud',
  chip: 'from-slate-500/25 to-slate-500/5 text-slate-700 dark:text-slate-300',
  ring: 'ring-slate-500/30',
  glow: 'bg-slate-500',
}

/**
 * Maps a raw status string to a display label and tone.
 * Only real failure states go red; in-progress/unknown states stay neutral
 * so a "pending" account doesn't look broken.
 */
function statusTone(raw: string | null | undefined): {
  label: string
  dot: string
  pill: string
} {
  const value = (raw ?? '').toLowerCase()
  const label = value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Unknown'

  if (value === 'active') {
    return {
      label,
      dot: 'bg-green-500',
      pill: 'bg-green-500/15 text-green-700 dark:text-green-400',
    }
  }
  if (value === 'error' || value === 'inactive' || value === 'disabled') {
    return {
      label,
      dot: 'bg-red-500',
      pill: 'bg-red-500/15 text-red-700 dark:text-red-400',
    }
  }
  // pending / syncing / connecting / unknown
  return {
    label,
    dot: 'bg-amber-500',
    pill: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  }
}

function formatLastSync(value: string | null): string {
  if (!value) return 'Never synced'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return `Synced ${formatDistanceToNow(date, { addSuffix: true })}`
}

export function AccountCard({
  account,
  refreshing,
  onRefresh,
  deleting,
  onDelete,
}: {
  account: AccountCardData
  refreshing: boolean
  onRefresh: (id: string) => void
  deleting: boolean
  onDelete: (id: string) => void
}) {
  // Inline delete confirmation lives on the card itself, so you always
  // confirm against the account you are actually looking at.
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // Copy the account ID: the icon flips to a tick for immediate feedback and a
  // toast confirms it, so the action is obvious either way.
  const { success, error } = useToast()
  const [copiedId, setCopiedId] = useState(false)

  const copyAccountId = async () => {
    if (!account.account_id) return
    try {
      await navigator.clipboard.writeText(account.account_id)
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
      success(`Account ID ${account.account_id} copied`)
    } catch {
      // Clipboard needs a secure context and user permission.
      error('Could not copy. Your browser blocked clipboard access.')
    }
  }
  // Normalize so casing/alias drift from the backend doesn't silently fall back.
  const provider = PROVIDERS[(account.provider ?? '').toLowerCase()] ?? FALLBACK
  const status = statusTone(account.status)

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-slate-300 dark:border-white/10 dark:bg-slate-900/60 dark:hover:border-white/20 motion-reduce:transform-none motion-reduce:transition-none">
      {/* Ambient brand glow */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-20 blur-3xl ${provider.glow}`}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ${provider.chip} ${provider.ring}`}
          >
            <ProviderIcon provider={account.provider} className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p
              title={account.name}
              className="truncate font-semibold text-slate-900 dark:text-white"
            >
              {account.name}
            </p>
            <div className="flex min-w-0 items-center gap-1">
              <p
                title={account.account_id ? `${provider.label} · ${account.account_id}` : provider.label}
                className="truncate text-xs text-slate-500 dark:text-slate-400"
              >
                {provider.label}
                {account.account_id ? ` · ${account.account_id}` : ''}
              </p>
              {account.account_id && (
                <button
                  type="button"
                  onClick={copyAccountId}
                  aria-label={
                    copiedId ? 'Account ID copied' : `Copy account ID ${account.account_id}`
                  }
                  title="Copy account ID"
                  // Icon stays small, but the negative margin lets the button
                  // carry a full 44x44 hit area without bloating the meta row.
                  className="-m-2.5 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 transition-colors hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-slate-200"
                >
                  {copiedId ? (
                    <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.pill}`}
        >
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </div>

      <div className="relative mt-4 border-t border-slate-200/70 pt-3 dark:border-white/10">
        {confirmingDelete ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-900 dark:text-white">
              Delete this account?
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onDelete(account.id)}
                disabled={deleting}
                aria-label={`Confirm delete ${account.name}`}
                className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting && (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                )}
                {deleting ? 'Deleting' : 'Delete'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p
              title={account.last_sync_at ? new Date(account.last_sync_at).toLocaleString() : undefined}
              className="truncate text-xs text-slate-500 dark:text-slate-400"
            >
              {formatLastSync(account.last_sync_at)}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => onRefresh(account.id)}
                disabled={refreshing}
                aria-label={refreshing ? `Refreshing ${account.name}` : `Refresh ${account.name}`}
                className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin motion-reduce:animate-none' : ''}`}
                />
                {refreshing ? 'Refreshing' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                aria-label={`Delete ${account.name}`}
                title="Delete account"
                className="inline-flex min-h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-300 text-slate-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-slate-700 dark:text-slate-400 dark:hover:border-red-500/40 dark:hover:bg-red-500/10 dark:hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
