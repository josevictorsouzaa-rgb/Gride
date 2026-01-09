
import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { Html5Qrcode } from "html5-qrcode";

// --- Types ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface LocationParts {
  g: string;
  e: string;
  p: string;
}

interface EntryModalProps extends ModalProps {
  itemName?: string;
  itemSku?: string;
  itemLocation?: string;
  locationParts?: LocationParts | null; // Novo: partes separadas
  initialQuantity?: number;
  lastCountInfo?: {
    user: string;
    date: string;
    quantity: number;
    avatar?: string;
  } | null;
  onConfirm: (quantity: number, status?: 'counted' | 'not_located' | 'divergence_info', divergenceReason?: string) => void;
  onRequestScanLocation?: () => void;
  isLocationVerified?: boolean;
}

interface ConfirmationModalProps extends ModalProps {
  onConfirm: () => void;
}

interface AbandonModalProps extends ModalProps {
  onConfirm: () => void;
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

// --- REDESIGNED PROFESSIONAL ENTRY MODAL ---

export const EntryModal: React.FC<EntryModalProps> = ({ 
  isOpen, 
  onClose, 
  itemName, 
  itemSku,
  itemLocation,
  locationParts,
  initialQuantity = 0, 
  lastCountInfo, 
  onConfirm,
  onRequestScanLocation,
  isLocationVerified = false
}) => {
  const [quantity, setQuantity] = useState(initialQuantity);
  const [divergenceReason, setDivergenceReason] = useState('');
  const [showDivergenceInput, setShowDivergenceInput] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setQuantity(initialQuantity || 0);
      setDivergenceReason('');
      setShowDivergenceInput(false);
    }
  }, [isOpen, initialQuantity]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(quantity, 'counted');
    onClose();
  };

  const handleNotLocated = () => {
    onConfirm(0, 'not_located');
    onClose();
  };

  const handleDivergence = () => {
    if (!showDivergenceInput) {
        setShowDivergenceInput(true);
        return;
    }
    onConfirm(quantity, 'divergence_info', divergenceReason);
    onClose();
  };

  // Helper para extrair partes se não vierem prontas, ou usar defaults
  const displayLoc = locationParts || { g: '?', e: '?', p: '?' };
  if (!locationParts && itemLocation) {
      // Tenta parser simples se não tiver parts
      const parts = itemLocation.split('-');
      if (parts.length >= 3) {
          // Ex: LOC-G01-E02-P03 ou G01-E02-P03
          // Ajuste conforme seu padrão real. Assumindo LOC-G-E-P
          const hasLocPrefix = parts[0] === 'LOC';
          displayLoc.g = hasLocPrefix ? parts[1].replace(/\D/g,'') : parts[0].replace(/\D/g,'');
          displayLoc.e = hasLocPrefix ? parts[2].replace(/\D/g,'') : parts[1].replace(/\D/g,'');
          displayLoc.p = hasLocPrefix ? (parts[3] ? parts[3].replace(/\D/g,'') : '') : (parts[2] ? parts[2].replace(/\D/g,'') : '');
      }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-[#1e293b] text-white rounded-2xl shadow-2xl overflow-hidden animate-scale-up border border-gray-700">
        
        {/* Header Compacto */}
        <div className="px-6 py-4 bg-[#0f172a] border-b border-gray-700 flex justify-between items-center">
            <div>
                <h3 className="text-lg font-bold leading-tight text-white">{itemName || 'Produto'}</h3>
                <p className="text-xs text-blue-400 font-mono mt-0.5 tracking-wider">{itemSku}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><Icon name="close" /></button>
        </div>
        
        <div className="p-6 space-y-6">
           
           {/* Section: Validação de Endereço (G, E, P) */}
           <div className="bg-[#334155]/50 rounded-xl p-4 border border-gray-700">
              <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold uppercase text-gray-400 tracking-wider">Conferência de Endereço</span>
                  <button 
                    onClick={onRequestScanLocation}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        isLocationVerified 
                        ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg'
                    }`}
                  >
                    <Icon name={isLocationVerified ? "verified" : "qr_code_scanner"} size={16} />
                    {isLocationVerified ? 'Validado' : 'Escanear Local'}
                  </button>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                  <div className={`flex flex-col items-center p-2 rounded-lg border ${isLocationVerified ? 'bg-green-500/10 border-green-500/30' : 'bg-[#0f172a] border-gray-600'}`}>
                      <span className="text-[10px] text-gray-400 font-bold uppercase mb-1">Galpão</span>
                      <span className={`text-xl font-black ${isLocationVerified ? 'text-green-400' : 'text-white'}`}>{displayLoc.g}</span>
                  </div>
                  <div className={`flex flex-col items-center p-2 rounded-lg border ${isLocationVerified ? 'bg-green-500/10 border-green-500/30' : 'bg-[#0f172a] border-gray-600'}`}>
                      <span className="text-[10px] text-gray-400 font-bold uppercase mb-1">Estante</span>
                      <span className={`text-xl font-black ${isLocationVerified ? 'text-green-400' : 'text-white'}`}>{displayLoc.e}</span>
                  </div>
                  <div className={`flex flex-col items-center p-2 rounded-lg border ${isLocationVerified ? 'bg-green-500/10 border-green-500/30' : 'bg-[#0f172a] border-gray-600'}`}>
                      <span className="text-[10px] text-gray-400 font-bold uppercase mb-1">Nível</span>
                      <span className={`text-xl font-black ${isLocationVerified ? 'text-green-400' : 'text-white'}`}>{displayLoc.p}</span>
                  </div>
              </div>
           </div>

           {/* Section: Última Contagem */}
           {lastCountInfo && (
             <div className="flex items-center gap-3 px-4 py-2 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                <div className="size-8 rounded-full bg-blue-800 flex items-center justify-center text-xs font-bold text-blue-200">
                    {lastCountInfo.user.charAt(0)}
                </div>
                <div className="flex-1">
                    <p className="text-[10px] text-blue-300 font-bold uppercase">Último Registro</p>
                    <p className="text-xs text-white">
                        <strong className="text-blue-200">{lastCountInfo.quantity} un</strong> por {lastCountInfo.user} em {lastCountInfo.date}
                    </p>
                </div>
             </div>
           )}

           {/* Section: Input de Quantidade */}
           <div className="flex flex-col items-center py-2">
              <label className="text-xs font-bold text-gray-400 uppercase mb-4 tracking-widest">Quantidade Física</label>
              <div className="flex items-center gap-4 w-full justify-center">
                 <button 
                    onClick={() => setQuantity(Math.max(0, quantity - 1))} 
                    className="size-16 rounded-2xl bg-[#334155] border border-gray-600 flex items-center justify-center text-white hover:bg-red-500/20 hover:border-red-500 transition-all active:scale-95 shadow-lg"
                 >
                    <Icon name="remove" size={32} />
                 </button>
                 
                 <div className="relative w-32 h-20 bg-[#0f172a] rounded-2xl border border-gray-600 flex items-center justify-center shadow-inner">
                    <input 
                        type="number" 
                        value={quantity} 
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        className="w-full text-center text-5xl font-black bg-transparent border-none focus:ring-0 text-white p-0"
                    />
                 </div>

                 <button 
                    onClick={() => setQuantity(quantity + 1)} 
                    className="size-16 rounded-2xl bg-[#334155] border border-gray-600 flex items-center justify-center text-white hover:bg-green-500/20 hover:border-green-500 transition-all active:scale-95 shadow-lg"
                 >
                    <Icon name="add" size={32} />
                 </button>
              </div>
           </div>
           
           {/* Divergencia Input */}
           {showDivergenceInput && (
             <div className="animate-fade-in">
                <label className="text-xs font-bold text-orange-400 uppercase mb-1 block">Motivo da Divergência</label>
                <textarea 
                  value={divergenceReason}
                  onChange={(e) => setDivergenceReason(e.target.value)}
                  className="w-full p-3 rounded-xl bg-orange-900/20 border border-orange-500/30 text-sm resize-none h-20 focus:ring-orange-500 focus:border-orange-500 text-white placeholder-orange-300/50"
                  placeholder="Ex: Item danificado, caixa vazia..."
                  autoFocus
                />
             </div>
           )}

           {/* Footer Actions */}
           <div className="grid grid-cols-2 gap-3 pt-2">
              <button 
                onClick={handleNotLocated}
                className="col-span-1 py-3 px-4 rounded-xl border border-gray-600 bg-transparent text-gray-400 font-bold text-xs uppercase hover:bg-red-900/20 hover:text-red-400 hover:border-red-500/50 transition-all"
              >
                Não Localizado
              </button>
              <button 
                onClick={handleDivergence}
                className={`col-span-1 py-3 px-4 rounded-xl border font-bold text-xs uppercase transition-all ${
                    showDivergenceInput 
                    ? 'bg-orange-600 text-white border-orange-500' 
                    : 'border-gray-600 text-orange-400 hover:bg-orange-900/20 hover:border-orange-500/50'
                }`}
              >
                {showDivergenceInput ? 'Confirmar Motivo' : 'Divergência'}
              </button>
              <button 
                onClick={handleConfirm}
                className="col-span-2 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg shadow-xl shadow-blue-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2"
              >
                <Icon name="check_circle" />
                Confirmar
              </button>
           </div>
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

// --- History Filter Modal ---
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

  useEffect(() => {
    let html5QrCode: Html5Qrcode;

    const startScanner = async () => {
      if (isOpen) {
        setIsPermDenied(false);
        setError('');
        await new Promise(r => setTimeout(r, 100));

        try {
          html5QrCode = new Html5Qrcode("reader");
          scannerRef.current = html5QrCode;
          await html5QrCode.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
              html5QrCode.stop().then(() => {
                scannerRef.current = null;
                onScanComplete(decodedText);
              }).catch(err => console.error(err));
            },
            (errorMessage) => { }
          );
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
      setRetryTrigger(prev => prev + 1);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black no-print">
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-20 pt-safe bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={handleClose} className="p-2 rounded-full bg-black/40 text-white backdrop-blur-md border border-white/10">
          <Icon name="close" size={24} />
        </button>
        <div className="px-3 py-1.5 rounded-full bg-black/40 text-white text-xs font-bold backdrop-blur-md border border-white/10 uppercase tracking-wide">
          {title}
        </div>
        <div className="w-10"></div> 
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
                        ? "O aplicativo precisa da câmera para ler códigos QR. Verifique se você bloqueou o acesso nas configurações do navegador." 
                        : error}
                </p>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <button onClick={handleRetryPermission} className="w-full bg-primary hover:bg-primary-dark text-white px-6 py-3.5 rounded-xl font-bold text-sm transition-colors shadow-lg shadow-primary/20">Tentar Habilitar Novamente</button>
                    <button onClick={handleClose} className="w-full bg-white/10 hover:bg-white/20 text-white px-6 py-3.5 rounded-xl font-bold text-sm transition-colors">Fechar e Digitar Código</button>
                </div>
            </div>
         )}
         {!error && !isPermDenied && (
             <>
                <div className="absolute inset-0 pointer-events-none border-[40px] border-black/50 z-10 flex items-center justify-center">
                   <div className="relative w-64 h-64 border-2 border-white/20 rounded-lg">
                      <div className="absolute top-0 left-0 w-6 h-6 border-l-4 border-t-4 border-primary rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-6 h-6 border-r-4 border-t-4 border-primary rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-l-4 border-b-4 border-primary rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-r-4 border-b-4 border-primary rounded-br-lg" />
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/80 shadow-[0_0_15px_rgba(19,127,236,0.8)] animate-[slideUp_2s_ease-in-out_infinite]" />
                   </div>
                </div>
                <div className="absolute bottom-10 left-0 right-0 z-20 flex justify-center pb-safe">
                    <p className="text-white/90 text-sm font-medium bg-black/60 px-6 py-3 rounded-full backdrop-blur-md border border-white/10 text-center">{instruction}</p>
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
    if (!isOpen || !data) return null;
    return <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"><div className="bg-white p-6 rounded-lg"><h3 className="font-bold mb-4">Impressão</h3><p>{data.fullCode}</p><button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-200 rounded">Fechar</button></div></div>;
};
