
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

// Helper Tempo Relativo
const getTimeAgo = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Agora';
    if (diffInSeconds < 3600) return `Há ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `Há ${Math.floor(diffInSeconds / 3600)} h`;
    if (diffInSeconds < 2592000) return `Há ${Math.floor(diffInSeconds / 86400)} d`;
    return 'Há +1 mês';
};

// Formata Histórico com Visuais Profissionais
const formatHistoryEntry = (entry: any) => {
    let actionLabel = entry.STATUS;
    let icon = 'info';
    let themeColor = 'gray'; 

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
      const totalValue = price * stock;
      
      return { cost, price, stock, totalValue };
  }, [item]);

  // Encontrar o último evento relevante (Contagem/Divergência/Edição) para exibir no card
  const lastEvent = useMemo(() => {
      if (history.length === 0) return null;
      // Procura o primeiro evento que tenha uma quantidade registrada (newValue)
      return history.find(h => h.newValue !== undefined) || null;
  }, [history]);

  if (!isOpen || !item || !financialData) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-0 md:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      {/* Container Principal: Bottom Sheet (Mobile) vs Center Modal (Desktop) */}
      <div className="relative z-10 w-full h-[90vh] md:h-[85vh] md:max-w-6xl bg-gray-50 dark:bg-[#0f1115] rounded-t-[2.5rem] md:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up md:animate-scale-up">
        
        {/* Mobile Drag Handle */}
        <div className="md:hidden absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full z-30" />

        {/* HEADER FIXO */}
        <div className="shrink-0 bg-white dark:bg-[#181c22] border-b border-gray-200 dark:border-white/5 pt-8 pb-4 px-6 md:p-6 flex gap-4 items-center justify-between z-20 shadow-sm rounded-t-[2.5rem] md:rounded-t-none">
            <div className="flex gap-3 md:gap-5 items-center overflow-hidden">
                 <div className="size-12 md:size-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-white/5 dark:to-white/10 border border-gray-200 dark:border-white/5 flex items-center justify-center shrink-0 text-primary shadow-inner">
                    <Icon name="category" size={28} /> 
                 </div>
                 <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-[10px] md:text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50 uppercase tracking-wider truncate max-w-[120px]">
                            {item.brand || 'GENÉRICO'}
                        </span>
                        <span className="text-[10px] md:text-xs font-mono text-gray-500 dark:text-gray-400">
                            SKU: {item.ref || item.sku}
                        </span>
                    </div>
                    <h2 className="text-lg md:text-2xl font-black text-gray-900 dark:text-white leading-tight truncate">
                        {item.name}
                    </h2>
                 </div>
            </div>
            <button onClick={onClose} className="size-10 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors shrink-0">
                <Icon name="close" size={24} />
            </button>
        </div>

        {/* CORPO FLEXÍVEL */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
            
            {/* ÁREA DE KPIs (INDICADORES) */}
            <div className="shrink-0 z-10 bg-white dark:bg-[#181c22] border-b md:border-b-0 md:border-r border-gray-200 dark:border-white/5">
                
                {/* MOBILE LAYOUT: GRID 2x1 COMPACTO (Visível apenas mobile) */}
                <div className="md:hidden grid grid-cols-2 gap-3 p-4 bg-gray-50/50 dark:bg-black/10">
                    {/* Card 1: Estoque */}
                    <div className="col-span-1 bg-gradient-to-br from-blue-600 to-blue-700 text-white p-4 rounded-2xl shadow-lg shadow-blue-900/20 relative overflow-hidden flex flex-col justify-between min-h-[140px]">
                         <div className="absolute -right-3 -top-3 text-white/10 rotate-12"><Icon name="inventory_2" size={90} /></div>
                         
                         <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-100 mb-1 flex items-center gap-1">
                                <Icon name="check_circle" size={12} /> Saldo
                            </p>
                            <div className="flex items-baseline gap-1 relative z-10">
                                <span className="text-4xl font-black tracking-tighter">{financialData.stock}</span>
                                <span className="text-sm font-medium text-blue-200">un</span>
                            </div>
                            <p className="text-[10px] text-blue-200 relative z-10 opacity-80">{item.loc || 'Geral'}</p>
                         </div>

                         {/* LAST COUNT INFO MOBILE */}
                         {lastEvent && (
                             <div className="mt-2 pt-2 border-t border-white/20 flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-1.5">
                                    <div className="size-5 rounded-full bg-white/20 flex items-center justify-center text-[8px] font-bold">
                                        {lastEvent.user.charAt(0)}
                                    </div>
                                    <span className="text-[9px] font-bold truncate max-w-[50px]">{lastEvent.user.split(' ')[0]}</span>
                                </div>
                                <div className="flex flex-col items-end leading-none">
                                    <span className="text-[10px] font-bold">{lastEvent.newValue} un</span>
                                    <span className="text-[8px] opacity-70">{getTimeAgo(lastEvent.DATA_HORA)}</span>
                                </div>
                             </div>
                         )}
                    </div>

                    {/* Card 2: Financeiro */}
                    <div className="col-span-1 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4 rounded-2xl shadow-sm flex flex-col justify-center min-h-[140px] relative">
                         <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Valor Total</p>
                         <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight leading-none mb-3">
                            {formatCurrency(financialData.totalValue)}
                         </p>
                         <div className="w-full h-px bg-gray-100 dark:bg-white/10 mb-3"></div>
                         <div className="flex flex-col gap-2">
                            <div>
                                <span className="text-[9px] uppercase text-gray-400 font-bold block">Venda Unit.</span>
                                <span className="text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(financialData.price)}</span>
                            </div>
                            {lastEvent && (
                                <div className="text-[9px] text-gray-400 font-medium flex items-center gap-1">
                                    <Icon name="event" size={10} />
                                    <span>Atualizado: {lastEvent.displayDate}</span>
                                </div>
                            )}
                         </div>
                    </div>
                </div>

                {/* DESKTOP LAYOUT: SIDEBAR COMPLETA (Visível apenas desktop) */}
                <div className="hidden md:flex flex-col w-[340px] lg:w-[400px] gap-4 p-6 h-full overflow-y-auto no-scrollbar bg-white dark:bg-[#181c22]">
                    {/* Card 1: Estoque Desktop */}
                    <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-xl shadow-blue-900/20 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                            <Icon name="inventory_2" size={120} />
                        </div>
                        
                        <div className="relative z-10">
                            <p className="text-xs font-bold uppercase tracking-widest text-blue-100 mb-3 flex items-center gap-2">
                                <Icon name="check_circle" size={18} /> Saldo Físico
                            </p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-6xl font-black tracking-tighter">{financialData.stock}</span>
                                <span className="text-2xl font-medium text-blue-200">un</span>
                            </div>
                            
                            <div className="mt-4 flex items-center gap-3">
                                <div className="p-1.5 bg-white/20 rounded-lg">
                                    <Icon name="place" size={18} className="text-white" />
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase text-blue-200 font-bold">Localização</p>
                                    <p className="font-bold text-lg leading-none">{item.loc || item.location || 'Geral'}</p>
                                </div>
                            </div>

                            {/* LAST COUNT INFO DESKTOP - BOX DETALHADO */}
                            {lastEvent && (
                                <div className="mt-6 bg-black/20 rounded-xl p-3 border border-white/10 backdrop-blur-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-bold uppercase text-blue-200 tracking-wider">Última Conferência</span>
                                        <span className="text-[10px] font-mono text-blue-100 opacity-80">{lastEvent.displayDate} • {lastEvent.displayTime}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="size-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold border border-white/20 shadow-sm">
                                                {lastEvent.user.charAt(0)}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold leading-none">{lastEvent.user.split(' ')[0]}</span>
                                                <span className="text-[10px] text-blue-200 opacity-80">{getTimeAgo(lastEvent.DATA_HORA)}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-xl font-bold leading-none">{lastEvent.newValue}</span>
                                            <span className="text-[9px] uppercase font-bold text-blue-300">Apurado</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Card 2: Financeiro Desktop */}
                    <div className="p-6 rounded-3xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm relative group">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">Valor em Estoque</p>
                        <p className="text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-6">
                            {formatCurrency(financialData.totalValue)}
                        </p>
                        <div className="grid grid-cols-2 gap-6 pt-4 border-t border-dashed border-gray-200 dark:border-white/10">
                             <div>
                                <span className="text-[10px] uppercase text-gray-400 font-bold block mb-1">Custo Unit.</span>
                                <span className="text-lg font-bold text-gray-700 dark:text-gray-300">{formatCurrency(financialData.cost)}</span>
                             </div>
                             <div className="pl-6 border-l border-gray-200 dark:border-white/5">
                                <span className="text-[10px] uppercase text-gray-400 font-bold block mb-1">Venda Unit.</span>
                                <span className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(financialData.price)}</span>
                             </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* DIREITA (DESKTOP) / BAIXO (MOBILE) - TIMELINE */}
            {/* Agora é um flex-col para ter header fixo e conteúdo rolável */}
            <div className="flex-1 flex flex-col min-h-0 bg-gray-50/50 dark:bg-black/20">
                
                {/* CABEÇALHO DA TIMELINE (FIXO) */}
                <div className="px-5 py-3 border-b border-gray-200 dark:border-white/5 bg-gray-50/90 dark:bg-[#0f1115]/90 backdrop-blur shrink-0 z-20 flex justify-between items-center">
                    <h3 className="text-xs md:text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Icon name="history" size={18} />
                        Linha do Tempo
                    </h3>
                    <div className="text-[10px] font-bold bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-md">
                        {loadingHistory ? '...' : `${history.length} Reg.`}
                    </div>
                </div>

                {/* CONTEÚDO DA TIMELINE (ROLÁVEL) */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-4">
                    <div className="relative space-y-0 pb-10">
                        {/* Linha Vertical Contínua (Centralizada no DOT) */}
                        {/* Left-6 = 24px. Dots também estão no Left-6. Perfeito alinhamento. */}
                        <div className="absolute top-2 bottom-0 left-6 w-0.5 bg-gray-200 dark:bg-gray-800 -translate-x-[1px]"></div>

                        {loadingHistory ? (
                            <div className="py-12 flex flex-col items-center justify-center opacity-50">
                                <Icon name="sync" className="animate-spin mb-3 text-primary" size={32} />
                                <p className="text-sm font-medium text-gray-500">Buscando registros...</p>
                            </div>
                        ) : history.length === 0 ? (
                            <div className="py-10 text-center opacity-60 bg-white dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10 mx-4 relative z-10">
                                <Icon name="event_note" size={40} className="mb-2 text-gray-300" />
                                <p className="text-sm font-medium text-gray-500">Nenhum histórico recente.</p>
                            </div>
                        ) : (
                            history.map((h, idx) => {
                                const themeColors: any = {
                                    blue: { dot: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-100 dark:border-blue-900/30' },
                                    green: { dot: 'bg-green-500', text: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/10', border: 'border-green-100 dark:border-green-900/30' },
                                    red: { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/10', border: 'border-red-100 dark:border-red-900/30' },
                                    orange: { dot: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/10', border: 'border-orange-100 dark:border-orange-900/30' },
                                    purple: { dot: 'bg-purple-500', text: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/10', border: 'border-purple-100 dark:border-purple-900/30' },
                                    gray: { dot: 'bg-gray-400', text: 'text-gray-600 dark:text-gray-400', bg: 'bg-white dark:bg-white/5', border: 'border-gray-200 dark:border-white/10' },
                                    indigo: { dot: 'bg-indigo-500', text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/10', border: 'border-indigo-100 dark:border-indigo-900/30' },
                                };
                                const theme = themeColors[h.themeColor] || themeColors.gray;

                                return (
                                    <div key={idx} className="relative pl-14 pb-6 group last:pb-0">
                                        {/* Ponto na Linha */}
                                        <div className={`absolute top-4 left-6 -translate-x-1/2 size-3.5 rounded-full border-[2px] border-white dark:border-[#0d1116] shadow-sm z-10 ring-2 ring-opacity-20 ${theme.dot} ring-gray-400`} />

                                        {/* Card do Evento */}
                                        <div className={`rounded-2xl p-4 border ${theme.bg} ${theme.border} relative transition-all hover:shadow-md`}>
                                            <div className="flex justify-between items-start mb-2 gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className={`p-1.5 rounded-lg ${theme.text.replace('text-', 'bg-').replace('600','100').replace('400','900/20')} bg-opacity-10`}>
                                                        <Icon name={h.icon} size={18} className={theme.text} />
                                                    </div>
                                                    <span className={`text-sm font-bold ${theme.text} uppercase tracking-tight truncate`}>
                                                        {h.actionLabel}
                                                    </span>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <span className="block text-xs font-bold text-gray-900 dark:text-white">{h.displayDate}</span>
                                                    <span className="block text-[10px] text-gray-400 font-medium">{h.displayTime}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 mb-3 px-1">
                                                <div className="size-5 rounded-full bg-white dark:bg-white/10 border border-gray-100 dark:border-white/5 flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-gray-400">
                                                    {h.user.charAt(0)}
                                                </div>
                                                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                                    {h.user}
                                                </span>
                                            </div>

                                            {/* Detalhes de Quantidade */}
                                            {(h.newValue !== undefined || h.reason) && (
                                                <div className="mt-3 pt-3 border-t border-dashed border-black/5 dark:border-white/10">
                                                    {h.newValue !== undefined && (
                                                        <div className="flex justify-between items-center text-sm">
                                                            <span className="text-gray-500 dark:text-gray-400 font-medium text-xs uppercase">Quantidade Registrada</span>
                                                            <span className="font-mono font-black text-gray-900 dark:text-white text-lg">
                                                                {h.newValue} <span className="text-xs font-normal text-gray-400">un</span>
                                                            </span>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Motivo (Se houver) */}
                                                    {h.reason && (
                                                        <div className="mt-3 text-xs font-medium text-orange-800 dark:text-orange-200 bg-orange-100 dark:bg-orange-900/30 p-2.5 rounded-lg border border-orange-200 dark:border-orange-800/50 flex items-start gap-2">
                                                            <Icon name="format_quote" size={14} className="shrink-0 opacity-50" />
                                                            <span className="italic leading-relaxed">{h.reason}</span>
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
        </div>

        {/* Footer Action (Mobile Only Fixed, Desktop Included) */}
        {onAction && (
            <div className="p-4 bg-white dark:bg-[#181c22] border-t border-gray-200 dark:border-white/5 shrink-0 z-20 md:rounded-b-3xl">
               <button 
                 onClick={() => onAction('primary')}
                 className="w-full md:w-auto md:ml-auto px-8 py-3 bg-primary text-white rounded-xl font-bold text-base shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all flex items-center justify-center gap-2 active:scale-95"
               >
                  {actionLabel || 'Ação'}
                  <Icon name="arrow_forward" size={20} />
               </button>
            </div>
        )}

      </div>
    </div>,
    document.body
  );
};
