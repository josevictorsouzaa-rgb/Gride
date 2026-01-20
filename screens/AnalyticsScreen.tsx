
import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '../components/Icon';
import { Screen } from '../types';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { api, RankingItem, TopDivergenceItem } from '../services/api';

interface AnalyticsScreenProps {
  onNavigate: (screen: Screen) => void;
}

// --- REUSABLE ANIMATED NUMBER COMPONENT ---
const AnimatedNumber = ({ value, duration = 2000, prefix = '', suffix = '', decimals = 0 }: { value: number, duration?: number, prefix?: string, suffix?: string, decimals?: number }) => {
    const [display, setDisplay] = useState(0);

    useEffect(() => {
        if (value > 0) {
            let start = 0;
            // Se já tiver um valor exibido (atualização), começa dele
            if (display > 0 && Math.abs(display - value) < value) start = display;
            
            const end = value;
            const range = end - start;
            const startTime = Date.now();
            
            const timer = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                // Ease out function
                const ease = 1 - Math.pow(1 - progress, 3);
                
                const current = start + (range * ease);
                setDisplay(current);

                if (progress === 1) clearInterval(timer);
            }, 16); // ~60fps

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

// --- HEATMAP COMPONENT (YEARLY - REAL DATA) ---
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
        
        // Pad first week
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
                            if (!item) return <div key={dIdx} className="size-4" />;
                            
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
                                    className={`size-4 rounded-[3px] ${bgColor} transition-all hover:scale-125 relative group`}
                                    title={`${item.date.toLocaleDateString()}: ${count} itens`}
                                >
                                    {/* Tooltip */}
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
  
  // Real Data States
  const [realKPIs, setRealKPIs] = useState({ totalCost: 0, totalSales: 0, totalCount: 0, inactiveCount: 0 });
  const [heatmapData, setHeatmapData] = useState<{ month: number, day: number, count: number }[]>([]);
  const [categoriesData, setCategoriesData] = useState<{ name: string, qty: number, value: number, icon: string }[]>([]);
  
  // Volatile Data States (Historical)
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [rankingData, setRankingData] = useState<RankingItem[]>([]);
  const [topDivergences, setTopDivergences] = useState<TopDivergenceItem[]>([]);

  // Filtros de Divergência
  const [divergenceSearch, setDivergenceSearch] = useState('');
  const [diffMin, setDiffMin] = useState('');
  const [diffMax, setDiffMax] = useState('');
  const [impactMin, setImpactMin] = useState('');
  const [impactMax, setImpactMax] = useState('');
  const [divergenceType, setDivergenceType] = useState<'all' | 'loss' | 'surplus'>('all');

  useEffect(() => {
      // 1. Fetch Static KPIs (Snapshot)
      api.getAnalyticsKPIs().then(setRealKPIs);
      
      // 2. Fetch Categories Financials (Snapshot)
      api.getFinancialCategories().then(data => {
          const mapped = data.map(cat => ({
              ...cat,
              icon: 'category'
          }));
          setCategoriesData(mapped);
      });

      // 3. Initialize Years
      api.getAvailableYears().then(years => {
          setAvailableYears(years);
          if (years.length > 0) setSelectedYear(years[0]);
      });
  }, []);

  // Fetch Volatile Data when Year Changes
  useEffect(() => {
      if (selectedYear) {
          api.getHeatmapData(selectedYear).then(setHeatmapData);
          api.getUserRanking(selectedYear).then(setRankingData);
          api.getTopDivergences(selectedYear).then(setTopDivergences);
      }
  }, [selectedYear]);

  const ticketMedio = realKPIs.totalCount > 0 ? (realKPIs.totalSales / realKPIs.totalCount) : 0;
  const totalCategoryValue = categoriesData.reduce((acc, curr) => acc + curr.value, 0);

  // --- FILTRAGEM AVANÇADA ---
  const filteredDivergences = useMemo(() => {
      return topDivergences.filter(item => {
          // 1. Text Search (SKU or Name)
          const searchLower = divergenceSearch.toLowerCase();
          if (searchLower && !item.name.toLowerCase().includes(searchLower) && !item.sku.toLowerCase().includes(searchLower)) {
              return false;
          }

          // 2. Diff Range
          const diffAbs = Math.abs(item.diff);
          if (diffMin && diffAbs < Number(diffMin)) return false;
          if (diffMax && diffAbs > Number(diffMax)) return false;

          // 3. Impact Range
          const impactAbs = Math.abs(item.diffValue);
          if (impactMin && impactAbs < Number(impactMin)) return false;
          if (impactMax && impactAbs > Number(impactMax)) return false;

          // 4. Type
          if (divergenceType === 'loss' && item.diff > 0) return false; // Perda é diff negativo (mas o filtro 'loss' deve pegar diff < 0)
          if (divergenceType === 'surplus' && item.diff < 0) return false;

          return true;
      });
  }, [topDivergences, divergenceSearch, diffMin, diffMax, impactMin, impactMax, divergenceType]);

  const handleOpenDetails = (item: any) => {
      // Map TopDivergenceItem to ItemDetailModal format
      setSelectedDivergence({
          ...item,
          ref: item.sku, // ItemDetailModal usa 'ref' ou 'sku'
          costPrice: item.costPrice,
          salesPrice: item.salesPrice,
          loc: item.location
      });
  };

  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'US';

  return (
    <div className="flex flex-col w-full min-h-screen bg-background-light dark:bg-background-dark pb-20 md:pb-6">
      
      {/* HEADER */}
      <header className="sticky top-0 z-20 bg-white/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-card-border p-4 md:px-8">
         <div className="max-w-7xl mx-auto w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Icon name="insights" className="text-primary" />
                        Dashboard Gerencial
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Análise financeira e controle de perdas.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                   <div className="hidden md:flex flex-col items-end mr-4">
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Última Atualização</p>
                      <p className="text-xs font-bold text-gray-700 dark:text-white">Agora</p>
                   </div>
                   <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-card-border rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-sm">
                        <Icon name="download" size={18} />
                        Relatório
                    </button>
                </div>
            </div>
         </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-8">
        
        {/* SECTION 1: STATIC SNAPSHOTS */}
        <div>
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Icon name="camera_alt" size={16} />
                Snapshot Atual do Estoque
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* 1. Total Stock Value */}
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-surface-dark dark:to-black p-5 rounded-2xl shadow-lg border border-gray-700 relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-4 opacity-10">
                    <Icon name="payments" size={80} className="text-white" />
                    </div>
                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="p-2 bg-white/10 rounded-lg text-white">
                            <Icon name="attach_money" />
                        </div>
                    </div>
                    <div className="relative z-10">
                        <p className="text-sm text-gray-300 font-medium">Valor em Estoque (Custo)</p>
                        <h3 className="text-2xl font-bold text-white mt-1">
                            <AnimatedNumber value={realKPIs.totalCost} prefix="R$ " decimals={2} />
                        </h3>
                        
                        <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-end">
                            <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase">Valor de Venda</p>
                                <p className="text-sm font-bold text-green-400">
                                    <AnimatedNumber value={realKPIs.totalSales} prefix="R$ " decimals={2} />
                                </p>
                            </div>
                            <Icon name="trending_up" className="text-green-400 opacity-50" />
                        </div>
                    </div>
                </div>

                {/* 2. Total Items */}
                <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-card-border hover:border-primary/50 transition-colors group">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-primary">
                            <Icon name="inventory_2" />
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Itens no Sistema</p>
                    <div className="flex items-end gap-3 mt-1">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                            <AnimatedNumber value={realKPIs.totalCount} duration={1500} />
                        </h3>
                        <span className="text-xs font-bold bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 px-2 py-1 rounded mb-1">
                            + <AnimatedNumber value={realKPIs.inactiveCount} duration={1500} /> Inativos
                        </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">SKUs Únicos Cadastrados</p>
                </div>

                {/* 3. Ticket Médio */}
                <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-card-border hover:border-purple-500/50 transition-colors group">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600">
                            <Icon name="sell" />
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Ticket Médio (Venda)</p>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                        <AnimatedNumber value={ticketMedio} prefix="R$ " decimals={2} duration={2500} />
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">Preço médio por item em estoque</p>
                </div>
            </div>
        </div>

        {/* SECTION 2: HISTORICAL PERFORMANCE */}
        <div>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Icon name="history" size={16} />
                    Histórico e Performance
                </h2>
                
                {/* YEAR SELECTOR */}
                <div className="flex items-center gap-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-card-border rounded-lg p-1">
                    <span className="text-xs font-bold text-gray-500 pl-2">Ano:</span>
                    <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="bg-transparent border-none text-sm font-bold text-primary focus:ring-0 cursor-pointer py-1 pl-1 pr-8"
                    >
                        {availableYears.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* HEATMAP */}
            <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-200 dark:border-card-border p-6 overflow-hidden mb-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Icon name="calendar_month" className="text-gray-400" />
                        Atividade de Inventário ({selectedYear})
                    </h2>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-500 font-medium bg-gray-50 dark:bg-white/5 px-3 py-1.5 rounded-lg">
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
                <YearlyHeatmap data={heatmapData} year={selectedYear} />
            </div>

            {/* MIDDLE SECTION: Ranking & Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* PRODUCTIVITY RANKING (NO ACCURACY) */}
                <div className="lg:col-span-1 bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-200 dark:border-card-border p-6 flex flex-col h-[400px]">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Icon name="leaderboard" className="text-yellow-500" />
                        Ranking ({selectedYear})
                    </h2>
                    <div className="space-y-5 flex-1 overflow-y-auto no-scrollbar pr-2">
                        {rankingData.length === 0 ? (
                            <div className="text-center text-gray-400 py-10">Nenhum dado de contagem neste ano.</div>
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
                                            <span className="text-xs font-bold text-primary">{user.counts}</span>
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

                {/* CATEGORY BREAKDOWN TABLE */}
                <div className="lg:col-span-2 bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-200 dark:border-card-border flex flex-col overflow-hidden h-[400px]">
                    <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Detalhamento Financeiro (Atual)</h2>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto overflow-x-auto no-scrollbar relative">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead className="bg-gray-50 dark:bg-surface-dark sticky top-0 z-10">
                                <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold shadow-sm">
                                <th className="py-4 px-6 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-surface-dark">Categoria</th>
                                <th className="py-4 px-6 border-b border-gray-100 dark:border-white/5 text-right bg-gray-50 dark:bg-surface-dark">Qtd Física</th>
                                <th className="py-4 px-6 border-b border-gray-100 dark:border-white/5 text-right bg-gray-50 dark:bg-surface-dark">Valor Total</th>
                                <th className="py-4 px-6 border-b border-gray-100 dark:border-white/5 w-1/3 bg-gray-50 dark:bg-surface-dark">% Share</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                {categoriesData.length === 0 ? (
                                    <tr><td colSpan={4} className="p-8 text-center text-gray-400">Nenhum dado encontrado</td></tr>
                                ) : (
                                    categoriesData.map((cat, idx) => {
                                    const percentage = totalCategoryValue > 0 ? (cat.value / totalCategoryValue) * 100 : 0;
                                    return (
                                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                <div className="size-8 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:text-primary transition-colors">
                                                    <Icon name={cat.icon} size={18} />
                                                </div>
                                                <span className="font-bold text-sm text-gray-700 dark:text-gray-200">{cat.name}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <span className="font-mono text-sm text-gray-600 dark:text-gray-300 font-medium">
                                                {cat.qty.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <span className="font-bold text-sm text-gray-900 dark:text-white">
                                                R$ {cat.value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                <div className="flex-1 h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-primary rounded-full relative" 
                                                        style={{ width: `${percentage}%` }} 
                                                    />
                                                </div>
                                                <span className="text-xs font-bold text-gray-600 dark:text-gray-300 w-10 text-right">
                                                    {percentage.toFixed(1)}%
                                                </span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* TOP DIVERGENCES WITH FILTERS (SPACED) */}
            <div className="mt-8 bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-200 dark:border-card-border flex flex-col h-[600px]">
                <div className="p-6 border-b border-gray-100 dark:border-white/5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Icon name="warning" className="text-red-500" />
                                Maiores Divergências ({selectedYear})
                            </h2>
                            <p className="text-xs text-gray-500">Filtrar e analisar impactos</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
                            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-red-500"></span> Perda</span>
                            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-blue-500"></span> Sobra</span>
                        </div>
                    </div>

                    {/* FILTERS BAR */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50 dark:bg-black/20 p-3 rounded-xl border border-gray-200 dark:border-white/5">
                        {/* Search */}
                        <div className="md:col-span-1">
                            <input 
                                type="text"
                                placeholder="Buscar SKU ou Produto..."
                                value={divergenceSearch}
                                onChange={(e) => setDivergenceSearch(e.target.value)}
                                className="w-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-lg text-xs py-2 px-3 text-gray-800 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                            />
                        </div>
                        
                        {/* Diff Range */}
                        <div className="md:col-span-1 flex items-center gap-2 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-lg px-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Diff</span>
                            <input 
                                type="number" placeholder="Min" 
                                value={diffMin} onChange={e => setDiffMin(e.target.value)}
                                className="w-12 bg-transparent border-none text-xs p-1 text-center font-mono focus:ring-0" 
                            />
                            <span className="text-gray-400">-</span>
                            <input 
                                type="number" placeholder="Max" 
                                value={diffMax} onChange={e => setDiffMax(e.target.value)}
                                className="w-12 bg-transparent border-none text-xs p-1 text-center font-mono focus:ring-0" 
                            />
                        </div>

                        {/* Impact Range */}
                        <div className="md:col-span-1 flex items-center gap-2 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-lg px-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">R$</span>
                            <input 
                                type="number" placeholder="Min" 
                                value={impactMin} onChange={e => setImpactMin(e.target.value)}
                                className="w-12 bg-transparent border-none text-xs p-1 text-center font-mono focus:ring-0" 
                            />
                            <span className="text-gray-400">-</span>
                            <input 
                                type="number" placeholder="Max" 
                                value={impactMax} onChange={e => setImpactMax(e.target.value)}
                                className="w-12 bg-transparent border-none text-xs p-1 text-center font-mono focus:ring-0" 
                            />
                        </div>

                        {/* Type Select */}
                        <div className="md:col-span-1">
                            <select 
                                value={divergenceType} 
                                onChange={(e) => setDivergenceType(e.target.value as any)}
                                className="w-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-lg text-xs py-2 px-3 text-gray-800 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                            >
                                <option value="all">Todos os Tipos</option>
                                <option value="loss">Apenas Perdas (-)</option>
                                <option value="surplus">Apenas Sobras (+)</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto no-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[800px]">
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
                            {filteredDivergences.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-10 text-gray-400">Nenhuma divergência encontrada com estes filtros.</td></tr>
                            ) : (
                                filteredDivergences.map((item) => (
                                <tr 
                                key={item.id} 
                                onClick={() => handleOpenDetails(item)}
                                className="border-b border-gray-50 dark:border-white/5 last:border-0 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                                >
                                    <td className="py-3 px-6">
                                        <div className="font-bold text-gray-900 dark:text-white">{item.sku}</div>
                                        <div className="text-xs text-gray-500 line-clamp-1 max-w-[200px]">{item.name}</div>
                                    </td>
                                    <td className="py-3 px-4 text-center text-xs text-gray-400">
                                        {item.location || 'Geral'}
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <div className="size-6 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center text-[9px] font-bold">
                                                {getInitials(item.user)}
                                            </div>
                                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate max-w-[100px]">
                                                {item.user ? item.user.split(' ')[0] : 'Sistema'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <div className="flex flex-col items-center leading-none">
                                            <span className="font-bold text-gray-700 dark:text-gray-300">{item.counted}</span>
                                            <span className="text-[10px] text-gray-400">de {item.expected}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`inline-block w-10 py-0.5 rounded text-xs font-bold ${item.diff < 0 ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'}`}>
                                            {item.diff > 0 ? '+' : ''}{item.diff}
                                        </span>
                                    </td>
                                    <td className={`py-3 px-6 text-right font-bold ${item.diffValue < 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                        R$ {Math.abs(item.diffValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                    <Icon name="chevron_right" size={18} className="text-gray-300 group-hover:text-primary transition-colors" />
                                    </td>
                                </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

      </main>

      {/* REUSED DETAIL MODAL */}
      <ItemDetailModal 
        isOpen={!!selectedDivergence} 
        onClose={() => setSelectedDivergence(null)} 
        item={selectedDivergence} 
      />

    </div>
  );
};
