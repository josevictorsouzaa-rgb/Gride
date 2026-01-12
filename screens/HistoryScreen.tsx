
import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '../components/Icon';
import { HistoryFilterModal } from '../components/Modals';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { api } from '../services/api';
import { AutoPartsLoader } from '../components/AutoPartsLoader';

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

export const HistoryScreen: React.FC = () => {
  const [historyBlocks, setHistoryBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch History from Backend
  useEffect(() => {
    const fetchHistory = async () => {
        setLoading(true);
        // Increase limit to capture full block contexts
        const data = await api.getHistory(1, 300);
        
        const blockGroups = new Map();

        // Agrupamento mais inteligente:
        // Usa BLOCK_REF se disponível, senão tenta fallback com o Similar.
        // O BLOCK_REF é gravado na finalização e garante que os itens fiquem juntos.
        
        data.forEach((entry: any) => {
            const dateKey = new Date(entry.DATA_HORA).toISOString().split('T')[0]; // Dia
            const hourKey = new Date(entry.DATA_HORA).getHours(); // Hora (agrupamento horario)
            
            // PRIORIDADE: BLOCK_REF vindo do banco.
            const blockRef = entry.BLOCK_REF || (entry.PRO_COD_SIMILAR ? String(entry.PRO_COD_SIMILAR) : entry.SKU);
            
            // Chave única para o "Evento de Contagem do Bloco"
            const blockKey = `${blockRef}_${entry.USUARIO_ID}_${dateKey}_${hourKey}`;

            if (!blockGroups.has(blockKey)) {
                // Nome do bloco: Se tiver BLOCK_REF e não for número puro (ID), usa ele.
                // Caso contrário, tenta montar algo legível.
                let displayName = entry.BLOCK_REF;
                if (!displayName || /^\d+$/.test(displayName)) {
                     displayName = entry.PRO_COD_SIMILAR ? `BLOCO ${entry.PRO_COD_SIMILAR}` : entry.SKU;
                }

                blockGroups.set(blockKey, {
                    id: blockKey,
                    parentRef: displayName,
                    name: entry.PROD_DESC_ATUAL || entry.NOME_PRODUTO, 
                    location: entry.LOCALIZACAO || 'GERAL',
                    latestDate: entry.DATA_HORA, 
                    user: entry.USUARIO_NOME,
                    status: 'concluido',
                    itemsMap: new Map() // Garante unicidade do SKU DENTRO deste evento
                });
            }

            const group = blockGroups.get(blockKey);
            
            // Adiciona item ao grupo
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

      {/* Blocks List - VISUAL IDENTICO AO RESERVAR */}
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

           return (
             <div key={block.id} className="flex flex-col shadow-md h-full group bg-[#182335] dark:bg-surface-dark rounded-xl border border-gray-700 dark:border-card-border overflow-hidden">
                {/* CARD HEADER - Dark Style similar to screenshot */}
                <div className="p-4 border-b border-gray-700 dark:border-white/5 flex justify-between items-start">
                    <div>
                        <h3 className="text-lg font-black text-white leading-tight">
                            {block.parentRef}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                            <Icon name="place" size={14} />
                            {block.location}
                        </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-900/50 rounded border border-blue-800">
                            <Icon name="calendar_today" size={12} className="text-blue-400" />
                            <span className="text-[10px] font-bold text-blue-100 uppercase">
                                {new Date(block.latestDate).toLocaleDateString('pt-BR')}
                            </span>
                        </div>
                        {hasDivergence && (
                            <span className="text-[9px] font-bold text-orange-400 flex items-center gap-1">
                                <Icon name="warning" size={10} />
                                Divergência
                            </span>
                        )}
                    </div>
                </div>

                {/* CARD BODY - ITEMS LIST */}
                <div className="flex-col divide-y divide-gray-700 dark:divide-white/5">
                      {visibleItems.map((item: any) => (
                        <div 
                          key={item.id} 
                          onClick={() => setSelectedItem(item)}
                          className="p-4 hover:bg-white/5 transition-colors cursor-pointer"
                        >
                            {/* Line 1: Name */}
                            <h4 className="text-sm font-bold text-white mb-2 line-clamp-1">{item.name}</h4>
                            
                            {/* Line 2: Details Row */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#2d3748] text-gray-300 border border-gray-600">
                                        {item.ref}
                                    </span>
                                    <span className="text-[10px] text-gray-400 font-bold uppercase border-l border-gray-600 pl-2">
                                        {item.brand}
                                    </span>
                                </div>
                                
                                <div className="flex flex-col items-end">
                                    <span className={`text-sm font-bold ${item.status === 'not_located' || item.status === 'divergence_info' ? 'text-orange-400' : 'text-blue-400'}`}>
                                        {item.qty} un
                                    </span>
                                </div>
                            </div>

                            {/* Line 3: History Info (Quem/Quando/Onde) */}
                            <div className="mt-2 pt-2 border-t border-gray-700/50 flex justify-between items-center text-[10px] text-gray-500">
                                <div className="flex items-center gap-1">
                                    <Icon name="person" size={12} />
                                    <span>{item.countedBy.split(' ')[0]}</span>
                                    <span className="mx-1">•</span>
                                    <span>{getTimeAgo(item.countedAt)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Icon name="place" size={12} />
                                    <span>{item.location}</span>
                                    <Icon name="info" size={14} className="ml-1 text-gray-600" />
                                </div>
                            </div>
                        </div>
                      ))}
                </div>

                {/* CARD FOOTER - EXPAND CONTROLS */}
                <div className="mt-auto">
                    {(!isExpanded && hiddenCount > 0) && (
                        <button 
                            onClick={() => toggleBlock(block.id)}
                            className="w-full py-3 text-xs font-bold text-blue-400 hover:text-blue-300 hover:bg-white/5 transition-colors flex items-center justify-center gap-1"
                        >
                            Ver mais {hiddenCount} itens
                            <Icon name="expand_more" size={16} />
                        </button>
                    )}
                    {(isExpanded && block.items.length > 3) && (
                        <button 
                            onClick={() => toggleBlock(block.id)}
                            className="w-full py-3 text-xs font-bold text-blue-400 hover:text-blue-300 hover:bg-white/5 transition-colors flex items-center justify-center gap-1"
                        >
                            Mostrar menos
                            <Icon name="expand_less" size={16} />
                        </button>
                    )}
                    
                    {/* Read Only Footer */}
                    <div className="p-3 bg-[#0f172a] border-t border-gray-700 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-gray-500 flex items-center gap-2">
                            <Icon name="lock" size={12} />
                            REGISTRO DE HISTÓRICO
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
