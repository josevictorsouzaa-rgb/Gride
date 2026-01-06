import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ComposedChart, Line, CartesianGrid, Legend } from 'recharts';
import { Icon } from '../components/Icon';
import { Screen } from '../types';
import { ItemDetailModal } from '../components/ItemDetailModal';

interface AnalyticsScreenProps {
  onNavigate: (screen: Screen) => void;
}

// --- MOCK DATA GENERATORS ---

const generateDivergences = (count: number) => {
  const items = [];
  const brands = ['BOSCH', 'NGK', 'TECFIL', 'COFAP', 'NAKATA', 'MOURA', 'PIRELLI'];
  const users = ['Carlos Silva', 'Mariana Santos', 'João Pedro', 'Ana Souza'];
  
  for (let i = 0; i < count; i++) {
    const cost = Math.random() * 200 + 20; // R$ 20 to R$ 220
    const margin = 1.6; // 60% markup
    const salesPrice = cost * margin;
    const stock = Math.floor(Math.random() * 50);
    const diff = Math.floor(Math.random() * 10) - 5; // -5 to +5
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
      diff: diff === 0 ? (Math.random() > 0.5 ? 1 : -1) : diff, // Ensure divergence
      diffValue: diffValue === 0 ? cost : diffValue,
      causer: causer,
      history: [
        { date: 'Hoje', user: causer, action: 'Contagem Cíclica', oldValue: stock, newValue: stock + diff },
        { date: '15/10/2023', user: 'Mariana Santos', action: 'Entrada NFe', oldValue: stock - 10, newValue: stock },
        { date: '10/09/2023', user: 'Sistema', action: 'Venda Balcão', oldValue: stock + 2, newValue: stock - 10 },
      ]
    });
  }
  return items.sort((a, b) => Math.abs(b.diffValue) - Math.abs(a.diffValue)); // Sort by impact
};

const initialDivergenceData = generateDivergences(50);

// Updated with icons and more specific data
const categoryPerformance = [
  { name: 'MOTOR', icon: 'car_repair', value: 850000, qty: 12500 },
  { name: 'FREIOS', icon: 'motion_photos_on', value: 420000, qty: 8400 },
  { name: 'SUSPENSÃO', icon: 'height', value: 380000, qty: 6200 },
  { name: 'TRANSMISSÃO', icon: 'settings', value: 320000, qty: 2100 },
  { name: 'ELÉTRICA', icon: 'bolt', value: 150000, qty: 15000 },
  { name: 'ACESSÓRIOS', icon: 'extension', value: 80000, qty: 4500 },
  { name: 'ALIMENTAÇÃO', icon: 'local_gas_station', value: 180000, qty: 3200 },
  { name: 'REFRIGERAÇÃO', icon: 'mode_fan', value: 70320, qty: 1800 },
].sort((a, b) => b.value - a.value); // Sort by Value desc

const totalStockValue = categoryPerformance.reduce((acc, curr) => acc + curr.value, 0);
const totalStockQty = categoryPerformance.reduce((acc, curr) => acc + curr.qty, 0);

const userRankData = [
  { name: 'Carlos Silva', counts: 1450, accuracy: 99.2, avatar: '849201' },
  { name: 'Mariana Santos', counts: 1320, accuracy: 98.5, avatar: 'Mariana' },
  { name: 'João Pedro', counts: 1100, accuracy: 97.8, avatar: 'Joao' },
  { name: 'Ana Souza', counts: 850, accuracy: 96.5, avatar: 'Ana' },
];

// --- HEATMAP LOGIC ---
const generateHeatmapData = () => {
  const data = [];
  const now = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(now.getFullYear() - 1);

  for (let d = new Date(oneYearAgo); d <= now; d.setDate(d.getDate() + 1)) {
    const probability = Math.random();
    let level = 0;
    if (probability > 0.8) level = 3; 
    else if (probability > 0.5) level = 2; 
    else if (probability > 0.2) level = 1; 

    data.push({
      date: new Date(d),
      level: level, 
      count: level === 0 ? 0 : Math.floor(Math.random() * 50 * level)
    });
  }
  return data;
};

const heatmapData = generateHeatmapData();

// --- COMPONENTS ---

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-surface-dark p-3 border border-gray-200 dark:border-card-border rounded-xl shadow-xl text-xs z-50">
          <p className="font-bold text-gray-900 dark:text-white mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
             <p key={index} style={{ color: entry.color }} className="flex justify-between gap-4 font-medium mb-1">
                <span>{entry.name === 'value' ? 'Valor (R$)' : 'Qtd (un)'}:</span>
                <span>
                    {entry.name === 'value' 
                        ? `R$ ${entry.value.toLocaleString('pt-BR')}` 
                        : entry.value.toLocaleString('pt-BR')}
                </span>
             </p>
          ))}
        </div>
      );
    }
    return null;
};

