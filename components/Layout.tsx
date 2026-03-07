import React, { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, ShoppingBag, Settings, LogOut, User, Menu, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    if (mobileMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  // Close menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const userInitials = profile?.name
    ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const menuItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { label: 'Meus Produtos', icon: ShoppingBag, path: '/products' },
    { label: 'Configurações', icon: Settings, path: '/settings' },
  ];

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-100 flex items-center space-x-2">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold">R</div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">Recupera.AI</span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-200'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-brand-600' : 'text-slate-400'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
           <button
             onClick={() => navigate('/profile')}
             className="w-full flex items-center space-x-3 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
           >
             <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
               <span className="font-semibold text-xs">{userInitials}</span>
             </div>
             <div className="flex flex-col text-left">
               <span className="font-medium text-slate-900">{profile?.name || 'Usuario'}</span>
               <span className="text-xs text-slate-500">{profile?.email || ''}</span>
             </div>
           </button>
           <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-2 mt-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
           >
            <LogOut size={18} />
            <span>Sair</span>
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between relative" ref={menuRef}>
           <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold">R</div>
              <span className="text-lg font-bold text-slate-800">Recupera.AI</span>
           </div>
           <button
             onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
             className="p-2 text-slate-600 hover:bg-slate-100 rounded-md"
             aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
           >
             {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
           </button>

           {/* Mobile Dropdown Menu */}
           {mobileMenuOpen && (
             <div className="absolute top-full right-4 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-2">
               <div className="px-4 py-3 border-b border-slate-100">
                 <p className="font-medium text-sm text-slate-900">{profile?.name || 'Usuario'}</p>
                 <p className="text-xs text-slate-500">{profile?.email || ''}</p>
               </div>
               <button
                 onClick={() => navigate('/profile')}
                 className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
               >
                 <User size={18} className="text-slate-400" />
                 Meu Perfil
               </button>
               <button
                 onClick={() => navigate('/settings')}
                 className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
               >
                 <Settings size={18} className="text-slate-400" />
                 Configurações
               </button>
               <div className="border-t border-slate-100 mt-1 pt-1">
                 <button
                   onClick={handleLogout}
                   className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                 >
                   <LogOut size={18} />
                   Sair
                 </button>
               </div>
             </div>
           )}
        </div>

        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden bg-white border-t border-slate-200 flex justify-around p-3 pb-safe fixed bottom-0 w-full z-10">
          {menuItems.map((item) => {
             const isActive = location.pathname === item.path;
             const Icon = item.icon;
             return (
               <button
                 key={item.path}
                 onClick={() => navigate(item.path)}
                 className={`flex flex-col items-center space-y-1 ${isActive ? 'text-brand-600' : 'text-slate-400'}`}
               >
                 <Icon size={24} />
                 <span className="text-xs">{item.label}</span>
               </button>
             );
           })}
      </div>
    </div>
  );
};

export default Layout;