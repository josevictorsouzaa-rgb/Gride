import React, { useState, useMemo } from 'react';
import { Icon } from '../components/Icon';
import { Screen, Block } from '../types';
import { ItemDetailModal } from '../components/ItemDetailModal';

interface ListScreenProps {
  onNavigate: (screen: Screen) => void;
  blocks: Block[];
  segmentFilter: string | null;
  onReserveBlock: (id: number) => void;
  onClearFilter: () => void;
  mode?: 'daily_meta' | 'browse'; 
}

// Helper to calculate days since a date string
const getDaysSince = (dateStr?: string): number => {
  if (!dateStr) return 9999; 
  if (dateStr.toLowerCase().includes('hoje')) return 0;
  if (dateStr.toLowerCase().includes('ontem')) return 1;
  
  const parts = dateStr.split('/');
  if (parts.length === 2) {
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; 
    const now = new Date();
    const countDate = new Date(now.getFullYear(), month, day);
    const diffTime = Math.abs(now.getTime() - countDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  }
  return 0;
};

type TimeFilter = 'all' | '7_days' | '15_days' | '30_days' | 'never';

export const ListScreen: React.FC<ListScreenProps> = ({ 
  onNavigate, 
  blocks, 
  segmentFilter, 
  onReserveBlock,
  onClearFilter,
  mode = 'daily_meta' 
}) => {
  const [showAllBlocks, setShowAllBlocks] = useState(false);
  const [expandedBlocks, setExpandedBlocks] = useState<number[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null); // Detail Modal State
  
  const [searchText, setSearchText] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  const toggleBlock = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedBlocks(prev => 
      prev.includes(id) ? prev.filter(blockId => blockId !== id) : [...prev, id]
    );
  };

  const handleReserve = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onReserveBlock(id);
  };

  const getStatusBadge = (status: string, date: string) => {
    switch(status) {
      case 'late':
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-red-100 dark:bg-red-900/30 rounded-md border border-red-200 dark:border-red-800">
             <Icon name="event_busy" size={14} className="text-red-600 dark:text-red-400" />
             <span className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wide">Atrasado ({date})</span>
          </div>
        );
      case 'completed':
         return (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-md border border-green-200 dark:border-green-800">
               <Icon name="check_circle" size={14} className="text-green-600 dark:text-green-400" />
               <span className="text-[10px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wide">Concluído</span>
            </div>
         );
      default:
        // Pending / Future
        const isToday = date.toLowerCase().includes('hoje');
        return (
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${
            isToday 
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800' 
              : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
          }`}>
             <Icon name="calendar_today" size={14} className={isToday ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"} />
             <span className={`text-[10px] font-bold uppercase tracking-wide ${isToday ? "text-blue-700 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"}`}>
               {date}
             </span>
          </div>
        );
    }
  };

  const filteredBlocks = useMemo(() => {
    return blocks.filter(block => {
      // 0. Base Status Check
      if (block.status === 'progress') return false; 
      
      // LOGIC SPLIT BASED ON MODE
      if (mode === 'daily_meta') {
        if (block.status === 'completed') return false; 
        if (searchText) {
           const lowerSearch = searchText.toLowerCase();
           const matchesItems = block.items.some(item => 
             item.name.toLowerCase().includes(lowerSearch) || 
             item.ref.toLowerCase().includes(lowerSearch)
           );
           const matchesLoc = block.location.toLowerCase().includes(lowerSearch);
           if (!matchesItems && !matchesLoc) return false;
        }
      } else {
        if (segmentFilter) {
            const matchesSegment = block.subcategory === segmentFilter || block.parentRef.includes(segmentFilter);
            if (!matchesSegment) return false;
        }
        if (searchText) {
           const lowerSearch = searchText.toLowerCase();
           const matchesItems = block.items.some(item => 
             item.name.toLowerCase().includes(lowerSearch) || 
             item.ref.toLowerCase().includes(lowerSearch)
           );
           if (!matchesItems) return false;
        }
      }

      if (timeFilter !== 'all') {
        const hasMatchingItem = block.items.some(item => {
           if (timeFilter === 'never') return !item.lastCount;
           if (!item.lastCount) return true; 
           
           const days = getDaysSince(item.lastCount.date);
           if (timeFilter === '7_days') return days >= 7;
           if (timeFilter === '15_days') return days >= 15;
           if (timeFilter === '30_days') return days >= 30;
           return false;
        });
        if (!hasMatchingItem) return false;
      }

      return true;
    });
  }, [blocks, segmentFilter, searchText, timeFilter, mode]);

  const displayedBlocks = showAllBlocks ? filteredBlocks : filteredBlocks.slice(0, 10);

  const getPageTitle = () => {
     if (mode === 'daily_meta') return 'Meta Diária';
     return segmentFilter || 'Explorar Estoque';
  };

  return (
    <div className="relative flex flex-col w-full min-h-screen pb-24 md:pb-0 bg-background-light dark:bg-background-dark md:bg-transparent">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background-light dark:bg-background-dark/95 md:bg-transparent backdrop-blur-md md:backdrop-blur-none border-b border-gray-200 dark:border-card-border md:border-b-0">
        <div className="flex items-center p-4 justify-between gap-3">
          {mode === 'browse' ? (
            <button 
              onClick={() => {
                setSearchText('');
                setTimeFilter('all');
                onClearFilter();
              }}
              className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-surface-dark cursor-pointer transition-colors"
            >
               <Icon name="arrow_back" size={24} className="text-gray-700 dark:text-white" />
            </button>
          ) : (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
               <Icon name="checklist" size={24} />
            </div>
          )}
          
          <div className="flex-1 md:text-left text-center pr-2 md:pr-0">
            <h2 className="text-lg font-bold leading-tight">{getPageTitle()}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
               {filteredBlocks.length} blocos disponíveis
            </p>
          </div>
          
          <div className="size-10 md:hidden" /> 
        </div>

        {/* Search & Filters */}
        <div className="px-4 pb-3 space-y-3">
          <div className="flex w-full items-stretch rounded-xl h-11 bg-white dark:bg-surface-dark overflow-hidden transition-all border border-gray-100 dark:border-white/5">
              <div className="flex items-center justify-center pl-4 text-gray-400">
                <Icon name="search" size={20} />
              </div>
              <input 
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-3 placeholder-gray-400 text-gray-900 dark:text-white" 
                placeholder="Buscar..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              {searchText && (
                <button 
                    onClick={() => setSearchText('')}
                    className="flex items-center justify-center px-4 text-gray-400"
                >
                    <Icon name="close" size={18} />
                </button>
              )}
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
             <button 
               onClick={() => setTimeFilter('all')}
               className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border ${
                 timeFilter === 'all' 
                   ? 'bg-gray-800 text-white border-gray-800 dark:bg-white dark:text-black' 
                   : 'bg-white dark:bg-surface-dark text-gray-500 border-gray-200 dark:border-white/10'
               }`}
             >
               Todos
             </button>
             <button 
               onClick={() => setTimeFilter('30_days')}
               className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border ${
                 timeFilter === '30_days' 
                   ? 'bg-blue-600 text-white border-blue-600' 
                   : 'bg-white dark:bg-surface-dark text-gray-500 border-gray-200 dark:border-white/10'
               }`}
             >
               +30 Dias
             </button>
             <button 
               onClick={() => setTimeFilter('never')}
               className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border ${
                 timeFilter === 'never' 
                   ? 'bg-orange-500 text-white border-orange-500' 
                   : 'bg-white dark:bg-surface-dark text-gray-500 border-gray-200 dark:border-white/10'
               }`}
             >
               Nunca Contados
             </button>
          </div>
        </div>
      </div>

      <main className="flex flex-col gap-4 p-4 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredBlocks.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-400">
                    <p className="text-sm font-medium">Nenhum bloco encontrado.</p>
                </div>
              ) : (
                displayedBlocks.map((block) => {
                  const isExpanded = expandedBlocks.includes(block.id);
                  const visibleItems = isExpanded ? block.items : block.items.slice(0, 3);
                  const hiddenCount = block.items.length - 3;
                  const hasStaleItems = block.items.some(i => !i.lastCount || getDaysSince(i.lastCount.date) > 30);

                  return (
                    <div key={block.id} className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-card-border shadow-sm p-4 flex flex-col gap-3 animate-fade-in">
                      
                      {/* Header with Status */}
                      <div className="flex justify-between items-start">
                          <div>
                             <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-gray-900 dark:text-white text-base leading-tight">
                                    {block.parentRef}
                                </h3>
                                {/* Mobile Status Badge if limited space, or keep it on right */}
                             </div>
                             <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <Icon name="place" size={12} />
                                {block.location}
                             </p>
                          </div>
                          
                          {/* Status Badge */}
                          <div className="flex flex-col items-end gap-1">
                             {getStatusBadge(block.status, block.date)}
                             {hasStaleItems && (
                                <div className="flex items-center gap-1 text-[9px] text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded font-bold">
                                   <Icon name="priority_high" size={10} />
                                   <span>Itens Críticos</span>
                                </div>
                             )}
                          </div>
                      </div>

                      {/* DETAILED Item List */}
                      <div className="bg-gray-50 dark:bg-black/20 rounded-lg p-2 space-y-1">
                          {visibleItems.map((item: any, idx: number) => (
                              <div 
                                key={idx} 
                                onClick={() => setSelectedItem(item)} // Open details on click
                                className="flex flex-col gap-1 p-2 border-b border-gray-200/50 dark:border-white/5 last:border-0 hover:bg-gray-100 dark:hover:bg-white/5 rounded transition-colors cursor-pointer group"
                              >
                                  {/* Row 1: Name */}
                                  <div className="flex justify-between items-start">
                                    <span className="font-bold text-sm text-gray-800 dark:text-gray-200 leading-tight group-hover:text-primary transition-colors">
                                        {item.name}
                                    </span>
                                    <Icon name="info" size={14} className="text-gray-300 group-hover:text-primary transition-colors" />
                                  </div>
                                  
                                  {/* Row 2: Metadata (Ref | Brand | Balance) */}
                                  <div className="flex items-center gap-2 mt-0.5">
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-white dark:bg-white/10 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/5 shadow-sm">
                                        {item.ref}
                                      </span>
                                      
                                      <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1 border-l border-gray-300 dark:border-gray-600 pl-2">
                                        {item.brand}
                                      </span>

                                      <span className="ml-auto text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                        {item.balance} un
                                      </span>
                                  </div>
                              </div>
                          ))}
                          
                          {/* Expand Button - Only shows if there are hidden items */}
                          {hiddenCount > 0 && !isExpanded && (
                             <button 
                               onClick={(e) => toggleBlock(block.id, e)}
                               className="w-full text-center text-xs font-bold text-primary py-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded flex items-center justify-center gap-1 transition-colors"
                             >
                               Ver mais {hiddenCount} itens
                               <Icon name="expand_more" size={16} />
                             </button>
                          )}
                          {isExpanded && hiddenCount > 0 && (
                             <button 
                               onClick={(e) => toggleBlock(block.id, e)}
                               className="w-full text-center text-xs font-bold text-gray-400 py-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded flex items-center justify-center gap-1 transition-colors"
                             >
                               Ocultar itens
                               <Icon name="expand_less" size={16} />
                             </button>
                          )}
                      </div>

                      {/* Footer Action */}
                      <button 
                        onClick={(e) => handleReserve(block.id, e)}
                        className="w-full h-10 rounded-lg bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-all active:scale-95"
                      >
                         Reservar
                         <Icon name="lock" size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
      </main>

      <ItemDetailModal 
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        item={selectedItem}
      />
    </div>
  );
};