
import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '../components/Icon';
import { Screen } from '../types';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { api, RankingItem, TopDivergenceItem, ApiFinancialGroup, ApiFinancialItem, Cycle, CyclePerformance } from '../services/api';
import { GROUP_ICONS } from '../data/categories';
import { ReportGeneratorModal } from '../components/ReportGeneratorModal';

interface AnalyticsScreenProps {
  onNavigate: (screen: Screen) => void;
}

// --- REUSABLE ANIMATED NUMBER COMPONENT ---
const AnimatedNumber = ({ value, duration = 2000, prefix = '', suffix = '', decimals = 0 }: { value: number, duration?: number, prefix?: string, suffix?: string, decimals?: number }) => {
    const [display, setDisplay] = useState(0);

    useEffect(() => {
        if (value > 0) {
            let start = 0;
            if (display > 0 && Math.abs(display - value) < value) start = display;
            
            const end = value;
            const range = end - start;
            const startTime = Date.now();
            
            const timer = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const ease = 1 - Math.pow(1 - progress, 3);
                
                const current = start + (range * ease);
                setDisplay(current);

                if (progress === 1) clearInterval(timer);
            }, 16); 

            return () => clearInterval(timer);
        } else {
            setDisplay(0);
        }
    }, [value]);

    return (
        <span>
            {prefix}
            {display.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
            {suffix}
        </span>
    );
};

