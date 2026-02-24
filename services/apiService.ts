import { supabase } from '../lib/supabase';
import { Product, Lead, Instance } from '../types';

// URL do Backend (Node.js Express)
// Usa path relativo pois o backend e frontend estão na mesma origem (porta 3000)
const API_URL = ''; 

/**
 * CLIENTS & AUTH
 * O Frontend usa o Supabase diretamente para buscar dados de leitura rápida (Dashboard),
 * mas usa o Backend para ações que exigem lógica (Conectar WhatsApp, Webhooks).
 */

export const getDashboardData = async () => {
  // Busca leads diretamente do Supabase para velocidade
  const { data: leads, error: leadError } = await supabase
    .from('leads')
    .select('*, products(name)')
    .order('created_at', { ascending: false })
    .limit(20);

  if (leadError) throw leadError;

  return leads.map((l: any) => ({
    ...l,
    productName: l.products?.name || 'Produto Desconhecido',
    createdAt: l.created_at,
    value: l.value || 0
  }));
};

/**
 * INSTANCES (WhatsApp)
 * Comunica com o Backend para falar com a UAZAPI
 */
export const connectInstance = async (clientId: string): Promise<Instance> => {
  try {
      const response = await fetch(`${API_URL}/api/whatsapp/connect/${clientId}`, {
        method: 'POST',
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Falha ao iniciar conexão: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return {
        ...data,
        qrCodeBase64: data.qr_code_base64 || data.qrCodeBase64,
      };
  } catch (error) {
      console.error("API Service Error:", error);
      throw error;
  }
};

export const checkInstanceStatus = async (clientId: string): Promise<Instance> => {
  try {
      const response = await fetch(`${API_URL}/api/whatsapp/status/${clientId}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Falha ao verificar status: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return {
        ...data,
        qrCodeBase64: data.qr_code_base64 || data.qrCodeBase64,
      };
  } catch (error) {
      console.error("API Service Error:", error);
      throw error;
  }
};

/**
 * PRODUCTS
 */
// Products related data operations should be in dataService.ts
