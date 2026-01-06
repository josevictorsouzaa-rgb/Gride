import React from 'react';
import { Icon } from '../components/Icon';
import { Screen } from '../types';
import { CATEGORIES_DATA } from '../data/categories';

interface SubcategoriesScreenProps {
  category: string;
  onBack: () => void;
  onSelectSegment: (segment: string) => void;
}

export const SubcategoriesScreen: React.FC<SubcategoriesScreenProps> = ({ category, onBack, onSelectSegment }) => {
  // Find the category object in our centralized data
  const categoryData = CATEGORIES_DATA.find(c => c.label === category);
  const items = categoryData ? categoryData.subcategories : [];

  return (
    <div className="relative flex flex-col w-full min-h-screen pb-24 bg-background-light dark:bg-background-dark">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm p-4 border-b border-gray-200 dark:border-gray-800">
         <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-surface-dark transition-colors"
            >
              <Icon name="arrow_back" size={24} />
            </button>
            <div>
              <h2 className="text-lg font-bold leading-tight">{category}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Selecionar Subcategoria</p>
            </div>
         </div>
         <button className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:text-primary transition-colors">
            <Icon name="search" size={24} />
         </button>
      </header>

      {/* Content */}
      <main className="flex-1 p-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 text-gray-400">
            <Icon name="folder_off" size={64} className="mb-4 opacity-50" />
            <p>Nenhuma subcategoria encontrada.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {items.map((sub, idx) => (
              <button 
                key={sub.id || idx}
                onClick={() => onSelectSegment(sub.name)}
                className="flex items-center p-4 bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-card-border shadow-sm hover:border-primary/50 transition-all active:scale-[0.98] group"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <Icon name={sub.icon} size={24} />
                </div>
                <div className="flex flex-col items-start ml-4 flex-1">
                   <h3 className="text-base font-semibold text-gray-900 dark:text-white">{sub.name}</h3>
                   <p className="text-xs text-gray-500 dark:text-gray-400">{sub.count} itens cadastrados</p>
                </div>
                <Icon name="chevron_right" className="text-gray-300 dark:text-gray-600 group-hover:text-primary" size={24} />
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};