// --- HEATMAP COMPONENT ---
const YearlyHeatmap = ({ data, year }: { data: { month: number, day: number, count: number }[], year: number }) => {
    const countMap = useMemo(() => {
        const map = new Map();
        data.forEach(d => map.set(`${d.month}-${d.day}`, d.count));
        return map;
    }, [data]);

    const weeks = useMemo(() => {
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31);
        const today = new Date();
        
        const weeksArray = [];
        let currentWeek: any[] = [];
        
        for(let i=0; i<startOfYear.getDay(); i++) currentWeek.push(null);

        for (let d = new Date(startOfYear); d <= endOfYear; d.setDate(d.getDate() + 1)) {
            const currentDate = new Date(d);
            currentWeek.push({
                date: currentDate,
                key: `${currentDate.getMonth() + 1}-${currentDate.getDate()}`,
                isFuture: currentDate > today
            });

            if (currentWeek.length === 7) {
                weeksArray.push(currentWeek);
                currentWeek = [];
            }
        }
        if (currentWeek.length > 0) {
            while(currentWeek.length < 7) currentWeek.push(null);
            weeksArray.push(currentWeek);
        }
        return weeksArray;
    }, [year]);

    return (
        <div className="overflow-x-auto pb-4 no-scrollbar">
            <div className="flex gap-1.5 min-w-max">
                {weeks.map((week, wIdx) => (
                    <div key={wIdx} className="flex flex-col gap-1.5">
                        {week.map((item, dIdx) => {
                            if (!item) return <div key={dIdx} className="size-3 md:size-4" />;
                            
                            const count = countMap.get(item.key) || 0;
                            let bgColor = 'bg-gray-100 dark:bg-white/5';
                            
                            if (!item.isFuture) {
                                if (count > 50) bgColor = 'bg-green-600 dark:bg-green-500';
                                else if (count > 20) bgColor = 'bg-green-400 dark:bg-green-600';
                                else if (count > 0) bgColor = 'bg-green-200 dark:bg-green-900/40';
                            } else {
                                bgColor = 'bg-transparent border border-gray-100 dark:border-white/5'; 
                            }

                            return (
                                <div 
                                    key={dIdx} 
                                    className={`size-3 md:size-4 rounded-[2px] md:rounded-[3px] ${bgColor} transition-all hover:scale-125 relative group`}
                                    title={`${item.date.toLocaleDateString()}: ${count} itens`}
                                >
                                    {count > 0 && (
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-black text-white text-[10px] p-2 rounded whitespace-nowrap z-50 font-bold shadow-xl">
                                            {item.date.toLocaleDateString()}<br/>
                                            {count} itens contados
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};

export const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ onNavigate }) => {
  const [selectedDivergence, setSelectedDivergence] = useState<any | null>(null);
  
  // Data States
  const [globalKPIs, setGlobalKPIs] = useState({ totalCost: 0, totalSales: 0, totalCount: 0, inactiveCount: 0 });
  const [heatmapData, setHeatmapData] = useState<{ month: number, day: number, count: number }[]>([]);
  const [financialGroups, setFinancialGroups] = useState<ApiFinancialGroup[]>([]);
  const [rankingData, setRankingData] = useState<RankingItem[]>([]);
  const [topDivergences, setTopDivergences] = useState<TopDivergenceItem[]>([]);
  
  // Cycle Analysis
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<number | string>('all');
  const [cyclePerf, setCyclePerf] = useState<CyclePerformance | null>(null);

  const [showReportModal, setShowReportModal] = useState(false);
  const [divergenceSearch, setDivergenceSearch] = useState('');
  
  // Hierarchy Table
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const [expandedSubgroup, setExpandedSubgroup] = useState<{ grId: number, sgId: number } | null>(null);
  const [subgroupItems, setSubgroupItems] = useState<ApiFinancialItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemSort, setItemSort] = useState<{ field: 'value' | 'qty' | 'unit', direction: 'desc' | 'asc' }>({ field: 'value', direction: 'desc' });

  // 1. Initial Load
  useEffect(() => {
      // Carrega ciclos
      api.getCycles().then(c => {
          setCycles(c);
          const active = c.find(cy => cy.active);
          if(active) setSelectedCycleId(active.id);
          else if(c.length > 0) setSelectedCycleId(c[0].id);
      });

      // Carrega KPIs GLOBAIS (Estoque Físico Total - O que o usuário gosta)
      api.getAnalyticsKPIs('all').then(setGlobalKPIs);
  }, []);

  // 2. Fetch Cycle Specific Data
  useEffect(() => {
      const fetchData = async () => {
          const currentYear = new Date().getFullYear();
          
          api.getCyclePerformance(selectedCycleId).then(setCyclePerf);
          api.getHeatmapData(currentYear, selectedCycleId).then(setHeatmapData);
          api.getFinancialCategories(selectedCycleId).then(setFinancialGroups);
          api.getUserRanking(currentYear, selectedCycleId).then(setRankingData);
          api.getTopDivergences(currentYear, selectedCycleId).then(setTopDivergences);
      };

      fetchData();
  }, [selectedCycleId]);

  const totalCategoryValue = financialGroups.reduce((acc, curr) => acc + curr.value, 0);

  const filteredDivergences = useMemo(() => {
      return topDivergences.filter(item => {
          const searchLower = divergenceSearch.toLowerCase();
          if (searchLower && !item.name.toLowerCase().includes(searchLower) && !item.sku.toLowerCase().includes(searchLower)) return false;
          return true;
      });
  }, [topDivergences, divergenceSearch]);

  const handleOpenDetails = (item: any) => {
      setSelectedDivergence({
          ...item,
          ref: item.sku, 
          costPrice: item.costPrice,
          salesPrice: item.salesPrice,
          loc: item.location
      });
  };

  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'US';

  // --- HIERARCHICAL TABLE LOGIC ---
  const handleToggleGroup = (grId: number) => {
      if (expandedGroup === grId) {
          setExpandedGroup(null);
          setExpandedSubgroup(null);
      } else {
          setExpandedGroup(grId);
      }
  };

  const handleToggleSubgroup = async (grId: number, sgId: number) => {
      const isSame = expandedSubgroup?.grId === grId && expandedSubgroup?.sgId === sgId;
      if (isSame) {
          setExpandedSubgroup(null);
          setSubgroupItems([]);
      } else {
          setExpandedSubgroup({ grId, sgId });
          setLoadingItems(true);
          try {
              const items = await api.getFinancialItems(grId, sgId, selectedCycleId);
              setSubgroupItems(items);
          } catch(e) { console.error(e); }
          setLoadingItems(false);
      }
  };

  const handleSortItems = (field: 'value' | 'qty' | 'unit') => {
      if (itemSort.field === field) {
          setItemSort(prev => ({ ...prev, direction: prev.direction === 'desc' ? 'asc' : 'desc' }));
      } else {
          setItemSort({ field, direction: 'desc' });
      }
  };

  const sortedSubgroupItems = useMemo(() => {
      return [...subgroupItems].sort((a, b) => {
          let valA = 0;
          let valB = 0;
          
          if (itemSort.field === 'value') { valA = a.value; valB = b.value; }
          else if (itemSort.field === 'qty') { valA = a.qty; valB = b.qty; }
          else if (itemSort.field === 'unit') { valA = a.unitPrice; valB = b.unitPrice; }

          return itemSort.direction === 'asc' ? valA - valB : valB - valA;
      });
  }, [subgroupItems, itemSort]);

  const currentCycleName = useMemo(() => {
      if (selectedCycleId === 'all') return 'Todo o Histórico';
      return cycles.find(c => c.id == selectedCycleId)?.name || 'Ciclo Selecionado';
  }, [selectedCycleId, cycles]);

  return (
    <div className="flex flex-col w-full min-h-screen bg-background-light dark:bg-background-dark pb-20 md:pb-6">
      
      {/* HEADER */}
      <header className="sticky top-0 z-20 bg-white/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-card-border p-4 md:px-8">
         <div className="max-w-7xl mx-auto w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Icon name="insights" className="text-primary" />
                        Dashboard de Resultados
                    </h1>
                </div>
                
                <div className="flex items-center gap-3">
                   {/* SELETOR DE CICLO */}
                   <div className="flex items-center bg-gray-100 dark:bg-white/5 rounded-xl px-3 py-2 border border-gray-200 dark:border-white/10">
                        <Icon name="history" className="text-gray-500 mr-2" size={20} />
                        <select 
                            value={selectedCycleId} 
                            onChange={(e) => setSelectedCycleId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                            className="bg-transparent border-none text-sm font-bold text-gray-800 dark:text-white focus:ring-0 cursor-pointer min-w-[180px]"
                        >
                            <option value="all">Todo o Histórico</option>
                            {cycles.map(c => (
                                <option key={c.id} value={c.id}>{c.name} {c.active ? '(Ativo)' : ''}</option>
                            ))}
                        </select>
                   </div>

                   <button 
                     onClick={() => setShowReportModal(true)}
                     className="flex items-center justify-center p-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all active:scale-95"
                     title="Gerar Relatório"
                   >
                        <Icon name="assignment" size={20} />
                    </button>
                </div>
            </div>
         </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-8">
        
        {/* === SEÇÃO 1: RESULTADO FINANCEIRO (GLOBAL FIXO) === */}
        <div className="animate-slide-up">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* BIG CARD: FINANCEIRO TOTAL */}
                <div className="md:col-span-2 bg-gradient-to-br from-gray-900 to-gray-800 dark:from-surface-dark dark:to-black p-6 rounded-2xl shadow-xl border border-gray-700 relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-700">
                        <Icon name="payments" size={140} className="text-white" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <Icon name="account_balance" className="text-green-400" />
                            <p className="text-sm text-gray-300 font-bold uppercase tracking-wider">Valor Total em Estoque (Global)</p>
                        </div>
                        <h3 className="text-4xl md:text-5xl font-black text-white mt-2 tracking-tight">
                            <AnimatedNumber value={globalKPIs.totalCost} prefix="R$ " decimals={2} />
                        </h3>
                        
                        <div className="mt-6 flex gap-8 border-t border-white/10 pt-4">
                            <div>
                                <p className="text-xs text-gray-400 uppercase font-bold mb-1">Preço de Venda Total</p>
                                <p className="text-xl font-bold text-green-400"><AnimatedNumber value={globalKPIs.totalSales} prefix="R$ " decimals={2} /></p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 uppercase font-bold mb-1">Itens Cadastrados</p>
                                <p className="text-xl font-bold text-white"><AnimatedNumber value={globalKPIs.totalCount} /></p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SMALL CARD: PERFORMANCE DO CICLO */}
                <div className="md:col-span-1 bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-200 dark:border-white/10 p-6 flex flex-col justify-center">
                    <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
                        <Icon name="timeline" />
                        Performance ({currentCycleName})
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600 dark:text-gray-300">Contagens Totais</span>
                                <span className="font-bold text-gray-900 dark:text-white">{cyclePerf?.totalCount || 0} bips</span>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-white/5 h-2 rounded-full overflow-hidden">
                                <div className="bg-primary h-full rounded-full" style={{ width: '100%' }}></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600 dark:text-gray-300">Acuracidade Média</span>
                                <span className="font-bold text-green-600">{cyclePerf ? cyclePerf.accuracy.toFixed(1) : 0}%</span>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-white/5 h-2 rounded-full overflow-hidden">
                                <div className="bg-green-500 h-full rounded-full" style={{ width: `${cyclePerf?.accuracy || 0}%` }}></div>
                            </div>
                        </div>

                        <div className="pt-2 flex items-center gap-2 text-xs text-red-500 font-bold bg-red-50 dark:bg-red-900/10 p-2 rounded-lg justify-center border border-red-100 dark:border-red-900/30">
                            <Icon name="warning" size={16} />
                            {cyclePerf?.divergenceCount || 0} Divergências Registradas
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* === SEÇÃO 2: CALENDÁRIO DE ATIVIDADE (HEATMAP) === */}
        <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-200 dark:border-white/10 p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Icon name="calendar_month" className="text-primary" />
                    Fluxo de Trabalho (Dias Contados)
                </h3>
                
                <div className="flex items-center gap-2 text-[10px] text-gray-500 font-medium bg-gray-50 dark:bg-white/5 px-3 py-1.5 rounded-lg">
                    <span>Menos</span>
                    <div className="flex gap-1 mx-1">
                        <div className="size-3 rounded-sm bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                        <div className="size-3 rounded-sm bg-green-200 dark:bg-green-900/40" />
                        <div className="size-3 rounded-sm bg-green-400 dark:bg-green-600" />
                        <div className="size-3 rounded-sm bg-green-600 dark:bg-green-500" />
                    </div>
                    <span>Mais</span>
                </div>
            </div>
            
            <YearlyHeatmap data={heatmapData} year={new Date().getFullYear()} />
        </div>

        {/* === SEÇÃO 3: DETALHAMENTO FINANCEIRO HIERÁRQUICO (RESTAURADA) === */}
        <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-200 dark:border-card-border flex flex-col overflow-hidden min-h-[500px] animate-slide-up" style={{ animationDelay: '0.15s' }}>
            <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg text-primary">
                        <Icon name="category" size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Detalhamento por Categoria</h2>
                        <span className="text-xs text-gray-500">
                            Analise o "peso" do estoque financeiramente. {selectedCycleId === 'all' ? '(Estoque Total)' : '(Neste Ciclo)'}
                        </span>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold uppercase text-gray-400">Valor Total Listado</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white">
                        {totalCategoryValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto overflow-x-auto no-scrollbar relative max-h-[600px]">
                <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead className="bg-gray-50 dark:bg-surface-dark sticky top-0 z-10">
                        <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold shadow-sm">
                            <th className="py-4 px-6 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-surface-dark w-1/3">Categoria</th>
                            <th className="py-4 px-6 border-b border-gray-100 dark:border-white/5 text-right bg-gray-50 dark:bg-surface-dark">Qtd Contada</th>
                            <th className="py-4 px-6 border-b border-gray-100 dark:border-white/5 text-right bg-gray-50 dark:bg-surface-dark">Valor Auditado</th>
                            <th className="py-4 px-6 border-b border-gray-100 dark:border-white/5 w-1/4 bg-gray-50 dark:bg-surface-dark">% Share</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                        {financialGroups.length === 0 ? (
                            <tr><td colSpan={4} className="p-8 text-center text-gray-400">Nenhum dado encontrado para este período.</td></tr>
                        ) : (
                            financialGroups.map((group) => {
                                const percentage = totalCategoryValue > 0 ? (group.value / totalCategoryValue) * 100 : 0;
                                const isExpanded = expandedGroup === group.id;
                                const icon = GROUP_ICONS[group.id] || 'inventory_2';

                                return (
                                    <React.Fragment key={group.id}>
                                        {/* GROUP ROW */}
                                        <tr onClick={() => handleToggleGroup(group.id)} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer group select-none">
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-1 text-gray-400 group-hover:text-primary transition-colors ${isExpanded ? 'rotate-90' : ''}`}>
                                                        <Icon name="chevron_right" size={20} />
                                                    </div>
                                                    <div className="size-8 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:text-primary transition-colors">
                                                        <Icon name={icon} size={18} />
                                                    </div>
                                                    <span className="font-bold text-sm text-gray-700 dark:text-gray-200">{group.name}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-right font-mono text-sm text-gray-600 dark:text-gray-300 font-medium">
                                                {group.qty.toLocaleString()}
                                            </td>
                                            <td className="py-4 px-6 text-right font-bold text-sm text-gray-900 dark:text-white">
                                                R$ {group.value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                                                        <div className="h-full bg-primary rounded-full" style={{ width: `${percentage}%` }} />
                                                    </div>
                                                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300 w-10 text-right">{percentage.toFixed(1)}%</span>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* SUBGROUPS */}
                                        {isExpanded && group.subgroups.map(sub => {
                                            const subIsExpanded = expandedSubgroup?.grId === group.id && expandedSubgroup?.sgId === sub.id;
                                            const subPercentage = group.value > 0 ? (sub.value / group.value) * 100 : 0;

                                            return (
                                                <React.Fragment key={`${group.id}-${sub.id}`}>
                                                    <tr onClick={() => handleToggleSubgroup(group.id, sub.id)} className="bg-gray-50/50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer select-none">
                                                        <td className="py-3 px-6 pl-20 border-l-4 border-transparent hover:border-primary">
                                                            <div className="flex items-center gap-2">
                                                                <Icon name={subIsExpanded ? "expand_more" : "chevron_right"} size={16} className="text-gray-400" />
                                                                <span className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">{sub.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-6 text-right font-mono text-xs text-gray-500">
                                                            {sub.qty.toLocaleString()}
                                                        </td>
                                                        <td className="py-3 px-6 text-right font-bold text-xs text-gray-700 dark:text-gray-300">
                                                            R$ {sub.value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                        </td>
                                                        <td className="py-3 px-6">
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex-1 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${subPercentage}%` }} />
                                                                </div>
                                                                <span className="text-[10px] text-gray-400">{subPercentage.toFixed(0)}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {/* ITEMS LIST (LEVEL 3) */}
                                                    {subIsExpanded && (
                                                        <>
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
                                                                                    <div>
                                                                                        <div className="font-bold text-xs text-gray-800 dark:text-gray-200 line-clamp-1 group-hover:text-primary transition-colors">
                                                                                            {item.name}
                                                                                        </div>
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className="text-[10px] font-mono text-gray-400">{item.sku}</span>
                                                                                            <span className="text-[9px] text-gray-400 font-medium bg-gray-100 dark:bg-white/10 px-1 rounded">
                                                                                                Unit: {item.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                                                                                {item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                            </td>

                                                                            <td className="py-2 px-6">
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className="flex-1 h-1 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                                                                                        <div className="h-full bg-blue-300 dark:bg-blue-500 rounded-full" style={{ width: `${itemPercentage}%` }} />
                                                                                    </div>
                                                                                    <span className="text-[9px] text-gray-400 w-6 text-right">{itemPercentage < 1 && itemPercentage > 0 ? '<1' : Math.round(itemPercentage)}%</span>
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
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* === SEÇÃO 4: RANKING & OPERACIONAL (DIVERGÊNCIAS) === */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>

                {/* RANKING */}
                <div className="lg:col-span-1 bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-200 dark:border-card-border p-6 flex flex-col h-[600px]">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Icon name="leaderboard" className="text-yellow-500" />
                        Ranking de Produtividade
                    </h2>
                    <div className="space-y-5 flex-1 overflow-y-auto no-scrollbar pr-2">
                        {rankingData.length === 0 ? (
                            <div className="text-center text-gray-400 py-10">Nenhum dado neste período.</div>
                        ) : (
                            rankingData.map((user, idx) => (
                                <div key={idx} className="flex items-center gap-3 group">
                                    <div className={`font-bold w-4 text-center ${idx === 0 ? 'text-yellow-500 text-lg' : 'text-gray-400'}`}>{idx + 1}</div>
                                    <div className="size-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-600 shrink-0">
                                        {getInitials(user.name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between mb-1">
                                            <span className="font-bold text-sm text-gray-900 dark:text-white truncate">{user.name}</span>
                                            <div className="flex gap-2">
                                                <span className="text-xs font-bold text-primary">{user.counts}</span>
                                                <span className={`text-[10px] px-1 rounded ${user.accuracy > 98 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                    {user.accuracy.toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex-1 h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-primary rounded-full transition-all duration-1000" 
                                                style={{ width: `${(user.counts / (rankingData[0]?.counts || 1)) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* TABELA DE DIVERGÊNCIAS (RESTAURADA) */}
                <div className="lg:col-span-2 bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-200 dark:border-card-border flex flex-col h-[600px]">
                    <div className="p-6 border-b border-gray-100 dark:border-white/5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Icon name="warning" className="text-red-500" />
                                    Divergências ({currentCycleName})
                                </h2>
                                <p className="text-xs text-gray-500">Maiores impactos financeiros registrados.</p>
                            </div>
                            <div className="flex w-full md:w-auto items-center rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-3 py-1.5">
                                <Icon name="search" className="text-gray-400" size={18} />
                                <input 
                                    className="bg-transparent border-none text-xs w-full focus:ring-0" 
                                    placeholder="Filtrar SKU..." 
                                    value={divergenceSearch}
                                    onChange={(e) => setDivergenceSearch(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto no-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[700px]">
                            <thead className="bg-white dark:bg-surface-dark sticky top-0 z-10 shadow-sm">
                                <tr className="text-xs text-gray-400 uppercase border-b border-gray-100 dark:border-white/5">
                                    <th className="py-3 px-6 font-medium">SKU / Produto</th>
                                    <th className="py-3 px-4 font-medium text-center">Local</th>
                                    <th className="py-3 px-4 font-medium text-left">Responsável</th>
                                    <th className="py-3 px-4 font-medium text-center">Contagem</th>
                                    <th className="py-3 px-4 font-medium text-center">Diff</th>
                                    <th className="py-3 px-6 font-medium text-right">Impacto (R$)</th>
                                    <th className="py-3 px-4"></th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {filteredDivergences.map((item) => (
                                    <tr key={item.id} onClick={() => handleOpenDetails(item)} className="border-b border-gray-50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer group">
                                        <td className="py-3 px-6">
                                            <div className="font-bold text-gray-900 dark:text-white">{item.sku}</div>
                                            <div className="text-xs text-gray-500 line-clamp-1 max-w-[200px]">{item.name}</div>
                                        </td>
                                        <td className="py-3 px-4 text-center text-xs text-gray-400">{item.location || 'Geral'}</td>
                                        <td className="py-3 px-4"><span className="text-xs font-medium text-gray-700 dark:text-gray-300">{item.user?.split(' ')[0]}</span></td>
                                        <td className="py-3 px-4 text-center text-xs text-gray-500">{item.counted} / {item.expected}</td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`inline-block w-10 py-0.5 rounded text-xs font-bold ${item.diff < 0 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{item.diff > 0 ? '+' : ''}{item.diff}</span>
                                        </td>
                                        <td className={`py-3 px-6 text-right font-bold ${item.diffValue < 0 ? 'text-red-500' : 'text-blue-500'}`}>R$ {Math.abs(item.diffValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                        <td className="py-3 px-4 text-right"><Icon name="chevron_right" size={18} className="text-gray-300 group-hover:text-primary" /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredDivergences.length === 0 && (
                            <div className="p-10 text-center text-gray-400 text-sm">
                                Nenhuma divergência encontrada com os filtros atuais.
                            </div>
                        )}
                    </div>
                </div>
            </div>

      </main>

      {/* MODALS */}
      <ItemDetailModal isOpen={!!selectedDivergence} onClose={() => setSelectedDivergence(null)} item={selectedDivergence} />
      <ReportGeneratorModal isOpen={showReportModal} onClose={() => setShowReportModal(false)} />

    </div>
  );
};
