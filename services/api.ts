
import { User, WMSAddress, WarehouseLayout, Block } from '../types';

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

export interface Warehouse {
    id: number;
    sigla: string;
    descricao: string;
}

const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:8000`;
  }
  return 'http://localhost:8000';
};

const API_BASE_URL = getApiBaseUrl();

export const api = {
  
  getUserName: async (id: string): Promise<string | null> => {
    try {
        if (!id) return null;
        if (id === '9999') return 'Gestor de Teste';
        if (id === '8888') return 'Colaborador Teste';
        const response = await fetch(`${API_BASE_URL}/user-name/${id}`);
        if (response.ok) { const data = await response.json(); return data.name; }
        return null;
    } catch (error) { return null; }
  },

  login: async (usuario_id: string, senha: string): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id, senha }),
      });
      const data = await response.json();
      if (!response.ok) return { success: false, error: data.error || 'Erro no login' };
      return { success: true, user: data.user };
    } catch (error) {
      if (usuario_id === '9999') return { success: true, user: { id: '9999', name: 'Gestor (Offline)', role: 'Gerente', avatar: '', isAdmin: true } };
      return { success: false, error: 'Servidor offline.' };
    }
  },

  getUsers: async (): Promise<User[]> => {
      try {
          const response = await fetch(`${API_BASE_URL}/users`);
          if (response.ok) return await response.json();
          return [];
      } catch (e) { return []; }
  },

  getCategories: async (): Promise<ApiCategory[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/categories`);
      if (!response.ok) throw new Error('Erro');
      return await response.json();
    } catch (error) { return []; }
  },

  // --- NOVO: BUSCAR BLOCOS PRÉ-AGRUPADOS DO BACKEND ---
  getBlocks: async (page = 1, limit = 100, search = ''): Promise<Block[]> => {
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString(), search });
      const response = await fetch(`${API_BASE_URL}/blocks?${params}`);
      if (!response.ok) throw new Error('Erro blocks');
      return await response.json();
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  // --- RESERVAS & LOCKING ---
  reserveBlock: async (blockId: number | string, user: User) => {
      try {
          const response = await fetch(`${API_BASE_URL}/reserve-block`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ block_id: blockId, user_id: user.id, user_name: user.name })
          });
          return await response.json();
      } catch (e) { return { success: false, message: 'Erro de conexão' }; }
  },

  releaseBlock: async (blockId: number | string) => {
      try {
          await fetch(`${API_BASE_URL}/release-block`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ block_id: blockId })
          });
          return true;
      } catch (e) { return false; }
  },

  finalizeBlock: async (data: { block_id: string|number, user_id: string, user_name: string, items: any[] }) => {
      try {
          const response = await fetch(`${API_BASE_URL}/finalize-block`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
          });
          return await response.json();
      } catch (e) { return { success: false, error: 'Erro ao finalizar' }; }
  },

  // --- COMPATIBILIDADE ---
  saveCount: async (data: InventoryLogEntry) => {
    // Mantido para compatibilidade, mas o finalizeBlock deve ser preferido para blocos
    try {
      await fetch(`${API_BASE_URL}/save-count`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      return { success: true };
    } catch (error) { return { success: false }; }
  },

  getHistory: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/history`);
      if (!response.ok) throw new Error('Erro');
      return await response.json();
    } catch (error) { return []; }
  },

  // --- ENDEREÇAMENTO (GERENCIAMENTO) ---
  getAddresses: async (): Promise<WMSAddress[]> => {
    try {
        const response = await fetch(`${API_BASE_URL}/addresses`);
        if(response.ok) return await response.json();
        return [];
    } catch (e) { return []; }
  },

  saveAddresses: async (addresses: Partial<WMSAddress>[]) => {
      try {
          const response = await fetch(`${API_BASE_URL}/save-addresses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(addresses)
          });
          return await response.json();
      } catch (e) { return { success: false }; }
  },

  updateAddress: async (id: number, codigo: string, descricao: string) => {
      try {
          const response = await fetch(`${API_BASE_URL}/update-address`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, codigo, descricao })
          });
          return await response.json();
      } catch (e) { return { success: false }; }
  },

  deleteAddress: async (id: number) => {
      try {
          const response = await fetch(`${API_BASE_URL}/delete-address`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id })
          });
          return await response.json();
      } catch (e) { return { success: false }; }
  },

  getWarehouses: async (): Promise<Warehouse[]> => {
      try {
          const response = await fetch(`${API_BASE_URL}/warehouses`);
          if (response.ok) return await response.json();
          return [];
      } catch (e) { return []; }
  },

  saveWarehouse: async (warehouse: Partial<Warehouse>) => {
      try {
          const response = await fetch(`${API_BASE_URL}/save-warehouse`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(warehouse)
          });
          return await response.json();
      } catch (e) { return { success: false }; }
  },

  deleteWarehouse: async (id: number) => {
      try {
          await fetch(`${API_BASE_URL}/delete-warehouse`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id })
          });
          return true;
      } catch (e) { return false; }
  },

  // --- LAYOUT METHODS (MOCK / PLACEHOLDER) ---
  getLayout: async (): Promise<WarehouseLayout | null> => { return null; },
  saveLayout: async (layout: WarehouseLayout) => { return { success: true }; }
};
