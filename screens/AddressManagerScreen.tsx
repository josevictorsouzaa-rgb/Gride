
import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '../components/Icon';
import { WMSAddress } from '../types';
import { api } from '../services/api';

interface AddressManagerScreenProps {
  onBack: () => void;
}

export const AddressManagerScreen: React.FC<AddressManagerScreenProps> = ({ onBack }) => {
  const [addresses, setAddresses] = useState<WMSAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [printSize, setPrintSize] = useState<'6030' | '6040'>('6040');
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // --- FILTROS DA LISTA ---
  const [filterGalpao, setFilterGalpao] = useState('');
  const [filterEstante, setFilterEstante] = useState('');
  const [filterNivel, setFilterNivel] = useState('');

  // --- ESTADO DO GERADOR ---
  const [genGalpao, setGenGalpao] = useState('01');
  const [genEstanteStart, setGenEstanteStart] = useState(1);
  const [genEstanteEnd, setGenEstanteEnd] = useState(1); // Default to single
  
  const [genNivelStart, setGenNivelStart] = useState(1);
  const [genNivelEnd, setGenNivelEnd] = useState(4);

  // Toggle para facilitar UX
  const [isSingleShelf, setIsSingleShelf] = useState(false);
  const [isSingleLevel, setIsSingleLevel] = useState(false);

  // Desktop Restriction Check
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    loadAddresses();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadAddresses = async () => {
    setLoading(true);
    const data = await api.getAddresses();
    setAddresses(data);
    setLoading(false);
    return data;
  };

  // --- GENERATOR LOGIC ---
  const handleGenerate = async () => {
    // Validações
    const finalEstanteEnd = isSingleShelf ? genEstanteStart : genEstanteEnd;
    const finalNivelEnd = isSingleLevel ? genNivelStart : genNivelEnd;

    if (finalEstanteEnd < genEstanteStart) {
        alert('Estante Final não pode ser menor que a Inicial.');
        return;
    }
    if (finalNivelEnd < genNivelStart) {
        alert('Nível Final não pode ser menor que o Inicial.');
        return;
    }

    const newAddresses: Partial<WMSAddress>[] = [];
    const galpaoStr = genGalpao.padStart(2, '0');

    // Loop Estantes
    for (let e = genEstanteStart; e <= finalEstanteEnd; e++) {
        const estanteStr = e.toString().padStart(2, '0');
        
        // Loop Níveis (Prateleiras/Bandejas)
        for (let p = genNivelStart; p <= finalNivelEnd; p++) {
            const prateleiraStr = p.toString().padStart(2, '0');
            
            // Format: LOC-G01-E05-P02
            const code = `LOC-G${galpaoStr}-E${estanteStr}-P${prateleiraStr}`;
            const desc = `Galpão ${galpaoStr}, Estante ${estanteStr}, Prateleira ${prateleiraStr}`;

            newAddresses.push({
                code,
                description: desc,
                type: 'shelf'
            });
        }
    }

    if (newAddresses.length === 0) {
        alert("Nenhum endereço gerado. Verifique os intervalos.");
        return;
    }

    if (confirm(`Gerar ${newAddresses.length} endereços?\nDe: G${galpaoStr}-E${genEstanteStart} a E${finalEstanteEnd}\nNíveis: ${genNivelStart} a ${finalNivelEnd}`)) {
        setLoading(true);
        try {
            const result = await api.saveAddresses(newAddresses);
            if (result && result.success) {
                // 1. Atualizar lista do banco
                const updatedData = await api.getAddresses();
                setAddresses(updatedData);

                // 2. Identificar IDs dos itens recém gerados (ou existentes que batem com o código)
                const codesGenerated = new Set(newAddresses.map(a => a.code));
                const newSelection = new Set<number>();
                
                updatedData.forEach(addr => {
                    if (codesGenerated.has(addr.code)) {
                        newSelection.add(addr.id);
                    }
                });

                // 3. Auto-selecionar para permitir impressão imediata
                setSelectedIds(newSelection);
                
                // 4. Auto-filtrar a lista para focar no que foi feito
                setFilterGalpao(genGalpao);
                setFilterEstante(''); 
                setFilterNivel('');

                alert(`Concluído!\n${result.count} endereços criados.\n${result.skipped || 0} já existiam.\n\nOs itens foram selecionados automaticamente para impressão.`);
            } else {
                alert('Erro ao processar resposta do servidor.');
            }
        } catch (error) {
            console.error(error);
            alert('Falha na comunicação com o servidor.');
        }
        setLoading(false);
    }
  };

  // --- FILTER LOGIC (PARSING) ---
  const filteredAddresses = useMemo(() => {
    return addresses.filter(addr => {
        const code = addr.code.toUpperCase();
        
        // Filtro Galpão (Gxx)
        if (filterGalpao) {
            const gPart = `G${filterGalpao.padStart(2, '0')}`;
            if (!code.includes(gPart)) return false;
        }

        // Filtro Estante (Exx)
        if (filterEstante) {
            const ePart = `E${filterEstante.padStart(2, '0')}`;
            if (!code.includes(ePart)) return false;
        }

        // Filtro Nível (Pxx)
        if (filterNivel) {
            const pPart = `P${filterNivel.padStart(2, '0')}`;
            if (!code.includes(pPart)) return false;
        }

        return true;
    });
  }, [addresses, filterGalpao, filterEstante, filterNivel]);

  // --- SELECTION LOGIC ---
  const toggleSelect = (id: number) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
      if (selectedIds.size === filteredAddresses.length && filteredAddresses.length > 0) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(filteredAddresses.map(a => a.id)));
      }
  };

  // --- PRINT LOGIC ---
  const handlePrint = () => {
    const itemsToPrint = addresses.filter(a => selectedIds.has(a.id));
    if (itemsToPrint.length === 0) return;

    const printArea = document.getElementById('print-area');
    if (!printArea) return;

    // 1. Gerar HTML das etiquetas
    const labelsHtml = itemsToPrint.map(addr => `
        <div class="label-${printSize}">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${addr.code}" style="width: 22mm; height: 22mm;" />
            <div class="label-content">
                <div class="label-code" style="font-size: 14px; font-weight: 800;">${addr.code}</div>
                <div class="label-desc" style="font-size: 10px; margin-top: 2px;">${addr.description}</div>
                <div class="label-brand" style="margin-top: 4px; font-size: 8px;">GRIDE WMS</div>
            </div>
        </div>
    `).join('');

    printArea.innerHTML = labelsHtml;

    // 2. Injetar Estilo de Página Dinâmico (Força o tamanho correto na impressora)
    const styleId = 'dynamic-page-size';
    const oldStyle = document.getElementById(styleId);
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = styleId;
    
    // Define o tamanho exato da página (60mm x 40mm ou 30mm)
    const width = '60mm';
    const height = printSize === '6040' ? '40mm' : '30mm';
    
    // CSS reforçado para garantir que o navegador respeite o tamanho
    style.innerHTML = `
        @media print {
            @page {
                size: ${width} ${height};
                margin: 0;
            }
            html, body {
                width: ${width} !important;
                height: ${height} !important;
                min-width: ${width} !important;
                min-height: ${height} !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden !important;
            }
            #print-area {
                width: ${width} !important;
                display: block !important;
            }
            body > *:not(#print-area) {
                display: none !important;
            }
        }
    `;
    document.head.appendChild(style);

    // 3. Imprimir
    // Pequeno delay para garantir renderização do CSS
    setTimeout(() => window.print(), 100);
  };

  if (!isDesktop) {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center text-gray-500">
              <Icon name="desktop_windows" size={64} className="mb-4 text-primary opacity-50" />
              <h2 className="text-xl font-bold">Acesso Restrito</h2>
              <p>Este módulo requer uma tela maior (Desktop).</p>
              <button onClick={onBack} className="mt-6 px-6 py-2 bg-primary text-white rounded-lg">Voltar</button>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark overflow-hidden">
        
        {/* Header Toolbar */}
        <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-surface-dark border-b border-gray-200 dark:border-white/5 shadow-sm z-10">
             <div className="flex items-center gap-4">
                 <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors">
                     <Icon name="arrow_back" size={24} />
                 </button>
                 <div>
                     <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Icon name="warehouse" className="text-primary" />
                        Gestor de Endereçamento WMS
                     </h1>
                     <p className="text-xs text-gray-500">Cadastre a estrutura física e imprima etiquetas.</p>
                 </div>
             </div>
             
             {/* Print Actions - Only Visible when Items Selected */}
             <div className={`flex items-center gap-3 transition-all duration-300 ${selectedIds.size > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[-10px] pointer-events-none'}`}>
                 <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10">
                    <span className="text-xs font-bold text-gray-500">Etiqueta:</span>
                    <select 
                        value={printSize} 
                        onChange={(e) => setPrintSize(e.target.value as any)}
                        className="bg-transparent text-sm font-bold text-gray-900 dark:text-white outline-none cursor-pointer"
                    >
                        <option value="6040">60x40mm</option>
                        <option value="6030">60x30mm</option>
                    </select>
                 </div>

                 <button 
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold bg-gray-900 dark:bg-white dark:text-black text-white hover:scale-105 shadow-lg transition-all animate-bounce-subtle"
                 >
                    <Icon name="print" size={20} />
                    <span>Imprimir ({selectedIds.size})</span>
                 </button>
             </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
            
            {/* LEFT: Filterable List */}
            <div className="flex-1 flex flex-col border-r border-gray-200 dark:border-white/5 bg-white dark:bg-surface-dark max-w-4xl">
                
                {/* Granular Filters */}
                <div className="p-4 border-b border-gray-200 dark:border-white/5 grid grid-cols-4 gap-3 bg-gray-50 dark:bg-black/20">
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Galpão</label>
                        <input 
                            value={filterGalpao}
                            onChange={e => setFilterGalpao(e.target.value)}
                            placeholder="Todos"
                            className="w-full mt-1 p-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/10 rounded-lg text-sm text-center font-bold"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Estante</label>
                        <input 
                            value={filterEstante}
                            onChange={e => setFilterEstante(e.target.value)}
                            placeholder="Todas"
                            className="w-full mt-1 p-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/10 rounded-lg text-sm text-center font-bold"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Nível/Bandeja</label>
                        <input 
                            value={filterNivel}
                            onChange={e => setFilterNivel(e.target.value)}
                            placeholder="Todos"
                            className="w-full mt-1 p-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/10 rounded-lg text-sm text-center font-bold"
                        />
                    </div>
                    <div className="flex items-end pb-1">
                        <span className="text-xs font-bold text-gray-500">
                            {filteredAddresses.length} endereços encontrados
                        </span>
                    </div>
                </div>

                {/* Table Header */}
                <div className="flex items-center px-4 py-2 bg-gray-100 dark:bg-white/5 border-b border-gray-200 dark:border-white/5 text-xs font-bold text-gray-500 uppercase">
                    <div className="w-10 flex justify-center">
                        <input 
                            type="checkbox" 
                            checked={filteredAddresses.length > 0 && selectedIds.size === filteredAddresses.length}
                            onChange={toggleSelectAll}
                            className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        />
                    </div>
                    <div className="w-40">Código (QR)</div>
                    <div className="flex-1">Descrição Local</div>
                    <div className="w-24 text-center">Tipo</div>
                </div>

                {/* Table List */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-10 text-center text-gray-400 animate-pulse">Carregando dados...</div>
                    ) : filteredAddresses.length === 0 ? (
                        <div className="p-10 text-center text-gray-400">Nenhum endereço com esses filtros.</div>
                    ) : (
                        filteredAddresses.map(addr => (
                            <div 
                                key={addr.id} 
                                onClick={() => toggleSelect(addr.id)}
                                className={`flex items-center px-4 py-3 border-b border-gray-100 dark:border-white/5 hover:bg-blue-50 dark:hover:bg-white/10 transition-colors text-sm cursor-pointer ${selectedIds.has(addr.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                            >
                                <div className="w-10 flex justify-center">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedIds.has(addr.id)}
                                        onChange={() => {}} 
                                        className="rounded border-gray-300 text-primary focus:ring-primary pointer-events-none"
                                    />
                                </div>
                                <div className="w-40 font-mono font-bold text-primary">{addr.code}</div>
                                <div className="flex-1 text-gray-700 dark:text-gray-300">{addr.description}</div>
                                <div className="w-24 text-center">
                                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-white/10 rounded text-xs font-medium">
                                        {addr.type}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* RIGHT: Generator Panel */}
            <div className="w-96 bg-gray-50 dark:bg-[#12171e] p-6 flex flex-col shadow-inner overflow-y-auto">
                <div className="mb-6 flex items-center gap-3 text-gray-800 dark:text-white">
                    <div className="p-2 bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-white/5">
                        <Icon name="library_add" className="text-primary" />
                    </div>
                    <h2 className="font-bold text-lg">Novo Cadastro</h2>
                </div>

                <div className="space-y-6 flex-1">
                    
                    {/* Warehouse Input */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Galpão / Corredor</label>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-400 font-mono">G</span>
                            <input 
                                type="text"
                                maxLength={2}
                                value={genGalpao}
                                onChange={e => setGenGalpao(e.target.value)}
                                className="flex-1 p-3 rounded-xl border border-gray-200 dark:border-card-border bg-white dark:bg-surface-dark font-bold text-center focus:ring-2 focus:ring-primary outline-none"
                            />
                        </div>
                    </div>

                    {/* Shelf Section */}
                    <div className="p-4 bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-white/5 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Estantes</label>
                            <button 
                                onClick={() => setIsSingleShelf(!isSingleShelf)}
                                className="text-[10px] font-bold text-primary hover:underline"
                            >
                                {isSingleShelf ? 'Mudar para Faixa' : 'Apenas Uma'}
                            </button>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <div className="flex-1">
                                <label className="text-[10px] text-gray-400 mb-1 block">De</label>
                                <input 
                                    type="number" 
                                    value={genEstanteStart}
                                    onChange={e => setGenEstanteStart(Number(e.target.value))}
                                    className="w-full p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-center font-bold"
                                />
                            </div>
                            {!isSingleShelf && (
                                <>
                                    <Icon name="arrow_forward" className="text-gray-300 mt-4" />
                                    <div className="flex-1">
                                        <label className="text-[10px] text-gray-400 mb-1 block">Até</label>
                                        <input 
                                            type="number" 
                                            value={genEstanteEnd}
                                            onChange={e => setGenEstanteEnd(Number(e.target.value))}
                                            className="w-full p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-center font-bold"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Levels Section */}
                    <div className="p-4 bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-white/5 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Prateleiras / Níveis</label>
                            <button 
                                onClick={() => setIsSingleLevel(!isSingleLevel)}
                                className="text-[10px] font-bold text-primary hover:underline"
                            >
                                {isSingleLevel ? 'Mudar para Faixa' : 'Apenas Um'}
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex-1">
                                <label className="text-[10px] text-gray-400 mb-1 block">De</label>
                                <input 
                                    type="number" 
                                    value={genNivelStart}
                                    onChange={e => setGenNivelStart(Number(e.target.value))}
                                    className="w-full p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-center font-bold"
                                />
                            </div>
                            {!isSingleLevel && (
                                <>
                                    <Icon name="arrow_forward" className="text-gray-300 mt-4" />
                                    <div className="flex-1">
                                        <label className="text-[10px] text-gray-400 mb-1 block">Até</label>
                                        <input 
                                            type="number" 
                                            value={genNivelEnd}
                                            onChange={e => setGenNivelEnd(Number(e.target.value))}
                                            className="w-full p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-center font-bold"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl">
                        <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-2">Prévia da Geração</p>
                        <div className="space-y-1 font-mono text-xs text-blue-800 dark:text-blue-300 opacity-80">
                            <p>LOC-G{genGalpao.padStart(2,'0')}-E{genEstanteStart.toString().padStart(2,'0')}-P{genNivelStart.toString().padStart(2,'0')}</p>
                            {(isSingleShelf && isSingleLevel) ? null : <p>...</p>}
                            {(isSingleShelf && isSingleLevel) ? null : (
                                <p>LOC-G{genGalpao.padStart(2,'0')}-E{(isSingleShelf ? genEstanteStart : genEstanteEnd).toString().padStart(2,'0')}-P{(isSingleLevel ? genNivelStart : genNivelEnd).toString().padStart(2,'0')}</p>
                            )}
                        </div>
                        <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800 text-xs font-bold text-right text-blue-600">
                            Total a gerar: {
                                ((isSingleShelf ? genEstanteStart : genEstanteEnd) - genEstanteStart + 1) * 
                                ((isSingleLevel ? genNivelStart : genNivelEnd) - genNivelStart + 1)
                            }
                        </div>
                    </div>

                </div>

                <button 
                    onClick={handleGenerate}
                    disabled={loading}
                    className={`w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all active:scale-95 flex items-center justify-center gap-2 mt-4 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {loading ? <Icon name="sync" className="animate-spin" /> : <Icon name="auto_awesome" />}
                    {loading ? 'Processando...' : 'Gerar e Salvar'}
                </button>
            </div>

        </div>
    </div>
  );
};
