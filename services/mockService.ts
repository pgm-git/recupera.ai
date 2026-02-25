import { Lead, Product, ChartData } from '../types';

export const mockLeads: Lead[] = [
  { id: '1', name: 'Carlos Silva', phone: '+55 11 99999-9999', email: 'carlos@email.com', status: 'recovered_by_ai', productName: 'Curso Python Pro', value: 297.00, createdAt: '2023-10-25T14:30:00Z' },
  { id: '2', name: 'Ana Souza', phone: '+55 21 98888-8888', email: 'ana@email.com', status: 'contacted', productName: 'Mentoria 10x', value: 997.00, createdAt: '2023-10-25T15:00:00Z' },
  { id: '3', name: 'Marcos Oliveira', phone: '+55 31 97777-7777', email: 'marcos@email.com', status: 'pending_recovery', productName: 'Ebook Low Carb', value: 47.90, createdAt: '2023-10-25T15:15:00Z' },
  { id: '4', name: 'Julia Santos', phone: '+55 41 96666-6666', email: 'julia@email.com', status: 'converted_organically', productName: 'Curso Python Pro', value: 297.00, createdAt: '2023-10-25T13:00:00Z' },
  { id: '5', name: 'Pedro Lima', phone: '+55 51 95555-5555', email: 'pedro@email.com', status: 'failed', productName: 'Mentoria 10x', value: 997.00, createdAt: '2023-10-24T18:00:00Z' },
];

export const mockProducts: Product[] = [
  { id: '1', name: 'Curso Python Pro', platform: 'hotmart', isActive: true, agentPersona: 'Especialista amigável em tecnologia.', delayMinutes: 15, totalRecovered: 15400.00, externalProductId: 'python-pro-01' },
  { id: '2', name: 'Mentoria 10x', platform: 'kiwify', isActive: true, agentPersona: 'Consultor de negócios sênior, tom formal.', delayMinutes: 30, totalRecovered: 45000.00, externalProductId: 'mentoria-10x' },
  { id: '3', name: 'Ebook Low Carb', platform: 'eduzz', isActive: false, agentPersona: 'Nutricionista motivadora.', delayMinutes: 15, totalRecovered: 1200.00, externalProductId: 'ebook-low-carb' },
];

export const mockChartData: ChartData[] = [
  { name: '01/10', abandoned: 40, recovered: 24 },
  { name: '05/10', abandoned: 30, recovered: 18 },
  { name: '10/10', abandoned: 20, recovered: 15 },
  { name: '15/10', abandoned: 27, recovered: 20 },
  { name: '20/10', abandoned: 18, recovered: 12 },
  { name: '25/10', abandoned: 23, recovered: 18 },
  { name: '30/10', abandoned: 34, recovered: 28 },
];

export const getLeads = async (): Promise<Lead[]> => {
  return new Promise((resolve) => setTimeout(() => resolve(mockLeads), 800));
};

export const getProducts = async (): Promise<Product[]> => {
  return new Promise((resolve) => setTimeout(() => resolve(mockProducts), 600));
};

export const getChartData = async (): Promise<ChartData[]> => {
  return new Promise((resolve) => setTimeout(() => resolve(mockChartData), 500));
};

export const toggleProductStatus = async (id: string): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, 300));
};