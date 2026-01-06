import React, { useState } from 'react';
import { Icon } from '../components/Icon';
import { User } from '../types';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [code, setCode] = useState('18'); // Defaulted to 18 for testing convenience per prompt
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = () => {
    setError('');
    
    // Check for Specific User Jose Victor
    if (code === '18') {
      if (password === '172500') {
        onLogin({
          id: '18',
          name: 'José Victor',
          role: 'Gestor de Estoque',
          avatar: 'https://i.pravatar.cc/150?u=18',
          isAdmin: true
        });
      } else {
        setError('Senha incorreta para este usuário.');
      }
    } else {
      // Default login for other users (Simulation)
      // Any other code logs in as standard user Carlos
      onLogin({
        id: code || '849201',
        name: 'Carlos Silva',
        role: 'Conferente',
        avatar: 'https://i.pravatar.cc/150?u=849201',
        isAdmin: false
      });
    }
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-background-light dark:bg-background-dark overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center px-4 py-4 justify-between sticky top-0 z-10 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <Icon name="arrow_back" className="text-slate-900 dark:text-white" size={24} />
        </div>
        <h2 className="text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-10">Login Inteligente</h2>
      </div>

      <main className="flex-1 flex flex-col px-4 pt-4 pb-8 max-w-md mx-auto w-full">
        {/* Headline */}
        <div className="flex flex-col items-center justify-center pt-4 pb-8">
          <div className="size-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-4 text-primary">
            <Icon name="inventory_2" size={32} />
          </div>
          <h1 className="text-3xl font-bold leading-tight text-center">Bem-vindo</h1>
          <p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-normal pt-2 text-center">
            Identifique-se para acessar o inventário
          </p>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-6">
          {/* Code Input */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium leading-normal text-slate-900 dark:text-white">
              Código de Usuário
            </label>
            <div className="relative flex w-full items-center rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-card-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all shadow-sm">
              <input
                type="number"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
                className="flex w-full min-w-0 bg-transparent py-3.5 pl-4 pr-12 text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none border-none focus:ring-0 rounded-xl"
              />
              <div className="absolute right-3 flex items-center justify-center text-emerald-500 pointer-events-none">
                <Icon name="check_circle" size={24} />
              </div>
            </div>
          </div>

          {/* User Card Preview */}
          <div className="relative overflow-hidden rounded-xl bg-slate-100 dark:bg-surface-dark border border-slate-200 dark:border-card-border p-3 animate-fade-in transition-all">
            <div className="absolute top-0 right-0 p-2">
              <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${code === '18' ? 'bg-purple-100 text-purple-700 ring-purple-700/20' : 'bg-primary/10 text-primary ring-primary/20'}`}>
                {code === '18' ? 'Gestor' : 'Conferente'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div 
                className="bg-center bg-no-repeat bg-cover rounded-full h-12 w-12 shrink-0 border-2 border-slate-200 dark:border-slate-700"
                style={{ backgroundImage: `url('https://i.pravatar.cc/150?u=${code}')` }}
              />
              <div className="flex flex-col justify-center">
                <p className="text-slate-900 dark:text-white text-base font-semibold leading-tight">
                    {code === '18' ? 'José Victor' : 'Colaborador'}
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-normal">ID: {code}</p>
              </div>
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium leading-normal text-slate-900 dark:text-white">
              Senha
            </label>
            <div className="relative flex w-full items-center rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-card-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all shadow-sm">
              <div className="absolute left-3 flex items-center justify-center text-slate-400">
                <Icon name="lock" size={20} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="flex w-full min-w-0 bg-transparent py-3.5 pl-10 pr-12 text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none border-none focus:ring-0 rounded-xl"
              />
              <button 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <Icon name={showPassword ? "visibility_off" : "visibility"} size={24} />
              </button>
            </div>
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>

          <button 
            onClick={handleLogin}
            className="w-full rounded-xl bg-primary py-3.5 text-center text-base font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary-dark active:scale-[0.98] transition-all"
          >
            Entrar
          </button>

          <div className="flex justify-center mt-4">
            <a href="#" className="text-sm text-slate-500 dark:text-slate-400 hover:text-primary transition-colors flex items-center gap-1.5">
              <Icon name="help" size={18} />
              Problemas com acesso?
            </a>
          </div>
        </div>
      </main>
    </div>
  );
};