import React, { useState } from 'react';
import { Icon } from '../components/Icon';
import { Screen, Block } from '../types';

interface ListScreenProps {
  onNavigate: (screen: Screen) => void;
  blocks: Block[];
  segmentFilter: string | null;
  onReserveBlock: (id: number) => void;
  onClearFilter: () => void;
  mode: 'daily_meta' | 'browse';
  page?: number;
  onPageChange?: (page: number) => void;
}

export const ListScreen: React.FC<ListScreenProps> = ({ 
  onNavigate, 
  blocks, 
  segmentFilter, 
  onReserveBlock, 
  onClearFilter, 
  mode,
  page = 1,
  onPageChange
}) => {
  const [expandedBlocks, setExpandedBlocks] = useState<number[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const toggleBlock = (blockId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedBlocks(prev => 
      prev.includes(blockId) ? prev.filter(id => id !== blockId) : [...prev, blockId]
    );
  };

  const handleReserve = (blockId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onReserveBlock(blockId);
  };

  const isBrowseMode = mode === 'browse';

  return (
    <div className="relative flex flex-col w-full min-h-screen pb-24 md:pb-0 bg-background-light dark:bg-background-dark">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm p-4 border-b border-gray-200 dark:border-gray-800">
         <div className="flex items-center gap-4">
            {isBrowseMode ? (
                <button 
                  onClick={onClearFilter}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-surface-dark transition-colors"
                >
                  <Icon name="arrow_back" size={24} />
                </button>
            ) : (
                <button 
                  onClick={() => onNavigate('dashboard')}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-surface-dark transition-colors"
                >
                  <Icon name="arrow_back" size={24} />
                </button>
            )}
            
            <div className="flex-1">
              <h2 className="text-lg font-bold leading-tight">
                {isBrowseMode ? (segmentFilter || 'Resultado da Busca') : 'Meta Diária'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {blocks.length} blocos disponíveis
              </p>
            </div>
         </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 flex flex-col gap-4">
        {blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
             <Icon name="playlist_remove" size={64} className="mb-4 opacity-50" />
             <p className="font-medium">Nenhum bloco encontrado.</p>
             {isBrowseMode && (
                 <button onClick={onClearFilter} className="mt-4 text-primary font-bold text-sm">
                     Limpar Filtros
                 </button>
             )}
          </div>
        ) : (
          blocks.map((block) => {
            const isExpanded = expandedBlocks.includes(block.id);
            const visibleItems = isExpanded ? block.items : block.items.slice(0, 3);
            const hiddenCount = block.items.length - 3;
            
            // Check for treatment items in the block
            const hasTreatmentItems = block.items.some((i: any) => i.inTreatment);

            return (
                <div key={block.id} className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-card-border shadow-sm p-4 flex flex-col gap-3 animate-fade-in">
                  
                  {/* HEADER SIMPLIFICADO E ESTILIZADO */}
                  <div className="flex justify-between items-center">
                      <span className="font-bold text-orange-600 dark:text-orange-400 text-sm bg-orange-500/10 px-2 py-1 rounded-md">
                          {block.parentRef}
                      </span>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {block.date}
                      </span>
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
                                  {/* REF */}
                                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/5">
                                    {item.ref}
                                  </span>
                                  
                                  {/* BRAND */}
                                  <span className="truncate text-[10px] font-semibold text-gray-500 dark:text-gray-400 border-l border-gray-300 dark:border-gray-600 pl-2 uppercase">
                                    {item.brand}
                                  </span>

                                  {/* LOCATION */}
                                  <span className="shrink-0 text-[10px] font-mono text-gray-400 dark:text-gray-500 border-l border-gray-300 dark:border-gray-600 pl-2 flex items-center gap-1">
                                    <Icon name="place" size={12} />
                                    {(item.location && item.location !== 'GERAL') ? item.location : '-'}
                                  </span>

                                  {/* BALANCE */}
                                  <span className="ml-auto shrink-0 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                    {item.balance} un
                                  </span>
                              </div>
                          </div>
                      ))}
                      
                      {/* Expand Button */}
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

                  {/* Footer Action - BLOQUEIO POR IMPEDIMENTO */}
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
                         Reservar
                         <Icon name="lock" size={14} />
                      </button>
                  )}
                </div>
            );
          })
        )}
        
        {/* Pagination Controls for Browse Mode */}
        {isBrowseMode && blocks.length > 0 && onPageChange && page && (
             <div className="flex justify-center items-center gap-4 py-4">
                 <button 
                    disabled={page === 1}
                    onClick={() => onPageChange(page - 1)}
                    className="p-2 rounded-lg bg-white dark:bg-surface-dark border border-gray-200 dark:border-card-border disabled:opacity-50"
                 >
                    <Icon name="chevron_left" />
                 </button>
                 <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Página {page}</span>
                 <button 
                    onClick={() => onPageChange(page + 1)}
                    className="p-2 rounded-lg bg-white dark:bg-surface-dark border border-gray-200 dark:border-card-border"
                 >
                    <Icon name="chevron_right" />
                 </button>
             </div>
        )}
      </main>
    </div>
  );
};