'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { getDashboardSummary, DashboardSummary } from '@/lib/api'
import { formatCurrency, withMinDuration } from '@/lib/utils'
import { Skeleton, StatCardSkeleton, ChartSkeleton, RecRowSkeleton } from '@/components/ui/Skeleton'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { useTheme } from '@/components/theme/ThemeProvider'
import { DollarSign, Lightbulb, TrendingDown, Bell } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const gridColor = isDark ? '#334155' : '#e2e8f0'
  const axisColor = isDark ? '#94a3b8' : '#64748b'
  const tooltipBg = isDark ? '#1e293b' : '#ffffff'

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    const fetchData = async () => {
      try {
        const summary = await withMinDuration(getDashboardSummary(), 1000)
        setData(summary)
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          localStorage.removeItem('token')
          router.push('/login')
          return
        }
        // GET failure surfaces inline, not as a toast.
        setLoadError('Could not load your dashboard data.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  // Prepare pie chart data
  const pieData = data?.cost_by_service
    ? Object.entries(data.cost_by_service).map(([name, value]) => ({ name, value }))
    : []

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Cloud Cost Optimization Hub</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm sm:gap-4 sm:text-base">
            <a
              href="/accounts"
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
            >
              Add Account
            </a>
            <ThemeToggle />
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('token')
                localStorage.removeItem('user')
                router.push('/login')
              }}
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6">
        {!loading && loadError && (
          <div
            role="alert"
            className="mb-6 flex flex-col items-start gap-3 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-red-500/50 px-4 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
            >
              Retry
            </button>
          </div>
        )}
        {loading ? (
          <>
            {/* Skeleton: Stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {Array.from({ length: 4 }).map((_, i) => (
                // Stagger the sweep so the row ripples rather than flashing together.
                <StatCardSkeleton key={i} delayMs={i * 120} />
              ))}
            </div>
            {/* Skeleton: Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <ChartSkeleton />
              <ChartSkeleton variant="donut" />
            </div>
            {/* Skeleton: Top recommendations */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 dark:shadow-none dark:hover:border-slate-700">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                <Skeleton className="h-5 w-44" />
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {Array.from({ length: 3 }).map((_, i) => (
                  <RecRowSkeleton key={i} />
                ))}
              </div>
            </div>
          </>
        ) : (
        <div className="animate-fade-in">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 dark:shadow-none dark:hover:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <DollarSign className="h-5 w-5" />
              </span>
              <p className="text-slate-600 dark:text-slate-400 text-sm">Total Cost (30d)</p>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(data?.total_cost || 0)}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 dark:shadow-none dark:hover:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
                <Lightbulb className="h-5 w-5" />
              </span>
              <p className="text-slate-600 dark:text-slate-400 text-sm">Active Recommendations</p>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{data?.recommendations_count || 0}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 dark:shadow-none dark:hover:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400">
                <TrendingDown className="h-5 w-5" />
              </span>
              <p className="text-slate-600 dark:text-slate-400 text-sm">Potential Savings</p>
            </div>
            <p className="text-3xl font-bold text-green-700 dark:text-green-400">{formatCurrency(data?.potential_savings || 0)}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 dark:shadow-none dark:hover:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                <Bell className="h-5 w-5" />
              </span>
              <p className="text-slate-600 dark:text-slate-400 text-sm">Unread Alerts</p>
            </div>
            <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-400">{data?.unread_alerts || 0}</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Daily Cost Trend */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 dark:shadow-none dark:hover:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Daily Cost Trend</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.daily_costs || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="date" stroke={axisColor} />
                  <YAxis stroke={axisColor} tickFormatter={(value) => `$${value}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${gridColor}`, borderRadius: 8, color: axisColor }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost']}
                  />
                  <Line type="monotone" dataKey="cost" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cost by Service (Pie Chart) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 dark:shadow-none dark:hover:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Cost by Service</h2>
            <div className="h-80">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      fill="#8884d8"
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  No cost data available
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recommendations Section */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 dark:shadow-none dark:hover:border-slate-700">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Top Recommendations</h2>
            <a href="/recommendations" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm">
              View All →
            </a>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {data?.top_recommendations && data.top_recommendations.length > 0 ? (
              data.top_recommendations.map((rec) => (
                <div key={rec.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-slate-900 dark:text-white font-medium">{rec.title}</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                      Type: {rec.type}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-700 dark:text-green-400 font-semibold">
                      Save {formatCurrency(rec.potential_savings)}
                    </p>
                    <a href="/recommendations" className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 inline-block">
                      View Details
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-slate-500">
                No recommendations yet.{' '}
                <a href="/recommendations" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                  Generate recommendations
                </a>
              </div>
            )}
          </div>
        </div>
        </div>
        )}
      </main>
    </div>
  )
}
