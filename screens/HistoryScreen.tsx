
import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '../components/Icon';
import { HistoryFilterModal } from '../components/Modals';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { api } from '../services/api';
import { AutoPartsLoader } from '../components/AutoPartsLoader';
import { User, Screen } from '../types';

interface HistoryScreenProps {
    currentUser?: User | null;
    onRefreshCount?: () => void;
    onNavigate: (screen: Screen) => void;
}

const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Agora';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}min atrás`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h atrás`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d atrás`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} meses atrás`;
    return `${Math.floor(diffInSeconds / 31536000)} ano(s) atrás`;
};

const getInitials = (name: string) => {
    return name ? name.substring(0, 2).toUpperCase() : '??';
};

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ currentUser, onRefreshCount, onNavigate }) => {
  const [historyBlocks, setHistoryBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [reservingId, setReservingId] = useState<string | null>(null);

  // Fetch History from Backend
  useEffect(() => {
    const fetchHistory = async () => {
        setLoading(true);
        // Trazemos um limite maior para garantir que pegamos os blocos únicos mais recentes
        const data = await api.getHistory(1, 500);
        
        const blockGroups = new Map();

        // LÓGICA DE DEDUPLICAÇÃO VISUAL (Manutenção Cirúrgica Preservada)
        data.forEach((entry: any) => {
            const rawRef = entry.BLOCK_REF || '';
            let logicalKey = rawRef.includes('||') ? rawRef.split('||')[0] : '';
            if (!logicalKey) {
                 logicalKey = entry.PRO_COD_SIMILAR ? String(entry.PRO_COD_SIMILAR) : entry.SKU;
            }

            if (!blockGroups.has(logicalKey)) {
                blockGroups.set(logicalKey, {
                    id: logicalKey,
                    parentRef: logicalKey,
                    currentBatchId: rawRef, 
                    name: entry.PROD_DESC_ATUAL || entry.NOME_PRODUTO, 
                    location: entry.LOCALIZACAO || 'GERAL',
                    latestDate: entry.DATA_HORA, 
                    user: entry.USUARIO_NOME,
                    status: 'concluido',
                    itemsMap: new Map()
                });
            }

            const group = blockGroups.get(logicalKey);

            if (rawRef === group.currentBatchId) {
                if (!group.itemsMap.has(entry.SKU)) {
                    const isLocked = entry.TRATAMENTO_STATUS === 'PENDING';
                    const hasDivergence = entry.STATUS === 'divergence_info' || entry.STATUS === 'not_located';
                    
                    if (hasDivergence) group.status = 'divergencia';

                    group.itemsMap.set(entry.SKU, {
                        id: entry.ID,
                        name: entry.NOME_PRODUTO,
                        ref: entry.SKU,
                        brand: entry.MAR_COD ? `MARCA ${entry.MAR_COD}` : 'GENÉRICO',
                        qty: entry.QTD_CONTADA,
                        countedBy: entry.USUARIO_NOME,
                        countedAt: entry.DATA_HORA,
                        location: entry.LOCALIZACAO || 'GERAL',
                        isLocked: isLocked,
                        status: entry.STATUS
                    });
                }
            } 
        });

        const blocks = Array.from(blockGroups.values()).map((g: any) => ({
            ...g,
            items: Array.from(g.itemsMap.values()),
            timeAgo: getTimeAgo(g.latestDate)
        }));

        setHistoryBlocks(blocks);
        setLoading(false);
    };

    fetchHistory();
  }, []);

  const [expandedBlocks, setExpandedBlocks] = useState<string[]>([]); 
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const [searchText, setSearchText] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    startDate: '',
    endDate: '',
    users: [] as string[]
  });

  const uniqueUsers = useMemo(() => {
    const users = new Set<string>();
    historyBlocks.forEach(b => {
        b.items.forEach((i: any) => users.add(i.countedBy));
    });
    return Array.from(users);
  }, [historyBlocks]);

  const filteredBlocks = useMemo(() => {
    return historyBlocks.filter(block => {
      const searchLower = searchText.toLowerCase();
      const matchesText = 
        searchText === '' ||
        block.name.toLowerCase().includes(searchLower) ||
        block.parentRef.toLowerCase().includes(searchLower) ||
        block.items.some((item: any) => 
          item.ref.toLowerCase().includes(searchLower) ||
          item.location.toLowerCase().includes(searchLower) ||
          item.countedBy.toLowerCase().includes(searchLower)
        );

      if (!matchesText) return false;

      if (activeFilters.users.length > 0) {
          const hasUser = block.items.some((i:any) => activeFilters.users.includes(i.countedBy));
          if (!hasUser) return false;
      }

      if (activeFilters.startDate && block.latestDate < activeFilters.startDate) return false;
      if (activeFilters.endDate && block.latestDate > activeFilters.endDate) return false;

      return true;
    });
  }, [historyBlocks, searchText, activeFilters]);

  const hasActiveFilters = activeFilters.startDate || activeFilters.endDate || activeFilters.users.length > 0;

  const toggleBlock = (id: string) => {
    setExpandedBlocks(prev => 
      prev.includes(id) ? prev.filter(blockId => blockId !== id) : [...prev, id]
    );
  };

  const handleReReserve = async (blockId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!currentUser) return alert("Você precisa estar logado para reservar.");
      if (reservingId) return; // Prevent double click

      if (confirm(`Deseja re-reservar o bloco ${blockId}?`)) {
          setReservingId(blockId);
          // O blockId aqui é a chave lógica (ex: SYL1402)
          const res = await api.reserveBlock(blockId, currentUser);
          
          if (res.success) {
              // Sucesso: Atualiza contadores e navega
              if(onRefreshCount) onRefreshCount();
              setTimeout(() => {
                  setReservingId(null);
                  onNavigate('reserved');
              }, 500); // Pequeno delay visual para UX
          } else {
              setReservingId(null);
              alert(res.message || "Não foi possível reservar o bloco. Verifique se há pendências.");
          }
      }
  };

  if (loading) {
      return <AutoPartsLoader message="Carregando Histórico..." />;
  }

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

      <div className="px-4 pt-2 pb-2 flex items-center justify-between">
         <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
           {filteredBlocks.length > 0 ? `${filteredBlocks.length} registros` : 'Nenhum resultado'}
         </p>
      </div>

      {/* Blocks List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 px-4 pb-28 md:pb-0">
        {filteredBlocks.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-400 opacity-60">
             <Icon name="manage_search" size={64} className="mb-2" />
             <p className="text-sm font-medium">Nenhum histórico encontrado.</p>
          </div>
        ) : (
          filteredBlocks.map((block) => {
           const isExpanded = expandedBlocks.includes(block.id);
           const visibleItems = isExpanded ? block.items : block.items.slice(0, 3);
           const hiddenCount = block.items.length - 3;
           const hasDivergence = block.status === 'divergencia';
           const formattedDate = new Date(block.latestDate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
           const isReserving = reservingId === block.id;

           return (
             <div key={block.id} className="flex flex-col shadow-lg shadow-black/20 h-full group bg-[#182335] dark:bg-surface-dark rounded-xl border border-white/5 overflow-hidden transition-all hover:border-white/10">
                {/* CARD HEADER - REESTRUTURADO CRONOLOGICAMENTE */}
                <div className="p-4 border-b border-white/5 bg-[#182335] dark:bg-surface-dark relative">
                    <div className="flex justify-between items-start">
                        {/* Esquerda: Identificação do Bloco */}
                        <div className="flex-1 pr-2">
                            <h3 className="text-xl font-black text-white leading-tight flex items-center gap-2 mb-1">
                                {block.parentRef}
                            </h3>
                            <div className="flex items-center gap-1 text-xs text-gray-400 font-medium mt-1">
                                <Icon name="place" size={14} className="text-gray-500" />
                                {block.location}
                            </div>
                            {hasDivergence && (
                                <span className="mt-2 text-[9px] font-bold text-orange-400 flex items-center gap-1 bg-orange-900/20 px-2 py-0.5 rounded border border-orange-900/30 w-fit">
                                    <Icon name="warning" size={10} />
                                    Divergência
                                </span>
                            )}
                        </div>

                        {/* Direita: Data e Ação */}
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col items-end">
                                <span className="text-sm font-bold text-white leading-none tracking-tight mb-1">
                                    {formattedDate}
                                </span>
                                <span className="text-[10px] font-medium text-gray-400">
                                    {block.timeAgo}
                                </span>
                            </div>

                            <button 
                                onClick={(e) => handleReReserve(block.id, e)}
                                disabled={isReserving}
                                className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all shadow-lg ${
                                    isReserving 
                                    ? 'bg-gray-600 cursor-not-allowed' 
                                    : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95 shadow-blue-900/20'
                                }`}
                                title="Re-reservar para contagem"
                            >
                                {isReserving ? (
                                    <Icon name="sync" size={20} className="animate-spin text-white/50" />
                                ) : (
                                    <Icon name="bookmark_add" size={20} />
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* CARD BODY - ITEMS LIST */}
                <div className="flex-col divide-y divide-gray-700 dark:divide-white/5">
                      {visibleItems.map((item: any) => {
                        const isIssue = item.status === 'not_located' || item.status === 'divergence_info';

                        return (
                        <div 
                          key={item.id} 
                          onClick={() => setSelectedItem(item)}
                          className="p-4 hover:bg-white/5 transition-colors cursor-pointer"
                        >
                            {/* Line 1: Name */}
                            <h4 className="text-sm font-bold text-white mb-3 line-clamp-1">{item.name}</h4>
                            
                            {/* Line 2: Details Row (SKU, Brand, Qty) */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-1 rounded text-[12px] font-bold bg-slate-700 text-white border border-slate-600 font-mono tracking-wide shadow-sm">
                                        {item.ref}
                                    </span>
                                    <span className="text-[10px] text-gray-400 font-bold uppercase border-l border-gray-600 pl-2">
                                        {item.brand}
                                    </span>
                                </div>
                                
                                <div className="flex flex-col items-end">
                                    <span className={`text-xl font-black ${isIssue ? 'text-orange-500' : 'text-green-500'} tracking-tight`}>
                                        {item.qty} <span className="text-xs font-normal text-gray-500">un</span>
                                    </span>
                                </div>
                            </div>

                            {/* Line 3: History Info (Avatar, Quem, Loc) */}
                            <div className="pt-3 border-t border-gray-700/50 flex justify-between items-center text-[10px]">
                                <div className="flex items-center gap-2">
                                    <div className="size-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[8px] shadow-sm ring-1 ring-white/10">
                                        {getInitials(item.countedBy)}
                                    </div>
                                    <span className="text-gray-300 font-medium">{item.countedBy.split(' ')[0]}</span>
                                </div>

                                {/* Location Tag - Dark Grey Badge */}
                                <div className="flex items-center gap-1 bg-gray-800 text-gray-300 px-2 py-1 rounded-md border border-gray-700 font-mono tracking-tighter">
                                    <Icon name="place" size={12} className="text-gray-500" />
                                    <span>{item.location}</span>
                                </div>
                            </div>
                        </div>
                        );
                      })}
                </div>

                {/* CARD FOOTER - EXPAND CONTROLS */}
                <div className="mt-auto">
                    {(!isExpanded && hiddenCount > 0) && (
                        <button 
                            onClick={() => toggleBlock(block.id)}
                            className="w-full py-3 text-xs font-bold text-blue-400 hover:text-blue-300 hover:bg-white/5 transition-colors flex items-center justify-center gap-1 bg-[#131b29]"
                        >
                            Ver mais {hiddenCount} itens
                            <Icon name="expand_more" size={16} />
                        </button>
                    )}
                    {(isExpanded && block.items.length > 3) && (
                        <button 
                            onClick={() => toggleBlock(block.id)}
                            className="w-full py-3 text-xs font-bold text-blue-400 hover:text-blue-300 hover:bg-white/5 transition-colors flex items-center justify-center gap-1 bg-[#131b29]"
                        >
                            Mostrar menos
                            <Icon name="expand_less" size={16} />
                        </button>
                    )}
                    
                    {/* Read Only Footer */}
                    <div className="p-2 bg-[#0f172a] border-t border-gray-800 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-gray-600 flex items-center gap-1.5 uppercase tracking-wider">
                            <Icon name="verified" size={12} className="text-gray-600" />
                            Registro Auditável
                        </span>
                    </div>
                </div>
             </div>
           );
        }))}
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
