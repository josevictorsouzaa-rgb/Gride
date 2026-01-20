
import React, { useState, useEffect } from 'react';
import { Icon } from '../components/Icon';
import { Screen, Block, User } from '../types';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { EntryModal, ConfirmationModal, GiveUpBlockModal, ScannerModal } from '../components/Modals';
import { api } from '../services/api';

interface ReservedScreenProps {
  onNavigate: (screen: Screen) => void;
  blocks: Block[];
  onStartBlock: (block: Block) => void;
  currentUser: User | null;
  onRefreshCount?: () => void;
}

export const ReservedScreen: React.FC<ReservedScreenProps> = ({ onNavigate, blocks, onStartBlock, currentUser, onRefreshCount }) => {
  const [localBlocks, setLocalBlocks] = useState<Block[]>([]);
  
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [activeBlockId, setActiveBlockId] = useState<string | number | null>(null);
  
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [blockToFinalize, setBlockToFinalize] = useState<Block | null>(null);
  
  const [showGiveUpModal, setShowGiveUpModal] = useState(false);
  const [blockToGiveUp, setBlockToGiveUp] = useState<Block | null>(null);
  const [exitingBlockId, setExitingBlockId] = useState<number | string | null>(null);

  const [showScanner, setShowScanner] = useState(false);
  const [scannedCode, setScannedCode] = useState('');

  // --- CARREGAMENTO INICIAL COM REIDRATAÇÃO ---
  useEffect(() => {
      if (currentUser) {
          api.getReservedBlocks(currentUser.id).then(freshBlocks => {
              // PROCESSAMENTO CRÍTICO: Garantir que o status vindo do JSON seja respeitado
              const initialized = freshBlocks.map(b => ({
                ...b,
                items: b.items.map(i => {
                    const hasStatus = i.status && i.status !== 'pending';
                    const savedQty = i.countedQty !== undefined ? i.countedQty : 0;
                    
                    // Se o item tem status 'counted' mas não tem objeto lastCount (pode acontecer no JSON simplificado)
                    // recriamos o lastCount para que a UI mostre "Em... por..."
                    let rebuiltLastCount = i.lastCount;
                    if (hasStatus && !rebuiltLastCount) {
                        rebuiltLastCount = {
                            user: currentUser.name || 'Você',
                            date: 'Salvo', // Indica que veio do banco
                            qty: savedQty,
                            location: i.location || ''
                        };
                    }

                    return {
                        ...i,
                        status: hasStatus ? i.status : 'pending',
                        countedQty: savedQty,
                        lastCount: rebuiltLastCount
                    };
                })
              }));
              setLocalBlocks(initialized);
          });
      }
  }, [currentUser]);

  const handleOpenCount = (blockId: string | number, item: any) => {
    setActiveBlockId(blockId);
    setSelectedItem(item);
    setScannedCode(''); 
    setShowEntryModal(true);
  };

  const handleOpenDetails = (item: any) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const handleRequestScan = () => {
      setShowEntryModal(false);
      setShowScanner(true);
  };

  const handleScanComplete = (code: string) => {
      setShowScanner(false);
      setScannedCode(code);
      setShowEntryModal(true);
  };

  const handleScannerClose = () => {
      setShowScanner(false);
      if (selectedItem) setShowEntryModal(true);
  };

  const handleConfirmCount = async (qty: number, status: 'counted' | 'not_located' | 'issue', reason?: string) => {
    if (!selectedItem || activeBlockId === null) return;

    let finalStatus: 'counted' | 'not_located' | 'divergence_info' = 'counted';
    let finalQty = qty;

    if (status === 'not_located') {
        finalStatus = 'not_located';
        finalQty = 0; 
    } else if (status === 'issue' || (status === 'counted' && reason && reason.trim().length > 0)) {
        finalStatus = 'divergence_info';
    }

    const finalLocation = scannedCode || selectedItem.lastCount?.location || selectedItem.location || '';

    // 1. ATUALIZA ESTADO LOCAL
    const updatedBlocks = localBlocks.map(block => {
        if (String(block.id) !== String(activeBlockId)) return block;
        
        return {
            ...block,
            items: block.items.map(item => {
                if (item.ref === selectedItem.ref) { 
                    return {
                        ...item,
                        status: finalStatus,
                        countedQty: finalQty,
                        divergenceReason: reason,
                        lastCount: {
                            user: currentUser?.name || 'Você',
                            date: 'Agora',
                            qty: finalQty,
                            location: finalLocation
                        }
                    };
                }
                return item;
            })
        };
    });

    setLocalBlocks(updatedBlocks);

    // 2. SALVA PROGRESSO NO BLOB JSON DA RESERVA (Persistência)
    const activeBlock = updatedBlocks.find(b => String(b.id) === String(activeBlockId));
    if (activeBlock) {
        await api.updateReservationProgress(Number(activeBlockId) || activeBlock.id, activeBlock.items);
    }

    setShowEntryModal(false);
    setSelectedItem(null);
    setScannedCode('');
  };

  const checkBlockCompletion = (block: Block) => {
      return block.items.every((i: any) => i.status !== 'pending');
  };

  const handleRequestFinalize = (block: Block) => {
      setBlockToFinalize(block);
      setShowConfirmModal(true);
  };

  const handleFinalizeConfirm = async () => {
      if (blockToFinalize && currentUser) {
          await api.finalizeBlock({
              block_id: Number(blockToFinalize.id),
              user_id: currentUser.id,
              user_name: currentUser.name,
              items: blockToFinalize.items,
              parent_ref: blockToFinalize.parentRef 
          });
          
          alert(`Bloco ${blockToFinalize.parentRef} finalizado com sucesso!`);
          setLocalBlocks(prev => prev.filter(b => b.id !== blockToFinalize.id));
          if (onRefreshCount) onRefreshCount();
          setShowConfirmModal(false);
      }
  };

  const handleRequestGiveUp = (block: Block) => {
      setBlockToGiveUp(block);
      setShowGiveUpModal(true);
  };

  const handleGiveUpConfirm = async () => {
      if (!blockToGiveUp) return;
      const idToRemove = blockToGiveUp.id;
      setShowGiveUpModal(false);
      setExitingBlockId(idToRemove);
      await api.releaseBlock(Number(idToRemove)); 
      
      setTimeout(() => {
          setLocalBlocks(prev => prev.filter(b => b.id !== idToRemove));
          setExitingBlockId(null);
          setBlockToGiveUp(null);
          if (onRefreshCount) onRefreshCount();
      }, 500); 
  };

  return (
    <div className="relative flex flex-col w-full min-h-screen pb-24 bg-background-light dark:bg-background-dark">
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
          <div className="flex flex-col gap-8 overflow-hidden">
            {localBlocks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-600 border border-dashed border-gray-300 dark:border-card-border rounded-xl animate-fade-in">
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
                    const totalItems = block.items.length;
                    const completedItems = totalItems - pendingCount;
                    const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
                    const isExiting = exitingBlockId === block.id;

                    return (
                    <div 
                        key={block.id} 
                        className={`flex flex-col transition-all duration-500 ease-in-out transform origin-top ${
                            isExiting 
                            ? 'opacity-0 -translate-x-full scale-95 max-h-0 margin-0 overflow-hidden' 
                            : 'opacity-100 translate-x-0 scale-100 max-h-[2000px] animate-fade-in'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-2 px-1">
                            <div className="bg-[#e11d48] text-white text-xs font-bold px-3 py-1 rounded-md uppercase tracking-wider shadow-sm">
                                {block.parentRef}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <Icon name="place" size={14} />
                                {block.location || 'Sem Local'}
                            </div>
                        </div>

                        <div className="px-1 mb-3">
                           <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase mb-1">
                              <span>Progresso</span>
                              <span>{Math.round(progress)}%</span>
                           </div>
                           <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                           </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            {block.items.map((item: any, idx) => {
                                // VERIFICAÇÃO VISUAL RIGOROSA
                                const isCounted = item.status === 'counted';
                                const isIssue = item.status === 'not_located' || item.status === 'issue' || item.status === 'divergence_info';
                                const isProcessed = isCounted || isIssue;
                                const hasDivergenceReason = !!item.divergenceReason;
                                const displayLocation = item.lastCount?.location || item.location || '';

                                return (
                                <div 
                                    key={idx}
                                    onClick={() => handleOpenDetails(item)}
                                    className={`relative rounded-xl p-4 border shadow-sm transition-all overflow-hidden ${
                                        isProcessed 
                                          ? isIssue 
                                            ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30' 
                                            : hasDivergenceReason 
                                              ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800'
                                              : 'bg-green-50 dark:bg-[#064e3b]/30 border-green-200 dark:border-green-900/50' 
                                          : 'bg-white dark:bg-[#1e293b] border-gray-200 dark:border-[#334155]'
                                    }`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`size-12 rounded-lg flex items-center justify-center shrink-0 border ${
                                            isProcessed
                                              ? isIssue
                                                ? 'bg-red-100 dark:bg-red-900/40 text-red-600 border-red-200 dark:border-red-800'
                                                : 'bg-green-100 dark:bg-green-900/40 text-green-600 border-green-200 dark:border-green-800'
                                              : 'bg-gray-100 dark:bg-[#334155] text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600'
                                        }`}>
                                            <Icon name={isProcessed ? (isIssue ? "warning" : "check") : "inventory_2"} size={24} />
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

                                    <div className="my-3 border-t border-dashed border-gray-200 dark:border-[#334155]" />
                                    
                                    <div className="flex items-center gap-2 mb-4">
                                        <Icon name="history" size={16} className="text-gray-400" />
                                        {item.lastCount ? (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Em <strong className="text-gray-700 dark:text-gray-300">{item.lastCount.date}</strong> por {item.lastCount.user} ({item.lastCount.qty} unid.)
                                            </p>
                                        ) : (
                                            <p className="text-xs text-orange-500 font-medium">Nunca foi contado</p>
                                        )}
                                    </div>

                                    <div className="flex items-end justify-between gap-4">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Localização</span>
                                            <span className="text-sm font-bold text-gray-800 dark:text-white">
                                                {displayLocation || <span className="text-gray-400 italic font-normal">Não definida</span>}
                                            </span>
                                        </div>

                                        {isProcessed ? (
                                            <div className="flex flex-col items-end">
                                                {isIssue ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-red-600 bg-red-100 dark:bg-red-900/40 px-2 py-1 rounded">
                                                            Problema
                                                        </span>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenCount(block.id, item);
                                                            }}
                                                            className="size-6 rounded bg-red-200 dark:bg-red-800 flex items-center justify-center text-red-800 dark:text-red-100 hover:bg-red-300 active:scale-95 transition-all shadow-sm"
                                                        >
                                                            <Icon name="edit" size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <span className="text-[10px] font-bold text-green-600 uppercase mb-0.5">Qtd Contada</span>
                                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/40 rounded-lg border border-green-200 dark:border-green-800">
                                                            <span className="font-bold text-green-800 dark:text-green-300 text-sm">
                                                                {item.countedQty} unid.
                                                            </span>
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleOpenCount(block.id, item);
                                                                }}
                                                                className="size-6 rounded bg-green-200 dark:bg-green-800 flex items-center justify-center text-green-800 dark:text-green-100 hover:bg-green-300 active:scale-95 transition-all shadow-sm"
                                                            >
                                                                <Icon name="edit" size={14} />
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
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

                        <div className="mt-4 px-1 flex flex-col gap-3">
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

                            <button 
                                onClick={() => handleRequestGiveUp(block)}
                                className="w-full h-10 border border-red-200 dark:border-red-900/30 text-red-500 dark:text-red-400 rounded-xl font-bold text-xs hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center justify-center gap-2"
                            >
                                <Icon name="backspace" size={16} />
                                Desistir e Devolver Bloco
                            </button>
                        </div>
                        <div className="my-6 border-b border-gray-200 dark:border-white/5 w-full" />
                    </div>
                    );
                })
            )}
          </div>
      </main>

      <EntryModal 
        isOpen={showEntryModal}
        onClose={() => {
            setShowEntryModal(false);
            setScannedCode('');
        }}
        onConfirm={handleConfirmCount}
        onRequestScan={handleRequestScan}
        
        itemName={selectedItem?.name}
        itemSku={selectedItem?.ref}
        itemBrand={selectedItem?.brand}
        systemQuantity={selectedItem?.balance || 0}
        initialCount={selectedItem?.countedQty}
        initialLocation={selectedItem?.lastCount?.location || selectedItem?.location}
        scannedLocation={scannedCode} 
        lastCountInfo={selectedItem?.lastCount}
      />

      <ScannerModal 
        isOpen={showScanner} 
        onClose={handleScannerClose}
        onScanComplete={handleScanComplete}
        title="Validar Localização"
        instruction="Escaneie o QR Code do endereço para liberar a contagem"
      />

      <ItemDetailModal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} item={selectedItem} />
      <ConfirmationModal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} onConfirm={handleFinalizeConfirm} />
      <GiveUpBlockModal isOpen={showGiveUpModal} onClose={() => setShowGiveUpModal(false)} onConfirm={handleGiveUpConfirm} blockName={blockToGiveUp?.parentRef} />
    </div>
  );
};
