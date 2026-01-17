
import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '../components/Icon';
import { Screen, Block } from '../types';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { AutoPartsLoader } from '../components/AutoPartsLoader';

interface ListScreenProps {
  onNavigate: (screen: Screen) => void;
  blocks: Block[]; 
  segmentFilter: string | null;
  onReserveBlock: (id: number) => void;
  onClearFilter: () => void;
  mode?: 'browse'; 
  page?: number;
  onPageChange?: (newPage: number) => void;
}

// Helper for Relative Time (AddedAt)
const getRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Hoje';
    const itemDate = new Date(isoString);
    const now = new Date();
    itemDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diffTime = now.getTime() - itemDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    return `${diffDays}d atrás`;
};

export const ListScreen: React.FC<ListScreenProps> = ({ 
  onNavigate, 
  blocks: propBlocks, 
  segmentFilter, 
  onReserveBlock, 
  onClearFilter,
  mode = 'browse',
  page = 1,
  onPageChange
}) => {
  const [localBlocks, setLocalBlocks] = useState<Block[]>(propBlocks);
  const [expandedBlocks, setExpandedBlocks] = useState<number[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null); 
  
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
      setLocalBlocks(propBlocks);
  }, [propBlocks]);

  useEffect(() => {
    const scrollContainer = document.getElementById('main-scroll-container');
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [page]);

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

  const filteredBlocks = useMemo(() => {
    return localBlocks.filter(block => {
      if (block.status === 'progress') return false; 
      
      if (searchText) {
           const lowerSearch = searchText.toLowerCase();
           const matchesItems = block.items.some(item => 
             item.name.toLowerCase().includes(lowerSearch) || 
             item.ref.toLowerCase().includes(lowerSearch)
           );
           const matchesLoc = block.location.toLowerCase().includes(lowerSearch);
           if (!matchesItems && !matchesLoc) return false;
      }
      return true;
    });
  }, [localBlocks, segmentFilter, searchText, mode]);

  const displayedBlocks = filteredBlocks;

  return (
    <div className="relative flex flex-col w-full min-h-screen pb-24 md:pb-0 bg-background-light dark:bg-background-dark md:bg-transparent">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background-light dark:bg-background-dark/95 md:bg-transparent backdrop-blur-md md:backdrop-blur-none border-b border-gray-200 dark:border-card-border md:border-b-0">
        <div className="flex items-center p-4 justify-between gap-3">
          <button 
            onClick={() => {
              setSearchText('');
              onClearFilter();
            }}
            className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-surface-dark cursor-pointer transition-colors"
          >
              <Icon name="arrow_back" size={24} className="text-gray-700 dark:text-white" />
          </button>
          
          <div className="flex-1 md:text-left text-center pr-2 md:pr-0">
            <h2 className="text-lg font-bold leading-tight">{segmentFilter || 'Explorar Itens'}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
               {filteredBlocks.length} blocos listados
            </p>
          </div>
          
          <div className="size-10 md:hidden" /> 
        </div>

        {/* Search */}
        <div className="px-4 pb-3 space-y-3">
          <div className="flex w-full items-stretch rounded-xl h-11 bg-white dark:bg-surface-dark overflow-hidden transition-all border border-gray-100 dark:border-white/5">
              <div className="flex items-center justify-center pl-4 text-gray-400">
                <Icon name="search" size={20} />
              </div>
              <input 
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-3 placeholder-gray-400 text-gray-900 dark:text-white" 
                placeholder="Buscar item, SKU ou local..."
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
        </div>
      </div>

      <main className="flex flex-col gap-4 p-4 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredBlocks.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-400">
                    <Icon name="search_off" size={48} className="mb-2 opacity-50" />
                    <p className="text-sm font-medium">Nenhum bloco encontrado.</p>
                    {segmentFilter && segmentFilter.includes('Vazio') && (
                        <p className="text-xs text-center mt-2 opacity-70">
                            Use a busca acima para encontrar itens e movê-los para este local.
                        </p>
                    )}
                </div>
              ) : (
                displayedBlocks.map((block: any) => {
                  const isExpanded = expandedBlocks.includes(block.id);
                  const visibleItems = isExpanded ? block.items : block.items.slice(0, 3);
                  const hiddenCount = block.items.length - 3;
                  
                  const hasTreatmentItems = block.items.some((i: any) => i.inTreatment);
                  
                  return (
                    <div key={block.id} className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-card-border shadow-sm p-4 flex flex-col gap-3 animate-fade-in">
                      
                      {/* HEADER SIMPLIFICADO */}
                      <div className="flex justify-between items-center">
                          <div className="flex flex-col">
                              <span className="font-bold text-gray-700 dark:text-gray-300 text-sm bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-md w-fit">
                                  {block.parentRef}
                              </span>
                              <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-1 ml-1">
                                  <Icon name="place" size={10} />
                                  {block.location}
                              </div>
                          </div>
                      </div>

                      {/* DETAILED Item List */}
                      <div className="bg-gray-50 dark:bg-black/20 rounded-lg p-2 space-y-1">
                          {visibleItems.map((item: any, idx: number) => (
                              <div 
                                key={idx} 
                                onClick={() => setSelectedItem(item)}
                                className="flex flex-col gap-1 p-2 border-b border-gray-200/50 dark:border-white/5 last:border-0 hover:bg-gray-100 dark:hover:bg-white/5 rounded transition-colors cursor-pointer group"
                              >
                                  {/* Row 1: Name */}
                                  <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2 flex-1">
                                        <span className={`font-bold text-sm leading-tight transition-colors ${item.inTreatment ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200 group-hover:text-primary'}`}>
                                            {item.name}
                                        </span>
                                        {item.inTreatment && <Icon name="lock" size={12} className="text-orange-500" />}
                                    </div>
                                    <Icon name="info" size={14} className="text-gray-300 group-hover:text-primary transition-colors" />
                                  </div>
                                  
                                  {/* Row 2: Metadata (Ref | Brand | Location | Balance) */}
                                  <div className="flex items-center gap-2 mt-1 w-full overflow-hidden">
                                      <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/5">
                                        {item.ref}
                                      </span>
                                      
                                      <span className="truncate text-[10px] font-semibold text-gray-500 dark:text-gray-400 border-l border-gray-300 dark:border-gray-600 pl-2 uppercase">
                                        {item.brand}
                                      </span>

                                      <span className="ml-auto shrink-0 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                        {item.balance} un
                                      </span>
                                  </div>
                              </div>
                          ))}
                          
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

                      {hasTreatmentItems ? (
                          <div className="w-full h-12 rounded-xl bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 text-xs font-bold uppercase tracking-wide flex flex-col items-center justify-center cursor-not-allowed">
                             <div className="flex items-center gap-1">
                                <Icon name="lock" size={16} />
                                Bloqueado para Reserva
                             </div>
                             <span className="text-[9px] opacity-80 font-medium normal-case">Regularize as divergências primeiro</span>
                          </div>
                      ) : (
                          <button 
                            onClick={(e) => handleReserve(block.id, e)}
                            className="w-full h-12 rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-white dark:text-black dark:hover:bg-gray-200 text-white text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg"
                          >
                             Reservar para Contagem
                             <Icon name="lock" size={14} />
                          </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            
            {onPageChange && (
                <div className="flex justify-center items-center gap-4 py-4 mt-4">
                    <button 
                        onClick={() => onPageChange(page - 1)}
                        disabled={page <= 1}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Icon name="chevron_left" size={18} />
                        Anterior
                    </button>
                    <span className="text-sm font-bold text-gray-600 dark:text-gray-300">Página {page}</span>
                    <button 
                        onClick={() => onPageChange(page + 1)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 transition-colors"
                    >
                        Próxima
                        <Icon name="chevron_right" size={18} />
                    </button>
                </div>
            )}
      </main>

      <ItemDetailModal 
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        item={selectedItem}
      />
    </div>
  );
};
