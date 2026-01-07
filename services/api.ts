
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

// ATENÇÃO: Troque pelo IP da sua máquina na rede local para funcionar no celular
const API_BASE_URL = 'http://localhost:8000'; 

export const api = {
  /**
   * Realiza Login no ERP
   */
  login: async (usuario_id: string, senha: string): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id, senha })
      });

      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error || 'Erro no login' };
      }

      return { success: true, user: data.user };
    } catch (error) {
      console.error("Erro no login:", error);
      return { success: false, error: 'Erro de conexão com o servidor' };
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
      console.error("Erro categorias:", error);
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
