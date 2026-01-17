
import React from 'react';
import { Icon } from '../components/Icon';
import { ApiCategory } from '../services/api';

interface SubcategoriesScreenProps {
  categoryLabel: string;
  categories: ApiCategory[];
  onBack: () => void;
  onSelectSegment: (segment: string, sgId: number) => void;
}

export const SubcategoriesScreen: React.FC<SubcategoriesScreenProps> = ({ 
  categoryLabel, 
  categories, 
  onBack, 
  onSelectSegment 
}) => {
  const categoryData = categories.find(c => c.label === categoryLabel);
  const items = categoryData ? categoryData.subcategories : [];

  return (
    <div className="relative flex flex-col w-full min-h-screen pb-24 bg-background-light dark:bg-background-dark">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center gap-4 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm p-4 border-b border-gray-200 dark:border-card-border">
        <button 
          onClick={onBack}
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
        >
          <Icon name="arrow_back" size={24} />
        </button>
        <div>
          <h2 className="text-lg font-bold leading-tight text-gray-900 dark:text-white">{categoryLabel}</h2>
          <p className="text-xs text-gray-500">Selecione uma área para contar</p>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 flex flex-col gap-3">
        {items.map((sub) => {
          const percent = sub.count > 0 ? Math.round((sub.mappedCount / sub.count) * 100) : 0;
          const isComplete = percent >= 100;

          return (
          <button 
            key={sub.id}
            onClick={() => onSelectSegment(sub.name, sub.db_id)}
            className={`flex items-center p-4 rounded-xl border shadow-sm transition-all active:scale-[0.98] group text-left ${
                isComplete 
                ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30' 
                : 'bg-white dark:bg-surface-dark border-gray-200 dark:border-card-border hover:border-primary/50'
            }`}
          >
            {/* Icon Box */}
            <div className={`flex size-12 shrink-0 items-center justify-center rounded-lg mr-4 transition-colors ${
                isComplete ? 'bg-green-100 text-green-600' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 group-hover:bg-primary/10 group-hover:text-primary'
            }`}>
              <Icon name={isComplete ? 'check' : sub.icon} size={24} />
            </div>

            {/* Text & Progress */}
            <div className="flex-1 min-w-0">
               <div className="flex justify-between items-center mb-1">
                   <h3 className={`text-sm font-bold truncate ${isComplete ? 'text-green-800 dark:text-green-200' : 'text-gray-900 dark:text-white'}`}>
                       {sub.name}
                   </h3>
                   <span className={`text-xs font-bold ${isComplete ? 'text-green-600' : 'text-gray-400'}`}>
                       {percent}%
                   </span>
               </div>
               
               <div className="flex items-center gap-3">
                   <div className="flex-1 h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                       <div className={`h-full rounded-full ${isComplete ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${percent}%` }} />
                   </div>
                   <div className="text-[10px] text-gray-500 font-mono whitespace-nowrap">
                       {sub.mappedCount} / {sub.count}
                   </div>
               </div>
            </div>

            <Icon name="chevron_right" className="ml-2 text-gray-300 group-hover:text-primary" size={20} />
          </button>
          );
        })}
      </main>
    </div>
  );
};
