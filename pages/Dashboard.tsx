import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import MetricCard from '../components/MetricCard';
import RecoveryChart from '../components/RecoveryChart';
import LeadsTable from '../components/LeadsTable';
import StatusBadge from '../components/StatusBadge';
import { getLeads, getChartData } from '../services/dataService';
import { Lead, ChartData, Metric, LeadStatus } from '../types';
import { isSupabaseConfigured } from '../lib/supabase';

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7' | '30'>('30');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [leadsData, chartDataRes] = await Promise.all([
          getLeads(),
          getChartData()
        ]);
        setLeads(leadsData);
        setChartData(chartDataRes);
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Compute real metrics from leads data
  const metrics: Metric[] = useMemo(() => {
    const recoveredLeads = leads.filter(l => l.status === 'recovered_by_ai');
    const recoveredValue = recoveredLeads.reduce((sum, l) => sum + (l.value || 0), 0);
    const contactedCount = leads.filter(l => ['contacted', 'in_conversation', 'recovered_by_ai'].includes(l.status)).length;
    const conversionRate = leads.length > 0 ? ((recoveredLeads.length / leads.length) * 100).toFixed(1) : '0';

    return [
      { label: 'Receita Recuperada', value: formatCurrency(recoveredValue), trend: 'up' as const, icon: 'dollar' as const },
      { label: 'Leads Processados', value: String(leads.length), trend: 'up' as const, icon: 'users' as const },
      { label: 'Taxa de Conversão', value: `${conversionRate}%`, trend: Number(conversionRate) >= 15 ? 'up' as const : 'neutral' as const, icon: 'activity' as const },
      { label: 'Mensagens Enviadas', value: String(contactedCount), trend: 'up' as const, icon: 'check' as const },
    ];
  }, [leads]);

  // Compute real status breakdown
  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(l => { counts[l.status] = (counts[l.status] || 0) + 1; });
    const total = leads.length || 1;

    return [
      { status: 'pending_recovery' as LeadStatus, label: 'Aguardando Recuperação', count: counts['pending_recovery'] || 0, color: 'bg-yellow-500', pct: `${Math.round(((counts['pending_recovery'] || 0) / total) * 100)}%` },
      { status: 'contacted' as LeadStatus, label: 'Contactados', count: counts['contacted'] || 0, color: 'bg-blue-500', pct: `${Math.round(((counts['contacted'] || 0) / total) * 100)}%` },
      { status: 'recovered_by_ai' as LeadStatus, label: 'Recuperados (IA)', count: counts['recovered_by_ai'] || 0, color: 'bg-emerald-500', pct: `${Math.round(((counts['recovered_by_ai'] || 0) / total) * 100)}%` },
      { status: 'failed' as LeadStatus, label: 'Falha/Bloqueio', count: counts['failed'] || 0, color: 'bg-red-500', pct: `${Math.round(((counts['failed'] || 0) / total) * 100)}%` },
    ];
  }, [leads]);

  // Filter chart data based on date range
  const filteredChartData = useMemo(() => {
    const limit = dateRange === '7' ? 7 : chartData.length;
    return chartData.slice(-limit);
  }, [chartData, dateRange]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Visão geral da sua operação de recuperação.</p>
        </div>
        <div className="mt-4 sm:mt-0 flex flex-col items-end">
             <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                Sistema Operacional
             </span>
             {!isSupabaseConfigured() && (
               <span className="text-[10px] text-red-500 mt-1">Modo Demo (Supabase Offline)</span>
             )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, idx) => (
          <MetricCard key={idx} metric={metric} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Section */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
             <h2 className="text-lg font-bold text-slate-900">Performance de Recuperação</h2>
             <select
               value={dateRange}
               onChange={e => setDateRange(e.target.value as '7' | '30')}
               className="text-sm border-slate-200 rounded-lg text-slate-600 focus:ring-brand-500 focus:border-brand-500"
               aria-label="Período do gráfico"
             >
                <option value="30">Últimos 30 dias</option>
                <option value="7">Últimos 7 dias</option>
             </select>
          </div>
          {isLoading ? (
             <div className="h-[350px] w-full flex items-center justify-center bg-slate-50 rounded-lg">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
             </div>
          ) : (
            <RecoveryChart data={filteredChartData} />
          )}
        </div>

        {/* Status Summary */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
           <h2 className="text-lg font-bold text-slate-900 mb-6">Status dos Leads</h2>
           <div className="space-y-4 flex-1">
              {statusBreakdown.map((item, idx) => (
                  <div key={idx}>
                     <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-600">{item.label}</span>
                        <span className="font-medium text-slate-900">{item.count}</span>
                     </div>
                     <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className={`h-2 rounded-full ${item.color} transition-all`} style={{ width: item.pct }}></div>
                     </div>
                  </div>
              ))}
           </div>

           <div className="mt-6 pt-6 border-t border-slate-100">
              <button
                onClick={() => navigate('/leads')}
                className="w-full py-2 px-4 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                 Ver Todos os Leads
              </button>
           </div>
        </div>
      </div>

      {/* Leads Table */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-900">Últimos Leads</h2>
          <button
            onClick={() => navigate('/leads')}
            className="text-sm text-brand-600 font-medium hover:text-brand-700"
          >
            Ver todos
          </button>
        </div>
        <LeadsTable leads={leads} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default Dashboard;
