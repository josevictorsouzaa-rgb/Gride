
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
  categories
}) => {
  if (!categories || categories.length === 0) { 
      return <AutoPartsLoader message="Analisando Estoque..." fullScreen={false} />;
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
  
  // Data for Pie Chart
  const data = [
    { name: 'Mapeado', value: mappedStock, color: '#137fec' }, // Primary Blue
    { name: 'Pendente', value: remaining, color: '#e2e8f0' }   // Slate 200
  ];

  return (
    <div className="flex flex-col w-full min-h-screen pb-24 md:pb-0 bg-background-light dark:bg-background-dark md:bg-transparent">
      {/* Header Mobile */}
      <header className="md:hidden flex items-center justify-between p-4 sticky top-0 z-30 bg-white/90 dark:bg-surface-dark/90 backdrop-blur border-b border-gray-200 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-primary text-white font-bold flex items-center justify-center border-2 border-white shadow-sm">
             {getInitials(currentUser?.name || '')}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Olá, {currentUser?.name.split(' ')[0]}</h2>
            <p className="text-xs text-gray-500">Vamos cobrir o estoque!</p>
          </div>
        </div>
      </header>

      <main className="flex flex-col p-4 gap-6 md:grid md:grid-cols-3">
        
        {/* KPI: STOCK COVERAGE (GLOBAL) */}
        <div className="md:col-span-1 bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-200 dark:border-white/5 p-5 relative overflow-hidden">
           <div className="flex justify-between items-start">
              <div>
                 <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                     Progresso Global
                 </h3>
                 <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-4xl font-extrabold text-gray-900 dark:text-white">{percentComplete}%</p>
                    <span className="text-xs text-gray-400 font-medium">do estoque</span>
                 </div>
                 <div className="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                    {mappedStock.toLocaleString()} de {totalStock.toLocaleString()} itens
                 </div>
              </div>
              
              <div className="size-20">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data}
                        innerRadius={25}
                        outerRadius={35}
                        dataKey="value"
                        stroke="none"
                        startAngle={90}
                        endAngle={-270}
                      >
                        {data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                 </ResponsiveContainer>
              </div>
           </div>
           
           {/* Visual Bar */}
           <div className="mt-4 h-3 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-gradient-to-r from-blue-500 to-green-400 rounded-full transition-all duration-1000 ease-out" 
                 style={{ width: `${percentComplete}%` }} 
               />
           </div>
        </div>

        {/* Categories Grid */}
        <div className="md:col-span-3">
           <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 px-1">Grupos de Inventário</h2>
           
           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {categories.map((cat) => {
                const percentage = cat.count > 0 ? (cat.mappedCount / cat.count) * 100 : 0;
                const isComplete = percentage >= 100;
                
                return (
                <button
                  key={cat.id}
                  onClick={() => onCategorySelect(cat.label, cat.db_id)}
                  className={`flex flex-col p-4 rounded-xl border shadow-sm transition-all duration-300 group text-left relative overflow-hidden ${
                      isComplete 
                      ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30' 
                      : 'bg-white dark:bg-surface-dark border-gray-200 dark:border-white/5 hover:border-primary/50'
                  }`}
                >
                   <div className="flex justify-between items-start w-full mb-3">
                       <div className={`size-10 rounded-lg flex items-center justify-center transition-colors ${
                           isComplete ? 'bg-green-100 text-green-600' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 group-hover:bg-primary/10 group-hover:text-primary'
                       }`}>
                          <Icon name={isComplete ? "check_circle" : cat.icon} size={24} fill={isComplete} />
                       </div>
                       <span className="text-xs font-bold text-gray-400">{Math.round(percentage)}%</span>
                   </div>
                   
                   <span className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-tight line-clamp-1 mb-1">
                      {cat.label}
                   </span>
                   
                   <div className="mt-auto w-full">
                       <div className="flex justify-between text-[10px] text-gray-400 font-medium mb-1">
                           <span>{cat.mappedCount}</span>
                           <span>{cat.count}</span>
                       </div>
                       <div className="h-1.5 w-full bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
                           <div 
                             className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-primary'}`}
                             style={{ width: `${percentage}%` }}
                           />
                       </div>
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
