-- 💰 DEALS TABLE MIGRATION
-- Creates deals table for sales pipeline management

CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  deal_name VARCHAR(200) NOT NULL,
  description TEXT,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  probability INTEGER NOT NULL DEFAULT 10,
  expected_close_date TIMESTAMP,
  actual_close_date TIMESTAMP,
  owner_id UUID NOT NULL,
  created_by UUID NOT NULL,
  notes TEXT,
  tags JSONB,
  custom_fields JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_deals_organization_id ON deals(organization_id);
CREATE INDEX IF NOT EXISTS idx_deals_customer_id ON deals(customer_id);
CREATE INDEX IF NOT EXISTS idx_deals_owner_id ON deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_expected_close_date ON deals(expected_close_date);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_deals_org_status ON deals(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_deals_org_created ON deals(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_deals_customer_status ON deals(customer_id, status);