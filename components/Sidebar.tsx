
import React from 'react';
import { Icon } from './Icon';
import { Screen, User } from '../types';

interface SidebarProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  currentUser: User | null;
  onLogout?: () => void;
  reservedCount?: number;
  treatmentCount?: number;
}

const getInitials = (name: string) => {
    return name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'US';
};

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentScreen, 
  onNavigate, 
  currentUser, 
  onLogout, 
  reservedCount = 0,
  treatmentCount = 0 
}) => {
  // Acesso seguro às permissões (fallback para false se undefined)
  const perms = currentUser?.permissions || { 
      treatment: false, 
      analytics: false, 
      addressing: false, 
      settings: false 
  };

  const navItems = [
    { id: 'dashboard', label: 'Hub de Controle', icon: 'grid_view' },
    
    // Analytics (Permissão: analytics)
    ...(perms.analytics ? [{ id: 'analytics', label: 'Indicadores', icon: 'insights' }] : []),
    
    { id: 'reserved', label: 'Meus Reservados', icon: 'assignment' },
    { id: 'history', label: 'Histórico', icon: 'history' },
    
    // Tratamento (Permissão: treatment)
    ...(perms.treatment ? [{ id: 'treatment', label: 'Tratamento', icon: 'admin_panel_settings', spacer: true }] : []),
    
    // Endereçamento (Permissão: addressing)
    ...(perms.addressing ? [{ id: 'address_manager', label: 'Endereçamento', icon: 'qr_code_2', spacer: true }] : []),
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen bg-white dark:bg-surface-dark border-r border-gray-200 dark:border-card-border sticky top-0 left-0 z-50 transition-all duration-300">
      {/* Brand Header with Lubel Logo */}
      <div className="flex items-center justify-center p-6 border-b border-gray-100 dark:border-white/5 bg-[#182335]">
        <img src="/logo.png" alt="Lubel Auto Peças" className="h-12 w-auto object-contain transition-transform hover:scale-105 duration-300" />
      </div>

      <div className="p-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 hover:border-gray-300 dark:hover:border-gray-600 transition-colors duration-300">
           <div className="size-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-300 font-bold border border-white dark:border-gray-600">
             {getInitials(currentUser?.name || '')}
           </div>
           <div className="flex-1 min-w-0">
             <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{currentUser?.name}</p>
             <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{currentUser?.role}</p>
           </div>
           {perms.settings && (
             <button 
               onClick={() => onNavigate('settings')}
               className="text-gray-400 hover:text-primary transition-colors hover:rotate-90 duration-300"
             >
               <Icon name="settings" size={20} />
             </button>
           )}
        </div>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto no-scrollbar">
        <p className="px-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-2">Menu Principal</p>
        
        {navItems.map((item) => {
          const isActive = currentScreen === item.id;
          // Apply top margin if it's a spacer item
          const spacerClass = (item as any).spacer ? 'mt-6' : '';
          
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as Screen)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${spacerClass} ${
                isActive 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20 translate-x-1' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:translate-x-1'
              }`}
            >
              <div className="relative">
                <Icon name={item.icon} className={isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors'} />
                
                {/* Badge para Reservados (Maior) */}
                {item.id === 'reserved' && reservedCount > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-white dark:border-surface-dark animate-pulse shadow-sm">
                    {reservedCount}
                  </span>
                )}

                {/* Badge para Tratamento */}
                {item.id === 'treatment' && treatmentCount > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white border-2 border-white dark:border-surface-dark animate-bounce shadow-sm">
                    {treatmentCount}
                  </span>
                )}
              </div>
              <span className="text-sm font-medium">{item.label}</span>
              {isActive && <Icon name="chevron_right" size={16} className="ml-auto opacity-50" />}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-card-border">
         <button 
           onClick={onLogout}
           className="w-full flex items-center justify-center gap-2 p-3 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all hover:scale-[1.02] text-sm font-medium"
         >
           <Icon name="logout" size={20} />
           Sair do Sistema
         </button>
         
         <div className="mt-4 text-center opacity-60 hover:opacity-100 transition-opacity">
            <p className="text-[9px] text-gray-400 font-medium">
               Dev: José Victor Souza
            </p>
            <p className="text-[9px] text-primary">
               @byzvictorrr
            </p>
         </div>
      </div>
    </aside>
  );
};
