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
  initialQuantity?: number;
  lastCountInfo?: {
    user: string;
    date: string;
    quantity: number;
    avatar?: string;
  } | null;
  // Updated onConfirm to accept status and optional info
  onConfirm: (quantity: number, status?: 'counted' | 'not_located' | 'divergence_info', divergenceReason?: string) => void;
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

// --- REAL SCANNER MODAL with html5-qrcode ---
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
  const [retryTrigger, setRetryTrigger] = useState(0); // Usado para forçar re-render

  useEffect(() => {
    let html5QrCode: Html5Qrcode;

    const startScanner = async () => {
      if (isOpen) {
        setIsPermDenied(false);
        setError('');
        
        // Pequeno delay para garantir que o DOM (div id="reader") foi renderizado
        await new Promise(r => setTimeout(r, 100));

        try {
          html5QrCode = new Html5Qrcode("reader");
          scannerRef.current = html5QrCode;
          
          await html5QrCode.start(
            { facingMode: "environment" }, 
            {
              fps: 10,
              // REMOVIDO aspectRatio: 1.0 para compatibilidade mobile (preencher tela)
              qrbox: { width: 250, height: 250 }
            },
            (decodedText) => {
              // Sucesso
              html5QrCode.stop().then(() => {
                scannerRef.current = null;
                onScanComplete(decodedText);
              }).catch(err => console.error(err));
            },
            (errorMessage) => {
              // Erro de leitura a cada frame, ignorar para não spammar
              // console.log(errorMessage);
            }
          );
        } catch (err: any) {
          console.error("Erro ao iniciar câmera", err);
          if (err?.name === 'NotAllowedError' || err?.message?.includes('permission')) {
             setIsPermDenied(true);
             setError('Permissão de câmera negada.');
          } else {
             // Detecção de erro por contexto inseguro (HTTP)
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
      // Cleanup ao desmontar ou fechar
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
      {/* Top Bar */}
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
         
         {/* Reader Element for Library */}
         <div id="reader" className="w-full h-full object-cover"></div>

         {/* Fallback Error UI */}
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
                        Fechar e Digitar Código
                    </button>
                </div>
            </div>
         )}
         
         {/* Overlay Guide (Only visible if no error) */}
         {!error && !isPermDenied && (
             <>
                <div className="absolute inset-0 pointer-events-none border-[40px] border-black/50 z-10 flex items-center justify-center">
                   {/* Corners */}
                   <div className="relative w-64 h-64 border-2 border-white/20 rounded-lg">
                      <div className="absolute top-0 left-0 w-6 h-6 border-l-4 border-t-4 border-primary rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-6 h-6 border-r-4 border-t-4 border-primary rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-l-4 border-b-4 border-primary rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-r-4 border-b-4 border-primary rounded-br-lg" />
                      
                      {/* Scanning Line Animation */}
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
      
      {/* Hide library default unwanted elements via CSS injected directly */}
      <style>{`
         #reader__scan_region img { display: none; }
         #reader__dashboard_section_csr button { display: none; }
         #reader video { object-fit: cover; width: 100% !important; height: 100% !important; }
      `}</style>
    </div>
  );
};

// --- Entry Modal (Lançamento) with Divergence Flow ---
export const EntryModal: React.FC<EntryModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  itemName, 
  itemSku, 
  initialQuantity = 1,
  lastCountInfo 
}) => {
  // Modal Stages: 'count' | 'divergence-select' | 'divergence-info'
  const [stage, setStage] = useState<'count' | 'divergence-select' | 'divergence-info'>('count');
  const [quantity, setQuantity] = useState(initialQuantity);
  const [showScanner, setShowScanner] = useState(false);
  const [locationData, setLocationData] = useState<{ galpao: string; estante: string; prateleira: string } | null>(null);
  
  // Local state for abandonment check within EntryModal
  const [showAbandonWarning, setShowAbandonWarning] = useState(false);

  const [divergenceText, setDivergenceText] = useState('');
  const minCharCount = 15;

  useEffect(() => {
    if (isOpen) {
      setQuantity(initialQuantity);
      setShowScanner(false);
      setLocationData(null);
      setStage('count');
      setDivergenceText('');
      setShowAbandonWarning(false);
    }
  }, [isOpen, initialQuantity]);

  if (!isOpen) return null;

  // --- Handlers ---
  const handleConfirmCount = () => {
    if (locationData) {
      onConfirm(quantity, 'counted');
    }
  };

  const handleScanSuccess = (code: string) => {
    // Aqui você validaria o código real. Por enquanto, aceitamos qualquer string.
    // Ex: Verificar se code == 'LOC-RUA04'
    setLocationData({
        galpao: 'Galpão Principal',
        estante: 'Local Valido: ' + code,
        prateleira: 'Nível 1'
    });
    setShowScanner(false);
  };

  // Safe Close Logic
  const handleSafeClose = () => {
    // If quantity was changed and user tries to close, show warning
    if (quantity !== initialQuantity) {
        setShowAbandonWarning(true);
    } else {
        onClose();
    }
  };

  const handleConfirmAbandon = () => {
    setShowAbandonWarning(false);
    onClose();
  };

  // Divergence Handlers
  const handleSelectNotLocated = () => {
    // Immediate confirm for "Not Located"
    onConfirm(0, 'not_located');
    onClose();
  };

  const handleSelectInfoIssue = () => {
    setStage('divergence-info');
  };

  const handleConfirmInfoIssue = () => {
    if (divergenceText.length >= minCharCount) {
      onConfirm(quantity, 'divergence_info', divergenceText);
      onClose();
    }
  };

  // --- Render Functions ---

  const renderCountStage = () => (
    <>
      <div className="overflow-y-auto px-5 pb-6 space-y-8 no-scrollbar flex-1">
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-gray-700 dark:text-white text-base font-medium">
            <span>Quantidade Contada</span>
            <span className="text-xs font-normal text-primary bg-primary/10 px-2 py-1 rounded-full">Sistema: ---</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="h-14 w-14 flex items-center justify-center rounded-xl bg-gray-200 dark:bg-surface-dark text-gray-900 dark:text-white hover:opacity-80 transition-all active:scale-95"
            >
              <Icon name="remove" size={24} />
            </button>
            <div className="flex-1 h-14">
              <input 
                type="number" 
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                className="w-full h-full bg-white dark:bg-surface-dark border border-gray-300 dark:border-card-border focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-center text-3xl font-bold text-gray-900 dark:text-white"
              />
            </div>
            <button 
              onClick={() => setQuantity(quantity + 1)}
              className="h-14 w-14 flex items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all active:scale-95"
            >
              <Icon name="add" size={24} />
            </button>
          </div>
        </div>

        <div className="h-px w-full bg-gray-200 dark:bg-card-border" />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-900 dark:text-white text-base font-semibold">Localização Física</p>
            <button 
              onClick={() => setShowScanner(true)}
              disabled={!!locationData}
              className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                  locationData ? 'text-green-500 cursor-default' : 'text-primary hover:text-primary/80'
              }`}
            >
              <Icon name={locationData ? "check_circle" : "qr_code_scanner"} className="text-lg" />
              {locationData ? 'Validado' : 'Validar Loc.'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <input disabled value={locationData?.galpao || "---"} className="w-full h-12 px-4 rounded-lg bg-gray-100 dark:bg-surface-dark/50 border border-gray-300 dark:border-card-border text-gray-500 dark:text-gray-400 text-base font-medium" />
              </div>
              <div>
                <input disabled value={locationData?.estante || "---"} className="w-full h-12 px-4 rounded-lg bg-gray-100 dark:bg-surface-dark/50 border border-gray-300 dark:border-card-border text-gray-500 dark:text-gray-400 text-base font-medium" />
              </div>
              <div>
                <input disabled value={locationData?.prateleira || "---"} className="w-full h-12 px-4 rounded-lg bg-gray-100 dark:bg-surface-dark/50 border border-gray-300 dark:border-card-border text-gray-500 dark:text-gray-400 text-base font-medium" />
              </div>
          </div>
        </div>
        
        {/* Warning */}
        <div className="bg-blue-50 dark:bg-primary/10 border border-blue-100 dark:border-primary/20 rounded-lg p-3 flex gap-3 items-start">
           <Icon name="info" className="text-primary text-xl mt-0.5" />
           <p className="text-sm text-gray-600 dark:text-gray-300">Valide a localização via QR Code para liberar a confirmação.</p>
        </div>
      </div>

      {/* Footer */}
      <div className="p-5 border-t border-gray-200 dark:border-card-border bg-background-light dark:bg-background-dark pb-safe flex flex-col gap-3">
         {/* Main Confirm Button */}
         <button 
           onClick={handleConfirmCount}
           disabled={!locationData}
           className={`w-full h-14 rounded-xl font-bold text-lg shadow-xl flex items-center justify-center gap-2 transition-all ${
             locationData 
               ? 'bg-primary text-white shadow-primary/20 hover:bg-primary-dark active:scale-[0.98]' 
               : 'bg-gray-200 dark:bg-surface-dark text-gray-400 dark:text-gray-600 cursor-not-allowed shadow-none'
           }`}
         >
           {locationData ? 'Confirmar Contagem' : 'Aguardando Validação'}
           {locationData && <Icon name="check" size={24} />}
         </button>
         
         {/* Divergence Button */}
         <button 
            onClick={() => setStage('divergence-select')}
            className="w-full py-3 rounded-xl border border-orange-200 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 font-bold text-sm hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors flex items-center justify-center gap-2"
         >
            <Icon name="report_problem" size={18} />
            Reportar Divergência
         </button>
      </div>
    </>
  );

  const renderDivergenceSelect = () => (
    <div className="px-5 pb-8 flex-1 flex flex-col">
       <div className="flex-1 flex flex-col justify-center gap-4">
          <p className="text-center text-gray-600 dark:text-gray-300 mb-2">Selecione o tipo de problema encontrado:</p>
          
          <button 
             onClick={handleSelectNotLocated}
             className="flex items-center gap-4 p-5 rounded-2xl bg-gray-50 dark:bg-surface-dark border-2 border-gray-200 dark:border-card-border hover:border-red-500 dark:hover:border-red-500 transition-all group text-left"
          >
             <div className="size-12 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-500 flex items-center justify-center shrink-0">
               <Icon name="search_off" size={24} />
             </div>
             <div>
               <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400">Item Não Localizado</h3>
               <p className="text-sm text-gray-500 dark:text-gray-400">Produto físico não encontrado no endereço.</p>
             </div>
          </button>

          <button 
             onClick={handleSelectInfoIssue}
             className="flex items-center gap-4 p-5 rounded-2xl bg-gray-50 dark:bg-surface-dark border-2 border-gray-200 dark:border-card-border hover:border-orange-500 dark:hover:border-orange-500 transition-all group text-left"
          >
             <div className="size-12 rounded-full bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-500 flex items-center justify-center shrink-0">
               <Icon name="description" size={24} />
             </div>
             <div>
               <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400">Divergência de Informação</h3>
               <p className="text-sm text-gray-500 dark:text-gray-400">Erro na descrição, SKU, ou cadastro incorreto.</p>
             </div>
          </button>
       </div>
       
       <button onClick={() => setStage('count')} className="w-full py-4 text-gray-500 font-medium">Cancelar</button>
    </div>
  );

  const renderDivergenceInfo = () => (
    <div className="px-5 pb-safe flex flex-col flex-1">
      <div className="flex-1 space-y-4">
        <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 p-4 rounded-xl flex gap-3">
           <Icon name="info" className="text-orange-600 mt-0.5" />
           <p className="text-sm text-orange-800 dark:text-orange-300">
             Descreva detalhadamente o erro de cadastro encontrado para que o time de suporte possa corrigir.
           </p>
        </div>

        <div className="space-y-2">
           <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Descrição do Ocorrido</label>
           <textarea 
             value={divergenceText}
             onChange={(e) => setDivergenceText(e.target.value)}
             placeholder="Ex: SKU físico diferente do sistema, embalagem incorreta..."
             className="w-full h-40 p-4 rounded-xl bg-gray-50 dark:bg-surface-dark border border-gray-200 dark:border-card-border focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none text-base"
           />
           <div className={`text-xs text-right font-medium transition-colors ${divergenceText.length < minCharCount ? 'text-red-500' : 'text-green-500'}`}>
              {divergenceText.length} / {minCharCount} caracteres mínimos
           </div>
        </div>
      </div>

      <div className="py-5 flex gap-3">
         <button 
           onClick={() => setStage('divergence-select')}
           className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-card-border text-gray-600 font-bold hover:bg-gray-50 dark:hover:bg-white/5"
         >
           Voltar
         </button>
         <button 
           onClick={handleConfirmInfoIssue}
           disabled={divergenceText.length < minCharCount}
           className={`flex-[2] py-3 rounded-xl font-bold text-white shadow-lg transition-all ${
             divergenceText.length < minCharCount 
               ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed' 
               : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20 active:scale-95'
           }`}
         >
           Finalizar com Divergência
         </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center no-print">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={handleSafeClose} />
        
        <div className="relative z-10 w-full max-w-md bg-background-light dark:bg-background-dark rounded-t-3xl shadow-2xl flex flex-col max-h-[95vh] h-[85vh] animate-slide-up transition-all duration-300">
          {/* Handle */}
          <div className="w-full flex justify-center pt-4 pb-2">
            <div className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-card-border" />
          </div>

          {/* Header */}
          <div className="px-5 pb-4 flex justify-between items-start">
            <div>
              <h2 className="text-gray-900 dark:text-white text-2xl font-bold leading-tight">
                {stage === 'count' ? (itemName || 'Item sem nome') : 
                 stage === 'divergence-select' ? 'Reportar Divergência' : 
                 'Detalhar Divergência'}
              </h2>
              {stage === 'count' && <p className="text-gray-500 dark:text-text-secondary text-sm font-normal mt-1">SKU: {itemSku || '---'}</p>}
            </div>
            <button onClick={handleSafeClose} className="text-gray-500 dark:text-text-secondary p-2 rounded-full hover:bg-gray-200 dark:hover:bg-surface-dark transition-colors">
              <Icon name="close" />
            </button>
          </div>

          {/* Last Count Info (Only in Count Stage) */}
          {stage === 'count' && lastCountInfo ? (
            <div className="mx-5 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl flex items-center gap-3">
              <div className="size-10 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-blue-700 dark:text-white shrink-0">
                {lastCountInfo.avatar ? (
                    <div className="size-full rounded-full bg-cover" style={{backgroundImage: `url('${lastCountInfo.avatar}')`}} />
                ) : (
                    <Icon name="history" size={20} />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-300 tracking-wide">Última Contagem</span>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  Em <strong className="font-bold">{lastCountInfo.date}</strong> por {lastCountInfo.user} ({lastCountInfo.quantity} un)
                </p>
              </div>
            </div>
          ) : stage === 'count' ? (
             <div className="mx-5 mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-xl flex items-center gap-3">
              <div className="size-10 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                <Icon name="priority_high" size={20} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-orange-600 dark:text-orange-400 tracking-wide">Status</span>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  Item nunca contado
                </p>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">Verifique com atenção</span>
              </div>
            </div>
          ) : null}

          {/* Body Content Switcher */}
          {stage === 'count' && renderCountStage()}
          {stage === 'divergence-select' && renderDivergenceSelect()}
          {stage === 'divergence-info' && renderDivergenceInfo()}
          
          {/* Internal Abandon Warning Overlay */}
          {showAbandonWarning && (
            <div className="absolute inset-0 z-50 rounded-t-3xl bg-white/95 dark:bg-surface-dark/95 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
                <div className="w-full flex flex-col items-center text-center">
                    <div className="size-14 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 flex items-center justify-center mb-4">
                        <Icon name="warning" size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Descartar contagem?</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-6">
                        Você alterou a quantidade. Se sair agora, a contagem não será salva.
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setShowAbandonWarning(false)} 
                            className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-white/10 font-bold text-gray-700 dark:text-white hover:bg-gray-200"
                        >
                            Continuar Contando
                        </button>
                        <button 
                            onClick={handleConfirmAbandon} 
                            className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold shadow-lg shadow-red-500/20 hover:bg-red-600"
                        >
                            Sair e Descartar
                        </button>
                    </div>
                </div>
            </div>
          )}

        </div>
      </div>

      <ScannerModal 
        isOpen={showScanner} 
        onClose={() => setShowScanner(false)} 
        onScanComplete={handleScanSuccess}
        title="Validar Localização"
        instruction="Escaneie o QR Code da estante para confirmar que você está no local correto."
      />
    </>
  );
};

// --- Confirmation Modal ---
export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 no-print">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-white dark:bg-surface-dark rounded-2xl shadow-2xl p-6 animate-scale-up">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="size-16 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 flex items-center justify-center">
            <Icon name="check_circle" size={32} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Finalizar Bloco?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Você completou a contagem de todos os itens. Deseja enviar os dados para validação?
            </p>
          </div>
          <div className="flex gap-3 w-full mt-2">
            <button 
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-white/10 font-bold text-gray-700 dark:text-white hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
            >
              Voltar
            </button>
            <button 
              onClick={onConfirm}
              className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold shadow-lg shadow-green-600/20 hover:bg-green-700 transition-colors"
            >
              Finalizar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Damage Modal ---
export const DamageModal: React.FC<DamageModalProps> = ({ isOpen, onClose, onAttach }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center no-print">
       <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
       
       <div className="relative z-10 w-full max-w-md bg-white dark:bg-background-dark rounded-t-3xl shadow-2xl flex flex-col animate-slide-up p-6 pb-safe">
          <div className="w-full flex justify-center pb-4">
            <div className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-card-border" />
          </div>

          <div className="flex items-center gap-3 mb-6">
             <div className="size-12 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 flex items-center justify-center">
                <Icon name="broken_image" size={24} />
             </div>
             <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Reportar Avaria</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Registre danos no produto ou embalagem</p>
             </div>
          </div>

          <div className="space-y-4 mb-6">
             <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Tipo de Avaria</label>
             <div className="grid grid-cols-2 gap-3">
                <button className="p-3 rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 font-medium text-sm hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors">
                   Embalagem Rasgada
                </button>
                <button className="p-3 rounded-xl border border-gray-200 dark:border-card-border bg-white dark:bg-surface-dark text-gray-600 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                   Produto Quebrado
                </button>
                <button className="p-3 rounded-xl border border-gray-200 dark:border-card-border bg-white dark:bg-surface-dark text-gray-600 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                   Umidade / Molhado
                </button>
                <button className="p-3 rounded-xl border border-gray-200 dark:border-card-border bg-white dark:bg-surface-dark text-gray-600 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                   Outros
                </button>
             </div>
             
             <div className="space-y-2 pt-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Evidência Fotográfica</label>
                <button 
                  onClick={onAttach}
                  className="w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                   <Icon name="add_a_photo" size={32} />
                   <span className="text-sm font-medium">Tocar para fotografar</span>
                </button>
             </div>
          </div>

          <div className="flex gap-3">
             <button 
               onClick={onClose}
               className="flex-1 py-3.5 rounded-xl border border-gray-200 dark:border-card-border font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
             >
               Cancelar
             </button>
             <button 
               onClick={() => {
                 onAttach();
                 onClose();
               }}
               className="flex-[2] py-3.5 rounded-xl bg-red-600 text-white font-bold shadow-lg shadow-red-600/20 hover:bg-red-700 transition-colors"
             >
               Confirmar Avaria
             </button>
          </div>
       </div>
    </div>
  );
};

// --- Print Label Modal ---
export const PrintLabelModal: React.FC<PrintLabelModalProps> = ({ isOpen, onClose, data }) => {
    const [labelType, setLabelType] = useState<'ESTANTE' | 'PRATELEIRA'>(data?.type || 'ESTANTE');

    useEffect(() => {
        if(data) setLabelType(data.type);
    }, [data]);

    if (!isOpen || !data) return null;

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${data.fullCode}`;
    const displayLabel = labelType === 'ESTANTE' ? 'ESTANTE' : 'NÍVEL';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
            <div className="bg-white rounded-lg shadow-xl overflow-hidden w-full max-w-2xl flex flex-col">
                {/* Header (No Print) */}
                <div className="p-4 bg-gray-100 flex justify-between items-center no-print border-b">
                    <h3 className="font-bold text-lg text-gray-800">Visualizar Impressão</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
                        <Icon name="close" size={24} />
                    </button>
                </div>

                {/* Controls (No Print) */}
                <div className="p-4 flex gap-4 justify-center bg-gray-50 no-print border-b">
                    <button 
                        onClick={() => setLabelType('ESTANTE')}
                        className={`px-4 py-2 rounded font-bold transition-colors ${labelType === 'ESTANTE' ? 'bg-black text-white' : 'bg-gray-200 text-gray-700'}`}
                    >
                        ESTANTE
                    </button>
                    <button 
                        onClick={() => setLabelType('PRATELEIRA')}
                        className={`px-4 py-2 rounded font-bold transition-colors ${labelType === 'PRATELEIRA' ? 'bg-black text-white' : 'bg-gray-200 text-gray-700'}`}
                    >
                        PRATELEIRA
                    </button>
                </div>

                {/* Print Area Container */}
                <div className="p-8 bg-gray-200 flex justify-center overflow-auto">
                    
                    {/* THE LABEL (Visible in Print) */}
                    <div id="print-area" className="bg-white w-[500px] h-[300px] border-4 border-black p-4 flex gap-4 shrink-0 box-border">
                        {/* Left: QR Code */}
                        <div className="w-[180px] border-r-4 border-black pr-4 flex items-center justify-center shrink-0">
                            <img src={qrUrl} alt="QR Code" className="w-full h-auto object-contain" style={{imageRendering: 'pixelated'}} />
                        </div>

                        {/* Right: Info */}
                        <div className="flex-1 flex flex-col justify-between pl-2 py-2">
                             {/* Black Bar Header */}
                             <div className="w-full bg-black text-white p-2 flex items-center justify-between">
                                 <span className="text-2xl font-bold uppercase tracking-wide">
                                     {displayLabel}
                                 </span>
                                 <span className="text-5xl font-black tracking-tighter leading-none">
                                     {data.number}
                                 </span>
                             </div>

                             {/* Full Coordinate Code (At the bottom, BIG) */}
                             <div className="text-center mt-auto pt-4">
                                 <p className="text-4xl font-black text-black tracking-widest leading-none">
                                     {data.fullCode}
                                 </p>
                             </div>
                        </div>
                    </div>

                </div>

                {/* Footer Actions (No Print) */}
                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 no-print">
                    <button onClick={onClose} className="px-6 py-3 rounded-lg font-bold text-gray-600 hover:bg-gray-200">
                        Cancelar
                    </button>
                    <button onClick={() => window.print()} className="px-6 py-3 rounded-lg font-bold bg-primary text-white hover:bg-primary-dark shadow-lg flex items-center gap-2">
                        <Icon name="print" />
                        IMPRIMIR
                    </button>
                </div>
            </div>
        </div>
    );
};