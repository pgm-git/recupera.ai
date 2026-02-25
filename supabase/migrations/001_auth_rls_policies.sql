-- Migration 001: Auth RLS Policies
-- Story 1.2 — Auth Foundation
--
-- 1. Drop existing overly-broad "FOR ALL" policies
-- 2. Create per-operation policies (SELECT, INSERT, UPDATE) on all 4 tables
-- 3. Create handle_new_user() trigger — auto-inserts clients row on signup
-- 4. Create SECURITY DEFINER functions for backend operations

-- ============================================================
-- 1. DROP EXISTING POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can view own client data" ON clients;
DROP POLICY IF EXISTS "Users can view own products" ON products;
DROP POLICY IF EXISTS "Users can view own leads" ON leads;
DROP POLICY IF EXISTS "Users can view own instances" ON instances;

-- ============================================================
-- 2. PER-OPERATION POLICIES
-- ============================================================

-- clients: SELECT own row
CREATE POLICY "clients_select_own"
  ON clients FOR SELECT
  USING (auth.uid() = id);

-- clients: UPDATE own row
CREATE POLICY "clients_update_own"
  ON clients FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- products: SELECT own
CREATE POLICY "products_select_own"
  ON products FOR SELECT
  USING (auth.uid() = client_id);

-- products: INSERT own
CREATE POLICY "products_insert_own"
  ON products FOR INSERT
  WITH CHECK (auth.uid() = client_id);

-- products: UPDATE own
CREATE POLICY "products_update_own"
  ON products FOR UPDATE
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

-- leads: SELECT own
CREATE POLICY "leads_select_own"
  ON leads FOR SELECT
  USING (auth.uid() = client_id);

-- leads: INSERT own
CREATE POLICY "leads_insert_own"
  ON leads FOR INSERT
  WITH CHECK (auth.uid() = client_id);

-- leads: UPDATE own
CREATE POLICY "leads_update_own"
  ON leads FOR UPDATE
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

-- instances: SELECT own
CREATE POLICY "instances_select_own"
  ON instances FOR SELECT
  USING (auth.uid() = client_id);

-- instances: INSERT own
CREATE POLICY "instances_insert_own"
  ON instances FOR INSERT
  WITH CHECK (auth.uid() = client_id);

-- instances: UPDATE own
CREATE POLICY "instances_update_own"
  ON instances FOR UPDATE
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

-- ============================================================
-- 3. AUTO-CREATE CLIENT ON SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clients (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 4. SECURITY DEFINER FUNCTIONS FOR BACKEND
-- ============================================================

-- Backend: insert a lead (bypasses RLS for webhook processing)
CREATE OR REPLACE FUNCTION public.backend_insert_lead(
  p_client_id UUID,
  p_product_id UUID,
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_value NUMERIC,
  p_platform_lead_id TEXT DEFAULT NULL,
  p_checkout_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id UUID;
BEGIN
  INSERT INTO public.leads (client_id, product_id, name, email, phone, value, platform_lead_id, checkout_url)
  VALUES (p_client_id, p_product_id, p_name, p_email, p_phone, p_value, p_platform_lead_id, p_checkout_url)
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$$;

-- Backend: update lead status (bypasses RLS for AI/webhook processing)
CREATE OR REPLACE FUNCTION public.backend_update_lead_status(
  p_lead_id UUID,
  p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.leads
  SET status = p_status
  WHERE id = p_lead_id;
END;
$$;
