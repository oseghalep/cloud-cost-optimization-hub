'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '@/lib/api'
import { withMinDuration } from '@/lib/utils'
import { AccountCardSkeleton } from '@/components/ui/Skeleton'
import { AccountCard, type AccountCardData } from '@/components/accounts/AccountCard'
import { Spinner } from '@/components/ui/Spinner'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { Copy, Check, Plus, X, Search } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

// How long a deleted account can be undone before the API call actually fires.
const UNDO_WINDOW_MS = 5000

/**
 * Provider SDK errors are long and full of request IDs. Map the common causes
 * to something a person can act on, and fall back to a trimmed raw message.
 */
function friendlySyncError(detail: string): string {
  const d = detail || ''
  if (/UnrecognizedClientException|InvalidClientTokenId|security token.*invalid/i.test(d))
    return 'Invalid credentials. Check the Access Key ID and Secret Access Key.'
  if (/SignatureDoesNotMatch/i.test(d)) return 'Secret Access Key is incorrect.'
  if (/ExpiredToken|TokenRefreshRequired/i.test(d)) return 'Credentials have expired. Add a new key.'
  if (/AccessDenied|UnauthorizedOperation|not authorized|AccessDeniedException/i.test(d))
    return 'Access denied. The key needs ce:GetCostAndUsage permission.'
  if (/missing .*credential|missing Azure subscription|missing .*project/i.test(d))
    return 'Credentials are incomplete for this account.'
  if (/no such host|dial tcp|timeout|context deadline/i.test(d))
    return 'Could not reach the provider. Check your connection.'

  const cleaned = d.replace(/^Sync failed:\s*/i, '').split(',')[0].trim()
  return cleaned.length > 110 ? `${cleaned.slice(0, 110)}…` : cleaned || 'Sync failed.'
}

// Provider filter options for the accounts toolbar and summary chips.
const ACCOUNTS_PER_PAGE = 9

