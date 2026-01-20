
import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ComposedChart, Line, CartesianGrid, Legend } from 'recharts';
import { Icon } from '../components/Icon';
import { Screen } from '../types';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { api } from '../services/api';
import { GROUP_ICONS } from '../data/categories';

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

// --- MOCK DATA GENERATORS (Only for components not yet fully integrated with DB) ---

const generateDivergences = (count: number) => {
  const items = [];
  const brands = ['BOSCH', 'NGK', 'TECFIL', 'COFAP', 'NAKATA', 'MOURA', 'PIRELLI'];
  const users = ['Carlos Silva', 'Mariana Santos', 'João Pedro', 'Ana Souza'];
  
  for (let i = 0; i < count; i++) {
    const cost = Math.random() * 200 + 20; 
    const margin = 1.6; 
    const salesPrice = cost * margin;
    const stock = Math.floor(Math.random() * 50);
    const diff = Math.floor(Math.random() * 10) - 5; 
    const diffValue = diff * cost;
    const causer = users[Math.floor(Math.random() * users.length)];

    items.push({
      id: i + 1,
      sku: `${Math.floor(Math.random() * 90000) + 10000}`,
      name: `Peça Automotiva T-${i}`,
      brand: brands[Math.floor(Math.random() * brands.length)],
      location: `Rua ${Math.floor(Math.random() * 10) + 1} - Nível ${Math.floor(Math.random() * 4) + 1}`,
      costPrice: cost,
      salesPrice: salesPrice,
      totalStockValue: stock * cost,
      expected: stock,
      counted: stock + diff,
      diff: diff === 0 ? (Math.random() > 0.5 ? 1 : -1) : diff, 
      diffValue: diffValue === 0 ? cost : diffValue,
      causer: causer,
      history: []
    });
  }
  return items.sort((a, b) => Math.abs(b.diffValue) - Math.abs(a.diffValue)); 
};

const initialDivergenceData = generateDivergences(50);

const userRankData = [
  { name: 'Carlos Silva', counts: 1450, accuracy: 99.2, avatar: '849201' },
  { name: 'Mariana Santos', counts: 1320, accuracy: 98.5, avatar: 'Mariana' },
  { name: 'João Pedro', counts: 1100, accuracy: 97.8, avatar: 'Joao' },
  { name: 'Ana Souza', counts: 850, accuracy: 96.5, avatar: 'Ana' },
];

