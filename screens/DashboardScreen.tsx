
import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Icon } from '../components/Icon';
import { Screen, User } from '../types';
import { api, ApiCategory, MetaStatus } from '../services/api';
import { AutoPartsLoader } from '../components/AutoPartsLoader';

interface DashboardScreenProps {
  onNavigate: (screen: Screen) => void;
  onCategorySelect: (category: string, dbId: number) => void;
  currentUser: User | null;
  onLogout?: () => void;
  categories: ApiCategory[]; 
  treatmentCount?: number; 
}

const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'US';

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ 
  onNavigate, 
  onCategorySelect, 
  currentUser, 
  categories,
  treatmentCount = 0
}) => {
  if (!categories || categories.length === 0) { 
      return <AutoPartsLoader message="Analisando Cobertura..." fullScreen={false} />;
  }

  const [metaStatus, setMetaStatus] = useState<MetaStatus>({ totalStock: 0, mappedStock: 0 });

  useEffect(() => {
    const loadStatus = async () => {
        const status = await api.getMetaStatus();
        setMetaStatus(status);
    };
    loadStatus();
  }, []);

  const { totalStock, mappedStock } = metaStatus;
  const remaining = Math.max(0, totalStock - mappedStock);
  const percentComplete = totalStock > 0 ? ((mappedStock / totalStock) * 100).toFixed(1) : '0';
  
  const chartData = [
    { name: 'Mapeado', value: mappedStock, color: '#137fec' }, // Blue
    { name: 'Pendente', value: remaining, color: '#e2e8f0' }   // Slate 200
  ];

  return (
    <div className="relative flex flex-col w-full min-h-screen pb-24 md:pb-0 bg-background-light dark:bg-background-dark md:bg-transparent">
      {/* Header */}
      <header className="flex items-center justify-between bg-background-light dark:bg-background-dark md:bg-transparent p-4 md:px-8 md:pt-8 md:pb-4 sticky top-0 md:static z-30 border-b md:border-b-0 border-gray-200 dark:border-card-border/30 backdrop-blur-md md:backdrop-blur-none bg-opacity-90 dark:bg-opacity-90">
        <div className="flex items-center gap-3">
          <div className="relative md:hidden">
            <div className="size-10 rounded-full bg-primary text-white font-bold flex items-center justify-center border-2 border-white dark:border-surface-dark shadow-sm">
               {getInitials(currentUser?.name || '')}
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-gray-900 dark:text-white leading-tight md:hidden">
                Olá, {currentUser?.name.split(' ')[0]}
            </span>
            <span className="text-xs font-normal text-text-secondary md:hidden uppercase tracking-wide">
                Vamos zerar o estoque?
            </span>

            <div className="hidden md:flex items-center gap-1">
              <h2 className="text-2xl font-bold leading-tight md:text-gray-900 md:dark:text-white">
                Cobertura de Estoque
                <span className="text-gray-400 font-normal ml-2 text-lg">| Visão Geral</span>
              </h2>
            </div>
          </div>
        </div>
        
        {currentUser?.isAdmin && (
             <button 
               onClick={() => onNavigate('settings')}
               className="md:hidden flex items-center justify-center rounded-full size-10 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
             >
                <Icon name="settings" size={24} />
             </button>
        )}
      </header>

      <main className="flex flex-col p-4 md:px-8 md:pb-8 gap-6 md:grid md:grid-cols-3">
        
        {/* KPI: STOCK COVERAGE */}
        <div className="md:col-span-1 bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-200 dark:border-card-border p-5 relative overflow-hidden group hover:border-primary/50 transition-all duration-300">
           <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="flex flex-col">
                 <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                     Progresso Global
                 </h3>
                 <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-4xl font-extrabold text-gray-900 dark:text-white">{percentComplete}%</p>
                    <span className="text-xs text-gray-400 font-medium">concluído</span>
                 </div>
                 <p className="text-xs text-gray-500 mt-2">
                    <strong className="text-primary">{mappedStock.toLocaleString()}</strong> de {totalStock.toLocaleString()} itens
                 </p>
              </div>
              <div className="size-20">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        innerRadius={25}
                        outerRadius={35}
                        dataKey="value"
                        stroke="none"
                        startAngle={90}
                        endAngle={-270}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                 </ResponsiveContainer>
              </div>
           </div>
           
           <div className="relative z-10 mt-2">
              <div className="h-3 w-full bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                 <div className="h-full bg-gradient-to-r from-blue-500 to-primary rounded-full transition-all duration-1000 ease-out" style={{ width: `${percentComplete}%` }} />
              </div>
           </div>
        </div>

        {/* KPI: Issues */}
        {currentUser?.isAdmin && (
          <div className="md:col-span-1 bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-200 dark:border-card-border p-5 relative overflow-hidden group hover:border-orange-400/50 transition-colors duration-300 cursor-pointer" onClick={() => onNavigate('treatment')}>
             <div className="flex justify-between items-start mb-2 relative z-10">
                <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400">
                   <Icon name="report_problem" />
                </div>
                <button className="text-xs font-bold text-primary hover:underline">Resolver</button>
             </div>
             <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{treatmentCount}</h3>
             <p className="text-xs text-gray-500 font-medium">Divergências pendentes</p>
          </div>
        )}

        {/* Categories Grid */}
        <div className="md:col-span-3">
           <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 px-1">Categorias de Inventário</h2>
           
           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {categories.map((cat) => {
                const percent = cat.count > 0 ? (cat.mappedCount / cat.count) * 100 : 0;
                const isComplete = percent >= 100;
                
                return (
                <button
                  key={cat.id}
                  onClick={() => onCategorySelect(cat.label, cat.db_id)}
                  className={`flex flex-col p-4 rounded-xl border shadow-sm transition-all duration-300 group text-left relative overflow-hidden ${
                      isComplete 
                      ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30' 
                      : 'bg-white dark:bg-surface-dark border-gray-200 dark:border-card-border hover:border-primary/50 hover:shadow-md'
                  }`}
                >
                   <div className="flex justify-between items-start w-full mb-3">
                       <div className={`size-10 rounded-lg flex items-center justify-center transition-colors ${
                           isComplete ? 'bg-green-100 text-green-600' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 group-hover:bg-primary/10 group-hover:text-primary'
                       }`}>
                          <Icon name={isComplete ? "check_circle" : cat.icon} size={24} fill={isComplete} />
                       </div>
                       <span className={`text-xs font-bold ${isComplete ? 'text-green-600' : 'text-gray-400'}`}>
                           {Math.round(percent)}%
                       </span>
                   </div>
                   
                   <span className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-tight line-clamp-1 mb-1">
                      {cat.label}
                   </span>
                   
                   <div className="mt-auto w-full">
                       <div className="h-1.5 w-full bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
                           <div 
                             className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-primary'}`}
                             style={{ width: `${percent}%` }}
                           />
                       </div>
                       <p className="text-[10px] text-gray-400 mt-1 text-right">{cat.mappedCount}/{cat.count}</p>
                   </div>
                </button>
                );
              })}
           </div>
        </div>

      </main>
    </div>
  );
};
