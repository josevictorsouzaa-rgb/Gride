
import { User } from '../types';

export interface ApiProduct {
  id: number | string;
  name: string;
  sku: string;
  brand: string;
  balance: number;
  location: string;
  similar_id?: string;
  status: 'active' | 'inactive';
}

export interface InventoryLogEntry {
  sku: string;
  nome_produto: string;
  usuario_id: string;
  usuario_nome: string;
  qtd_sistema: number;
  qtd_contada: number;
  localizacao: string;
  status: string;
  divergencia_motivo?: string;
}

export interface ApiCategory {
  id: string;
  db_id: number;
  label: string;
  icon: string;
  count: number;
  subcategories: { 
    id: string; 
    name: string; 
    count: number; 
    icon: string; 
  }[];
}

// Dynamically determine the API URL based on the current hostname
// This allows the app to work on mobile devices connected to the same WiFi (LAN)
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Default to port 8000 on the same host
    return `http://${hostname}:8000`;
  }
  return 'http://localhost:8000';
};

const API_BASE_URL = getApiBaseUrl();

export const api = {
  /**
   * Realiza Login no ERP
   */
  login: async (usuario_id: string, senha: string): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
      // Timeout to prevent hanging indefinetely if server is unreachable
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id, senha }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error || 'Erro no login' };
      }

      return { success: true, user: data.user };
    } catch (error) {
      console.error("Erro no login:", error);
      
      // FALLBACK MOCK PARA DESENVOLVIMENTO (Caso o server não esteja rodando)
      // Remove this block in production
      if (usuario_id === '18' && senha === '123') {
         console.warn("Using Mock Login Fallback");
         return {
            success: true,
            user: {
                id: '18',
                name: 'Usuário Mock (Offline)',
                role: 'Desenvolvedor',
                avatar: 'https://i.pravatar.cc/150?u=18',
                isAdmin: true
            }
         };
      }

      return { 
        success: false, 
        error: 'Não foi possível conectar ao servidor (Porta 8000). Verifique se o server.js está rodando.' 
      };
    }
  },

  /**
   * Busca Árvore de Categorias
   */
  getCategories: async (): Promise<ApiCategory[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/categories`);
      if (!response.ok) throw new Error('Erro ao buscar categorias');
      return await response.json();
    } catch (error) {
      console.error("Erro categorias (API Offline?):", error);
      // Retorna array vazio para não quebrar a UI
      return [];
    }
  },

  /**
   * Busca produtos do ERP via Node.js
   */
  getProducts: async (page = 1, limit = 100, search = ''): Promise<ApiProduct[]> => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search
      });
      
      const response = await fetch(`${API_BASE_URL}/products?${params}`);
      
      if (!response.ok) {
        throw new Error('Falha na comunicação com o servidor Node');
      }
      
      return await response.json();
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
      return [];
    }
  },

  /**
   * Salva o lastro da contagem no banco
   */
  saveCount: async (data: InventoryLogEntry) => {
    try {
      const response = await fetch(`${API_BASE_URL}/save-count`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      console.error("Erro ao salvar contagem:", error);
      return { success: false };
    }
  },

  /**
   * Busca o histórico de contagens
   */
  getHistory: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/history`);
      if (!response.ok) throw new Error('Erro ao buscar histórico');
      return await response.json();
    } catch (error) {
      console.error("Erro no histórico:", error);
      return [];
    }
  },

  saveSettings: async (settings: any) => {
    console.log("Salvando configurações (Mock):", settings);
    return true;
  }
};
