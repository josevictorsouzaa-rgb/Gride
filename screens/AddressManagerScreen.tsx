
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
  const [printSize, setPrintSize] = useState<'60x30' | '60x20'>('60x30');
  
  // Edit State
  const [editingAddress, setEditingAddress] = useState<WMSAddress | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editDesc, setEditDesc] = useState('');

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
  const [expandedShelves, setExpandedShelves] = useState<Set<string>>(new Set());

  // Selection for Print
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    refreshData();
    setSelectedIds(new Set());
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
    setLoading(false);
  };

  const hierarchicalData = useMemo(() => {
      const groups = new Map<string, Map<string, WMSAddress[]>>();
      addresses.forEach(addr => {
          const parts = addr.code.split('-');
          let g = 'GERAL';
          let e = '00';
          if (parts.length >= 4) {
             g = parts[1]; e = parts[2];
          }
          if (!groups.has(g)) groups.set(g, new Map());
          const shelfMap = groups.get(g)!;
          if (!shelfMap.has(e)) shelfMap.set(e, []);
          shelfMap.get(e)!.push(addr);
      });
      const sortedGroups = new Map([...groups.entries()].sort());
      for (const [g, shelfMap] of sortedGroups) {
          sortedGroups.set(g, new Map([...shelfMap.entries()].sort()));
      }
      return sortedGroups;
  }, [addresses]);

  const handleSaveWarehouse = async () => {
      if (!newWarehouseSigla) return alert('Digite a sigla (Ex: AT)');
      const res = await api.saveWarehouse({ sigla: newWarehouseSigla.toUpperCase(), descricao: newWarehouseDesc });
      if (res.success) {
          setNewWarehouseSigla(''); setNewWarehouseDesc('');
          setWarehouses(await api.getWarehouses());
          setIsWarehouseModalOpen(false);
      } else { alert('Erro: ' + (res.message || 'Falha ao salvar')); }
  };

  const handleDeleteWarehouse = async (id: number) => {
      if(confirm('Tem certeza?')) {
          await api.deleteWarehouse(id);
          setWarehouses(await api.getWarehouses());
      }
  };

  const handleGenerate = async () => {
    if (!genGalpaoSigla) return alert("Selecione um galpão.");
    const finalEstanteEnd = isSingleShelf ? genEstanteStart : genEstanteEnd;
    const finalNivelEnd = isSingleLevel ? genNivelStart : genNivelEnd;
    if (finalEstanteEnd < genEstanteStart || finalNivelEnd < genNivelStart) return alert('Intervalo inválido.');

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

    if (confirm(`Gerar ${newAddresses.length} endereços?`)) {
        setLoading(true);
        const res = await api.saveAddresses(newAddresses);
        setLoading(false);
        if (res.success) {
            await refreshData();
            setIsGeneratorModalOpen(false);
        } else { alert('Erro ao salvar.'); }
    }
  };

  // --- ACTIONS PER ITEM ---
  const handleEdit = (addr: WMSAddress, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingAddress(addr);
      setEditCode(addr.code);
      setEditDesc(addr.description);
  };

  const handleSaveEdit = async () => {
      if (!editingAddress) return;
      const res = await api.updateAddress(editingAddress.id, editCode, editDesc);
      if (res.success) {
          setEditingAddress(null);
          await refreshData();
      } else {
          alert('Erro ao atualizar endereço.');
      }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
      e.stopPropagation();
      if(confirm('Excluir endereço? Isso pode afetar produtos vinculados.')) {
          const res = await api.deleteAddress(id);
          if (res.success) {
              await refreshData();
          } else {
              alert('Erro ao excluir.');
          }
      }
  };

  // --- EXPANSION & SELECTION ---
  const toggleWarehouse = (g: string) => {
      const newSet = new Set(expandedWarehouses);
      if (newSet.has(g)) newSet.delete(g); else newSet.add(g);
      setExpandedWarehouses(newSet);
  };
  const toggleShelf = (key: string) => {
      const newSet = new Set(expandedShelves);
      if (newSet.has(key)) newSet.delete(key); else newSet.add(key);
      setExpandedShelves(newSet);
  };
  const handleSelectId = (id: number) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      setSelectedIds(newSet);
  };
  const handleSelectAll = () => setSelectedIds(new Set(addresses.map(a => a.id)));
  const handleDeselectAll = () => setSelectedIds(new Set());

  // Cascading Selection Logic
  const handleSelectWarehouse = (g: string, e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      const isChecked = e.target.checked;
      const newSet = new Set(selectedIds);
      
      addresses.forEach(addr => {
          if (addr.code.includes(`LOC-${g}-`)) {
              if (isChecked) newSet.add(addr.id);
              else newSet.delete(addr.id);
          }
      });
      setSelectedIds(newSet);
  };

  const handleSelectShelf = (shelfKey: string, items: WMSAddress[], e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      const isChecked = e.target.checked;
      const newSet = new Set(selectedIds);
      
      items.forEach(addr => {
          if (isChecked) newSet.add(addr.id);
          else newSet.delete(addr.id);
      });
      setSelectedIds(newSet);
  };

  // --- PRINT LOGIC ---
  const executePrint = async (items: { code: string, g: string, e: string, p?: string }[]) => {
    const printArea = document.getElementById('print-area');
    if (!printArea) return;
    const qrMap = new Map<string, string>();
    try {
        const promises = items.map(async (item) => {
            const url = await QRCode.toDataURL(item.code, { margin: 0, width: 250 });
            return { code: item.code, url };
        });
        const results = await Promise.all(promises);
        results.forEach(r => qrMap.set(r.code, r.url));
    } catch (err) { return alert("Erro QR"); }

    const labelsHtml = items.map(item => {
        const qrSrc = qrMap.get(item.code);
        const estanteNum = item.e.replace(/\D/g, '');
        const nivelNum = item.p ? item.p.replace(/\D/g, '') : '';
        const isShelfLabel = !item.p;
        const labelTitle = isShelfLabel ? 'ESTANTE' : 'PRATELEIRA';
        const labelNum = isShelfLabel ? estanteNum : nivelNum;
        
        return `<div class="label-item"><div class="label-inner"><div class="qr-box"><img src="${qrSrc}" /></div><div class="info-column"><div class="black-bar"><span class="label-type">${labelTitle}</span><span class="label-number">${labelNum}</span></div><div class="code-text">${item.code}</div></div></div></div>`;
    }).join('');

    printArea.innerHTML = labelsHtml;
    const styleId = 'dynamic-page-size';
    let style = document.getElementById(styleId) as HTMLStyleElement;
    if (!style) { style = document.createElement('style'); style.id = styleId; document.head.appendChild(style); }
    const heightMm = printSize === '60x30' ? '30mm' : '20mm';
    const qrSize = printSize === '60x30' ? '22mm' : '16mm';
    const titleSize = printSize === '60x30' ? '7pt' : '5pt';
    const numSize = printSize === '60x30' ? '24pt' : '16pt';
    const codeSize = printSize === '60x30' ? '9pt' : '8pt';
    const barPadding = printSize === '60x30' ? '1mm 2mm' : '0.5mm 1mm';

    style.innerHTML = `@media print { @page { size: 60mm ${heightMm}; margin: 0; } body { margin: 0 !important; padding: 0 !important; font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; } body > *:not(#print-area) { display: none !important; } #print-area { display: block !important; position: absolute; top: 0; left: 0; width: 60mm; } .label-item { width: 60mm; height: ${heightMm}; page-break-after: always; break-after: page; box-sizing: border-box; overflow: hidden; display: flex; align-items: center; justify-content: center; padding: 1mm; } .label-inner { width: 100%; height: 100%; display: flex; flex-direction: row; align-items: center; } .qr-box { width: ${qrSize}; height: ${qrSize}; flex-shrink: 0; margin-right: 1.5mm; display: flex; align-items: center; justify-content: center; } .qr-box img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; } .info-column { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 0.5mm; } .black-bar { background: #000; color: #fff; padding: ${barPadding}; display: flex; align-items: center; justify-content: space-between; border-radius: 1mm; width: 100%; } .label-type { font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; font-size: ${titleSize}; } .label-number { font-weight: 900; line-height: 1; font-size: ${numSize}; } .code-text { font-weight: 900; color: #000; text-align: center; white-space: nowrap; font-size: ${codeSize}; } }`;
    setTimeout(() => window.print(), 300);
  };

  const handlePrintSelected = () => {
      const selectedAddresses = addresses.filter(a => selectedIds.has(a.id));
      if (selectedAddresses.length === 0) return;
      const printItems = selectedAddresses.map(addr => {
          const parts = addr.code.split('-');
          return { code: addr.code, g: parts[1] || '?', e: parts[2] || '?', p: parts[3] || undefined };
      });
      executePrint(printItems);
  };

  // Special function to print a Shelf Label (created on fly if needed)
  const handlePrintShelfLabel = (galpao: string, estante: string, e: React.MouseEvent) => {
      e.stopPropagation();
      // Estante format "E01" -> code LOC-G01-E01
      const shelfCode = `LOC-${galpao}-${estante}`;
      // Check if addresses selected for this shelf, if so print them too? 
      // User requirement: "imprimir apena a etique da estante" AND "imprimir junto a estante" if flagged.
      // Current button logic: Print specifically the SHELF label only when clicked.
      // If user flagged items, they use the global print.
      // If this button is clicked, it prints THIS shelf label.
      
      executePrint([{ code: shelfCode, g: galpao, e: estante }]);
  };

  if (!isDesktop) return <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center text-gray-500"><Icon name="desktop_windows" size={64} className="mb-4 opacity-50" /><h2>Acesso Restrito ao Desktop</h2><button onClick={onBack} className="mt-4 px-4 py-2 bg-primary text-white rounded">Voltar</button></div>;

  return (
    <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-surface-dark border-b border-gray-200 dark:border-white/5 shadow-sm z-10">
             <div className="flex items-center gap-4">
                 <div>
                     <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Icon name="warehouse" className="text-primary" />
                        Gestor de Endereçamento
                     </h1>
                     <p className="text-xs text-gray-500">Estrutura Física & Etiquetas</p>
                 </div>
             </div>
             
             <div className="flex items-center gap-3">
                 <div className="flex items-center gap-2 mr-4 bg-gray-50 dark:bg-white/5 p-1.5 rounded-lg border border-gray-200 dark:border-white/10">
                    <span className="text-xs font-bold text-gray-500 ml-2">Tamanho:</span>
                    <select value={printSize} onChange={(e) => setPrintSize(e.target.value as any)} className="bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-xs rounded focus:ring-primary focus:border-primary block p-1.5 font-bold">
                        <option value="60x30">60mm x 30mm (Padrão)</option>
                        <option value="60x20">60mm x 20mm (Compacto)</option>
                    </select>
                 </div>
                 <div className="flex items-center bg-gray-100 dark:bg-white/5 rounded-lg p-1 mr-2">
                    <button onClick={handleSelectAll} className="px-3 py-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-white/10 rounded-md">Marcar Tudo</button>
                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                    <button onClick={handleDeselectAll} className="px-3 py-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-white/10 rounded-md">Desmarcar Tudo</button>
                 </div>
                 <button onClick={handlePrintSelected} disabled={selectedIds.size === 0} className={`flex items-center gap-2 px-5 py-2 rounded-lg font-bold bg-gray-900 dark:bg-white dark:text-black text-white transition-all ${selectedIds.size === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 shadow-lg'}`}><Icon name="print" size={20} /><span>Imprimir ({selectedIds.size})</span></button>
             </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 flex flex-col p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">Estrutura do Armazém</h2>
                    <div className="flex gap-2">
                        <button onClick={() => setIsWarehouseModalOpen(true)} className="flex items-center gap-2 px-4 py-3 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-white rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-white/20 transition-all"><Icon name="domain_add" /> Galpão</button>
                        <button onClick={() => setIsGeneratorModalOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all active:scale-95"><Icon name="add_location_alt" /> Novo Endereçamento</button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-2 bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-white/5 p-4 shadow-inner">
                    {Array.from(hierarchicalData.entries()).map(([galpao, shelfMap]) => {
                        const isGExpanded = expandedWarehouses.has(galpao);
                        return (
                            <div key={galpao} className="select-none">
                                <div className={`flex items-center p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-white/10 border border-transparent ${isGExpanded ? 'bg-gray-50 dark:bg-white/5' : ''}`}>
                                    <button onClick={() => toggleWarehouse(galpao)} className="p-1 mr-2 text-gray-400 hover:text-primary"><Icon name={isGExpanded ? "expand_more" : "chevron_right"} size={24} /></button>
                                    
                                    {/* Warehouse Checkbox */}
                                    <input 
                                        type="checkbox" 
                                        onChange={(e) => handleSelectWarehouse(galpao, e)}
                                        className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer mr-3"
                                        onClick={(e) => e.stopPropagation()}
                                    />

                                    <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => toggleWarehouse(galpao)}>
                                        <Icon name="domain" className="text-gray-500" />
                                        <span className="font-bold text-lg text-gray-800 dark:text-white">Galpão {galpao}</span>
                                        <span className="text-xs text-gray-400 font-normal ml-2">({shelfMap.size} estantes)</span>
                                    </div>
                                </div>
                                {isGExpanded && (
                                    <div className="ml-8 border-l-2 border-gray-100 dark:border-white/10 pl-2 mt-1 space-y-1">
                                        {Array.from(shelfMap.entries()).map(([estante, items]) => {
                                            const shelfKey = `${galpao}-${estante}`;
                                            const isSExpanded = expandedShelves.has(shelfKey);
                                            return (
                                                <div key={estante}>
                                                    <div className="flex items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10">
                                                        <button onClick={() => toggleShelf(shelfKey)} className="p-1 mr-2 text-gray-400 hover:text-primary"><Icon name={isSExpanded ? "expand_more" : "chevron_right"} size={20} /></button>
                                                        
                                                        {/* Shelf Checkbox */}
                                                        <input 
                                                            type="checkbox" 
                                                            onChange={(e) => handleSelectShelf(shelfKey, items, e)}
                                                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer mr-3"
                                                            onClick={(e) => e.stopPropagation()}
                                                        />

                                                        <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => toggleShelf(shelfKey)}>
                                                            <Icon name="shelves" className="text-gray-400" size={18} />
                                                            <span className="font-bold text-base text-gray-700 dark:text-gray-200">Estante {estante.replace('E','')}</span>
                                                            <span className="text-xs text-gray-400 ml-1">({items.length} níveis)</span>
                                                        </div>

                                                        {/* Shelf Print Button */}
                                                        <button 
                                                            onClick={(e) => handlePrintShelfLabel(galpao, estante, e)} 
                                                            className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded shadow-sm hover:shadow transition-all"
                                                            title="Imprimir Etiqueta da Estante"
                                                        >
                                                            <Icon name="print" size={16} />
                                                        </button>
                                                    </div>
                                                    {isSExpanded && (
                                                        <div className="ml-9 border-l border-dashed border-gray-200 dark:border-white/10 pl-2 mt-1 space-y-1">
                                                            {items.map(addr => {
                                                                const isSelected = selectedIds.has(addr.id);
                                                                const nivelLabel = addr.code.split('-').pop() || '';
                                                                return (
                                                                    <div key={addr.id} className={`flex items-center p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer ${isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`} onClick={() => handleSelectId(addr.id)}>
                                                                        <div className="w-6 mr-2"></div>
                                                                        <input type="checkbox" checked={isSelected} onChange={() => handleSelectId(addr.id)} className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer mr-3" />
                                                                        <div className="flex items-center gap-2 flex-1">
                                                                            <Icon name="layers" size={16} className={isSelected ? "text-primary" : "text-gray-300"} />
                                                                            <span className={`text-sm font-medium ${isSelected ? "text-primary font-bold" : "text-gray-600 dark:text-gray-400"}`}>Prateleira/Nível {nivelLabel.replace('P','')}</span>
                                                                        </div>
                                                                        {/* EDIT & DELETE BUTTONS */}
                                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100">
                                                                            <button onClick={(e) => handleEdit(addr, e)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"><Icon name="edit" size={16} /></button>
                                                                            <button onClick={(e) => handleDelete(addr.id, e)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Icon name="delete" size={16} /></button>
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
                </div>
            </div>
        </div>

        {/* MODAL: GENERATOR */}
        {isGeneratorModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-surface-dark rounded-xl shadow-2xl p-6 w-full max-w-lg">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Icon name="add_location_alt" /> Gerar Endereços</h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Galpão</label>
                            <select value={genGalpaoSigla} onChange={e => setGenGalpaoSigla(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-black/20 text-gray-900 dark:text-white">
                                <option value="">Selecione...</option>
                                {warehouses.map(w => <option key={w.id} value={w.sigla}>{w.sigla} - {w.descricao}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold mb-1">Estante Inicial</label>
                                <input type="number" value={genEstanteStart} onChange={e => setGenEstanteStart(parseInt(e.target.value))} className="w-full p-2 border rounded dark:bg-black/20" />
                            </div>
                            <div className={isSingleShelf ? 'opacity-50 pointer-events-none' : ''}>
                                <label className="block text-sm font-bold mb-1">Estante Final</label>
                                <input type="number" value={genEstanteEnd} onChange={e => setGenEstanteEnd(parseInt(e.target.value))} className="w-full p-2 border rounded dark:bg-black/20" />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" checked={isSingleShelf} onChange={e => setIsSingleShelf(e.target.checked)} className="rounded" />
                            <span className="text-sm">Apenas uma estante</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold mb-1">Nível Inicial</label>
                                <input type="number" value={genNivelStart} onChange={e => setGenNivelStart(parseInt(e.target.value))} className="w-full p-2 border rounded dark:bg-black/20" />
                            </div>
                            <div className={isSingleLevel ? 'opacity-50 pointer-events-none' : ''}>
                                <label className="block text-sm font-bold mb-1">Nível Final</label>
                                <input type="number" value={genNivelEnd} onChange={e => setGenNivelEnd(parseInt(e.target.value))} className="w-full p-2 border rounded dark:bg-black/20" />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" checked={isSingleLevel} onChange={e => setIsSingleLevel(e.target.checked)} className="rounded" />
                            <span className="text-sm">Apenas um nível</span>
                        </div>

                        <div className="pt-4 flex gap-3">
                            <button onClick={() => setIsGeneratorModalOpen(false)} className="flex-1 py-3 bg-gray-200 dark:bg-white/10 rounded-xl font-bold">Cancelar</button>
                            <button onClick={handleGenerate} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg">Gerar</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL: WAREHOUSE */}
        {isWarehouseModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-surface-dark rounded-xl shadow-2xl p-6 w-full max-w-sm">
                    <h3 className="text-lg font-bold mb-4">Novo Galpão</h3>
                    <div className="space-y-3">
                        <input value={newWarehouseSigla} onChange={e => setNewWarehouseSigla(e.target.value)} className="w-full p-2 border rounded uppercase" placeholder="Sigla (Ex: G1)" maxLength={3} />
                        <input value={newWarehouseDesc} onChange={e => setNewWarehouseDesc(e.target.value)} className="w-full p-2 border rounded" placeholder="Descrição (Ex: Principal)" />
                        
                        <div className="mt-4 border-t pt-4">
                            <p className="text-xs font-bold text-gray-500 mb-2">Galpões Existentes:</p>
                            <ul className="max-h-32 overflow-y-auto text-sm space-y-1">
                                {warehouses.map(w => (
                                    <li key={w.id} className="flex justify-between items-center bg-gray-50 dark:bg-white/5 p-1 rounded">
                                        <span>{w.sigla} - {w.descricao}</span>
                                        <button onClick={() => handleDeleteWarehouse(w.id)} className="text-red-500"><Icon name="delete" size={16} /></button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setIsWarehouseModalOpen(false)} className="flex-1 py-2 bg-gray-200 rounded">Fechar</button>
                            <button onClick={handleSaveWarehouse} className="flex-1 py-2 bg-primary text-white rounded">Salvar</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        
        {editingAddress && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-surface-dark rounded-xl shadow-2xl p-6 w-full max-w-md">
                    <h3 className="text-lg font-bold mb-4">Editar Endereço</h3>
                    <div className="space-y-3">
                        <input value={editCode} onChange={e => setEditCode(e.target.value)} className="w-full p-2 border rounded" placeholder="Código (Ex: LOC-A-01)" />
                        <input value={editDesc} onChange={e => setEditDesc(e.target.value)} className="w-full p-2 border rounded" placeholder="Descrição" />
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setEditingAddress(null)} className="flex-1 py-2 bg-gray-200 rounded">Cancelar</button>
                            <button onClick={handleSaveEdit} className="flex-1 py-2 bg-primary text-white rounded">Salvar</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
