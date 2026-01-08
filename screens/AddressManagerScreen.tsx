
import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '../components/Icon';
import { WMSAddress } from '../types';
import { api, Warehouse } from '../services/api';
import QRCode from 'qrcode';

interface AddressManagerScreenProps {
  onBack: () => void;
}

export const AddressManagerScreen: React.FC<AddressManagerScreenProps> = ({ onBack }) => {
  const [addresses, setAddresses] = useState<WMSAddress[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [printSize, setPrintSize] = useState<'6030' | '6040'>('6040');
  
  // States do Gerador (Modal)
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);
  const [genGalpaoSigla, setGenGalpaoSigla] = useState('');
  const [genEstanteStart, setGenEstanteStart] = useState(1);
  const [genEstanteEnd, setGenEstanteEnd] = useState(1);
  const [genNivelStart, setGenNivelStart] = useState(1);
  const [genNivelEnd, setGenNivelEnd] = useState(4);
  const [isSingleShelf, setIsSingleShelf] = useState(false);
  const [isSingleLevel, setIsSingleLevel] = useState(false);

  // States do Gerenciador de Galpões (Modal)
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [newWarehouseSigla, setNewWarehouseSigla] = useState('');
  const [newWarehouseDesc, setNewWarehouseDesc] = useState('');

  // States de Visualização (Expanded Accordions)
  const [expandedWarehouses, setExpandedWarehouses] = useState<Set<string>>(new Set());
  const [expandedShelves, setExpandedShelves] = useState<Set<string>>(new Set()); // Key: "GALPAO-ESTANTE"

  // Selection for Print
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    refreshData();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const refreshData = async () => {
    setLoading(true);
    const [addrData, warData] = await Promise.all([
        api.getAddresses(),
        api.getWarehouses()
    ]);
    setAddresses(addrData);
    setWarehouses(warData);
    if (warData.length > 0 && !genGalpaoSigla) {
        setGenGalpaoSigla(warData[0].sigla);
    }
    setLoading(false);
  };

  // --- AGRUPAMENTO DE DADOS (HIERARQUIA) ---
  const hierarchicalData = useMemo(() => {
      const groups = new Map<string, Map<string, WMSAddress[]>>();

      addresses.forEach(addr => {
          const parts = addr.code.split('-');
          let g = 'GERAL';
          let e = '00';
          
          if (parts.length >= 4) {
             g = parts[1]; // Galpão
             e = parts[2]; // Estante
          }

          if (!groups.has(g)) groups.set(g, new Map());
          
          const shelfMap = groups.get(g)!;
          if (!shelfMap.has(e)) shelfMap.set(e, []);
          
          shelfMap.get(e)!.push(addr);
      });

      // Ordenar chaves
      const sortedGroups = new Map([...groups.entries()].sort());
      for (const [g, shelfMap] of sortedGroups) {
          // Ordenar estantes (E01, E02...)
          sortedGroups.set(g, new Map([...shelfMap.entries()].sort()));
      }

      return sortedGroups;
  }, [addresses]);

  // --- WAREHOUSE MANAGEMENT ---
  const handleSaveWarehouse = async () => {
      if (!newWarehouseSigla) return alert('Digite a sigla (Ex: AT)');
      const res = await api.saveWarehouse({ 
          sigla: newWarehouseSigla.toUpperCase(), 
          descricao: newWarehouseDesc 
      });
      if (res.success) {
          setNewWarehouseSigla('');
          setNewWarehouseDesc('');
          const newWars = await api.getWarehouses();
          setWarehouses(newWars);
          setGenGalpaoSigla(newWarehouseSigla.toUpperCase());
      } else {
          alert('Erro: ' + (res.message || 'Falha ao salvar'));
      }
  };

  const handleDeleteWarehouse = async (id: number) => {
      if(confirm('Tem certeza? Isso remove apenas o cadastro do galpão, não os endereços.')) {
          await api.deleteWarehouse(id);
          const newWars = await api.getWarehouses();
          setWarehouses(newWars);
          if (newWars.length > 0) setGenGalpaoSigla(newWars[0].sigla);
          else setGenGalpaoSigla('');
      }
  };

  // --- GENERATOR ---
  const handleGenerate = async () => {
    if (!genGalpaoSigla) return alert("Selecione um galpão.");

    const finalEstanteEnd = isSingleShelf ? genEstanteStart : genEstanteEnd;
    const finalNivelEnd = isSingleLevel ? genNivelStart : genNivelEnd;

    if (finalEstanteEnd < genEstanteStart || finalNivelEnd < genNivelStart) {
        return alert('Intervalo inválido.');
    }

    const newAddresses: Partial<WMSAddress>[] = [];
    
    for (let e = genEstanteStart; e <= finalEstanteEnd; e++) {
        const estanteStr = `E${e.toString().padStart(2, '0')}`;
        for (let p = genNivelStart; p <= finalNivelEnd; p++) {
            const prateleiraStr = `P${p.toString().padStart(2, '0')}`;
            const code = `LOC-${genGalpaoSigla}-${estanteStr}-${prateleiraStr}`;
            const desc = `Galpão ${genGalpaoSigla}, Estante ${e}, Nível ${p}`;
            newAddresses.push({ code, description: desc, type: 'shelf' });
        }
    }

    if (confirm(`Gerar ${newAddresses.length} endereços? Duplicados serão ignorados.`)) {
        setLoading(true);
        const res = await api.saveAddresses(newAddresses);
        setLoading(false);
        if (res.success) {
            await refreshData();
            alert(`Criados: ${res.count}\nIgnorados: ${res.skipped}`);
            setIsGeneratorModalOpen(false);
        } else {
            alert('Erro ao salvar.');
        }
    }
  };

  // --- EXPANSION LOGIC ---
  const toggleWarehouse = (g: string) => {
      const newSet = new Set(expandedWarehouses);
      if (newSet.has(g)) newSet.delete(g);
      else newSet.add(g);
      setExpandedWarehouses(newSet);
  };

  const toggleShelf = (key: string) => {
      const newSet = new Set(expandedShelves);
      if (newSet.has(key)) newSet.delete(key);
      else newSet.add(key);
      setExpandedShelves(newSet);
  };

  // --- CASCADING SELECTION LOGIC ---
  const handleSelectId = (id: number) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  const handleSelectShelf = (items: WMSAddress[]) => {
      const allIds = items.map(i => i.id);
      const allSelected = allIds.every(id => selectedIds.has(id));
      
      const newSet = new Set(selectedIds);
      if (allSelected) {
          allIds.forEach(id => newSet.delete(id));
      } else {
          allIds.forEach(id => newSet.add(id));
      }
      setSelectedIds(newSet);
  };

  const handleSelectWarehouse = (shelfMap: Map<string, WMSAddress[]>) => {
      const allIds: number[] = [];
      shelfMap.forEach(items => items.forEach(i => allIds.push(i.id)));
      
      const allSelected = allIds.every(id => selectedIds.has(id));
      const newSet = new Set(selectedIds);
      
      if (allSelected) {
          allIds.forEach(id => newSet.delete(id));
      } else {
          allIds.forEach(id => newSet.add(id));
      }
      setSelectedIds(newSet);
  };

  // --- PRINT LOGIC (Standard: Levels) ---
  const executePrint = async (items: { code: string, g: string, e: string, p?: string }[]) => {
    const printArea = document.getElementById('print-area');
    if (!printArea) return;

    // Gerar QR Codes
    const qrMap = new Map<string, string>();
    try {
        const promises = items.map(async (item) => {
            const url = await QRCode.toDataURL(item.code, { margin: 0, width: 200 });
            return { code: item.code, url };
        });
        const results = await Promise.all(promises);
        results.forEach(r => qrMap.set(r.code, r.url));
    } catch (err) {
        console.error(err);
        return alert("Erro ao gerar QR Codes.");
    }

    const labelsHtml = items.map(item => {
        const qrSrc = qrMap.get(item.code);
        return `
        <div class="label-item">
            <div class="qr-container">
                <img src="${qrSrc}" />
            </div>
            <div class="info-container">
                <div class="info-row"><span class="key">G:</span><span class="val">${item.g}</span></div>
                <div class="info-row"><span class="key">E:</span><span class="val">${item.e.replace(/\D/g, '')}</span></div>
                ${item.p ? `<div class="info-row"><span class="key">P:</span><span class="val">${item.p.replace(/\D/g, '')}</span></div>` : ''}
                ${!item.p ? `<div class="info-row"><span class="key-lg">ESTANTE</span></div>` : ''}
            </div>
        </div>
    `;}).join('');

    printArea.innerHTML = labelsHtml;

    // CSS Injection
    const styleId = 'dynamic-page-size';
    const oldStyle = document.getElementById(styleId);
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = styleId;
    const width = '60mm';
    const height = printSize === '6040' ? '40mm' : '30mm';
    
    style.innerHTML = `
        @media print {
            @page { size: ${width} ${height}; margin: 0; }
            body { margin: 0 !important; padding: 0 !important; }
            body > *:not(#print-area) { display: none !important; }
            #print-area { display: block !important; position: absolute; top: 0; left: 0; width: ${width}; }
            .label-item {
                width: ${width}; height: ${height};
                page-break-after: always; break-after: page;
                display: flex; align-items: center; justify-content: flex-start;
                padding: 1mm 2mm; box-sizing: border-box; overflow: hidden;
                font-family: sans-serif;
            }
            .qr-container { width: 25mm; height: 25mm; display: flex; align-items: center; justify-content: center; margin-right: 2mm; }
            .qr-container img { width: 100%; height: 100%; object-fit: contain; }
            .info-container { flex: 1; display: flex; flex-direction: column; justify-content: center; }
            .info-row { display: flex; align-items: baseline; line-height: 1.0; margin-bottom: 1px; }
            .key { font-size: 16px; font-weight: 800; margin-right: 3px; color: #000; }
            .val { font-size: 28px; font-weight: 900; color: #000; letter-spacing: -1px; }
            .key-lg { font-size: 18px; font-weight: 900; text-transform: uppercase; color: #000; margin-top: 5px; }
        }
    `;
    document.head.appendChild(style);
    setTimeout(() => window.print(), 250);
  };

  const handlePrintSelected = () => {
      const selectedAddresses = addresses.filter(a => selectedIds.has(a.id));
      if (selectedAddresses.length === 0) return;

      const printItems = selectedAddresses.map(addr => {
          const parts = addr.code.split('-');
          return {
              code: addr.code,
              g: parts[1] || '?',
              e: parts[2] || '?',
              p: parts[3] || '?'
          };
      });
      executePrint(printItems);
  };

  // --- PRINT LOGIC (Shelf Only) ---
  const handlePrintShelfLabel = (galpao: string, estante: string) => {
      // Create a virtual item for the Shelf
      const code = `LOC-${galpao}-${estante}`; // Removed Level part
      const item = {
          code: code,
          g: galpao,
          e: estante,
          p: undefined // No Prateleira
      };
      executePrint([item]);
  };

  if (!isDesktop) return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center text-gray-500">
          <Icon name="desktop_windows" size={64} className="mb-4 opacity-50" />
          <h2>Acesso Restrito ao Desktop</h2>
          <button onClick={onBack} className="mt-4 px-4 py-2 bg-primary text-white rounded">Voltar</button>
      </div>
  );

  return (
    <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark overflow-hidden">
        
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-surface-dark border-b border-gray-200 dark:border-white/5 shadow-sm z-10">
             <div className="flex items-center gap-4">
                 <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full"><Icon name="arrow_back" size={24} /></button>
                 <div>
                     <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Icon name="warehouse" className="text-primary" />
                        Gestor de Endereçamento
                     </h1>
                     <p className="text-xs text-gray-500">Estrutura Física & Etiquetas</p>
                 </div>
             </div>
             
             <div className="flex items-center gap-3">
                 <button 
                    onClick={handlePrintSelected}
                    disabled={selectedIds.size === 0}
                    className={`flex items-center gap-2 px-5 py-2 rounded-lg font-bold bg-gray-900 dark:bg-white dark:text-black text-white transition-all ${selectedIds.size === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 shadow-lg'}`}
                 >
                    <Icon name="print" size={20} />
                    <span>Imprimir Selecionados ({selectedIds.size})</span>
                 </button>
             </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
            
            {/* MAIN CONTENT: TREE VIEW LIST */}
            <div className="flex-1 flex flex-col p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">Estrutura do Armazém</h2>
                    <button 
                        onClick={() => setIsGeneratorModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all active:scale-95"
                    >
                        <Icon name="add_location_alt" />
                        Novo Endereçamento
                    </button>
                </div>

                {/* HIERARCHICAL TREE LIST */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-2 bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-white/5 p-4 shadow-inner">
                    {Array.from(hierarchicalData.entries()).map(([galpao, shelfMap]) => {
                        const isGExpanded = expandedWarehouses.has(galpao);
                        
                        // Check if all items in this Galpao are selected
                        const allGalpaoItems: WMSAddress[] = [];
                        shelfMap.forEach(items => allGalpaoItems.push(...items));
                        const isGalpaoSelected = allGalpaoItems.length > 0 && allGalpaoItems.every(i => selectedIds.has(i.id));

                        return (
                            <div key={galpao} className="select-none">
                                {/* LEVEL 1: WAREHOUSE */}
                                <div className={`flex items-center p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 border border-transparent ${isGExpanded ? 'bg-gray-50 dark:bg-white/5' : ''}`}>
                                    <button 
                                        onClick={() => toggleWarehouse(galpao)} 
                                        className="p-1 mr-2 text-gray-400 hover:text-primary transition-colors"
                                    >
                                        <Icon name={isGExpanded ? "expand_more" : "chevron_right"} size={24} />
                                    </button>
                                    
                                    <input 
                                        type="checkbox" 
                                        checked={isGalpaoSelected}
                                        onChange={() => handleSelectWarehouse(shelfMap)}
                                        className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer mr-3"
                                    />
                                    
                                    <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => toggleWarehouse(galpao)}>
                                        <Icon name="domain" className="text-gray-500" />
                                        <span className="font-bold text-lg text-gray-800 dark:text-white">Galpão {galpao}</span>
                                        <span className="text-xs text-gray-400 font-normal ml-2">({shelfMap.size} estantes)</span>
                                    </div>
                                </div>

                                {/* LEVEL 2: SHELVES */}
                                {isGExpanded && (
                                    <div className="ml-8 border-l-2 border-gray-100 dark:border-white/10 pl-2 mt-1 space-y-1">
                                        {Array.from(shelfMap.entries()).map(([estante, items]) => {
                                            const shelfKey = `${galpao}-${estante}`;
                                            const isSExpanded = expandedShelves.has(shelfKey);
                                            const isShelfSelected = items.length > 0 && items.every(i => selectedIds.has(i.id));

                                            return (
                                                <div key={estante}>
                                                    <div className="flex items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10">
                                                        <button 
                                                            onClick={() => toggleShelf(shelfKey)}
                                                            className="p-1 mr-2 text-gray-400 hover:text-primary"
                                                        >
                                                            <Icon name={isSExpanded ? "expand_more" : "chevron_right"} size={20} />
                                                        </button>

                                                        <input 
                                                            type="checkbox" 
                                                            checked={isShelfSelected}
                                                            onChange={() => handleSelectShelf(items)}
                                                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer mr-3"
                                                        />

                                                        <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => toggleShelf(shelfKey)}>
                                                            <Icon name="shelves" className="text-gray-400" size={18} />
                                                            <span className="font-bold text-base text-gray-700 dark:text-gray-200">Estante {estante.replace('E','')}</span>
                                                            <span className="text-xs text-gray-400 ml-1">({items.length} níveis)</span>
                                                        </div>

                                                        {/* ACTION: PRINT SHELF LABEL */}
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handlePrintShelfLabel(galpao, estante);
                                                            }}
                                                            title="Imprimir QR Code da Estante"
                                                            className="p-2 text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/20 rounded transition-colors"
                                                        >
                                                            <Icon name="print" size={18} />
                                                        </button>
                                                    </div>

                                                    {/* LEVEL 3: ITEMS (LEVELS/PRATELEIRAS) */}
                                                    {isSExpanded && (
                                                        <div className="ml-9 border-l border-dashed border-gray-200 dark:border-white/10 pl-2 mt-1 space-y-1">
                                                            {items.map(addr => {
                                                                const isSelected = selectedIds.has(addr.id);
                                                                const nivelLabel = addr.code.split('-').pop() || '';

                                                                return (
                                                                    <div 
                                                                        key={addr.id} 
                                                                        className={`flex items-center p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer ${isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
                                                                        onClick={() => handleSelectId(addr.id)}
                                                                    >
                                                                        {/* Placeholder for expand icon alignment */}
                                                                        <div className="w-6 mr-2"></div> 

                                                                        <input 
                                                                            type="checkbox" 
                                                                            checked={isSelected}
                                                                            onChange={() => handleSelectId(addr.id)}
                                                                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer mr-3"
                                                                        />
                                                                        
                                                                        <div className="flex items-center gap-2">
                                                                            <Icon name="layers" size={16} className={isSelected ? "text-primary" : "text-gray-300"} />
                                                                            <span className={`text-sm font-medium ${isSelected ? "text-primary font-bold" : "text-gray-600 dark:text-gray-400"}`}>
                                                                                Prateleira/Nível {nivelLabel.replace('P','')}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    
                    {addresses.length === 0 && !loading && (
                        <div className="text-center py-20 text-gray-400">
                            <Icon name="map" size={64} className="mb-4 opacity-50" />
                            <p>Nenhum endereço cadastrado.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* GENERATOR MODAL (POP-UP) */}
        {isGeneratorModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white dark:bg-surface-dark w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    
                    <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50 dark:bg-black/20">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-white/5">
                                <Icon name="auto_awesome" className="text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Gerador de Endereços</h2>
                                <p className="text-xs text-gray-500">Crie sequências de endereços em massa</p>
                            </div>
                        </div>
                        <button onClick={() => setIsGeneratorModalOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors">
                            <Icon name="close" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            {/* Inputs Column */}
                            <div className="space-y-8">
                                
                                {/* Seleção Galpão */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">1. Selecione o Galpão</label>
                                    <div className="flex gap-2">
                                        <select 
                                            value={genGalpaoSigla}
                                            onChange={e => setGenGalpaoSigla(e.target.value)}
                                            className="flex-1 p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-dark font-bold text-lg focus:ring-2 focus:ring-primary outline-none"
                                        >
                                            {warehouses.map(w => <option key={w.id} value={w.sigla}>{w.sigla} - {w.descricao}</option>)}
                                            {warehouses.length === 0 && <option value="">--- Vazio ---</option>}
                                        </select>
                                        <button 
                                            onClick={() => setIsWarehouseModalOpen(true)}
                                            title="Gerenciar Galpões"
                                            className="p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition-colors text-primary"
                                        >
                                            <Icon name="edit_square" />
                                        </button>
                                    </div>
                                    {warehouses.length === 0 && <p className="text-xs text-red-500">Cadastre um galpão para continuar.</p>}
                                </div>

                                {/* Config Estantes */}
                                <div className="p-5 bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-200 dark:border-white/5">
                                    <div className="flex justify-between items-center mb-4">
                                        <label className="text-xs font-bold text-gray-500 uppercase">2. Sequência de Estantes</label>
                                        <button 
                                            onClick={() => setIsSingleShelf(!isSingleShelf)}
                                            className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded hover:bg-primary/20 transition-colors"
                                        >
                                            {isSingleShelf ? 'Modo Faixa (De...Até)' : 'Modo Único'}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1">
                                            <span className="text-[10px] text-gray-400 block mb-1">De (Início)</span>
                                            <input type="number" min="1" value={genEstanteStart} onChange={e => setGenEstanteStart(Number(e.target.value))} className="w-full p-3 rounded-lg border border-gray-200 dark:border-white/10 text-center font-bold bg-white dark:bg-surface-dark" />
                                        </div>
                                        {!isSingleShelf && (
                                            <>
                                                <Icon name="arrow_forward" className="text-gray-300 mt-5" />
                                                <div className="flex-1">
                                                    <span className="text-[10px] text-gray-400 block mb-1">Até (Fim)</span>
                                                    <input type="number" min="1" value={genEstanteEnd} onChange={e => setGenEstanteEnd(Number(e.target.value))} className="w-full p-3 rounded-lg border border-gray-200 dark:border-white/10 text-center font-bold bg-white dark:bg-surface-dark" />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Config Níveis */}
                                <div className="p-5 bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-200 dark:border-white/5">
                                    <div className="flex justify-between items-center mb-4">
                                        <label className="text-xs font-bold text-gray-500 uppercase">3. Níveis por Estante</label>
                                        <button 
                                            onClick={() => setIsSingleLevel(!isSingleLevel)}
                                            className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded hover:bg-primary/20 transition-colors"
                                        >
                                            {isSingleLevel ? 'Modo Faixa (De...Até)' : 'Modo Único'}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1">
                                            <span className="text-[10px] text-gray-400 block mb-1">Do Nível</span>
                                            <input type="number" min="1" value={genNivelStart} onChange={e => setGenNivelStart(Number(e.target.value))} className="w-full p-3 rounded-lg border border-gray-200 dark:border-white/10 text-center font-bold bg-white dark:bg-surface-dark" />
                                        </div>
                                        {!isSingleLevel && (
                                            <>
                                                <Icon name="arrow_forward" className="text-gray-300 mt-5" />
                                                <div className="flex-1">
                                                    <span className="text-[10px] text-gray-400 block mb-1">Até o Nível</span>
                                                    <input type="number" min="1" value={genNivelEnd} onChange={e => setGenNivelEnd(Number(e.target.value))} className="w-full p-3 rounded-lg border border-gray-200 dark:border-white/10 text-center font-bold bg-white dark:bg-surface-dark" />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                            </div>

                            {/* Preview Column */}
                            <div className="flex flex-col h-full bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20 p-6">
                                <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 uppercase mb-6 flex items-center gap-2">
                                    <Icon name="visibility" size={18} />
                                    Prévia da Geração
                                </h3>

                                <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                                    {/* Mock Label */}
                                    <div className="bg-white p-4 rounded shadow-md border border-gray-200 w-64 aspect-[3/2] flex items-center gap-3 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 bg-black text-white text-[8px] font-bold px-1">MODELO</div>
                                        <div className="size-20 bg-black text-white flex items-center justify-center">
                                            <Icon name="qr_code_2" size={48} />
                                        </div>
                                        <div className="flex flex-col leading-none">
                                            <span className="text-xs font-bold text-gray-400">G:{genGalpaoSigla || '??'}</span>
                                            <span className="text-2xl font-black text-black">E:{genEstanteStart.toString().padStart(2,'0')}</span>
                                            <span className="text-xl font-bold text-gray-600">P:{genNivelStart.toString().padStart(2,'0')}</span>
                                        </div>
                                    </div>

                                    <div className="w-full space-y-2">
                                        <div className="flex justify-between text-sm text-blue-900 dark:text-blue-200 font-medium border-b border-blue-200 dark:border-blue-800 pb-2">
                                            <span>Estantes:</span>
                                            <span>{isSingleShelf ? '1' : (genEstanteEnd - genEstanteStart + 1)} un</span>
                                        </div>
                                        <div className="flex justify-between text-sm text-blue-900 dark:text-blue-200 font-medium border-b border-blue-200 dark:border-blue-800 pb-2">
                                            <span>Níveis/Prateleiras:</span>
                                            <span>{isSingleLevel ? '1' : (genNivelEnd - genNivelStart + 1)} un</span>
                                        </div>
                                        <div className="flex justify-between text-lg text-blue-700 dark:text-blue-300 font-bold pt-2">
                                            <span>Total a Gerar:</span>
                                            <span>
                                                {((isSingleShelf ? genEstanteStart : genEstanteEnd) - genEstanteStart + 1) * 
                                                 ((isSingleLevel ? genNivelStart : genNivelEnd) - genNivelStart + 1)} Endereços
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-white/50 dark:bg-black/20 p-3 rounded-lg text-xs text-blue-800 dark:text-blue-300 text-center w-full">
                                        <p>O sistema verificará duplicidades automaticamente. Endereços existentes serão ignorados.</p>
                                    </div>
                                </div>

                                <button 
                                    onClick={handleGenerate}
                                    disabled={loading || !genGalpaoSigla}
                                    className="w-full py-4 mt-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? <Icon name="sync" className="animate-spin" /> : <Icon name="save_alt" />}
                                    {loading ? 'Processando...' : 'Confirmar e Gerar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* WAREHOUSE MODAL (Gerenciamento) */}
        {isWarehouseModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white dark:bg-surface-dark w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-up">
                    <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50 dark:bg-black/20">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Icon name="domain" />
                            Gerenciar Galpões
                        </h2>
                        <button onClick={() => setIsWarehouseModalOpen(false)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white"><Icon name="close" /></button>
                    </div>
                    
                    <div className="p-6 space-y-4">
                        <div className="flex gap-2">
                            <input 
                                value={newWarehouseSigla}
                                onChange={e => setNewWarehouseSigla(e.target.value.toUpperCase())}
                                placeholder="Sigla (Ex: AT)"
                                maxLength={3}
                                className="w-24 p-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl font-bold text-center uppercase"
                            />
                            <input 
                                value={newWarehouseDesc}
                                onChange={e => setNewWarehouseDesc(e.target.value)}
                                placeholder="Descrição (Opcional)"
                                className="flex-1 p-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl"
                            />
                            <button onClick={handleSaveWarehouse} className="p-3 bg-primary text-white rounded-xl shadow-lg hover:bg-primary-dark">
                                <Icon name="add" />
                            </button>
                        </div>

                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                            {warehouses.map(w => (
                                <div key={w.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 bg-white dark:bg-white/10 rounded-lg flex items-center justify-center font-black text-gray-700 dark:text-white text-sm border border-gray-200 dark:border-white/10">
                                            {w.sigla}
                                        </div>
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{w.descricao || 'Sem descrição'}</span>
                                    </div>
                                    <button onClick={() => handleDeleteWarehouse(w.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Icon name="delete" /></button>
                                </div>
                            ))}
                            {warehouses.length === 0 && <div className="p-4 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">Nenhum galpão cadastrado.</div>}
                        </div>
                    </div>
                </div>
            </div>
        )}

    </div>
  );
};
