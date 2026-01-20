import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '../components/Icon';
import { Screen } from '../types';
import { api, ApiFinancialGroup, ApiFinancialItem, RankingItem, TopDivergenceItem, MetaStatus } from '../services/api';
import { AutoPartsLoader } from '../components/AutoPartsLoader';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

interface AnalyticsScreenProps {
  onNavigate: (screen: Screen) => void;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'ranking' | 'divergences'>('overview');
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // Data States
  const [kpis, setKpis] = useState({ totalCost: 0, totalSales: 0, totalCount: 0, inactiveCount: 0 });
  const [heatmap, setHeatmap] = useState<{ month: number, day: number, count: number }[]>([]);
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [divergences, setDivergences] = useState<TopDivergenceItem[]>([]);
  const [financialGroups, setFinancialGroups] = useState<ApiFinancialGroup[]>([]);
  
  // Financial Drilldown State
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [expandedSubgroup, setExpandedSubgroup] = useState<{ grId: number, sgId: number } | null>(null);
  const [subgroupItems, setSubgroupItems] = useState<ApiFinancialItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemSort, setItemSort] = useState<{ field: 'unit' | 'qty' | 'value', direction: 'asc' | 'desc' }>({ field: 'value', direction: 'desc' });

  // Load Years
  useEffect(() => {
     api.getAvailableYears().then(setAvailableYears);
  }, []);

  // Load Data based on Tab/Year
  useEffect(() => {
     const load = async () => {
         setLoading(true);
         try {
             if (activeTab === 'overview') {
                 const [k, h] = await Promise.all([
                     api.getAnalyticsKPIs(),
                     api.getHeatmapData(selectedYear)
                 ]);
                 setKpis(k);
                 setHeatmap(h);
             } else if (activeTab === 'financial') {
                 const groups = await api.getFinancialCategories();
                 setFinancialGroups(groups);
             } else if (activeTab === 'ranking') {
                 const r = await api.getUserRanking(selectedYear);
                 setRanking(r);
             } else if (activeTab === 'divergences') {
                 const d = await api.getTopDivergences(selectedYear);
                 setDivergences(d);
             }
         } finally {
             setLoading(false);
         }
     };
     load();
  }, [activeTab, selectedYear]);

  // Financial Handlers
  const handleToggleGroup = (grId: number) => {
      const newSet = new Set(expandedGroups);
      if (newSet.has(grId)) newSet.delete(grId);
      else newSet.add(grId);
      setExpandedGroups(newSet);
  };

  const handleToggleSubgroup = async (grId: number, sgId: number) => {
      if (expandedSubgroup?.grId === grId && expandedSubgroup?.sgId === sgId) {
          setExpandedSubgroup(null);
          setSubgroupItems([]);
          return;
      }
      setExpandedSubgroup({ grId, sgId });
      setLoadingItems(true);
      const items = await api.getFinancialItems(grId, sgId);
      setSubgroupItems(items);
      setLoadingItems(false);
  };

  const handleSortItems = (field: 'unit' | 'qty' | 'value') => {
      if (itemSort.field === field) {
          setItemSort(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }));
      } else {
          setItemSort({ field, direction: 'desc' });
      }
  };

  const sortedSubgroupItems = useMemo(() => {
      return [...subgroupItems].sort((a, b) => {
          let valA = a.value;
          let valB = b.value;
          if (itemSort.field === 'qty') { valA = a.qty; valB = b.qty; }
          if (itemSort.field === 'unit') { valA = a.unitPrice; valB = b.unitPrice; }
          
          return itemSort.direction === 'asc' ? valA - valB : valB - valA;
      });
  }, [subgroupItems, itemSort]);

  // Render Helpers
  const renderOverview = () => (
      <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-white/5">
                  <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400"><Icon name="inventory_2" /></div>
                      <span className="text-xs font-bold text-gray-500 uppercase">Valor em Estoque</span>
                  </div>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(kpis.totalCost)}</p>
                  <p className="text-xs text-gray-400 mt-1">Baseado no custo de aquisição</p>
              </div>
              <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-white/5">
                  <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400"><Icon name="point_of_sale" /></div>
                      <span className="text-xs font-bold text-gray-500 uppercase">Potencial de Venda</span>
                  </div>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(kpis.totalSales)}</p>
                  <p className="text-xs text-gray-400 mt-1">Valor de mercado estimado</p>
              </div>
              <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-white/5">
                  <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400"><Icon name="numbers" /></div>
                      <span className="text-xs font-bold text-gray-500 uppercase">SKUs Ativos</span>
                  </div>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">{kpis.totalCount.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-1">{kpis.inactiveCount.toLocaleString()} inativos</p>
              </div>
              <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-white/5">
                   {/* Heatmap summary or other KPI */}
                   <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400"><Icon name="calendar_today" /></div>
                      <span className="text-xs font-bold text-gray-500 uppercase">Atividade Anual</span>
                   </div>
                   <p className="text-2xl font-black text-gray-900 dark:text-white">{heatmap.reduce((acc, curr) => acc + curr.count, 0).toLocaleString()}</p>
                   <p className="text-xs text-gray-400 mt-1">Contagens realizadas em {selectedYear}</p>
              </div>
          </div>
          
          <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-white/5">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Icon name="calendar_view_month" />
                  Mapa de Calor de Contagens ({selectedYear})
              </h3>
              <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={heatmap}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                          <XAxis dataKey="month" tickFormatter={(val) => ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][val-1]} />
                          <YAxis />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            cursor={{ fill: 'transparent' }}
                          />
                          <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>
      </div>
  );

  const renderRanking = () => (
      <div className="space-y-4 animate-fade-in">
          {ranking.map((user, idx) => (
              <div key={user.id} className="flex items-center justify-between p-4 bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-white/5 shadow-sm">
                   <div className="flex items-center gap-4">
                       <div className={`size-12 rounded-full flex items-center justify-center font-bold text-lg border-4 ${
                           idx === 0 ? 'bg-yellow-100 text-yellow-600 border-yellow-200' :
                           idx === 1 ? 'bg-gray-100 text-gray-600 border-gray-200' :
                           idx === 2 ? 'bg-orange-100 text-orange-600 border-orange-200' :
                           'bg-white text-gray-500 border-gray-100'
                       }`}>
                           {idx + 1}º
                       </div>
                       <div>
                           <h4 className="font-bold text-gray-900 dark:text-white">{user.name}</h4>
                           <div className="flex gap-4 text-xs text-gray-500 mt-1">
                               <span><strong>{user.counts}</strong> contagens</span>
                               <span><strong>{user.accuracy}%</strong> precisão</span>
                           </div>
                       </div>
                   </div>
                   {idx < 3 && <Icon name="emoji_events" className={
                       idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-400' : 'text-orange-400'
                   } size={32} />}
              </div>
          ))}
      </div>
  );

  const renderDivergences = () => (
      <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden animate-fade-in">
          <table className="w-full text-left">
              <thead>
                  <tr className="bg-gray-50 dark:bg-white/5 text-gray-500 text-xs uppercase font-bold border-b border-gray-200 dark:border-white/5">
                      <th className="p-4">SKU / Produto</th>
                      <th className="p-4 text-center">Diferença</th>
                      <th className="p-4 text-right">Impacto Fin.</th>
                      <th className="p-4 text-right">Responsável</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {divergences.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                          <td className="p-4">
                              <div className="font-bold text-gray-900 dark:text-white line-clamp-1">{item.name}</div>
                              <div className="text-xs text-gray-500 font-mono">{item.sku}</div>
                          </td>
                          <td className="p-4 text-center">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${item.diff > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                  {item.diff > 0 ? '+' : ''}{item.diff}
                              </span>
                          </td>
                          <td className="p-4 text-right font-bold text-gray-700 dark:text-gray-300">
                              {formatCurrency(item.diffValue)}
                          </td>
                          <td className="p-4 text-right text-xs text-gray-500">
                              {item.user}
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>
  );

  const renderFinancial = () => (
      <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden animate-fade-in shadow-sm">
          <table className="w-full text-left">
              <thead>
                  <tr className="bg-gray-50 dark:bg-black/20 text-gray-500 text-xs uppercase font-bold border-b border-gray-200 dark:border-white/5">
                      <th className="py-4 px-6 w-1/2">Categoria / Grupo</th>
                      <th className="py-4 px-6 text-right w-24">Qtd. Itens</th>
                      <th className="py-4 px-6 text-right w-32">Valor Total</th>
                      <th className="py-4 px-6 w-32">% Carteira</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {financialGroups.map(group => {
                      const isExpanded = expandedGroups.has(group.id);
                      const totalValue = financialGroups.reduce((acc, g) => acc + g.value, 0);
                      const percentage = totalValue > 0 ? (group.value / totalValue) * 100 : 0;
                      
                      return (
                          <React.Fragment key={group.id}>
                              {/* GROUP ROW */}
                              <tr onClick={() => handleToggleGroup(group.id)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group select-none">
                                  <td className="py-4 px-6">
                                      <div className="flex items-center gap-3">
                                          <div className={`p-1 rounded-md transition-colors ${isExpanded ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-400 group-hover:text-primary'}`}>
                                              <Icon name={isExpanded ? "expand_more" : "chevron_right"} size={20} />
                                          </div>
                                          <div>
                                              <div className="font-bold text-sm text-gray-900 dark:text-white">{group.name}</div>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="py-4 px-6 text-right font-mono text-sm text-gray-600 dark:text-gray-400">
                                      {group.qty.toLocaleString()}
                                  </td>
                                  <td className="py-4 px-6 text-right font-bold text-sm text-gray-900 dark:text-white">
                                      {formatCurrency(group.value)}
                                  </td>
                                  <td className="py-4 px-6">
                                      <div className="flex items-center gap-2">
                                          <div className="flex-1 h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                                              <div className="h-full bg-primary rounded-full" style={{ width: `${percentage}%` }} />
                                          </div>
                                          <span className="text-[10px] font-bold text-gray-400 w-8 text-right">
                                              {percentage.toFixed(1)}%
                                          </span>
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
                                              <td className="py-3 px-6 pl-20">
                                                  <div className="flex items-center gap-2">
                                                      <Icon name={subIsExpanded ? "expand_more" : "chevron_right"} size={16} className="text-gray-400" />
                                                      <span className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">{sub.name}</span>
                                                  </div>
                                              </td>
                                              <td className="py-3 px-6 text-right font-mono text-xs text-gray-500">
                                                  {sub.qty.toLocaleString()}
                                              </td>
                                              <td className="py-3 px-6 text-right font-bold text-xs text-gray-700 dark:text-gray-300">
                                                  {formatCurrency(sub.value)}
                                              </td>
                                              <td className="py-3 px-6">
                                                  <div className="flex items-center gap-2">
                                                      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                                                          <div className="h-full bg-blue-400 rounded-full" style={{ width: `${subPercentage}%` }} />
                                                      </div>
                                                      <span className="text-[10px] text-gray-400 w-8 text-right">
                                                          {subPercentage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                                                      </span>
                                                  </div>
                                              </td>
                                          </tr>

                                          {/* ITEMS LIST (LEVEL 3) */}
                                          {subIsExpanded && (
                                              <>
                                                  {/* Item Sort Header */}
                                                  <tr className="bg-gray-100/50 dark:bg-black/30 border-b border-gray-100 dark:border-white/5 text-[10px] text-gray-400 font-bold uppercase tracking-wider select-none">
                                                      <td className="py-2 pl-28">Produto / SKU</td>
                                                      <td className="text-right py-2 px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSortItems('unit')}>
                                                          Unit. {itemSort.field === 'unit' && <Icon name={itemSort.direction === 'desc' ? "arrow_drop_down" : "arrow_drop_up"} size={12} className="inline align-middle" />}
                                                      </td>
                                                      <td className="text-right py-2 px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSortItems('qty')}>
                                                          Qtd {itemSort.field === 'qty' && <Icon name={itemSort.direction === 'desc' ? "arrow_drop_down" : "arrow_drop_up"} size={12} className="inline align-middle" />}
                                                      </td>
                                                      <td className="text-right py-2 px-6 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSortItems('value')}>
                                                          Total {itemSort.field === 'value' && <Icon name={itemSort.direction === 'desc' ? "arrow_drop_down" : "arrow_drop_up"} size={12} className="inline align-middle" />}
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
                                                          const itemPercentage = sub.value > 0 ? (item.value / sub.value) * 100 : 0;
                                                          return (
                                                              <tr key={idx} className="bg-gray-50 dark:bg-black/20 hover:bg-blue-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-white/5 last:border-0 group">
                                                                  <td className="py-2 px-6 pl-28 border-l-4 border-transparent">
                                                                      <div className="flex items-center gap-3">
                                                                          <Icon name="subdirectory_arrow_right" size={14} className="text-gray-300 group-hover:text-primary transition-colors" />
                                                                          <div className="min-w-0">
                                                                              <div className="font-bold text-xs text-gray-800 dark:text-gray-200 line-clamp-1 group-hover:text-primary transition-colors" title={item.name}>
                                                                                  {item.name}
                                                                              </div>
                                                                              <div className="flex items-center gap-2">
                                                                                  <span className="text-[10px] font-mono text-gray-400">{item.sku}</span>
                                                                                  <span className="text-[9px] text-gray-400 font-medium bg-gray-100 dark:bg-white/10 px-1 rounded">
                                                                                      Unit: {formatCurrency(item.unitPrice)}
                                                                                  </span>
                                                                              </div>
                                                                          </div>
                                                                      </div>
                                                                  </td>
                                                                  
                                                                  <td className="py-2 px-6 text-right">
                                                                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10 min-w-[24px] text-center">
                                                                          {item.qty}
                                                                      </span>
                                                                  </td>

                                                                  <td className="py-2 px-6 text-right font-bold text-xs text-gray-900 dark:text-white">
                                                                      {formatCurrency(item.value)}
                                                                  </td>

                                                                  <td className="py-2 px-6">
                                                                      <div className="flex items-center gap-2">
                                                                          <div className="flex-1 h-1 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                                                                              <div className="h-full bg-blue-300 dark:bg-blue-500 rounded-full" style={{ width: `${itemPercentage}%` }} />
                                                                          </div>
                                                                          <span className="text-[9px] text-gray-400 w-8 text-right">
                                                                              {itemPercentage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                                                                          </span>
                                                                      </div>
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
  );

  return (
    <div className="relative flex flex-col w-full min-h-screen pb-safe bg-background-light dark:bg-background-dark">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background-light dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-card-border">
         <div className="flex items-center p-4 gap-3">
             <button 
                onClick={() => onNavigate('dashboard')}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-surface-dark transition-colors"
             >
                <Icon name="arrow_back" size={24} />
             </button>
             <div className="flex-1">
                 <h2 className="text-lg font-bold leading-tight">Indicadores</h2>
                 <p className="text-xs text-gray-500">Gestão de Estoque</p>
             </div>
             
             {/* Year Selector */}
             <div className="relative">
                 <select 
                   value={selectedYear} 
                   onChange={(e) => setSelectedYear(Number(e.target.value))}
                   className="appearance-none bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm font-bold py-2 pl-3 pr-8 rounded-xl focus:ring-primary focus:border-primary"
                 >
                     {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                 </select>
                 <Icon name="expand_more" size={16} className="absolute right-2 top-3 text-gray-400 pointer-events-none" />
             </div>
         </div>

         {/* Tabs */}
         <div className="flex px-4 gap-6 overflow-x-auto no-scrollbar">
             {[
               { id: 'overview', label: 'Visão Geral' },
               { id: 'financial', label: 'Financeiro' },
               { id: 'divergences', label: 'Divergências' },
               { id: 'ranking', label: 'Ranking' }
             ].map(tab => (
                 <button 
                   key={tab.id}
                   onClick={() => setActiveTab(tab.id as any)}
                   className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
                     activeTab === tab.id 
                       ? 'text-primary border-primary' 
                       : 'text-gray-500 border-transparent hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                   }`}
                 >
                   {tab.label}
                 </button>
             ))}
         </div>
      </header>

      <main className="flex-1 p-4 pb-20">
          {loading ? (
             <AutoPartsLoader message="Carregando Indicadores..." fullScreen={false} />
          ) : (
             <>
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'financial' && renderFinancial()}
                {activeTab === 'ranking' && renderRanking()}
                {activeTab === 'divergences' && renderDivergences()}
             </>
          )}
      </main>
    </div>
  );
};
