
import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '../components/Icon';
import { HistoryFilterModal } from '../components/Modals';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { api } from '../services/api';
import { AutoPartsLoader } from '../components/AutoPartsLoader';
import { User, Screen } from '../types';

interface HistoryScreenProps {
    currentUser?: User | null;
    onNavigate: (screen: Screen) => void;
    onReserve: (blockId: string) => Promise<boolean>;
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

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ currentUser, onNavigate, onReserve }) => {
  const [historyBlocks, setHistoryBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch History Function
  const fetchHistory = async () => {
      setLoading(true);
      const data = await api.getHistory(1, 500);
      
      const blockGroups = new Map();

      data.forEach((entry: any) => {
          const rawRef = entry.BLOCK_REF || '';
          // Tenta extrair a referencia do pai. Se tiver || (timestamp), pega a primeira parte.
          // Se não, usa PRO_COD_SIMILAR ou SKU como fallback para agrupamento visual.
          let parentRef = rawRef.includes('||') ? rawRef.split('||')[0] : rawRef;
          if (!parentRef) parentRef = entry.PRO_COD_SIMILAR ? String(entry.PRO_COD_SIMILAR) : entry.SKU;

          // Chave única do bloco no histórico (pode ser o ID gerado na finalização)
          const uniqueBlockId = rawRef || `${parentRef}-${entry.DATA_HORA}`;

          if (!blockGroups.has(uniqueBlockId)) {
              blockGroups.set(uniqueBlockId, {
                  id: uniqueBlockId,
                  parentRef: parentRef,
                  location: entry.LOCALIZACAO || 'GERAL',
                  latestDate: entry.DATA_HORA, 
                  user: entry.USUARIO_NOME,
                  items: []
              });
          }

          const group = blockGroups.get(uniqueBlockId);
          
          group.items.push({
              id: entry.ID, // Log ID crucial para edição
              name: entry.NOME_PRODUTO,
              ref: entry.SKU,
              brand: entry.MAR_COD ? `MARCA ${entry.MAR_COD}` : 'GENÉRICO',
              qty: entry.QTD_CONTADA,
              countedBy: entry.USUARIO_NOME,
              countedAt: entry.DATA_HORA,
              location: entry.LOCALIZACAO || 'GERAL',
              status: entry.STATUS,
              isEdited: entry.STATUS === 'EDIÇÃO'
          });
      });

      const blocks = Array.from(blockGroups.values()).map((g: any) => ({
          ...g,
          timeAgo: getTimeAgo(g.latestDate)
      }));

      setHistoryBlocks(blocks);
      setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

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
        block.parentRef.toLowerCase().includes(searchLower) ||
        block.items.some((item: any) => 
          item.ref.toLowerCase().includes(searchLower) ||
          item.name.toLowerCase().includes(searchLower) ||
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

  // EDIT LOGIC
  const handleEditCount = async (e: React.MouseEvent, item: any) => {
      e.stopPropagation();
      if (!currentUser) return alert("Faça login para editar.");

      const newQtyStr = prompt(`Editar contagem para ${item.name}?\nQuantidade atual: ${item.qty}`, item.qty);
      if (newQtyStr === null) return;
      
      const newQty = parseFloat(newQtyStr);
      if (isNaN(newQty)) return alert("Valor inválido.");

      const res = await api.updateCount({
          logId: item.id,
          sku: item.ref,
          newQty: newQty,
          oldQty: item.qty,
          user_name: currentUser.name,
          user_id: currentUser.id
      });

      if (res.success) {
          alert("Contagem atualizada e registrada com sucesso!");
          fetchHistory(); // Refresh to show updated value
      } else {
          alert("Erro ao atualizar contagem.");
      }
  };

  const handleOpenDetails = (item: any) => {
      setSelectedItem(item);
      setShowDetailModal(true);
  };

  if (loading) {
      return <AutoPartsLoader message="Carregando Histórico..." />;
  }

  return (
    <div className="relative flex flex-col w-full min-h-screen pb-24 md:pb-0 bg-background-light dark:bg-background-dark md:bg-transparent">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background-light/95 dark:bg-background-dark/95 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none p-4 pb-2 border-b border-transparent">
        <div className="flex items-center justify-between">
          <button onClick={() => onNavigate('dashboard')} className="flex size-10 shrink-0 items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10 transition-colors">
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
           {filteredBlocks.length > 0 ? `${filteredBlocks.length} blocos registrados` : 'Nenhum resultado'}
         </p>
      </div>

      {/* Blocks List */}
      <div className="flex flex-col gap-6 px-4 pb-28 md:pb-0">
        {filteredBlocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 opacity-60">
             <Icon name="manage_search" size={64} className="mb-2" />
             <p className="text-sm font-medium">Nenhum histórico encontrado.</p>
          </div>
        ) : (
          filteredBlocks.map((block) => (
             <div key={block.id} className="flex flex-col animate-fade-in">
                {/* Header do Bloco (Estilo Reservados) */}
                <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-2">
                        <div className="bg-[#e11d48] text-white text-xs font-bold px-3 py-1 rounded-md uppercase tracking-wider shadow-sm">
                            REF PAI: {block.parentRef}
                        </div>
                        <span className="text-[10px] text-gray-400">{block.timeAgo}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Icon name="place" size={14} />
                        {block.location}
                    </div>
                </div>

                {/* Itens List */}
                <div className="flex flex-col gap-3">
                    {block.items.map((item: any, idx: number) => {
                        const isIssue = item.status === 'not_located' || item.status === 'divergence_info';
                        const isEdited = item.isEdited;
                        const isCounted = !isIssue;

                        return (
                        <div 
                            key={item.id}
                            onClick={() => handleOpenDetails(item)}
                            className={`relative rounded-xl p-4 border shadow-sm transition-all overflow-hidden bg-white dark:bg-[#1e293b] border-gray-200 dark:border-[#334155]`}
                        >
                            <div className="flex items-start gap-4">
                                <div className={`size-12 rounded-lg flex items-center justify-center shrink-0 border ${
                                    isIssue
                                      ? 'bg-red-100 dark:bg-red-900/40 text-red-600 border-red-200 dark:border-red-800'
                                      : 'bg-green-100 dark:bg-green-900/40 text-green-600 border-green-200 dark:border-green-800'
                                }`}>
                                    <Icon name={isIssue ? "warning" : "check"} size={24} />
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-base font-extrabold text-gray-900 dark:text-white leading-tight">
                                        {item.name}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <span className="text-xs font-mono text-gray-500 dark:text-[#94a3b8]">
                                            SKU: {item.ref}
                                        </span>
                                        <span className="size-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                                        <span className="text-xs font-bold text-gray-500 dark:text-[#94a3b8] uppercase">
                                            {item.brand}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="my-3 border-t border-dashed border-gray-200 dark:border-[#334155]" />
                            
                            <div className="flex items-center gap-2 mb-4">
                                <Icon name="history" size={16} className="text-gray-400" />
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Contado por <strong className="text-gray-700 dark:text-gray-300">{item.countedBy}</strong>
                                </p>
                            </div>

                            <div className="flex items-end justify-between gap-4">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Localização</span>
                                    <span className="text-sm font-bold text-gray-800 dark:text-white">{item.location}</span>
                                </div>

                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-bold text-green-600 uppercase mb-0.5">Qtd Contada</span>
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/40 rounded-lg border border-green-200 dark:border-green-800">
                                        <span className="font-bold text-green-800 dark:text-green-300 text-sm">
                                            {item.qty} un
                                        </span>
                                        {/* BOTÃO EDITAR INDIVIDUAL */}
                                        <button 
                                            onClick={(e) => handleEditCount(e, item)}
                                            className="size-6 rounded bg-green-200 dark:bg-green-800 flex items-center justify-center text-green-800 dark:text-green-100 hover:bg-green-300 transition-colors"
                                            title="Editar Quantidade"
                                        >
                                            <Icon name="edit" size={14} />
                                        </button>
                                    </div>
                                    {isEdited && <span className="text-[9px] text-orange-500 font-bold mt-1">Editado</span>}
                                </div>
                            </div>
                        </div>
                        );
                    })}
                </div>

                <div className="my-6 border-b border-gray-200 dark:border-white/5 w-full" />
             </div>
          ))
        )}
      </div>

      <ItemDetailModal 
        isOpen={showDetailModal} 
        onClose={() => setShowDetailModal(false)} 
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
