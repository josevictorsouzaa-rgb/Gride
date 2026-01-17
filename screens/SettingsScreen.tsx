
import React, { useState, useEffect } from 'react';
import { Icon } from '../components/Icon';
import { Screen, User } from '../types';
import { getSettings, saveSettings, getSettingsHistory, SettingsHistoryEntry } from '../data/settingsStore';
import { api } from '../services/api';

interface SettingsScreenProps {
  onBack: () => void;
  currentUser: User | null;
}

const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'params' | 'users'>('params');

  const [dailyTarget, setDailyTarget] = useState(150);
  const [cooldownDays, setCooldownDays] = useState(30);
  const [highGiroThreshold, setHighGiroThreshold] = useState(5);
  const [accumulationMode, setAccumulationMode] = useState(true);
  const [highGiroSplit, setHighGiroSplit] = useState(40); // Novo Estado

  const [history, setHistory] = useState<SettingsHistoryEntry[]>([]);
  
  const totalStock = 12500; // Valor simulado do total de itens no banco

  useEffect(() => {
    const settings = getSettings();
    setDailyTarget(settings.dailyTarget);
    setCooldownDays(settings.cooldownDays);
    setHighGiroThreshold(settings.highGiroThreshold);
    setAccumulationMode(settings.accumulationMode);
    setHighGiroSplit(settings.highGiroSplit || 40);
    
    setHistory(getSettingsHistory());
  }, []);

  const turnsPerYear = ((dailyTarget * 252) / totalStock).toFixed(1); 
  const daysToCycle = Math.round(totalStock / dailyTarget);

  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  useEffect(() => {
      if (activeTab === 'users') {
          setIsLoadingUsers(true);
          api.getUsers().then(data => {
              setUsers(data);
              setIsLoadingUsers(false);
          });
      }
  }, [activeTab]);

  const toggleUserPermission = (id: string) => {
    setUsers(prev => prev.map(u => 
      u.id === id ? { ...u, canTreat: !u.canTreat } : u
    ));
  };

  const handleSave = () => {
    const newSettings = { 
      dailyTarget,
      cooldownDays,
      highGiroThreshold,
      accumulationMode,
      highGiroSplit
    };
    const updatedHistory = saveSettings(newSettings, currentUser);
    setHistory(updatedHistory);
    alert('Configurações atualizadas com sucesso!');
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-background-light dark:bg-background-dark md:bg-transparent">
      <header className="sticky top-0 z-20 bg-background-light dark:bg-background-dark/95 md:bg-white md:dark:bg-surface-dark backdrop-blur-md border-b border-gray-200 dark:border-card-border">
        <div className="flex items-center p-4 gap-4">
           <button 
             onClick={onBack}
             className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-surface-dark transition-colors"
           >
             <Icon name="arrow_back" size={24} />
           </button>
           <div>
             <h2 className="text-lg font-bold leading-tight">Configurações</h2>
             <p className="text-xs text-gray-500 dark:text-gray-400">Painel do Gestor</p>
           </div>
        </div>
        
        <div className="flex px-4 gap-6">
            <button 
              onClick={() => setActiveTab('params')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors ${
                activeTab === 'params' 
                  ? 'text-primary border-primary' 
                  : 'text-gray-500 border-transparent hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              Inteligência e Meta
            </button>
            <button 
              onClick={() => setActiveTab('users')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors ${
                activeTab === 'users' 
                  ? 'text-primary border-primary' 
                  : 'text-gray-500 border-transparent hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              Usuários e Funções
            </button>
        </div>
      </header>

      <main className="flex-1 p-4 pb-24 md:pb-6 overflow-y-auto">
        <div className="md:max-w-4xl md:mx-auto">
        
        {activeTab === 'params' && (
          <div className="space-y-6 animate-fade-in">
             
             {/* CARTÃO PRINCIPAL: META */}
             <section className="bg-white dark:bg-surface-dark p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-card-border">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-xl text-purple-600">
                    <Icon name="track_changes" size={28} />
                  </div>
                  <div>
                      <h3 className="font-bold text-xl text-gray-900 dark:text-white">Definição de Meta</h3>
                      <p className="text-xs text-gray-500">Volume de contagem diária</p>
                  </div>
                </div>

                <div className="flex flex-col gap-6">
                   <div className="space-y-4">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block">
                        Alvo Diário (Itens/Dia)
                      </label>
                      <div className="flex items-center gap-4">
                         <button 
                           onClick={() => setDailyTarget(Math.max(10, dailyTarget - 10))}
                           className="size-14 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 flex items-center justify-center transition-colors border border-gray-200 dark:border-white/10"
                         >
                           <Icon name="remove" size={24} />
                         </button>
                         <div className="flex-1 relative">
                             <input 
                               type="number" 
                               value={dailyTarget} 
                               onChange={(e) => setDailyTarget(Number(e.target.value))}
                               className="w-full h-14 text-center text-3xl font-black bg-transparent border-2 border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:border-primary focus:ring-0"
                             />
                             <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 uppercase">UN</span>
                         </div>
                         <button 
                           onClick={() => setDailyTarget(dailyTarget + 10)}
                           className="size-14 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 flex items-center justify-center transition-colors border border-gray-200 dark:border-white/10"
                         >
                           <Icon name="add" size={24} />
                         </button>
                      </div>
                   </div>

                   <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-white/5">
                      <div className="flex items-center gap-3">
                        <Icon name="published_with_changes" className="text-primary" />
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Meta Acumulativa</span>
                      </div>
                      <button 
                        onClick={() => setAccumulationMode(!accumulationMode)}
                        className={`w-14 h-8 rounded-full transition-colors relative ${accumulationMode ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                      >
                        <div className={`absolute top-1 left-1 size-6 bg-white rounded-full shadow transition-transform ${accumulationMode ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                   </div>
                   <p className="text-xs text-gray-500 px-1 -mt-2">
                      Se ativado, itens não contados ontem serão somados à meta de hoje.
                   </p>
                </div>
             </section>

             {/* CARTÃO INTELIGÊNCIA */}
             <section className="bg-white dark:bg-surface-dark p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-card-border">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-xl text-blue-600">
                    <Icon name="psychology" size={28} />
                  </div>
                  <div>
                      <h3 className="font-bold text-xl text-gray-900 dark:text-white">Inteligência de Seleção</h3>
                      <p className="text-xs text-gray-500">Regras para sugestão de blocos</p>
                  </div>
                </div>

                <div className="space-y-6">
                   
                   {/* NOVO CONTROLE: EQUILÍBRIO DA META */}
                   <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Equilíbrio da Meta</label>
                        <div className="text-xs font-bold bg-gray-100 dark:bg-white/10 px-2 py-1 rounded">
                            <span className="text-purple-600 dark:text-purple-400">{highGiroSplit}% Giro</span>
                            <span className="mx-1 text-gray-400">/</span>
                            <span className="text-blue-600 dark:text-blue-400">{100 - highGiroSplit}% Ciclo</span>
                        </div>
                      </div>
                      <input 
                        type="range" 
                        min="10" 
                        max="90" 
                        step="5"
                        value={highGiroSplit}
                        onChange={(e) => setHighGiroSplit(Number(e.target.value))}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />
                      <p className="text-xs text-gray-400 mt-1">Define a proporção de itens de alta rotatividade na meta diária.</p>
                   </div>

                   <hr className="border-gray-100 dark:border-white/5" />

                   <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Cooldown (Descanso)</label>
                        <span className="text-sm font-bold text-primary">{cooldownDays} dias</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="90" 
                        value={cooldownDays}
                        onChange={(e) => setCooldownDays(Number(e.target.value))}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <p className="text-xs text-gray-400 mt-1">Tempo mínimo para sugerir um item novamente após contagem.</p>
                   </div>

                   <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Giro Alto (Limiar)</label>
                        <span className="text-sm font-bold text-primary">{highGiroThreshold} saídas</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="50" 
                        value={highGiroThreshold}
                        onChange={(e) => setHighGiroThreshold(Number(e.target.value))}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <p className="text-xs text-gray-400 mt-1">Mínimo de saídas em pedidos para priorizar como alto giro.</p>
                   </div>
                </div>
             </section>

             <section className="bg-white dark:bg-surface-dark p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-card-border hover:shadow-md transition-shadow duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-gray-100 dark:bg-white/10 rounded-lg text-gray-600 dark:text-white">
                    <Icon name="history" size={24} />
                  </div>
                  <h3 className="font-bold text-lg">Histórico de Alterações</h3>
                </div>

                {history.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-sm">
                    Nenhuma alteração registrada ainda.
                  </div>
                ) : (
                  <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                    {history.map((entry) => (
                      <div key={entry.id} className="flex gap-3 text-sm border-b border-gray-100 dark:border-white/5 pb-3 last:border-0 last:pb-0">
                         <div className="size-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0 border border-gray-100 dark:border-gray-600 text-xs font-bold text-gray-600 dark:text-gray-300">
                           {getInitials(entry.user)}
                         </div>
                         <div className="flex-1">
                           <div className="flex justify-between items-start">
                             <span className="font-bold text-gray-900 dark:text-white">{entry.user}</span>
                             <span className="text-xs text-gray-500">{entry.dateStr}</span>
                           </div>
                           <div className="mt-1 space-y-1">
                             {entry.changes.map((change, idx) => (
                               <p key={idx} className="text-gray-600 dark:text-gray-300 text-xs leading-relaxed flex items-start gap-1">
                                 <span className="mt-1 size-1 bg-gray-400 rounded-full shrink-0" />
                                 {change}
                               </p>
                             ))}
                           </div>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
             </section>
          </div>
        )}

        {/* User Tab Content */}
        {activeTab === 'users' && (
          <div className="space-y-4 animate-fade-in">
             <div className="flex flex-col gap-3">
               {users.map(user => (
                 <div key={user.id} className="bg-white dark:bg-surface-dark p-4 rounded-xl border border-gray-200 dark:border-card-border shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="size-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-300 font-bold border border-white dark:border-gray-600">
                         {getInitials(user.name)}
                       </div>
                       <div>
                          <h4 className="font-bold text-gray-900 dark:text-white">{user.name}</h4>
                          <p className="text-xs text-gray-500">ID: {user.id}</p>
                       </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                       <span className="text-[10px] font-bold uppercase text-gray-400">Tratar Erros</span>
                       <button 
                         onClick={() => toggleUserPermission(user.id)}
                         className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                           user.canTreat ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                         }`}
                       >
                         <div className={`absolute top-1 left-1 size-5 bg-white rounded-full shadow transition-transform duration-200 ${
                           user.canTreat ? 'translate-x-5' : 'translate-x-0'
                         }`} />
                       </button>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}

        </div>
      </main>

      {activeTab === 'params' && (
        <div className="fixed bottom-0 left-0 right-0 w-full max-w-lg mx-auto md:max-w-4xl md:static md:mx-auto md:mb-8 p-4 bg-white dark:bg-surface-dark md:bg-transparent md:dark:bg-transparent border-t border-gray-200 dark:border-card-border md:border-t-0 z-30">
          <button 
            onClick={handleSave}
            className="w-full h-14 bg-primary text-white rounded-xl font-bold text-lg shadow-xl shadow-primary/20 hover:bg-primary-dark active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            Salvar Configurações
            <Icon name="save" />
          </button>
        </div>
      )}
    </div>
  );
};
