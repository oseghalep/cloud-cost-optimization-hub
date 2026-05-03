'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

export default function AccountsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    account_id: '',
    access_key_id: '',
    secret_access_key: '',
    region: 'us-east-1',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await api.post('/aws/accounts', formData)
      setSuccess('AWS account added successfully! Costs will be synced shortly.')
      setFormData({
        name: '',
        account_id: '',
        access_key_id: '',
        secret_access_key: '',
        region: 'us-east-1',
      })
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add AWS account')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
        <div className="flex items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold text-white">Cloud Cost Optimization Hub</h1>
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
      </header>

      <main className="p-6 max-w-2xl mx-auto">
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Add AWS Account</h2>

          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-2 rounded-lg">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Account Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Production AWS Account"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                AWS Account ID
              </label>
              <input
                type="text"
                name="account_id"
                value={formData.account_id}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="123456789012"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Access Key ID
              </label>
              <input
                type="text"
                name="access_key_id"
                value={formData.access_key_id}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="AKIA..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Secret Access Key
              </label>
              <input
                type="password"
                name="secret_access_key"
                value={formData.secret_access_key}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Region
              </label>
              <select
                name="region"
                value={formData.region}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition duration-200 disabled:opacity-50"
            >
              {loading ? 'Adding Account...' : 'Add AWS Account'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800">
            <h3 className="text-sm font-medium text-slate-300 mb-2">Required IAM Permissions</h3>
            <p className="text-xs text-slate-400 mb-2">
              Your AWS access key needs these permissions:
            </p>
            <pre className="bg-slate-800 p-3 rounded-lg text-xs text-slate-300 overflow-x-auto">
{`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ce:GetCostAndUsage",
        "ce:GetDimensionValues",
        "ce:GetReservationCoverage"
      ],
      "Resource": "*"
    }
  ]
}`}
            </pre>
          </div>
        </div>
      </main>
    </div>
  )
}