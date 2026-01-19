
import React, { useMemo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { api } from '../services/api';

interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any | null;
  onAction?: (action: string) => void; 
  actionLabel?: string;
}

const formatHistoryEntry = (entry: any) => {
    let actionLabel = entry.STATUS;
    let icon = 'info';
    let color = 'text-gray-500';
    let dotColor = 'bg-gray-300 dark:bg-gray-600';

    switch (entry.STATUS) {
        case 'RESERVADO':
            actionLabel = 'Reserva do Item';
            icon = 'lock';
            color = 'text-blue-600 dark:text-blue-400';
            dotColor = 'bg-blue-500';
            break;
        case 'DEVOLVIDO':
            actionLabel = 'Devolução do Item';
            icon = 'keyboard_return';
            color = 'text-red-500 dark:text-red-400';
            dotColor = 'bg-red-500';
            break;
        case 'Contado':
        case 'counted':
            actionLabel = 'Conclusão da Contagem';
            icon = 'check_circle';
            color = 'text-green-600 dark:text-green-400';
            dotColor = 'bg-green-500';
            break;
        case 'Não Localizado':
        case 'not_located':
            actionLabel = 'Não Localizado';
            icon = 'search_off';
            color = 'text-gray-500 dark:text-gray-400';
            dotColor = 'bg-gray-400';
            break;
        case 'Divergência':
        case 'divergence_info':
            actionLabel = 'Apontamento de Divergência';
            icon = 'warning';
            color = 'text-orange-600 dark:text-orange-400';
            dotColor = 'bg-orange-500';
            break;
        case 'EDIÇÃO':
        case 'edited':
            actionLabel = 'Edição de Saldo';
            icon = 'edit_note';
            color = 'text-purple-600 dark:text-purple-400';
            dotColor = 'bg-purple-500';
            break;
        default:
            actionLabel = entry.STATUS || 'Evento';
    }

    return {
        date: new Date(entry.DATA_HORA).toLocaleDateString('pt-BR') + ' ' + new Date(entry.DATA_HORA).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}),
        user: entry.USUARIO_NOME,
        action: actionLabel,
        icon: icon,
        color: color,
        dotColor: dotColor,
        oldValue: entry.QTD_SISTEMA,
        newValue: entry.QTD_CONTADA,
        location: entry.LOCALIZACAO,
        reason: entry.DIVERGENCIA_MOTIVO
    };
};

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ isOpen, onClose, item, onAction, actionLabel }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (isOpen) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = 'unset';
    }
    return () => {
        document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
      if (isOpen && item && (item.ref || item.sku)) {
          setLoadingHistory(true);
          api.getProductHistory(item.ref || item.sku).then(data => {
              const formatted = data.map(formatHistoryEntry);
              setHistory(formatted);
              setLoadingHistory(false);
          }).catch(() => setLoadingHistory(false));
      } else {
          setHistory([]);
      }
  }, [isOpen, item]);

  // Generate mock financial data based on item (deterministic)
  const financialData = useMemo(() => {
      if (!item) return null;
      const seed = item.name ? item.name.length : 10;
      const cost = item.costPrice || (seed * 12.5) + 20;
      const price = item.salesPrice || cost * 1.6;
      const stock = item.balance || item.qty || item.countedQty || 10;
      const totalValue = cost * stock;
      const abc = item.abcCategory || (totalValue > 5000 ? 'A' : totalValue > 1000 ? 'B' : 'C');
      
      return { cost, price, totalValue, abc, stock };
  }, [item]);

  if (!isOpen || !item || !financialData) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-surface-dark rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-scale-up overflow-hidden">
        
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-black/20">
          <div className="flex gap-4">
             <div className="size-14 rounded-xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/10 flex items-center justify-center shadow-sm text-primary">
                <Icon name="extension" size={32} />
             </div>
             <div>
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight line-clamp-1">{item.name}</h2>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        financialData.abc === 'A' ? 'bg-green-100 text-green-700' :
                        financialData.abc === 'B' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                    }`}>
                        Curva {financialData.abc}
                    </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                   <span className="px-2 py-0.5 bg-gray-200 dark:bg-white/10 rounded text-xs font-bold text-gray-600 dark:text-gray-300">
                     SKU: {item.ref || item.sku}
                   </span>
                   <span className="text-sm text-gray-500">{item.brand || 'Marca n/a'}</span>
                </div>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors">
            <Icon name="close" size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
           
           {/* Financial Grid */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20">
                 <p className="text-xs font-bold uppercase text-blue-500 dark:text-blue-400 mb-1">Custo Unitário</p>
                 <p className="text-xl font-bold text-gray-900 dark:text-white">R$ {financialData.cost.toFixed(2)}</p>
              </div>
              <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20">
                 <p className="text-xs font-bold uppercase text-green-600 dark:text-green-400 mb-1">Preço Venda</p>
                 <p className="text-xl font-bold text-gray-900 dark:text-white">R$ {financialData.price.toFixed(2)}</p>
              </div>
              <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/20">
                 <p className="text-xs font-bold uppercase text-purple-600 dark:text-purple-400 mb-1">Valor em Estoque</p>
                 <p className="text-xl font-bold text-gray-900 dark:text-white">R$ {financialData.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
           </div>

           {/* Stock Info Bar */}
           <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
              <div className="text-center flex-1">
                 <p className="text-xs text-gray-500 uppercase font-bold">Estoque Atual</p>
                 <p className="text-2xl font-bold text-gray-900 dark:text-white">{financialData.stock} <span className="text-xs font-normal text-gray-500">un</span></p>
              </div>
              <div className="h-10 w-px bg-gray-300 dark:bg-gray-600" />
              <div className="text-center flex-1">
                 <p className="text-xs text-gray-500 uppercase font-bold">Loc. Principal</p>
                 <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">{item.loc || item.location || '---'}</p>
              </div>
              <div className="h-10 w-px bg-gray-300 dark:bg-gray-600" />
               <div className="text-center flex-1">
                 <p className="text-xs text-gray-500 uppercase font-bold">Giro (Dias)</p>
                 <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">45 dias</p>
              </div>
           </div>

           {/* TIMELINE (AUDIT TRAIL) */}
           <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                 <Icon name="history_edu" size={18} className="text-primary" />
                 Linha do Tempo (Audit Trail)
              </h3>
              
              <div className="relative pl-2">
                 {/* Vertical Line */}
                 <div className="absolute top-0 bottom-0 left-2 w-0.5 bg-gray-200 dark:bg-gray-700" />

                 {loadingHistory ? (
                     <div className="flex items-center gap-3 py-4 pl-6">
                         <Icon name="sync" className="animate-spin text-gray-400" />
                         <span className="text-sm text-gray-500">Carregando histórico...</span>
                     </div>
                 ) : history.length === 0 ? (
                     <div className="flex items-center gap-3 py-4 pl-6">
                         <Icon name="event_busy" className="text-gray-300" />
                         <span className="text-sm text-gray-400">Nenhum evento registrado.</span>
                     </div>
                 ) : (
                     history.map((h, idx) => {
                         const showDetails = h.action === 'Conclusão da Contagem' || h.action === 'Edição de Saldo' || h.action === 'Apontamento de Divergência';

                         return (
                             <div key={idx} className="relative pl-6 pb-6 last:pb-0 group">
                                 {/* Dot */}
                                 <div className={`absolute top-1 left-[0.15rem] size-3.5 rounded-full border-2 border-white dark:border-surface-dark ${h.dotColor} z-10`} />
                                 
                                 <div className="flex flex-col bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-100 dark:border-white/5 hover:border-gray-300 dark:hover:border-gray-500 transition-colors shadow-sm">
                                     <div className="flex justify-between items-start mb-1">
                                         <span className={`text-xs font-bold uppercase tracking-wide flex items-center gap-1 ${h.color}`}>
                                             <Icon name={h.icon} size={14} />
                                             {h.action}
                                         </span>
                                         <span className="text-[10px] text-gray-400 font-mono">{h.date}</span>
                                     </div>
                                     
                                     <div className="text-sm text-gray-800 dark:text-gray-200 font-medium ml-0.5">
                                         {h.user || 'Sistema'}
                                     </div>

                                     {showDetails && (
                                         <div className="mt-2 text-xs bg-white dark:bg-black/20 p-2 rounded-lg border border-gray-200 dark:border-white/5 flex flex-col gap-1">
                                             <div className="flex justify-between">
                                                <span className="text-gray-500">Contagem:</span>
                                                <span className="font-mono font-bold">
                                                    {h.newValue} un
                                                </span>
                                             </div>
                                             {h.oldValue != null && h.oldValue !== h.newValue && (
                                                 <div className="flex justify-between text-[10px]">
                                                    <span className="text-gray-400">Anterior (Sist):</span>
                                                    <span className="font-mono text-gray-400 line-through">
                                                        {h.oldValue}
                                                    </span>
                                                 </div>
                                             )}
                                             {h.reason && (
                                                 <div className="pt-1 mt-1 border-t border-dashed border-gray-200 dark:border-white/10 text-orange-600 dark:text-orange-400 italic">
                                                     "{h.reason}"
                                                 </div>
                                             )}
                                         </div>
                                     )}
                                     
                                     {h.location && h.location !== 'GERAL' && (
                                         <div className="mt-2 text-[10px] text-gray-400 flex items-center gap-1">
                                             <Icon name="place" size={12} /> {h.location}
                                         </div>
                                     )}
                                 </div>
                             </div>
                         );
                     })
                 )}
              </div>
           </div>
        </div>

        {onAction && (
            <div className="p-5 border-t border-gray-200 dark:border-card-border bg-gray-50 dark:bg-black/20 flex gap-3">
               <button 
                 onClick={() => onAction('primary')}
                 className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
               >
                  {actionLabel || 'Ação'}
                  <Icon name="arrow_forward" size={18} />
               </button>
            </div>
        )}

      </div>
    </div>,
    document.body
  );
};
