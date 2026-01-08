import React, { useState } from 'react';
import { Icon } from '../components/Icon';
import { User } from '../types';
import { api } from '../services/api';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [code, setCode] = useState(''); // Inicia vazio conforme solicitado
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // State for Name Preview
  const [detectedName, setDetectedName] = useState<string | null>(null);
  const [isCheckingName, setIsCheckingName] = useState(false);

  // Handle Input Blur to fetch Name
  const handleCodeBlur = async () => {
    // CORREÇÃO: Aceitar código com pelo menos 1 caractere (antes era >= 2)
    if (code.length > 0) {
        setIsCheckingName(true);
        try {
            const name = await api.getUserName(code);
            setDetectedName(name);
        } catch (e) {
            setDetectedName(null);
        }
        setIsCheckingName(false);
    } else {
        setDetectedName(null);
    }
  };

  const handleLogin = async () => {
    if (!code || !password) {
      setError('Informe o código e a senha.');
      return;
    }

    setError('');
    setIsLoading(true);

    const result = await api.login(code, password);

    setIsLoading(false);

    if (result.success && result.user) {
      onLogin(result.user);
    } else {
      setError(result.error || 'Falha na autenticação');
    }
  };

  return (
    // Usa min-h-[100dvh] para lidar melhor com o teclado virtual em navegadores mobile
    <div className="flex flex-col min-h-[100dvh] w-full bg-background-light dark:bg-background-dark overflow-y-auto animate-fade-in">
      
      <main className="flex-1 flex flex-col justify-center px-6 pb-8 max-w-md mx-auto w-full">
        {/* Headline */}
        <div className="flex flex-col items-center justify-center pb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="w-full max-w-[200px] bg-[#182335] rounded-xl flex items-center justify-center mb-6 shadow-xl p-4 hover:scale-105 transition-transform duration-500">
             <img src="/logo.png" alt="Lubel Auto Peças" className="w-full h-auto object-contain" />
          </div>
          <h1 className="text-2xl font-bold leading-tight text-center text-slate-900 dark:text-white">Sistema GRIDE</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium pt-2 text-center">
            Gestão Rotativa Inteligente de Estoque
          </p>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-5 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          {/* Code Input */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">
              Código de Usuário
            </label>
            <div className="relative flex w-full items-center rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-card-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-sm">
              {/* ALTERAÇÃO: type="text" + inputMode="numeric" remove as setas laterais e mantém teclado numérico */}
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={code}
                onChange={(e) => {
                    // Garante que apenas números sejam digitados
                    const val = e.target.value.replace(/\D/g, '');
                    setCode(val);
                }}
                onBlur={handleCodeBlur}
                placeholder="Informe seu ID"
                className="flex w-full min-w-0 bg-transparent py-4 pl-4 pr-12 text-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none border-none focus:ring-0 rounded-xl"
              />
              <div className="absolute right-3 flex items-center justify-center pointer-events-none">
                 {isCheckingName ? (
                     <Icon name="sync" className="animate-spin text-gray-400" size={24} />
                 ) : detectedName ? (
                     <Icon name="check_circle" className="text-green-500" size={24} />
                 ) : (
                     <Icon name="badge" className="text-gray-400" size={24} />
                 )}
              </div>
            </div>
          </div>

          {/* User Name Preview */}
          <div className={`transition-all duration-300 overflow-hidden ease-out ${detectedName ? 'max-h-24 opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-2'}`}>
            <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-3 flex items-center gap-3">
               <div className="size-10 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-100 flex items-center justify-center font-bold text-lg animate-pulse">
                  {detectedName ? detectedName.charAt(0) : '?'}
               </div>
               <div className="flex flex-col">
                  <span className="text-[10px] text-blue-600 dark:text-blue-300 font-bold uppercase tracking-wider">Identificado</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                    {detectedName}
                  </span>
               </div>
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">
              Senha
            </label>
            <div className="relative flex w-full items-center rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-card-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-sm">
              <div className="absolute left-4 flex items-center justify-center text-slate-400">
                <Icon name="lock" size={20} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                className="flex w-full min-w-0 bg-transparent py-4 pl-12 pr-12 text-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none border-none focus:ring-0 rounded-xl"
              />
              <button 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 p-1 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <Icon name={showPassword ? "visibility_off" : "visibility"} size={24} />
              </button>
            </div>
            {error && <p className="text-red-500 text-sm mt-1 bg-red-50 dark:bg-red-900/20 p-2.5 rounded-lg animate-shake font-medium flex items-center gap-2"><Icon name="error" size={18}/> {error}</p>}
          </div>

          <div className="pt-4">
            <button 
                onClick={handleLogin}
                disabled={isLoading}
                className={`w-full rounded-xl py-4 text-center text-lg font-bold text-white shadow-xl shadow-primary/20 transition-all duration-200 ${
                    isLoading ? 'bg-gray-400 cursor-not-allowed scale-[0.98]' : 'bg-primary hover:bg-primary-dark hover:scale-[1.02] active:scale-[0.98]'
                }`}
            >
                {isLoading ? 'Autenticando...' : 'Entrar no Sistema'}
            </button>
          </div>

          <div className="flex justify-center mt-2">
            <a href="#" className="text-sm text-slate-500 dark:text-slate-400 hover:text-primary transition-colors flex items-center gap-1.5 group p-2">
              <Icon name="help" size={18} className="group-hover:rotate-12 transition-transform" />
              Problemas com acesso?
            </a>
          </div>
        </div>
        
        {/* Credits Footer */}
        <div className="mt-8 text-center animate-fade-in" style={{ animationDelay: '0.5s' }}>
             <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold opacity-70">
                 Desenvolvido por
             </p>
             <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5 hover:text-primary transition-colors cursor-default">
                 José Victor Souza <span className="text-primary opacity-80">@byzvictorrr</span>
             </p>
        </div>
      </main>
    </div>
  );
};