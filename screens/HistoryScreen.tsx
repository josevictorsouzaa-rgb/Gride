import React, { useState, useMemo } from 'react';
import { Icon } from '../components/Icon';
import { EntryModal, HistoryFilterModal } from '../components/Modals';
import { ItemDetailModal } from '../components/ItemDetailModal';

export const HistoryScreen: React.FC = () => {
  // Mock data with rawDate (ISO format) for filtering logic
  // displayedDate is what shows in the UI
  // Updated items to include who counted specifically
  const [historyBlocks, setHistoryBlocks] = useState([
    { 
      id: 1, 
      parentRef: 'S/REF', 
      location: 'Rua 04 • Nível 2 • Apto 10', 
      user: 'Carlos Silva',
      avatar: '10',
      finishedAt: 'Hoje, 14:45',
      rawDate: new Date().toISOString().split('T')[0], // Today
      status: 'concluido',
      items: [
        { id: 'i1', name: 'BRONZINA DE BIELA', ref: 'BB121 000', brand: 'METAL LEVE', qty: 3, countedBy: 'Carlos Silva', countedAt: 'Hoje 14:40' },
        { id: 'i2', name: 'BRONZINA DE BIELA', ref: '87998604', brand: 'KS', qty: 2, countedBy: 'Carlos Silva', countedAt: 'Hoje 14:42' },
        { id: 'i3', name: 'BRONZINA DE BIELA', ref: '10482-A', brand: 'SINTERMETAL', qty: 5, countedBy: 'Carlos Silva', countedAt: 'Hoje 14:44' }, 
      ]
    },
    { 
      id: 2, 
      parentRef: 'REF: 1029', 
      location: 'Rua 12 • Bloco B', 
      user: 'Carlos Silva',
      avatar: '10',
      finishedAt: 'Hoje, 11:20',
      rawDate: new Date().toISOString().split('T')[0], // Today
      status: 'concluido', 
      items: [
        { id: 'i4', name: 'PISTÃO C/ ANÉIS 0,50', ref: 'P9120 050', brand: 'MAHLE', qty: 12, countedBy: 'Carlos Silva', countedAt: 'Hoje 11:15' },
      ]
    },
    { 
      id: 3, 
      parentRef: 'REF: 9912', 
      location: 'Mezanino • Box 4', 
      user: 'Mariana Santos',
      avatar: '25',
      finishedAt: 'Ontem, 16:30',
      rawDate: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Yesterday
      status: 'divergencia',
      items: [
        { id: 'i5', name: "BOMBA D'ÁGUA", ref: 'UB0625', brand: 'URBA', qty: 4, countedBy: 'Mariana Santos', countedAt: 'Ontem 16:10' },
        { id: 'i6', name: "BOMBA D'ÁGUA", ref: 'UB0628', brand: 'URBA', qty: 2, countedBy: 'Mariana Santos', countedAt: 'Ontem 16:15' },
        { id: 'i7', name: "VÁLVULA TERMOSTÁTICA", ref: 'VT 200', brand: 'MTE', qty: 10, countedBy: 'Mariana Santos', countedAt: 'Ontem 16:20' },
        { id: 'i8', name: "SENSOR DE TEMPERATURA", ref: 'ST 3030', brand: 'MTE', qty: 5, countedBy: 'Mariana Santos', countedAt: 'Ontem 16:25' },
      ]
    },
    { 
      id: 4, 
      parentRef: 'REF: 5502', 
      location: 'Rua 01 • Nível 1', 
      user: 'João Pedro',
      avatar: '12',
      finishedAt: '23/10, 09:15',
      rawDate: '2023-10-23',
      status: 'concluido',
      items: [
        { id: 'i9', name: 'FILTRO DE ÓLEO', ref: 'PSL 55', brand: 'TECFIL', qty: 100, countedBy: 'João Pedro', countedAt: '23/10 09:00' },
        { id: 'i10', name: 'FILTRO DE ÓLEO', ref: 'LB 55', brand: 'VOX', qty: 50, countedBy: 'João Pedro', countedAt: '23/10 09:10' },
      ]
    }
  ]);

  const [expandedBlocks, setExpandedBlocks] = useState<number[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  // Search and Filter State
  const [searchText, setSearchText] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    startDate: '',
    endDate: '',
    users: [] as string[] // Changed to array for multiple users
  });

  // Extract unique users for the filter modal
  const uniqueUsers = useMemo(() => {
    const users = new Set(historyBlocks.map(b => b.user));
    return Array.from(users);
  }, [historyBlocks]);

  // Derived filtered data
  const filteredBlocks = useMemo(() => {
    return historyBlocks.filter(block => {
      // 1. Text Search Logic (Global: Block info, User, Item name, Item Ref, Item Brand)
      const searchLower = searchText.toLowerCase();
      const matchesText = 
        searchText === '' ||
        block.location.toLowerCase().includes(searchLower) ||
        block.parentRef.toLowerCase().includes(searchLower) ||
        block.user.toLowerCase().includes(searchLower) ||
        block.items.some(item => 
          item.name.toLowerCase().includes(searchLower) ||
          item.ref.toLowerCase().includes(searchLower) ||
          item.brand.toLowerCase().includes(searchLower)
        );

      if (!matchesText) return false;

      // 2. User Filter (Multi-select)
      // If users array is not empty, check if block.user is included in the list
      if (activeFilters.users.length > 0 && !activeFilters.users.includes(block.user)) {
        return false;
      }

      // 3. Date Range Filter
      if (activeFilters.startDate) {
        if (block.rawDate < activeFilters.startDate) return false;
      }
      if (activeFilters.endDate) {
        if (block.rawDate > activeFilters.endDate) return false;
      }

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

  const handleItemClick = (item: any) => {
    setSelectedItem(item);
  };

  return (
    <div className="relative flex flex-col w-full min-h-screen pb-24 md:pb-0 bg-background-light dark:bg-background-dark md:bg-transparent">
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
             placeholder="Buscar marca, ref, nome ou usuário..." 
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

      {/* Stats Summary - Dynamically updated based on filtered results could be implemented, but static for now or based on total */}
      <div className="flex gap-3 px-4 py-1">
         <div className="flex-1 rounded-xl bg-white dark:bg-surface-dark p-4 shadow-sm border border-transparent dark:border-white/5">
            <p className="text-2xl font-bold leading-tight">{filteredBlocks.length}</p>
            <div className="flex items-center gap-1">
               <Icon name="inventory" className="text-primary" size={18} />
               <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Blocos Listados</p>
            </div>
         </div>
         <div className="flex-1 rounded-xl bg-white dark:bg-surface-dark p-4 shadow-sm border border-transparent dark:border-white/5">
            <p className="text-2xl font-bold leading-tight text-green-600 dark:text-green-400">98%</p>
            <div className="flex items-center gap-1">
               <Icon name="verified" className="text-gray-400" size={18} />
               <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Acuracidade</p>
            </div>
         </div>
      </div>

      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
         <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
           {filteredBlocks.length > 0 ? 'Resultados' : 'Nenhum resultado'}
         </p>
         <p className="text-xs font-medium text-primary cursor-pointer">Exportar Relatório</p>
      </div>

      {/* Blocks List - Responsive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 px-4 pb-28 md:pb-0">
        {filteredBlocks.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-400 opacity-60">
             <Icon name="manage_search" size={64} className="mb-2" />
             <p className="text-sm font-medium">Nenhum histórico encontrado com estes filtros.</p>
          </div>
        ) : (
          filteredBlocks.map((block) => {
           const status = getStatusConfig(block.status);
           const isExpanded = expandedBlocks.includes(block.id);
           const visibleItems = isExpanded ? block.items : block.items.slice(0, 2);
           const hiddenCount = block.items.length - 2;

           return (
             <div key={block.id} className="flex flex-col shadow-sm animate-fade-in h-full">
                {/* Header Tag + Status */}
                <div className="flex items-end justify-between mb-0 z-10">
                  <div className="bg-gray-600 dark:bg-gray-700 text-white text-[10px] font-bold px-3 py-1 rounded-t-md uppercase tracking-wider shadow-sm">
                      {block.parentRef}
                  </div>
                  <div className="mb-1.5 relative top-1">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${status.bg} ${status.border}`}>
                        <Icon name={status.icon} size={14} className={status.color} />
                        <span className={`text-[10px] font-bold uppercase tracking-wide ${status.color}`}>{status.label}</span>
                      </div>
                  </div>
                </div>

                {/* Main Block Container */}
                <div className={`flex-1 relative flex flex-col bg-white dark:bg-surface-dark rounded-b-xl rounded-tr-xl border overflow-hidden ${status.border} border-t-0`}>
                  
                  {/* User Info Header - BLOCK LEVEL (Optional if items have individual details, but kept for context) */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50/80 dark:bg-white/5 border-b border-gray-100 dark:border-white/5">
                     <div 
                        className="size-8 rounded-full bg-gray-200 dark:bg-gray-700 bg-cover bg-center border border-white dark:border-gray-600 shadow-sm"
                        style={{ backgroundImage: `url('https://i.pravatar.cc/150?img=${block.avatar}')` }}
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">Concluído por {block.user}</span>
                        <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                          <Icon name="event" size={12} />
                          {block.finishedAt}
                        </div>
                      </div>
                  </div>

                  {/* Items List */}
                  <div className="flex flex-col flex-1">
                      {visibleItems.map((item, index) => (
                        <div 
                          key={item.id} 
                          onClick={() => handleItemClick(item)}
                          className={`group p-4 flex flex-col gap-1 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-white/5 ${
                            index !== visibleItems.length - 1 ? 'border-b border-gray-100 dark:border-card-border/50' : ''
                          }`}
                        >
                            <div className="flex justify-between items-start">
                              <h3 className="text-sm font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-tight flex-1">
                                {item.name}
                              </h3>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 font-bold bg-primary/10 px-2 py-0.5 rounded transition-opacity">
                                  Detalhes
                                </span>
                                <Icon name="info" size={16} className="text-gray-300 dark:text-gray-600 group-hover:text-primary transition-colors" />
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-y-1 text-[11px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
                              <span className="mr-2">REF: {item.ref}</span>
                              <span className="text-gray-300 dark:text-gray-600 mr-2">|</span>
                              <span className="mr-2">MARCA: {item.brand}</span>
                              <span className="text-gray-300 dark:text-gray-600 mr-2">|</span>
                              <span className="text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-900/20 px-1.5 rounded">QTD: {item.qty}</span>
                            </div>

                             {/* INDIVIDUAL ITEM COUNT DETAIL - ADDED AS REQUESTED */}
                             <div className="flex items-center gap-2 mt-2 pt-2 border-t border-dashed border-gray-100 dark:border-white/5">
                                <Icon name="check_circle" size={12} className="text-gray-400" />
                                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                  Contado por <strong className="text-gray-700 dark:text-gray-300">{item.countedBy}</strong> em {item.countedAt}
                                </p>
                             </div>
                        </div>
                      ))}
                  </div>

                  {/* Expand Logic */}
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

                  {/* Footer */}
                  <div className="flex items-center gap-1.5 p-3 bg-gray-50 dark:bg-card-border/10 border-t border-gray-200 dark:border-card-border mt-auto">
                     <Icon name="place" size={14} className="text-gray-500" />
                     <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{block.location}</span>
                  </div>
                </div>
             </div>
           );
        }))}
      </div>

      {/* Detail Modal */}
      <ItemDetailModal 
        isOpen={!!selectedItem} 
        onClose={() => setSelectedItem(null)} 
        item={selectedItem}
      />
      
      {/* Filter Modal */}
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