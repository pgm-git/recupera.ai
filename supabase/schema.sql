-- Habilita UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela Clients (Extensão da auth.users)
CREATE TABLE public.clients (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  api_key TEXT DEFAULT uuid_generate_v4()::text,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela Instances (Conexão WhatsApp)
CREATE TABLE public.instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  instance_key TEXT UNIQUE NOT NULL, -- ID na UAZAPI
  status TEXT CHECK (status IN ('disconnected', 'connecting', 'connected')) DEFAULT 'disconnected',
  qr_code_base64 TEXT, -- Armazena temporariamente para o front pegar
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela Products (Configurações do Agente)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform TEXT CHECK (platform IN ('kiwify', 'hotmart', 'eduzz')) NOT NULL,
  external_product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  agent_persona TEXT DEFAULT 'Você é um especialista de suporte...',
  objection_handling TEXT,
  downsell_link TEXT,
  delay_minutes INTEGER DEFAULT 15,
  is_active BOOLEAN DEFAULT true,
  total_recovered NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela Leads (Core)
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  platform_lead_id TEXT, -- ID da transação na origem
  name TEXT,
  email TEXT,
  phone TEXT,
  checkout_url TEXT,
  status TEXT CHECK (status IN ('pending_recovery', 'queued', 'contacted', 'converted_organically', 'recovered_by_ai', 'failed')) DEFAULT 'pending_recovery',
  conversation_log JSONB DEFAULT '[]'::jsonb,
  value NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  purchase_at TIMESTAMP WITH TIME ZONE
);

-- Índices para performance
CREATE INDEX idx_leads_client_status ON public.leads(client_id, status);
CREATE INDEX idx_webhooks_search ON public.leads(email, product_id);

-- RLS (Segurança básica)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Políticas (Simplificadas para MVP: Usuário vê seus próprios dados)
CREATE POLICY "Users can view own client data" ON clients FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can view own products" ON products FOR ALL USING (auth.uid() = client_id);
CREATE POLICY "Users can view own leads" ON leads FOR ALL USING (auth.uid() = client_id);
CREATE POLICY "Users can view own instances" ON instances FOR ALL USING (auth.uid() = client_id);
