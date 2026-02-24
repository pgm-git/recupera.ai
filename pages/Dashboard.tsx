import React, { useEffect, useState } from 'react';
import MetricCard from '../components/MetricCard';
import RecoveryChart from '../components/RecoveryChart';
import LeadsTable from '../components/LeadsTable';
import { getLeads, getChartData } from '../services/dataService'; // Mudança aqui
import { Lead, ChartData, Metric } from '../types';
import { isSupabaseConfigured } from '../lib/supabase';

const Dashboard: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const metrics: Metric[] = [
    { label: 'Receita Recuperada', value: 'R$ 15.400,00', change: '+12.5%', trend: 'up', icon: 'dollar' },
    { label: 'Leads Processados', value: '1.240', change: '+8.2%', trend: 'up', icon: 'users' },
    { label: 'Taxa de Conversão', value: '18.4%', change: '-2.1%', trend: 'down', icon: 'activity' },
    { label: 'Mensagens Enviadas', value: '3.842', change: '+5.4%', trend: 'up', icon: 'check' },
  ];

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
             <select className="text-sm border-slate-200 rounded-lg text-slate-600 focus:ring-brand-500 focus:border-brand-500">
                <option>Últimos 30 dias</option>
                <option>Últimos 7 dias</option>
             </select>
          </div>
          {isLoading ? (
             <div className="h-[350px] w-full flex items-center justify-center bg-slate-50 rounded-lg">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
             </div>
          ) : (
            <RecoveryChart data={chartData} />
          )}
        </div>

        {/* Recent Activity / Status Summary */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
           <h2 className="text-lg font-bold text-slate-900 mb-6">Status dos Leads</h2>
           <div className="space-y-4 flex-1">
              {[
                { label: 'Aguardando Recuperação', count: 45, color: 'bg-yellow-500', pct: '20%' },
                { label: 'Em Negociação', count: 128, color: 'bg-blue-500', pct: '45%' },
                { label: 'Recuperados (IA)', count: 84, color: 'bg-emerald-500', pct: '25%' },
                { label: 'Falha/Bloqueio', count: 12, color: 'bg-red-500', pct: '10%' },
              ].map((item, idx) => (
                  <div key={idx}>
                     <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-600">{item.label}</span>
                        <span className="font-medium text-slate-900">{item.count}</span>
                     </div>
                     <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className={`h-2 rounded-full ${item.color}`} style={{ width: item.pct }}></div>
                     </div>
                  </div>
              ))}
           </div>
           
           <div className="mt-6 pt-6 border-t border-slate-100">
              <button className="w-full py-2 px-4 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                 Ver Relatório Completo
              </button>
           </div>
        </div>
      </div>

      {/* Leads Table */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-900">Últimos Leads</h2>
          <button className="text-sm text-brand-600 font-medium hover:text-brand-700">Ver todos</button>
        </div>
        <LeadsTable leads={leads} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default Dashboard;