import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lead } from '../types';
import StatusBadge from './StatusBadge';

interface LeadsTableProps {
  leads: Lead[];
  isLoading: boolean;
}

const LeadsTable: React.FC<LeadsTableProps> = ({ leads, isLoading }) => {
  const navigate = useNavigate();

  const formatCurrency = (val?: number) => {
    if (val == null) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
  };

  if (isLoading) {
    return (
      <div className="w-full bg-white rounded-xl border border-slate-200 p-8 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
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
            {leads.map((lead) => (
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
            ))}
          </tbody>
        </table>
      </div>
      {leads.length === 0 && (
         <div className="p-8 text-center text-slate-500">
            Nenhum lead encontrado recentemente.
         </div>
      )}
    </div>
  );
};

export default LeadsTable;
