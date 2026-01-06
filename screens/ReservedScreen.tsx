import React, { useState, useEffect } from 'react';
import { Icon } from '../components/Icon';
import { Screen, Block } from '../types';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { EntryModal, ConfirmationModal } from '../components/Modals';

interface ReservedScreenProps {
  onNavigate: (screen: Screen) => void;
  blocks: Block[];
  onStartBlock: (block: Block) => void; // Kept for signature compatibility but used for finalizing
}

export const ReservedScreen: React.FC<ReservedScreenProps> = ({ onNavigate, blocks, onStartBlock }) => {
  // Local state to manage counting progress without navigating away
  const [localBlocks, setLocalBlocks] = useState<Block[]>([]);
  
  // Modals State
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [activeBlockId, setActiveBlockId] = useState<number | null>(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [blockToFinalize, setBlockToFinalize] = useState<Block | null>(null);

  // Initialize local state with props, adding internal status control if needed
  useEffect(() => {
    // Deep copy to allow local mutation of status/qty
    const initialized = blocks
      .filter(b => b.status === 'progress')
      .map(b => ({
        ...b,
        items: b.items.map(i => ({
            ...i,
            // If item doesn't have status, default to pending
            status: i.status || 'pending',
            countedQty: i.countedQty || 0
        }))
      }));
    setLocalBlocks(initialized);
  }, [blocks]);

  const handleOpenCount = (blockId: number, item: any) => {
    setActiveBlockId(blockId);
    setSelectedItem(item);
    setShowEntryModal(true);
  };

  const handleOpenDetails = (item: any) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const handleConfirmCount = (qty: number, status: 'counted' | 'not_located' | 'divergence_info', reason?: string) => {
    if (!selectedItem || activeBlockId === null) return;

    setLocalBlocks(prev => prev.map(block => {
        if (block.id !== activeBlockId) return block;
        
        return {
            ...block,
            items: block.items.map(item => {
                // FIX: Use ref (SKU) as unique identifier instead of name to prevent updating duplicates
                if (item.ref === selectedItem.ref) { 
                    return {
                        ...item,
                        status: status,
                        countedQty: qty,
                        divergenceReason: reason,
                        // Update lastCount immediately for visual feedback
                        lastCount: {
                            user: 'Você',
                            date: 'Agora',
                            qty: qty
                        }
                    };
                }
                return item;
            })
        };
    }));

    setShowEntryModal(false);
    setSelectedItem(null);
  };

  const checkBlockCompletion = (block: Block) => {
      return block.items.every((i: any) => i.status !== 'pending');
  };

  const handleRequestFinalize = (block: Block) => {
      setBlockToFinalize(block);
      setShowConfirmModal(true);
  };

  const handleFinalizeConfirm = () => {
      if (blockToFinalize) {
          // In a real app, this would call an API
          // For now, we simulate success and maybe remove from list or navigate
          // onStartBlock prop can be used as "onFinalize"
          alert(`Bloco ${blockToFinalize.parentRef} finalizado com sucesso!`);
          
          // Remove from local list to simulate completion
          setLocalBlocks(prev => prev.filter(b => b.id !== blockToFinalize.id));
          setShowConfirmModal(false);
      }
  };

  return (
    <div className="relative flex flex-col w-full min-h-screen pb-24 bg-background-light dark:bg-background-dark">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background-light dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-card-border">
        <div className="flex items-center p-4 justify-between gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-primary">
               <Icon name="assignment" size={24} />
          </div>
          
          <div className="flex-1 text-center pr-10">
            <h2 className="text-lg font-bold leading-tight">Meus Reservados</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Tarefas em andamento</p>
          </div>
        </div>
      </div>

      <main className="flex flex-col gap-6 p-4">
          {/* Foco Banner */}
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4 flex items-start gap-3">
            <div className="bg-blue-100 dark:bg-blue-800 p-2 rounded-full text-blue-600 dark:text-blue-300">
                <Icon name="priority_high" size={20} />
            </div>
            <div>
                <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-1">Modo Foco</h3>
                <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                    Conclua as contagens abaixo diretamente nesta tela para liberar novos blocos.
                </p>
            </div>
          </div>

          <div className="flex flex-col gap-8">
            {localBlocks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-600 border border-dashed border-gray-300 dark:border-card-border rounded-xl">
                    <Icon name="playlist_add_check" size={64} className="mb-4 opacity-30" />
                    <p className="text-base font-medium text-center max-w-[220px]">
                        Você não possui itens reservados no momento.
                    </p>
                    <button 
                        onClick={() => onNavigate('dashboard')}
                        className="mt-6 px-6 py-3 bg-primary text-white rounded-xl text-sm font-bold shadow-lg hover:bg-primary-dark transition-all"
                    >
                        Buscar no Hub
                    </button>
                </div>
            ) : (
                localBlocks.map((block) => {
                    const isComplete = checkBlockCompletion(block);
                    const pendingCount = block.items.filter((i: any) => i.status === 'pending').length;

                    return (
                    <div key={block.id} className="flex flex-col animate-fade-in">
                        
                        {/* Block Header */}
                        <div className="flex items-center justify-between mb-2 px-1">
                            <div className="bg-[#e11d48] text-white text-xs font-bold px-3 py-1 rounded-md uppercase tracking-wider shadow-sm">
                                {block.parentRef}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <Icon name="place" size={14} />
                                {block.location}
                            </div>
                        </div>

                        {/* Items List (Card Style Requested) */}
                        <div className="flex flex-col gap-3">
                            {block.items.map((item: any, idx) => {
                                const isCounted = item.status !== 'pending';
                                
                                return (
                                <div 
                                    key={idx}
                                    onClick={() => handleOpenDetails(item)}
                                    className={`relative rounded-xl p-4 border shadow-sm transition-all overflow-hidden ${
                                        isCounted 
                                          ? 'bg-green-50 dark:bg-[#064e3b]/30 border-green-200 dark:border-green-900/50' 
                                          : 'bg-white dark:bg-[#1e293b] border-gray-200 dark:border-[#334155]'
                                    }`}
                                >
                                    {/* Top Row: Icon + Names */}
                                    <div className="flex items-start gap-4">
                                        <div className={`size-12 rounded-lg flex items-center justify-center shrink-0 border ${
                                            isCounted
                                              ? 'bg-green-100 dark:bg-green-900/40 text-green-600 border-green-200 dark:border-green-800'
                                              : 'bg-gray-100 dark:bg-[#334155] text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600'
                                        }`}>
                                            <Icon name={isCounted ? "check" : "inventory_2"} size={24} />
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-base font-extrabold text-gray-900 dark:text-white leading-tight">
                                                {item.name}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                                <span className="text-xs font-mono text-gray-500 dark:text-[#94a3b8]">
                                                    SKU: {item.ref}
                                                </span>
                                                <span className="size-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                                                <span className="text-xs font-bold text-gray-500 dark:text-[#94a3b8] uppercase">
                                                    {item.brand}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Middle: Dashed Divider & History */}
                                    <div className="my-3 border-t border-dashed border-gray-200 dark:border-[#334155]" />
                                    
                                    <div className="flex items-center gap-2 mb-4">
                                        <Icon name="history" size={16} className="text-gray-400" />
                                        {item.lastCount ? (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Em <strong className="text-gray-700 dark:text-gray-300">{item.lastCount.date}</strong> por {item.lastCount.user} ({item.lastCount.qty} un)
                                            </p>
                                        ) : (
                                            <p className="text-xs text-orange-500 font-medium">Nunca contado</p>
                                        )}
                                    </div>

                                    {/* Bottom: Location & Action Button */}
                                    <div className="flex items-end justify-between gap-4">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Localização</span>
                                            <span className="text-sm font-bold text-gray-800 dark:text-white">{block.location}</span>
                                        </div>

                                        {isCounted ? (
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] font-bold text-green-600 uppercase mb-0.5">Qtd Contada</span>
                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/40 rounded-lg border border-green-200 dark:border-green-800">
                                                    <span className="font-bold text-green-800 dark:text-green-300 text-sm">
                                                        {item.countedQty} un
                                                    </span>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenCount(block.id, item);
                                                        }}
                                                        className="size-6 rounded bg-green-200 dark:bg-green-800 flex items-center justify-center text-green-800 dark:text-green-100 hover:bg-green-300"
                                                    >
                                                        <Icon name="edit" size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenCount(block.id, item);
                                                }}
                                                className="bg-primary hover:bg-primary-dark active:scale-95 transition-all text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-lg shadow-primary/20"
                                            >
                                                Inserir Contagem
                                                <Icon name="edit" size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                );
                            })}
                        </div>

                        {/* Block Footer Actions */}
                        <div className="mt-4 px-1">
                            {isComplete ? (
                                <button 
                                    onClick={() => handleRequestFinalize(block)}
                                    className="w-full h-14 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 animate-bounce-subtle"
                                >
                                    <span>Finalizar Bloco</span>
                                    <Icon name="check_circle" size={24} />
                                </button>
                            ) : (
                                <div className="w-full h-12 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 flex items-center justify-center gap-2 text-gray-400 dark:text-gray-500 font-bold text-sm">
                                    <Icon name="pending" size={18} />
                                    <span>Resta contar {pendingCount} item(s)</span>
                                </div>
                            )}
                        </div>

                        <div className="my-6 border-b border-gray-200 dark:border-white/5 w-full" />
                    </div>
                    );
                })
            )}
          </div>
      </main>

      {/* Entry Modal for Counting */}
      <EntryModal 
        isOpen={showEntryModal}
        onClose={() => setShowEntryModal(false)}
        onConfirm={handleConfirmCount}
        itemName={selectedItem?.name}
        itemSku={selectedItem?.ref}
        initialQuantity={selectedItem?.countedQty || selectedItem?.balance || 1}
        lastCountInfo={selectedItem?.lastCount}
      />

      {/* Detail Modal (View Only) */}
      <ItemDetailModal 
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        item={selectedItem}
      />

      {/* Confirmation Finalize */}
      <ConfirmationModal 
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleFinalizeConfirm}
      />
    </div>
  );
};
