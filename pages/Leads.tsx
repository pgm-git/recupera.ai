import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { getLeadsPaginated, LeadsPage } from '../services/dataService';
import { Lead, LeadStatus } from '../types';
import StatusBadge from '../components/StatusBadge';

const PAGE_SIZE = 20;

const statusOptions: { value: string; label: string }[] = [
  { value: 'all', label: 'Todos Status' },
  { value: 'pending_recovery', label: 'Aguardando' },
  { value: 'contacted', label: 'Contactados' },
  { value: 'in_conversation', label: 'Em Conversa' },
  { value: 'recovered_by_ai', label: 'Recuperados' },
  { value: 'failed', label: 'Falha' },
  { value: 'do_not_contact', label: 'Não Contactar' },
];

const formatCurrency = (val?: number) => {
  if (val == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const formatDate = (dateStr: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(dateStr));

const Leads: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [data, setData] = useState<LeadsPage>({ leads: [], total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getLeadsPaginated({
        page,
        pageSize: PAGE_SIZE,
        search: searchQuery || undefined,
        status: statusFilter,
      });
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar leads');
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, statusFilter]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleSearch = () => {
    setPage(0);
    setSearchQuery(searchInput);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleStatusChange = (value: string) => {
    setPage(0);
    setStatusFilter(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
        <p className="text-slate-500 mt-1">
          {data.total > 0 ? `${data.total} lead${data.total !== 1 ? 's' : ''} encontrado${data.total !== 1 ? 's' : ''}` : 'Todos os leads de recuperação.'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onBlur={handleSearch}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            aria-label="Buscar leads"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => handleStatusChange(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          aria-label="Filtrar por status"
        >
          {statusOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle size={20} />
          <span className="text-sm">{error}</span>
          <button onClick={fetchLeads} className="ml-auto text-sm font-medium hover:underline">Tentar novamente</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Cliente</th>
                <th className="px-6 py-4 font-semibold">Produto</th>
                <th className="px-6 py-4 font-semibold">Valor</th>
                <th className="px-6 py-4 font-semibold">Data</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse w-32" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse w-24" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse w-20" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse w-28" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse w-20" /></td>
                  </tr>
                ))
              ) : data.leads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    {searchQuery || statusFilter !== 'all'
                      ? 'Nenhum lead encontrado com os filtros selecionados.'
                      : 'Nenhum lead registrado ainda.'}
                  </td>
                </tr>
              ) : (
                data.leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    role="link"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && navigate(`/leads/${lead.id}`)}
                    aria-label={`Ver detalhes de ${lead.name}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900">{lead.name}</span>
                        <span className="text-xs text-slate-500">{lead.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{lead.productName || '—'}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{formatCurrency(lead.value)}</td>
                    <td className="px-6 py-4 text-slate-500">{formatDate(lead.createdAt)}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={lead.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && data.total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
            <span className="text-sm text-slate-500">
              Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data.total)} de {data.total}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-slate-600 px-2">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Próxima página"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leads;
