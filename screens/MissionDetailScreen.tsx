import React, { useState, useEffect } from 'react';
import { Icon } from '../components/Icon';
import { EntryModal, DamageModal, ConfirmationModal } from '../components/Modals';
import { ItemDetailModal } from '../components/ItemDetailModal';

interface BlockItem {
  id: number;
  name: string;
  sku: string;
  type: string;
  loc: string;
  expectedQty: number; 
  countedQty?: number;
  // Updated Status to include divergences
  status: 'pending' | 'counted' | 'not_located' | 'divergence_info';
  divergenceReason?: string;
  lastCount?: {
    user: string;
    date: string;
    qty: number;
  } | null;
}

interface MissionDetailScreenProps {
  blockData?: any; 
  onBack?: () => void;
}

export const MissionDetailScreen: React.FC<MissionDetailScreenProps> = ({ blockData, onBack }) => {
  const [items, setItems] = useState<BlockItem[]>([]);

  // Identify context: 'mission' (planned) vs 'product_scan'/'location_scan' (ad-hoc)
  const contextType = blockData?.contextType || 'mission';
  const isAdHoc = contextType === 'product_scan' || contextType === 'location_scan';

  // Inicializa os itens
  useEffect(() => {
    if (blockData && blockData.items) {
      const formattedItems = blockData.items.map((item: any, index: number) => {
        let lastCountData = item.lastCount;
        if (lastCountData === undefined) {
           const hasHistory = Math.random() > 0.3;
           lastCountData = hasHistory ? {
            user: ['Carlos Silva', 'Mariana Santos', 'João Pedro'][Math.floor(Math.random() * 3)],
            date: ['24/10', '23/10', '20/10'][Math.floor(Math.random() * 3)],
            qty: item.balance || 10
          } : null;
        }

        return {
          id: index + 1,
          name: item.name,
          sku: item.ref,
          type: item.brand, 
          loc: blockData.location,
          expectedQty: item.balance,
          status: 'pending',
          lastCount: lastCountData
        };
      });
      setItems(formattedItems);
    } else {
      setItems([
        { 
          id: 1, name: 'Item Exemplo', sku: '000', type: 'Exemplo', loc: 'A-01', expectedQty: 10, status: 'pending',
          lastCount: { user: 'Admin', date: '01/01', qty: 5 } 
        }
      ]);
    }
  }, [blockData]);

  const [selectedItem, setSelectedItem] = useState<BlockItem | null>(null);
  const [showEntry, setShowEntry] = useState(false);
  const [showDamage, setShowDamage] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Check if all items are processed (counted OR marked with divergence)
  const allItemsCounted = items.length > 0 && items.every(item => item.status !== 'pending');
  
  const progressPercentage = items.length > 0 ? Math.round((items.filter(i => i.status !== 'pending').length / items.length) * 100) : 0;

  const handleItemClick = (item: BlockItem) => {
    setSelectedItem(item);
    setShowEntry(true);
  };

  const handleOpenDetails = () => {
    setShowEntry(false); // Close entry modal to show details
    setShowDetailModal(true);
  };

  const handleCloseDetails = () => {
    setShowDetailModal(false);
    setShowEntry(true); // Re-open entry modal to continue counting
  };

  const handleConfirmCount = (quantity: number, status: 'counted' | 'not_located' | 'divergence_info' = 'counted', divergenceReason?: string) => {
    if (selectedItem) {
      setItems(prevItems => prevItems.map(item => 
        item.id === selectedItem.id 
          ? { 
              ...item, 
              countedQty: quantity, 
              status: status, 
              divergenceReason: divergenceReason,
              // Update lastCount immediately for visual feedback
              lastCount: {
                user: 'Você',
                date: 'Agora',
                qty: quantity
              }
            } 
          : item
      ));
      setShowEntry(false);
      setSelectedItem(null);
    }
  };

  const handleBack = () => {
    // Simply go back. No checks for ad-hoc or activity.
    // User saves per item count.
    if (onBack) onBack();
  };

  const getScanContextInfo = () => {
    if (contextType === 'product_scan') {
      return { label: 'PRODUTO IDENTIFICADO', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300', icon: 'qr_code_2' };
    }
    if (contextType === 'location_scan') {
      return { label: 'LOCALIZAÇÃO IDENTIFICADA', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300', icon: 'location_on' };
    }
    return null;
  };

  const scanInfo = getScanContextInfo();

  // Logic to determine if footer should be shown
  // 1. Mission Mode: Always show
  // 2. AdHoc Mode: Never show
  const showFooter = !isAdHoc;

  return (
    <div className="relative flex flex-col w-full min-h-screen bg-background-light dark:bg-background-dark pb-32 md:pb-0 md:bg-transparent">
      <header className="sticky top-0 z-20 flex flex-col bg-white/95 dark:bg-background-dark/95 md:bg-white md:dark:bg-surface-dark backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
         <div className="flex items-center justify-between p-4 pb-2">
            <div className="flex items-center gap-4">
                <button 
                onClick={handleBack}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-surface-dark transition-colors"
                >
                <Icon name="arrow_back" size={24} />
                </button>
                <div className="flex flex-col">
                  {/* The Title is now the Scanned Item or Location Name */}
                  <h2 className="text-lg font-bold leading-tight line-clamp-1 pr-4">
                    {blockData ? blockData.parentRef : 'Carregando...'}
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {blockData?.location}
                  </p>
                </div>
            </div>
            <button className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:text-primary transition-colors">
                <Icon name="more_vert" size={24} />
            </button>
         </div>

         {/* Visual Indicator of what was scanned */}
         {scanInfo && (
            <div className={`mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold tracking-wide ${scanInfo.color}`}>
                <Icon name={scanInfo.icon} size={16} />
                {scanInfo.label}
            </div>
         )}
      </header>

      <main className="flex-1 flex flex-col gap-4 p-4 md:p-6 md:pb-24">
        
        {/* Progress Info - ONLY SHOW FOR PLANNED MISSIONS, NOT AD-HOC SCANS */}
        {!isAdHoc && (
            <div className="sticky top-[73px] z-10 -mx-4 md:mx-0 bg-background-light/95 dark:bg-background-dark/95 md:bg-white md:dark:bg-surface-dark md:rounded-xl backdrop-blur-md px-4 py-3 border-b md:border border-gray-200 dark:border-gray-800 shadow-sm animate-fade-in">
            <div className="flex flex-col gap-2">
                <div className="flex gap-6 justify-between items-end">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Progresso do Bloco</p>
                    <div className="flex items-baseline gap-1">
                        <p className={`text-lg font-bold ${allItemsCounted ? 'text-green-500' : 'text-primary'}`}>
                        {items.filter(i => i.status !== 'pending').length}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">de {items.length} itens</p>
                    </div>
                </div>
                <div className="h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div 
                    className={`h-full rounded-full transition-all duration-500 ease-out ${allItemsCounted ? 'bg-green-500' : 'bg-primary'}`} 
                    style={{ width: `${progressPercentage}%` }} 
                    />
                </div>
            </div>
            </div>
        )}

        {/* Helper Text for AdHoc */}
        {isAdHoc && items.length > 1 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 px-1">
               Itens encontrados nesta localização. Conte e o sistema salvará automaticamente.
            </p>
        )}

        {/* List of Items - Grid on Desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
           {items.map((item) => {
             const isProcessed = item.status !== 'pending';
             let statusColor = '';
             let statusBg = '';
             let statusBorder = '';
             let statusIcon = '';
             let statusText = '';

             switch (item.status) {
                case 'counted':
                    statusColor = 'text-green-600 dark:text-green-400';
                    statusBg = 'bg-green-50 dark:bg-green-900/10';
                    statusBorder = 'border-green-200 dark:border-green-900/30';
                    statusIcon = 'check';
                    statusText = 'Contado';
                    break;
                case 'not_located':
                    statusColor = 'text-gray-600 dark:text-gray-400';
                    statusBg = 'bg-gray-100 dark:bg-gray-800';
                    statusBorder = 'border-gray-300 dark:border-gray-600';
                    statusIcon = 'search_off';
                    statusText = 'Não Localizado';
                    break;
                case 'divergence_info':
                    statusColor = 'text-orange-600 dark:text-orange-400';
                    statusBg = 'bg-orange-50 dark:bg-orange-900/10';
                    statusBorder = 'border-orange-200 dark:border-orange-900/30';
                    statusIcon = 'warning';
                    statusText = 'Divergência';
                    break;
                default:
                    statusBg = 'bg-white dark:bg-surface-dark';
                    statusBorder = 'border-gray-200 dark:border-gray-800 hover:border-primary';
             }

             return (
               <div 
                 key={item.id}
                 onClick={() => handleItemClick(item)}
                 className={`group relative flex flex-col gap-3 rounded-xl p-4 shadow-sm border transition-all cursor-pointer active:scale-[0.99] ${
                   isProcessed ? `${statusBg} ${statusBorder}` : `${statusBg} ${statusBorder}`
                 }`}
               >
                  <div className="flex items-start justify-between gap-4">
                     <div className="flex gap-4">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${
                          isProcessed 
                            ? item.status === 'not_located' ? 'bg-gray-200 dark:bg-gray-700' : item.status === 'divergence_info' ? 'bg-orange-100 dark:bg-orange-900/20' : 'bg-green-100 dark:bg-green-800'
                            : 'bg-gray-100 dark:bg-gray-800'
                        }`}>
                           <Icon name={isProcessed ? statusIcon : "inventory_2"} size={24} className={isProcessed ? statusColor : 'text-gray-500'} />
                        </div>
                        <div className="flex flex-col">
                           <h3 className={`text-base font-semibold ${isProcessed ? 'text-gray-900 dark:text-white' : 'text-gray-900 dark:text-white'}`}>
                             {item.name}
                           </h3>
                           <p className={`text-xs mt-0.5 ${isProcessed ? 'text-gray-600 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
                             SKU: {item.sku} • {item.type}
                           </p>
                        </div>
                     </div>
                  </div>

                  {/* Last Count Information - PRIORITY DATE */}
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-dashed border-gray-100 dark:border-white/5">
                      <Icon name="history" size={14} className="text-gray-400" />
                      {item.lastCount ? (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                           Em <strong className="text-gray-700 dark:text-gray-300">{item.lastCount.date}</strong> por {item.lastCount.user} ({item.lastCount.qty} un)
                        </p>
                      ) : (
                        <p className="text-[11px] text-orange-500 dark:text-orange-400 font-medium">
                          Item nunca contado
                        </p>
                      )}
                  </div>
                  
                  <div className={`flex items-center justify-between gap-4 pt-2 border-t mt-1 ${
                    isProcessed ? 'border-gray-200 dark:border-white/10' : 'border-gray-100 dark:border-gray-700/50'
                  }`}>
                     <div className="flex flex-col">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isProcessed ? statusColor : 'text-gray-500 dark:text-gray-400'}`}>
                          Localização
                        </span>
                        <span className={`text-sm font-bold ${isProcessed ? 'text-gray-800 dark:text-gray-200' : 'text-gray-900 dark:text-white'}`}>
                          {item.loc}
                        </span>
                     </div>
                     
                     {isProcessed ? (
                       <div className="flex flex-col items-end">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${statusColor}`}>{statusText}</span>
                          {item.status === 'counted' && (
                             <span className="text-lg font-bold text-green-700 dark:text-green-300">{item.countedQty} <span className="text-xs font-normal">un</span></span>
                          )}
                       </div>
                     ) : (
                       <div className="flex items-center gap-1 text-primary text-sm font-bold bg-primary/5 px-3 py-1.5 rounded-lg ml-auto">
                          Inserir Contagem
                          <Icon name="edit" size={16} />
                       </div>
                     )}
                  </div>
               </div>
             );
           })}
        </div>
      </main>

      {/* Footer - Only shown for Missions */}
      {showFooter && (
      <footer className="fixed bottom-0 left-0 right-0 w-full max-w-lg mx-auto md:max-w-none md:static md:bg-transparent md:border-none md:p-6 z-30 bg-white dark:bg-surface-dark border-t border-gray-200 dark:border-gray-800 p-4 pb-8 animate-slide-up">
         <div className="flex gap-3">
            <button 
               onClick={() => setShowDamage(true)}
               className="flex-1 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2"
            >
               <Icon name="report_problem" size={18} />
               Avaria
            </button>
            
            {allItemsCounted ? (
                <button 
                onClick={() => setShowConfirmation(true)}
                className="flex-[2] rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/30 hover:bg-primary-dark active:scale-95 transition-all flex items-center justify-center gap-2 animate-fade-in"
                >
                    <span>Finalizar Bloco</span>
                    <Icon name="check_circle" size={18} />
                </button>
            ) : (
                <div className="flex-[2] rounded-xl bg-gray-100 dark:bg-gray-800 px-4 py-3 text-sm font-bold text-gray-400 dark:text-gray-600 flex items-center justify-center gap-2 cursor-not-allowed border border-gray-200 dark:border-gray-700">
                    <span>Contagem em Andamento...</span>
                </div>
            )}
         </div>
      </footer>
      )}

      {/* Enhanced Entry Modal to include access to Details */}
      <EntryModal 
        isOpen={showEntry} 
        itemName={selectedItem?.name}
        itemSku={selectedItem?.sku}
        lastCountInfo={selectedItem?.lastCount ? {
          user: selectedItem.lastCount.user,
          date: selectedItem.lastCount.date,
          quantity: selectedItem.lastCount.qty,
          avatar: `https://i.pravatar.cc/150?u=${selectedItem.lastCount.user}`
        } : null}
        onClose={() => setShowEntry(false)} 
        onConfirm={handleConfirmCount} 
      />
      
      {/* ADDED: Button to view details inside EntryModal could be passed as prop if supported, 
         but for now we can render a separate component or modify EntryModal. 
         Since EntryModal is standard, let's just use the ItemDetailModal separately. */}
      
      {/* If we want the detail modal to be accessible from EntryModal, we need to modify EntryModal.
          However, based on standard patterns, we can render the DetailModal on top if triggered.
          Let's assume the user can click a small "info" icon on the card instead? 
          For now, I'll add a separate trigger or modify EntryModal later. 
          Actually, let's just render the ItemDetailModal if showDetailModal is true.
      */}

      <ItemDetailModal 
        isOpen={showDetailModal}
        onClose={handleCloseDetails}
        item={selectedItem}
        onAction={handleCloseDetails}
        actionLabel="Voltar para Contagem"
      />

      <DamageModal isOpen={showDamage} onClose={() => setShowDamage(false)} onAttach={() => setShowDamage(false)} />
      <ConfirmationModal isOpen={showConfirmation} onClose={() => setShowConfirmation(false)} onConfirm={() => setShowConfirmation(false)} />
    </div>
  );
};