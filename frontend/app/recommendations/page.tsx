'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { formatCurrency, withMinDuration } from '@/lib/utils'
import { Recommendation } from '@/types'
import { RecCardSkeleton } from '@/components/ui/Skeleton'
import { Spinner } from '@/components/ui/Spinner'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { useToast } from '@/components/ui/Toast'

/** Pulls a readable message out of an axios error, with a sane fallback. */
function apiErrorMessage(err: any, fallback: string): string {
  const detail = err?.response?.data?.error
  if (typeof detail === 'string' && detail.trim()) {
    return detail.length > 120 ? `${detail.slice(0, 120)}…` : detail
  }
  return fallback
}

/** Keeps long recommendation titles from overwhelming a toast. */
function truncate(text: string, max = 45): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export default function RecommendationsPage() {
  const router = useRouter()
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [filter, setFilter] = useState('all')
  // id + action of the row currently being applied/dismissed (per-row loading)
  const [actioning, setActioning] = useState<{ id: string; action: 'apply' | 'dismiss' } | null>(null)
  const [loadError, setLoadError] = useState('')
  const toast = useToast()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }
    fetchRecommendations()
  }, [router])

  // GET: the skeleton loader communicates progress, and a failure shows an
  // inline retry panel. No toast here, toasts are reserved for user actions.
  const fetchRecommendations = async () => {
    try {
      const response = await withMinDuration(api.get('/recommendations'), 1000)
      setRecommendations(Array.isArray(response.data) ? response.data : [])
      setLoadError('')
    } catch (error) {
      console.error('Failed to fetch recommendations:', error)
      setLoadError('Could not load recommendations.')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await api.post('/recommendations/generate')
      toast.success('Generating recommendations. This may take a moment.')
      // Generation runs server-side; give it a beat before re-reading.
      setTimeout(() => fetchRecommendations(), 2000)
    } catch (err: any) {
      toast.error(apiErrorMessage(err, 'Could not generate recommendations.'))
    } finally {
      setGenerating(false)
    }
  }

  const handleDismiss = async (id: string) => {
    const title = recommendations.find((r) => r.id === id)?.title ?? 'Recommendation'
    setActioning({ id, action: 'dismiss' })
    try {
      await api.patch(`/recommendations/${id}/dismiss`)
      setRecommendations((prev) => prev.filter((r) => r.id !== id))
      toast.success(`Dismissed "${truncate(title)}"`)
    } catch (err: any) {
      toast.error(apiErrorMessage(err, 'Could not dismiss that recommendation.'))
    } finally {
      setActioning(null)
    }
  }

  const handleApply = async (id: string) => {
    const rec = recommendations.find((r) => r.id === id)
    setActioning({ id, action: 'apply' })
    try {
      await api.post(`/recommendations/${id}/apply`)
      setRecommendations((prev) => prev.filter((r) => r.id !== id))
      toast.success(
        rec
          ? `Applied "${truncate(rec.title)}" — saving ${formatCurrency(rec.potential_savings)}/mo`
          : 'Recommendation applied'
      )
    } catch (err: any) {
      toast.error(apiErrorMessage(err, 'Could not apply that recommendation.'))
    } finally {
      setActioning(null)
    }
  }

  const filteredRecommendations = recommendations.filter(rec => {
    if (filter === 'all') return true
    return rec.status === filter
  })

  const totalSavings = filteredRecommendations.reduce((sum, rec) => sum + rec.potential_savings, 0)

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'rightsizing': return 'text-blue-600 dark:text-blue-400 bg-blue-400/10'
      case 'orphaned': return 'text-yellow-700 dark:text-yellow-400 bg-yellow-400/10'
      case 'reserved_instance': return 'text-green-700 dark:text-green-400 bg-green-400/10'
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-400/10'
    }
  }

  const getTypeLabel = (type: string) => {
    switch(type) {
      case 'rightsizing': return 'Rightsizing'
      case 'orphaned': return 'Orphaned Resource'
      case 'reserved_instance': return 'Reserved Instance'
      default: return type
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
            <a href="/accounts" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition">
              Accounts
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

      <main className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Cost Optimization Recommendations</h2>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Actionable insights to reduce your cloud spending
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating && <Spinner />}
            {generating ? 'Generating...' : 'Generate Recommendations'}
          </button>
        </div>

        {/* Summary Card */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg p-6 border border-blue-200 dark:border-blue-800/50 mb-6">
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-1">Total Potential Monthly Savings</p>
          <p className="text-4xl font-bold text-green-700 dark:text-green-400">{formatCurrency(totalSavings)}</p>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-2">
            Based on {filteredRecommendations.length} active recommendations
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-4 py-2 ${filter === 'all' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-slate-600 dark:text-slate-400'}`}
          >
            All ({recommendations.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 ${filter === 'pending' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-slate-600 dark:text-slate-400'}`}
          >
            Pending
          </button>
          <button
            type="button"
            onClick={() => setFilter('applied')}
            className={`px-4 py-2 ${filter === 'applied' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-slate-600 dark:text-slate-400'}`}
          >
            Applied
          </button>
          <button
            type="button"
            onClick={() => setFilter('dismissed')}
            className={`px-4 py-2 ${filter === 'dismissed' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-slate-600 dark:text-slate-400'}`}
          >
            Dismissed
          </button>
        </div>

        {/* A failed GET gets an inline retry panel, not a toast. */}
        {!loading && loadError && (
          <div
            role="alert"
            className="mb-4 flex flex-col items-start gap-3 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true)
                setLoadError('')
                fetchRecommendations()
              }}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-red-500/50 px-4 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
            >
              Retry
            </button>
          </div>
        )}

        {/* Recommendations List */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <RecCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredRecommendations.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 dark:shadow-none dark:hover:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400">No recommendations found</p>
            <p className="text-slate-500 text-sm mt-2">
              Click "Generate Recommendations" to analyze your cloud infrastructure
            </p>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            {filteredRecommendations.map((rec) => (
              <div key={rec.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 dark:shadow-none dark:hover:border-slate-700 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(rec.type)}`}>
                        {getTypeLabel(rec.type)}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        rec.status === 'pending' ? 'bg-yellow-400/10 text-yellow-700 dark:text-yellow-400' :
                        rec.status === 'applied' ? 'bg-green-400/10 text-green-700 dark:text-green-400' :
                        'bg-gray-400/10 text-gray-600 dark:text-gray-400'
                      }`}>
                        {rec.status}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{rec.title}</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">{rec.description}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">Resource ID</p>
                        <p className="text-slate-900 dark:text-white font-mono text-xs">{rec.resource_id}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Resource Type</p>
                        <p className="text-slate-900 dark:text-white">{rec.resource_type}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Current Monthly Cost</p>
                        <p className="text-slate-900 dark:text-white">{formatCurrency(rec.current_value)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Potential Savings</p>
                        <p className="text-green-700 dark:text-green-400 font-semibold">{formatCurrency(rec.potential_savings)}</p>
                      </div>
                    </div>
                  </div>
                  
                  {rec.status === 'pending' && (
                    <div className="flex gap-2 sm:ml-4">
                      {(() => {
                        const isApplying = actioning?.id === rec.id && actioning.action === 'apply'
                        const isDismissing = actioning?.id === rec.id && actioning.action === 'dismiss'
                        const busy = actioning?.id === rec.id
                        return (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApply(rec.id)}
                              disabled={busy}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isApplying && <Spinner className="h-3.5 w-3.5" />}
                              {isApplying ? 'Applying...' : 'Apply'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDismiss(rec.id)}
                              disabled={busy}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white text-sm rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isDismissing && <Spinner className="h-3.5 w-3.5" />}
                              {isDismissing ? 'Dismissing...' : 'Dismiss'}
                            </button>
                          </>
                        )
                      })()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
