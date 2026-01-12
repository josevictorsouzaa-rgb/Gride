
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
        // Increase limit to get a better snapshot of "latest" items
        const data = await api.getHistory(1, 200);
        
        // --- LOGIC: Group by Block (PRO_COD_SIMILAR) & Keep Latest Entry per Item (SKU) ---
        const blockGroups = new Map();

        // Data is ordered by DATE DESC from backend
        data.forEach((entry: any) => {
            // Usa o código similar como chave do bloco, se não tiver usa o SKU (bloco de 1 item)
            const blockId = entry.PRO_COD_SIMILAR ? String(entry.PRO_COD_SIMILAR) : entry.SKU;
            const itemKey = entry.SKU; // Unique key per item in the block

            if (!blockGroups.has(blockId)) {
                blockGroups.set(blockId, {
                    id: blockId,
                    parentRef: entry.PRO_COD_SIMILAR ? `BLOCO ${entry.PRO_COD_SIMILAR}` : entry.SKU,
                    name: entry.PROD_DESC_ATUAL || entry.NOME_PRODUTO, // Nome do produto principal (do bloco)
                    latestDate: entry.DATA_HORA, // First entry is the latest due to sort
                    status: 'concluido', // Default
                    itemsMap: new Map() // Map to ensure unique items (latest state)
                });
            }

            const group = blockGroups.get(blockId);
            
            // Check if item already exists in this block group (if so, we skip, as we want the latest state)
            if (!group.itemsMap.has(itemKey)) {
                const isLocked = entry.TRATAMENTO_STATUS === 'PENDING';
                const hasDivergence = entry.STATUS === 'divergence_info' || entry.STATUS === 'not_located';
                
                if (hasDivergence) group.status = 'divergencia';

                group.itemsMap.set(itemKey, {
                    id: entry.ID,
                    name: entry.NOME_PRODUTO,
                    ref: entry.SKU,
                    brand: entry.MAR_COD ? `MARCA ${entry.MAR_COD}` : '---',
                    qty: entry.QTD_CONTADA,
                    countedBy: entry.USUARIO_NOME,
                    countedAt: entry.DATA_HORA,
                    location: entry.LOCALIZACAO || 'GERAL',
                    isLocked: isLocked,
                    status: entry.STATUS
                });
            }
        });

        // Convert Maps to Arrays for rendering
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
    // Collect all users from all items in all blocks
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

      // Filter by Item User
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

  const getStatusConfig = (status: string) => {
    switch(status) {
      case 'divergencia':
        return { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-200 dark:border-orange-800', icon: 'warning', label: 'Com Divergência' };
      default:
        return { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-200 dark:border-green-800', icon: 'check_circle', label: 'Concluído' };
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
           const status = getStatusConfig(block.status);
           const isExpanded = expandedBlocks.includes(block.id);
           const visibleItems = isExpanded ? block.items : block.items.slice(0, 3);
           const hiddenCount = block.items.length - 3;

           return (
             <div key={block.id} className="flex flex-col shadow-sm animate-fade-in h-full group bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-card-border overflow-hidden">
                {/* CARD HEADER - BLOCK INFO */}
                <div className="p-3 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
                    <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold bg-gray-200 dark:bg-white/10 px-1.5 py-0.5 rounded uppercase tracking-wider text-gray-600 dark:text-gray-300">
                                    {block.parentRef}
                                </span>
                                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${status.color} ${status.border} bg-transparent`}>
                                    <Icon name={status.icon} size={10} />
                                    {status.label}
                                </div>
                            </div>
                            <h3 className="font-bold text-sm leading-tight text-gray-900 dark:text-white line-clamp-1">
                                {block.name}
                            </h3>
                        </div>
                        <div className="text-[10px] text-gray-400 flex items-center gap-1 pt-1">
                            <Icon name="update" size={12} />
                            {block.timeAgo}
                        </div>
                    </div>
                </div>

                {/* CARD BODY - ITEMS LIST */}
                <div className="flex-col divide-y divide-gray-100 dark:divide-white/5">
                      {visibleItems.map((item: any, index: number) => {
                        const itemStatusColor = item.status === 'divergence_info' || item.status === 'not_located' 
                            ? 'text-orange-600 dark:text-orange-400' 
                            : 'text-green-600 dark:text-green-400';
                        
                        return (
                        <div 
                          key={item.id} 
                          onClick={() => setSelectedItem(item)}
                          className="group/item p-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
                        >
                            {/* Line 1: Name and Quantity */}
                            <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {item.isLocked && <Icon name="lock" size={14} className="text-orange-500 shrink-0" />}
                                    <span className={`text-xs font-bold text-gray-800 dark:text-gray-200 truncate ${item.isLocked ? 'line-through opacity-70' : ''}`}>
                                        {item.name}
                                    </span>
                                </div>
                                <div className="pl-2">
                                    <span className={`text-xs font-bold ${itemStatusColor} bg-opacity-10 px-2 py-0.5 rounded-full border border-current`}>
                                        {item.qty} un
                                    </span>
                                </div>
                            </div>

                            {/* Line 2: Details Grid */}
                            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-[10px] text-gray-500 dark:text-gray-400 items-center">
                                {/* SKU */}
                                <div className="flex items-center gap-1 font-mono text-gray-400 dark:text-gray-500 truncate">
                                    <Icon name="barcode" size={12} />
                                    {item.ref}
                                </div>
                                
                                {/* Location */}
                                <div className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
                                    <Icon name="place" size={12} className="text-primary opacity-70" />
                                    {item.location}
                                </div>

                                {/* User & Time */}
                                <div className="flex items-center gap-1.5 justify-end">
                                    <span className="flex items-center gap-1 text-gray-600 dark:text-gray-300 font-medium bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">
                                        <Icon name="person" size={10} />
                                        {item.countedBy.split(' ')[0]}
                                    </span>
                                    <span>{getTimeAgo(item.countedAt)}</span>
                                </div>
                            </div>
                        </div>
                        );
                      })}
                </div>

                {/* CARD FOOTER - EXPAND CONTROLS */}
                {(!isExpanded && hiddenCount > 0) && (
                      <div 
                        onClick={() => toggleBlock(block.id)}
                        className="flex items-center justify-center py-2 bg-gray-50 dark:bg-black/20 border-t border-gray-100 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-xs font-bold text-gray-500 gap-1"
                      >
                        Ver mais {hiddenCount} itens
                        <Icon name="expand_more" size={16} />
                      </div>
                )}
                {(isExpanded && block.items.length > 3) && (
                      <div 
                        onClick={() => toggleBlock(block.id)}
                        className="flex items-center justify-center py-2 bg-gray-50 dark:bg-black/20 border-t border-gray-100 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-xs font-bold text-gray-500 gap-1"
                      >
                        Mostrar menos
                        <Icon name="expand_less" size={16} />
                      </div>
                )}
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
