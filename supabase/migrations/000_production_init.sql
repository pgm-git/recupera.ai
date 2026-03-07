-- ============================================================
-- Recupera.AI — Production Schema
-- Run this on a FRESH Supabase project (SQL Editor → New Query)
-- Consolidated from: schema.sql + 001 + 002 + UAZAPI instance tokens
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. ENUMS
-- ============================================================

CREATE TYPE platform_enum AS ENUM ('kiwify', 'hotmart', 'eduzz');
CREATE TYPE lead_status_enum AS ENUM (
  'pending_recovery', 'queued', 'contacted', 'in_conversation',
  'converted_organically', 'recovered_by_ai', 'failed', 'escalated', 'do_not_contact'
);
CREATE TYPE instance_status_enum AS ENUM ('disconnected', 'connecting', 'connected');

-- ============================================================
-- 2. TABLES
-- ============================================================

-- Clients (extends auth.users)
CREATE TABLE public.clients (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  api_key TEXT DEFAULT uuid_generate_v4()::text,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Products (AI agent config per product)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform platform_enum NOT NULL,
  external_product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  agent_persona TEXT DEFAULT 'Você é um especialista de suporte...',
  objection_handling TEXT,
  downsell_link TEXT,
  delay_minutes INTEGER DEFAULT 15,
  is_active BOOLEAN DEFAULT true,
  total_recovered NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Instances (WhatsApp via UAZAPI — one per product)
CREATE TABLE public.instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  instance_key TEXT UNIQUE NOT NULL,       -- UAZAPI instance name
  token TEXT NOT NULL,                     -- UAZAPI instance token (auth for all operations)
  uazapi_instance_id TEXT,                 -- UAZAPI internal ID (e.g. "ra50ff908815b40")
  status instance_status_enum DEFAULT 'disconnected',
  qr_code_base64 TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Leads (abandoned checkouts tracked for recovery)
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  platform_lead_id TEXT,
  name TEXT,
  email TEXT,
  phone TEXT,
  phone_normalized TEXT,
  checkout_url TEXT,
  status lead_status_enum DEFAULT 'pending_recovery',
  conversation_log JSONB DEFAULT '[]'::jsonb,
  value NUMERIC,
  recovery_attempts INT DEFAULT 0,
  next_contact_scheduled_at TIMESTAMPTZ,
  conversation_summary TEXT,
  detected_objections TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  purchase_at TIMESTAMPTZ
);

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- clients
CREATE POLICY "clients_select_own" ON clients FOR SELECT USING (auth.uid() = id);
CREATE POLICY "clients_update_own" ON clients FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- products
CREATE POLICY "products_select_own" ON products FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "products_insert_own" ON products FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "products_update_own" ON products FOR UPDATE USING (auth.uid() = client_id) WITH CHECK (auth.uid() = client_id);

-- leads
CREATE POLICY "leads_select_own" ON leads FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "leads_insert_own" ON leads FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "leads_update_own" ON leads FOR UPDATE USING (auth.uid() = client_id) WITH CHECK (auth.uid() = client_id);

-- instances
CREATE POLICY "instances_select_own" ON instances FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "instances_insert_own" ON instances FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "instances_update_own" ON instances FOR UPDATE USING (auth.uid() = client_id) WITH CHECK (auth.uid() = client_id);

-- ============================================================
-- 4. TRIGGERS
-- ============================================================

