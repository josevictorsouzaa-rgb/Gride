
import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { Html5Qrcode } from "html5-qrcode";

// --- Types ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface EntryModalProps extends ModalProps {
  itemName?: string;
  itemSku?: string;
  itemBrand?: string;
  systemQuantity?: number; // Quantidade do Sistema
  scannedLocation?: string; // Código vindo do Scanner da tela pai
  onRequestScan?: () => void; // Função para abrir o scanner da tela pai
  lastCountInfo?: {
    user: string;
    date: string;
    quantity: number;
    avatar?: string;
  } | null;
  onConfirm: (quantity: number, status?: 'counted' | 'not_located' | 'issue', divergenceReason?: string) => void;
}

interface ConfirmationModalProps extends ModalProps {
  onConfirm: () => void;
}

interface AbandonModalProps extends ModalProps {
  onConfirm: () => void;
  blockName?: string;
}

interface DamageModalProps extends ModalProps {
  onAttach: () => void;
}

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (code: string) => void; 
  title?: string;
  instruction?: string;
}

interface PrintLabelModalProps extends ModalProps {
  data: {
    type: 'ESTANTE' | 'PRATELEIRA';
    number: string;
    fullCode: string;
  } | null;
}

interface HistoryFilterModalProps extends ModalProps {
  availableUsers: string[];
  currentFilters: {
    startDate: string;
    endDate: string;
    users: string[]; 
  };
  onApply: (filters: { startDate: string; endDate: string; users: string[] }) => void;
  onClear: () => void;
}

// --- ENTRY MODAL (REFORMULADO - COMPACTO E CENTRALIZADO) ---

