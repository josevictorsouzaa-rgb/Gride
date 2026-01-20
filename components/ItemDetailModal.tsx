
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
    let borderColor = 'border-gray-200 dark:border-gray-700';
    let bgBadge = 'bg-gray-100 dark:bg-gray-800';
    let textBadge = 'text-gray-600 dark:text-gray-300';

    switch (entry.STATUS) {
        case 'RESERVADO':
            actionLabel = 'Reserva do Item';
            icon = 'lock';
            color = 'text-blue-600 dark:text-blue-400';
            borderColor = 'border-blue-200 dark:border-blue-900';
            bgBadge = 'bg-blue-100 dark:bg-blue-900/40';
            textBadge = 'text-blue-700 dark:text-blue-200';
            break;
        case 'DEVOLVIDO':
            actionLabel = 'Devolução do Item';
            icon = 'keyboard_return';
            color = 'text-red-500 dark:text-red-400';
            borderColor = 'border-red-200 dark:border-red-900';
            bgBadge = 'bg-red-100 dark:bg-red-900/40';
            textBadge = 'text-red-700 dark:text-red-200';
            break;
        case 'Contado':
        case 'counted':
            actionLabel = 'Conclusão da Contagem';
            icon = 'check_circle';
            color = 'text-green-600 dark:text-green-400';
            borderColor = 'border-green-200 dark:border-green-900';
            bgBadge = 'bg-green-100 dark:bg-green-900/40';
            textBadge = 'text-green-700 dark:text-green-200';
            break;
        case 'Não Localizado':
        case 'not_located':
            actionLabel = 'Não Localizado';
            icon = 'search_off';
            color = 'text-gray-600 dark:text-gray-400';
            borderColor = 'border-gray-300 dark:border-gray-600';
            bgBadge = 'bg-gray-200 dark:bg-gray-700';
            textBadge = 'text-gray-700 dark:text-gray-300';
            break;
        case 'Divergência':
        case 'divergence_info':
            actionLabel = 'Divergência Apontada';
            icon = 'warning';
            color = 'text-orange-600 dark:text-orange-400';
            borderColor = 'border-orange-200 dark:border-orange-900';
            bgBadge = 'bg-orange-100 dark:bg-orange-900/40';
            textBadge = 'text-orange-800 dark:text-orange-200';
            break;
        case 'EDIÇÃO':
        case 'edited':
            actionLabel = 'Edição Manual de Saldo';
            icon = 'edit_note';
            color = 'text-purple-600 dark:text-purple-400';
            borderColor = 'border-purple-200 dark:border-purple-900';
            bgBadge = 'bg-purple-100 dark:bg-purple-900/40';
            textBadge = 'text-purple-700 dark:text-purple-200';
            break;
        default:
            actionLabel = entry.STATUS || 'Evento';
    }

    return {
        dateObj: new Date(entry.DATA_HORA),
        date: new Date(entry.DATA_HORA).toLocaleDateString('pt-BR'),
        time: new Date(entry.DATA_HORA).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}),
        user: entry.USUARIO_NOME,
        action: actionLabel,
        icon: icon,
        color: color,
        borderColor: borderColor,
        bgBadge: bgBadge,
        textBadge: textBadge,
        oldValue: entry.QTD_SISTEMA,
        newValue: entry.QTD_CONTADA,
        location: entry.LOCALIZACAO,
        reason: entry.DIVERGENCIA_MOTIVO,
        rawStatus: entry.STATUS
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

  const financialData = useMemo(() => {
      if (!item) return null;
      
      const cost = item.costPrice || 0;
      const price = item.salesPrice || 0;
      const stock = item.balance || item.qty || item.countedQty || 0;
      // "VALOR DE ESTOQUE DEVE PUXAR A QUANTIDADE DE ESTOQUE ATUAL, VEZES O CUSTO DE VENDA"
      const totalValue = price * stock;
      
      return { cost, price, totalValue, stock };
  }, [item]);

  if (!isOpen || !item || !financialData) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 md:p-8">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity" onClick={onClose} />
      
      <div className="relative z-10 w-full max-w-4xl bg-white dark:bg-surface-dark rounded-3xl shadow-2xl flex flex-col h-[90vh] md:h-[85vh] animate-scale-up overflow-hidden border border-gray-200 dark:border-white/5">
        
        {/* HEADER FIXO */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100 dark:border-white/5 bg-white dark:bg-[#181c22] shrink-0 z-20">
          <div className="flex gap-5 items-center">
             <div className="size-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-white/5 dark:to-white/10 border border-gray-200 dark:border-white/5 flex items-center justify-center shadow-inner text-primary">
                <Icon name="extension" size={36} />
             </div>
             <div>
                <div className="flex flex-col">
                    <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white leading-tight line-clamp-1">
                        {item.name}
                    </h2>
                    <div className="flex items-center gap-3 mt-1.5">
                        <span className="px-2.5 py-1 bg-gray-100 dark:bg-white/10 rounded-md text-xs md:text-sm font-mono font-bold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-white/5">
                            SKU: {item.ref || item.sku}
                        </span>
                        <span className="text-sm md:text-base font-medium text-gray-500">{item.brand || 'Marca n/a'}</span>
                    </div>
                </div>
             </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-gray-700 dark:hover:text-white">
            <Icon name="close" size={24} />
          </button>
        </div>

        {/* CORPO DO MODAL (FLEX COL) */}
        <div className="flex flex-col flex-1 min-h-0 bg-gray-50/50 dark:bg-black/20">
           
           {/* SEÇÃO SUPERIOR: DADOS FINANCEIROS & ESTOQUE (FIXO NO TOPO DO SCROLL, OU SEPARADO) 
               Aqui optamos por deixar fixo no topo da área de conteúdo (shrink-0) para estar sempre visível 
               enquanto a timeline rola.
           */}
           <div className="shrink-0 p-6 pb-2 space-y-4 border-b border-gray-200 dark:border-white/5 bg-white dark:bg-surface-dark shadow-sm z-10">
               {/* Financial Grid */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20">
                     <p className="text-xs md:text-sm font-bold uppercase text-blue-500 dark:text-blue-400 mb-1 tracking-wide">Custo Unitário</p>
                     <p className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">R$ {financialData.cost.toFixed(2)}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20">
                     <p className="text-xs md:text-sm font-bold uppercase text-green-600 dark:text-green-400 mb-1 tracking-wide">Preço Venda</p>
                     <p className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">R$ {financialData.price.toFixed(2)}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/20">
                     <p className="text-xs md:text-sm font-bold uppercase text-purple-600 dark:text-purple-400 mb-1 tracking-wide">Valor em Estoque</p>
                     <p className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">R$ {financialData.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
               </div>

               {/* Stock Info Bar */}
               <div className="flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                  <div className="flex flex-col">
                     <p className="text-xs md:text-sm text-gray-500 uppercase font-bold tracking-wider">Estoque Atual</p>
                     <p className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mt-1">
                        {financialData.stock} <span className="text-sm md:text-lg font-bold text-gray-400">un</span>
                     </p>
                  </div>
                  <div className="h-12 w-px bg-gray-300 dark:bg-gray-600 mx-6" />
                  <div className="flex flex-col items-end text-right">
                     <p className="text-xs md:text-sm text-gray-500 uppercase font-bold tracking-wider">Loc. Principal</p>
                     <div className="flex items-center gap-2 mt-1">
                        <Icon name="place" className="text-primary" size={24} />
                        <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{item.loc || item.location || '---'}</p>
                     </div>
                  </div>
               </div>
           </div>

           {/* SEÇÃO INFERIOR: TIMELINE (ROLAGEM INDEPENDENTE) */}
           <div className="flex-1 overflow-y-auto p-6 min-h-0 scroll-smooth">
              <h3 className="text-base md:text-lg font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-6 flex items-center gap-3 sticky top-0 bg-gray-50/50 dark:bg-transparent backdrop-blur-sm py-2 z-10">
                 <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                    <Icon name="history_edu" size={24} />
                 </div>
                 Linha do Tempo (Audit Trail)
              </h3>
              
              <div className="relative pl-4 md:pl-6 space-y-8">
                 {/* Vertical Line */}
                 <div className="absolute top-2 bottom-0 left-[23px] md:left-[31px] w-0.5 bg-gray-200 dark:bg-gray-700" />

                 {loadingHistory ? (
                     <div className="flex items-center gap-3 py-8 pl-8 opacity-60">
                         <Icon name="sync" className="animate-spin text-gray-400" size={24} />
                         <span className="text-base md:text-lg text-gray-500 font-medium">Carregando histórico completo...</span>
                     </div>
                 ) : history.length === 0 ? (
                     <div className="flex flex-col items-center justify-center py-12 gap-4 text-center opacity-50">
                         <Icon name="event_busy" className="text-gray-300" size={48} />
                         <span className="text-base font-medium text-gray-400">Nenhum evento registrado recentemente.</span>
                     </div>
                 ) : (
                     history.map((h, idx) => {
                         const showDetails = h.action.includes('Contagem') || h.action.includes('Edição') || h.rawStatus === 'Divergência' || h.rawStatus === 'Não Localizado';

                         return (
                             <div key={idx} className="relative pl-8 md:pl-12 group animate-fade-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                                 
                                 {/* Timeline Dot */}
                                 <div className={`absolute top-0 left-[16px] md:left-[24px] -translate-x-1/2 size-4 md:size-5 rounded-full border-[3px] border-white dark:border-[#181c22] shadow-sm z-10 ${h.color.replace('text-', 'bg-')}`} />
                                 
                                 {/* Card */}
                                 <div className="bg-white dark:bg-surface-dark p-4 md:p-5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all">
                                     
                                     {/* Card Header */}
                                     <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 mb-3 border-b border-gray-100 dark:border-white/5 pb-3">
                                         <div className="flex items-center gap-3">
                                             <span className={`px-3 py-1 rounded-lg text-xs md:text-sm font-bold uppercase tracking-wide flex items-center gap-2 ${h.bgBadge} ${h.textBadge}`}>
                                                 <Icon name={h.icon} size={18} />
                                                 {h.action}
                                             </span>
                                         </div>
                                         <div className="flex items-center gap-2 text-xs md:text-sm text-gray-400 font-medium">
                                             <span>{h.date}</span>
                                             <span className="size-1 rounded-full bg-gray-300"></span>
                                             <span>{h.time}</span>
                                         </div>
                                     </div>
                                     
                                     {/* Card User */}
                                     <div className="flex items-center gap-2 mb-3">
                                         <div className="size-6 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold text-gray-500">
                                             <Icon name="person" size={14} />
                                         </div>
                                         <span className="text-sm md:text-base font-bold text-gray-800 dark:text-gray-200">
                                             {h.user || 'Sistema'}
                                         </span>
                                     </div>

                                     {/* Details Box */}
                                     {showDetails && (
                                         <div className="bg-gray-50 dark:bg-black/30 p-3 md:p-4 rounded-xl border border-gray-100 dark:border-white/5 flex flex-col gap-2">
                                             <div className="flex justify-between items-center">
                                                <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400 font-medium">Contagem Realizada:</span>
                                                <span className="text-base md:text-xl font-mono font-black text-gray-900 dark:text-white">
                                                    {h.newValue} un
                                                </span>
                                             </div>
                                             
                                             {h.oldValue != null && h.oldValue !== h.newValue && (
                                                 <div className="flex justify-between items-center text-xs md:text-sm">
                                                    <span className="text-gray-400">Saldo Anterior (Sistema):</span>
                                                    <span className="font-mono text-gray-400 line-through">
                                                        {h.oldValue}
                                                    </span>
                                                 </div>
                                             )}
                                             
                                             {/* Motivo da Divergência */}
                                             {h.reason ? (
                                                 <div className="pt-3 mt-1 border-t border-dashed border-gray-200 dark:border-white/10">
                                                     <p className="text-[10px] md:text-xs uppercase font-bold text-gray-400 mb-1">Observação / Problema:</p>
                                                     <p className="text-sm md:text-base text-orange-700 dark:text-orange-300 italic font-medium bg-orange-50 dark:bg-orange-900/20 p-2 rounded-lg border border-orange-100 dark:border-orange-900/30">
                                                         "{h.reason}"
                                                     </p>
                                                 </div>
                                             ) : h.rawStatus === 'Não Localizado' ? (
                                                 <div className="pt-3 mt-1 border-t border-dashed border-gray-200 dark:border-white/10">
                                                     <p className="text-red-500 italic text-xs md:text-sm font-medium flex items-center gap-1">
                                                         <Icon name="error_outline" size={16} />
                                                         Item não encontrado no endereço físico.
                                                     </p>
                                                 </div>
                                             ) : null}
                                         </div>
                                     )}
                                     
                                     {h.location && h.location !== 'GERAL' && (
                                         <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-xs font-mono font-bold">
                                             <Icon name="place" size={12} /> {h.location}
                                         </div>
                                     )}
                                 </div>
                             </div>
                         );
                     })
                 )}
                 
                 {/* End of Line Indicator */}
                 {!loadingHistory && history.length > 0 && (
                     <div className="relative pl-8 md:pl-12 pb-4">
                         <div className="absolute top-0 left-[23px] md:left-[31px] w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full -translate-x-1/2" />
                         <span className="text-xs text-gray-400 uppercase font-bold tracking-widest opacity-50">Início dos Registros</span>
                     </div>
                 )}
              </div>
           </div>
        </div>

        {onAction && (
            <div className="p-6 border-t border-gray-200 dark:border-white/10 bg-white dark:bg-[#181c22] shrink-0 z-20">
               <button 
                 onClick={() => onAction('primary')}
                 className="w-full py-4 bg-primary text-white rounded-xl font-bold text-lg shadow-xl shadow-primary/20 hover:bg-primary-dark transition-colors flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-[0.98]"
               >
                  {actionLabel || 'Ação'}
                  <Icon name="arrow_forward" size={24} />
               </button>
            </div>
        )}

      </div>
    </div>,
    document.body
  );
};
