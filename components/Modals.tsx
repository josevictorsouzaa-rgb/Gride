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

// --- NEW MODALS ---

export const EntryModal: React.FC<EntryModalProps> = ({ isOpen, onClose, itemName, itemSku, initialQuantity = 1, lastCountInfo, onConfirm }) => {
  const [quantity, setQuantity] = useState(initialQuantity);
  const [divergenceReason, setDivergenceReason] = useState('');
  const [view, setView] = useState<'main' | 'divergence'>('main');

  useEffect(() => {
    if (isOpen) {
        setQuantity(initialQuantity || 1);
        setDivergenceReason('');
        setView('main');
    }
  }, [isOpen, initialQuantity]);

  if (!isOpen) return null;

  const handleConfirm = () => {
      onConfirm(quantity, 'counted');
      onClose();
  };

  const handleNotLocated = () => {
      if(window.confirm('Marcar como Não Localizado?')) {
          onConfirm(0, 'not_located');
          onClose();
      }
  };

  const handleDivergence = () => {
      if (!divergenceReason) return alert('Informe o motivo.');
      onConfirm(quantity, 'divergence_info', divergenceReason);
      onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
        <div className="relative z-10 w-full max-w-md bg-white dark:bg-surface-dark rounded-2xl shadow-2xl overflow-hidden animate-scale-up">
            
            {view === 'main' && (
                <>
                    <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{itemName || 'Item sem nome'}</h3>
                                <p className="text-sm text-gray-500">{itemSku}</p>
                            </div>
                            <button onClick={onClose}><Icon name="close" className="text-gray-400" /></button>
                        </div>

                        {lastCountInfo && (
                            <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg flex items-center gap-3 border border-blue-100 dark:border-blue-800">
                                <div className="size-8 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-blue-700 dark:text-blue-200 font-bold text-xs">
                                    {lastCountInfo.user.charAt(0)}
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs text-blue-800 dark:text-blue-300">
                                        Última contagem: <strong>{lastCountInfo.quantity} un</strong>
                                    </p>
                                    <p className="text-[10px] text-blue-600 dark:text-blue-400">
                                        por {lastCountInfo.user} em {lastCountInfo.date}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-center gap-6 mb-8">
                            <button 
                                onClick={() => setQuantity(Math.max(0, quantity - 1))}
                                className="size-14 rounded-full bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 flex items-center justify-center transition-colors"
                            >
                                <Icon name="remove" size={24} />
                            </button>
                            <div className="flex flex-col items-center w-24">
                                <input 
                                    type="number" 
                                    value={quantity}
                                    onChange={(e) => setQuantity(Number(e.target.value))}
                                    className="w-full text-center text-4xl font-bold bg-transparent border-none focus:ring-0 text-gray-900 dark:text-white p-0"
                                />
                                <span className="text-xs text-gray-400 uppercase font-bold">Unidades</span>
                            </div>
                            <button 
                                onClick={() => setQuantity(quantity + 1)}
                                className="size-14 rounded-full bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 flex items-center justify-center transition-colors"
                            >
                                <Icon name="add" size={24} />
                            </button>
                        </div>

                        <button 
                            onClick={handleConfirm}
                            className="w-full py-4 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/20 transition-all mb-3 flex items-center justify-center gap-2"
                        >
                            <Icon name="check" />
                            Confirmar Contagem
                        </button>

                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={handleNotLocated}
                                className="py-3 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors"
                            >
                                Não Localizado
                            </button>
                            <button 
                                onClick={() => setView('divergence')}
                                className="py-3 bg-orange-50 dark:bg-orange-900/10 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/30 rounded-xl font-bold text-sm hover:bg-orange-100 transition-colors"
                            >
                                Informar Divergência
                            </button>
                        </div>
                    </div>
                </>
            )}

            {view === 'divergence' && (
                <div className="p-6">
                    <div className="flex items-center gap-2 mb-4 text-orange-500">
                        <Icon name="warning" />
                        <h3 className="font-bold text-lg">Informar Divergência</h3>
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                        Descreva o problema encontrado com este item (ex: embalagem danificada, SKU incorreto, etc).
                    </p>

                    <textarea
                        value={divergenceReason}
                        onChange={(e) => setDivergenceReason(e.target.value)}
                        placeholder="Descreva o motivo..."
                        className="w-full h-32 p-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl resize-none mb-6 focus:ring-2 focus:ring-orange-500 outline-none"
                    />

                    <div className="flex gap-3">
                        <button 
                            onClick={() => setView('main')}
                            className="flex-1 py-3 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 font-bold rounded-xl"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleDivergence}
                            className="flex-1 py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 shadow-lg shadow-orange-500/20"
                        >
                            Salvar
                        </button>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-surface-dark rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-up">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="size-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-4">
                        <Icon name="check" size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Finalizar Tarefa?</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Certifique-se de que todos os itens foram contados corretamente.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl font-bold">Cancelar</button>
                    <button onClick={onConfirm} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg">Confirmar</button>
                </div>
            </div>
        </div>
    );
};

export const DamageModal: React.FC<DamageModalProps> = ({ isOpen, onClose, onAttach }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-surface-dark rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-up">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Icon name="broken_image" className="text-red-500" />
                        Reportar Avaria
                    </h3>
                    <button onClick={onClose}><Icon name="close" /></button>
                </div>
                <div className="space-y-4">
                    <button className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                        <Icon name="add_a_photo" size={32} className="mb-2" />
                        <span className="text-xs font-bold uppercase">Tirar Foto</span>
                    </button>
                    <textarea 
                        className="w-full h-24 p-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl resize-none text-sm"
                        placeholder="Descreva o dano encontrado..."
                    />
                    <button onClick={onAttach} className="w-full py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg">
                        Registrar Avaria
                    </button>
                </div>
            </div>
        </div>
    );
};

export const AbandonModal: React.FC<AbandonModalProps> = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-surface-dark rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-up">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Abandonar Contagem?</h3>
                <p className="text-sm text-gray-500 mb-6">O progresso não salvo será perdido.</p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold">Cancelar</button>
                    <button onClick={onConfirm} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold">Abandonar</button>
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

// --- Print Label Modal ---
export const PrintLabelModal: React.FC<PrintLabelModalProps> = ({ isOpen, onClose, data }) => {
    const [labelType, setLabelType] = useState<'ESTANTE' | 'PRATELEIRA'>(data?.type || 'ESTANTE');
    const [printSize, setPrintSize] = useState<'60x30' | '60x40'>('60x40');

    useEffect(() => {
        if(data) setLabelType(data.type);
    }, [data]);

    useEffect(() => {
        // Inject dynamic CSS for the selected size when modal is open
        if (isOpen) {
            const styleId = 'dynamic-print-modal-size';
            let style = document.getElementById(styleId) as HTMLStyleElement;
            if (!style) {
                style = document.createElement('style');
                style.id = styleId;
                document.head.appendChild(style);
            }
            
            const heightMm = printSize === '60x30' ? '30mm' : '40mm';
            // Safe zone reduces 1mm from edges to prevent cutting
            const safeWidth = '58mm';
            const safeHeight = printSize === '60x30' ? '28mm' : '38mm';

            style.innerHTML = `
                @media print {
                    @page { size: 60mm ${heightMm}; margin: 0; }
                    body { margin: 0; padding: 0; }
                    #print-area-modal { 
                        display: flex !important; 
                        width: ${safeWidth};
                        height: ${safeHeight};
                        margin: 1mm auto; /* Center with 1mm margin */
                        box-sizing: border-box;
                    }
                }
            `;
        }
    }, [isOpen, printSize]);

    if (!isOpen || !data) return null;

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${data.fullCode}`;
    const displayLabel = labelType === 'ESTANTE' ? 'ESTANTE' : 'PRATELEIRA';
    // Se for PRATELEIRA e a etiqueta for pequena (30mm), usa uma fonte menor ou abrevia se necessário
    const isSmall = printSize === '60x30';
    const labelFontSize = (displayLabel === 'PRATELEIRA' && isSmall) ? 'text-lg' : 'text-2xl';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
            <div className="bg-white rounded-lg shadow-xl overflow-hidden w-full max-w-2xl flex flex-col">
                {/* Header (No Print) */}
                <div className="p-4 bg-gray-100 flex justify-between items-center no-print border-b">
                    <h3 className="font-bold text-lg text-gray-800">Visualizar Impressão</h3>
                    <div className="flex gap-2">
                        <select 
                            value={printSize}
                            onChange={(e) => setPrintSize(e.target.value as any)}
                            className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2"
                        >
                            <option value="60x40">60mm x 40mm</option>
                            <option value="60x30">60mm x 30mm</option>
                        </select>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-800 p-1">
                            <Icon name="close" size={24} />
                        </button>
                    </div>
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

                {/* Print Area Container (Preview Wrapper) */}
                <div className="p-8 bg-gray-200 flex justify-center overflow-auto">
                    
                    {/* THE LABEL (Visible in Print) */}
                    <div 
                        id="print-area-modal" 
                        className="bg-white border border-dashed border-gray-400 flex gap-2 shrink-0 box-border overflow-hidden p-1 relative"
                        style={{ 
                            width: '60mm', 
                            height: printSize === '60x30' ? '30mm' : '40mm',
                            // On screen, we show exact MM size. In print, @media controls margins.
                        }}
                    >
                        {/* Margins Guide (Visual Only) */}
                        <div className="absolute inset-[1mm] border border-blue-100 pointer-events-none z-0 opacity-50 no-print" title="Margem de Segurança"></div>

                        {/* Content Container with Z-Index to stay above guide */}
                        <div className="flex w-full h-full z-10 items-center justify-between pl-1 pr-1">
                            
                            {/* Left: QR Code */}
                            <div className="h-full aspect-square flex items-center justify-center p-1">
                                <img src={qrUrl} alt="QR Code" className="h-full w-full object-contain" style={{imageRendering: 'pixelated'}} />
                            </div>

                            {/* Right: Info */}
                            <div className="flex-1 flex flex-col justify-center gap-1 pl-1 h-full">
                                {/* Black Bar Header */}
                                <div className="w-full bg-black text-white py-1 px-2 flex items-center justify-between rounded">
                                    <span className={`${labelFontSize} font-bold uppercase tracking-tight truncate`}>
                                        {displayLabel}
                                    </span>
                                    <span className="text-4xl font-black tracking-tighter leading-none ml-1">
                                        {data.number}
                                    </span>
                                </div>

                                {/* Full Coordinate Code */}
                                <div className="text-center w-full mt-1">
                                    <p className="text-sm font-black text-black tracking-wider leading-none whitespace-nowrap overflow-visible">
                                        {data.fullCode}
                                    </p>
                                </div>
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