export const EntryModal: React.FC<EntryModalProps> = ({ 
  isOpen, 
  onClose, 
  itemName, 
  itemSku,
  itemBrand,
  systemQuantity = 0,
  scannedLocation = '',
  onRequestScan,
  lastCountInfo, 
  onConfirm 
}) => {
  const [mode, setMode] = useState<'counting' | 'problem'>('counting');
  
  const [quantity, setQuantity] = useState(systemQuantity);
  const [locGalpao, setLocGalpao] = useState('');
  const [locEstante, setLocEstante] = useState('');
  const [locPrateleira, setLocPrateleira] = useState('');
  
  const [isAdjustment, setIsAdjustment] = useState(false);
  const [adjustmentReason, setAdjustmentReason] = useState('');

  const [problemReason, setProblemReason] = useState('');
  const [problemType, setProblemType] = useState<'not_located' | 'other'>('not_located');

  // Bloqueio de scroll do body
  useEffect(() => {
    if (isOpen) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setMode('counting');
      setQuantity(systemQuantity || 0);
      setIsAdjustment(false);
      setAdjustmentReason('');
      setProblemReason('');
      setProblemType('not_located');
      
      if (scannedLocation) {
          parseLocation(scannedLocation);
      } else {
          setLocGalpao('');
          setLocEstante('');
          setLocPrateleira('');
      }
    }
  }, [isOpen, systemQuantity, scannedLocation]);

  const parseLocation = (code: string) => {
      const parts = code.split('-');
      if (parts.length >= 4) {
          setLocGalpao(parts[1]);
          setLocEstante(parts[2]);
          setLocPrateleira(parts[3]);
      } else {
          setLocGalpao('?');
          setLocEstante('?');
          setLocPrateleira('?');
      }
  };

  if (!isOpen) return null;

  const handleConfirmCount = () => {
      if (!locGalpao || !locEstante || !locPrateleira) {
          alert("É obrigatório escanear a localização.");
          return;
      }
      if (quantity === systemQuantity && !isAdjustment) {
          const confirmSame = window.confirm("Quantidade igual ao sistema. Confirma?");
          if (!confirmSame) return;
      }
      if (isAdjustment && adjustmentReason.trim().length < 5) {
          alert("Descreva o motivo do ajuste.");
          return;
      }
      onConfirm(quantity, 'counted', isAdjustment ? adjustmentReason : undefined);
      onClose();
  };

  const handleReportProblem = () => {
      if (problemReason.trim().length < 5) {
          alert("Descreva o problema.");
          return;
      }
      onConfirm(0, problemType === 'not_located' ? 'not_located' : 'issue', problemReason);
      onClose();
  };

  const isLocationScanned = !!locGalpao && !!locEstante;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      {/* Container Principal - Altura Maxima controlada para não estourar a tela */}
      <div className="relative z-10 w-full max-w-sm bg-white dark:bg-surface-dark rounded-2xl shadow-2xl flex flex-col max-h-[90dvh] animate-scale-up overflow-hidden">
        
        {/* Header Compacto */}
        <div className="bg-[#182335] p-3 text-white shrink-0 shadow-md z-20 flex justify-between items-start">
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="text-sm font-bold leading-tight line-clamp-2 text-white/90">{itemName || 'Item Desconhecido'}</h3>
            <div className="flex items-center gap-2 mt-1 opacity-80 text-[10px] font-mono">
                <span className="bg-white/10 px-1 rounded">{itemSku}</span>
                <span>•</span>
                <span className="uppercase">{itemBrand}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white p-1 -mr-1"><Icon name="close" size={20} /></button>
        </div>

        {/* Corpo com Scroll se necessário */}
        <div className="overflow-y-auto p-4 space-y-4 bg-white dark:bg-surface-dark">
           
           {/* Cards Lado a Lado Compactos */}
           <div className="flex gap-2">
               <div className="flex-1 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-900/30 flex flex-col items-center justify-center text-center">
                   <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wide">Sistema</span>
                   <span className="text-lg font-black text-blue-700 dark:text-blue-300">{systemQuantity}</span>
               </div>
               <div className="flex-[1.5] bg-gray-50 dark:bg-white/5 p-2 rounded-lg border border-gray-100 dark:border-white/10 flex flex-col justify-center pl-3">
                   <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Última Vez</span>
                   {lastCountInfo ? (
                       <div className="text-[10px] text-gray-600 dark:text-gray-300 leading-tight">
                           <strong>{lastCountInfo.quantity} un</strong> por {lastCountInfo.user.split(' ')[0]}
                           <br/><span className="opacity-70">{lastCountInfo.date}</span>
                       </div>
                   ) : (
                       <span className="text-[10px] font-medium text-orange-500">Nunca contado</span>
                   )}
               </div>
           </div>

           {mode === 'counting' ? (
               <>
                   {/* Localização Compacta */}
                   <div className="space-y-1">
                       <div className="flex justify-between items-center">
                           <label className="text-[10px] font-bold text-gray-500 uppercase">Localização</label>
                           {!isLocationScanned ? (
                               <span className="text-red-500 text-[9px] font-bold bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">Scan Obrigatório</span>
                           ) : (
                               <span className="text-green-500 text-[9px] font-bold flex items-center gap-1"><Icon name="check_circle" size={10} /> Ok</span>
                           )}
                       </div>
                       
                       <div className="flex gap-2 h-10">
                           <div className="flex-1 flex gap-1">
                               <input placeholder="G" readOnly value={locGalpao} className="w-full text-center text-sm font-bold bg-gray-100 dark:bg-black/40 rounded border border-gray-200 dark:border-white/5 text-gray-700 dark:text-white" />
                               <input placeholder="E" readOnly value={locEstante} className="w-full text-center text-sm font-bold bg-gray-100 dark:bg-black/40 rounded border border-gray-200 dark:border-white/5 text-gray-700 dark:text-white" />
                               <input placeholder="P" readOnly value={locPrateleira} className="w-full text-center text-sm font-bold bg-gray-100 dark:bg-black/40 rounded border border-gray-200 dark:border-white/5 text-gray-700 dark:text-white" />
                           </div>
                           <button 
                             onClick={onRequestScan}
                             className={`w-12 rounded flex items-center justify-center transition-all shadow-sm ${
                                 isLocationScanned 
                                 ? 'bg-green-100 text-green-700 border border-green-200' 
                                 : 'bg-primary text-white hover:bg-primary-dark animate-pulse shadow-primary/30'
                             }`}
                           >
                               <Icon name="qr_code_scanner" size={20} />
                           </button>
                       </div>
                   </div>

                   {/* Quantidade Compacta */}
                   <div className="flex flex-col items-center pt-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase mb-2">Contagem</label>
                      <div className="flex items-center gap-4">
                         <button 
                            onClick={() => setQuantity(Math.max(0, quantity - 1))} 
                            className="size-12 rounded-xl bg-gray-100 dark:bg-white/10 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-white/20 active:scale-95 transition-all text-gray-600 dark:text-white shadow-sm border border-gray-200 dark:border-white/5"
                         >
                            <Icon name="remove" size={20} />
                         </button>
                         
                         <div className="relative w-24 text-center">
                             <input 
                                type="number" 
                                value={quantity} 
                                onChange={(e) => setQuantity(Number(e.target.value))}
                                className="w-full text-center text-4xl font-black bg-transparent border-none focus:ring-0 p-0 text-gray-900 dark:text-white"
                             />
                         </div>

                         <button 
                            onClick={() => setQuantity(quantity + 1)} 
                            className="size-12 rounded-xl bg-gray-100 dark:bg-white/10 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-white/20 active:scale-95 transition-all text-gray-600 dark:text-white shadow-sm border border-gray-200 dark:border-white/5"
                         >
                            <Icon name="add" size={20} />
                         </button>
                      </div>
                   </div>

                   {/* Checkbox Divergência */}
                   <div>
                       <button 
                         onClick={() => setIsAdjustment(!isAdjustment)}
                         className={`w-full flex items-center justify-center gap-2 text-[10px] font-bold py-2 rounded-lg transition-colors border border-dashed ${isAdjustment ? 'text-orange-500 border-orange-300 bg-orange-50 dark:bg-orange-900/10' : 'text-gray-400 border-gray-300 dark:border-gray-600 hover:text-gray-600 dark:hover:text-gray-200'}`}
                       >
                           <Icon name={isAdjustment ? "check_box" : "check_box_outline_blank"} size={14} />
                           Informar erro de cadastro / descrição
                       </button>
                       
                       {isAdjustment && (
                           <textarea 
                               autoFocus
                               value={adjustmentReason}
                               onChange={(e) => setAdjustmentReason(e.target.value)}
                               className="w-full mt-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 text-xs resize-none focus:ring-1 focus:ring-orange-500 outline-none animate-slide-up"
                               placeholder="Descreva a divergência..."
                               rows={2}
                           />
                       )}
                   </div>
               </>
           ) : (
               /* Modo Reportar Problema */
               <div className="animate-fade-in space-y-3">
                   <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30 flex items-start gap-2">
                       <Icon name="block" className="text-red-500 mt-0.5" size={16} />
                       <p className="text-[10px] text-red-800 dark:text-red-200 leading-relaxed">
                           A contagem será zerada e enviada para <strong>Tratamento</strong>.
                       </p>
                   </div>
                   
                   <div className="space-y-2">
                       <label className="text-[10px] font-bold text-gray-500 uppercase block">Tipo</label>
                       <div className="flex gap-2">
                           <button 
                             onClick={() => setProblemType('not_located')}
                             className={`flex-1 py-2 rounded-lg border text-[10px] font-bold transition-all ${
                                 problemType === 'not_located' 
                                 ? 'bg-gray-800 text-white border-gray-800 dark:bg-white dark:text-black' 
                                 : 'bg-white dark:bg-transparent border-gray-200 dark:border-gray-700 text-gray-500'
                             }`}
                           >
                               Não Localizado
                           </button>
                           <button 
                             onClick={() => setProblemType('other')}
                             className={`flex-1 py-2 rounded-lg border text-[10px] font-bold transition-all ${
                                 problemType === 'other' 
                                 ? 'bg-gray-800 text-white border-gray-800 dark:bg-white dark:text-black' 
                                 : 'bg-white dark:bg-transparent border-gray-200 dark:border-gray-700 text-gray-500'
                             }`}
                           >
                               Outro
                           </button>
                       </div>

                       <div>
                           <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Descrição *</label>
                           <textarea 
                               value={problemReason}
                               onChange={(e) => setProblemReason(e.target.value)}
                               className="w-full h-20 p-3 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 resize-none focus:ring-1 focus:ring-red-500 outline-none text-xs"
                               placeholder="O que houve?"
                           />
                       </div>
                   </div>
               </div>
           )}

        </div>

        {/* Footer Actions Compacto */}
        <div className="p-3 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-black/20 shrink-0">
            {mode === 'counting' ? (
                <div className="flex gap-2">
                    <button 
                        onClick={() => setMode('problem')}
                        className="flex-[0.8] h-11 rounded-lg border border-red-200 dark:border-red-900/30 text-red-500 dark:text-red-400 font-bold text-xs hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex flex-col items-center justify-center leading-none"
                    >
                        <span>Reportar</span>
                        <span className="text-[9px] opacity-70 mt-0.5">Problema</span>
                    </button>
                    
                    <button 
                        onClick={handleConfirmCount}
                        disabled={!isLocationScanned}
                        className={`flex-[2] h-11 rounded-lg font-bold text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                            isLocationScanned 
                            ? 'bg-primary hover:bg-primary-dark active:scale-[0.98]' 
                            : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-70'
                        }`}
                    >
                        <Icon name="check_circle" size={20} />
                        Confirmar
                    </button>
                </div>
            ) : (
                <div className="flex gap-2">
                    <button 
                        onClick={() => setMode('counting')}
                        className="flex-1 h-11 rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 font-bold text-xs hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    >
                        Voltar
                    </button>
                    <button 
                        onClick={handleReportProblem}
                        className="flex-[1.5] h-11 rounded-lg bg-red-600 text-white font-bold text-sm shadow-lg shadow-red-600/20 hover:bg-red-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <Icon name="send" size={18} />
                        Enviar
                    </button>
                </div>
            )}
        </div>

      </div>
    </div>
  );
};

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-white dark:bg-surface-dark rounded-2xl shadow-xl p-6 text-center animate-scale-up">
        <div className="size-16 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 flex items-center justify-center mx-auto mb-4">
            <Icon name="check" size={32} />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Finalizar Contagem?</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
            Confirma que todos os itens deste bloco foram verificados? Essa ação não pode ser desfeita.
        </p>
        <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 font-bold">
                Cancelar
            </button>
            <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold shadow-lg hover:bg-green-700">
                Finalizar
            </button>
        </div>
      </div>
    </div>
  );
};

