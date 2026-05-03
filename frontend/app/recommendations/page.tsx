'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { Recommendation } from '@/types'

export default function RecommendationsPage() {
  const router = useRouter()
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }
    fetchRecommendations()
  }, [router])

  const fetchRecommendations = async () => {
    try {
      const response = await api.get('/recommendations')
      setRecommendations(response.data)
    } catch (error) {
      console.error('Failed to fetch recommendations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await api.post('/recommendations/generate')
      // Wait a bit for generation to complete
      setTimeout(() => fetchRecommendations(), 2000)
    } catch (error) {
      console.error('Failed to generate recommendations:', error)
    } finally {
      setGenerating(false)
    }
  }

  const handleDismiss = async (id: string) => {
    try {
      await api.patch(`/recommendations/${id}/dismiss`)
      setRecommendations(recommendations.filter(r => r.id !== id))
    } catch (error) {
      console.error('Failed to dismiss recommendation:', error)
    }
  }

  const handleApply = async (id: string) => {
    try {
      await api.post(`/recommendations/${id}/apply`)
      setRecommendations(recommendations.filter(r => r.id !== id))
    } catch (error) {
      console.error('Failed to apply recommendation:', error)
    }
  }

  const filteredRecommendations = recommendations.filter(rec => {
    if (filter === 'all') return true
    return rec.status === filter
  })

  const totalSavings = filteredRecommendations.reduce((sum, rec) => sum + rec.potential_savings, 0)

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'rightsizing': return 'text-blue-400 bg-blue-400/10'
      case 'orphaned': return 'text-yellow-400 bg-yellow-400/10'
      case 'reserved_instance': return 'text-green-400 bg-green-400/10'
      default: return 'text-gray-400 bg-gray-400/10'
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
    <div className="min-h-screen bg-slate-950">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
        <div className="flex items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold text-white">Cloud Cost Optimization Hub</h1>
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-slate-400 hover:text-white transition">
              Dashboard
            </a>
            <a href="/accounts" className="text-slate-400 hover:text-white transition">
              Accounts
            </a>
            <button
              onClick={() => {
                localStorage.removeItem('token')
                router.push('/login')
              }}
              className="text-slate-400 hover:text-white transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Cost Optimization Recommendations</h2>
            <p className="text-slate-400 mt-1">
              Actionable insights to reduce your cloud spending
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Recommendations'}
          </button>
        </div>

        {/* Summary Card */}
        <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg p-6 border border-blue-800/50 mb-6">
          <p className="text-slate-400 text-sm mb-1">Total Potential Monthly Savings</p>
          <p className="text-4xl font-bold text-green-400">{formatCurrency(totalSavings)}</p>
          <p className="text-slate-400 text-sm mt-2">
            Based on {filteredRecommendations.length} active recommendations
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-800">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 ${filter === 'all' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400'}`}
          >
            All ({recommendations.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 ${filter === 'pending' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400'}`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('applied')}
            className={`px-4 py-2 ${filter === 'applied' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400'}`}
          >
            Applied
          </button>
          <button
            onClick={() => setFilter('dismissed')}
            className={`px-4 py-2 ${filter === 'dismissed' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400'}`}
          >
            Dismissed
          </button>
        </div>

        {/* Recommendations List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
          </div>
        ) : filteredRecommendations.length === 0 ? (
          <div className="text-center py-12 bg-slate-900 rounded-lg border border-slate-800">
            <p className="text-slate-400">No recommendations found</p>
            <p className="text-slate-500 text-sm mt-2">
              Click "Generate Recommendations" to analyze your cloud infrastructure
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRecommendations.map((rec) => (
              <div key={rec.id} className="bg-slate-900 rounded-lg border border-slate-800 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(rec.type)}`}>
                        {getTypeLabel(rec.type)}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        rec.status === 'pending' ? 'bg-yellow-400/10 text-yellow-400' :
                        rec.status === 'applied' ? 'bg-green-400/10 text-green-400' :
                        'bg-gray-400/10 text-gray-400'
                      }`}>
                        {rec.status}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{rec.title}</h3>
                    <p className="text-slate-400 text-sm mb-4">{rec.description}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">Resource ID</p>
                        <p className="text-white font-mono text-xs">{rec.resource_id}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Resource Type</p>
                        <p className="text-white">{rec.resource_type}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Current Monthly Cost</p>
                        <p className="text-white">{formatCurrency(rec.current_value)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Potential Savings</p>
                        <p className="text-green-400 font-semibold">{formatCurrency(rec.potential_savings)}</p>
                      </div>
                    </div>
                  </div>
                  
                  {rec.status === 'pending' && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleApply(rec.id)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => handleDismiss(rec.id)}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition"
                      >
                        Dismiss
                      </button>
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