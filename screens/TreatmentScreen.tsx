
import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '../components/Icon';
import { Screen, TreatmentItem, User } from '../types';
import { HistoryFilterModal } from '../components/Modals';
import { api } from '../services/api';
import { AutoPartsLoader } from '../components/AutoPartsLoader';

interface TreatmentScreenProps {
  onNavigate: (screen: Screen) => void;
  onRefresh?: () => void; // Callback para atualizar contadores globais
  currentUser?: User | null;
}

export const TreatmentScreen: React.FC<TreatmentScreenProps> = ({ onNavigate, onRefresh, currentUser }) => {
  const [items, setItems] = useState<TreatmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Search and Filter State
  const [searchText, setSearchText] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    startDate: '',
    endDate: '',
    users: [] as string[]
  });

  // Calculate Lead Time (Updated Format: 1min atrás, 2h atrás, 59d atrás)
  const getLeadTime = (dateStr: string) => {
      const start = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - start.getTime();
      
      const diffMins = Math.floor(diffMs / 60000); // Minutes
      if (diffMins < 1) return 'Agora';
      if (diffMins < 60) return `${diffMins}min atrás`;
      
      const diffHrs = Math.floor(diffMins / 60); // Hours
      if (diffHrs < 24) return `${diffHrs}h atrás`;
      
      const diffDays = Math.floor(diffHrs / 24); // Days
      return `${diffDays}d atrás`;
  };

  const loadData = async () => {
      setLoading(true);
      const data = await api.getTreatmentItems();
      setItems(data);
      setLoading(false);
  };

  useEffect(() => {
      // Carrega dados apenas se tiver permissão
      if (currentUser?.isAdmin || currentUser?.canTreat) {
          loadData();
      }
  }, [currentUser]);

  const handleResolve = async (id: number, action: 'adjust' | 'inactivate' | 'ignore') => {
      const note = prompt("Observação da resolução:");
      if (note === null) return; // Cancelled

      await api.resolveTreatment(id, note || 'Sem observação', currentUser?.name || 'Gestor', action); 
      
      // Optimistic update
      setItems(prev => prev.filter(i => i.id !== id));
      
      // Refresh global badging
      if (onRefresh) onRefresh();
      
      alert("Item resolvido com sucesso.");
  };

  // Extract unique users
  const uniqueUsers = useMemo(() => {
    const users = new Set(items.map(i => i.reportedBy));
    return Array.from(users);
  }, [items]);

  // Filter Logic
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // 1. Text Search
      const searchLower = searchText.toLowerCase();
      const matchesText = 
        searchText === '' ||
        item.name.toLowerCase().includes(searchLower) ||
        item.sku.toLowerCase().includes(searchLower) ||
        item.location.toLowerCase().includes(searchLower) ||
        item.reportedBy.toLowerCase().includes(searchLower);

      if (!matchesText) return false;

      // 2. User Filter
      if (activeFilters.users.length > 0 && !activeFilters.users.includes(item.reportedBy)) {
        return false;
      }

      // 3. Date Range (Simple string comparison works for ISO dates yyyy-mm-dd)
      // item.reportedAt might be ISO string
      const itemDate = new Date(item.reportedAt).toISOString().split('T')[0];
      if (activeFilters.startDate && itemDate < activeFilters.startDate) return false;
      if (activeFilters.endDate && itemDate > activeFilters.endDate) return false;

      return true;
    });
  }, [items, searchText, activeFilters]);

  const hasActiveFilters = activeFilters.startDate || activeFilters.endDate || activeFilters.users.length > 0;

  // --- ACCESS CHECK ---
  const canAccess = currentUser?.isAdmin || currentUser?.canTreat;

  if (!canAccess) {
      return (
        <div className="relative flex flex-col w-full min-h-screen pb-safe bg-background-light dark:bg-background-dark">
            <header className="sticky top-0 z-20 bg-background-light dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-card-border">
                <div className="flex items-center p-4 gap-3">
                    <button 
                        onClick={() => onNavigate('dashboard')}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-surface-dark transition-colors"
                    >
                        <Icon name="arrow_back" size={24} />
                    </button>
                    <div className="flex-1">
                        <h2 className="text-lg font-bold leading-tight">Tratamento</h2>
                        <p className="text-xs text-gray-500">Gestão de Divergências</p>
                    </div>
                </div>
            </header>
            
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in opacity-70">
                <div className="size-24 bg-gray-200 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
                    <Icon name="lock" size={48} className="text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Acesso Restrito</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed">
                    Apenas gestores ou usuários autorizados podem tratar divergências de estoque.
                </p>
            </div>
        </div>
      );
  }

  if (loading) return <AutoPartsLoader message="Carregando Divergências..." />;

  return (
    <div className="relative flex flex-col w-full min-h-screen pb-safe bg-background-light dark:bg-background-dark">
      <header className="sticky top-0 z-20 bg-background-light dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-card-border">
        <div className="flex items-center p-4 gap-3">
           <button 
             onClick={() => onNavigate('dashboard')}
             className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-surface-dark transition-colors"
           >
             <Icon name="arrow_back" size={24} />
           </button>

           <div className="flex-1">
               <h2 className="text-lg font-bold leading-tight">Tratamento</h2>
               <p className="text-xs text-gray-500">Gestão de Divergências</p>
           </div>
           
           <button 
             onClick={() => setShowFilterModal(true)}
             className={`flex size-10 shrink-0 items-center justify-center rounded-full transition-colors relative ${
               hasActiveFilters 
                 ? 'bg-primary/10 text-primary' 
                 : 'active:bg-black/5 dark:active:bg-white/10 text-gray-700 dark:text-white'
             }`}
           >
             <Icon name="filter_list" size={24} />
             {hasActiveFilters && (
               <span className="absolute top-2 right-2 size-2 bg-primary rounded-full border border-white dark:border-surface-dark" />
             )}
           </button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-4 py-3">
        <div className="flex w-full items-stretch rounded-xl h-12 shadow-sm bg-white dark:bg-surface-dark overflow-hidden focus-within:ring-1 focus-within:ring-primary transition-all">
           <div className="flex items-center justify-center pl-4 text-gray-400">
             <Icon name="search" size={24} />
           </div>
           <input 
             className="flex-1 bg-transparent border-none focus:ring-0 text-base px-4 placeholder-gray-400 text-gray-900 dark:text-white" 
             placeholder="Buscar item, SKU ou responsável..." 
             value={searchText}
             onChange={(e) => setSearchText(e.target.value)}
           />
           {searchText && (
             <button 
                onClick={() => setSearchText('')}
                className="flex items-center justify-center px-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
             >
                <Icon name="close" size={20} />
             </button>
           )}
        </div>
      </div>
      
      {/* Active Filters Display Chips */}
      {hasActiveFilters && (
        <div className="px-4 pb-2 flex flex-wrap gap-2 animate-fade-in">
          {activeFilters.users.length > 0 && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold">
               User: {activeFilters.users.length === 1 ? activeFilters.users[0] : `${activeFilters.users.length} selecionados`}
            </span>
          )}
          {(activeFilters.startDate || activeFilters.endDate) && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold">
               Data: {activeFilters.startDate || 'Inicio'} - {activeFilters.endDate || 'Fim'}
            </span>
          )}
          <button 
            onClick={() => setActiveFilters({ startDate: '', endDate: '', users: [] })}
            className="text-xs font-medium text-gray-500 underline ml-1"
          >
            Limpar
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="px-4 py-2 flex items-center justify-between text-xs text-gray-500">
         <span className="font-bold uppercase tracking-wide">Pendentes: {filteredItems.length}</span>
         <span>Ordenado por: Mais recente</span>
      </div>

      <main className="flex-1 p-4 space-y-4">
         {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 opacity-60">
              <Icon name="rule" size={64} className="mb-2" />
              <p className="text-sm font-medium">Nenhum item pendente encontrado.</p>
            </div>
         ) : (
           filteredItems.map(item => (
             <div key={item.id} className="bg-white dark:bg-surface-dark rounded-xl p-4 border border-gray-200 dark:border-card-border shadow-sm animate-fade-in">
                <div className="flex justify-between items-start mb-3">
                   <div>
                      <h3 className="font-bold text-gray-900 dark:text-white line-clamp-1">{item.name}</h3>
                      <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                   </div>
                   <div className="flex flex-col items-end gap-1">
                       <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                         item.issueType === 'not_located' 
                           ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                           : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                       }`}>
                          {item.issueType === 'not_located' ? 'Não Localizado' : 'Divergência'}
                       </span>
                       <span className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                          <Icon name="timer" size={12} />
                          {getLeadTime(item.reportedAt)}
                       </span>
                   </div>
                </div>

                <div className="mb-3 p-3 bg-gray-50 dark:bg-black/20 rounded-lg text-sm text-gray-700 dark:text-gray-300 italic border-l-4 border-orange-400">
                    "{item.description || 'Sem descrição'}"
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-4">
                   <Icon name="person" size={14} />
                   <span>Reportado por {item.reportedBy} • {new Date(item.reportedAt).toLocaleDateString('pt-BR')}</span>
                </div>

                <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-white/5">
                   <button 
                     onClick={() => handleResolve(item.id, 'inactivate')}
                     className="flex-1 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-gray-50 dark:hover:bg-white/5"
                   >
                     Inativar / Ignorar
                   </button>
                   <button 
                     onClick={() => handleResolve(item.id, 'adjust')}
                     className="flex-1 py-2.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-dark shadow-sm"
                   >
                     Confirmar & Resolver
                   </button>
                </div>
             </div>
           ))
         )}
      </main>

      <HistoryFilterModal 
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        availableUsers={uniqueUsers}
        currentFilters={activeFilters}
        onApply={setActiveFilters}
        onClear={() => setActiveFilters({ startDate: '', endDate: '', users: [] })}
      />
    </div>
  );
};
