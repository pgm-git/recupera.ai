import React, { useEffect, useState } from 'react';
import ProductCard from '../components/ProductCard';
import ProductModal from '../components/ProductModal';
import { getProducts, toggleProductStatus, saveProductConfig } from '../services/dataService';
import { Product } from '../types';
import { Plus, Search, Filter } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const Products: React.FC = () => {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    const data = await getProducts();
    setProducts(data);
    setIsLoading(false);
  };

  const handleToggleStatus = async (id: string) => {
    const product = products.find(p => p.id === id);
    if (!product) return;

    // Optimistic update
    setProducts(products.map(p => 
        p.id === id ? { ...p, isActive: !p.isActive } : p
    ));

    try {
        await toggleProductStatus(id, product.isActive);
    } catch (error) {
        console.error("Error toggling status", error);
        // Revert on error
        setProducts(products.map(p => 
            p.id === id ? { ...p, isActive: product.isActive } : p
        ));
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleNewProduct = () => {
      setEditingProduct(undefined);
      setIsModalOpen(true);
  };

  const handleSaveProduct = async (productData: Partial<Product>) => {
    try {
        const savedProduct = await saveProductConfig(productData, profile?.id);
        
        if (savedProduct) {
            // Se for edição, atualiza na lista
            if (editingProduct) {
                setProducts(products.map(p => p.id === savedProduct.id ? savedProduct : p));
            } else {
                // Se for novo, adiciona
                setProducts([...products, savedProduct]);
            }
        } else {
             // Fallback se não retornar nada (ex: erro silencioso)
             await fetchProducts();
        }
        setIsModalOpen(false); // Fecha modal após salvar
    } catch (error) {
        console.error("Erro ao salvar produto", error);
        alert("Erro ao salvar. Verifique se o Supabase está conectado.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            Meus Produtos
            {!isSupabaseConfigured() && <span className="ml-3 text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">Demo Mode</span>}
          </h1>
          <p className="text-slate-500 mt-1">Gerencie os agentes de recuperação para cada produto.</p>
        </div>
        <button 
            onClick={handleNewProduct}
            className="flex items-center space-x-2 bg-brand-600 text-white px-4 py-2.5 rounded-lg hover:bg-brand-700 transition-colors shadow-sm font-medium"
        >
            <Plus size={20} />
            <span>Novo Produto</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
         <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
            <input 
                type="text" 
                placeholder="Buscar produtos..." 
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
         </div>
         <div className="flex gap-2">
            <button className="flex items-center space-x-2 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                <Filter size={18} />
                <span>Status</span>
            </button>
            <select className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option>Todas Plataformas</option>
                <option>Hotmart</option>
                <option>Kiwify</option>
                <option>Eduzz</option>
            </select>
         </div>
      </div>

      {/* Product Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {[1, 2, 3].map(i => (
               <div key={i} className="h-64 bg-slate-100 rounded-xl animate-pulse"></div>
           ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <ProductCard 
                key={product.id} 
                product={product} 
                onEdit={handleEdit}
                onToggleStatus={handleToggleStatus}
            />
          ))}
          
          {/* Add New Placeholder Card */}
          <button 
             onClick={handleNewProduct}
             className="flex flex-col items-center justify-center h-full min-h-[250px] border-2 border-dashed border-slate-300 rounded-xl hover:border-brand-400 hover:bg-brand-50 transition-all group"
          >
             <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-brand-100 transition-colors">
                <Plus size={24} className="text-slate-400 group-hover:text-brand-600" />
             </div>
             <span className="font-medium text-slate-600 group-hover:text-brand-700">Adicionar Integração</span>
          </button>
        </div>
      )}

      <ProductModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        product={editingProduct}
        onSave={handleSaveProduct}
      />
    </div>
  );
};

export default Products;