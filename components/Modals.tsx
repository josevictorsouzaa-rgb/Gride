
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  initialCount?: number; // Quantidade previamente contada (para edição)
  scannedLocation?: string; // Código vindo do Scanner da tela pai
  initialLocation?: string; // Localização já salva (para edição)
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
  initialCount,
  scannedLocation = '',
  initialLocation = '',
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
      
      if (initialCount !== undefined && initialCount !== null) {
          setQuantity(initialCount);
      } else {
          setQuantity(systemQuantity || 0);
      }

      setIsAdjustment(false);
      setAdjustmentReason('');
      setProblemReason('');
      setProblemType('not_located');
      
      const locToParse = scannedLocation || initialLocation;
      
      // Validação: Ignora "GERAL" como localização válida para preenchimento
      if (locToParse && locToParse !== 'GERAL') {
          parseLocation(locToParse);
      } else {
          setLocGalpao('');
          setLocEstante('');
          setLocPrateleira('');
      }
    }
  }, [isOpen, systemQuantity, initialCount, scannedLocation, initialLocation]);

  const parseLocation = (code: string) => {
      if (code.includes('-')) {
          const parts = code.split('-');
          if (parts.length >= 4) {
              setLocGalpao(parts[1]);
              setLocEstante(parts[2]);
              setLocPrateleira(parts[3]);
          } else {
              setLocGalpao(code); 
              setLocEstante('');
              setLocPrateleira('');
          }
      } else {
          setLocGalpao(code);
          setLocEstante('');
          setLocPrateleira('');
      }
  };

  if (!isOpen) return null;

  const handleConfirmCount = () => {
      const hasLocation = !!locGalpao;
      
      if (!hasLocation) {
          alert("É obrigatório informar ou escanear a localização.");
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
      onConfirm(quantity, problemType === 'not_located' ? 'not_located' : 'issue', problemReason);
      onClose();
  };

  const isLocationScanned = !!locGalpao;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative z-10 w-full max-w-sm bg-white dark:bg-surface-dark rounded-2xl shadow-2xl flex flex-col max-h-[90dvh] animate-scale-up overflow-hidden">
        
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

        <div className="overflow-y-auto p-4 space-y-4 bg-white dark:bg-surface-dark">
           
           <div className="flex gap-2">
               <div className="flex-1 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-900/30 flex flex-col items-center justify-center text-center">
                   <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wide">Sistema</span>
                   <span className="text-lg font-black text-blue-700 dark:text-blue-300">{systemQuantity}</span>
               </div>
               <div className="flex-[1.5] bg-gray-50 dark:bg-white/5 p-2 rounded-lg border border-gray-100 dark:border-white/10 flex flex-col justify-center pl-3">
                   <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Última Vez</span>
                   {lastCountInfo ? (
                       <div className="text-[10px] text-gray-600 dark:text-gray-300 leading-tight">
                           <strong>{lastCountInfo.quantity} unid.</strong> por {lastCountInfo.user.split(' ')[0]}
                           <br/><span className="opacity-70">{lastCountInfo.date}</span>
                       </div>
                   ) : (
                       <span className="text-[10px] font-medium text-orange-500 flex items-center gap-1">
                           <Icon name="history_toggle_off" size={14} />
                           Nunca foi contado
                       </span>
                   )}
               </div>
           </div>

           {mode === 'counting' ? (
               <>
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
               <div className="animate-fade-in space-y-3">
                   <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30 flex items-start gap-2">
                       <Icon name="block" className="text-red-500 mt-0.5" size={16} />
                       <p className="text-[10px] text-red-800 dark:text-red-200 leading-relaxed">
                           A contagem será zerada (ou ajustada) e o item será enviado para <strong>Tratamento</strong>.
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
                               Outro / Avaria
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
    </div>,
    document.body
  );
};

// --- CONFIRMATION MODAL ---
export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-white dark:bg-surface-dark rounded-2xl p-6 shadow-2xl animate-scale-up">
        <div className="size-14 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600 dark:text-green-400">
          <Icon name="check_circle" size={32} />
        </div>
        <h3 className="text-lg font-bold text-center text-gray-900 dark:text-white mb-2">Finalizar Contagem?</h3>
        <p className="text-center text-sm text-gray-500 mb-6">
          Certifique-se de que todos os itens foram verificados corretamente.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 font-bold text-gray-600 dark:text-gray-300">Voltar</button>
          <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold shadow-lg">Confirmar</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// --- DAMAGE MODAL ---
export const DamageModal: React.FC<DamageModalProps> = ({ isOpen, onClose, onAttach }) => {
    if (!isOpen) return null;
    return createPortal(
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
         <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
         <div className="relative z-10 w-full max-w-sm bg-white dark:bg-surface-dark rounded-2xl p-6 shadow-2xl animate-scale-up">
            <div className="size-14 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400">
               <Icon name="broken_image" size={32} />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900 dark:text-white mb-2">Reportar Avaria</h3>
            <p className="text-center text-sm text-gray-500 mb-6">
               Tire uma foto do produto avariado para anexar ao registro.
            </p>
            <div className="flex gap-3">
               <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 font-bold text-gray-600 dark:text-gray-300">Cancelar</button>
               <button onClick={onAttach} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold shadow-lg flex items-center justify-center gap-2">
                   <Icon name="camera_alt" size={20} />
                   Fotografar
               </button>
            </div>
         </div>
      </div>,
      document.body
    );
}

// --- GIVE UP BLOCK MODAL (uses AbandonModalProps) ---
export const GiveUpBlockModal: React.FC<AbandonModalProps> = ({ isOpen, onClose, onConfirm, blockName }) => {
    if (!isOpen) return null;
    return createPortal(
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
         <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
         <div className="relative z-10 w-full max-w-sm bg-white dark:bg-surface-dark rounded-2xl p-6 shadow-2xl animate-scale-up">
            <div className="size-14 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400">
               <Icon name="warning" size={32} />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900 dark:text-white mb-2">Desistir do Bloco?</h3>
            <p className="text-center text-sm text-gray-500 mb-6">
               O bloco <strong>{blockName}</strong> será liberado para outros usuários. Seu progresso não salvo será perdido.
            </p>
            <div className="flex gap-3">
               <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 font-bold text-gray-600 dark:text-gray-300">Ficar</button>
               <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold shadow-lg">Desistir</button>
            </div>
         </div>
      </div>,
      document.body
    );
}

// --- SCANNER MODAL ---
export const ScannerModal: React.FC<ScannerModalProps> = ({ isOpen, onClose, onScanComplete, title="Scanner", instruction="Posicione o código na câmera" }) => {
    const [scanError, setScanError] = useState('');
    const scannerRef = useRef<any>(null);

    useEffect(() => {
        if (!isOpen) return;
        
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;
        
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        html5QrCode.start({ facingMode: "environment" }, config, 
            (decodedText) => {
                html5QrCode.stop().then(() => {
                     onScanComplete(decodedText);
                }).catch(err => console.error(err));
            },
            (errorMessage) => {
                // ignore parsing error
            }
        ).catch(err => {
            setScanError("Erro ao iniciar câmera: " + err);
        });

        return () => {
            if(html5QrCode.isScanning) {
                html5QrCode.stop().catch(err => console.error(err));
            }
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-black">
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
                <button onClick={onClose} className="text-white p-2"><Icon name="close" size={24} /></button>
                <span className="text-white font-bold">{title}</span>
                <div className="w-8"></div>
            </div>
            
            <div className="flex flex-col h-full justify-center">
                 <div id="reader" className="w-full"></div>
                 <p className="text-center text-white/70 mt-4 px-6">{instruction}</p>
                 {scanError && <p className="text-center text-red-400 mt-2 text-xs">{scanError}</p>}
            </div>
        </div>,
        document.body
    );
}

// --- HISTORY FILTER MODAL ---
export const HistoryFilterModal: React.FC<HistoryFilterModalProps> = ({ isOpen, onClose, availableUsers, currentFilters, onApply, onClear }) => {
    const [localStartDate, setLocalStartDate] = useState(currentFilters.startDate);
    const [localEndDate, setLocalEndDate] = useState(currentFilters.endDate);
    const [localUsers, setLocalUsers] = useState<string[]>(currentFilters.users);

    useEffect(() => {
        if (isOpen) {
            setLocalStartDate(currentFilters.startDate);
            setLocalEndDate(currentFilters.endDate);
            setLocalUsers(currentFilters.users);
        }
    }, [isOpen, currentFilters]);

    if (!isOpen) return null;

    const toggleUser = (u: string) => {
        setLocalUsers(prev => prev.includes(u) ? prev.filter(x => x !== u) : [...prev, u]);
    };

    const handleApply = () => {
        onApply({ startDate: localStartDate, endDate: localEndDate, users: localUsers });
        onClose();
    };

    const handleClearLocal = () => {
        setLocalStartDate('');
        setLocalEndDate('');
        setLocalUsers([]);
        onClear();
        onClose();
    };

    return createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
             <div className="relative z-10 w-full max-w-sm bg-white dark:bg-surface-dark rounded-2xl p-5 shadow-2xl animate-slide-up max-h-[85vh] overflow-y-auto">
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="text-lg font-bold text-gray-900 dark:text-white">Filtrar Histórico</h3>
                     <button onClick={onClose}><Icon name="close" /></button>
                 </div>

                 <div className="space-y-4">
                     <div>
                         <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Período</label>
                         <div className="flex gap-2">
                             <input type="date" value={localStartDate} onChange={e => setLocalStartDate(e.target.value)} className="w-full p-2 rounded-lg bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/10" />
                             <input type="date" value={localEndDate} onChange={e => setLocalEndDate(e.target.value)} className="w-full p-2 rounded-lg bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/10" />
                         </div>
                     </div>

                     <div>
                         <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Usuários</label>
                         <div className="flex flex-wrap gap-2">
                             {availableUsers.map(u => (
                                 <button 
                                    key={u} 
                                    onClick={() => toggleUser(u)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${localUsers.includes(u) ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-transparent border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300'}`}
                                 >
                                     {u}
                                 </button>
                             ))}
                         </div>
                     </div>
                 </div>

                 <div className="mt-6 flex gap-3">
                     <button onClick={handleClearLocal} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 font-bold text-gray-600 dark:text-gray-300">Limpar</button>
                     <button onClick={handleApply} className="flex-[2] py-3 rounded-xl bg-primary text-white font-bold shadow-lg">Aplicar Filtros</button>
                 </div>
             </div>
        </div>,
        document.body
    );
}
