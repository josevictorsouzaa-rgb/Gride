
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

// Formata moeda BRL
const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// Formata Histórico com Visuais Profissionais
const formatHistoryEntry = (entry: any) => {
    let actionLabel = entry.STATUS;
    let icon = 'info';
    let themeColor = 'gray'; // gray, blue, green, red, orange, purple

    switch (entry.STATUS) {
        case 'RESERVADO':
            actionLabel = 'Reserva de Estoque';
            icon = 'lock';
            themeColor = 'blue';
            break;
        case 'DEVOLVIDO':
            actionLabel = 'Devolução de Item';
            icon = 'keyboard_return';
            themeColor = 'indigo';
            break;
        case 'Contado':
        case 'counted':
            actionLabel = 'Contagem Realizada';
            icon = 'inventory_2';
            themeColor = 'green';
            break;
        case 'Não Localizado':
        case 'not_located':
            actionLabel = 'Item Não Localizado';
            icon = 'search_off';
            themeColor = 'red';
            break;
        case 'Divergência':
        case 'divergence_info':
            actionLabel = 'Divergência Reportada';
            icon = 'warning_amber';
            themeColor = 'orange';
            break;
        case 'EDIÇÃO':
        case 'edited':
            actionLabel = 'Ajuste Manual';
            icon = 'edit_note';
            themeColor = 'purple';
            break;
        default:
            actionLabel = entry.STATUS || 'Registro de Sistema';
            icon = 'feed';
            themeColor = 'gray';
    }

    return {
        ...entry,
        displayDate: new Date(entry.DATA_HORA).toLocaleDateString('pt-BR'),
        displayTime: new Date(entry.DATA_HORA).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}),
        actionLabel,
        icon,
        themeColor,
        oldValue: entry.QTD_SISTEMA,
        newValue: entry.QTD_CONTADA,
        user: entry.USUARIO_NOME || 'Sistema',
        reason: entry.DIVERGENCIA_MOTIVO
    };
};

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ isOpen, onClose, item, onAction, actionLabel }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Bloqueio de scroll do body
  useEffect(() => {
    if (isOpen) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  // Carregar Histórico
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

  // Calcular Indicadores Financeiros
  const financialData = useMemo(() => {
      if (!item) return null;
      
      const cost = Number(item.costPrice || 0);
      const price = Number(item.salesPrice || 0);
      const stock = Number(item.balance || item.qty || item.countedQty || 0);
      const totalValue = price * stock; // Valor de Venda * Estoque
      const totalCost = cost * stock;   // Custo * Estoque
      
      return { cost, price, stock, totalValue, totalCost };
  }, [item]);

  if (!isOpen || !item || !financialData) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      {/* Container Principal */}
      <div className="relative z-10 w-full max-w-5xl bg-white dark:bg-[#12161b] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-scale-up border border-gray-200 dark:border-gray-800">
        
        {/* HEADER: Identificação do Produto */}
        <div className="flex items-start justify-between p-6 pb-4 bg-white dark:bg-[#181c22] border-b border-gray-100 dark:border-white/5 shrink-0">
            <div className="flex gap-4">
                <div className="size-16 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-400 dark:text-gray-500 shadow-inner">
                    <Icon name="category" size={32} />
                </div>
                <div>
                    <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white leading-tight line-clamp-1">
                        {item.name}
                    </h2>
                    <div className="flex items-center gap-3 mt-1.5">
                        <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-white/5">
                            SKU: {item.ref || item.sku}
                        </span>
                        <span className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                            {item.brand || 'Marca N/A'}
                        </span>
                    </div>
                </div>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
                <Icon name="close" size={24} />
            </button>
        </div>

        {/* CORPO: Layout Dividido (Indicadores + Timeline) */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden bg-gray-50 dark:bg-[#0d1116]">
            
            {/* COLUNA ESQUERDA: Indicadores Financeiros (Fixa em Desktop) */}
            <div className="md:w-1/3 lg:w-1/4 p-6 space-y-4 border-b md:border-b-0 md:border-r border-gray-200 dark:border-white/5 bg-white dark:bg-[#12161b] overflow-y-auto no-scrollbar">
                
                {/* Saldo de Estoque */}
                <div className="p-5 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 text-center">
                    <p className="text-xs font-bold text-blue-500 dark:text-blue-400 uppercase tracking-widest mb-1">Saldo Atual</p>
                    <p className="text-4xl font-black text-blue-700 dark:text-blue-300">
                        {financialData.stock} <span className="text-lg text-blue-400 dark:text-blue-500 font-bold">un</span>
                    </p>
                </div>

                {/* Localização */}
                <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                    <div className="p-2 bg-gray-200 dark:bg-white/10 rounded-lg text-gray-600 dark:text-gray-300">
                        <Icon name="place" size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Localização</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{item.loc || item.location || 'N/A'}</p>
                    </div>
                </div>

                <div className="h-px bg-gray-100 dark:bg-white/5 my-2"></div>

                {/* Grid Financeiro */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                        <span className="text-xs font-medium text-gray-500">Custo Unit.</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(financialData.cost)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                        <span className="text-xs font-medium text-gray-500">Preço Venda</span>
                        <span className="text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(financialData.price)}</span>
                    </div>
                </div>

                {/* Valor Total Destacado */}
                <div className="p-4 rounded-xl bg-gray-900 dark:bg-white/5 border border-gray-800 dark:border-white/10 text-white mt-4">
                    <div className="flex items-center gap-2 mb-1 opacity-70">
                        <Icon name="monetization_on" size={16} />
                        <span className="text-xs font-bold uppercase tracking-wider">Valor em Estoque</span>
                    </div>
                    <p className="text-2xl font-black tracking-tight">{formatCurrency(financialData.totalValue)}</p>
                </div>

            </div>

            {/* COLUNA DIREITA: Linha do Tempo (Scroll Independente) */}
            <div className="flex-1 p-6 overflow-y-auto min-h-0 bg-gray-50/50 dark:bg-[#0d1116]">
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2 sticky top-0 bg-gray-50/95 dark:bg-[#0d1116]/95 backdrop-blur py-2 z-10">
                    <Icon name="history" />
                    Linha do Tempo (Audit Trail)
                </h3>

                <div className="relative pl-4 space-y-0">
                    {/* Linha Vertical Contínua */}
                    <div className="absolute top-2 bottom-4 left-[23px] w-0.5 bg-gray-200 dark:bg-gray-800"></div>

                    {loadingHistory ? (
                        <div className="py-10 text-center opacity-50">
                            <Icon name="sync" className="animate-spin mb-2" size={32} />
                            <p className="text-sm">Carregando histórico...</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="py-10 text-center opacity-50 bg-gray-100 dark:bg-white/5 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                            <p className="text-sm font-medium">Nenhum registro encontrado.</p>
                        </div>
                    ) : (
                        history.map((h, idx) => {
                            // Cores dinâmicas baseadas no tema do evento
                            const themeColors: any = {
                                blue: { dot: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-200 dark:border-blue-900/30' },
                                green: { dot: 'bg-green-500', text: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/10', border: 'border-green-200 dark:border-green-900/30' },
                                red: { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/10', border: 'border-red-200 dark:border-red-900/30' },
                                orange: { dot: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/10', border: 'border-orange-200 dark:border-orange-900/30' },
                                purple: { dot: 'bg-purple-500', text: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/10', border: 'border-purple-200 dark:border-purple-900/30' },
                                gray: { dot: 'bg-gray-400', text: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700' },
                                indigo: { dot: 'bg-indigo-500', text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/10', border: 'border-indigo-200 dark:border-indigo-900/30' },
                            };
                            const theme = themeColors[h.themeColor] || themeColors.gray;

                            return (
                                <div key={idx} className="relative pl-10 pb-8 group last:pb-0">
                                    {/* Ponto na Linha */}
                                    <div className={`absolute top-1.5 left-[16px] -translate-x-1/2 size-4 rounded-full border-[3px] border-white dark:border-[#0d1116] shadow-sm z-10 ${theme.dot}`} />

                                    {/* Card do Evento */}
                                    <div className={`rounded-xl p-4 border ${theme.bg} ${theme.border} relative transition-all hover:shadow-md`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <Icon name={h.icon} className={theme.text} size={20} />
                                                <span className={`text-sm font-bold ${theme.text} uppercase tracking-tight`}>
                                                    {h.actionLabel}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="block text-xs font-bold text-gray-900 dark:text-white">{h.displayDate}</span>
                                                <span className="block text-[10px] text-gray-500 font-medium">{h.displayTime}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="size-5 rounded-full bg-white/50 dark:bg-black/20 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-400">
                                                {h.user.charAt(0)}
                                            </div>
                                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                                {h.user}
                                            </span>
                                        </div>

                                        {/* Detalhes de Quantidade */}
                                        {(h.newValue !== undefined || h.reason) && (
                                            <div className="mt-3 pt-3 border-t border-dashed border-gray-300/30 dark:border-white/10">
                                                {h.newValue !== undefined && (
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-gray-500 dark:text-gray-400 font-medium">Quantidade Registrada:</span>
                                                        <span className="font-mono font-black text-gray-900 dark:text-white text-base">
                                                            {h.newValue} un
                                                        </span>
                                                    </div>
                                                )}
                                                
                                                {/* Motivo (Se houver) */}
                                                {h.reason && (
                                                    <div className="mt-2 text-xs italic text-gray-600 dark:text-gray-400 bg-white/50 dark:bg-black/20 p-2 rounded border border-gray-200/50 dark:border-white/5">
                                                        "{h.reason}"
                                                    </div>
                                                )}
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

        {/* Footer Action (Opcional) */}
        {onAction && (
            <div className="p-4 bg-white dark:bg-[#181c22] border-t border-gray-100 dark:border-white/5 shrink-0 flex justify-end">
               <button 
                 onClick={() => onAction('primary')}
                 className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all flex items-center gap-2"
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
