
import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../components/Icon';
import { WarehouseLayout, LayoutObject, LayoutObjectType } from '../types';
import { api } from '../services/api';

interface LayoutEditorScreenProps {
  onBack: () => void;
}

export const LayoutEditorScreen: React.FC<LayoutEditorScreenProps> = ({ onBack }) => {
  // Desktop Check
  if (window.innerWidth < 1024) {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-background-light dark:bg-background-dark p-6 text-center">
              <Icon name="desktop_windows" size={64} className="text-gray-400 mb-4" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Apenas Desktop</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2 mb-6">
                  O editor de layout requer uma tela maior para desenhar o mapa do armazém com precisão.
              </p>
              <button onClick={onBack} className="bg-primary text-white px-6 py-3 rounded-xl font-bold">Voltar</button>
          </div>
      );
  }

  const [layout, setLayout] = useState<WarehouseLayout>({
      id: 1,
      name: 'Armazém Principal',
      width: 800,
      height: 600,
      objects: []
  });

  const [selectedTool, setSelectedTool] = useState<LayoutObjectType>('shelf');
  const [selectedObjId, setSelectedObjId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const canvasRef = useRef<SVGSVGElement>(null);

  // Load existing layout
  useEffect(() => {
      api.getLayout().then(data => {
          if (data) setLayout(data);
      });
  }, []);

  const handleSave = async () => {
      await api.saveLayout(layout);
      alert('Layout salvo com sucesso!');
  };

  const handleAddObject = (x: number, y: number) => {
      const newObj: LayoutObject = {
          id: `obj-${Date.now()}`,
          type: selectedTool,
          x: Math.round(x / 10) * 10, // Grid Snap
          y: Math.round(y / 10) * 10,
          width: selectedTool === 'shelf' ? 100 : 50,
          height: selectedTool === 'shelf' ? 40 : 50,
          label: selectedTool.toUpperCase(),
          qrCode: ''
      };
      setLayout(prev => ({ ...prev, objects: [...prev.objects, newObj] }));
      setSelectedObjId(newObj.id);
  };

  const updateSelectedObject = (key: keyof LayoutObject, value: any) => {
      if (!selectedObjId) return;
      setLayout(prev => ({
          ...prev,
          objects: prev.objects.map(o => o.id === selectedObjId ? { ...o, [key]: value } : o)
      }));
  };

  const deleteSelected = () => {
      if (!selectedObjId) return;
      setLayout(prev => ({
          ...prev,
          objects: prev.objects.filter(o => o.id !== selectedObjId)
      }));
      setSelectedObjId(null);
  };

  // Drag Logic
  const handleMouseDown = (e: React.MouseEvent, obj: LayoutObject) => {
      e.stopPropagation();
      setSelectedObjId(obj.id);
      setIsDragging(true);
      // Calc offset relative to object top-left
      // Need precise mouse pos within SVG
      const svg = canvasRef.current;
      if (svg) {
         const pt = svg.createSVGPoint();
         pt.x = e.clientX;
         pt.y = e.clientY;
         const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
         setDragOffset({ x: svgP.x - obj.x, y: svgP.y - obj.y });
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging || !selectedObjId) return;
      const svg = canvasRef.current;
      if (svg) {
          const pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
          
          const newX = Math.round((svgP.x - dragOffset.x) / 10) * 10;
          const newY = Math.round((svgP.y - dragOffset.y) / 10) * 10;

          setLayout(prev => ({
              ...prev,
              objects: prev.objects.map(o => o.id === selectedObjId ? { ...o, x: newX, y: newY } : o)
          }));
      }
  };

  const handleMouseUp = () => {
      setIsDragging(false);
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
      if (e.target === canvasRef.current || (e.target as Element).tagName === 'rect') {
         // Create new object logic if needed, currently click selects nothing
         // But double click creates? Let's use double click for creation
         setSelectedObjId(null);
      }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
      const svg = canvasRef.current;
      if (svg) {
          const pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
          handleAddObject(svgP.x, svgP.y);
      }
  };

  const selectedObject = layout.objects.find(o => o.id === selectedObjId);

  return (
    <div className="flex w-full h-screen bg-gray-100 dark:bg-background-dark overflow-hidden">
        {/* Sidebar Tools */}
        <aside className="w-72 bg-white dark:bg-surface-dark border-r border-gray-200 dark:border-card-border flex flex-col z-20 shadow-lg">
            <div className="p-4 border-b border-gray-100 dark:border-white/5 flex items-center gap-3">
                <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full"><Icon name="arrow_back" /></button>
                <h2 className="font-bold text-lg">Editor de Mapa</h2>
            </div>

            <div className="p-4 grid grid-cols-2 gap-2">
                {(['shelf', 'door', 'desk', 'wall', 'area'] as LayoutObjectType[]).map(tool => (
                    <button
                        key={tool}
                        onClick={() => setSelectedTool(tool)}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                            selectedTool === tool 
                            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                            : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 hover:bg-gray-100'
                        }`}
                    >
                        <Icon name={
                            tool === 'shelf' ? 'shelves' : 
                            tool === 'door' ? 'door_front' : 
                            tool === 'desk' ? 'desk' : 
                            tool === 'wall' ? 'rectangle' : 'check_box_outline_blank'
                        } />
                        <span className="text-xs font-bold uppercase">{tool}</span>
                    </button>
                ))}
            </div>

            <div className="flex-1 p-4 border-t border-gray-100 dark:border-white/5 overflow-y-auto">
                {selectedObject ? (
                    <div className="space-y-4 animate-fade-in">
                        <h3 className="font-bold text-sm text-gray-500 uppercase">Propriedades</h3>
                        
                        <div>
                            <label className="text-xs font-bold text-gray-400">Rótulo (Visual)</label>
                            <input 
                                value={selectedObject.label}
                                onChange={(e) => updateSelectedObject('label', e.target.value)}
                                className="w-full mt-1 p-2 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-400">QR Code ID (Vínculo)</label>
                            <input 
                                value={selectedObject.qrCode || ''}
                                onChange={(e) => updateSelectedObject('qrCode', e.target.value)}
                                placeholder="Ex: LOC-A1"
                                className="w-full mt-1 p-2 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Este ID vincula produtos ao local.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-gray-400">Largura</label>
                                <input 
                                    type="number"
                                    value={selectedObject.width}
                                    onChange={(e) => updateSelectedObject('width', parseInt(e.target.value))}
                                    className="w-full mt-1 p-2 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400">Altura</label>
                                <input 
                                    type="number"
                                    value={selectedObject.height}
                                    onChange={(e) => updateSelectedObject('height', parseInt(e.target.value))}
                                    className="w-full mt-1 p-2 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10"
                                />
                            </div>
                        </div>

                        <button 
                            onClick={deleteSelected}
                            className="w-full py-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg font-bold text-sm hover:bg-red-200"
                        >
                            Excluir Objeto
                        </button>
                    </div>
                ) : (
                    <p className="text-sm text-gray-400 text-center mt-10">
                        Selecione um objeto no mapa para editar ou clique duas vezes no mapa para criar.
                    </p>
                )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-card-border">
                <button 
                    onClick={handleSave}
                    className="w-full py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700"
                >
                    Salvar Layout
                </button>
            </div>
        </aside>

        {/* Canvas Area */}
        <main className="flex-1 bg-gray-50 dark:bg-[#0f1216] relative overflow-auto cursor-crosshair" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
            <div className="min-w-full min-h-full p-10 flex items-center justify-center">
                <svg 
                    ref={canvasRef}
                    width={layout.width} 
                    height={layout.height} 
                    className="bg-white dark:bg-[#1c2127] shadow-2xl"
                    onMouseDown={handleBackgroundClick}
                    onDoubleClick={handleDoubleClick}
                >
                    {/* Grid Pattern */}
                    <defs>
                        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-gray-200 dark:text-gray-700/50" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />

                    {/* Objects */}
                    {layout.objects.map((obj) => {
                        let fill = '#cbd5e1'; 
                        let stroke = '#94a3b8';
                        
                        switch(obj.type) {
                            case 'shelf': fill = '#bfdbfe'; stroke = '#3b82f6'; break;
                            case 'door': fill = 'none'; stroke = '#22c55e'; break;
                            case 'desk': fill = '#fde047'; stroke = '#eab308'; break;
                            case 'wall': fill = '#475569'; stroke = '#1e293b'; break;
                            case 'area': fill = 'rgba(236, 72, 153, 0.2)'; stroke = '#ec4899'; break;
                        }

                        const isSelected = obj.id === selectedObjId;

                        return (
                            <g 
                                key={obj.id} 
                                onMouseDown={(e) => handleMouseDown(e, obj)}
                                className="cursor-move"
                            >
                                <rect 
                                    x={obj.x} y={obj.y} width={obj.width} height={obj.height}
                                    fill={fill} stroke={isSelected ? '#f43f5e' : stroke}
                                    strokeWidth={isSelected ? 3 : 2}
                                    rx="2"
                                />
                                {obj.width > 20 && (
                                    <text 
                                        x={obj.x + obj.width/2} 
                                        y={obj.y + obj.height/2}
                                        textAnchor="middle" 
                                        dominantBaseline="middle"
                                        fontSize="10"
                                        fontWeight="bold"
                                        fill="#1e293b"
                                        pointerEvents="none"
                                    >
                                        {obj.label}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>
            </div>
        </main>
    </div>
  );
};