// --- DIVERGENCE RESOLUTION MODAL (Specialized) ---
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
           {/* Item Details - Enhanced for Identification */}
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

           {/* Responsibility */}
           <div className="flex items-center gap-3 p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30">
              <div className="size-10 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 flex items-center justify-center shrink-0">
                 <Icon name="history_edu" size={20} />
              </div>
              <div className="flex-1">
                 <p className="text-xs font-bold uppercase text-yellow-700 dark:text-yellow-500">Origem da Divergência</p>
                 <p className="text-sm text-gray-800 dark:text-gray-200">
                    Apontado por <strong>{item.causer}</strong> na última contagem cíclica.
                 </p>
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

  const handleAcceptDivergence = (item: any) => {
    // Remove the item from the list to simulate acceptance/resolution
    setDivergenceList(prev => prev.filter(i => i.id !== item.id));
    setSelectedDivergence(null);
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-background-light dark:bg-background-dark pb-20 md:pb-6">
      
      {/* HEADER & FILTERS */}
      <header className="sticky top-0 z-20 bg-white/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-card-border p-4 md:px-8">
         <div className="max-w-7xl mx-auto w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Icon name="insights" className="text-primary" />
                        Dashboard Gerencial
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Análise financeira, acuracidade e controle de perdas.
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
        
        {/* KPI CARDS - ENHANCED WITH MONETARY VALUE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Total Stock Value */}
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
                    <p className="text-sm text-gray-300 font-medium">Valor Total em Estoque</p>
                    <h3 className="text-2xl font-bold text-white mt-1">R$ {totalStockValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                    <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                       <Icon name="trending_up" size={14} /> +R$ 120k este mês
                    </p>
                </div>
            </div>

            <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-card-border hover:border-primary/50 transition-colors group">
                <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-primary">
                        <Icon name="inventory_2" />
                    </div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Itens Ativos</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">12.450</h3>
                <p className="text-xs text-gray-400 mt-1">SKUs Cadastrados</p>
            </div>

            <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-card-border hover:border-primary/50 transition-colors group">
                <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-orange-600">
                        <Icon name="rule" />
                    </div>
                    <span className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">-0.3%</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Acuracidade Geral</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">98.2%</h3>
                <p className="text-xs text-gray-400 mt-1">Meta: 99.0%</p>
            </div>

            <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-card-border hover:border-primary/50 transition-colors group">
                <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600">
                        <Icon name="currency_exchange" />
                    </div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Perdas/Sobra (Mês)</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1 text-red-500">-R$ 840,00</h3>
                <p className="text-xs text-gray-400 mt-1">Ajustes Líquidos</p>
            </div>
        </div>

        {/* HEATMAP - EXPANDED FULL WIDTH */}
        <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-200 dark:border-card-border p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Icon name="calendar_month" className="text-gray-400" />
                    Atividade de Inventário (365 dias)
                </h2>
                
                {/* Intensity Legend */}
                <div className="flex items-center gap-2 text-xs text-gray-500 font-medium bg-gray-50 dark:bg-white/5 px-3 py-1.5 rounded-lg">
                    <span>Menos</span>
                    <div className="flex gap-1 mx-1">
                        <div className="size-3 rounded-sm bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10" title="0 itens" />
                        <div className="size-3 rounded-sm bg-green-200 dark:bg-green-900/40" title="Baixa atividade" />
                        <div className="size-3 rounded-sm bg-green-400 dark:bg-green-600" title="Média atividade" />
                        <div className="size-3 rounded-sm bg-green-600 dark:bg-green-500" title="Alta atividade" />
                    </div>
                    <span>Mais</span>
                </div>
            </div>
            
            <div className="overflow-x-auto pb-2 no-scrollbar">
                <div className="flex gap-1 min-w-max">
                    {Array.from({ length: 53 }).map((_, colIndex) => (
                        <div key={colIndex} className="flex flex-col gap-1">
                            {Array.from({ length: 7 }).map((_, rowIndex) => {
                                const dayIndex = colIndex * 7 + rowIndex;
                                if (dayIndex >= heatmapData.length) return null;
                                const day = heatmapData[dayIndex];
                                let bgColor = 'bg-gray-100 dark:bg-white/5';
                                if (day.level === 1) bgColor = 'bg-green-200 dark:bg-green-900/40';
                                if (day.level === 2) bgColor = 'bg-green-400 dark:bg-green-600';
                                if (day.level === 3) bgColor = 'bg-green-600 dark:bg-green-500';
                                return (
                                    <div 
                                        key={rowIndex} 
                                        className={`size-3 rounded-[2px] ${bgColor} transition-all hover:ring-2 hover:ring-offset-1 hover:ring-primary/50`}
                                        title={`${day.date.toLocaleDateString()}: ${day.count} itens`}
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* MIDDLE SECTION: Category Breakdown & Ranking */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* CATEGORY BREAKDOWN TABLE (Takes 2/3 of space on desktop) */}
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
                        {categoryPerformance.map((cat, idx) => {
                           const percentage = (cat.value / totalStockValue) * 100;
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
                        })}
                     </tbody>
                  </table>
               </div>
            </div>

            {/* PRODUCTIVITY RANKING (Takes 1/3 of space on desktop) */}
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

        {/* TOP DIVERGENCES - SCROLLABLE & DETAILED */}
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