-- Auto updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.instances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create client row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.clients (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Phone normalization
CREATE OR REPLACE FUNCTION public.normalize_phone()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    NEW.phone_normalized = regexp_replace(NEW.phone, '[^0-9]', '', 'g');
  ELSE
    NEW.phone_normalized = NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER normalize_phone_trigger BEFORE INSERT OR UPDATE OF phone ON public.leads FOR EACH ROW EXECUTE FUNCTION public.normalize_phone();

-- Limit conversation_log to 50 entries
CREATE OR REPLACE FUNCTION public.limit_conversation_log()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  log_length INT;
BEGIN
  IF NEW.conversation_log IS NOT NULL THEN
    log_length = jsonb_array_length(NEW.conversation_log);
    IF log_length > 50 THEN
      NEW.conversation_log = (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(NEW.conversation_log) WITH ORDINALITY AS t(elem, ord)
        WHERE ord > log_length - 50
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER limit_conversation_log_trigger BEFORE INSERT OR UPDATE OF conversation_log ON public.leads FOR EACH ROW EXECUTE FUNCTION public.limit_conversation_log();

-- ============================================================
-- 5. INDEXES
-- ============================================================

CREATE INDEX idx_leads_client_status ON public.leads(client_id, status);
CREATE INDEX idx_webhooks_search ON public.leads(email, product_id);
CREATE INDEX idx_leads_phone_norm ON public.leads(phone_normalized) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_status_created ON public.leads(status, created_at DESC) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_products_ext_id_client ON public.products(external_product_id, client_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_client_active ON public.products(client_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_instances_client_status ON public.instances(client_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_instances_product ON public.instances(product_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_clients_email_unique ON public.clients(email) WHERE deleted_at IS NULL;

-- ============================================================
-- 6. CONSTRAINTS
-- ============================================================

ALTER TABLE public.products ADD CONSTRAINT chk_delay_minutes_positive CHECK (delay_minutes >= 1);
ALTER TABLE public.leads ADD CONSTRAINT chk_value_non_negative CHECK (value >= 0);

-- ============================================================
-- 7. SECURITY DEFINER FUNCTIONS (backend bypass RLS)
-- ============================================================

-- Backend: insert a lead
CREATE OR REPLACE FUNCTION public.backend_insert_lead(
  p_client_id UUID, p_product_id UUID, p_name TEXT, p_email TEXT,
  p_phone TEXT, p_value NUMERIC, p_platform_lead_id TEXT DEFAULT NULL, p_checkout_url TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lead_id UUID;
BEGIN
  INSERT INTO public.leads (client_id, product_id, name, email, phone, value, platform_lead_id, checkout_url)
  VALUES (p_client_id, p_product_id, p_name, p_email, p_phone, p_value, p_platform_lead_id, p_checkout_url)
  RETURNING id INTO v_lead_id;
  RETURN v_lead_id;
END;
$$;

-- Backend: update lead status
CREATE OR REPLACE FUNCTION public.backend_update_lead_status(p_lead_id UUID, p_status TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.leads SET status = p_status::lead_status_enum WHERE id = p_lead_id;
END;
$$;

-- ============================================================
-- 8. COMMENTS
-- ============================================================

COMMENT ON TABLE public.clients IS 'SaaS customers, extends auth.users via FK';
COMMENT ON COLUMN public.clients.api_key IS 'Auto-generated API key for webhook authentication';

COMMENT ON TABLE public.products IS 'Product configurations with AI agent settings per client';
COMMENT ON COLUMN public.products.external_product_id IS 'Product ID on the source platform (Kiwify/Hotmart/Eduzz)';
COMMENT ON COLUMN public.products.agent_persona IS 'AI agent personality prompt for recovery conversations';
COMMENT ON COLUMN public.products.delay_minutes IS 'Wait time before starting recovery (min 1 minute)';

COMMENT ON TABLE public.instances IS 'WhatsApp connection instances via UAZAPI — one per product';
COMMENT ON COLUMN public.instances.instance_key IS 'UAZAPI instance name (unique identifier)';
COMMENT ON COLUMN public.instances.token IS 'UAZAPI instance auth token — used for all instance operations';
COMMENT ON COLUMN public.instances.uazapi_instance_id IS 'UAZAPI internal ID returned on creation';
COMMENT ON COLUMN public.instances.product_id IS 'Product this WhatsApp instance is linked to';

COMMENT ON TABLE public.leads IS 'Abandoned checkout leads tracked for AI-driven recovery';
COMMENT ON COLUMN public.leads.phone_normalized IS 'Phone with non-digits stripped, auto-populated by trigger';
COMMENT ON COLUMN public.leads.conversation_log IS 'JSONB array of messages, capped at 50 entries by trigger';
