-- Migration 002: Schema Evolution
-- Story 1.3 — Database Evolution
--
-- 1. Create ENUMs (replace CHECK constraints)
-- 2. Add new columns (updated_at, deleted_at, phone_normalized, etc.)
-- 3. Backfill existing data (before triggers to avoid interference)
-- 4. Create triggers (updated_at, phone normalization, conversation_log limit)
-- 5. Add indexes for performance
-- 6. Add constraints
-- 7. Add table/column comments

-- ============================================================
-- 1. CREATE ENUMS & MIGRATE COLUMNS
-- ============================================================

CREATE TYPE platform_enum AS ENUM ('kiwify', 'hotmart', 'eduzz');
CREATE TYPE lead_status_enum AS ENUM (
  'pending_recovery', 'queued', 'contacted', 'in_conversation',
  'converted_organically', 'recovered_by_ai', 'failed', 'escalated', 'do_not_contact'
);
CREATE TYPE instance_status_enum AS ENUM ('disconnected', 'connecting', 'connected');

-- Drop existing inline CHECK constraints before altering column types
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_platform_check;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.instances DROP CONSTRAINT IF EXISTS instances_status_check;

-- Alter columns from TEXT to ENUM
ALTER TABLE public.products
  ALTER COLUMN platform TYPE platform_enum USING platform::platform_enum;

ALTER TABLE public.leads
  ALTER COLUMN status TYPE lead_status_enum USING status::lead_status_enum;

ALTER TABLE public.instances
  ALTER COLUMN status TYPE instance_status_enum USING status::instance_status_enum;

-- ============================================================
-- 2. ADD NEW COLUMNS
-- ============================================================

-- clients (does NOT have updated_at yet)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- products (does NOT have updated_at yet)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- leads (does NOT have updated_at yet)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_normalized TEXT,
  ADD COLUMN IF NOT EXISTS recovery_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_contact_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS conversation_summary TEXT,
  ADD COLUMN IF NOT EXISTS detected_objections TEXT[] DEFAULT '{}';

-- instances (already has updated_at, only add deleted_at)
ALTER TABLE public.instances
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================
-- 3. BACKFILL EXISTING DATA (before triggers)
-- ============================================================

-- Set updated_at = created_at for existing rows
UPDATE public.clients SET updated_at = created_at;
UPDATE public.products SET updated_at = created_at;
UPDATE public.leads SET updated_at = created_at;

-- Backfill phone_normalized for existing leads
UPDATE public.leads
  SET phone_normalized = regexp_replace(phone, '[^0-9]', '', 'g')
  WHERE phone IS NOT NULL AND phone_normalized IS NULL;

-- ============================================================
-- 4. TRIGGERS
-- ============================================================

-- 4a. Shared updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Attach to all tables
DROP TRIGGER IF EXISTS set_updated_at ON public.clients;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.products;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.leads;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.instances;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.instances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4b. Phone normalization trigger
CREATE OR REPLACE FUNCTION public.normalize_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    NEW.phone_normalized = regexp_replace(NEW.phone, '[^0-9]', '', 'g');
  ELSE
    NEW.phone_normalized = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_phone_trigger ON public.leads;
CREATE TRIGGER normalize_phone_trigger
  BEFORE INSERT OR UPDATE OF phone ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_phone();

-- 4c. Limit conversation_log to 50 entries
CREATE OR REPLACE FUNCTION public.limit_conversation_log()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  log_length INT;
BEGIN
  IF NEW.conversation_log IS NOT NULL THEN
    log_length = jsonb_array_length(NEW.conversation_log);
    IF log_length > 50 THEN
      -- Keep the last 50 entries in original order
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

DROP TRIGGER IF EXISTS limit_conversation_log_trigger ON public.leads;
CREATE TRIGGER limit_conversation_log_trigger
  BEFORE INSERT OR UPDATE OF conversation_log ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.limit_conversation_log();

-- ============================================================
-- 5. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_leads_phone_norm
  ON public.leads (phone_normalized)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_ext_id_client
  ON public.products (external_product_id, client_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_created_at
  ON public.leads (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_client_active
  ON public.products (client_id, is_active)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_instances_client_status
  ON public.instances (client_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_status_created
  ON public.leads (status, created_at DESC)
  WHERE deleted_at IS NULL;

-- ============================================================
-- 6. CONSTRAINTS
-- ============================================================

-- Partial unique on clients.email (only active/non-deleted rows)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_email_unique
  ON public.clients (email)
  WHERE deleted_at IS NULL;

-- CHECK constraints
ALTER TABLE public.products
  ADD CONSTRAINT chk_delay_minutes_positive CHECK (delay_minutes >= 1);

ALTER TABLE public.leads
  ADD CONSTRAINT chk_value_non_negative CHECK (value >= 0);

-- ============================================================
-- 7. TABLE AND COLUMN COMMENTS
-- ============================================================

COMMENT ON TABLE public.clients IS 'SaaS customers, extends auth.users via FK';
COMMENT ON COLUMN public.clients.api_key IS 'Auto-generated API key for webhook authentication';
COMMENT ON COLUMN public.clients.deleted_at IS 'Soft delete timestamp';
COMMENT ON COLUMN public.clients.updated_at IS 'Last modification timestamp, auto-updated by trigger';

COMMENT ON TABLE public.products IS 'Product configurations with AI agent settings per client';
COMMENT ON COLUMN public.products.external_product_id IS 'Product ID on the source platform (Kiwify/Hotmart/Eduzz)';
COMMENT ON COLUMN public.products.agent_persona IS 'AI agent personality prompt for recovery conversations';
COMMENT ON COLUMN public.products.delay_minutes IS 'Wait time before starting recovery (min 1 minute)';
COMMENT ON COLUMN public.products.deleted_at IS 'Soft delete timestamp';
COMMENT ON COLUMN public.products.updated_at IS 'Last modification timestamp, auto-updated by trigger';

COMMENT ON TABLE public.leads IS 'Abandoned checkout leads tracked for AI-driven recovery';
COMMENT ON COLUMN public.leads.phone_normalized IS 'Phone with non-digits stripped, auto-populated by trigger';
COMMENT ON COLUMN public.leads.recovery_attempts IS 'Number of recovery contact attempts made';
COMMENT ON COLUMN public.leads.next_contact_scheduled_at IS 'When the next recovery attempt is scheduled';
COMMENT ON COLUMN public.leads.conversation_summary IS 'AI-generated summary of the recovery conversation';
COMMENT ON COLUMN public.leads.detected_objections IS 'Array of objections detected during conversation';
COMMENT ON COLUMN public.leads.conversation_log IS 'JSONB array of messages, capped at 50 entries by trigger';
COMMENT ON COLUMN public.leads.deleted_at IS 'Soft delete timestamp';
COMMENT ON COLUMN public.leads.updated_at IS 'Last modification timestamp, auto-updated by trigger';

COMMENT ON TABLE public.instances IS 'WhatsApp connection instances via UAZAPI';
COMMENT ON COLUMN public.instances.instance_key IS 'Unique instance identifier in UAZAPI';
COMMENT ON COLUMN public.instances.deleted_at IS 'Soft delete timestamp';
