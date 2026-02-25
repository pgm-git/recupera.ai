export type LeadStatus = 'pending_recovery' | 'queued' | 'contacted' | 'in_conversation' | 'converted_organically' | 'recovered_by_ai' | 'failed' | 'escalated' | 'do_not_contact';

export interface Client {
  id: string;
  email: string;
  name: string;
  apiKey: string;
  updatedAt?: string;
}

export interface Instance {
  id: string;
  clientId: string;
  status: 'disconnected' | 'connecting' | 'connected';
  qrCodeBase64?: string;
  instanceKey: string; // A chave da instância UAZAPI armazenada no banco
}

export interface Product {
  id: string;
  clientId?: string;
  platform: 'kiwify' | 'hotmart' | 'eduzz';
  externalProductId: string; // ID do produto na plataforma (ex: curso-python-123)
  name: string;
  agentPersona: string; // "Você é um especialista..."
  objectionHandling?: string; // Como lidar com "tá caro"
  downsellLink?: string; // Link com desconto
  delayMinutes: number;
  isActive: boolean;
  totalRecovered: number;
  abandonedCount?: number;
  recoveredCount?: number;
  revenue?: number;
  updatedAt?: string;
  deletedAt?: string;
}

export interface Lead {
  id: string;
  productId?: string;
  name: string;
  phone: string;
  email: string;
  status: LeadStatus;
  checkoutUrl?: string;
  conversationLog?: any[]; // JSONB
  value?: number;
  productName?: string;
  createdAt: string;
  updatedAt?: string;
  phoneNormalized?: string;
  recoveryAttempts?: number;
  nextContactScheduledAt?: string;
  conversationSummary?: string;
  detectedObjections?: string[];
}

export interface Metric {
  label: string;
  value: string | number;
  change?: string;
  trend: 'up' | 'down' | 'neutral';
  icon: 'dollar' | 'users' | 'activity' | 'check';
}

export interface ChartData {
  name: string;
  abandoned: number;
  recovered: number;
}