// --- HEATMAP COMPONENT (YEARLY - REAL DATA) ---
const YearlyHeatmap = ({ data }: { data: { month: number, day: number, count: number }[] }) => {
    // Generate full year grid
    const today = new Date();
    const currentYear = today.getFullYear();
    const daysInYear = [];
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31);

    // Create a map for quick lookup
    const countMap = new Map();
    data.forEach(d => countMap.set(`${d.month}-${d.day}`, d.count));

    for (let d = new Date(startOfYear); d <= endOfYear; d.setDate(d.getDate() + 1)) {
        daysInYear.push(new Date(d));
    }

    // Determine weeks (columns)
    const weeks = [];
    let currentWeek: any[] = [];
    
    // Pad first week if year doesn't start on Sunday
    for(let i=0; i<startOfYear.getDay(); i++) currentWeek.push(null);

    daysInYear.forEach(date => {
        currentWeek.push(date);
        if (currentWeek.length === 7) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
    });
    if (currentWeek.length > 0) {
        while(currentWeek.length < 7) currentWeek.push(null);
        weeks.push(currentWeek);
    }

    return (
        <div className="overflow-x-auto pb-2 no-scrollbar">
            <div className="flex gap-1 min-w-max">
                {weeks.map((week, wIdx) => (
                    <div key={wIdx} className="flex flex-col gap-1">
                        {week.map((date, dIdx) => {
                            if (!date) return <div key={dIdx} className="size-3" />;
                            
                            const key = `${date.getMonth() + 1}-${date.getDate()}`;
                            const count = countMap.get(key) || 0;
                            const isFuture = date > today;

                            let bgColor = 'bg-gray-100 dark:bg-white/5';
                            if (!isFuture) {
                                if (count > 50) bgColor = 'bg-green-600 dark:bg-green-500';
                                else if (count > 20) bgColor = 'bg-green-400 dark:bg-green-600';
                                else if (count > 0) bgColor = 'bg-green-200 dark:bg-green-900/40';
                            } else {
                                bgColor = 'bg-transparent border border-gray-100 dark:border-white/5'; // Future style
                            }

                            return (
                                <div 
                                    key={dIdx} 
                                    className={`size-3 rounded-[2px] ${bgColor} transition-all hover:ring-2 hover:ring-offset-1 hover:ring-primary/50 relative group`}
                                >
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-black text-white text-[10px] p-1 rounded whitespace-nowrap z-50">
                                        {date.toLocaleDateString()}: {count} itens
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- DIVERGENCE RESOLUTION MODAL ---
interface DivergenceResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any | null;
  onAccept: (item: any) => void;
}

const DivergenceResolutionModal: React.FC<DivergenceResolutionModalProps> = ({ isOpen, onClose, item, onAccept }) => {
  if (!isOpen || !item) return null;

  const isLoss = item.diffValue < 0;
  const impactColor = isLoss ? 'text-red-500' : 'text-blue-500';
  const impactBg = isLoss ? 'bg-red-50 dark:bg-red-900/20' : 'bg-blue-50 dark:bg-blue-900/20';
  const impactBorder = isLoss ? 'border-red-100 dark:border-red-900/40' : 'border-blue-100 dark:border-blue-900/40';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-surface-dark rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-scale-up border border-gray-200 dark:border-card-border">
        
        {/* Impact Header */}
        <div className={`p-8 flex flex-col items-center justify-center text-center border-b ${impactBorder} ${impactBg}`}>
            <div className={`text-4xl font-extrabold tracking-tight ${impactColor} mb-2`}>
               {isLoss ? '-' : '+'} R$ {Math.abs(item.diffValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide opacity-70 text-gray-700 dark:text-gray-200">
               {isLoss ? <Icon name="trending_down" size={20} /> : <Icon name="trending_up" size={20} />}
               {isLoss ? 'Perda Financeira' : 'Sobra de Estoque'}
            </div>
        </div>

        <div className="p-6 space-y-6">
           {/* Item Details */}
           <div className="flex items-start gap-4 bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-gray-100 dark:border-white/5">
              <div className="size-14 rounded-xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/10 flex items-center justify-center shrink-0 text-primary shadow-sm">
                 <Icon name="extension" size={32} />
              </div>
              <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                        {item.brand}
                    </span>
                    <span className="text-[10px] font-mono font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-white/10 px-2 py-0.5 rounded border border-gray-200 dark:border-white/10">
                        REF: {item.sku}
                    </span>
                 </div>
                 <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight break-words">
                    {item.name}
                 </h3>
                 <div className="flex items-center gap-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <Icon name="place" size={16} />
                    <span className="font-medium">{item.location}</span>
                 </div>
              </div>
           </div>

           {/* Count Comparison */}
           <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-black/20">
              <div className="text-center">
                 <span className="text-xs font-bold uppercase text-gray-400">Sistema</span>
                 <p className="text-xl font-bold text-gray-900 dark:text-white">{item.expected}</p>
              </div>
              <Icon name="arrow_forward" className="text-gray-300" />
              <div className="text-center">
                 <span className="text-xs font-bold uppercase text-gray-400">Contagem</span>
                 <p className="text-xl font-bold text-gray-900 dark:text-white">{item.counted}</p>
              </div>
              <div className={`px-3 py-1 rounded-lg font-bold text-lg ${isLoss ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                 {item.diff > 0 ? '+' : ''}{item.diff}
              </div>
           </div>
        </div>

        {/* Actions */}
        <div className="p-6 pt-2 flex flex-col gap-3">
           <button 
             onClick={() => onAccept(item)}
             className="w-full h-14 rounded-xl bg-gray-900 dark:bg-white dark:text-black text-white font-bold text-lg shadow-xl hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
           >
             <Icon name="check_circle" size={24} />
             Acatar Divergência
           </button>
           
           <button 
             onClick={onClose}
             className="w-full py-3 text-sm font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
           >
             Cancelar / Investigar Mais
           </button>
        </div>

      </div>
    </div>
  );
};

export const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ onNavigate }) => {
  const [divergenceList, setDivergenceList] = useState(initialDivergenceData);
  const [selectedDivergence, setSelectedDivergence] = useState<any | null>(null);
  
  // Real Data States
  const [realKPIs, setRealKPIs] = useState({ totalCost: 0, totalSales: 0, totalCount: 0, inactiveCount: 0 });
  const [heatmapData, setHeatmapData] = useState<{ month: number, day: number, count: number }[]>([]);
  const [categoriesData, setCategoriesData] = useState<{ name: string, qty: number, value: number, icon: string }[]>([]);

  useEffect(() => {
      // 1. Fetch KPIs
      api.getAnalyticsKPIs().then(setRealKPIs);
      
      // 2. Fetch Heatmap
      api.getHeatmapData().then(setHeatmapData);

      // 3. Fetch Categories Financials
      api.getFinancialCategories().then(data => {
          // Add icons roughly mapped or default
          const mapped = data.map(cat => ({
              ...cat,
              icon: 'category' // Fallback icon, could map if GR_COD was available or by name
          }));
          setCategoriesData(mapped);
      });
  }, []);

  const ticketMedio = realKPIs.totalCount > 0 ? (realKPIs.totalSales / realKPIs.totalCount) : 0;
  const totalCategoryValue = categoriesData.reduce((acc, curr) => acc + curr.value, 0);

  const handleAcceptDivergence = (item: any) => {
    setDivergenceList(prev => prev.filter(i => i.id !== item.id));
    setSelectedDivergence(null);
  };

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
                      <p className="text-xs font-bold text-gray-700 dark:text-white">Hoje, 14:30</p>
                   </div>
                   <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-card-border rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-sm">
                        <Icon name="download" size={18} />
                        Relatório
                    </button>
                </div>
            </div>
         </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-6">
        
        {/* KPI CARDS ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* 1. Total Stock Value (Double Value: Cost & Sales) */}
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

            {/* 2. Total Items (Active & Inactive Animated) */}
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

            {/* 3. Ticket Médio (Average Unit Price) */}
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

        {/* HEATMAP - ANNUAL & REAL DATA */}
        <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-200 dark:border-card-border p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Icon name="calendar_month" className="text-gray-400" />
                    Atividade de Inventário ({new Date().getFullYear()})
                </h2>
                
                {/* Intensity Legend */}
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
            
            <YearlyHeatmap data={heatmapData} />
        </div>

        {/* MIDDLE SECTION: Category Breakdown & Ranking */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* CATEGORY BREAKDOWN TABLE (REAL DATA) */}
            <div className="lg:col-span-2 bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-200 dark:border-card-border flex flex-col overflow-hidden h-[400px]">
               <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Detalhamento Financeiro por Categoria</h2>
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

            {/* PRODUCTIVITY RANKING */}
            <div className="lg:col-span-1 bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-200 dark:border-card-border p-6 flex flex-col h-[400px]">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Icon name="leaderboard" className="text-yellow-500" />
                    Ranking (Mês)
                </h2>
                <div className="space-y-5 flex-1 overflow-y-auto no-scrollbar pr-2">
                    {userRankData.map((user, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                             <div className={`font-bold w-4 text-center ${idx === 0 ? 'text-yellow-500 text-lg' : 'text-gray-400'}`}>{idx + 1}</div>
                             <div 
                                className="size-10 rounded-full bg-gray-200 bg-cover bg-center border border-gray-100 dark:border-gray-600"
                                style={{ backgroundImage: `url('https://i.pravatar.cc/150?u=${user.avatar}')` }}
                             />
                             <div className="flex-1 min-w-0">
                                 <div className="flex justify-between mb-1">
                                     <span className="font-bold text-sm text-gray-900 dark:text-white truncate">{user.name}</span>
                                     <span className="text-xs font-bold text-primary">{user.counts}</span>
                                 </div>
                                 <div className="flex items-center gap-2">
                                     <div className="flex-1 h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                         <div 
                                            className="h-full bg-primary rounded-full" 
                                            style={{ width: `${(user.counts / 1600) * 100}%` }}
                                         />
                                     </div>
                                     <span className={`text-[10px] font-bold ${user.accuracy >= 99 ? 'text-green-500' : 'text-yellow-500'}`}>
                                         {user.accuracy}% Ac.
                                     </span>
                                 </div>
                             </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* TOP DIVERGENCES */}
        <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-200 dark:border-card-border flex flex-col h-[500px]">
            <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/5 rounded-t-2xl">
                <div>
                   <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                       <Icon name="warning" className="text-red-500" />
                       Maiores Divergências de Inventário
                   </h2>
                   <p className="text-xs text-gray-500">Ordenado por impacto financeiro (Top 100)</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
                    <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-red-500"></span> Perda</span>
                    <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-blue-500"></span> Sobra</span>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto no-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-white dark:bg-surface-dark sticky top-0 z-10 shadow-sm">
                        <tr className="text-xs text-gray-400 uppercase border-b border-gray-100 dark:border-white/5">
                            <th className="py-3 px-6 font-medium">SKU / Produto</th>
                            <th className="py-3 px-4 font-medium text-center">Local</th>
                            <th className="py-3 px-4 font-medium text-center">Contagem</th>
                            <th className="py-3 px-4 font-medium text-center">Diff</th>
                            <th className="py-3 px-6 font-medium text-right">Impacto (R$)</th>
                            <th className="py-3 px-4"></th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {divergenceList.map((item) => (
                            <tr 
                              key={item.id} 
                              onClick={() => setSelectedDivergence(item)}
                              className="border-b border-gray-50 dark:border-white/5 last:border-0 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                            >
                                <td className="py-3 px-6">
                                    <div className="font-bold text-gray-900 dark:text-white">{item.sku}</div>
                                    <div className="text-xs text-gray-500">{item.name}</div>
                                </td>
                                <td className="py-3 px-4 text-center text-xs text-gray-400">
                                    {item.location}
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
                                    R$ {item.diffValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-3 px-4 text-right">
                                   <Icon name="chevron_right" size={18} className="text-gray-300 group-hover:text-primary transition-colors" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

      </main>

      {/* NEW DIVERGENCE MODAL */}
      <DivergenceResolutionModal 
        isOpen={!!selectedDivergence} 
        onClose={() => setSelectedDivergence(null)} 
        item={selectedDivergence} 
        onAccept={handleAcceptDivergence}
      />

    </div>
  );
};
