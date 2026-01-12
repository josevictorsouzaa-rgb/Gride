
import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';

interface AutoPartsLoaderProps {
  message?: string;
  fullScreen?: boolean;
}

const ICONS = [
  'tire_repair',       // Pneu
  'settings',          // Engrenagem
  'local_gas_station', // Bomba/Oleo
  'build',             // Ferramenta
  'speed',             // Velocimetro
  'bolt',              // Bateria/Eletrica
  'directions_car',    // Carro
  'hardware',          // Parafusos/Peças
  'handyman'           // Ferramentas
];

export const AutoPartsLoader: React.FC<AutoPartsLoaderProps> = ({ message = "Carregando...", fullScreen = true }) => {
  const [currentIconIndex, setCurrentIconIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIconIndex((prev) => (prev + 1) % ICONS.length);
    }, 500); // Troca o ícone a cada 500ms

    return () => clearInterval(interval);
  }, []);

  const containerClass = fullScreen 
    ? "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/90 dark:bg-background-dark/90 backdrop-blur-sm transition-all"
    : "flex flex-col items-center justify-center p-8 w-full h-full min-h-[300px]";

  return (
    <div className={containerClass}>
      <div className="relative">
        {/* Container do Ícone */}
        <div className="flex items-center justify-center size-24 bg-primary rounded-3xl shadow-xl shadow-primary/30 border-4 border-white dark:border-surface-dark transform transition-transform">
           <div className="animate-spin-fast text-white">
              <Icon name={ICONS[currentIconIndex]} size={48} fill />
           </div>
        </div>
        
        {/* Detalhe decorativo (bolinha pulsando) */}
        <div className="absolute -bottom-2 -right-2 size-6 bg-green-500 rounded-full border-4 border-white dark:border-background-dark animate-pulse shadow-md" />
      </div>

      <div className="mt-6 flex flex-col items-center gap-1">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white tracking-tight animate-pulse">
            {message}
        </h3>
        <div className="flex gap-1">
            <div className="size-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="size-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            <div className="size-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    </div>
  );
};
