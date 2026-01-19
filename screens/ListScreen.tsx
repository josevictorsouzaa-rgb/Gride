
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
  // Estado da aba alterado para incluir 'progress'
  const [activeTab, setActiveTab] = useState<'pending' | 'progress' | 'completed'>('pending');
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
          // Pendentes: Apenas livres (não completados E não reservados)
          if (block.status === 'completed' || block.status === 'progress') return false;
      } else if (activeTab === 'progress') {
          // Em Andamento: Apenas os reservados (progress)
          if (block.status !== 'progress') return false;
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
           const matchUser = block.lockedBy?.userName.toLowerCase().includes(lower); // Busca também pelo usuário se estiver reservado
           
           if (!matchItems && !matchLoc && !matchUser) return false;
      }
      return true;
    });
  }, [blocks, searchText, activeTab]);

  const counts = useMemo(() => {
      // Contagem baseada nos blocos carregados atualmente (página atual)
      // Se tiver externalCounts, usamos para pending/completed, mas calculamos progress localmente ou precisamos ajustar a API.
      // Assumindo que externalCounts é global para a categoria:
      
      const localProgress = blocks.filter(b => b.status === 'progress').length;
      
      // Fallback para contagem local se não houver externa
      const localPending = blocks.filter(b => b.status !== 'completed' && b.status !== 'progress').length;
      const localCompleted = blocks.filter(b => b.status === 'completed').length;

      return { 
          pending: localPending, 
          progress: localProgress,
          completed: localCompleted 
      };
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
               {activeTab === 'pending' ? 'Disponíveis para Contagem' : (activeTab === 'progress' ? 'Sendo Contados' : 'Itens Finalizados')}
            </p>
          </div>
        </div>

        {/* TABS - AGORA SÃO 3 */}
        <div className="px-4 pb-2 flex gap-2">
            <button 
              onClick={() => setActiveTab('pending')}
              className={`flex-1 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors border flex flex-col items-center justify-center ${
                  activeTab === 'pending' 
                  ? 'bg-white dark:bg-surface-dark border-gray-200 dark:border-card-border text-primary shadow-sm' 
                  : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            >
                <span>A Fazer</span>
                <span className="opacity-70">({counts.pending})</span>
            </button>
            
            <button 
              onClick={() => setActiveTab('progress')}
              className={`flex-1 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors border flex flex-col items-center justify-center ${
                  activeTab === 'progress' 
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/30 text-amber-700 dark:text-amber-300 shadow-sm' 
                  : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            >
                <span>Em Andamento</span>
                <span className="opacity-70">({counts.progress})</span>
            </button>

            <button 
              onClick={() => setActiveTab('completed')}
              className={`flex-1 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors border flex flex-col items-center justify-center ${
                  activeTab === 'completed' 
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/30 text-green-700 dark:text-green-300 shadow-sm' 
                  : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            >
                <span>Concluídos</span>
                <span className="opacity-70">({counts.completed})</span>
            </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="flex w-full items-center rounded-xl h-11 bg-white dark:bg-surface-dark border border-gray-200 dark:border-card-border">
              <div className="pl-3 text-gray-400"><Icon name="search" size={20} /></div>
              <input 
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-3 text-gray-900 dark:text-white" 
                placeholder={activeTab === 'progress' ? "Buscar por usuário ou item..." : "Filtrar lista..."}
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
                <Icon name={activeTab === 'pending' ? "playlist_add_check" : (activeTab === 'progress' ? "hourglass_empty" : "search_off")} size={48} className="mb-2 opacity-50" />
                <p>
                    {activeTab === 'pending' && "Tudo limpo! Nada pendente aqui."}
                    {activeTab === 'progress' && "Nenhum bloco sendo contado no momento."}
                    {activeTab === 'completed' && "Nenhum item concluído ainda."}
                </p>
                {onPageChange && activeTab === 'pending' && (
                    <button 
                        onClick={() => onPageChange(page + 1)}
                        className="mt-4 text-primary font-bold text-sm underline"
                    >
                        Verificar Próxima Página
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

                // Definição de Cores da Borda Lateral
                let borderLeftColor = 'border-l-gray-300 dark:border-l-gray-600';
                if (isFullyCounted) borderLeftColor = 'border-l-green-500';
                if (isReservedByOther) borderLeftColor = 'border-l-amber-500';

                // Tratamento do Título e Código - REMOVE 'REF PAI' DUPLICADO
                const cleanParentRef = block.parentRef.replace(/REF PAI:?/gi, '').trim();
                const mainTitle = block.items[0]?.name || 'Grupo de Itens';

                return (
                    <div 
                        key={block.id} 
                        className={`relative rounded-lg shadow-md bg-white dark:bg-[#1e2329] overflow-hidden transition-all duration-500 ease-in-out transform border border-gray-200 dark:border-gray-700/50 border-l-4 ${borderLeftColor} ${
                            isExiting 
                            ? 'opacity-0 translate-x-full max-h-0 mb-0 border-none' // Animação de Saída
                            : `opacity-100 translate-x-0 max-h-[1000px]`
                        }`}
                    >
                        {/* Header do Bloco */}
                        <div className="flex flex-col">
                            {/* RESERVADO POR - BARRA DE TOPO */}
                            {isReservedByOther && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 flex items-center justify-between border-b border-amber-100 dark:border-amber-800/50">
                                    <span className="text-[10px] font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wide flex items-center gap-1">
                                        <Icon name="lock" size={12} fill /> Reservado
                                    </span>
                                    <span className="text-xs font-bold text-amber-900 dark:text-amber-100">
                                        {block.lockedBy?.userName || 'Usuário'}
                                    </span>
                                </div>
                            )}

                            <div className="p-3 flex justify-between items-start border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
                                <div className="flex flex-col gap-1 pr-2">
                                    {/* Nome do Produto em Destaque */}
                                    <span className="text-sm font-bold text-gray-900 dark:text-white leading-tight line-clamp-2">
                                        {mainTitle}
                                    </span>
                                    
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {/* Código Ref Pai (Discreto) */}
                                        <span className="text-[10px] font-bold bg-white dark:bg-black/30 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded border border-gray-200 dark:border-white/10 uppercase tracking-wide">
                                            {cleanParentRef}
                                        </span>
                                        <span className="text-xs text-gray-400 flex items-center gap-1">
                                            <Icon name="place" size={12} /> {block.location}
                                        </span>
                                    </div>
                                </div>
                                
                                {!isReservedByOther && isFullyCounted && (
                                    <Icon name="check_circle" className="text-green-500 shrink-0" size={24} />
                                )}
                            </div>
                        </div>

                        {/* Itens - COM PADDING INFERIOR EXTRA (pb-3) */}
                        <div className="divide-y divide-gray-100 dark:divide-white/5 pb-3">
                            {visibleItems.map((item: any, idx: number) => (
                                <div 
                                    key={idx}
                                    onClick={() => setSelectedItem(item)}
                                    className="p-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors"
                                >
                                    <div className="flex-1 min-w-0 pr-3">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="text-sm font-bold truncate text-gray-800 dark:text-gray-100">
                                                {item.name}
                                            </span>
                                            {/* Oculta check se reservado por outro */}
                                            {!isReservedByOther && item.isCounted && <Icon name="check" size={16} className="text-green-500" />}
                                        </div>
                                        
                                        {/* HIGH CONTRAST INFO */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-mono font-bold bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 px-1.5 py-0.5 rounded border border-gray-200 dark:border-white/10">
                                                {item.ref}
                                            </span>
                                            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight">
                                                {item.brand}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Detalhes de Estoque ou Contagem (OCULTAR SE RESERVADO POR OUTRO) */}
                                    {!isReservedByOther && (
                                        <div className="shrink-0 text-right">
                                            {item.lastCount ? (
                                                <>
                                                    <span className="block text-sm font-black text-green-600 dark:text-green-400">{item.lastCount.qty} un</span>
                                                    <span className="block text-[9px] text-gray-400">
                                                        {new Date(item.lastCount.date).toLocaleDateString(undefined, {day:'2-digit', month:'2-digit'})}
                                                    </span>
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[9px] text-gray-400 font-bold uppercase">Saldo</span>
                                                    <span className="font-bold text-gray-700 dark:text-gray-300">{item.balance}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Footer / Actions */}
                        <div className="flex flex-col">
                            {(hiddenCount > 0) && (
                                <button 
                                    onClick={(e) => toggleBlock(block.id, e)}
                                    className="w-full py-2 text-xs font-bold text-gray-500 hover:text-primary hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-t border-gray-100 dark:border-white/5 flex items-center justify-center gap-1"
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
                            
                            {/* BOTÃO DE RESERVA (Apenas se NÃO estiver em progresso por outro) */}
                            {!isReservedByOther && (
                                <div className="p-3 bg-gray-50 dark:bg-white/5 border-t border-gray-100 dark:border-white/5">
                                    <button 
                                        onClick={(e) => handleReserve(block.id, e)}
                                        className={`w-full py-3 rounded-lg text-sm font-bold shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 ${
                                            isFullyCounted 
                                            ? 'bg-white dark:bg-surface-dark border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5' 
                                            : 'bg-gray-900 dark:bg-white text-white dark:text-black'
                                        }`}
                                    >
                                        <Icon name={isFullyCounted ? "refresh" : "lock"} size={18} />
                                        {isFullyCounted ? "Recontar / Validar" : "Reservar Bloco"}
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
