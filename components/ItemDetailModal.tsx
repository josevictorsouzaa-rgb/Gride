import React, { useMemo } from 'react';
import { Icon } from './Icon';

interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any | null;
  onAction?: (action: string) => void; // Optional action button callback
  actionLabel?: string;
}

// Helper to generate mock financial/history data if missing (simulating backend)
const enrichItemData = (item: any) => {
  if (!item) return null;

  // Generate deterministic pseudo-random numbers based on name length
  const seed = item.name ? item.name.length : 10;
  
  const cost = item.costPrice || (seed * 12.5) + 20;
  const price = item.salesPrice || cost * 1.6;
  const stock = item.balance || item.qty || item.countedQty || 10;
  const totalValue = cost * stock;
  
  // Mock History if empty
  const history = item.history || [
    { date: 'Hoje, 10:30', user: 'Sistema', action: 'Reserva de Pedido', oldValue: stock + 2, newValue: stock },
    { date: '20/10/2023', user: 'Carlos Silva', action: 'Inventário Cíclico', oldValue: stock - 5, newValue: stock + 2 },
    { date: '15/09/2023', user: 'Mariana Santos', action: 'Entrada NF-e 4029', oldValue: stock - 20, newValue: stock - 5 },
    { date: '01/09/2023', user: 'Sistema', action: 'Ajuste Parametrização', oldValue: 'Curva B', newValue: 'Curva A' },
  ];

  const abc = item.abcCategory || (totalValue > 5000 ? 'A' : totalValue > 1000 ? 'B' : 'C');

  return {
    ...item,
    sku: item.ref || item.sku || '---',
    costPrice: cost,
    salesPrice: price,
    totalStockValue: totalValue,
    abcCategory: abc,
    history: history,
    currentStock: stock
  };
};

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ isOpen, onClose, item, onAction, actionLabel }) => {
  const data = useMemo(() => enrichItemData(item), [item]);

  if (!isOpen || !data) return null;

  return (
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
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight line-clamp-1">{data.name}</h2>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        data.abcCategory === 'A' ? 'bg-green-100 text-green-700' :
                        data.abcCategory === 'B' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                    }`}>
                        Curva {data.abcCategory}
                    </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                   <span className="px-2 py-0.5 bg-gray-200 dark:bg-white/10 rounded text-xs font-bold text-gray-600 dark:text-gray-300">
                     SKU: {data.sku}
                   </span>
                   <span className="text-sm text-gray-500">{data.brand || 'Marca n/a'}</span>
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
                 <p className="text-xl font-bold text-gray-900 dark:text-white">R$ {data.costPrice.toFixed(2)}</p>
              </div>
              <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20">
                 <p className="text-xs font-bold uppercase text-green-600 dark:text-green-400 mb-1">Preço Venda</p>
                 <p className="text-xl font-bold text-gray-900 dark:text-white">R$ {data.salesPrice.toFixed(2)}</p>
              </div>
              <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/20">
                 <p className="text-xs font-bold uppercase text-purple-600 dark:text-purple-400 mb-1">Valor em Estoque</p>
                 <p className="text-xl font-bold text-gray-900 dark:text-white">R$ {data.totalStockValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
           </div>

           {/* Stock Info Bar */}
           <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
              <div className="text-center flex-1">
                 <p className="text-xs text-gray-500 uppercase font-bold">Estoque Atual</p>
                 <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.currentStock} <span className="text-xs font-normal text-gray-500">un</span></p>
              </div>
              <div className="h-10 w-px bg-gray-300 dark:bg-gray-600" />
              <div className="text-center flex-1">
                 <p className="text-xs text-gray-500 uppercase font-bold">Loc. Principal</p>
                 <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">{data.loc || data.location || '---'}</p>
              </div>
              <div className="h-10 w-px bg-gray-300 dark:bg-gray-600" />
               <div className="text-center flex-1">
                 <p className="text-xs text-gray-500 uppercase font-bold">Giro (Dias)</p>
                 <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">45 dias</p>
              </div>
           </div>

           {/* History Timeline (Lastro) */}
           <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                 <Icon name="history_edu" size={18} className="text-primary" />
                 Lastro de Movimentação (Audit Trail)
              </h3>
              <div className="border border-gray-200 dark:border-card-border rounded-xl overflow-hidden">
                 <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-white/5 text-gray-500">
                       <tr>
                          <th className="p-3 font-medium">Data</th>
                          <th className="p-3 font-medium">Usuário</th>
                          <th className="p-3 font-medium">Ação</th>
                          <th className="p-3 font-medium text-right">Alteração</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                       {data.history.map((h: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/5">
                             <td className="p-3 text-gray-700 dark:text-gray-300 font-medium">{h.date}</td>
                             <td className="p-3 text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                <div className="size-5 rounded-full bg-gray-200 dark:bg-gray-600" />
                                {h.user}
                             </td>
                             <td className="p-3 text-gray-600 dark:text-gray-400">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/5">
                                   {h.action}
                                </span>
                             </td>
                             <td className="p-3 text-right">
                                {h.oldValue !== undefined && (
                                    <span className="font-mono text-xs text-gray-500">
                                        {h.oldValue} <Icon name="arrow_right_alt" size={12} className="align-middle mx-1" /> 
                                        <span className={h.newValue !== h.oldValue ? 'font-bold text-gray-900 dark:text-white' : ''}>{h.newValue}</span>
                                    </span>
                                )}
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>

        <div className="p-5 border-t border-gray-200 dark:border-card-border bg-gray-50 dark:bg-black/20 flex gap-3">
           <button onClick={onClose} className="flex-1 py-3 bg-white dark:bg-surface-dark border border-gray-300 dark:border-card-border rounded-xl font-bold text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
              Fechar
           </button>
           {onAction && (
               <button 
                 onClick={() => onAction('primary')}
                 className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
               >
                  {actionLabel || 'Ação'}
                  <Icon name="arrow_forward" size={18} />
               </button>
           )}
        </div>

      </div>
    </div>
  );
};
