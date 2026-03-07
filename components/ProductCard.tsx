import React from 'react';
import { Product } from '../types';
import { Edit2, ShoppingBag, Smartphone, Trash2 } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onToggleStatus: (id: string) => void;
  onConnect: (productId: string) => void;
  onDelete: (productId: string) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onEdit, onToggleStatus, onConnect, onDelete }) => {
  const getPlatformColor = (p: string) => {
    switch(p) {
        case 'hotmart': return 'bg-orange-50 text-orange-600 border-orange-100';
        case 'kiwify': return 'bg-green-50 text-green-600 border-green-100';
        default: return 'bg-blue-50 text-blue-600 border-blue-100';
    }
  };

  const getWhatsAppStatusColor = (status?: string) => {
    switch(status) {
      case 'connected': return 'bg-emerald-500';
      case 'connecting': return 'bg-yellow-400';
      default: return 'bg-slate-300';
    }
  };

  const getWhatsAppStatusLabel = (status?: string) => {
    switch(status) {
      case 'connected': return 'WhatsApp Conectado';
      case 'connecting': return 'Conectando...';
      default: return 'WhatsApp Desconectado';
    }
  };

  return (
    <div className={`bg-white rounded-xl border transition-all duration-200 hover:shadow-md ${product.isActive ? 'border-slate-200' : 'border-slate-100 opacity-75'}`}>
      <div className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${product.isActive ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-400'}`}>
                <ShoppingBag size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{product.name}</h3>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${getPlatformColor(product.platform)}`}>
                {product.platform}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-1">
             <button
                onClick={() => onEdit(product)}
                className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                title="Editar Configurações"
             >
                <Edit2 size={16} />
             </button>
             <button
                onClick={() => onDelete(product.id)}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Excluir Produto"
             >
                <Trash2 size={16} />
             </button>
          </div>
        </div>

        {/* WhatsApp Status */}
        <div className="flex items-center justify-between mb-4 p-2.5 bg-slate-50 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${getWhatsAppStatusColor(product.whatsappStatus)}`} />
            <span className="text-xs font-medium text-slate-600">
              {getWhatsAppStatusLabel(product.whatsappStatus)}
            </span>
          </div>
          {product.whatsappStatus !== 'connected' && (
            <button
              onClick={() => onConnect(product.id)}
              className="flex items-center space-x-1 text-xs font-medium text-green-600 hover:text-green-700 hover:bg-green-50 px-2 py-1 rounded transition-colors"
            >
              <Smartphone size={14} />
              <span>Conectar</span>
            </button>
          )}
        </div>

        <div className="space-y-3 mb-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-slate-50 p-2 rounded-lg">
                    <span className="block text-xs text-slate-500">Abandonos</span>
                    <span className="font-semibold text-slate-700">{product.abandonedCount || 0}</span>
                </div>
                <div className="bg-emerald-50 p-2 rounded-lg">
                    <span className="block text-xs text-emerald-600">Recuperados</span>
                    <span className="font-semibold text-emerald-700">{product.recoveredCount || 0}</span>
                </div>
            </div>

            <div className="flex justify-between text-sm pt-2 border-t border-slate-50">
                <span className="text-slate-500">Faturamento:</span>
                <span className="font-bold text-emerald-600">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.revenue || product.totalRecovered || 0)}
                </span>
            </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
           <div className="flex items-center space-x-2">
               <div className={`w-2 h-2 rounded-full ${product.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
               <span className="text-xs font-medium text-slate-600">{product.isActive ? 'Ativo' : 'Pausado'}</span>
           </div>

           <button
             onClick={() => onToggleStatus(product.id)}
             className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors border ${
                product.isActive
                ? 'text-red-600 border-red-200 hover:bg-red-50'
                : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'
             }`}
           >
             {product.isActive ? 'Pausar' : 'Ativar'}
           </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
