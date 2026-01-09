
import React, { useState, useMemo } from 'react';
import { Icon } from '../components/Icon';
import { Screen, Block } from '../types';
import { ItemDetailModal } from '../components/ItemDetailModal';

interface ListScreenProps {
  onNavigate: (screen: Screen) => void;
  blocks: Block[];
  segmentFilter: string | null;
  onReserveBlock: (id: number) => void;
  onClearFilter: () => void;
  mode?: 'daily_meta' | 'browse'; 
}

// Helper to calculate days since a date string
const getDaysSince = (dateStr?: string): number => {
  if (!dateStr) return 9999; 
  if (dateStr.toLowerCase().includes('hoje')) return 0;
  if (dateStr.toLowerCase().includes('ontem')) return 1;
  const parts = dateStr.split('/');
  if (parts.length === 2) {
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; 
    const now = new Date();
    const countDate = new Date(now.getFullYear(), month, day);
    const diffTime = Math.abs(now.getTime() - countDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  }
  return 0;
};

type TimeFilter = 'all' | '7_days' | '15_days' | '30_days' | 'never';

export const ListScreen: React.FC<ListScreenProps> = ({ 
  onNavigate, 
  blocks, 
  segmentFilter, 
  onReserveBlock,
  onClearFilter,
  mode = 'daily_meta' 
}) => {
  const [showAllBlocks, setShowAllBlocks] = useState(false);
  const [expandedBlocks, setExpandedBlocks] = useState<number[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  
  const [searchText, setSearchText] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  const toggleBlock = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedBlocks(prev => prev.includes(id) ? prev.filter(blockId => blockId !== id) : [...prev, id]);
  };

  const handleReserve = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onReserveBlock(id);
  };

  const filteredBlocks = useMemo(() => {
    return blocks.filter(block => {
      // Allow 'progress' if it's locked, logic handled in UI render
      if (mode === 'daily_meta') {
        if (block.status === 'completed') return false; 
      }
      if (searchText) {
           const lowerSearch = searchText.toLowerCase();
           const matchesItems = block.items.some(item => item.name.toLowerCase().includes(lowerSearch) || item.ref.toLowerCase().includes(lowerSearch));
           const matchesLoc = block.location.toLowerCase().includes(lowerSearch);
           if (!matchesItems && !matchesLoc) return false;
      }
      return true;
    });
  }, [blocks, segmentFilter, searchText, timeFilter, mode]);

  const displayedBlocks = showAllBlocks ? filteredBlocks : filteredBlocks.slice(0, 20);

  return (
    <div className="relative flex flex-col w-full min-h-screen pb-24 md:pb-0 bg-background-light dark:bg-background-dark md:bg-transparent">
      {/* Header (Simplified) */}
      <div className="sticky top-0 z-20 bg-background-light dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-card-border p-4">
          <h2 className="text-lg font-bold">{mode === 'daily_meta' ? 'Meta Diária' : 'Explorar'}</h2>
          <div className="mt-2 flex w-full items-stretch rounded-xl h-11 bg-white dark:bg-surface-dark border border-gray-100 dark:border-white/5">
              <div className="flex items-center justify-center pl-4 text-gray-400"><Icon name="search" size={20} /></div>
              <input className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-3 placeholder-gray-400 text-gray-900 dark:text-white" placeholder="Buscar..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
          </div>
      </div>

      <main className="flex flex-col gap-4 p-4 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredBlocks.length === 0 ? <div className="col-span-full py-12 text-center text-gray-400">Nenhum bloco encontrado.</div> : (
                displayedBlocks.map((block) => {
                  const isExpanded = expandedBlocks.includes(block.id);
                  const visibleItems = isExpanded ? block.items : block.items.slice(0, 3);
                  const hiddenCount = block.items.length - 3;
                  const isLocked = !!block.lockedBy;

                  return (
                    <div key={block.id} className={`bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-card-border shadow-sm p-4 flex flex-col gap-3 animate-fade-in ${isLocked ? 'opacity-80 border-l-4 border-l-red-500' : ''}`}>
                      <div className="flex justify-between items-start">
                          <div>
                             <h3 className="font-bold text-gray-900 dark:text-white text-base leading-tight">{block.parentRef}</h3>
                             <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><Icon name="place" size={12} /> {block.location}</p>
                          </div>
                          {isLocked && block.lockedBy && (
                              <div className="flex flex-col items-end">
                                  <div className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 rounded text-red-600 dark:text-red-400">
                                      <Icon name="lock" size={14} fill />
                                      <span className="text-[10px] font-bold uppercase">Reservado</span>
                                  </div>
                                  <p className="text-[9px] text-gray-500 mt-1">por {block.lockedBy.userName}</p>
                              </div>
                          )}
                      </div>

                      <div className="bg-gray-50 dark:bg-black/20 rounded-lg p-2 space-y-1">
                          {visibleItems.map((item: any, idx: number) => (
                              <div key={idx} className="flex flex-col gap-1 p-2 border-b border-gray-200/50 dark:border-white/5 last:border-0">
                                  <span className="font-bold text-sm text-gray-800 dark:text-gray-200 leading-tight">{item.name}</span>
                                  <div className="flex items-center gap-2 mt-0.5">
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-white dark:bg-white/10 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/5">{item.ref}</span>
                                      <span className="ml-auto text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{item.balance} un</span>
                                  </div>
                              </div>
                          ))}
                          {hiddenCount > 0 && !isExpanded && <button onClick={(e) => toggleBlock(block.id, e)} className="w-full text-center text-xs font-bold text-primary py-2">Ver mais {hiddenCount} itens</button>}
                      </div>

                      <button 
                        onClick={(e) => !isLocked && handleReserve(block.id, e)}
                        disabled={isLocked}
                        className={`w-full h-10 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-all ${
                            isLocked 
                            ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed' 
                            : 'bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white active:scale-95'
                        }`}
                      >
                         {isLocked ? 'Bloqueado' : 'Reservar'}
                         <Icon name={isLocked ? "lock" : "lock_open"} size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
      </main>
      <ItemDetailModal isOpen={!!selectedItem} onClose={() => setSelectedItem(null)} item={selectedItem} />
    </div>
  );
};
