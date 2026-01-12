
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
            // Backend retorna PRO_COD_SIMILAR (number or string)
            const blockId = entry.PRO_COD_SIMILAR ? String(entry.PRO_COD_SIMILAR) : entry.SKU;
            const itemKey = entry.SKU; // Unique key per item in the block

            if (!blockGroups.has(blockId)) {
                blockGroups.set(blockId, {
                    id: blockId,
                    parentRef: entry.PRO_COD_SIMILAR ? `BLOCO ${entry.PRO_COD_SIMILAR}` : entry.SKU,
                    name: entry.PROD_DESC_ATUAL || entry.NOME_PRODUTO, // Nome do produto principal (do bloco)
                    latestDate: entry.DATA_HORA, // First entry is the latest due to sort
                    user: entry.USUARIO_NOME, // Last user to count an item in this block
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
                    location: entry.LOCALIZACAO || 'GERAL', // Location is now an attribute of the item count
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
        users.add(b.user);
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
          item.location.toLowerCase().includes(searchLower)
        );

      if (!matchesText) return false;

      // Filter by Block User (Last one) OR Item User? Let's check Block user first
      if (activeFilters.users.length > 0) {
          const hasUser = activeFilters.users.includes(block.user) || block.items.some((i:any) => activeFilters.users.includes(i.countedBy));
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
           const visibleItems = isExpanded ? block.items : block.items.slice(0, 2);
           const hiddenCount = block.items.length - 2;

           return (
             <div key={block.id} className="flex flex-col shadow-sm animate-fade-in h-full group">
                <div className="bg-[#1e293b] text-white p-3 rounded-t-xl flex justify-between items-start shadow-md z-10 border border-[#334155]">
                    <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold bg-white/10 px-1.5 py-0.5 rounded uppercase tracking-wider text-gray-300">
                                {block.parentRef}
                            </span>
                            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border bg-[#0f172a] border-[#334155] ${status.color}`}>
                                <Icon name={status.icon} size={10} />
                                {status.label}
                            </div>
                        </div>
                        <h3 className="font-bold text-sm leading-tight text-white line-clamp-2">
                            {block.name}
                        </h3>
                    </div>
                </div>

                <div className="flex-1 relative flex flex-col bg-white dark:bg-surface-dark rounded-b-xl border border-gray-200 dark:border-card-border border-t-0 overflow-hidden">
                  
                  <div className="flex justify-between items-center px-4 py-2 bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5 text-xs text-gray-500">
                      <span className="flex items-center gap-1 font-medium">
                          <Icon name="history" size={14} />
                          {block.timeAgo}
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                          <Icon name="person" size={14} />
                          {block.user.split(' ')[0]}
                      </span>
                  </div>

                  <div className="flex flex-col flex-1">
                      {visibleItems.map((item: any, index: number) => (
                        <div 
                          key={item.id} 
                          onClick={() => setSelectedItem(item)}
                          className={`group/item p-3 flex flex-col gap-1 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-white/5 ${
                            index !== visibleItems.length - 1 ? 'border-b border-gray-100 dark:border-card-border/50' : ''
                          }`}
                        >
                            <div className="flex justify-between items-start">
                              <div className="flex flex-col">
                                  <span className={`text-[11px] font-bold uppercase ${item.isLocked ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'}`}>
                                    {item.ref}
                                  </span>
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                                     <Icon name="place" size={12} />
                                     {item.location}
                                  </span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                  {item.isLocked && <Icon name="lock" size={14} className="text-orange-500" />}
                                  <span className="text-[11px] font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded border border-green-100 dark:border-green-900/30">
                                    {item.qty} un
                                  </span>
                              </div>
                            </div>
                        </div>
                      ))}
                  </div>

                  {!isExpanded && hiddenCount > 0 && (
                      <div 
                        onClick={() => toggleBlock(block.id)}
                        className="flex items-center justify-center py-3 bg-gray-50 dark:bg-black/20 border-t border-gray-100 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-xs font-bold text-gray-500 gap-1"
                      >
                        Ver mais {hiddenCount} itens
                        <Icon name="expand_more" size={16} />
                      </div>
                  )}
                  {isExpanded && block.items.length > 2 && (
                      <div 
                        onClick={() => toggleBlock(block.id)}
                        className="flex items-center justify-center py-3 bg-gray-50 dark:bg-black/20 border-t border-gray-100 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-xs font-bold text-gray-500 gap-1"
                      >
                        Mostrar menos
                        <Icon name="expand_less" size={16} />
                      </div>
                  )}
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
