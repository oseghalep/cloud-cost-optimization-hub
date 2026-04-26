-- Create cloud_accounts table
CREATE TABLE IF NOT EXISTS cloud_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    credentials JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, provider)
);

-- Create indexes
CREATE INDEX idx_cloud_accounts_user_id ON cloud_accounts(user_id);
CREATE INDEX idx_cloud_accounts_provider ON cloud_accounts(provider);
CREATE INDEX idx_cloud_accounts_status ON cloud_accounts(status);

-- Add trigger
CREATE TRIGGER update_cloud_accounts_updated_at 
    BEFORE UPDATE ON cloud_accounts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();