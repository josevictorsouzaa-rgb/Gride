import React from 'react';
import { Icon } from './Icon';
import { Screen, User } from '../types';

interface SidebarProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  currentUser: User | null;
  onLogout?: () => void;
  reservedCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentScreen, onNavigate, currentUser, onLogout, reservedCount = 0 }) => {
  const isAdmin = currentUser?.isAdmin;

  const navItems = [
    { id: 'dashboard', label: 'Hub de Controle', icon: 'grid_view' },
    // Analytics only for Admin
    ...(isAdmin ? [{ id: 'analytics', label: 'Indicadores', icon: 'insights' }] : []),
    { id: 'list', label: 'Meta Diária', icon: 'checklist' },
    { id: 'history', label: 'Histórico', icon: 'history' },
    // If Admin, show Treatment in the sidebar (Desktop only feature requested)
    ...(isAdmin ? [{ id: 'treatment', label: 'Tratamento', icon: 'admin_panel_settings' }] : []),
    // Standardizing menu: Everyone sees Reserved.
    { id: 'reserved', label: 'Meus Reservados', icon: 'assignment' },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen bg-white dark:bg-surface-dark border-r border-gray-200 dark:border-card-border sticky top-0 left-0 z-50">
      {/* Brand */}
      <div className="flex items-center gap-3 p-6 border-b border-gray-100 dark:border-white/5">
        <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
          <Icon name="inventory_2" size={24} />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-none text-gray-900 dark:text-white">Login Inteligente</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Gestão de Estoque</p>
        </div>
      </div>

      {/* User Card */}
      <div className="p-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
           <div 
             className="size-10 rounded-full bg-gray-200 bg-cover bg-center border border-white dark:border-gray-600" 
             style={{ backgroundImage: `url('${currentUser?.avatar || 'https://picsum.photos/100/100'}')` }}
           />
           <div className="flex-1 min-w-0">
             <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{currentUser?.name}</p>
             <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{currentUser?.role}</p>
           </div>
           {isAdmin && (
             <button 
               onClick={() => onNavigate('settings')}
               className="text-gray-400 hover:text-primary transition-colors"
             >
               <Icon name="settings" size={20} />
             </button>
           )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        <p className="px-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-2">Menu Principal</p>
        {navItems.map((item) => {
          const isActive = currentScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as Screen)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all group ${
                isActive 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            >
              <div className="relative">
                <Icon name={item.icon} className={isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white'} />
                {item.id === 'reserved' && reservedCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white border border-white dark:border-surface-dark">
                    {reservedCount}
                  </span>
                )}
              </div>
              <span className="text-sm font-medium">{item.label}</span>
              {isActive && <Icon name="chevron_right" size={16} className="ml-auto opacity-50" />}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-card-border">
         <button className="w-full flex items-center justify-center gap-2 p-3 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-sm font-medium">
           <Icon name="logout" size={20} />
           Sair do Sistema
         </button>
      </div>
    </aside>
  );
};