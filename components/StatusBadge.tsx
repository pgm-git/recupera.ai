import React from 'react';
import { CheckCircle, MessageSquare, Clock, XCircle, ShoppingCart, PhoneOff, AlertCircle, PhoneForwarded, Ban } from 'lucide-react';
import { LeadStatus } from '../types';

interface StatusBadgeProps {
  status: LeadStatus;
  size?: 'sm' | 'md';
}

const statusConfig: Record<LeadStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending_recovery: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  queued: { label: 'Na Fila', color: 'bg-orange-100 text-orange-800', icon: Clock },
  contacted: { label: 'Contactado', color: 'bg-blue-100 text-blue-800', icon: MessageSquare },
  in_conversation: { label: 'Em Conversa', color: 'bg-indigo-100 text-indigo-800', icon: PhoneForwarded },
  converted_organically: { label: 'Orgânico', color: 'bg-purple-100 text-purple-800', icon: ShoppingCart },
  recovered_by_ai: { label: 'Recuperado IA', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
  failed: { label: 'Falha', color: 'bg-red-100 text-red-800', icon: XCircle },
  escalated: { label: 'Escalado', color: 'bg-amber-100 text-amber-800', icon: AlertCircle },
  do_not_contact: { label: 'Não Contactar', color: 'bg-slate-100 text-slate-800', icon: Ban },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const config = statusConfig[status] || { label: status, color: 'bg-slate-100 text-slate-800', icon: Clock };
  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${config.color} ${sizeClasses}`}
      aria-label={`Status: ${config.label}`}
    >
      <Icon size={size === 'sm' ? 12 : 14} className="mr-1" />
      {config.label}
    </span>
  );
};

export default StatusBadge;
