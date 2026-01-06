import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Icon } from '../components/Icon';
import { Screen, User } from '../types';
import { CATEGORIES_DATA } from '../data/categories'; // Import centralized data

interface DashboardScreenProps {
  onNavigate: (screen: Screen) => void;
  onCategorySelect: (category: string) => void;
  currentUser: User | null;
  onLogout?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigate, onCategorySelect, currentUser, onLogout }) => {
  const [showAllCategories, setShowAllCategories] = useState(false);
  
  // Detection for Desktop View
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024); // lg breakpoint
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // Use the imported data. 
  // Note: We might want to handle "active" state or sorting here if needed, 
  // but for now we just map the raw data.
  // Let's sort simply by count desc for visual priority if desired, or keep original order.
  const displayedCategories = (isDesktop || showAllCategories) 
    ? CATEGORIES_DATA 
    : CATEGORIES_DATA.slice(0, 6);

  // Mock Issue Count
  const pendingIssuesCount = 3;

  // Mock Goal Data
  const dailyTarget = 150;
  const countedToday = 98;
  const lateCount = 12; // New mock data for Late items
  const totalYearCounted = 24500;
  const progressPercent = Math.min(100, Math.round((countedToday / dailyTarget) * 100));

  const goalData = [
    { name: 'Contado', value: countedToday, color: '#137fec' }, // Blue
    { name: 'Atrasado', value: lateCount, color: '#ef4444' }, // Red
    { name: 'Restante', value: Math.max(0, dailyTarget - countedToday), color: '#33415520' } // Low opacity slate
  ];

  return (
    <div className="relative flex flex-col w-full min-h-screen pb-24 md:pb-0 bg-background-light dark:bg-background-dark md:bg-transparent">
      {/* Header */}
      <header className="flex items-center justify-between bg-background-light dark:bg-background-dark md:bg-transparent p-4 sticky top-0 md:static z-30 border-b md:border-b-0 border-gray-200 dark:border-card-border/30 backdrop-blur-md md:backdrop-blur-none bg-opacity-90 dark:bg-opacity-90">
        <div className="flex items-center gap-3">
          <div className="relative md:hidden">
            <div 
              className="bg-center bg-no-repeat bg-cover rounded-full size-10 border-2 border-primary" 
              style={{ backgroundImage: `url('${currentUser?.avatar || 'https://picsum.photos/100/100'}')` }} 
            />
            <div className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full border-2 border-background-dark" />
          </div>
          <div className="flex flex-col">
            {/* Mobile: Bold Name, Lighter Role */}
            <span className="text-lg font-bold text-gray-900 dark:text-white leading-tight md:hidden">
                Olá, {currentUser?.name.split(' ')[0] || 'Usuário'}
            </span>
            <span className="text-xs font-normal text-text-secondary md:hidden uppercase tracking-wide">
                {currentUser?.role || 'Colaborador'}
            </span>

            {/* Desktop: Standard Header */}
            <div className="hidden md:flex items-center gap-1">
              <h2 className="text-2xl font-bold leading-tight md:text-gray-900 md:dark:text-white">
                {currentUser?.role || 'Colaborador'}
                <span className="text-gray-400 font-normal ml-2 text-lg">| Visão Geral</span>
              </h2>
            </div>
          </div>
        </div>
        
        {/* Mobile Actions: Settings & Logout (Bell Removed) */}
        <div className="flex items-center gap-2 md:hidden">
           {currentUser?.isAdmin && (
             <button 
               onClick={() => onNavigate('settings')}
               className="flex items-center justify-center rounded-full size-10 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
             >
               <Icon name="settings" size={22} />
             </button>
           )}
           <button 
             onClick={onLogout}
             className="flex items-center justify-center rounded-full size-10 bg-gray-100 dark:bg-white/5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
           >
             <Icon name="logout" size={22} />
           </button>
        </div>
        
        {/* Desktop Header Actions */}
        <div className="hidden md:flex items-center gap-4">
            <div className="text-right">
                <p className="text-sm font-bold text-gray-900 dark:text-white">Armazém 04</p>
                <p className="text-xs text-gray-500">Zona B • Setor 2</p>
            </div>
            <button className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20">
                <Icon name="qr_code_scanner" size={20} />
                <span>Scan Rápido</span>
            </button>
        </div>
      </header>

      <main className="flex flex-col gap-6 p-4 md:p-8">
        
        {/* Manager "Treatment" Widget - Visible only for Admin */}
        {currentUser?.isAdmin && (
            <div 
              onClick={() => onNavigate('treatment')}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-4 text-white shadow-lg shadow-orange-500/20 cursor-pointer active:scale-[0.98] transition-all flex items-center justify-between animate-fade-in"
            >
              <div className="flex items-center gap-3">
                 <div className="size-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <Icon name="warning" size={24} className="text-white" />
                 </div>
                 <div>
                    <h3 className="font-bold text-lg leading-none">Pendências de Estoque</h3>
                    <p className="text-xs text-orange-100 mt-1">
                      {pendingIssuesCount} divergências aguardando sua análise.
                    </p>
                 </div>
              </div>
              <div className="flex items-center gap-1 bg-white/20 px-3 py-1.5 rounded-lg backdrop-blur-sm hover:bg-white/30 transition-colors">
                 <span className="text-xs font-bold">Tratar</span>
                 <Icon name="arrow_forward" size={16} />
              </div>
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* GOAL CHART SECTION (Updated) */}
            <section className="lg:col-span-1 lg:order-2">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold">Meta Diária</h2>
                <div className="text-xs font-medium text-text-secondary bg-surface-dark/5 dark:bg-white/5 px-2 py-1 rounded">Hoje</div>
            </div>
            
            <div className="rounded-xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-card-border p-5 flex flex-col justify-between shadow-sm h-[320px] relative">
                
                <div className="flex-1 flex flex-col justify-center items-center relative">
                    <div className="w-full h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={goalData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={65}
                                    outerRadius={85}
                                    startAngle={90}
                                    endAngle={-270}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {goalData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        
                        {/* Center Label */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-bold text-gray-900 dark:text-white">{progressPercent}%</span>
                            <span className="text-xs text-gray-500 font-medium">Concluído</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="flex flex-col items-center p-2 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 mb-1 whitespace-nowrap">Meta Hoje</span>
                        <div className="flex items-baseline gap-0.5">
                            <span className="text-lg font-bold text-primary">{countedToday}</span>
                            <span className="text-[10px] font-medium text-gray-400">/ {dailyTarget}</span>
                        </div>
                    </div>

                     <div className="flex flex-col items-center p-2 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/20">
                        <span className="text-[10px] text-red-600 dark:text-red-400 mb-1 whitespace-nowrap">Atrasados</span>
                        <span className="text-lg font-bold text-red-600 dark:text-red-400">{lateCount}</span>
                    </div>
                    
                    <div className="flex flex-col items-center p-2 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 mb-1 whitespace-nowrap">Qtd Total Ano</span>
                        <span className="text-lg font-bold text-gray-900 dark:text-white">{ (totalYearCounted / 1000).toFixed(1) }k</span>
                    </div>
                </div>

            </div>
            </section>

            {/* Categories Grid - Takes 2 cols on LG */}
            <section className="lg:col-span-2 lg:order-1 flex flex-col">
            <div className="flex items-center justify-between mb-3 h-8">
                <h2 className="text-lg font-bold">Categorias</h2>
                {/* Hide "See all" on desktop because we show all by default */}
                {!isDesktop && (
                  <button 
                  onClick={() => setShowAllCategories(!showAllCategories)}
                  className="text-xs font-medium text-primary hover:text-primary-dark transition-colors px-2 py-1"
                  >
                  {showAllCategories ? 'Ver menos' : 'Ver todas'}
                  </button>
                )}
            </div>
            {/* Responsive Grid: 3 cols mobile, 4 cols tablet, 6 cols desktop */}
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {displayedCategories.map((cat, idx) => {
                  const isActive = cat.label === 'MOTOR'; // Mock active state or pass from props
                  return (
                    <button 
                        key={idx} 
                        onClick={() => onCategorySelect(cat.label)}
                        className={`flex flex-col items-center justify-center aspect-square rounded-xl gap-1 group active:scale-95 hover:scale-105 transition-all ${
                        isActive 
                        ? 'bg-surface-dark border border-primary/50 shadow-[0_0_10px_rgba(19,127,236,0.15)]' 
                        : 'bg-surface-dark border border-card-border hover:border-gray-500 hover:shadow-md'
                    }`}>
                        <Icon name={cat.icon} className={`text-3xl mb-1 ${isActive ? 'text-primary group-hover:scale-110' : 'text-text-secondary group-hover:text-white'} transition-all`} />
                        
                        <div className="flex flex-col items-center leading-none gap-1">
                        <span className={`text-[10px] md:text-xs font-bold text-center px-1 ${isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                            {cat.label}
                        </span>
                        <span className={`text-[10px] md:text-[11px] font-medium text-center ${isActive ? 'text-primary/80' : 'text-text-secondary'}`}>
                            {cat.count} itens
                        </span>
                        </div>
                    </button>
                  );
                })}
            </div>
            </section>
        </div>
      </main>
    </div>
  );
};