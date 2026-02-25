import React from 'react';
import { DollarSign, Users, Activity, CheckCircle2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Metric } from '../types';

interface MetricCardProps {
  metric: Metric;
}

const MetricCard: React.FC<MetricCardProps> = ({ metric }) => {
  const getIcon = () => {
    switch (metric.icon) {
      case 'dollar': return <DollarSign size={22} className="text-emerald-600" />;
      case 'users': return <Users size={22} className="text-brand-600" />;
      case 'activity': return <Activity size={22} className="text-purple-600" />;
      case 'check': return <CheckCircle2 size={22} className="text-orange-600" />;
      default: return <Activity size={22} />;
    }
  };

  const getTrendIcon = () => {
    switch(metric.trend) {
      case 'up': return <TrendingUp size={16} className="text-emerald-500 mr-1" />;
      case 'down': return <TrendingDown size={16} className="text-red-500 mr-1" />;
      default: return <Minus size={16} className="text-slate-400 mr-1" />;
    }
  };

  const getTrendColor = () => {
      switch(metric.trend) {
          case 'up': return 'text-emerald-600 bg-emerald-50';
          case 'down': return 'text-red-600 bg-red-50';
          default: return 'text-slate-600 bg-slate-50';
      }
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm font-medium text-slate-500 mb-1">{metric.label}</p>
          <h3 className="text-2xl font-bold text-slate-900">{metric.value}</h3>
        </div>
        <div className={`p-2 rounded-lg bg-opacity-10 ${
            metric.icon === 'dollar' ? 'bg-emerald-100' : 
            metric.icon === 'users' ? 'bg-brand-100' :
            metric.icon === 'activity' ? 'bg-purple-100' : 'bg-orange-100'
        }`}>
            {getIcon()}
        </div>
      </div>
      
      {metric.change && (
        <div className="flex items-center">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTrendColor()}`}>
             {getTrendIcon()}
             {metric.change}
          </span>
          <span className="text-xs text-slate-400 ml-2">vs. mês anterior</span>
        </div>
      )}
    </div>
  );
};

export default MetricCard;