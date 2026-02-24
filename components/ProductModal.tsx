import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { X, Save, Bot, Settings, DollarSign } from 'lucide-react';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product;
  onSave: (product: Partial<Product>) => Promise<void>;
}

const ProductModal: React.FC<ProductModalProps> = ({ isOpen, onClose, product, onSave }) => {
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    platform: 'hotmart',
    externalProductId: '',
    agentPersona: 'Você é um especialista em recuperação de vendas. Seu tom é amigável e prestativo.',
    objectionHandling: 'Se o cliente achar caro, ofereça o link de downsell. Se tiver dúvidas técnicas, explique brevemente.',
    downsellLink: '',
    delayMinutes: 15,
    isActive: true
  });
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'ai'>('basic');

  useEffect(() => {
    if (product) {
      setFormData(product);
    } else {
        // Reset form for new product
        setFormData({
            name: '',
            platform: 'hotmart',
            externalProductId: '',
            agentPersona: 'Você é um especialista em recuperação de vendas. Seu tom é amigável e prestativo.',
            objectionHandling: '',
            downsellLink: '',
            delayMinutes: 15,
            isActive: true
        });
    }
  }, [product, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">
            {product ? 'Editar Produto e Agente' : 'Novo Produto'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
            <button
                onClick={() => setActiveTab('basic')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'basic' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                <Settings size={16} /> Configurações Básicas
            </button>
            <button
                onClick={() => setActiveTab('ai')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'ai' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                <Bot size={16} /> Configuração do Agente IA
            </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto">
          {product && (
             <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">Webhook para Configuração</h3>
                <p className="text-xs text-blue-600 mb-2">Copie esta URL e configure na sua plataforma ({formData.platform}) para eventos de "Abandono de Carrinho" e "Compra Aprovada".</p>
                <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white px-3 py-2 rounded border border-blue-200 text-xs font-mono text-slate-600 break-all">
                        {window.location.origin}/api/webhooks/{product.clientId || 'CLIENT_ID'}
                    </code>
                    <button 
                        type="button"
                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/${product.clientId || 'CLIENT_ID'}`)}
                        className="p-2 bg-white border border-blue-200 rounded hover:bg-blue-100 text-blue-600"
                        title="Copiar"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    </button>
                </div>
             </div>
          )}

          <form id="product-form" onSubmit={handleSubmit} className="space-y-6">
            
            {activeTab === 'basic' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Produto</label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                                placeholder="Ex: Curso Python Pro"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Plataforma</label>
                            <select
                                value={formData.platform}
                                onChange={e => setFormData({...formData, platform: e.target.value as any})}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                            >
                                <option value="hotmart">Hotmart</option>
                                <option value="kiwify">Kiwify</option>
                                <option value="eduzz">Eduzz</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            ID Externo do Produto
                            <span className="ml-2 text-xs text-slate-400 font-normal">(Copiado da URL da Hotmart/Kiwify)</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.externalProductId}
                            onChange={e => setFormData({...formData, externalProductId: e.target.value})}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 font-mono text-sm"
                            placeholder="Ex: 123456 ou prod_kjh123"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tempo de Espera (minutos)</label>
                        <div className="flex items-center space-x-4">
                            <input
                                type="range"
                                min="15"
                                max="1440"
                                step="15"
                                value={formData.delayMinutes}
                                onChange={e => setFormData({...formData, delayMinutes: Number(e.target.value)})}
                                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="w-20 text-right font-medium text-slate-700">{formData.delayMinutes} min</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Tempo entre o abandono do carrinho e o envio da mensagem.</p>
                    </div>
                </div>
            )}

            {activeTab === 'ai' && (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Persona do Agente (Prompt do Sistema)</label>
                        <textarea
                            required
                            rows={4}
                            value={formData.agentPersona}
                            onChange={e => setFormData({...formData, agentPersona: e.target.value})}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                            placeholder="Descreva como o agente deve se comportar..."
                        />
                        <p className="text-xs text-slate-500 mt-1">Defina o tom de voz e a personalidade do vendedor.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tratamento de Objeções</label>
                        <textarea
                            rows={3}
                            value={formData.objectionHandling}
                            onChange={e => setFormData({...formData, objectionHandling: e.target.value})}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                            placeholder="Como responder se o cliente disser 'está caro' ou 'não tenho tempo'..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            <div className="flex items-center gap-1">
                                <DollarSign size={14} className="text-slate-500" />
                                Link de Downsell (Opcional)
                            </div>
                        </label>
                        <input
                            type="url"
                            value={formData.downsellLink}
                            onChange={e => setFormData({...formData, downsellLink: e.target.value})}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                            placeholder="https://pay.hotmart.com/...?off=..."
                        />
                        <p className="text-xs text-slate-500 mt-1">A IA usará este link apenas se necessário para recuperar a venda.</p>
                    </div>
                </div>
            )}

          </form>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end space-x-3">
            <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            >
                Cancelar
            </button>
            <button
                type="submit"
                form="product-form"
                disabled={loading}
                className="px-6 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-colors flex items-center disabled:opacity-50"
            >
                {loading ? 'Salvando...' : (
                    <>
                        <Save size={16} className="mr-2" />
                        Salvar Configurações
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default ProductModal;