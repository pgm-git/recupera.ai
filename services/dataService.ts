import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Lead, Product, ChartData } from '../types';
import { mockLeads, mockProducts, mockChartData } from './mockService';

// Mappers para converter snake_case do banco para camelCase do Frontend
const mapLead = (data: any): Lead => ({
  id: data.id,
  name: data.name,
  phone: data.phone,
  email: data.email,
  status: data.status,
  productName: data.product_name,
  value: Number(data.value),
  createdAt: data.created_at,
  updatedAt: data.updated_at,
  phoneNormalized: data.phone_normalized,
  recoveryAttempts: data.recovery_attempts,
  nextContactScheduledAt: data.next_contact_scheduled_at,
  conversationSummary: data.conversation_summary,
  detectedObjections: data.detected_objections
});

const mapProduct = (data: any): Product => ({
  id: data.id,
  name: data.name,
  platform: data.platform,
  isActive: data.is_active,
  agentPersona: data.agent_persona,
  delayMinutes: data.delay_minutes,
  downsellLink: data.downsell_link,
  totalRecovered: Number(data.total_recovered),
  externalProductId: data.external_product_id,
  abandonedCount: data.abandoned_count || Math.floor(Math.random() * 50) + 10, // Mock for demo
  recoveredCount: data.recovered_count || Math.floor(Math.random() * 10) + 1, // Mock for demo
  revenue: data.revenue || Math.floor(Math.random() * 5000) + 1000, // Mock for demo
  updatedAt: data.updated_at,
  deletedAt: data.deleted_at
});

export const getLeads = async (): Promise<Lead[]> => {
  if (!isSupabaseConfigured()) {
    console.warn("Supabase não configurado. Usando dados mockados.");
    return new Promise(resolve => setTimeout(() => resolve(mockLeads), 800));
  }

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Erro ao buscar leads:', error);
    return mockLeads;
  }
  return data.map(mapLead);
};

export const getProducts = async (): Promise<Product[]> => {
  if (!isSupabaseConfigured()) {
     return new Promise(resolve => setTimeout(() => resolve(mockProducts), 600));
  }

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name');

  if (error) {
    console.error('Erro ao buscar produtos:', error);
    return mockProducts;
  }
  return data.map(mapProduct);
};

export const getChartData = async (): Promise<ChartData[]> => {
  // Chart data geralmente requer agregações complexas (Group By). 
  // Para o MVP frontend, manteremos o mock ou você pode criar uma View no Supabase.
  return new Promise(resolve => setTimeout(() => resolve(mockChartData), 500));
};

export const toggleProductStatus = async (id: string, currentStatus: boolean): Promise<void> => {
  if (!isSupabaseConfigured()) {
    return new Promise(resolve => setTimeout(resolve, 300));
  }

  const { error } = await supabase
    .from('products')
    .update({ is_active: !currentStatus })
    .eq('id', id);

  if (error) throw error;
};

// Nova função para simular busca de QR Code do Backend
export const fetchQRCode = async (): Promise<string> => {
  // Em produção, isso faria um fetch('/api/whatsapp/connect')
  // Simulating network delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Retorna um placeholder base64 ou URL real
  // Na vida real, a API do whatsapp retorna "data:image/png;base64,..."
  return 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=RecupaAI-Prod-Connection';
};

export const checkConnectionStatus = async (): Promise<'connected' | 'disconnected' | 'connecting'> => {
   // Simula verificação
   return 'disconnected';
};

export const saveProductConfig = async (product: Partial<Product>, userId?: string) => {
  if (!isSupabaseConfigured()) {
     // Mock implementation for demo mode
     // Returns a product with a fake ID so the UI can display it
     const mockProduct: Product = {
        id: product.id || Math.random().toString(36).substr(2, 9),
        name: product.name || 'Novo Produto',
        platform: product.platform || 'hotmart',
        externalProductId: product.externalProductId || '123',
        agentPersona: product.agentPersona || '',
        objectionHandling: product.objectionHandling,
        downsellLink: product.downsellLink,
        delayMinutes: product.delayMinutes || 15,
        isActive: product.isActive !== undefined ? product.isActive : true,
        totalRecovered: product.totalRecovered || 0,
        abandonedCount: product.abandonedCount || 0,
        recoveredCount: product.recoveredCount || 0,
        revenue: product.revenue || 0,
        clientId: product.clientId || 'demo-client'
     };
     return mockProduct;
  }

  // Map camelCase properties to snake_case for DB
  const dbPayload: any = { ...product };
  
  // Remove ID if it's undefined/empty string to let Supabase generate it
  if (!dbPayload.id) {
      delete dbPayload.id;
  }

  // Set client_id from authenticated user for new inserts (required by RLS)
  if (!dbPayload.client_id && userId) {
    dbPayload.client_id = userId;
  }

  if(product.isActive !== undefined) dbPayload.is_active = product.isActive;
  if(product.agentPersona !== undefined) dbPayload.agent_persona = product.agentPersona;
  if(product.delayMinutes !== undefined) dbPayload.delay_minutes = product.delayMinutes;
  if(product.downsellLink !== undefined) dbPayload.downsell_link = product.downsellLink;
  if(product.externalProductId !== undefined) dbPayload.external_product_id = product.externalProductId;
  
  // Clean up camelCase keys
  delete dbPayload.isActive;
  delete dbPayload.agentPersona;
  delete dbPayload.delayMinutes;
  delete dbPayload.downsellLink;
  delete dbPayload.externalProductId;
  delete dbPayload.totalRecovered;
  delete dbPayload.abandonedCount;
  delete dbPayload.recoveredCount;
  delete dbPayload.revenue;
  delete dbPayload.clientId;
  delete dbPayload.productName; // Cleanup potential extra fields

  const { data, error } = await supabase
    .from('products')
    .upsert(dbPayload)
    .select()
    .single();
    
  if (error) throw error;
  return data ? mapProduct(data) : null;
};