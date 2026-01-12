
import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Icon } from '../components/Icon';
import { Screen, User } from '../types';
import { ApiCategory } from '../services/api';
import { AutoPartsLoader } from '../components/AutoPartsLoader';

interface DashboardScreenProps {
  onNavigate: (screen: Screen) => void;
  onCategorySelect: (category: string, dbId: number) => void;
  currentUser: User | null;
  onLogout?: () => void;
  categories: ApiCategory[]; 
}

const getInitials = (name: string) => {
    return name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'US';
};

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ 
  onNavigate, 
  onCategorySelect, 
  currentUser, 
  onLogout, 
  categories 
}) => {
  // Use AutoPartsLoader when categories are not yet loaded
  if (!categories || !Array.isArray(categories) || categories.length === 0) { 
      return <AutoPartsLoader message="Carregando Categorias..." fullScreen={false} />;
  }

  const [showAllCategories, setShowAllCategories] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  const displayedCategories = (isDesktop || showAllCategories) 
    ? (categories || []) 
    : (categories || []).slice(0, 6);

  const pendingIssuesCount = 3;
  const dailyTarget = 150;
  const countedToday = 98;
  const lateCount = 12; 
  const totalYearCounted = 24500;
  const progressPercent = Math.min(100, Math.round((countedToday / dailyTarget) * 100));

  const goalData = [
    { name: 'Contado', value: countedToday, color: '#137fec' },
    { name: 'Atrasado', value: lateCount, color: '#ef4444' },
    { name: 'Restante', value: Math.max(0, dailyTarget - countedToday), color: '#33415520' }
  ];

  return (
    <div className="relative flex flex-col w-full min-h-screen pb-24 md:pb-0 bg-background-light dark:bg-background-dark md:bg-transparent">
      {/* Header */}
      <header className="flex items-center justify-between bg-background-light dark:bg-background-dark md:bg-transparent p-4 sticky top-0 md:static z-30 border-b md:border-b-0 border-gray-200 dark:border-card-border/30 backdrop-blur-md md:backdrop-blur-none bg-opacity-90 dark:bg-opacity-90">
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
               className="flex items-center justify-center rounded-full size-10 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10