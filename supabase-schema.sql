-- VoxAn Booking System Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Leads table (dental practices)
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  name TEXT,
  practice_name TEXT,
  address TEXT,
  city TEXT,
  postcode TEXT,
  source TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'new',
  contact_count INTEGER DEFAULT 0,
  last_contacted TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calls table (voice call records)
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vapi_call_id TEXT UNIQUE NOT NULL,
  assistant_id TEXT,
  phone_number TEXT NOT NULL REFERENCES leads(phone),
  customer_name TEXT,
  practice_name TEXT,
  status TEXT DEFAULT 'queued',
  transcript TEXT,
  recording_url TEXT,
  cost DECIMAL(10,4) DEFAULT 0,
  duration INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT FALSE,
  outcome TEXT,
  callback_requested TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments table (booked demos)
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID REFERENCES calls(id),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  practice_name TEXT,
  appointment_time TIMESTAMPTZ NOT NULL,
  calendar_event_id TEXT,
  calendar_link TEXT,
  status TEXT DEFAULT 'confirmed',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Waitlist table (for when no slots available)
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone TEXT NOT NULL REFERENCES leads(phone),
  name TEXT,
  practice_name TEXT,
  preferred_days JSONB DEFAULT '[]',
  preferred_times JSONB DEFAULT '[]',
  notes TEXT,
  status TEXT DEFAULT 'waiting',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calls_updated_at BEFORE UPDATE ON calls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_waitlist_updated_at BEFORE UPDATE ON waitlist
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Allow all operations for service role (used by backend)
CREATE POLICY "Service role full access" ON leads
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON calls
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON appointments
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON waitlist
  FOR ALL USING (auth.role() = 'service_role');

-- Indexes for performance
CREATE INDEX idx_calls_phone ON calls(phone_number);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_created ON calls(created_at DESC);
CREATE INDEX idx_appointments_time ON appointments(appointment_time);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_leads_status ON leads(status);

-- View for dashboard metrics
CREATE VIEW dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM calls WHERE created_at >= NOW() - INTERVAL '7 days') as calls_7d,
  (SELECT COUNT(*) FROM calls WHERE success = true AND created_at >= NOW() - INTERVAL '7 days') as successful_calls_7d,
  (SELECT SUM(cost) FROM calls WHERE created_at >= NOW() - INTERVAL '7 days') as cost_7d,
  (SELECT COUNT(*) FROM appointments WHERE status = 'confirmed' AND appointment_time >= NOW()) as upcoming_appointments,
  (SELECT COUNT(*) FROM leads WHERE status = 'new') as new_leads,
  (SELECT COUNT(*) FROM leads WHERE status = 'contacted') as contacted_leads;
