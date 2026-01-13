import React from 'react';
import { Icon } from './Icon';
import { Screen } from '../types';

interface BottomNavProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  onScanClick: () => void;
  isAdmin?: boolean;
  reservedCount?: number; // New prop for badge
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentScreen, onNavigate, onScanClick, isAdmin, reservedCount = 0 }) => {
  const navItems = [
    { id: 'dashboard', label: 'Hub', icon: 'grid_view' },
    { id: 'list', label: 'Meta', icon: 'checklist' },
    { id: 'scan', label: '', icon: 'qr_code_scanner', isFab: true },
    { id: 'history', label: 'Histórico', icon: 'history' },
    // Both Admin and Normal users now see 'Reserved' here. 
    // Admin accesses Treatment via the Dashboard card.
    { id: 'reserved', label: 'Reservados', icon: 'assignment' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 w-full max-w-lg mx-auto bg-white dark:bg-surface-dark border-t border-slate-200 dark:border-card-border pb-safe pt-2 px-2 z-40 shadow-[0_-5px_15px_rgba(0,0,0,0.1)]">
      <div className="flex items-end justify-between h-16 pb-2">
        {navItems.map((item) => {
          if (item.isFab) {
            return (
              <div key={item.id} className="relative -top-6">
                <button 
                  onClick={onScanClick} 
                  className="flex items-center justify-center size-16 rounded-2xl bg-primary text-white shadow-[0_4px_15px_rgba(19,127,236,0.4)] border-4 border-background-light dark:border-background-dark hover:scale-105 active:scale-95 transition-all group"
                >
                  <Icon name={item.icon} size={32} />
                  <div className="absolute inset-0 border-2 border-white/30 rounded-xl scale-0 group-active:scale-100 transition-transform duration-300" />
                </button>
              </div>
            );
          }

          const isActive = currentScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id as Screen);
              }}
              className={`relative flex flex-1 flex-col items-center gap-1 transition-colors ${
                isActive ? 'text-primary' : 'text-slate-400 dark:text-text-secondary hover:text-slate-600 dark:hover:text-white'
              }`}
            >
              <div className="relative">
                <Icon name={item.icon} fill={isActive} />
                {/* Badge for Reserved items */}
                {item.id === 'reserved' && reservedCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white border border-white dark:border-surface-dark animate-fade-in">
                    {reservedCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};