
import React, { useState, useEffect } from 'react';
import { Icon } from '../components/Icon';
import { Screen, User, UserPermissions } from '../types';
import { api, Cycle } from '../services/api';

interface SettingsScreenProps {
  onBack: () => void;
  currentUser: User | null;
}

const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'cycles' | 'users'>('cycles');

  // Cycle States
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loadingCycles, setLoadingCycles] = useState(false);
  const [isCreatingCycle, setIsCreatingCycle] = useState(false);
  const [newCycleName, setNewCycleName] = useState('');

  // User States
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  useEffect(() => {
      if (activeTab === 'cycles') {
          loadCycles();
      } else {
          loadUsers();
      }
  }, [activeTab]);

  const loadCycles = () => {
      setLoadingCycles(true);
      api.getCycles().then(data => {
          setCycles(data);
          setLoadingCycles(false);
      });
  };

  const loadUsers = () => {
      setIsLoadingUsers(true);
      api.getUsers().then(data => {
          setUsers(data);
          setIsLoadingUsers(false);
      });
  };

  const handleStartNewCycle = async () => {
      if (!newCycleName.trim()) return alert("Nome do ciclo é obrigatório.");
      if (!confirm(`Tem certeza que deseja iniciar "${newCycleName}"? O ciclo atual será encerrado.`)) return;

      const res = await api.startNewCycle(newCycleName);
      if (res.success) {
          setIsCreatingCycle(false);
          setNewCycleName('');
          loadCycles();
          alert("Novo ciclo iniciado com sucesso! Os indicadores do Dashboard foram resetados.");
      } else {
          alert("Erro: " + res.error);
      }
  };

  const handleTogglePermission = async (user: User, key: keyof UserPermissions) => {
      const updatedPermissions = { ...user.permissions, [key]: !user.permissions[key] };
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, permissions: updatedPermissions } : u));
      await api.updateUserPermissions(user.id, user.active, updatedPermissions);
  };

  const handleToggleBlock = async (user: User) => {
      const newActiveState = !user.active;
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, active: newActiveState } : u));
      await api.updateUserPermissions(user.id, newActiveState, user.permissions);
  };

  const activeCycle = cycles.find(c => c.active);

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
              onClick={() => setActiveTab('cycles')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors ${
                activeTab === 'cycles' 
                  ? 'text-primary border-primary' 
                  : 'text-gray-500 border-transparent hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              Gestão de Ciclos
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
        
        {/* CYCLE MANAGEMENT TAB */}
        {activeTab === 'cycles' && (
          <div className="space-y-6 animate-fade-in">
             
             {/* CARTÃO DO CICLO ATUAL */}
             <section className="bg-white dark:bg-surface-dark p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-card-border relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-5">
                    <Icon name="update" size={150} />
                </div>
                
                <div className="flex items-center gap-3 mb-6 relative z-10">
                  <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-xl text-green-600">
                    <Icon name="play_circle" size={28} />
                  </div>
                  <div>
                      <h3 className="font-bold text-xl text-gray-900 dark:text-white">Ciclo Ativo</h3>
                      <p className="text-xs text-gray-500">Período de contagem vigente</p>
                  </div>
                </div>

                <div className="flex flex-col gap-6 relative z-10">
                   {activeCycle ? (
                       <div className="bg-green-50 dark:bg-green-900/10 p-5 rounded-xl border border-green-100 dark:border-green-900/30">
                           <div className="flex flex-col">
                               <span className="text-xs font-bold text-green-600 uppercase tracking-widest mb-1">Em Andamento</span>
                               <h2 className="text-3xl font-black text-gray-900 dark:text-white">{activeCycle.name}</h2>
                               <div className="flex items-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-300">
                                   <Icon name="calendar_today" size={16} />
                                   Iniciado em {new Date(activeCycle.startDate).toLocaleDateString('pt-BR')}
                               </div>
                           </div>
                       </div>
                   ) : (
                       <div className="p-5 rounded-xl bg-gray-100 dark:bg-white/5 border border-dashed border-gray-300 dark:border-white/10 text-center">
                           <p className="text-gray-500 font-bold">Nenhum ciclo ativo.</p>
                       </div>
                   )}

                   {!isCreatingCycle ? (
                       <button 
                         onClick={() => setIsCreatingCycle(true)}
                         className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl font-bold shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                       >
                           <Icon name="flag" />
                           Encerrar e Começar Novo Ciclo
                       </button>
                   ) : (
                       <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-xl border border-gray-200 dark:border-white/10 animate-fade-in">
                           <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Nome do Novo Ciclo</label>
                           <input 
                               autoFocus
                               value={newCycleName}
                               onChange={(e) => setNewCycleName(e.target.value)}
                               placeholder="Ex: Inventário Natal 2024"
                               className="w-full p-3 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-surface-dark mb-3 font-bold"
                           />
                           <div className="flex gap-2">
                               <button onClick={() => setIsCreatingCycle(false)} className="flex-1 py-3 rounded-lg border border-gray-300 dark:border-white/10 font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5">Cancelar</button>
                               <button onClick={handleStartNewCycle} className="flex-1 py-3 rounded-lg bg-primary text-white font-bold shadow-md hover:bg-primary-dark">Confirmar Início</button>
                           </div>
                           <p className="text-xs text-red-500 mt-2 text-center">
                               Atenção: O indicador de progresso do Dashboard será zerado para o novo ciclo.
                           </p>
                       </div>
                   )}
                </div>
             </section>

             {/* HISTÓRICO DE CICLOS */}
             <section className="bg-white dark:bg-surface-dark p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-card-border">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-xl text-blue-600">
                    <Icon name="history" size={28} />
                  </div>
                  <div>
                      <h3 className="font-bold text-xl text-gray-900 dark:text-white">Histórico de Ciclos</h3>
                      <p className="text-xs text-gray-500">Períodos finalizados</p>
                  </div>
                </div>

                <div className="space-y-4">
                    {loadingCycles ? (
                        <p className="text-center text-gray-400 py-4">Carregando...</p>
                    ) : cycles.length <= 1 ? ( // 1 porque o ativo sempre existe
                        <p className="text-center text-gray-400 py-4 text-sm">Nenhum ciclo anterior registrado.</p>
                    ) : (
                        <div className="relative pl-4 space-y-6 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 dark:before:bg-white/10">
                            {cycles.filter(c => !c.active).map((cycle) => (
                                <div key={cycle.id} className="relative pl-8">
                                    <div className="absolute left-[13px] top-1.5 w-3.5 h-3.5 bg-gray-400 rounded-full border-2 border-white dark:border-surface-dark ring-2 ring-gray-100 dark:ring-white/5" />
                                    <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-100 dark:border-white/5">
                                        <h4 className="font-bold text-gray-800 dark:text-white">{cycle.name}</h4>
                                        <div className="flex justify-between mt-1 text-xs text-gray-500">
                                            <span>Início: {new Date(cycle.startDate).toLocaleDateString('pt-BR')}</span>
                                            <span>Fim: {cycle.endDate ? new Date(cycle.endDate).toLocaleDateString('pt-BR') : '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
             </section>
          </div>
        )}

        {/* USERS TAB (Mantido igual) */}
        {activeTab === 'users' && (
          <div className="space-y-6 animate-fade-in">
             <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
                 <Icon name="info" className="text-blue-500" />
                 <p className="text-xs text-blue-800 dark:text-blue-200">
                     Gerencie quem tem acesso e quais ferramentas cada usuário pode utilizar. Usuários bloqueados não conseguirão fazer login no aplicativo.
                 </p>
             </div>

             <div className="flex flex-col gap-4">
               {users.map(user => {
                 const isActive = user.active;
                 return (
                 <div key={user.id} className={`bg-white dark:bg-surface-dark p-5 rounded-xl border shadow-sm transition-colors ${!isActive ? 'border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/5' : 'border-gray-200 dark:border-card-border'}`}>
                    {/* Header do User */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                           <div className={`size-12 rounded-full flex items-center justify-center font-bold border text-lg ${
                               isActive 
                               ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                               : 'bg-red-100 dark:bg-red-900/20 text-red-500 border-red-200 dark:border-red-800'
                           }`}>
                             {getInitials(user.name)}
                           </div>
                           <div>
                              <h4 className={`font-bold text-lg ${!isActive ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                                {user.name} {user.id === currentUser?.id ? '(Você)' : ''}
                              </h4>
                              <p className="text-xs text-gray-500">ID: {user.id} • {isActive ? 'Ativo' : 'Bloqueado'}</p>
                           </div>
                        </div>
                        
                        <div className="flex flex-col items-end">
                            <span className={`text-[10px] font-bold uppercase mb-1 ${isActive ? 'text-green-600' : 'text-red-500'}`}>
                                {isActive ? 'Acesso Liberado' : 'Acesso Bloqueado'}
                            </span>
                            <button 
                                onClick={() => handleToggleBlock(user)}
                                className={`w-12 h-7 rounded-full transition-colors relative ${isActive ? 'bg-green-500' : 'bg-red-500'}`}
                                disabled={user.id === currentUser?.id}
                            >
                                <div className={`absolute top-1 left-1 size-5 bg-white rounded-full shadow transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 dark:border-white/5 my-3" />

                    <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 ${!isActive ? 'opacity-50 pointer-events-none' : ''}`}>
                        {[
                            { key: 'treatment', label: 'Tratamento', icon: 'admin_panel_settings', color: 'text-orange-500' },
                            { key: 'analytics', label: 'Indicadores', icon: 'insights', color: 'text-blue-500' },
                            { key: 'addressing', label: 'Endereçamento', icon: 'qr_code_2', color: 'text-purple-500' },
                            { key: 'settings', label: 'Parâmetros', icon: 'settings', color: 'text-gray-500' }
                        ].map((perm) => (
                            <label key={perm.key} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-white/10 transition-all">
                                <input 
                                    type="checkbox"
                                    checked={user.permissions[perm.key as keyof UserPermissions]}
                                    onChange={() => handleTogglePermission(user, perm.key as keyof UserPermissions)}
                                    disabled={user.id === currentUser?.id && perm.key === 'settings'}
                                    className="rounded border-gray-300 text-primary focus:ring-primary size-4"
                                />
                                <div className="flex items-center gap-1.5 select-none">
                                    <Icon name={perm.icon} size={16} className={perm.color} />
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{perm.label}</span>
                                </div>
                            </label>
                        ))}
                    </div>
                 </div>
               );})}
            </div>
          </div>
        )}

        </div>
      </main>
    </div>
  );
};
