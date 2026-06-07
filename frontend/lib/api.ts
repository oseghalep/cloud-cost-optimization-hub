import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export interface LoginResponse {
  token: string
  user: {
    id: string
    email: string
    name: string
  }
}

export interface DashboardSummary {
  total_cost: number
  cost_by_service: Record<string, number>
  recommendations_count: number
  potential_savings: number
  unread_alerts: number
  daily_costs: Array<{ date: string; cost: number }>
  top_recommendations: Array<{
    id: string
    title: string
    potential_savings: number
    type: string
  }>
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await api.post('/auth/login', { email, password })
  return response.data
}

export async function register(name: string, email: string, password: string): Promise<LoginResponse> {
  const response = await api.post('/auth/register', { name, email, password })
  return response.data
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const response = await api.get('/dashboard/summary')
  return response.data
}

export async function getMe() {
  const response = await api.get('/auth/me')
  return response.data
}

export default api