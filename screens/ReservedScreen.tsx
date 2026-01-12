
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
  const [activeBlockId, setActiveBlockId] = useState<number | null>(null);
  
  // Modals States
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [blockToFinalize, setBlockToFinalize] = useState<Block | null>(null);
  
  // States for Giving Up (Desistir)
  const [showGiveUpModal, setShowGiveUpModal] = useState(false);
  const [blockToGiveUp, setBlockToGiveUp] = useState<Block | null>(null);
  
  // State for Animation
  const [exitingBlockId, setExitingBlockId] = useState<number | null>(null);

  // States for Scanning within Count Flow
  const [showScanner, setShowScanner] = useState(false);
  const [scannedCode, setScannedCode] = useState('');

  useEffect(() => {
    // Ensures status fields are populated correctly from props to prevent stale empty bars
    const initialized = blocks
      .filter(b => b.status === 'progress')
      .map(b => ({
        ...b,
        items: b.items.map(i => ({
            ...i,
            status: i.status || 'pending',
            countedQty: i.countedQty || 0
        }))
      }));
    setLocalBlocks(initialized);
  }, [blocks]);

  const handleOpenCount = (blockId: number, item: any) => {
    setActiveBlockId(blockId);
    setSelectedItem(item);
    setScannedCode(''); // Reset previous scan
    setShowEntryModal(true);
  };

  const handleOpenDetails = (item: any) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const handleRequestScan = () => {
      // Fecha temporariamente o EntryModal para abrir o Scanner
      // O EntryModal será reaberto no handleScanComplete
      setShowEntryModal(false);
      setShowScanner(true);
  };

  const handleScanComplete = (code: string) => {
      setShowScanner(false);
      setScannedCode(code);
      // Reabre o EntryModal com o código preenchido
      setShowEntryModal(true);
  };

  // Se fechar o scanner sem ler nada, reabre o modal de contagem
  const handleScannerClose = () => {
      setShowScanner(false);
      if (selectedItem) {
          setShowEntryModal(true);
      }
  };

  const handleConfirmCount = async (qty: number, status: 'counted' | 'not_located' | 'issue', reason?: string) => {
    if (!selectedItem || activeBlockId === null) return;

    // Normaliza status para o padrão do backend
    const finalStatus = status === 'issue' ? 'divergence_info' : status;

    // SAVE TO API (BALLAST)
    if (currentUser) {
        // Encontrar o bloco para pegar a localização correta
        await api.saveCount({
            sku: selectedItem.ref,
            nome_produto: selectedItem.name,
            usuario_id: currentUser.id,
            usuario_nome: currentUser.name,
            qtd_sistema: selectedItem.balance || 0,
            qtd_contada: qty,
            localizacao: scannedCode || selectedItem.location || 'N/A', // Usa o código escaneado como prova de local
            status: finalStatus,
            divergencia_motivo: reason
        });
    }

    setLocalBlocks(prev => prev.map(block => {
        if (block.id !== activeBlockId) return block;
        
        return {
            ...block,
            items: block.items.map(item => {
                if (item.ref === selectedItem.ref) { 
                    return {
                        ...item,
                        status: finalStatus, // counted, not_located, divergence_info
                        countedQty: qty,
                        divergenceReason: reason,
                        lastCount: {
                            user: currentUser?.name || 'Você',
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
    setScannedCode('');
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
          alert(`Bloco ${blockToFinalize.parentRef} finalizado com sucesso!`);
          
          setLocalBlocks(prev => prev.filter(b => b.id !== blockToFinalize.id));
          if (onRefreshCount) onRefreshCount();
          
          setShowConfirmModal(false);
      }
  };

  // --- Logic for Giving Up ---
  const handleRequestGiveUp = (block: Block) => {
      setBlockToGiveUp(block);
      setShowGiveUpModal(true);
  };

  const handleGiveUpConfirm = async () => {
      if (!blockToGiveUp) return;
      
      const idToRemove = blockToGiveUp.id;

      // 1. Close Modal
      setShowGiveUpModal(false);
      
      // 2. Trigger Animation
      setExitingBlockId(idToRemove);

      // 3. API Call (background)
      await api.releaseBlock(idToRemove); 
      
      // 4. Wait for animation to finish before removing from DOM
      setTimeout(() => {
          setLocalBlocks(prev => prev.filter(b => b.id !== idToRemove));
          setExitingBlockId(null);
          setBlockToGiveUp(null);
          if (onRefreshCount) onRefreshCount();
      }, 500); // Matches the duration-500 class
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
                                {block.location}
                            </div>
                        </div>

                        {/* Progress Bar (Always Visible) */}
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
                                const isCounted = item.status === 'counted';
                                const isIssue = item.status === 'not_located' || item.status === 'issue' || item.status === 'divergence_info';
                                const isProcessed = isCounted || isIssue;
                                const hasDivergenceReason = !!item.divergenceReason;
                                
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
                                                Em <strong className="text-gray-700 dark:text-gray-300">{item.lastCount.date}</strong> por {item.lastCount.user} ({item.lastCount.qty} un)
                                            </p>
                                        ) : (
                                            <p className="text-xs text-orange-500 font-medium">Nunca contado</p>
                                        )}
                                    </div>

                                    <div className="flex items-end justify-between gap-4">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Localização</span>
                                            <span className="text-sm font-bold text-gray-800 dark:text-white">{block.location}</span>
                                        </div>

                                        {isProcessed ? (
                                            <div className="flex flex-col items-end">
                                                {isIssue ? (
                                                    <span className="text-xs font-bold text-red-600 bg-red-100 dark:bg-red-900/40 px-2 py-1 rounded">
                                                        Bloqueio/Diverg.
                                                    </span>
                                                ) : (
                                                    <>
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
                                                        {hasDivergenceReason && <span className="text-[9px] text-orange-500 font-bold mt-1">Com Ajuste</span>}
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

                            {/* Give Up Button */}
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
        
        systemQuantity={selectedItem?.balance || 0} // Quantidade do sistema
        scannedLocation={scannedCode} // Local escaneado (se houver)
        
        lastCountInfo={selectedItem?.lastCount}
      />

      {/* SCANNER MODAL (Local) */}
      <ScannerModal 
        isOpen={showScanner} 
        onClose={handleScannerClose}
        onScanComplete={handleScanComplete}
        title="Validar Localização"
        instruction="Escaneie o QR Code do endereço para liberar a contagem"
      />

      <ItemDetailModal 
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        item={selectedItem}
      />

      <ConfirmationModal 
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleFinalizeConfirm}
      />

      <GiveUpBlockModal 
        isOpen={showGiveUpModal}
        onClose={() => setShowGiveUpModal(false)}
        onConfirm={handleGiveUpConfirm}
        blockName={blockToGiveUp?.parentRef}
      />
    </div>
  );
};