export const GiveUpBlockModal: React.FC<AbandonModalProps> = ({ isOpen, onClose, onConfirm, blockName }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-white dark:bg-surface-dark rounded-2xl shadow-xl p-6 text-center animate-scale-up border-2 border-red-100 dark:border-red-900/30">
        <div className="size-16 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
            <Icon name="block" size={32} />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Devolver Bloco?</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
            Você está prestes a desistir da contagem do bloco <strong>{blockName || 'Selecionado'}</strong>. 
            <br/><br/>
            Qualquer contagem não finalizada será descartada e o bloco ficará disponível para outros usuários.
        </p>
        <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 font-bold">
                Voltar
            </button>
            <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold shadow-lg hover:bg-red-700 flex items-center justify-center gap-2">
                <Icon name="backspace" size={18} />
                Devolver
            </button>
        </div>
      </div>
    </div>
  );
};

export const DamageModal: React.FC<DamageModalProps> = ({ isOpen, onClose, onAttach }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-white dark:bg-surface-dark rounded-2xl shadow-xl p-6 animate-scale-up">
        <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
            <Icon name="report_problem" size={24} />
            <h3 className="text-lg font-bold">Reportar Avaria</h3>
        </div>
        
        <div className="space-y-4">
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Descrição do Problema</label>
                <textarea 
                    className="w-full p-3 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 text-sm resize-none h-24"
                    placeholder="Ex: Embalagem rasgada, peça amassada..."
                />
            </div>
            
            <button className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400 font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                <Icon name="camera_alt" />
                Anexar Foto
            </button>

            <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 font-bold">
                    Cancelar
                </button>
                <button onClick={onAttach} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold shadow-lg hover:bg-red-700">
                    Registrar
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

// ... (Rest of modals like HistoryFilterModal, ScannerModal, PrintLabelModal remain unchanged)
export const HistoryFilterModal: React.FC<HistoryFilterModalProps> = ({ 
  isOpen, 
  onClose, 
  availableUsers, 
  currentFilters, 
  onApply,
  onClear
}) => {
  const [startDate, setStartDate] = useState(currentFilters.startDate);
  const [endDate, setEndDate] = useState(currentFilters.endDate);
  const [selectedUsers, setSelectedUsers] = useState<string[]>(currentFilters.users || []);

  useEffect(() => {
    if (isOpen) {
      setStartDate(currentFilters.startDate);
      setEndDate(currentFilters.endDate);
      setSelectedUsers(currentFilters.users || []);
    }
  }, [isOpen, currentFilters]);

  if (!isOpen) return null;

  const handleApply = () => {
    onApply({ startDate, endDate, users: selectedUsers });
    onClose();
  };

  const handleClear = () => {
    setStartDate('');
    setEndDate('');
    setSelectedUsers([]);
    onClear();
    onClose();
  };

  const toggleUser = (user: string) => {
    setSelectedUsers(prev => {
      if (prev.includes(user)) {
        return prev.filter(u => u !== user);
      } else {
        return [...prev, user];
      }
    });
  };

  const toggleAllUsers = () => {
    if (selectedUsers.length === availableUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers([...availableUsers]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center no-print">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative z-10 w-full bg-white dark:bg-surface-dark rounded-t-[32px] shadow-2xl flex flex-col max-h-[90vh] animate-slide-up">
        <div className="flex w-full items-center justify-center pt-3 pb-1">
          <div className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-card-border" />
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/5">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Filtrar Histórico</h2>
          <button onClick={handleClear} className="text-sm font-medium text-primary hover:text-primary-dark">
            Limpar
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto no-scrollbar">
          {/* Date Range Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <Icon name="date_range" size={18} />
              Período
            </h3>
            <div className="flex gap-4 items-center">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-gray-400 font-medium ml-1">De</label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-12 pl-3 pr-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm"
                  />
                </div>
              </div>
              <div className="text-gray-400 pt-5">
                <Icon name="arrow_forward" size={20} />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-gray-400 font-medium ml-1">Até</label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full h-12 pl-3 pr-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-white/5" />

          {/* User Selection Section */}
          <div className="space-y-3 flex-1 min-h-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Icon name="group" size={18} />
                Realizado por
              </h3>
              <button 
                onClick={toggleAllUsers}
                className="text-xs font-semibold text-primary"
              >
                {selectedUsers.length === availableUsers.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            </div>
            
            <div className="flex flex-col border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden bg-gray-50/50 dark:bg-black/20 max-h-60 overflow-y-auto">
                {availableUsers.map((user, index) => {
                  const isSelected = selectedUsers.includes(user);
                  return (
                    <button
                      key={user}
                      onClick={() => toggleUser(user)}
                      className={`flex items-center gap-3 p-3.5 transition-colors border-b border-gray-100 dark:border-white/5 last:border-0 ${
                        isSelected 
                          ? 'bg-blue-50 dark:bg-blue-900/10' 
                          : 'hover:bg-gray-100 dark:hover:bg-white/5'
                      }`}
                    >
                       <div className={`flex items-center justify-center size-5 rounded border transition-all ${
                         isSelected 
                           ? 'bg-primary border-primary text-white' 
                           : 'bg-white dark:bg-white/5 border-gray-300 dark:border-white/20'
                       }`}>
                          {isSelected && <Icon name="check" size={16} />}
                       </div>
                       
                       <div className="flex items-center gap-3 flex-1">
                          <div className="size-8 rounded-full bg-gray-200 dark:bg-gray-700 bg-center bg-cover" style={{ backgroundImage: `url('https://i.pravatar.cc/150?u=${user}')` }} />
                          <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-gray-700 dark:text-gray-300'}`}>
                            {user}
                          </span>
                       </div>
                    </button>
                  );
                })}
                {availableUsers.length === 0 && (
                  <div className="p-4 text-center text-sm text-gray-400">Nenhum usuário disponível</div>
                )}
            </div>
            <p className="text-xs text-gray-400 px-1">
              {selectedUsers.length === 0 
                ? 'Nenhum usuário selecionado (Exibindo todos)' 
                : `${selectedUsers.length} usuários selecionados`}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 dark:border-card-border bg-background-light dark:bg-background-dark pb-safe">
          <button 
            onClick={handleApply}
            className="w-full h-14 bg-primary text-white rounded-xl font-bold text-lg shadow-xl shadow-primary/20 hover:bg-primary-dark active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            Aplicar Filtros
            <Icon name="check" size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

export const ScannerModal: React.FC<ScannerModalProps> = ({ 
  isOpen, 
  onClose, 
  onScanComplete, 
  title = "Ler QR Code", 
  instruction = "Aponte a câmera para o código" 
}) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string>('');
  const [isPermDenied, setIsPermDenied] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0); 
  const [canToggleTorch, setCanToggleTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    let html5QrCode: Html5Qrcode;

    const startScanner = async () => {
      if (isOpen) {
        setIsPermDenied(false);
        setError('');
        setCanToggleTorch(false);
        setTorchOn(false);
        
        await new Promise(r => setTimeout(r, 100));

        try {
          html5QrCode = new Html5Qrcode("reader");
          scannerRef.current = html5QrCode;
          
          const config = {
              fps: 15,
              qrbox: { width: 250, height: 250 },
              aspectRatio: window.innerHeight / window.innerWidth
          };

          const constraints = { 
              facingMode: "environment",
              focusMode: "continuous", 
              width: { min: 640, ideal: 1280, max: 1920 }, 
              height: { min: 480, ideal: 720, max: 1080 }
          };

          await html5QrCode.start(
            constraints, 
            config,
            (decodedText) => {
              html5QrCode.stop().then(() => {
                scannerRef.current = null;
                onScanComplete(decodedText);
              }).catch(err => console.error(err));
            },
            (errorMessage) => { }
          );

          try {
             const capabilities = html5QrCode.getRunningTrackCameraCapabilities();
             const cap: any = capabilities; 
             if (cap && (cap.torch || cap.fillLightMode)) {
                 setCanToggleTorch(true);
             }
          } catch(e) {
             console.log("Erro ao verificar flash capability", e);
          }

        } catch (err: any) {
          console.error("Erro ao iniciar câmera", err);
          if (err?.name === 'NotAllowedError' || err?.message?.includes('permission')) {
             setIsPermDenied(true);
             setError('Permissão de câmera negada.');
          } else {
             if (!window.isSecureContext && window.location.hostname !== 'localhost') {
                setError('Erro: Câmera requer HTTPS. Conexão atual é insegura.');
             } else {
                setError('Não foi possível iniciar a câmera.');
             }
          }
        }
      }
    };

    if (isOpen) {
      startScanner();
    }

    return () => {
      if (scannerRef.current) {
         scannerRef.current.stop().catch(err => console.error("Falha ao parar scanner", err));
         scannerRef.current = null;
      }
    };
  }, [isOpen, onScanComplete, retryTrigger]);

  const handleClose = () => {
    if (scannerRef.current) {
        scannerRef.current.stop().then(() => {
            scannerRef.current = null;
            onClose();
        }).catch(() => onClose());
    } else {
        onClose();
    }
  };

  const handleRetryPermission = () => {
      // Forçar desmontagem/remontagem lógica
      if (scannerRef.current) {
          scannerRef.current.stop().then(() => {
              scannerRef.current = null;
              setRetryTrigger(prev => prev + 1);
          }).catch(() => {
              scannerRef.current = null;
              setRetryTrigger(prev => prev + 1);
          });
      } else {
          setRetryTrigger(prev => prev + 1);
      }
  };

  const handleToggleTorch = async () => {
      if (!scannerRef.current) return;
      try {
          await scannerRef.current.applyVideoConstraints({
              advanced: [{ torch: !torchOn }]
          } as any);
          setTorchOn(!torchOn);
      } catch (err) {
          console.error("Erro ao alternar flash", err);
          alert("Não foi possível alternar o flash neste dispositivo.");
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black no-print">
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-20 pt-safe bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={handleClose} className="p-2 rounded-full bg-black/40 text-white backdrop-blur-md border border-white/10">
          <Icon name="close" size={24} />
        </button>
        <div className="px-3 py-1.5 rounded-full bg-black/40 text-white text-xs font-bold backdrop-blur-md border border-white/10 uppercase tracking-wide">
          {title}
        </div>
        
        {/* Botão Flash (condicional) */}
        {canToggleTorch ? (
            <button 
                onClick={handleToggleTorch}
                className={`p-2 rounded-full backdrop-blur-md border transition-colors ${torchOn ? 'bg-yellow-400 text-black border-yellow-500' : 'bg-black/40 text-white border-white/10'}`}
            >
                <Icon name={torchOn ? "flash_on" : "flash_off"} size={24} fill={torchOn} />
            </button>
        ) : (
            <div className="w-10"></div> 
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative bg-black">
         <div id="reader" className="w-full h-full object-cover"></div>
         {(error || isPermDenied) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-8 text-center z-30 animate-fade-in">
                <div className="size-20 rounded-full bg-red-900/30 text-red-500 flex items-center justify-center mb-6 border border-red-500/30">
                    <Icon name={isPermDenied ? "no_photography" : "error"} size={40} />
                </div>
                <h3 className="text-white font-bold text-xl mb-3">
                    {isPermDenied ? "Acesso Negado" : "Erro na Câmera"}
                </h3>
                <p className="text-gray-400 text-sm mb-8 max-w-xs leading-relaxed">
                    {isPermDenied 
                        ? "O navegador bloqueou a câmera. Habilite nas configurações do site e tente novamente." 
                        : error}
                </p>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <button 
                        onClick={handleRetryPermission} 
                        className="w-full bg-primary hover:bg-primary-dark text-white px-6 py-3.5 rounded-xl font-bold text-sm transition-colors shadow-lg shadow-primary/20"
                    >
                        Tentar Habilitar Novamente
                    </button>
                    <button 
                        onClick={handleClose} 
                        className="w-full bg-white/10 hover:bg-white/20 text-white px-6 py-3.5 rounded-xl font-bold text-sm transition-colors"
                    >
                        Fechar
                    </button>
                </div>
            </div>
         )}
         {!error && !isPermDenied && (
             <>
                <div className="absolute inset-0 pointer-events-none border-[40px] border-black/50 z-10 flex items-center justify-center">
                   <div className="relative w-64 h-64 border-2 border-white/20 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                      <div className="absolute top-0 left-0 w-6 h-6 border-l-4 border-t-4 border-primary rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-6 h-6 border-r-4 border-t-4 border-primary rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-l-4 border-b-4 border-primary rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-r-4 border-b-4 border-primary rounded-br-lg" />
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/80 shadow-[0_0_15px_rgba(19,127,236,0.8)] animate-[slideUp_2s_ease-in-out_infinite]" />
                   </div>
                </div>
                <div className="absolute bottom-10 left-0 right-0 z-20 flex justify-center pb-safe">
                    <p className="text-white/90 text-sm font-medium bg-black/60 px-6 py-3 rounded-full backdrop-blur-md border border-white/10 text-center">
                    {instruction}
                    </p>
                </div>
             </>
         )}
      </div>
      <style>{`
         #reader__scan_region img { display: none; }
         #reader__dashboard_section_csr button { display: none; }
         #reader video { object-fit: cover; width: 100% !important; height: 100% !important; }
      `}</style>
    </div>
  );
};

export const PrintLabelModal: React.FC<PrintLabelModalProps> = ({ isOpen, onClose, data }) => {
    const [labelType, setLabelType] = useState<'ESTANTE' | 'PRATELEIRA'>(data?.type || 'ESTANTE');
    const [printSize, setPrintSize] = useState<'60x30' | '60x20'>('60x30');

    useEffect(() => { if(data) setLabelType(data.type); }, [data]);

    useEffect(() => {
        if (isOpen) {
            const styleId = 'dynamic-print-modal-size';
            let style = document.getElementById(styleId) as HTMLStyleElement;
            if (!style) {
                style = document.createElement('style');
                style.id = styleId;
                document.head.appendChild(style);
            }
            const heightMm = printSize === '60x30' ? '30mm' : '20mm';
            const qrSize = printSize === '60x30' ? '22mm' : '16mm';
            const titleSize = printSize === '60x30' ? '7pt' : '6pt';
            const numSize = printSize === '60x30' ? '24pt' : '16pt';
            const codeSize = printSize === '60x30' ? '9pt' : '8pt';
            const barPadding = printSize === '60x30' ? '1mm 2mm' : '0.5mm 1mm';

            style.innerHTML = `@media print { @page { size: 60mm ${heightMm}; margin: 0; } body { margin: 0; padding: 0; } #print-area-modal { display: flex !important; width: 60mm; height: ${heightMm}; box-sizing: border-box; overflow: hidden; padding: 1mm; align-items: center; } .qr-box { width: ${qrSize} !important; height: ${qrSize} !important; flex-shrink: 0; margin-right: 1mm; } .info-column { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 0.5mm; } .black-bar { padding: ${barPadding}; } .label-type { font-size: ${titleSize} !important; } .label-number { font-size: ${numSize} !important; margin-left: 2mm; } .code-text { font-size: ${codeSize} !important; margin-top: 0.5mm; } }`;
        }
    }, [isOpen, printSize]);

    if (!isOpen || !data) return null;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${data.fullCode}`;
    const displayLabel = labelType === 'ESTANTE' ? 'ESTANTE' : 'PRATELEIRA';
    const previewHeight = printSize === '60x30' ? '120px' : '80px';
    const previewQrSize = printSize === '60x30' ? '80px' : '60px';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
            <div className="bg-white rounded-lg shadow-xl overflow-hidden w-full max-w-2xl flex flex-col">
                <div className="p-4 bg-gray-100 flex justify-between items-center no-print border-b">
                    <h3 className="font-bold text-lg text-gray-800">Visualizar Impressão</h3>
                    <div className="flex gap-2">
                        <select value={printSize} onChange={(e) => setPrintSize(e.target.value as any)} className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2">
                            <option value="60x30">60mm x 30mm (Padrão)</option>
                            <option value="60x20">60mm x 20mm (Compacto)</option>
                        </select>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-800 p-1"><Icon name="close" size={24} /></button>
                    </div>
                </div>
                <div className="p-4 flex gap-4 justify-center bg-gray-50 no-print border-b">
                    <button onClick={() => setLabelType('ESTANTE')} className={`px-4 py-2 rounded font-bold transition-colors ${labelType === 'ESTANTE' ? 'bg-black text-white' : 'bg-gray-200 text-gray-700'}`}>ESTANTE</button>
                    <button onClick={() => setLabelType('PRATELEIRA')} className={`px-4 py-2 rounded font-bold transition-colors ${labelType === 'PRATELEIRA' ? 'bg-black text-white' : 'bg-gray-200 text-gray-700'}`}>PRATELEIRA</button>
                </div>
                <div className="p-8 bg-gray-200 flex justify-center overflow-auto items-center min-h-[200px]">
                    <div id="print-area-modal" className="bg-white border border-dashed border-gray-400 flex items-center box-border p-1 relative shadow-sm" style={{ width: '240px', height: previewHeight }}>
                        <div className="flex items-center justify-center shrink-0 mr-2 qr-box" style={{width: previewQrSize, height: previewQrSize}}><img src={qrUrl} alt="QR Code" className="w-full h-full object-contain" style={{imageRendering: 'pixelated'}} /></div>
                        <div className="flex-1 flex flex-col justify-center h-full info-column">
                            <div className="w-full bg-black text-white flex items-center justify-between rounded px-2 py-1 black-bar">
                                <span className="font-bold uppercase tracking-tight label-type" style={{fontSize: '10px'}}>{displayLabel}</span>
                                <span className="font-black tracking-tighter leading-none label-number" style={{fontSize: '24px'}}>{data.number}</span>
                            </div>
                            <div className="text-center w-full mt-1 code-text">
                                <p className="font-black text-black tracking-wider leading-none whitespace-nowrap overflow-visible" style={{fontSize: '12px'}}>{data.fullCode}</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 no-print">
                    <button onClick={onClose} className="px-6 py-3 rounded-lg font-bold text-gray-600 hover:bg-gray-200">Cancelar</button>
                    <button onClick={() => window.print()} className="px-6 py-3 rounded-lg font-bold bg-primary text-white hover:bg-primary-dark shadow-lg flex items-center gap-2"><Icon name="print" />IMPRIMIR</button>
                </div>
            </div>
        </div>
    );
};
