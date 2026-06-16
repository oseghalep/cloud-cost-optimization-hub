'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { getDashboardSummary, DashboardSummary } from '@/lib/api'
import { formatCurrency, withMinDuration } from '@/lib/utils'
import { Skeleton, StatCardSkeleton, ChartSkeleton, RecRowSkeleton } from '@/components/ui/Skeleton'
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
        }
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
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
        <div className="flex items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold text-white">Cloud Cost Optimization Hub</h1>
          <div className="flex items-center gap-4">
            <a
              href="/accounts"
              className="text-slate-400 hover:text-white transition"
            >
              Add Account
            </a>
            <button
              onClick={() => {
                localStorage.removeItem('token')
                localStorage.removeItem('user')
                router.push('/login')
              }}
              className="text-slate-400 hover:text-white transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="p-6">
        {loading ? (
          <>
            {/* Skeleton: Stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <StatCardSkeleton key={i} />
              ))}
            </div>
            {/* Skeleton: Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <ChartSkeleton />
              <ChartSkeleton />
            </div>
            {/* Skeleton: Top recommendations */}
            <div className="bg-slate-900 rounded-lg border border-slate-800">
              <div className="px-6 py-4 border-b border-slate-800">
                <Skeleton className="h-5 w-44" />
              </div>
              <div className="divide-y divide-slate-800">
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
          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <p className="text-slate-400 text-sm mb-1">Total Cost (30d)</p>
            <p className="text-3xl font-bold text-white">{formatCurrency(data?.total_cost || 0)}</p>
          </div>
          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <p className="text-slate-400 text-sm mb-1">Active Recommendations</p>
            <p className="text-3xl font-bold text-white">{data?.recommendations_count || 0}</p>
          </div>
          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <p className="text-slate-400 text-sm mb-1">Potential Savings</p>
            <p className="text-3xl font-bold text-green-400">{formatCurrency(data?.potential_savings || 0)}</p>
          </div>
          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <p className="text-slate-400 text-sm mb-1">Unread Alerts</p>
            <p className="text-3xl font-bold text-yellow-400">{data?.unread_alerts || 0}</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Daily Cost Trend */}
          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h2 className="text-lg font-semibold text-white mb-4">Daily Cost Trend</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.daily_costs || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" tickFormatter={(value) => `$${value}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none' }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost']}
                  />
                  <Line type="monotone" dataKey="cost" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cost by Service (Pie Chart) */}
          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h2 className="text-lg font-semibold text-white mb-4">Cost by Service</h2>
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
        <div className="bg-slate-900 rounded-lg border border-slate-800">
          <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Top Recommendations</h2>
            <a href="/recommendations" className="text-blue-400 hover:text-blue-300 text-sm">
              View All →
            </a>
          </div>
          <div className="divide-y divide-slate-800">
            {data?.top_recommendations && data.top_recommendations.length > 0 ? (
              data.top_recommendations.map((rec) => (
                <div key={rec.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium">{rec.title}</h3>
                    <p className="text-slate-400 text-sm mt-1">
                      Type: {rec.type}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-semibold">
                      Save {formatCurrency(rec.potential_savings)}
                    </p>
                    <a href="/recommendations" className="mt-2 text-sm text-blue-400 hover:text-blue-300 inline-block">
                      View Details
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-slate-500">
                No recommendations yet.{' '}
                <a href="/recommendations" className="text-blue-400 hover:text-blue-300">
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