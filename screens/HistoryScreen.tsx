
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

const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'US';

// Helper para data completa
const formatFullDateTime = (dateStr: string) => {
    if (!dateStr) return '--/--/---- --:--';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Agora';
    if (diffInSeconds < 3600) return `Há ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `Há ${Math.floor(diffInSeconds / 3600)} h`;
    if (diffInSeconds < 2592000) return `Há ${Math.floor(diffInSeconds / 86400)} d`;
    return 'Há +1 mês';
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
          // FILTRO RIGOROSO: Apenas itens concluídos/contados/divergentes/editados.
          // Ignora logs de processo como 'RESERVADO', 'DEVOLVIDO' ou 'Pendente'.
          if (['RESERVADO', 'DEVOLVIDO', 'pending'].includes(entry.STATUS)) return;

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
                  // CORREÇÃO: Remove fallback 'GERAL'
                  location: entry.LOCALIZACAO || '',
                  latestDate: entry.DATA_HORA, 
                  user: entry.USUARIO_NOME,
                  items: []
              });
          }

          const group = blockGroups.get(uniqueBlockId);
          
          group.items.push({
              id: entry.ID, // Log ID crucial para edição
              name: entry.NOME_PRODUTO,
              ref: entry.PRO_NRFABRICANTE || 'S/N', // Usa Nr Fabricante
              brand: entry.MAR_DESCRI || '', // Usa Marca (agora trazida pelo JOIN)
              qty: entry.QTD_CONTADA,
              countedBy: entry.USUARIO_NOME,
              countedAt: entry.DATA_HORA,
              // CORREÇÃO: Remove fallback 'GERAL'
              location: entry.LOCALIZACAO || '',
              status: entry.STATUS,
              treatmentStatus: entry.TREATMENT_STATUS, // Novo campo do JOIN
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
           {filteredBlocks.length > 0 ? `${filteredBlocks.length} blocos concluídos` : 'Nenhum resultado'}
         </p>
      </div>

      {/* Blocks List */}
      <div className="flex flex-col gap-3 px-4 pb-28 md:pb-0">
        {filteredBlocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 opacity-60">
             <Icon name="manage_search" size={64} className="mb-2" />
             <p className="text-sm font-medium">Nenhum histórico de conclusão encontrado.</p>
          </div>
        ) : (
          filteredBlocks.map((block) => {
             // CONFIGURAÇÃO VISUAL PADRÃO (CONCLUÍDO - VERDE)
             let headerClass = "bg-green-600 dark:bg-green-700 border-green-600";
             let containerClass = "border-green-500/50 shadow-green-500/10";
             let headerTextMain = "text-white";
             let headerTextSub = "text-green-100";
             let labelColor = "text-green-200";
             let actionLabel = "Concluído por";
             
             // Extrair iniciais do usuário
             const userInitials = getInitials(block.user);
             const firstName = block.user ? block.user.split(' ')[0] : 'Sistema';

             // LIMPEZA DO NOME DO BLOCO
             const cleanParentRef = block.parentRef.replace(/REF PAI:?/gi, '').trim();

             return (
             <div 
                key={block.id} 
                className={`relative rounded-xl shadow-sm bg-white dark:bg-[#1e2329] overflow-hidden transition-all border ${containerClass} animate-fade-in`}
             >
                {/* Header Dinâmico */}
                <div className={`p-3 border-b ${headerClass}`}>
                    <div className="flex justify-between items-start">
                        <div className="flex-1 pr-2">
                            <span className={`text-[10px] md:text-xs font-bold uppercase tracking-wider ${labelColor}`}>
                                Ref. Pai
                            </span>
                            <h3 className={`text-sm md:text-lg font-bold leading-tight line-clamp-2 mt-0.5 ${headerTextMain}`}>
                                {cleanParentRef}
                            </h3>
                            
                            <div className={`flex items-center gap-1 mt-1 text-xs md:text-sm ${headerTextSub}`}>
                                <Icon name="place" size={14} /> 
                                <span className="font-medium">{block.location || 'Sem Local'}</span>
                            </div>
                        </div>

                        {/* Lado Direito: Avatar + Tempo + Ação */}
                        <div className="flex flex-col items-end shrink-0 pl-2">
                            <div className="flex items-center">
                                <div className="flex flex-col items-end mr-2 text-right">
                                    <span className={`block text-[9px] md:text-xs font-bold uppercase ${labelColor} mb-0.5`}>
                                        {actionLabel}
                                    </span>
                                    <span className={`block text-xs md:text-sm font-bold ${headerTextMain} max-w-[80px] md:max-w-[120px] truncate leading-none`}>
                                        {firstName}
                                    </span>
                                    
                                    <span className={`block text-[9px] md:text-xs font-medium opacity-80 ${headerTextMain} mt-1`}>
                                        {block.timeAgo}
                                    </span>
                                </div>
                                
                                <div className="size-9 md:size-11 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white font-bold text-xs md:text-sm shadow-sm">
                                    {userInitials}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Itens List */}
                <div className="divide-y divide-gray-100 dark:divide-white/5">
                    {block.items.map((item: any, idx: number) => {
                        const isEdited = item.isEdited;
                        const isIssue = item.status === 'not_located' || item.status === 'divergence_info' || item.status === 'Divergência' || item.status === 'Não Localizado';
                        const isResolved = item.treatmentStatus === 'RESOLVED';

                        return (
                        <div 
                            key={item.id}
                            onClick={() => handleOpenDetails(item)}
                            className="p-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors"
                        >
                            <div className="flex-1 min-w-0 pr-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm md:text-base font-bold truncate text-gray-800 dark:text-gray-100">
                                        {item.name}
                                    </span>
                                    {/* ÍCONES DE STATUS */}
                                    {isIssue ? (
                                        isResolved ? (
                                            <Icon name="task_alt" size={18} className="text-blue-500" />
                                        ) : (
                                            <Icon name="warning" size={18} className="text-red-500" />
                                        )
                                    ) : (
                                        <Icon name="check" size={18} className="text-green-500" />
                                    )}
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] md:text-xs font-mono font-bold bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 px-1.5 py-0.5 rounded border border-gray-200 dark:border-white/10">
                                        {item.ref}
                                    </span>
                                    <span className="text-[10px] md:text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight">
                                        {item.brand}
                                    </span>
                                </div>
                            </div>

                            <div className="shrink-0 text-right flex flex-col items-end">
                                {/* EXIBIÇÃO DE QUANTIDADE OU STATUS DE TRATAMENTO */}
                                {isIssue ? (
                                    isResolved ? (
                                        <span className="text-[10px] md:text-xs font-bold text-white bg-blue-600 px-2 py-1 rounded shadow-sm">
                                            Solucionado
                                        </span>
                                    ) : (
                                        <span className="text-[10px] md:text-xs font-bold text-white bg-red-600 px-2 py-1 rounded shadow-sm">
                                            Aguardando Tratamento
                                        </span>
                                    )
                                ) : (
                                    <span className="block text-sm md:text-base font-black text-green-600 dark:text-green-400">
                                        {item.qty} un
                                    </span>
                                )}

                                <span className="block text-[9px] md:text-xs text-gray-400 whitespace-nowrap mt-1">
                                    {formatFullDateTime(item.countedAt)}
                                </span>
                                {isEdited && <span className="text-[9px] text-orange-500 font-bold">Editado</span>}
                                
                                {!isIssue && (
                                    <button 
                                        onClick={(e) => handleEditCount(e, item)}
                                        className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 border border-green-200 dark:border-green-900/30 transition-all"
                                    >
                                        <Icon name="edit" size={14} />
                                        Editar
                                    </button>
                                )}
                            </div>
                        </div>
                        );
                    })}
                </div>
             </div>
             );
          })
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
