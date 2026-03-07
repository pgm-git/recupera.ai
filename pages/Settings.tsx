import React, { useState } from 'react';
import { Link, Key, Copy, Check, Eye, EyeOff, Save } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const Settings: React.FC = () => {
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'integrations' | 'api'>('integrations');
  const { profile } = useAuth();
  const { addToast } = useToast();
  const [openaiKey, setOpenaiKey] = useState('');
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  const userId = profile?.id || "user-id-placeholder";

  const webhookUrl = `https://api.recupa.ai/api/webhooks/${userId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setWebhookCopied(true);
    setTimeout(() => setWebhookCopied(false), 2000);
  };

  const handleSaveApiKey = async () => {
    if (!openaiKey.trim()) {
      addToast('warning', 'Informe a chave de API');
      return;
    }
    if (!openaiKey.startsWith('sk-')) {
      addToast('warning', 'Chave OpenAI deve começar com "sk-"');
      return;
    }
    setSavingKey(true);
    try {
      if (isSupabaseConfigured() && profile?.id) {
        const { error } = await supabase
          .from('clients')
          .update({ api_key: openaiKey })
          .eq('id', profile.id);
        if (error) throw error;
      }
      addToast('success', 'Chave de API salva com sucesso');
      setOpenaiKey('');
    } catch {
      addToast('error', 'Erro ao salvar chave de API');
    } finally {
      setSavingKey(false);
    }
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

        {/* Webhook URL Section */}
        {activeTab === 'integrations' && (
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
                        <p className="text-xs text-slate-400 mt-2">
                            A conexão WhatsApp é feita por produto na página de Produtos.
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
                            Chave de API usada pelo agente de IA para gerar mensagens de recuperação via GPT-4o-mini.
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Chave de API</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showOpenaiKey ? 'text' : 'password'}
                      value={openaiKey}
                      onChange={e => setOpenaiKey(e.target.value)}
                      placeholder="sk-proj-..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 font-mono text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                      aria-label={showOpenaiKey ? 'Ocultar chave' : 'Mostrar chave'}
                    >
                      {showOpenaiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Sua chave é armazenada de forma segura e nunca exibida após salvar.
                </p>
              </div>

              <button
                onClick={handleSaveApiKey}
                disabled={savingKey || !openaiKey.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium text-sm"
              >
                <Save size={16} />
                {savingKey ? 'Salvando...' : 'Salvar Chave'}
              </button>
            </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default Settings;
