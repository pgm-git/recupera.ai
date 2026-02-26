import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, ExternalLink, Clock, MessageSquare, User } from 'lucide-react';
import { getLead, updateLeadStatus } from '../services/dataService';
import { Lead, LeadStatus } from '../types';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../contexts/ToastContext';

const formatDate = (dateStr: string) => {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
};

const formatCurrency = (val?: number) => {
  if (val == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const LeadDetail: React.FC = () => {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!leadId) return;
    setIsLoading(true);
    getLead(leadId)
      .then(data => setLead(data))
      .catch(() => addToast('error', 'Erro ao carregar lead'))
      .finally(() => setIsLoading(false));
  }, [leadId]);

  const handleStatusChange = async (newStatus: LeadStatus) => {
    if (!lead) return;
    try {
      await updateLeadStatus(lead.id, newStatus);
      setLead({ ...lead, status: newStatus });
      addToast('success', 'Status atualizado com sucesso');
    } catch {
      addToast('error', 'Erro ao atualizar status');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Lead não encontrado.</p>
        <button onClick={() => navigate('/')} className="mt-4 text-brand-600 hover:text-brand-700 font-medium">
          Voltar ao Dashboard
        </button>
      </div>
    );
  }

  const conversationLog = lead.conversationLog || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{lead.name || 'Lead sem nome'}</h1>
          <p className="text-slate-500 text-sm mt-1">{lead.productName || 'Produto não vinculado'}</p>
        </div>
        <StatusBadge status={lead.status} size="md" />
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <User size={16} />
            <span className="text-xs font-medium uppercase">Contato</span>
          </div>
          <p className="text-sm font-medium text-slate-900">{lead.name}</p>
          <div className="flex items-center gap-1 mt-1 text-sm text-slate-600">
            <Mail size={14} /> {lead.email}
          </div>
          <div className="flex items-center gap-1 mt-1 text-sm text-slate-600">
            <Phone size={14} /> {lead.phone}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Clock size={16} />
            <span className="text-xs font-medium uppercase">Timeline</span>
          </div>
          <p className="text-sm text-slate-600">Criado: {formatDate(lead.createdAt)}</p>
          {lead.updatedAt && <p className="text-sm text-slate-600">Atualizado: {formatDate(lead.updatedAt)}</p>}
          {lead.recoveryAttempts != null && (
            <p className="text-sm text-slate-600 mt-1">Tentativas: {lead.recoveryAttempts}</p>
          )}
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <ExternalLink size={16} />
            <span className="text-xs font-medium uppercase">Valor</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(lead.value)}</p>
          {lead.checkoutUrl && (
            <a href={lead.checkoutUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline mt-2 inline-block">
              Ver checkout
            </a>
          )}
        </div>
      </div>

      {/* Status Actions */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Alterar Status</h3>
        <div className="flex flex-wrap gap-2">
          {(['pending_recovery', 'contacted', 'recovered_by_ai', 'failed', 'do_not_contact'] as LeadStatus[]).map(status => (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              disabled={lead.status === status}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                lead.status === status
                  ? 'bg-brand-50 border-brand-200 text-brand-700 font-semibold'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <StatusBadge status={status} />
            </button>
          ))}
        </div>
      </div>

      {/* Conversation Summary */}
      {lead.conversationSummary && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Resumo da Conversa</h3>
          <p className="text-sm text-slate-600">{lead.conversationSummary}</p>
        </div>
      )}

      {/* Conversation Log */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <MessageSquare size={18} className="text-brand-600" />
            Conversa ({conversationLog.length} mensagens)
          </h3>
        </div>

        <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto" id="conversation-scroll">
          {conversationLog.length === 0 ? (
            <p className="text-center text-slate-400 py-8">Nenhuma mensagem registrada.</p>
          ) : (
            conversationLog.map((msg: any, idx: number) => {
              const isAI = msg.role === 'assistant';
              return (
                <div key={idx} className={`flex ${isAI ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                      isAI
                        ? 'bg-slate-100 text-slate-800 rounded-tl-md'
                        : 'bg-brand-600 text-white rounded-tr-md'
                    }`}
                  >
                    <p>{msg.content || msg.text || msg.message || ''}</p>
                    {msg.timestamp && (
                      <span className={`text-[10px] mt-1 block ${isAI ? 'text-slate-400' : 'text-brand-200'}`}>
                        {formatDate(msg.timestamp)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default LeadDetail;
