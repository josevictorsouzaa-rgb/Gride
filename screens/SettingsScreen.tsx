
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
  const [activeTab, setActiveTab] = useState<'users'>('users');
  const [history, setHistory] = useState<SettingsHistoryEntry[]>([]);
  
  useEffect(() => {
    setHistory(getSettingsHistory());
  }, []);

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
    </div>
  );
};
