
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { api, Cycle } from '../services/api';
import { User } from '../types';

interface ReportGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReportGeneratorModal: React.FC<ReportGeneratorModalProps> = ({ isOpen, onClose }) => {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Configuração do Relatório
  const [selectedCycleId, setSelectedCycleId] = useState<string | number>('all');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['ok', 'divergent']);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
      'sku', 'product', 'location', 'systemQty', 'countedQty', 'diffQty', 'totalDiff', 'user', 'date', 'status'
  ]);

  const AVAILABLE_COLUMNS = [
      { id: 'sku', label: 'SKU / Ref' },
      { id: 'product', label: 'Produto' },
      { id: 'location', label: 'Localização' },
      { id: 'systemQty', label: 'Qtd. Sistema' },
      { id: 'countedQty', label: 'Qtd. Contada' },
      { id: 'diffQty', label: 'Diferença (Un)' },
      { id: 'cost', label: 'Custo Unit.' },
      { id: 'price', label: 'Venda Unit.' },
      { id: 'totalDiff', label: 'Impacto R$' },
      { id: 'user', label: 'Responsável' },
      { id: 'date', label: 'Data/Hora' },
      { id: 'status', label: 'Status' }
  ];

  useEffect(() => {
      if (isOpen) {
          setLoadingData(true);
          Promise.all([api.getCycles(), api.getUsers()])
              .then(([c, u]) => {
                  setCycles(c);
                  setUsers(u);
                  // Auto-selecionar ciclo ativo
                  const active = c.find(cy => cy.active);
                  if(active) setSelectedCycleId(active.id);
                  setLoadingData(false);
              })
              .catch(() => setLoadingData(false));
      }
  }, [isOpen]);

  const toggleColumn = (id: string) => {
      setSelectedColumns(prev => 
          prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
      );
  };

  const toggleUser = (name: string) => {
      setSelectedUsers(prev => 
          prev.includes(name) ? prev.filter(u => u !== name) : [...prev, name]
      );
  };

  const toggleStatus = (st: string) => {
      setSelectedStatuses(prev => 
          prev.includes(st) ? prev.filter(s => s !== st) : [...prev, st]
      );
  };

  // --- GERAR EXCEL (CSV) ---
  const generateCSV = async () => {
      setGenerating(true);
      try {
          const data = await api.generateReport({
              cycleId: selectedCycleId,
              statuses: selectedStatuses,
              users: selectedUsers,
              columns: selectedColumns
          });

          if (data.length === 0) {
              alert("Nenhum dado encontrado com os filtros selecionados.");
              setGenerating(false);
              return;
          }

          // Converter JSON para CSV
          const headers = selectedColumns.map(colId => AVAILABLE_COLUMNS.find(ac => ac.id === colId)?.label || colId);
          const csvRows = [headers.join(';')]; // Header Row (Ponto e vírgula para Excel Brasil)

          data.forEach(row => {
              const values = selectedColumns.map(colId => {
                  const label = AVAILABLE_COLUMNS.find(ac => ac.id === colId)?.label || '';
                  let val = row[label] || '';
                  if (typeof val === 'string') val = `"${val.replace(/"/g, '""')}"`; // Escape quotes
                  if (typeof val === 'number') val = val.toString().replace('.', ','); // Formato BR number
                  return val;
              });
              csvRows.push(values.join(';'));
          });

          const csvString = csvRows.join('\n');
          const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' }); // BOM para UTF-8 Excel
          const url = URL.createObjectURL(blob);
          
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", `relatorio_inventario_${new Date().toISOString().slice(0,10)}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

      } catch (e) {
          alert("Erro ao gerar relatório.");
          console.error(e);
      } finally {
          setGenerating(false);
      }
  };

  // --- GERAR PDF (Via Print Dialog) ---
  const generatePrint = async () => {
      setGenerating(true);
      try {
          const data = await api.generateReport({
              cycleId: selectedCycleId,
              statuses: selectedStatuses,
              users: selectedUsers,
              columns: selectedColumns
          });

          if (data.length === 0) {
              alert("Nenhum dado encontrado.");
              setGenerating(false);
              return;
          }

          // Cria uma janela popup limpa para impressão
          const printWindow = window.open('', '_blank');
          if (!printWindow) return;

          const headers = selectedColumns.map(colId => AVAILABLE_COLUMNS.find(ac => ac.id === colId)?.label || colId);
          
          const tableHtml = `
            <html>
            <head>
                <title>Relatório de Inventário</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; }
                    h1 { font-size: 18px; margin-bottom: 5px; }
                    .meta { font-size: 12px; color: #666; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; font-size: 10px; }
                    th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                    th { background-color: #f2f2f2; font-weight: bold; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    @media print { @page { margin: 1cm; size: landscape; } }
                </style>
            </head>
            <body>
                <h1>Relatório de Inventário</h1>
                <div class="meta">Gerado em: ${new Date().toLocaleString()} | Ciclo: ${selectedCycleId === 'all' ? 'Todos' : cycles.find(c => c.id == selectedCycleId)?.name}</div>
                <table>
                    <thead>
                        <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                    </thead>
                    <tbody>
                        ${data.map(row => `
                            <tr>
                                ${selectedColumns.map(colId => {
                                    const label = AVAILABLE_COLUMNS.find(ac => ac.id === colId)?.label || '';
                                    let val = row[label];
                                    if (typeof val === 'number' && (label.includes('R$') || label.includes('Custo') || label.includes('Venda'))) {
                                        val = val.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
                                    }
                                    return `<td>${val || '-'}</td>`;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
          `;

          printWindow.document.write(tableHtml);
          printWindow.document.close();

      } catch (e) {
          console.error(e);
      } finally {
          setGenerating(false);
      }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white dark:bg-surface-dark w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-up">
            
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#181c22] flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Icon name="assignment" className="text-primary" />
                        Gerador de Relatórios
                    </h2>
                    <p className="text-xs text-gray-500">Exporte dados customizados do inventário</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors">
                    <Icon name="close" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                
                {/* 1. Seleção de Dados */}
                <section>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 border-b border-gray-200 dark:border-white/10 pb-2">
                        1. Filtros de Dados
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-2">Ciclo de Contagem</label>
                            <select 
                                value={selectedCycleId} 
                                onChange={(e) => setSelectedCycleId(e.target.value)}
                                className="w-full p-3 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-black/20 text-sm font-medium focus:ring-primary"
                            >
                                <option value="all">Todos os Ciclos</option>
                                {cycles.map(c => (
                                    <option key={c.id} value={c.id}>{c.name} {c.active ? '(Ativo)' : ''}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-2">Status do Item</label>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => toggleStatus('ok')}
                                    className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-colors ${selectedStatuses.includes('ok') ? 'bg-green-100 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}
                                >
                                    Corretos / Ajustados
                                </button>
                                <button 
                                    onClick={() => toggleStatus('divergent')}
                                    className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-colors ${selectedStatuses.includes('divergent') ? 'bg-red-100 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}
                                >
                                    Divergências
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4">
                        <label className="block text-xs font-bold text-gray-500 mb-2">Usuários (Opcional - Selecione para filtrar)</label>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 dark:border-white/10 rounded-xl">
                            {users.map(u => (
                                <button
                                    key={u.id}
                                    onClick={() => toggleUser(u.name)}
                                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                                        selectedUsers.includes(u.name) 
                                        ? 'bg-blue-600 text-white border-blue-600' 
                                        : 'bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10'
                                    }`}
                                >
                                    {u.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 2. Seleção de Colunas */}
                <section>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 border-b border-gray-200 dark:border-white/10 pb-2">
                        2. Colunas do Relatório
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {AVAILABLE_COLUMNS.map(col => (
                            <button
                                key={col.id}
                                onClick={() => toggleColumn(col.id)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                                    selectedColumns.includes(col.id)
                                    ? 'bg-primary/10 border-primary text-primary'
                                    : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500'
                                }`}
                            >
                                <Icon name={selectedColumns.includes(col.id) ? "check_box" : "check_box_outline_blank"} size={18} />
                                {col.label}
                            </button>
                        ))}
                    </div>
                </section>

            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#181c22] flex justify-end gap-3">
                <button 
                    onClick={onClose}
                    className="px-6 py-3 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                >
                    Cancelar
                </button>
                
                <button 
                    onClick={generatePrint}
                    disabled={generating}
                    className="px-6 py-3 rounded-xl font-bold bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-white/20 transition-colors flex items-center gap-2"
                >
                    <Icon name="print" /> Imprimir / PDF
                </button>

                <button 
                    onClick={generateCSV}
                    disabled={generating}
                    className="px-6 py-3 rounded-xl font-bold bg-green-600 text-white hover:bg-green-700 shadow-lg hover:shadow-green-600/20 transition-all flex items-center gap-2"
                >
                    {generating ? <Icon name="sync" className="animate-spin" /> : <Icon name="download" />}
                    Baixar Excel (.csv)
                </button>
            </div>

        </div>
    </div>,
    document.body
  );
};