const PROVIDER_FILTERS: { value: string; label: string; chip: string }[] = [
  { value: 'all', label: 'All', chip: '' },
  { value: 'aws', label: 'AWS', chip: 'bg-orange-500/15 text-orange-700 dark:text-orange-400' },
  { value: 'gcp', label: 'GCP', chip: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  { value: 'azure', label: 'Azure', chip: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400' },
]

// IAM policy required for cost ingestion (display-only, copyable).
const AWS_IAM_POLICY = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ce:GetCostAndUsage",
        "ce:GetDimensionValues"
      ],
      "Resource": "*"
    }
  ]
}`

// AWS account form validation schema.
const awsSchema = z.object({
  name: z.string().min(1, 'Account name is required'),
  account_id: z.string().regex(/^\d{12}$/, 'Account ID must be exactly 12 digits'),
  access_key_id: z
    .string()
    .regex(/^AKIA[A-Z0-9]{16}$/, 'Must be "AKIA" followed by 16 uppercase letters/digits'),
  secret_access_key: z.string().min(20, 'Secret Access Key must be at least 20 characters'),
  region: z.string().min(1, 'Region is required'),
})
type AwsFormValues = z.infer<typeof awsSchema>

export default function AccountsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('aws')
  const [loading, setLoading] = useState(false)
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [error, setError] = useState('')
  const [existingAccounts, setExistingAccounts] = useState<AccountCardData[]>([])
  const [copiedPolicy, setCopiedPolicy] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  // Track every in-flight refresh by id so concurrent clicks don't clear each other.
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set())

  // Account list controls (search + provider filter) and the collapsible add panel.
  const [search, setSearch] = useState('')
  const [providerFilter, setProviderFilter] = useState('all')
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [page, setPage] = useState(1)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const addPanelRef = useRef<HTMLDivElement | null>(null)

  // Toasts come from the app-wide provider mounted in the root layout.
  const { toast: pushToast } = useToast()

  // Pending deletes: the row is hidden immediately but the API call only fires
  // once the undo window closes, which is what makes "Undo" actually possible.
  const pendingDeletes = useRef<Map<string, { timer: ReturnType<typeof setTimeout>; account: AccountCardData; index: number }>>(
    new Map()
  )

  const commitDelete = async (id: string) => {
    const pending = pendingDeletes.current.get(id)
    if (!pending) return
    pendingDeletes.current.delete(id)
    setDeletingId(id)
    try {
      await api.delete(`/accounts/${id}`)
    } catch {
      // Put it back if the server rejected the delete.
      if (mountedRef.current) {
        setExistingAccounts((prev) => {
          const next = [...prev]
          next.splice(Math.min(pending.index, next.length), 0, pending.account)
          return next
        })
        pushToast({ type: 'error', message: `Could not delete ${pending.account.name}. It has been restored.` })
      }
    } finally {
      if (mountedRef.current) setDeletingId(null)
    }
  }

  const handleDeleteAccount = (id: string) => {
    const index = existingAccounts.findIndex((a) => a.id === id)
    const account = existingAccounts[index]
    if (!account) return

    // Optimistically remove, then start the undo countdown.
    setExistingAccounts((prev) => prev.filter((a) => a.id !== id))
    const timer = setTimeout(() => commitDelete(id), UNDO_WINDOW_MS)
    pendingDeletes.current.set(id, { timer, account, index })

    pushToast({
      type: 'success',
      message: `${account.name} deleted`,
      actionLabel: 'Undo',
      duration: UNDO_WINDOW_MS,
      onAction: () => {
        const pending = pendingDeletes.current.get(id)
        if (!pending) return
        clearTimeout(pending.timer)
        pendingDeletes.current.delete(id)
        setExistingAccounts((prev) => {
          const next = [...prev]
          next.splice(Math.min(pending.index, next.length), 0, pending.account)
          return next
        })
      },
    })
  }

  // If the page unmounts with deletes still pending, fire them now so the
  // user's action isn't silently dropped.
  useEffect(() => {
    const pending = pendingDeletes.current
    return () => {
      pending.forEach(({ timer }, id) => {
        clearTimeout(timer)
        api.delete(`/accounts/${id}`).catch(() => {})
      })
      pending.clear()
    }
  }, [])

  const providerCounts = existingAccounts.reduce<Record<string, number>>((acc, a) => {
    const key = (a.provider ?? '').toLowerCase()
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const query = search.trim().toLowerCase()
  const filteredAccounts = existingAccounts.filter((a) => {
    const matchesProvider =
      providerFilter === 'all' || (a.provider ?? '').toLowerCase() === providerFilter
    const matchesQuery =
      !query ||
      (a.name ?? '').toLowerCase().includes(query) ||
      (a.account_id ?? '').toLowerCase().includes(query)
    return matchesProvider && matchesQuery
  })

  // Client-side pagination (the API returns every account in one response).
  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / ACCOUNTS_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const pagedAccounts = filteredAccounts.slice(
    (currentPage - 1) * ACCOUNTS_PER_PAGE,
    currentPage * ACCOUNTS_PER_PAGE
  )

  // Any change to the filters puts you back on page 1.
  useEffect(() => {
    setPage(1)
  }, [search, providerFilter])

  // Bring the add form into view when it opens, so it never opens off-screen.
  useEffect(() => {
    if (showAddPanel) {
      addPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [showAddPanel])

  // Guards against setting state after the page unmounts (e.g. sign out mid-refresh).
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // "Synced 3 hours ago" is computed at render time, so re-render every minute
  // to keep the relative timestamps honest on a long-lived tab.
  const [, setClockTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setClockTick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  // Triggers a real provider sync, then swaps in the updated account row.
  const handleRefreshAccount = async (id: string) => {
    const name = existingAccounts.find((a) => a.id === id)?.name ?? 'Account'
    setRefreshingIds((prev) => new Set(prev).add(id))
    setRefreshError('')
    try {
      const response = await withMinDuration(api.post(`/accounts/${id}/sync`), 600)
      if (!mountedRef.current) return
      const updated = response.data
      if (updated && updated.id) {
        setExistingAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)))
      }
      pushToast({ type: 'success', message: `${name} synced` })
    } catch (err: any) {
      if (!mountedRef.current) return
      // The sync ran but the provider rejected it (bad credentials, no access).
      const detail = err?.response?.data?.error ?? ''
      pushToast({
        type: 'error',
        message: `${name}: ${friendlySyncError(detail)}`,
        duration: 6000,
      })
      // Reflect the error status the backend just recorded.
      try {
        const list = await api.get('/accounts')
        if (mountedRef.current && Array.isArray(list.data)) setExistingAccounts(list.data)
      } catch {
        /* keep the current list */
      }
    } finally {
      if (mountedRef.current) {
        setRefreshingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    }
  }

  // Validates AWS keys against Cost Explorer before the account is saved.
  const [testingConnection, setTestingConnection] = useState(false)
  const handleTestConnection = async () => {
    setTestingConnection(true)
    try {
      await api.post('/aws/test-connection', {
        access_key_id: awsValues.access_key_id,
        secret_access_key: awsValues.secret_access_key,
        region: awsValues.region,
      })
      pushToast({ type: 'success', message: 'Connection successful. These credentials work.' })
    } catch (err: any) {
      pushToast({
        type: 'error',
        message: friendlySyncError(err?.response?.data?.error ?? ''),
        duration: 6000,
      })
    } finally {
      if (mountedRef.current) setTestingConnection(false)
    }
  }

  const copyPolicy = async () => {
    try {
      await navigator.clipboard.writeText(AWS_IAM_POLICY)
      setCopiedPolicy(true)
      setTimeout(() => setCopiedPolicy(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  // AWS form: react-hook-form + Zod validation
  const {
    register: registerAws,
    handleSubmit: handleAwsSubmit,
    reset: resetAws,
    watch: watchAws,
    clearErrors: clearAwsErrors,
    formState: { errors: awsErrors, isValid: awsIsValid },
  } = useForm<AwsFormValues>({
    resolver: zodResolver(awsSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      account_id: '',
      access_key_id: '',
      secret_access_key: '',
      region: '',
    },
  })
  // Live field values, used to hide a field's error once it's cleared (empty).
  const awsValues = watchAws()

  // GCP Form State
  const [gcpForm, setGcpForm] = useState({
    name: '',
    project_id: '',
    private_key: '',
    client_email: '',
  })

  // Azure Form State
  const [azureForm, setAzureForm] = useState({
    name: '',
    subscription_id: '',
    client_id: '',
    client_secret: '',
    tenant_id: '',
  })

  // Fetch existing accounts on load
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }
    fetchAccounts()
  }, [router])

  // Reset validation errors and banners whenever the active tab changes.
  useEffect(() => {
    clearAwsErrors()
    setError('')
  }, [activeTab, clearAwsErrors])

  const fetchAccounts = async () => {
    try {
      const response = await withMinDuration(api.get('/accounts'), 1000)
      const accounts = Array.isArray(response.data) ? response.data : []
      setExistingAccounts(accounts)
      // First-run: nothing to manage yet, so lead with the add form.
      if (accounts.length === 0) setShowAddPanel(true)
    } catch (error) {
      console.error('Failed to fetch accounts:', error)
    } finally {
      setAccountsLoading(false)
    }
  }

  // AWS submit (only runs after Zod validation passes)
  const onAwsSubmit = async (data: AwsFormValues) => {
    setLoading(true)
    setError('')

    try {
      await api.post('/aws/accounts', data)
      pushToast({ type: 'success', message: 'AWS account added successfully.' })
      resetAws()
      fetchAccounts()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add AWS account')
    } finally {
      setLoading(false)
    }
  }

  // GCP Handlers
  const handleGcpChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setGcpForm({ ...gcpForm, [e.target.name]: e.target.value })
  }

  const handleGcpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await api.post('/gcp/accounts', gcpForm)
      pushToast({ type: 'success', message: 'GCP account added successfully.' })
      setGcpForm({
        name: '',
        project_id: '',
        private_key: '',
        client_email: '',
      })
      fetchAccounts()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add GCP account')
    } finally {
      setLoading(false)
    }
  }

  // Azure Handlers
  const handleAzureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAzureForm({ ...azureForm, [e.target.name]: e.target.value })
  }

  const handleAzureSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await api.post('/azure/accounts', azureForm)
      pushToast({ type: 'success', message: 'Azure account added successfully.' })
      setAzureForm({
        name: '',
        subscription_id: '',
        client_id: '',
        client_secret: '',
        tenant_id: '',
      })
      fetchAccounts()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add Azure account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Cloud Cost Optimization Hub</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm sm:gap-4 sm:text-base">
            <a href="/dashboard" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition">
              Dashboard
            </a>
            <a href="/recommendations" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition">
              Recommendations
            </a>
            <ThemeToggle />
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('token')
                router.push('/login')
              }}
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-6xl mx-auto">
        {/* Page header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Cloud Accounts</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Connect AWS, Google Cloud and Azure to track spend in one place.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddPanel((v) => !v)}
            aria-expanded={showAddPanel ? 'true' : 'false'}
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950"
          >
            {showAddPanel ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showAddPanel ? 'Close' : 'Add Account'}
          </button>
        </div>

        {/* Summary chips */}
        {!accountsLoading && existingAccounts.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-slate-200/70 px-2.5 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {existingAccounts.length} {existingAccounts.length === 1 ? 'account' : 'accounts'}
            </span>
            {PROVIDER_FILTERS.filter((p) => p.value !== 'all' && providerCounts[p.value]).map((p) => (
              <span
                key={p.value}
                className={`rounded-full px-2.5 py-1 font-medium ${p.chip}`}
              >
                {providerCounts[p.value]} {p.label}
              </span>
            ))}
          </div>
        )}

        {/* Toolbar: search + provider filter */}
        {!accountsLoading && existingAccounts.length > 0 && (
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or account ID"
                aria-label="Search accounts"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
              {PROVIDER_FILTERS.map((p) => {
                const active = providerFilter === p.value
                const count = p.value === 'all' ? existingAccounts.length : providerCounts[p.value] ?? 0
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setProviderFilter(p.value)}
                    className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    {p.label} ({count})
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {refreshError && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-400"
          >
            {refreshError}
          </div>
        )}

        {/* Accounts grid / states — stays at the top so opening the add panel
            never pushes the cards down. */}
        {accountsLoading ? (
          <div
            role="status"
            aria-busy="true"
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            <span className="sr-only">Loading connected accounts</span>
            {Array.from({ length: 3 }).map((_, i) => (
              <AccountCardSkeleton key={i} />
            ))}
          </div>
        ) : existingAccounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center dark:border-slate-700 dark:bg-slate-900/40">
            <p className="text-sm font-medium text-slate-900 dark:text-white">No accounts connected yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600 dark:text-slate-400">
              Connect your first cloud account using the form below to start tracking costs.
            </p>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center dark:border-slate-700 dark:bg-slate-900/40">
            <p className="text-sm font-medium text-slate-900 dark:text-white">No matching accounts</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Nothing matches your search or filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setProviderFilter('all')
              }}
              className="mt-4 inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="grid animate-fade-in grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pagedAccounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  refreshing={refreshingIds.has(account.id)}
                  onRefresh={handleRefreshAccount}
                  deleting={deletingId === account.id}
                  onDelete={handleDeleteAccount}
                />
              ))}
            </div>

            {filteredAccounts.length > ACCOUNTS_PER_PAGE && (
              <div className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Showing {(currentPage - 1) * ACCOUNTS_PER_PAGE + 1}-
                  {Math.min(currentPage * ACCOUNTS_PER_PAGE, filteredAccounts.length)} of{' '}
                  {filteredAccounts.length}
                </p>
                <nav aria-label="Pagination" className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Prev
                  </button>
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const n = i + 1
                    const active = n === currentPage
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setPage(n)}
                        aria-label={`Page ${n}`}
                        className={`inline-flex min-h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                          active
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                            : 'border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        {n}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Next
                  </button>
                </nav>
              </div>
            )}
          </>
        )}

        {/* Add Account panel (collapsible) — expands below the cards */}
        {showAddPanel && (
          <div ref={addPanelRef} className="mt-8 scroll-mt-24 animate-fade-in">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Add Cloud Account
              </h3>
              <button
                type="button"
                onClick={() => setShowAddPanel(false)}
                aria-label="Close add account form"
                className="inline-flex min-h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Add Account Section with Tabs */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 dark:shadow-none dark:hover:border-slate-700">
          <div className="border-b border-slate-200 dark:border-slate-800">
            <div className="flex overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('aws')}
                className={`px-6 py-3 text-sm font-medium transition ${
                  activeTab === 'aws'
                    ? 'text-orange-700 dark:text-orange-400 border-b-2 border-orange-600 dark:border-orange-400'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                AWS
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('gcp')}
                className={`px-6 py-3 text-sm font-medium transition ${
                  activeTab === 'gcp'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Google Cloud
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('azure')}
                className={`px-6 py-3 text-sm font-medium transition ${
                  activeTab === 'azure'
                    ? 'text-cyan-700 dark:text-cyan-400 border-b-2 border-cyan-600 dark:border-cyan-400'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Azure
              </button>
            </div>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg">
                {error}
              </div>
            )}

            {/* AWS Form */}
            {activeTab === 'aws' && (
              <form onSubmit={handleAwsSubmit(onAwsSubmit)} className="space-y-4" noValidate>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Account Name
                  </label>
                  <input
                    type="text"
                    {...registerAws('name')}
                    className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g. Production AWS Account"
                  />
                  {awsErrors.name && awsValues.name && (
                    <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{awsErrors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    AWS Account ID
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    {...registerAws('account_id')}
                    className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g. 123456789012 (12 digits)"
                  />
                  {awsErrors.account_id && awsValues.account_id && (
                    <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{awsErrors.account_id.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Access Key ID
                  </label>
                  <input
                    type="text"
                    {...registerAws('access_key_id')}
                    className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g. AKIAIOSFODNN7EXAMPLE"
                  />
                  {awsErrors.access_key_id && awsValues.access_key_id && (
                    <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{awsErrors.access_key_id.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Secret Access Key
                  </label>
                  <input
                    type="password"
                    {...registerAws('secret_access_key')}
                    className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g. wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  />
                  {awsErrors.secret_access_key && awsValues.secret_access_key && (
                    <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{awsErrors.secret_access_key.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Region
                  </label>
                  <select
                    {...registerAws('region')}
                    className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">-- Select Region --</option>
                    <option value="us-east-1">US East (N. Virginia)</option>
                    <option value="us-east-2">US East (Ohio)</option>
                    <option value="us-west-1">US West (N. California)</option>
                    <option value="us-west-2">US West (Oregon)</option>
                    <option value="eu-west-1">EU (Ireland)</option>
                    <option value="eu-central-1">EU (Frankfurt)</option>
                    <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                    <option value="ap-southeast-2">Asia Pacific (Sydney)</option>
                    <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
                  </select>
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Required IAM Permissions</h3>
                    <button
                      type="button"
                      onClick={copyPolicy}
                      className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
                    >
                      {copiedPolicy ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                    Your AWS access key needs these permissions:
                  </p>
                  <pre className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs text-slate-700 dark:text-slate-300 overflow-x-auto">
{AWS_IAM_POLICY}
                  </pre>
                  <p className="text-xs text-slate-500 mt-2">
                    Read-only access to AWS Cost Explorer. It can read your cost data only, never view or change your resources.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={
                      testingConnection ||
                      loading ||
                      !awsValues.access_key_id ||
                      !awsValues.secret_access_key ||
                      !awsValues.region ||
                      !!awsErrors.access_key_id ||
                      !!awsErrors.secret_access_key
                    }
                    title="Check these credentials against AWS before saving"
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {testingConnection && <Spinner />}
                    {testingConnection ? 'Testing...' : 'Test connection'}
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !awsIsValid}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 font-medium text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
                  >
                    {loading && <Spinner />}
                    {loading ? 'Adding Account...' : 'Add AWS Account'}
                  </button>
                </div>
              </form>
            )}

            {/* GCP Form */}
            {activeTab === 'gcp' && (
              <form onSubmit={handleGcpSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Account Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={gcpForm.name}
                    onChange={handleGcpChange}
                    required
                    className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Production GCP Account"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Project ID
                  </label>
                  <input
                    type="text"
                    name="project_id"
                    value={gcpForm.project_id}
                    onChange={handleGcpChange}
                    required
                    className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="my-project-123"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Client Email
                  </label>
                  <input
                    type="email"
                    name="client_email"
                    value={gcpForm.client_email}
                    onChange={handleGcpChange}
                    required
                    className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="service-account@project.iam.gserviceaccount.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Private Key (JSON)
                  </label>
                  <textarea
                    name="private_key"
                    value={gcpForm.private_key}
                    onChange={handleGcpChange}
                    required
                    rows={6}
                    className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder='{"type": "service_account", "project_id": "...", ...}'
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Paste the entire service account JSON key file
                  </p>
                </div>

                <div className="pt-2">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Required GCP Permissions</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Your service account needs the following roles:
                  </p>
                  <ul className="text-xs text-slate-600 dark:text-slate-400 list-disc list-inside mt-2">
                    <li>roles/billing.viewer</li>
                    <li>roles/billing.costsViewer</li>
                  </ul>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading && <Spinner />}
                  {loading ? 'Adding Account...' : 'Add GCP Account'}
                </button>
              </form>
            )}

            {/* Azure Form */}
            {activeTab === 'azure' && (
              <form onSubmit={handleAzureSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Account Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={azureForm.name}
                    onChange={handleAzureChange}
                    required
                    className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Production Azure Account"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Subscription ID
                  </label>
                  <input
                    type="text"
                    name="subscription_id"
                    value={azureForm.subscription_id}
                    onChange={handleAzureChange}
                    required
                    className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Tenant ID
                  </label>
                  <input
                    type="text"
                    name="tenant_id"
                    value={azureForm.tenant_id}
                    onChange={handleAzureChange}
                    required
                    className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Client ID
                  </label>
                  <input
                    type="text"
                    name="client_id"
                    value={azureForm.client_id}
                    onChange={handleAzureChange}
                    required
                    className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Client Secret
                  </label>
                  <input
                    type="password"
                    name="client_secret"
                    value={azureForm.client_secret}
                    onChange={handleAzureChange}
                    required
                    className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="..."
                  />
                </div>

                <div className="pt-2">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Required Azure Permissions</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Your service principal needs the following role:
                  </p>
                  <ul className="text-xs text-slate-600 dark:text-slate-400 list-disc list-inside mt-2">
                    <li>Reader role on the subscription</li>
                    <li>Cost Management Reader</li>
                  </ul>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 py-2 px-4 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading && <Spinner />}
                  {loading ? 'Adding Account...' : 'Add Azure Account'}
                </button>
              </form>
            )}
          </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
