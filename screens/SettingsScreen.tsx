
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
  const [history, setHistory] = useState<SettingsHistoryEntry[]>([]);
  
  const totalStock = 12500; // Valor simulado do total de itens no banco

  useEffect(() => {
    const settings = getSettings();
    setDailyTarget(settings.dailyTarget);
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
    const newSettings = { dailyTarget };
    const updatedHistory = saveSettings(newSettings, currentUser);
    setHistory(updatedHistory);
    alert('Meta atualizada com sucesso!');
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
              Meta de Contagem
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
             <section className="bg-white dark:bg-surface-dark p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-card-border hover:shadow-md transition-shadow duration-300">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-xl text-purple-600">
                    <Icon name="track_changes" size={28} />
                  </div>
                  <div>
                      <h3 className="font-bold text-xl text-gray-900 dark:text-white">Definição de Meta</h3>
                      <p className="text-xs text-gray-500">Quantos itens a equipe deve contar diariamente?</p>
                  </div>
                </div>

                <div className="flex flex-col gap-6">
                   <div className="p-5 bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-white/5 flex items-center justify-between">
                      <div>
                          <p className="text-xs uppercase font-bold text-gray-500 mb-1">Estoque Total Ativo</p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalStock.toLocaleString()} itens</p>
                      </div>
                      <div className="text-right opacity-50">
                          <Icon name="inventory_2" size={40} />
                      </div>
                   </div>

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

                   {/* Projeção de Giro */}
                   <div className="mt-2 relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white shadow-lg shadow-blue-500/20 group">
                      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                         <div>
                             <p className="text-blue-100 text-xs font-medium uppercase tracking-wider mb-1">Impacto Operacional</p>
                             <h4 className="text-xl font-bold leading-tight">
                                Ciclo de contagem completa em <br/>
                                <span className="text-3xl">{daysToCycle} dias</span>
                             </h4>
                         </div>
                         <div className="text-right">
                             <div className="inline-block bg-white/20 backdrop-blur-md rounded-lg px-3 py-1 mb-1">
                                <span className="text-2xl font-bold">{turnsPerYear}x</span>
                             </div>
                             <p className="text-xs text-blue-200">Giros de contagem por ano</p>
                         </div>
                      </div>
                      <Icon name="sync" className="absolute -right-6 -bottom-6 text-white opacity-10 text-[120px] group-hover:rotate-180 transition-transform duration-[1.5s]" />
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

        {activeTab === 'users' && (
          <div className="space-y-4 animate-fade-in">
             <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-4 rounded-xl flex gap-3">
               <Icon name="admin_panel_settings" className="text-primary mt-0.5" />
               <p className="text-sm text-blue-800 dark:text-blue-300">
                 Defina quem pode tratar divergências. A lista abaixo é carregada diretamente do banco de dados (apenas ativos).
               </p>
            </div>

            <div className="flex flex-col gap-3">
               {isLoadingUsers && <p className="text-center text-gray-500">Carregando usuários...</p>}
               {!isLoadingUsers && users.length === 0 && <p className="text-center text-gray-500">Nenhum usuário ativo encontrado.</p>}
               
               {users.map(user => (
                 <div key={user.id} className="bg-white dark:bg-surface-dark p-4 rounded-xl border border-gray-200 dark:border-card-border shadow-sm flex items-center justify-between hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
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

        {/* Credits Footer */}
        <div className="pt-10 pb-4 text-center animate-fade-in">
             <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold opacity-70">
                 Sistema Desenvolvido por
             </p>
             <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5 hover:text-primary transition-colors cursor-default">
                 José Victor Souza <span className="text-primary opacity-80">@byzvictorrr</span>
             </p>
        </div>

        </div>
      </main>

      {activeTab === 'params' && (
        <div className="fixed bottom-0 left-0 right-0 w-full max-w-lg mx-auto md:max-w-4xl md:static md:mx-auto md:mb-8 p-4 bg-white dark:bg-surface-dark md:bg-transparent md:dark:bg-transparent border-t border-gray-200 dark:border-card-border md:border-t-0 z-30">
          <button 
            onClick={handleSave}
            className="w-full h-14 bg-primary text-white rounded-xl font-bold text-lg shadow-xl shadow-primary/20 hover:bg-primary-dark active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            Salvar Nova Meta
            <Icon name="save" />
          </button>
        </div>
      )}
    </div>
  );
};
