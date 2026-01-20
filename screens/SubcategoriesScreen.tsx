
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
  // Trava de segurança solicitada
  if (!categories || !Array.isArray(categories)) return null;


  // Find the category object in our passed props
  const categoryData = categories.find(c => c.label === categoryLabel);
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
              <h2 className="text-lg font-bold leading-tight">{categoryLabel}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Selecionar Subcategoria</p>
            </div>
         </div>
         <button className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:text-primary transition-colors">
            <Icon name="search" size={24} />
         </button>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 md:p-8">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 text-gray-400">
            <Icon name="folder_off" size={64} className="mb-4 opacity-50" />
            <p>Nenhuma subcategoria encontrada.</p>
          </div>
        ) : (
          /* GRID RESPONSIVO: 1 coluna no mobile, 2 no tablet, 3 no desktop, 4 no ultrawide */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5">
            {items.map((sub, idx) => {
              const progress = sub.count > 0 ? (sub.mappedCount / sub.count) * 100 : 0;
              
              return (
              <button 
                key={sub.id || idx}
                onClick={() => onSelectSegment(sub.name, sub.db_id)}
                className="flex items-center p-4 bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-card-border shadow-sm hover:border-primary/50 hover:shadow-md transition-all active:scale-[0.98] group relative overflow-hidden"
              >
                {/* Efeito Hover sutil no background */}
                <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors duration-300" />

                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 group-hover:bg-white group-hover:text-primary transition-colors shadow-sm border border-gray-200 dark:border-white/5">
                  <Icon name={sub.icon} size={28} />
                </div>
                
                <div className="relative flex flex-col items-start ml-4 flex-1 min-w-0 pr-2">
                   <h3 className="text-base font-bold text-gray-900 dark:text-white truncate w-full text-left leading-tight group-hover:text-primary transition-colors">
                       {sub.name}
                   </h3>
                   
                   {/* Barra de Progresso */}
                   <div className="w-full mt-3">
                        <div className="flex justify-between items-center text-[10px] text-gray-500 dark:text-gray-400 mb-1.5 font-medium w-full">
                            <span>
                                <strong className="text-gray-700 dark:text-gray-300">{sub.mappedCount}</strong>/{sub.count}
                            </span>
                            <span className={`font-bold ${progress >= 100 ? 'text-green-600' : 'text-primary'}`}>
                                {Math.round(progress)}%
                            </span>
                        </div>
                        <div className="h-2 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden border border-black/5 dark:border-white/5">
                            <div 
                                className={`h-full rounded-full transition-all duration-500 ${progress >= 100 ? 'bg-green-500' : 'bg-primary'}`} 
                                style={{ width: `${progress}%` }} 
                            />
                        </div>
                   </div>
                </div>
                
                <Icon name="chevron_right" className="relative text-gray-300 dark:text-gray-600 group-hover:text-primary shrink-0 group-hover:translate-x-1 transition-transform" size={24} />
              </button>
            )})}
          </div>
        )}
      </main>
    </div>
  );
};
