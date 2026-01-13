
import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '../components/Icon';
import { Screen, User } from '../types';
import { api } from '../services/api';
import { HistoryFilterModal } from '../components/Modals';
import { AutoPartsLoader } from '../components/AutoPartsLoader';

interface HistoryScreenProps {
  currentUser: User | null;
  onNavigate: (screen: Screen) => void;
  onReserve: (blockId: string) => Promise<boolean>;
}

interface HistoryItem {
  id: number;
  sku: string;
  name: string;
  qty: number;
  status: string;
  location: string;
  time: string;
  divergenceReason?: string;
}

interface HistoryGroup {
  id: string; // BLOCK_REF
  date: string;
  user: string;
  items: HistoryItem[];
  status: 'completed' | 'divergence';
  location: string;
  itemCount: number;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ currentUser, onNavigate, onReserve }) => {
  const [groups, setGroups] = useState<HistoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<string[]>([]);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', users: [] as string[] });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
        const data = await api.getHistory(1, 300);
        
        // Grouping
        const groupsMap = new Map<string, HistoryGroup>();
        const userSet = new Set<string>();

        data.forEach((entry: any) => {
             const blockRef = entry.BLOCK_REF || `BATCH-${new Date(entry.DATA_HORA).getTime()}`;
             const userName = entry.USUARIO_NOME || 'Desconhecido';
             userSet.add(userName);

             if (!groupsMap.has(blockRef)) {
                 groupsMap.set(blockRef, {
                     id: blockRef,
                     date: new Date(entry.DATA_HORA).toLocaleDateString('pt-BR'),
                     user: userName,
                     items: [],
                     status: 'completed',
                     location: entry.LOCALIZACAO || 'GERAL',
                     itemCount: 0
                 });
             }
             
             const group = groupsMap.get(blockRef)!;
             
             // Determine group status (if any item has divergence, group has divergence)
             const isDivergent = entry.STATUS === 'divergence_info' || entry.STATUS === 'not_located' || entry.TRATAMENTO_STATUS === 'PENDING';
             if (isDivergent) group.status = 'divergence';

             group.items.push({
                 id: entry.ID,
                 sku: entry.SKU,
                 name: entry.NOME_PRODUTO,
                 qty: entry.QTD_CONTADA,
                 status: entry.STATUS,
                 location: entry.LOCALIZACAO,
                 time: new Date(entry.DATA_HORA).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
             });
             group.itemCount++;
        });

        setGroups(Array.from(groupsMap.values()));
        setAvailableUsers(Array.from(userSet));
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const filteredGroups = useMemo(() => {
    return groups.filter(g => {
        if (filters.users.length > 0 && !filters.users.includes(g.user)) return false;
        
        if (filters.startDate) {
             const [d, m, y] = g.date.split('/');
             const gDate = `${y}-${m}-${d}`;
             if (gDate < filters.startDate) return false;
        }
        if (filters.endDate) {
             const [d, m, y] = g.date.split('/');
             const gDate = `${y}-${m}-${d}`;
             if (gDate > filters.endDate) return false;
        }
        return true;
    });
  }, [groups, filters]);

  const toggleGroup = (id: string) => {
    const next = new Set(expandedGroups);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedGroups(next);
  };

  const handleRetake = async (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation();
    if (confirm(`Deseja retomar a contagem do bloco ${groupId}?`)) {
        const success = await onReserve(groupId);
        if (success) {
            onNavigate('reserved');
        }
    }
  };

  if (loading) return <AutoPartsLoader message="Carregando Histórico..." />;

  return (
    <div className="flex flex-col w-full min-h-screen pb-24 md:pb-0 bg-background-light dark:bg-background-dark">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-card-border p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                 <button onClick={() => onNavigate('dashboard')} className="md:hidden p-2 -ml-2 text-gray-600 dark:text-gray-300">
                     <Icon name="arrow_back" size={24} />
                 </button>
                 <div>
                     <h1 className="text-lg font-bold text-gray-900 dark:text-white">Histórico</h1>
                     <p className="text-xs text-gray-500">Últimas contagens realizadas</p>
                 </div>
            </div>
            <button onClick={() => setShowFilter(true)} className={`p-2 rounded-full transition-colors ${filters.users.length > 0 || filters.startDate ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                <Icon name="filter_list" size={24} />
            </button>
        </div>

        <main className="flex-1 p-4 space-y-4">
            {filteredGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <Icon name="history_toggle_off" size={48} className="mb-4 opacity-30" />
                    <p>Nenhum histórico encontrado.</p>
                </div>
            ) : (
                filteredGroups.map(group => (
                    <div key={group.id} className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-card-border shadow-sm overflow-hidden animate-fade-in">
                        <div 
                           onClick={() => toggleGroup(group.id)}
                           className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                        >
                            <div className={`size-10 rounded-full flex items-center justify-center text-white shadow-sm ${group.status === 'divergence' ? 'bg-orange-500' : 'bg-green-500'}`}>
                                <Icon name={group.status === 'divergence' ? "priority_high" : "check"} size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate pr-2">{group.id}</h3>
                                    <span className="text-xs text-gray-500 whitespace-nowrap">{group.date}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    <Icon name="person" size={14} />
                                    <span className="truncate">{group.user}</span>
                                    <span>•</span>
                                    <span>{group.itemCount} itens</span>
                                </div>
                            </div>
                            <Icon name={expandedGroups.has(group.id) ? "expand_less" : "expand_more"} className="text-gray-400" />
                        </div>
                        
                        {expandedGroups.has(group.id) && (
                            <div className="bg-gray-50 dark:bg-black/20 border-t border-gray-100 dark:border-white/5 p-3">
                                <div className="flex justify-end mb-3">
                                    <button 
                                        onClick={(e) => handleRetake(e, group.id)}
                                        className="text-xs font-bold text-primary flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/10 rounded-lg shadow-sm hover:bg-blue-50 dark:hover:bg-white/10 transition-colors"
                                    >
                                        <Icon name="replay" size={14} />
                                        Retomar Contagem
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {group.items.map((item, i) => (
                                        <div key={i} className="flex justify-between items-center p-2.5 rounded-lg bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/5 shadow-sm">
                                            <div className="flex flex-col min-w-0 pr-2">
                                                <span className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate">{item.name}</span>
                                                <span className="text-[10px] text-gray-500 font-mono">{item.sku}</span>
                                            </div>
                                            <div className="text-right whitespace-nowrap">
                                                <div className={`font-bold text-sm ${item.status === 'not_located' ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                                                    {item.status === 'not_located' ? 'Não Loc.' : `${item.qty} un`}
                                                </div>
                                                <div className="text-[10px] text-gray-400">{item.time}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))
            )}
        </main>

        <HistoryFilterModal 
            isOpen={showFilter} 
            onClose={() => setShowFilter(false)} 
            availableUsers={availableUsers}
            currentFilters={filters}
            onApply={setFilters}
            onClear={() => setFilters({ startDate: '', endDate: '', users: [] })}
        />
    </div>
  );
};
