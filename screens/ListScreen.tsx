
import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '../components/Icon';
import { Screen, Block } from '../types';
import { ItemDetailModal } from '../components/ItemDetailModal';

interface ListScreenProps {
  onNavigate: (screen: Screen) => void;
  blocks: Block[]; 
  segmentFilter: string | null;
  onReserveBlock: (id: number) => void;
  onClearFilter: () => void;
  mode?: 'browse'; 
  page?: number;
  onPageChange?: (newPage: number) => void;
  externalCounts?: { pending: number, completed: number }; // Nova prop para totais reais
}

export const ListScreen: React.FC<ListScreenProps> = ({ 
  onNavigate, 
  blocks, 
  segmentFilter, 
  onReserveBlock, 
  onClearFilter,
  page = 1,
  onPageChange,
  externalCounts
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [expandedBlocks, setExpandedBlocks] = useState<number[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [searchText, setSearchText] = useState('');
  
  // Estado para rastrear itens saindo (animação)
  const [exitingIds, setExitingIds] = useState<number[]>([]);

  // Scroll to top on page change
  useEffect(() => {
    const el = document.getElementById('main-scroll-container');
    if(el) el.scrollTo({top: 0, behavior: 'smooth'});
  }, [page, activeTab]);

  const toggleBlock = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedBlocks(prev => 
      prev.includes(id) ? prev.filter(blockId => blockId !== id) : [...prev, id]
    );
  };

  const handleReserve = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // 1. Adiciona ID à lista de saída para disparar animação CSS
    setExitingIds(prev => [...prev, id]);

    // 2. Aguarda o tempo da animação (400ms) para remover os dados
    setTimeout(() => {
        onReserveBlock(id);
        // Limpeza (opcional, pois o componente pode remontar com novos dados)
        setExitingIds(prev => prev.filter(eid => eid !== id));
    }, 400);
  };

  // Filtragem local
  const filteredBlocks = useMemo(() => {
    return blocks.filter(block => {
      // 1. Filtrar por Aba
      if (activeTab === 'pending') {
          // Pendentes: Não estão completados E não estão em progresso (a menos que seja visualização admin, mas aqui assumimos reservar)
          // Mas "blocks" do backend vem com status 'progress' se estiver reservado por alguém.
          // Vamos mostrar em pendente mas desabilitado se estiver reservado.
          // Ocultar completados.
          if (block.status === 'completed') return false;
      } else {
          // Concluídos: Apenas completed
          if (block.status !== 'completed') return false;
      }

      // 2. Busca Texto
      if (searchText) {
           const lower = searchText.toLowerCase();
           const matchItems = block.items.some(item => 
             item.name.toLowerCase().includes(lower) || 
             item.ref.toLowerCase().includes(lower)
           );
           const matchLoc = block.location.toLowerCase().includes(lower);
           if (!matchItems && !matchLoc) return false;
      }
      return true;
    });
  }, [blocks, searchText, activeTab]);

  const counts = useMemo(() => {
      // Se externalCounts for fornecido, usa-o para mostrar o TOTAL real da categoria
      if (externalCounts) {
          return externalCounts;
      }
      // Fallback: Conta apenas os blocos carregados
      const pending = blocks.filter(b => b.status !== 'completed').length;
      const completed = blocks.filter(b => b.status === 'completed').length;
      return { pending, completed };
  }, [blocks, externalCounts]);

  return (
    <div className="relative flex flex-col w-full min-h-screen pb-24 md:pb-0 bg-background-light dark:bg-background-dark md:bg-transparent">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background-light dark:bg-background-dark/95 md:bg-transparent backdrop-blur-md border-b border-gray-200 dark:border-card-border md:border-b-0">
        <div className="flex items-center p-4 justify-between gap-3">
          <button 
            onClick={onClearFilter}
            className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
          >
              <Icon name="arrow_back" size={24} />
          </button>
          
          <div className="flex-1 text-center pr-10">
            <h2 className="text-base font-bold leading-tight line-clamp-1">{segmentFilter || 'Explorar Estoque'}</h2>
            <p className="text-xs text-gray-500">
               {activeTab === 'pending' ? 'Itens a Inventariar' : 'Itens Já Contados'}
            </p>
          </div>
        </div>

        {/* TABS */}
        <div className="px-4 pb-2 flex gap-2">
            <button 
              onClick={() => setActiveTab('pending')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors border ${
                  activeTab === 'pending' 
                  ? 'bg-white dark:bg-surface-dark border-gray-200 dark:border-card-border text-primary shadow-sm' 
                  : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            >
                A Fazer ({counts.pending})
            </button>
            <button 
              onClick={() => setActiveTab('completed')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors border ${
                  activeTab === 'completed' 
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/30 text-green-700 dark:text-green-300 shadow-sm' 
                  : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            >
                Concluídos ({counts.completed})
            </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="flex w-full items-center rounded-xl h-11 bg-white dark:bg-surface-dark border border-gray-200 dark:border-card-border">
              <div className="pl-3 text-gray-400"><Icon name="search" size={20} /></div>
              <input 
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-3 text-gray-900 dark:text-white" 
                placeholder={activeTab === 'pending' ? "Filtrar pendentes..." : "Buscar nos concluídos..."}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              {searchText && (
                <button onClick={() => setSearchText('')} className="pr-3 text-gray-400"><Icon name="close" size={18} /></button>
              )}
          </div>
        </div>
      </div>

      {/* List */}
      <main className="flex flex-col gap-3 p-4">
        {filteredBlocks.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
                <Icon name={activeTab === 'pending' ? "playlist_add_check" : "search_off"} size={48} className="mb-2 opacity-50" />
                <p>{activeTab === 'pending' ? "Tudo contado por aqui (nesta página)!" : "Nenhum item concluído ainda."}</p>
                {onPageChange && (
                    <button 
                        onClick={() => onPageChange(page + 1)}
                        className="mt-4 text-primary font-bold text-sm underline"
                    >
                        Tentar Próxima Página
                    </button>
                )}
            </div>
        ) : (
            filteredBlocks.map((block) => {
                const isExpanded = expandedBlocks.includes(block.id);
                const visibleItems = isExpanded ? block.items : block.items.slice(0, 3);
                const hiddenCount = block.items.length - 3;
                
                const isReservedByOther = block.status === 'progress';
                const isFullyCounted = block.status === 'completed';
                
                const isExiting = exitingIds.includes(block.id);

                return (
                    <div 
                        key={block.id} 
                        className={`rounded-xl border shadow-sm overflow-hidden transition-all duration-500 ease-in-out transform ${
                            isExiting 
                            ? 'opacity-0 translate-x-full max-h-0 mb-0 border-none' // Animação de Saída
                            : `opacity-100 translate-x-0 max-h-[1000px] ${ // Estado Normal
                                isFullyCounted 
                                ? 'bg-green-50/50 dark:bg-green-900/5 border-green-100 dark:border-green-900/20 opacity-80' 
                                : 'bg-white dark:bg-surface-dark border-gray-200 dark:border-card-border'
                            }`
                        }`}
                    >
                        {/* Header do Bloco */}
                        <div className="p-3 flex justify-between items-center border-b border-gray-100 dark:border-white/5">
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold px-2 py-1 rounded ${
                                    isFullyCounted 
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                                    : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300'
                                }`}>
                                    {block.parentRef}
                                </span>
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <Icon name="place" size={12} /> {block.location}
                                </span>
                            </div>
                            
                            {isReservedByOther && (
                                <div className="flex items-center gap-1 text-[10px] font-bold text-orange-500 bg-orange-100 dark:bg-orange-900/20 px-2 py-0.5 rounded">
                                    <Icon name="lock" size={10} />
                                    {block.lockedBy?.userName || 'Em uso'}
                                </div>
                            )}
                            
                            {isFullyCounted && (
                                <Icon name="check_circle" className="text-green-500" size={20} />
                            )}
                        </div>

                        {/* Itens */}
                        <div className="divide-y divide-gray-100 dark:divide-white/5">
                            {visibleItems.map((item: any, idx: number) => (
                                <div 
                                    key={idx}
                                    onClick={() => setSelectedItem(item)}
                                    className="p-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
                                >
                                    <div className="flex-1 min-w-0 pr-2">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-sm font-bold truncate text-gray-800 dark:text-gray-200">
                                                {item.name}
                                            </span>
                                            {item.isCounted && <Icon name="check" size={14} className="text-green-500" />}
                                        </div>
                                        <div className="flex gap-2 text-[10px] text-gray-500">
                                            <span className="bg-gray-100 dark:bg-white/10 px-1.5 rounded">{item.ref}</span>
                                            <span>{item.brand}</span>
                                            {activeTab === 'pending' && <span className="ml-auto font-medium">Est: {item.balance}</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer / Actions - Reorganizado Verticalmente */}
                        <div className="flex flex-col">
                            {(hiddenCount > 0) && (
                                <button 
                                    onClick={(e) => toggleBlock(block.id, e)}
                                    className="w-full py-3 text-xs font-bold text-gray-500 hover:text-primary hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-t border-gray-100 dark:border-white/5 flex items-center justify-center gap-1"
                                >
                                    {isExpanded ? (
                                        <>
                                            <Icon name="expand_less" size={16} />
                                            Recolher
                                        </>
                                    ) : (
                                        <>
                                            Ver +{hiddenCount} itens
                                            <Icon name="expand_more" size={16} />
                                        </>
                                    )}
                                </button>
                            )}
                            
                            {!isFullyCounted && !isReservedByOther && (
                                <div className="p-2 bg-gray-50 dark:bg-white/5 border-t border-gray-100 dark:border-white/5">
                                    <button 
                                        onClick={(e) => handleReserve(block.id, e)}
                                        className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-bold shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                                    >
                                        <Icon name="lock" size={16} />
                                        Reservar Bloco
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })
        )}

        {/* Pagination Buttons */}
        {onPageChange && (
            <div className="flex justify-center gap-4 py-4">
                <button 
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    className="p-2 rounded-full bg-gray-200 dark:bg-white/10 disabled:opacity-50"
                >
                    <Icon name="chevron_left" />
                </button>
                <span className="py-2 text-sm font-bold text-gray-500">Pág {page}</span>
                <button 
                    onClick={() => onPageChange(page + 1)}
                    className="p-2 rounded-full bg-gray-200 dark:bg-white/10"
                >
                    <Icon name="chevron_right" />
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
