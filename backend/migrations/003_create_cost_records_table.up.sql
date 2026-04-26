CREATE TABLE cost_records (
    id SERIAL PRIMARY KEY,
    cloud_account_id INTEGER NOT NULL REFERENCES cloud_accounts(id),
    amount NUMERIC NOT NULL
);
