export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface CloudAccount {
  id: string;
  user_id: string;
  provider: 'aws' | 'gcp' | 'azure';
  name: string;
  account_id: string;
  status: string;
  last_sync_at: string | null;
  created_at: string;
}

export interface CostRecord {
  id: string;
  account_id: string;
  provider: string;
  service: string;
  region: string;
  resource_id: string;
  amount: number;
  currency: string;
  date: string;
}

export interface Recommendation {
  id: string;
  account_id: string;
  type: string;
  title: string;
  description: string;
  resource_id: string;
  resource_type: string;
  current_value: number;        // Added this field
  suggested_value: number;      // Also add for completeness
  potential_savings: number;
  currency: string;
  status: string;
  created_at: string;
}

export interface Alert {
  id: string;
  user_id: string;
  title: string;
  message: string;
  severity: string;
  is_read: boolean;
  created_at: string;
}