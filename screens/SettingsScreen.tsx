import React, { useState, useEffect } from 'react';
import { Icon } from '../components/Icon';
import { Screen, User } from '../types';
import { getSettings, saveSettings, getSettingsHistory, SettingsHistoryEntry } from '../data/settingsStore';

interface SettingsScreenProps {
  onBack: () => void;
  currentUser: User | null;
}

const initialUsers: User[] = [
  { id: '849201', name: 'Carlos Silva', role: 'Conferente', avatar: '', canTreat: false },
  { id: '849202', name: 'Mariana Santos', role: 'Conferente', avatar: '', canTreat: false },
  { id: '849203', name: 'João Pedro', role: 'Conferente', avatar: '', canTreat: true },
  { id: '849204', name: 'Ana Souza', role: 'Auxiliar', avatar: '', canTreat: false },
  { id: '849205', name: 'Roberto Lima', role: 'Conferente', avatar: '', canTreat: false },
];

const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'params' | 'users'>('params');

  const [curveA, setCurveA] = useState(50);
  const [curveB, setCurveB] = useState(30);
  const [curveC, setCurveC] = useState(20);
  const [dailyTarget, setDailyTarget] = useState(150);
  const [history, setHistory] = useState<SettingsHistoryEntry[]>([]);
  
  const totalStock = 12500;

  useEffect(() => {
    const settings = getSettings();
    setCurveA(settings.curveA);
    setCurveB(settings.curveB);
    setCurveC(settings.curveC);
    setDailyTarget(settings.dailyTarget);
    setHistory(getSettingsHistory());
  }, []);

  const turnsPerYear = ((dailyTarget * 252) / totalStock).toFixed(1); 
  const daysToCycle = Math.round(totalStock / dailyTarget);

  const [users, setUsers] = useState(initialUsers);

  const toggleUserPermission = (id: string) => {
    setUsers(prev => prev.map(u => 
      u.id === id ? { ...u, canTreat: !u.canTreat } : u
    ));
  };

  const handleSave = () => {
    const newSettings = { curveA, curveB, curveC, dailyTarget };
    const updatedHistory = saveSettings(newSettings, currentUser);
    setHistory(updatedHistory);
    alert('Configurações salvas com sucesso!');
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
              Parâmetros de Contagem
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
             <section className="bg-white dark:bg-surface-dark p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-card-border hover:shadow-md transition-shadow duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg text-primary">
                    <Icon name="analytics" size={24} />
                  </div>
                  <h3 className="font-bold text-lg">Curva ABC</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                    <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20">
                       <span className="text-green-600 dark:text-green-400 font-bold text-lg">Curva A</span>
                       <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight mt-1">
                         <strong>Alta Prioridade</strong>. Itens de maior valor ou giro (~80% do resultado).
                       </p>
                    </div>
                    <div className="p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/20">
                       <span className="text-yellow-600 dark:text-yellow-400 font-bold text-lg">Curva B</span>
                       <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight mt-1">
                         <strong>Média Prioridade</strong>. Relevância intermediária (~15% do resultado).
                       </p>
                    </div>
                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
                       <span className="text-red-500 dark:text-red-400 font-bold text-lg">Curva C</span>
                       <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight mt-1">
                         <strong>Baixa Prioridade</strong>. Menor giro e valor (~5% do resultado).
                       </p>
                    </div>
                </div>

                <div className="space-y-6">
                   <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-green-600 dark:text-green-400">Distribuição Curva A</span>
                        <span className="font-bold text-lg text-gray-900 dark:text-white">{curveA}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="100" value={curveA} 
                        onChange={(e) => setCurveA(Number(e.target.value))}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                      />
                   </div>
                   
                   <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-yellow-600 dark:text-yellow-400">Distribuição Curva B</span>
                        <span className="font-bold text-lg text-gray-900 dark:text-white">{curveB}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="100" value={curveB} 
                        onChange={(e) => setCurveB(Number(e.target.value))}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                      />
                   </div>

                   <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-red-500 dark:text-red-400">Distribuição Curva C</span>
                        <span className="font-bold text-lg text-gray-900 dark:text-white">{curveC}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="100" value={curveC} 
                        onChange={(e) => setCurveC(Number(e.target.value))}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                      />
                   </div>
                   
                   <div className={`text-xs text-center font-bold py-2 rounded ${curveA + curveB + curveC === 100 ? 'text-green-600 bg-green-50 dark:bg-green-900/10' : 'text-red-600 bg-red-50 dark:bg-red-900/10'}`}>
                      Total Configurado: {curveA + curveB + curveC}% (Deve ser 100%)
                   </div>
                </div>
             </section>

             <section className="bg-white dark:bg-surface-dark p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-card-border hover:shadow-md transition-shadow duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg text-purple-600">
                    <Icon name="track_changes" size={24} />
                  </div>
                  <h3 className="font-bold text-lg">Meta Diária & Giro</h3>
                </div>

                <div className="flex flex-col gap-4">
                   <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-white/5">
                      <p className="text-xs uppercase font-bold text-gray-500 mb-1">Estoque Total Cadastrado</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalStock.toLocaleString()} itens</p>
                   </div>

                   <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                        Itens a contar por dia (Meta)
                      </label>
                      <div className="flex items-center gap-3">
                         <button 
                           onClick={() => setDailyTarget(Math.max(10, dailyTarget - 10))}
                           className="size-10 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 flex items-center justify-center transition-colors"
                         >
                           <Icon name="remove" />
                         </button>
                         <input 
                           type="number" 
                           value={dailyTarget} 
                           onChange={(e) => setDailyTarget(Number(e.target.value))}
                           className="flex-1 h-10 text-center font-bold bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                         />
                         <button 
                           onClick={() => setDailyTarget(dailyTarget + 10)}
                           className="size-10 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 flex items-center justify-center transition-colors"
                         >
                           <Icon name="add" />
                         </button>
                      </div>
                   </div>

                   <div className="mt-2 relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 p-4 text-white shadow-lg shadow-blue-500/20 group">
                      <div className="relative z-10">
                         <p className="text-blue-100 text-xs font-medium uppercase tracking-wider mb-2">Projeção de Giro</p>
                         <div className="flex items-baseline gap-2 mb-1">
                            <h4 className="text-3xl font-bold">{turnsPerYear}x</h4>
                            <span className="text-sm text-blue-200">vezes por ano</span>
                         </div>
                         <p className="text-sm text-blue-100 leading-tight opacity-90">
                           Com essa meta, você contará o estoque inteiro a cada <strong>{daysToCycle} dias</strong>.
                         </p>
                      </div>
                      <Icon name="sync" className="absolute -right-4 -bottom-4 text-white opacity-10 text-[100px] group-hover:rotate-180 transition-transform duration-[1.5s]" />
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
                 Defina quem pode tratar divergências. Usuários sem essa permissão poderão apenas contar e reportar.
               </p>
            </div>

            <div className="flex flex-col gap-3">
               {users.map(user => (
                 <div key={user.id} className="bg-white dark:bg-surface-dark p-4 rounded-xl border border-gray-200 dark:border-card-border shadow-sm flex items-center justify-between hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                    <div className="flex items-center gap-3">
                       <div className="size-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-300 font-bold border border-white dark:border-gray-600">
                         {getInitials(user.name)}
                       </div>
                       <div>
                          <h4 className="font-bold text-gray-900 dark:text-white">{user.name}</h4>
                          <p className="text-xs text-gray-500">{user.role} • ID: {user.id}</p>
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
            Salvar Alterações
            <Icon name="save" />
          </button>
        </div>
      )}
    </div>
  );
};