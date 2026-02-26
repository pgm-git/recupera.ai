import React, { useState } from 'react';
import QRModal from '../components/QRModal';
import { Smartphone, Link, Key, Save, AlertCircle, Copy, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const Settings: React.FC = () => {
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'integrations' | 'api' | 'account'>('integrations');
  const { profile } = useAuth();

  const userId = profile?.id || "user-id-placeholder";

  const webhookUrl = `https://api.recupa.ai/api/webhooks/${userId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setWebhookCopied(true);
    setTimeout(() => setWebhookCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-slate-500 mt-1">Gerencie suas integrações e preferências da conta.</p>
      </div>

      <div className="flex border-b border-slate-200">
        <button 
            onClick={() => setActiveTab('integrations')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'integrations' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
            Integrações
        </button>
        <button 
            onClick={() => setActiveTab('api')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'api' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
            Chaves de API
        </button>
      </div>

      {/* Content based on Tab */}
      <div className="space-y-6">
        
        {/* WhatsApp Connection */}
        {activeTab === 'integrations' && (
            <>
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="flex justify-between items-start">
                    <div className="flex space-x-4">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 flex-shrink-0">
                            <Smartphone size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">WhatsApp (UAZAPI)</h3>
                            <p className="text-sm text-slate-500 mt-1 max-w-lg">
                                Conecte seu WhatsApp via UAZAPI para enviar mensagens de recuperação.
                            </p>
                            <div className="flex items-center mt-3 space-x-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                                    Desconectado
                                </span>
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={() => setIsQRModalOpen(true)}
                        className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium text-sm transition-colors"
                    >
                        Conectar Instância
                    </button>
                </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex space-x-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 flex-shrink-0">
                            <Link size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">Webhook Global</h3>
                            <p className="text-sm text-slate-500 mt-1 max-w-lg">
                                URL para configurar na Hotmart/Kiwify. Os eventos serão processados automaticamente.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between">
                    <code className="text-sm text-slate-700 font-mono break-all">{webhookUrl}</code>
                    <button 
                        onClick={handleCopy}
                        className="ml-4 p-2 text-slate-500 hover:text-brand-600 hover:bg-white rounded-md transition-all"
                        title="Copiar URL"
                    >
                        {webhookCopied ? <Check size={20} className="text-emerald-500" /> : <Copy size={20} />}
                    </button>
                </div>
                </div>
            </>
        )}

        {/* OpenAI Configuration */}
        {activeTab === 'api' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-start mb-6">
                <div className="flex space-x-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 flex-shrink-0">
                        <Key size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900">OpenAI API Key</h3>
                        <p className="text-sm text-slate-500 mt-1 max-w-lg">
                            Chave de API para o agente de IA.
                        </p>
                    </div>
                </div>
            </div>
            {/* Input fields... */}
            </div>
        )}

      </div>

      <QRModal isOpen={isQRModalOpen} onClose={() => setIsQRModalOpen(false)} />
    </div>
  );
};

export default Settings;