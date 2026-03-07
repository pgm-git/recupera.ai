-- Migration 003: Add missing columns to instances table
-- Required for per-product WhatsApp architecture
--
-- The original schema.sql created instances without:
--   product_id, token, uazapi_instance_id
-- These columns exist in 000_clean_and_init.sql but not in the incremental migration path.

-- ============================================================
-- 1. ADD MISSING COLUMNS
-- ============================================================

ALTER TABLE public.instances
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.instances
  ADD COLUMN IF NOT EXISTS token TEXT;

ALTER TABLE public.instances
  ADD COLUMN IF NOT EXISTS uazapi_instance_id TEXT;

-- ============================================================
-- 2. ADD INDEX FOR product_id LOOKUPS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_instances_product
  ON public.instances(product_id)
  WHERE deleted_at IS NULL;

-- ============================================================
-- 3. ADD DELETE RLS POLICY (needed for stale token cleanup)
-- ============================================================

-- Backend uses service_role key (bypasses RLS), but add policy
-- for completeness in case frontend ever needs to delete instances.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'instances' AND policyname = 'instances_delete_own'
  ) THEN
    CREATE POLICY "instances_delete_own" ON public.instances
      FOR DELETE USING (auth.uid() = client_id);
  END IF;
END
$$;

-- ============================================================
-- 4. COMMENTS
-- ============================================================

COMMENT ON COLUMN public.instances.product_id IS 'Product this WhatsApp instance is linked to';
COMMENT ON COLUMN public.instances.token IS 'UAZAPI instance auth token — used for all instance operations';
COMMENT ON COLUMN public.instances.uazapi_instance_id IS 'UAZAPI internal ID returned on creation';
