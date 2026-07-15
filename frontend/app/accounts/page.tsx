'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '@/lib/api'
import { withMinDuration } from '@/lib/utils'
import { AccountRowSkeleton } from '@/components/ui/Skeleton'
import { Spinner } from '@/components/ui/Spinner'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { Copy, Check } from 'lucide-react'

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
  const [success, setSuccess] = useState('')
  const [existingAccounts, setExistingAccounts] = useState<any[]>([])
  const [copiedPolicy, setCopiedPolicy] = useState(false)
  const [copiedAccountId, setCopiedAccountId] = useState<number | null>(null)

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
    setSuccess('')
  }, [activeTab, clearAwsErrors])

  const fetchAccounts = async () => {
    try {
      const response = await withMinDuration(api.get('/accounts'), 1000)
      setExistingAccounts(response.data)
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
    setSuccess('')

    try {
      await api.post('/aws/accounts', data)
      setSuccess('AWS account added successfully! Costs will be synced shortly.')
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
    setSuccess('')

    try {
      await api.post('/gcp/accounts', gcpForm)
      setSuccess('GCP account added successfully! Costs will be synced shortly.')
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
    setSuccess('')

    try {
      await api.post('/azure/accounts', azureForm)
      setSuccess('Azure account added successfully! Costs will be synced shortly.')
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

  const getProviderBadgeColor = (provider: string) => {
    switch(provider) {
      case 'aws': return 'bg-orange-500/20 text-orange-700 dark:text-orange-400'
      case 'gcp': return 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
      case 'azure': return 'bg-cyan-600/20 text-cyan-700 dark:text-cyan-400'
      default: return 'bg-gray-500/20 text-gray-600 dark:text-gray-400'
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Cloud Cost Optimization Hub</h1>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
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

      <main className="p-4 sm:p-6 max-w-4xl mx-auto">
        {/* Existing Accounts Section */}
        {accountsLoading ? (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Connected Accounts</h2>
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <AccountRowSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : existingAccounts.length > 0 && (
          <div className="mb-8 animate-fade-in">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Connected Accounts</h2>
            <div className="space-y-2">
              {existingAccounts.map((account) => (
                <div key={account.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-shadow hover:shadow-md hover:border-slate-300 dark:shadow-none dark:hover:border-slate-700 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getProviderBadgeColor(account.provider)}`}>
                      {account.provider.toUpperCase()}
                    </span>
                    <div>
                      <p className="text-slate-900 dark:text-white font-medium">{account.name}</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-slate-600 dark:text-slate-400 text-sm">Account ID: {account.account_id}</p>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(account.account_id)
                            setCopiedAccountId(account.id)
                            setTimeout(() => setCopiedAccountId(null), 2000)
                          }}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                          title="Copy Account ID"
                        >
                          {copiedAccountId === account.id ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    account.status === 'active' ? 'bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-red-500/20 text-red-600 dark:text-red-400'
                  }`}>
                    {account.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

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

            {success && (
              <div className="mb-4 bg-green-500/10 border border-green-500/50 text-green-700 dark:text-green-400 px-4 py-2 rounded-lg">
                {success}
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

                <button
                  type="submit"
                  disabled={loading || !awsIsValid}
                  className="inline-flex w-full items-center justify-center gap-2 py-2 px-4 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading && <Spinner />}
                  {loading ? 'Adding Account...' : 'Add AWS Account'}
                </button>
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
      </main>
    </div>
  )
}
