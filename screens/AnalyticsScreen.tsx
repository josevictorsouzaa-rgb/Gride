import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '../components/Icon';
import { Screen } from '../types';
import { api, ApiFinancialGroup, ApiFinancialItem, RankingItem, TopDivergenceItem } from '../services/api';
import { AutoPartsLoader } from '../components/AutoPartsLoader';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';

interface AnalyticsScreenProps {
  onNavigate: (screen: Screen) => void;
}

export const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'divergences'>('overview');
  const [loading, setLoading] = useState(true);
  
  // Overview Data
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [kpis, setKpis] = useState<any>(null);
  const [heatmap, setHeatmap] = useState<any[]>([]);
  const [ranking, setRanking] = useState<RankingItem[]>([]);

  // Financial Data
  const [financialGroups, setFinancialGroups] = useState<ApiFinancialGroup[]>([]);
  const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null);
  const [expandedSubgroup, setExpandedSubgroup] = useState<{ grId: number, sgId: number } | null>(null);
  const [subgroupItems, setSubgroupItems] = useState<ApiFinancialItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemSort, setItemSort] = useState<{ field: 'qty' | 'unit' | 'value', direction: 'asc' | 'desc' }>({ field: 'value', direction: 'desc' });

  // Divergences Data
  const [divergences, setDivergences] = useState<TopDivergenceItem[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') loadYearData();
    if (activeTab === 'divergences') loadDivergences();
  }, [selectedYear, activeTab]);

  const loadInitialData = async () => {
    setLoading(true);
    const [yrs, kpiData, finData] = await Promise.all([
        api.getAvailableYears(),
        api.getAnalyticsKPIs(),
        api.getFinancialCategories()
    ]);
    setYears(yrs);
    setKpis(kpiData);
    setFinancialGroups(finData);
    setLoading(false);
  };

  const loadYearData = async () => {
     const [hm, rnk] = await Promise.all([
         api.getHeatmapData(selectedYear),
         api.getUserRanking(selectedYear)
     ]);
     setHeatmap(hm);
     setRanking(rnk);
  };

  const loadDivergences = async () => {
      const data = await api.getTopDivergences(selectedYear);
      setDivergences(data);
  };

  const handleToggleGroup = (grId: number) => {
      setExpandedGroupId(prev => prev === grId ? null : grId);
      setExpandedSubgroup(null);
      setSubgroupItems([]);
  };

  const handleToggleSubgroup = async (grId: number, sgId: number) => {
      const isSame = expandedSubgroup?.grId === grId && expandedSubgroup?.sgId === sgId;
      if (isSame) {
          setExpandedSubgroup(null);
          setSubgroupItems([]);
      } else {
          setExpandedSubgroup({ grId, sgId });
          setLoadingItems(true);
          const items = await api.getFinancialItems(grId, sgId);
          setSubgroupItems(items);
          setLoadingItems(false);
      }
  };

  const handleSortItems = (field: 'qty' | 'unit' | 'value') => {
      setItemSort(prev => ({
          field,
          direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc'
      }));
  };

  const sortedSubgroupItems = useMemo(() => {
      return [...subgroupItems].sort((a, b) => {
          let valA: number, valB: number;
          if (itemSort.field === 'qty') { valA = a.qty; valB = b.qty; }
          else if (itemSort.field === 'unit') { valA = a.unitPrice; valB = b.unitPrice; }
          else { valA = a.value; valB = b.value; }
          
          return itemSort.direction === 'asc' ? valA - valB : valB - valA;
      });
  }, [subgroupItems, itemSort]);

  const renderHeatmap = () => {
      // Activity chart using counts per month
      const monthlyData = Array.from({ length: 12 }, (_, i) => ({ name: new Date(0, i).toLocaleString('default', { month: 'short' }), count: 0 }));
      heatmap.forEach(h => {
          if(h.month >= 1 && h.month <= 12) monthlyData[h.month - 1].count += h.count;
      });

      return (
         <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData}>
                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                    cursor={{ fill: 'transparent' }}
                />
                <Bar dataKey="count" fill="#137fec" radius={[4, 4, 0, 0]} />
            </BarChart>
         </ResponsiveContainer>
      );
  };

  if (loading) return <AutoPartsLoader message="Carregando Indicadores..." />;

  return (
    <div className="flex flex-col w-full min-h-screen bg-background-light dark:bg-background-dark pb-24 md:pb-0">
        <header className="sticky top-0 z-20 bg-white/95 dark:bg-surface-dark/95 backdrop-blur-sm border-b border-gray-200 dark:border-white/5 px-4 py-3 flex items-center gap-3">
            <button onClick={() => onNavigate('dashboard')} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                <Icon name="arrow_back" />
            </button>
            <div className="flex-1">
                <h2 className="text-lg font-bold">Analytics</h2>
                <p className="text-xs text-gray-500">Indicadores de Performance</p>
            </div>
            <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-lg">
                <button onClick={() => setActiveTab('overview')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'overview' ? 'bg-white dark:bg-white/10 shadow text-primary' : 'text-gray-500'}`}>Geral</button>
                <button onClick={() => setActiveTab('financial')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'financial' ? 'bg-white dark:bg-white/10 shadow text-primary' : 'text-gray-500'}`}>Financeiro</button>
                <button onClick={() => setActiveTab('divergences')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'divergences' ? 'bg-white dark:bg-white/10 shadow text-primary' : 'text-gray-500'}`}>Diverg.</button>
            </div>
        </header>

        <main className="p-4 md:p-8 space-y-6">
            
            {activeTab === 'overview' && (
                <div className="space-y-6 animate-fade-in">
                    {/* KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white dark:bg-surface-dark p-4 rounded-xl shadow-sm border border-gray-200 dark:border-white/5">
                            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Custo Total Estoque</p>
                            <p className="text-lg font-black text-gray-900 dark:text-white">
                                {kpis?.totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                            </p>
                        </div>
                        <div className="bg-white dark:bg-surface-dark p-4 rounded-xl shadow-sm border border-gray-200 dark:border-white/5">
                            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Venda Total Estoque</p>
                            <p className="text-lg font-black text-green-600 dark:text-green-400">
                                {kpis?.totalSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                            </p>
                        </div>
                        <div className="bg-white dark:bg-surface-dark p-4 rounded-xl shadow-sm border border-gray-200 dark:border-white/5">
                            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Itens Ativos</p>
                            <p className="text-lg font-black text-blue-600 dark:text-blue-400">
                                {kpis?.totalCount.toLocaleString()}
                            </p>
                        </div>
                         <div className="bg-white dark:bg-surface-dark p-4 rounded-xl shadow-sm border border-gray-200 dark:border-white/5">
                            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Itens Inativos</p>
                            <p className="text-lg font-black text-gray-500">
                                {kpis?.inactiveCount.toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* Heatmap / Activity */}
                    <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-white/5">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                <Icon name="bar_chart" /> Atividade de Contagem
                            </h3>
                            <select 
                                value={selectedYear} 
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                className="bg-gray-100 dark:bg-white/5 border-none rounded-lg text-xs font-bold py-1 px-3"
                            >
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div className="h-52">
                            {renderHeatmap()}
                        </div>
                    </div>

                    {/* Ranking */}
                    <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-white/5">
                        <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
                            <Icon name="emoji_events" className="text-yellow-500" /> Ranking de Usuários ({selectedYear})
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 dark:border-white/5 text-xs text-gray-400 uppercase">
                                        <th className="pb-2 font-bold pl-2">Pos</th>
                                        <th className="pb-2 font-bold">Usuário</th>
                                        <th className="pb-2 font-bold text-right">Contagens</th>
                                        <th className="pb-2 font-bold text-right">Acuracidade</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ranking.map((r, idx) => (
                                        <tr key={idx} className="border-b border-gray-50 dark:border-white/5 last:border-0 hover:bg-gray-50 dark:hover:bg-white/5">
                                            <td className="py-3 pl-2 font-bold text-gray-500">#{idx + 1}</td>
                                            <td className="py-3 font-bold text-gray-800 dark:text-white">{r.name}</td>
                                            <td className="py-3 text-right font-mono text-gray-600 dark:text-gray-300">{r.counts.toLocaleString()}</td>
                                            <td className="py-3 text-right font-bold">
                                                <span className={`px-2 py-0.5 rounded ${r.accuracy >= 98 ? 'bg-green-100 text-green-700' : (r.accuracy >= 95 ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700')}`}>
                                                    {r.accuracy}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {ranking.length === 0 && (
                                        <tr><td colSpan={4} className="py-4 text-center text-gray-400">Sem dados para este período.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'financial' && (
                <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-200 dark:border-white/5 overflow-hidden animate-fade-in">
                    <div className="p-4 bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/5">
                        <h3 className="font-bold text-gray-800 dark:text-white">Detalhamento Financeiro</h3>
                        <p className="text-xs text-gray-500">Valores baseados no custo de compra</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-100 dark:bg-black/20 text-xs uppercase text-gray-500 font-bold">
                                <tr>
                                    <th className="py-3 px-6">Grupo / Subgrupo</th>
                                    <th className="py-3 px-6 text-right">Qtd Física</th>
                                    <th className="py-3 px-6 text-right">Valor Total (Custo)</th>
                                    <th className="py-3 px-6 w-32">% Repr.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                {financialGroups.map(group => {
                                    const isExpanded = expandedGroupId === group.id;
                                    const totalValue = kpis?.totalCost || 1;
                                    const percentage = (group.value / totalValue) * 100;

                                    return (
                                        <React.Fragment key={group.id}>
                                            <tr onClick={() => handleToggleGroup(group.id)} className="hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors">
                                                <td className="py-3 px-6 font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                                    <Icon name={isExpanded ? "expand_more" : "chevron_right"} size={18} className="text-gray-400" />
                                                    {group.name}
                                                </td>
                                                <td className="py-3 px-6 text-right font-mono text-sm text-gray-600 dark:text-gray-300">
                                                    {group.qty.toLocaleString()}
                                                </td>
                                                <td className="py-3 px-6 text-right font-bold text-sm text-gray-900 dark:text-white">
                                                    {group.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                                                </td>
                                                <td className="py-3 px-6">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                                                            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(percentage, 100)}%` }} />
                                                        </div>
                                                        <span className="text-[10px] text-gray-400 w-8 text-right">{percentage.toFixed(1)}%</span>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* SUBGROUPS */}
                                            {isExpanded && group.subgroups.map(sub => {
                                                    const subIsExpanded = expandedSubgroup?.grId === group.id && expandedSubgroup?.sgId === sub.id;
                                                    const subPercentage = group.value > 0 ? (sub.value / group.value) * 100 : 0;

                                                    return (
                                                        <React.Fragment key={`${group.id}-${sub.id}`}>
                                                            <tr onClick={() => handleToggleSubgroup(group.id, sub.id)} className="bg-gray-50/50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer select-none border-l-4 border-transparent hover:border-l-primary">
                                                                <td className="py-3 px-6 pl-12">
                                                                    <div className="flex items-center gap-2">
                                                                        <Icon name={subIsExpanded ? "expand_more" : "chevron_right"} size={16} className="text-gray-400" />
                                                                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">{sub.name}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="py-3 px-6 text-right font-mono text-xs text-gray-500">
                                                                    {sub.qty.toLocaleString()}
                                                                </td>
                                                                <td className="py-3 px-6 text-right font-bold text-xs text-gray-700 dark:text-gray-300">
                                                                    {sub.value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                                </td>
                                                                <td className="py-3 px-6">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                                                                            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${subPercentage}%` }} />
                                                                        </div>
                                                                        <span className="text-[10px] text-gray-400 w-10 text-right">
                                                                            {subPercentage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                            </tr>

                                                            {/* ITEMS LIST (LEVEL 3) */}
                                                            {subIsExpanded && (
                                                                <>
                                                                    <tr className="bg-gray-100/50 dark:bg-black/30 border-b border-gray-100 dark:border-white/5 text-[10px] text-gray-400 font-bold uppercase tracking-wider select-none">
                                                                        <td className="py-2 pl-20">Produto / SKU</td>
                                                                        <td className="text-right py-2 px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSortItems('qty')}>
                                                                            Qtd {itemSort.field === 'qty' && <Icon name={itemSort.direction === 'desc' ? "arrow_drop_down" : "arrow_drop_up"} size={12} className="inline align-middle" />}
                                                                        </td>
                                                                        <td className="text-right py-2 px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSortItems('unit')}>
                                                                            Valor Unit. {itemSort.field === 'unit' && <Icon name={itemSort.direction === 'desc' ? "arrow_drop_down" : "arrow_drop_up"} size={12} className="inline align-middle" />}
                                                                        </td>
                                                                        <td className="text-right py-2 px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSortItems('value')}>
                                                                            Valor Total {itemSort.field === 'value' && <Icon name={itemSort.direction === 'desc' ? "arrow_drop_down" : "arrow_drop_up"} size={12} className="inline align-middle" />}
                                                                        </td>
                                                                    </tr>

                                                                    {loadingItems ? (
                                                                        <tr>
                                                                            <td colSpan={4} className="py-8 text-center text-gray-400">
                                                                                <Icon name="sync" className="animate-spin mb-1 mx-auto" size={20} />
                                                                                <span className="text-xs">Carregando itens...</span>
                                                                            </td>
                                                                        </tr>
                                                                    ) : (
                                                                        sortedSubgroupItems.map((item, idx) => {
                                                                            return (
                                                                                <tr key={idx} className="bg-gray-50 dark:bg-black/20 hover:bg-blue-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-white/5 last:border-0 group">
                                                                                    <td className="py-2 px-6 pl-20 border-l-4 border-transparent">
                                                                                        <div className="flex items-center gap-3">
                                                                                            <Icon name="subdirectory_arrow_right" size={14} className="text-gray-300 group-hover:text-primary transition-colors" />
                                                                                            <div className="min-w-0">
                                                                                                <div className="font-bold text-xs text-gray-800 dark:text-gray-200 line-clamp-1 group-hover:text-primary transition-colors" title={item.name}>
                                                                                                    {item.name}
                                                                                                </div>
                                                                                                <div className="text-[10px] font-mono text-gray-400">
                                                                                                    {item.sku}
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="py-2 px-6 text-right">
                                                                                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 min-w-[32px] text-center">
                                                                                            {item.qty}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="py-2 px-6 text-right text-xs text-gray-500 dark:text-gray-400 font-medium">
                                                                                        {item.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                                    </td>
                                                                                    <td className="py-2 px-6 text-right font-bold text-xs text-gray-900 dark:text-white">
                                                                                        {item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })
                                                                    )}
                                                                </>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'divergences' && (
                <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-white/5 animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                             <Icon name="warning" className="text-red-500" /> Top Divergências Financeiras
                        </h3>
                         <select 
                                value={selectedYear} 
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                className="bg-gray-100 dark:bg-white/5 border-none rounded-lg text-xs font-bold py-1 px-3"
                            >
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-100 dark:bg-black/20 text-xs uppercase text-gray-500 font-bold">
                                <tr>
                                    <th className="py-3 px-4">Item</th>
                                    <th className="py-3 px-4 text-center">Local</th>
                                    <th className="py-3 px-4 text-center">Usuário</th>
                                    <th className="py-3 px-4 text-right">Diferença</th>
                                    <th className="py-3 px-4 text-right">Impacto ($)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                {divergences.map((div, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="py-3 px-4">
                                            <div className="font-bold text-xs text-gray-800 dark:text-white line-clamp-1">{div.name}</div>
                                            <div className="text-[10px] text-gray-400">{div.sku}</div>
                                        </td>
                                        <td className="py-3 px-4 text-center text-xs font-mono text-gray-600 dark:text-gray-300">
                                            {div.location || '-'}
                                        </td>
                                        <td className="py-3 px-4 text-center text-xs text-gray-600 dark:text-gray-300">
                                            {div.user.split(' ')[0]}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${div.diff > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                                {div.diff > 0 ? '+' : ''}{div.diff}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right font-bold text-xs text-gray-800 dark:text-white">
                                            {div.diffValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                    </tr>
                                ))}
                                {divergences.length === 0 && (
                                     <tr><td colSpan={5} className="py-8 text-center text-gray-400">Nenhuma divergência relevante encontrada.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </main>
    </div>
  );
};