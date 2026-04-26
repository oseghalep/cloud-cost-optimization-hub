-- Create cost_records table with TimescaleDB support
CREATE TABLE IF NOT EXISTS cost_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES cloud_accounts(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL,
    service VARCHAR(255) NOT NULL,
    region VARCHAR(100),
    resource_id VARCHAR(255),
    tags JSONB,
    amount DECIMAL(15,6) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_cost_records_account_id ON cost_records(account_id);
CREATE INDEX idx_cost_records_date ON cost_records(date);
CREATE INDEX idx_cost_records_service ON cost_records(service);
CREATE INDEX idx_cost_records_resource_id ON cost_records(resource_id);
CREATE INDEX idx_cost_records_account_date ON cost_records(account_id, date);

-- If using TimescaleDB, convert to hypertable
-- SELECT create_hypertable('cost_records', 'date', if_not_exists => TRUE);