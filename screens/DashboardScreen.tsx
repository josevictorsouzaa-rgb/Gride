
import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Icon } from '../components/Icon';
import { Screen, User } from '../types';
import { api, ApiCategory, MetaStatus } from '../services/api';
import { AutoPartsLoader } from '../components/AutoPartsLoader';
import { getSettings } from '../data/settingsStore';

interface DashboardScreenProps {
  onNavigate: (screen: Screen) => void;
  onCategorySelect: (category: string, dbId: number) => void;
  currentUser: User | null;
  onLogout?: () => void;
  categories: ApiCategory[]; 
  treatmentCount?: number; 
}

const getInitials = (name: string) => {
    return name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'US';
};

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ 
  onNavigate, 
  onCategorySelect, 
  currentUser, 
  onLogout, 
  categories,
  treatmentCount = 0
}) => {
  if (!categories || !Array.isArray(categories) || categories.length === 0) { 
      return <AutoPartsLoader message="Carregando Categorias..." fullScreen={false} />;
  }

  const [showAllCategories, setShowAllCategories] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [metaStatus, setMetaStatus] = useState<MetaStatus>({ dailyTarget: 150, countedToday: 0, accumulatedPending: 0 });

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    
    // --- LOAD REAL DATA FROM API ---
    const loadStatus = async () => {
        const settings = getSettings();
        // Chama a API com parametros salvos
        const status = await api.getDailyMetaStatus(settings.dailyTarget, settings.accumulationMode);
        setMetaStatus(status);
    };
    loadStatus();

    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  const displayedCategories = (isDesktop || showAllCategories) ? categories : categories.slice(0, 6);

  const { dailyTarget, countedToday, accumulatedPending } = metaStatus;
  
  // Lógica de Visualização do Gráfico
  // Se houver acumulado, o total visual é Meta + Acumulado
  const effectiveTarget = dailyTarget + accumulatedPending;
  const progressPercent = effectiveTarget > 0 ? Math.min(100, Math.round((countedToday / effectiveTarget) * 100)) : 0;
  
  // Cálculo do restante do dia (não pode ser negativo)
  // Se contagem > acumulado, abater do acumulado primeiro visualmente? Não, simplifica.
  // Gráfico:
  // 1. Contado (Azul)
  // 2. Acumulado Pendente (Vermelho) - Representa o que falta do passado
  // 3. Restante Hoje (Cinza) - O que falta da meta original de hoje
  
  // Ajuste para não quebrar o gráfico se a contagem superar tudo
  const pendingAccumulated = Math.max(0, accumulatedPending); 
  const remainingToday = Math.max(0, dailyTarget - Math.max(0, countedToday - accumulatedPending)); // Simplificação visual

  const goalData = [
    { name: 'Contado', value: countedToday, color: '#137fec' }, // Azul/Verde
    { name: 'Acumulado', value: pendingAccumulated, color: '#ef4444' }, // Vermelho
    { name: 'Restante', value: Math.max(0, effectiveTarget - countedToday - pendingAccumulated), color: '#33415520' } // Cinza Fundo
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
            <div className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full border-2 border-background-dark animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-gray-900 dark:text-white leading-tight md:hidden">
                Olá, {currentUser?.name.split(' ')[0] || 'Usuário'}
            </span>
            <span className="text-xs font-normal text-text-secondary md:hidden uppercase tracking-wide">
                {currentUser?.role || 'Colaborador'}
            </span>

            <div className="hidden md:flex items-center gap-1">
              <h2 className="text-2xl font-bold leading-tight md:text-gray-900 md:dark:text-white">
                {currentUser?.role || 'Colaborador'}
                <span className="text-gray-400 font-normal ml-2 text-lg">| Visão Geral</span>
              </h2>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:hidden">
           {currentUser?.isAdmin && (
             <button 
               onClick={() => onNavigate('settings')}
               className="flex items-center justify-center rounded-full size-10 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
             >
                <Icon name="settings" size={24} />
             </button>
           )}
        </div>
      </header>

      <main className="flex flex-col p-4 md:px-8 md:pb-8 gap-6 md:grid md:grid-cols-3">
        
        {/* KPI: Daily Goal Card */}
        <div 
            onClick={() => onNavigate('list')}
            className="md:col-span-1 bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-200 dark:border-card-border p-5 relative overflow-hidden group hover:border-primary/50 transition-all duration-300 cursor-pointer hover:shadow-md"
        >
           <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="flex flex-col">
                 <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                     {accumulatedPending > 0 ? 'Meta + Acumulado' : 'Meta Diária'}
                 </h3>
                 <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{countedToday}</p>
                    <span className="text-lg text-gray-400 font-medium">/ {effectiveTarget}</span>
                 </div>
                 {accumulatedPending > 0 && (
                     <span className="text-[10px] font-bold text-red-500 bg-red-100 dark:bg-red-900/20 px-2 py-0.5 rounded-full w-fit mt-1">
                         +{accumulatedPending} Pendentes Anteriores
                     </span>
                 )}
              </div>
              <div className="size-16">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={goalData}
                        innerRadius={20}
                        outerRadius={30}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {goalData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                 </ResponsiveContainer>
              </div>
           </div>
           
           <div className="relative z-10">
              <div className="flex justify-between text-xs font-semibold mb-1">
                 <span className="text-gray-600 dark:text-gray-300">Progresso Real</span>
                 <span className="text-primary">{progressPercent}%</span>
              </div>
              <div className="h-2 w-full bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                 <div className="h-full bg-primary rounded-full transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }} />
              </div>
           </div>
        </div>

        {/* KPI: Issues Card */}
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

        {/* KPI: Total Year */}
        <div className="md:col-span-1 bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-200 dark:border-card-border p-5 relative overflow-hidden group hover:border-green-400/50 transition-colors duration-300">
             <div className="flex justify-between items-start mb-2 relative z-10">
                <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                   <Icon name="bar_chart" />
                </div>
             </div>
             <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">24.5k</h3>
             <p className="text-xs text-gray-500 font-medium">Itens contados este ano</p>
        </div>

        {/* Categories Section */}
        <div className="md:col-span-3">
           <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Categorias</h2>
              {!isDesktop && (
                <button 
                  onClick={() => setShowAllCategories(!showAllCategories)}
                  className="text-xs font-bold text-primary hover:text-primary-dark transition-colors"
                >
                  {showAllCategories ? 'Ver menos' : 'Ver todas'}
                </button>
              )}
           </div>
           
           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {displayedCategories.map((cat, idx) => (
                <button
                  key={cat.id || idx}
                  onClick={() => onCategorySelect(cat.label, cat.db_id)}
                  className="flex flex-col items-center justify-center p-4 rounded-xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-card-border shadow-sm hover:shadow-md hover:border-primary/50 hover:-translate-y-1 transition-all duration-300 group"
                >
                   <div className="size-12 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-gray-400 mb-3 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <Icon name={cat.icon || 'inventory_2'} size={24} />
                   </div>
                   <span className="text-xs font-bold text-gray-700 dark:text-gray-300 text-center uppercase tracking-tight group-hover:text-primary transition-colors line-clamp-1">
                      {cat.label}
                   </span>
                   <span className="text-xs text-gray-400 mt-1 font-medium bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-full">
                      {cat.count} itens
                   </span>
                </button>
              ))}
           </div>
        </div>

      </main>
    </div>
  );
};
