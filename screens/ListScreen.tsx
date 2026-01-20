
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
  externalCounts?: { pending: number, progress: number, completed: number }; 
}

const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'US';

// Helper para data completa
const formatFullDateTime = (dateStr: string) => {
    if (!dateStr) return '--/--/---- --:--';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

// Helper para tempo relativo
const getTimeAgo = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Agora';
    if (diffInSeconds < 3600) return `Há ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `Há ${Math.floor(diffInSeconds / 3600)} h`;
    if (diffInSeconds < 2592000) return `Há ${Math.floor(diffInSeconds / 86400)} d`;
    return 'Há +1 mês';
};

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
  // ADICIONADO: Estado 'all' para visualização completa
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'progress' | 'completed'>('pending');
  const [expandedBlocks, setExpandedBlocks] = useState<number[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [searchText, setSearchText] = useState('');
  
  const [exitingIds, setExitingIds] = useState<number[]>([]);

  // Limite definido para paginação
  const PAGE_LIMIT = 30;

  // Lógica para detectar se é um modo de visualização especial (Busca ou Localização)
  const isSpecialView = segmentFilter && (segmentFilter.startsWith('Localização:') || segmentFilter === 'Resultado da Busca');

  // Efeito para setar a aba padrão correta
  useEffect(() => {
    if (isSpecialView) {
        setActiveTab('all');
    } else {
        setActiveTab('pending');
    }
    const el = document.getElementById('main-scroll-container');
    if(el) el.scrollTo({top: 0, behavior: 'smooth'});
  }, [segmentFilter, isSpecialView]);

  useEffect(() => {
    // Reset scroll on normal tab change or page change
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
    setExitingIds(prev => [...prev, id]);
    setTimeout(() => {
        onReserveBlock(id);
        setExitingIds(prev => prev.filter(eid => eid !== id));
    }, 400);
  };

  // Filtragem local apenas para exibir o que está na página atual
  const filteredBlocks = useMemo(() => {
    return blocks.filter(block => {
      // Filtragem por Tab
      if (activeTab === 'all') {
          // Mostra tudo
      } else if (activeTab === 'pending') {
          if (block.status === 'completed' || block.status === 'progress') return false;
      } else if (activeTab === 'progress') {
          if (block.status !== 'progress') return false;
      } else {
          if (block.status !== 'completed') return false;
      }

      // Filtragem por Texto Local
      if (searchText) {
           const lower = searchText.toLowerCase();
           const matchItems = block.items.some(item => 
             item.name.toLowerCase().includes(lower) || 
             item.ref.toLowerCase().includes(lower)
           );
           const matchLoc = block.location.toLowerCase().includes(lower);
           const matchUser = block.lockedBy?.userName.toLowerCase().includes(lower);
           if (!matchItems && !matchLoc && !matchUser) return false;
      }
      return true;
    });
  }, [blocks, searchText, activeTab]);

  // Contadores Reais (Usando ExternalCounts se disponível)
  const counts = useMemo(() => {
      if (externalCounts) {
          const total = externalCounts.pending + externalCounts.progress + externalCounts.completed;
          return { ...externalCounts, total };
      }
      
      // Fallback para contagem local
      const localProgress = blocks.filter(b => b.status === 'progress').length;
      const localPending = blocks.filter(b => b.status !== 'completed' && b.status !== 'progress').length;
      const localCompleted = blocks.filter(b => b.status === 'completed').length;
      const localTotal = blocks.length;

      return { 
          pending: localPending, 
          progress: localProgress,
          completed: localCompleted,
          total: localTotal
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
               {activeTab === 'all' ? 'Todos os Itens' : (activeTab === 'pending' ? 'Disponíveis' : (activeTab === 'progress' ? 'Em Andamento' : 'Concluídos'))}
            </p>
          </div>
        </div>

        {/* TABS (Adaptativo: Mostra 'Todos' se estiver em modo especial) */}
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
            {/* Aba TODOS - Só aparece em modo especial ou se selecionada */}
            {(isSpecialView || activeTab === 'all') && (
                <button 
                onClick={() => setActiveTab('all')}
                className={`min-w-[70px] flex-1 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors border flex flex-col items-center justify-center ${
                    activeTab === 'all' 
                    ? 'bg-gray-800 text-white dark:bg-white dark:text-black shadow-sm' 
                    : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'
                }`}
                >
                    <span>Todos</span>
                    <span className="opacity-70">({counts.total})</span>
                </button>
            )}

            <button 
              onClick={() => setActiveTab('pending')}
              className={`min-w-[70px] flex-1 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors border flex flex-col items-center justify-center ${
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
              className={`min-w-[70px] flex-1 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors border flex flex-col items-center justify-center ${
                  activeTab === 'progress' 
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm' 
                  : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            >
                <span>Andamento</span>
                <span className="opacity-70">({counts.progress})</span>
            </button>

            <button 
              onClick={() => setActiveTab('completed')}
              className={`min-w-[70px] flex-1 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors border flex flex-col items-center justify-center ${
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
                placeholder={activeTab === 'progress' ? "Buscar por usuário ou item..." : "Filtrar na página..."}
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
                <Icon name={activeTab === 'pending' ? "playlist_add_check" : (activeTab === 'progress' ? "hourglass_empty" : (activeTab === 'all' ? "folder_off" : "search_off"))} size={48} className="mb-2 opacity-50" />
                <p>
                    {activeTab === 'all' && "Nenhum item encontrado nesta visualização."}
                    {activeTab === 'pending' && "Nada pendente encontrado nesta página."}
                    {activeTab === 'progress' && "Nenhum bloco em andamento nesta página."}
                    {activeTab === 'completed' && "Nenhum item concluído nesta página."}
                </p>
                {/* Se não tiver nada na lista mas estivermos na página > 1, mostra opção de voltar */}
                {onPageChange && page > 1 && (
                    <button 
                        onClick={() => onPageChange(page - 1)}
                        className="mt-4 text-primary font-bold text-sm underline"
                    >
                        Voltar para Página Anterior
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
                const isLockedForTreatment = block.status === 'treatment_pending';
                const isExiting = exitingIds.includes(block.id);

                const cleanParentRef = block.parentRef.replace(/REF PAI:?/gi, '').trim();
                const mainTitle = block.items[0]?.name || 'Grupo de Itens';

                // --- LOGICA DE ESTILOS DINÂMICOS ---
                let containerClass = "border-gray-200 dark:border-gray-700/50";
                let headerClass = "bg-gray-50/50 dark:bg-white/5 border-gray-100 dark:border-white/5";
                let headerTextMain = "text-gray-900 dark:text-white";
                let headerTextSub = "text-gray-500 dark:text-gray-400";
                let labelColor = "text-gray-400";

                // Se estiver reservado (AZUL)
                if (isReservedByOther) {
                    containerClass = "border-blue-500/50 shadow-blue-500/10";
                    headerClass = "bg-primary dark:bg-primary-dark border-primary";
                    headerTextMain = "text-white";
                    headerTextSub = "text-blue-100";
                    labelColor = "text-blue-200";
                } 
                // Se estiver concluído (VERDE)
                else if (isFullyCounted) {
                    containerClass = "border-green-500/50 shadow-green-500/10";
                    headerClass = "bg-green-600 dark:bg-green-700 border-green-600";
                    headerTextMain = "text-white";
                    headerTextSub = "text-green-100";
                    labelColor = "text-green-200";
                }
                // Se estiver bloqueado por tratamento (LARANJA)
                else if (isLockedForTreatment) {
                    containerClass = "border-orange-500/50 shadow-orange-500/10";
                    headerClass = "bg-orange-600 dark:bg-orange-700 border-orange-600";
                    headerTextMain = "text-white";
                    headerTextSub = "text-orange-100";
                    labelColor = "text-orange-200";
                }

                // Identifica quem concluiu (pega do primeiro item que tiver lastCount)
                const completedByUser = isFullyCounted 
                    ? (block.items.find((i: any) => i.lastCount)?.lastCount?.user || 'Sistema')
                    : null;
                
                // Nome do usuário para exibição
                const displayUserName = isReservedByOther 
                    ? (block.lockedBy?.userName?.split(' ')[0] || 'Usuário') 
                    : (completedByUser?.split(' ')[0] || 'Sistema');

                const displayUserInitials = isReservedByOther
                    ? getInitials(block.lockedBy?.userName || '')
                    : getInitials(completedByUser || '');

                // --- CÁLCULO DO TEMPO RELATIVO ---
                let relativeTimeStr = '';
                if (isReservedByOther && block.lockedBy?.timestamp) {
                    // Tempo desde que foi reservado
                    relativeTimeStr = getTimeAgo(block.lockedBy.timestamp);
                } else if (isFullyCounted) {
                    // Tempo desde a última contagem registrada no bloco
                    const dates = block.items
                        .map((i: any) => i.lastCount?.date ? new Date(i.lastCount.date).getTime() : 0)
                        .filter((d: number) => d > 0);
                    
                    if (dates.length > 0) {
                        const maxDate = new Date(Math.max(...dates));
                        relativeTimeStr = getTimeAgo(maxDate.toISOString());
                    }
                }

                return (
                    <div 
                        key={block.id} 
                        className={`relative rounded-xl shadow-sm bg-white dark:bg-[#1e2329] overflow-hidden transition-all duration-500 ease-in-out transform border ${containerClass} ${
                            isExiting 
                            ? 'opacity-0 translate-x-full max-h-0 mb-0 border-none'
                            : `opacity-100 translate-x-0 max-h-[1000px]`
                        }`}
                    >
                        {/* Header do Bloco */}
                        <div className={`p-3 border-b ${headerClass}`}>
                            <div className="flex justify-between items-start">
                                <div className="flex-1 pr-2">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${labelColor}`}>
                                        Ref. Pai
                                    </span>
                                    <h3 className={`text-sm font-bold leading-tight line-clamp-2 mt-0.5 ${headerTextMain}`}>
                                        {cleanParentRef || mainTitle}
                                    </h3>
                                    
                                    <div className={`flex items-center gap-1 mt-1 text-xs ${headerTextSub}`}>
                                        <Icon name="place" size={14} /> 
                                        <span className="font-medium">{block.location}</span>
                                    </div>
                                </div>

                                {/* LADO DIREITO DO HEADER: Status ou Info */}
                                {isLockedForTreatment ? (
                                    <div className="flex flex-col items-end shrink-0 pl-2">
                                        <div className="flex items-center gap-1 px-2 py-1 bg-white/20 rounded-lg text-white text-xs font-bold border border-white/20">
                                            <Icon name="lock" size={14} />
                                            <span>Em Tratamento</span>
                                        </div>
                                    </div>
                                ) : (isReservedByOther || isFullyCounted) && (
                                    <div className="flex flex-col items-end shrink-0 pl-2">
                                        <div className="flex items-center">
                                            <div className="flex flex-col items-end mr-2 text-right">
                                                <span className={`block text-[9px] font-bold uppercase ${labelColor} mb-0.5`}>
                                                    {isReservedByOther ? 'Reservado por' : 'Concluído por'}
                                                </span>
                                                <span className={`block text-xs font-bold ${headerTextMain} max-w-[80px] truncate leading-none`}>
                                                    {displayUserName}
                                                </span>
                                                
                                                {/* TEMPO DECORRIDO ABAIXO DO NOME */}
                                                {relativeTimeStr && (
                                                    <span className={`block text-[9px] font-medium opacity-80 ${headerTextMain} mt-1`}>
                                                        {relativeTimeStr}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {/* Circulo com Avatar */}
                                            <div className="size-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                                                {displayUserInitials}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Itens */}
                        <div className="divide-y divide-gray-100 dark:divide-white/5 pb-3">
                            {visibleItems.map((item: any, idx: number) => (
                                <div 
                                    key={idx}
                                    onClick={() => setSelectedItem(item)}
                                    className="p-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors"
                                >
                                    <div className="flex-1 min-w-0 pr-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-bold truncate text-gray-800 dark:text-gray-100">
                                                {item.name}
                                            </span>
                                            {/* Oculta check se reservado por outro, mas mostra se for concluido */}
                                            {(!isReservedByOther || isFullyCounted) && item.isCounted && <Icon name="check" size={16} className="text-green-500" />}
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-mono font-bold bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 px-1.5 py-0.5 rounded border border-gray-200 dark:border-white/10">
                                                {item.ref}
                                            </span>
                                            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight">
                                                {item.brand}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Detalhes de Estoque (OCULTAR SE RESERVADO POR OUTRO e não concluído) */}
                                    {(!isReservedByOther || isFullyCounted) && (
                                        <div className="shrink-0 text-right">
                                            {item.lastCount ? (
                                                <>
                                                    <span className="block text-sm font-black text-green-600 dark:text-green-400">{item.lastCount.qty} un</span>
                                                    <span className="block text-[9px] text-gray-400 whitespace-nowrap">
                                                        {formatFullDateTime(item.lastCount.date)}
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
                            
                            {/* BOTÃO DE BLOQUEIO ADMINISTRATIVO (Se estiver em tratamento) */}
                            {isLockedForTreatment && (
                                <div className="p-3 bg-orange-50 dark:bg-orange-900/10 border-t border-orange-100 dark:border-orange-900/30">
                                    <button 
                                        disabled
                                        className="w-full py-3 rounded-lg text-sm font-bold shadow-sm flex items-center justify-center gap-2 bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400 cursor-not-allowed border border-gray-300 dark:border-white/10"
                                    >
                                        <Icon name="lock_clock" size={18} />
                                        Bloqueio Administrativo
                                    </button>
                                </div>
                            )}

                            {/* BOTÃO DE RESERVA (Apenas se NÃO estiver em progresso por outro, NÃO concluído e NÃO bloqueado por tratamento) */}
                            {!isReservedByOther && !isFullyCounted && !isLockedForTreatment && (
                                <div className="p-3 bg-gray-50 dark:bg-white/5 border-t border-gray-100 dark:border-white/5">
                                    <button 
                                        onClick={(e) => handleReserve(block.id, e)}
                                        className="w-full py-3 rounded-lg text-sm font-bold shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-black"
                                    >
                                        <Icon name="lock" size={18} />
                                        Reservar Bloco
                                    </button>
                                </div>
                            )}
                            
                            {/* BOTÃO RECONTAR (Apenas se estiver concluído e NÃO bloqueado) */}
                            {isFullyCounted && !isLockedForTreatment && (
                                <div className="p-3 bg-gray-50 dark:bg-white/5 border-t border-gray-100 dark:border-white/5">
                                    <button 
                                        onClick={(e) => handleReserve(block.id, e)}
                                        className="w-full py-3 rounded-lg text-sm font-bold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 bg-white dark:bg-surface-dark border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
                                    >
                                        <Icon name="refresh" size={18} />
                                        Reabrir / Validar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })
        )}

        {/* Pagination Buttons */}
        {onPageChange && (page > 1 || filteredBlocks.length >= PAGE_LIMIT) && (
            <div className="flex justify-center gap-4 py-4">
                <button 
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    className="p-2 rounded-full bg-gray-200 dark:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                >
                    <Icon name="chevron_left" />
                </button>
                <span className="py-2 text-sm font-bold text-gray-500">Pág {page}</span>
                <button 
                    onClick={() => onPageChange(page + 1)}
                    disabled={filteredBlocks.length < PAGE_LIMIT}
                    className="p-2 rounded-full bg-gray-200 dark:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
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
