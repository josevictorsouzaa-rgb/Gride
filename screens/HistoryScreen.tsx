
import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '../components/Icon';
import { EntryModal, HistoryFilterModal } from '../components/Modals';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { api } from '../services/api';

export const HistoryScreen: React.FC = () => {
  const [historyBlocks, setHistoryBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const LIMIT = 30;

  // Fetch History from Backend
  useEffect(() => {
    const fetchHistory = async () => {
        setLoading(true);
        const data = await api.getHistory(page, LIMIT);
        
        // Transform Flat Log into Grouped Blocks (Logic based on Location + User + Date)
        const groups = new Map();

        data.forEach((entry: any) => {
            const dateObj = new Date(entry.DATA_HORA);
            const dateKey = dateObj.toLocaleDateString('pt-BR');
            const timeKey = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            
            // Chave de agrupamento: Local + Usuario + Data
            const groupKey = `${entry.LOCALIZACAO}-${entry.USUARIO_NOME}-${dateKey}`;

            if (!groups.has(groupKey)) {
                groups.set(groupKey, {
                    id: entry.ID, // Use ID of first item as group ID for keying
                    parentRef: 'HISTÓRICO',
                    location: entry.LOCALIZACAO,
                    user: entry.USUARIO_NOME,
                    avatar: entry.USUARIO_ID || '10',
                    finishedAt: `${dateKey}, ${timeKey}`,
                    rawDate: entry.DATA_HORA.split('T')[0],
                    status: entry.STATUS === 'divergence_info' ? 'divergencia' : 'concluido',
                    items: []
                });
            }

            const group = groups.get(groupKey);
            group.items.push({
                id: entry.ID,
                name: entry.NOME_PRODUTO,
                ref: entry.SKU,
                brand: '---', // Log doesn't save brand currently
                qty: entry.QTD_CONTADA,
                countedBy: entry.USUARIO_NOME,
                countedAt: `${dateKey} ${timeKey}`
            });
            
            // If any item in the group has divergence, mark group
            if (entry.STATUS === 'divergence_info' || entry.STATUS === 'not_located') {
                group.status = 'divergencia';
            }
        });

        setHistoryBlocks(Array.from(groups.values()));
        setLoading(false);
    };

    fetchHistory();
  }, [page]);

  const [expandedBlocks, setExpandedBlocks] = useState<number[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const [searchText, setSearchText] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    startDate: '',
    endDate: '',
    users: [] as string[]
  });

  const uniqueUsers = useMemo(() => {
    const users = new Set(historyBlocks.map(b => b.user));
    return Array.from(users);
  }, [historyBlocks]);

  const filteredBlocks = useMemo(() => {
    return historyBlocks.filter(block => {
      const searchLower = searchText.toLowerCase();
      const matchesText = 
        searchText === '' ||
        block.location.toLowerCase().includes(searchLower) ||
        block.user.toLowerCase().includes(searchLower) ||
        block.items.some((item: any) => 
          item.name.toLowerCase().includes(searchLower) ||
          item.ref.toLowerCase().includes(searchLower)
        );

      if (!matchesText) return false;

      if (activeFilters.users.length > 0 && !activeFilters.users.includes(block.user)) {
        return false;
      }

      if (activeFilters.startDate && block.rawDate < activeFilters.startDate) return false;
      if (activeFilters.endDate && block.rawDate > activeFilters.endDate) return false;

      return true;
    });
  }, [historyBlocks, searchText, activeFilters]);

  const hasActiveFilters = activeFilters.startDate || activeFilters.endDate || activeFilters.users.length > 0;

  const toggleBlock = (id: number) => {
    setExpandedBlocks(prev => 
      prev.includes(id) ? prev.filter(blockId => blockId !== id) : [...prev, id]
    );
  };

  const getStatusConfig = (status: string) => {
    switch(status) {
      case 'divergencia':
        return { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-200 dark:border-orange-800', icon: 'rule', label: 'Com Divergência' };
      default:
        return { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-200 dark:border-green-800', icon: 'check_circle', label: 'Concluído' };
    }
  };

  return (
    <div className="relative flex flex-col w-full min-h-screen pb-32 md:pb-0 bg-background-light dark:bg-background-dark md:bg-transparent">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background-light/95 dark:bg-background-dark/95 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none p-4 pb-2 border-b border-transparent">
        <div className="flex items-center justify-between">
          <button className="flex size-10 shrink-0 items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10 transition-colors">
            <Icon name="arrow_back" size={24} />
          </button>
          <h2 className="text-lg font-bold leading-tight flex-1 text-center md:text-left md:ml-4">Histórico de Contagens</h2>
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

      {/* Search */}
      <div className="px-4 py-3">
        <div className="flex w-full items-stretch rounded-xl h-12 shadow-sm bg-white dark:bg-surface-dark overflow-hidden focus-within:ring-1 focus-within:ring-primary transition-all">
           <div className="flex items-center justify-center pl-4 text-gray-400">
             <Icon name="search" size={24} />
           </div>
           <input 
             className="flex-1 bg-transparent border-none focus:ring-0 text-base px-4 placeholder-gray-400 text-gray-900 dark:text-white" 
             placeholder="Buscar SKU, nome ou usuário..." 
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

      <div className="px-4 pt-2 pb-2 flex items-center justify-between">
         <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
           {loading ? 'Carregando...' : filteredBlocks.length > 0 ? `${filteredBlocks.length} registros (Página ${page})` : 'Nenhum resultado'}
         </p>
      </div>

      {/* Blocks List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 px-4 pb-28 md:pb-0">
        {!loading && filteredBlocks.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-400 opacity-60">
             <Icon name="manage_search" size={64} className="mb-2" />
             <p className="text-sm font-medium">Nenhum histórico encontrado nesta página.</p>
          </div>
        ) : (
          filteredBlocks.map((block) => {
           const status = getStatusConfig(block.status);
           const isExpanded = expandedBlocks.includes(block.id);
           const visibleItems = isExpanded ? block.items : block.items.slice(0, 2);
           const hiddenCount = block.items.length - 2;

           return (
             <div key={block.id} className="flex flex-col shadow-sm animate-fade-in h-full">
                <div className="flex items-end justify-between mb-0 z-10">
                  <div className="bg-gray-600 dark:bg-gray-700 text-white text-[10px] font-bold px-3 py-1 rounded-t-md uppercase tracking-wider shadow-sm">
                      {block.location}
                  </div>
                  <div className="mb-1.5 relative top-1">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${status.bg} ${status.border}`}>
                        <Icon name={status.icon} size={14} className={status.color} />
                        <span className={`text-[10px] font-bold uppercase tracking-wide ${status.color}`}>{status.label}</span>
                      </div>
                  </div>
                </div>

                <div className={`flex-1 relative flex flex-col bg-white dark:bg-surface-dark rounded-b-xl rounded-tr-xl border overflow-hidden ${status.border} border-t-0`}>
                  
                  <div className="flex items-center gap-3 p-3 bg-gray-50/80 dark:bg-white/5 border-b border-gray-100 dark:border-white/5">
                     <div 
                        className="size-8 rounded-full bg-gray-200 dark:bg-gray-700 bg-cover bg-center border border-white dark:border-gray-600 shadow-sm"
                        style={{ backgroundImage: `url('https://i.pravatar.cc/150?u=${block.avatar}')` }}
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">{block.user}</span>
                        <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                          <Icon name="event" size={12} />
                          {block.finishedAt}
                        </div>
                      </div>
                  </div>

                  <div className="flex flex-col flex-1">
                      {visibleItems.map((item: any, index: number) => (
                        <div 
                          key={item.id} 
                          onClick={() => setSelectedItem(item)}
                          className={`group p-4 flex flex-col gap-1 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-white/5 ${
                            index !== visibleItems.length - 1 ? 'border-b border-gray-100 dark:border-card-border/50' : ''
                          }`}
                        >
                            <div className="flex justify-between items-start">
                              <h3 className="text-sm font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-tight flex-1">
                                {item.name}
                              </h3>
                            </div>
                            <div className="flex flex-wrap items-center gap-y-1 text-[11px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
                              <span className="mr-2">REF: {item.ref}</span>
                              <span className="text-gray-300 dark:text-gray-600 mr-2">|</span>
                              <span className="text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-900/20 px-1.5 rounded">QTD: {item.qty}</span>
                            </div>
                        </div>
                      ))}
                  </div>

                  {!isExpanded && hiddenCount > 0 && (
                      <div 
                        onClick={() => toggleBlock(block.id)}
                        className="flex items-center justify-center py-2 bg-gray-50 dark:bg-black/20 border-t border-b border-gray-100 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-black/30 transition-colors"
                      >
                        <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                            Ver mais {hiddenCount} itens
                            <Icon name="expand_more" size={16} />
                        </span>
                      </div>
                  )}
                  {isExpanded && block.items.length > 2 && (
                      <div 
                        onClick={() => toggleBlock(block.id)}
                        className="flex items-center justify-center py-2 bg-gray-50 dark:bg-black/20 border-t border-b border-gray-100 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-black/30 transition-colors"
                      >
                        <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                            Mostrar menos
                            <Icon name="expand_less" size={16} />
                        </span>
                      </div>
                  )}
                </div>
             </div>
           );
        }))}
      </div>

      {/* PAGINATION CONTROLS */}
      <div className="fixed bottom-20 md:bottom-6 left-0 right-0 flex justify-center items-center gap-4 p-4 z-30 pointer-events-none">
          <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-card-border shadow-xl rounded-full p-1.5 flex gap-2 pointer-events-auto">
              <button 
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="size-10 rounded-full flex items-center justify-center bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-white transition-colors"
              >
                  <Icon name="chevron_left" size={24} />
              </button>
              
              <div className="flex items-center justify-center px-4 font-bold text-sm text-gray-900 dark:text-white">
                  Página {page}
              </div>

              <button 
                onClick={() => setPage(p => p + 1)}
                className="size-10 rounded-full flex items-center justify-center bg-primary text-white hover:bg-primary-dark disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors shadow-lg"
              >
                  <Icon name="chevron_right" size={24} />
              </button>
          </div>
      </div>

      <ItemDetailModal 
        isOpen={!!selectedItem} 
        onClose={() => setSelectedItem(null)} 
        item={selectedItem}
      />
      
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
