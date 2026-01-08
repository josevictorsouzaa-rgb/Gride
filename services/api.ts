
import { User, WMSAddress, WarehouseLayout } from '../types';

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
  
  /**
   * Busca o nome do usuário pelo ID (pré-login)
   */
  getUserName: async (id: string): Promise<string | null> => {
    try {
        if (!id) return null;
        
        // Mock fallback para desenvolvimento offline
        if (id === '9999') return 'Gestor de Teste';
        if (id === '8888') return 'Colaborador Teste';

        const response = await fetch(`${API_BASE_URL}/user-name/${id}`);
        if (response.ok) {
            const data = await response.json();
            return data.name;
        }
        return null;
    } catch (error) {
        console.error("Erro ao buscar nome:", error);
        return null;
    }
  },

  /**
   * Realiza Login no ERP
   */
  login: async (usuario_id: string, senha: string): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
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
      console.error("Erro no login (API Offline):", error);
      
      // FALLBACKS OFFLINE
      if (usuario_id === '9999' && senha === 'admin') {
         return {
            success: true,
            user: { id: '9999', name: 'Gestor de Teste (Offline)', role: 'Gerente', avatar: '', isAdmin: true }
         };
      }
      if (usuario_id === '8888' && senha === 'user') {
         return {
            success: true,
            user: { id: '8888', name: 'Colaborador Teste (Offline)', role: 'Conferente', avatar: '', isAdmin: false }
         };
      }

      return { success: false, error: 'Servidor offline.' };
    }
  },

  getCategories: async (): Promise<ApiCategory[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/categories`);
      if (!response.ok) throw new Error('Erro categorias');
      return await response.json();
    } catch (error) {
      return [];
    }
  },

  getProducts: async (page = 1, limit = 100, search = ''): Promise<ApiProduct[]> => {
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString(), search });
      const response = await fetch(`${API_BASE_URL}/products?${params}`);
      if (!response.ok) throw new Error('Erro produtos');
      return await response.json();
    } catch (error) {
      return [];
    }
  },

  saveCount: async (data: InventoryLogEntry) => {
    try {
      const response = await fetch(`${API_BASE_URL}/save-count`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      return { success: false };
    }
  },

  getHistory: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/history`);
      if (!response.ok) throw new Error('Erro histórico');
      return await response.json();
    } catch (error) {
      return [];
    }
  },

  saveSettings: async (settings: any) => {
    return true;
  },

  // --- WMS ADDRESS METHODS ---
  getAddresses: async (): Promise<WMSAddress[]> => {
    try {
        const response = await fetch(`${API_BASE_URL}/addresses`);
        if(response.ok) return await response.json();
        return [];
    } catch (e) {
        return [];
    }
  },

  saveAddresses: async (addresses: Partial<WMSAddress>[]) => {
      try {
          const response = await fetch(`${API_BASE_URL}/save-addresses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(addresses)
          });
          return await response.json();
      } catch (e) {
          return { success: false };
      }
  },

  // --- WAREHOUSE MANAGEMENT ---
  getWarehouses: async (): Promise<Warehouse[]> => {
      try {
          const response = await fetch(`${API_BASE_URL}/warehouses`);
          if (response.ok) return await response.json();
          return [];
      } catch (e) {
          return [];
      }
  },

  saveWarehouse: async (warehouse: Partial<Warehouse>) => {
      try {
          const response = await fetch(`${API_BASE_URL}/save-warehouse`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(warehouse)
          });
          return await response.json();
      } catch (e) {
          return { success: false };
      }
  },

  deleteWarehouse: async (id: number) => {
      try {
          await fetch(`${API_BASE_URL}/delete-warehouse`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id })
          });
          return true;
      } catch (e) {
          return false;
      }
  },

  // --- LAYOUT METHODS ---
  getLayout: async (): Promise<WarehouseLayout | null> => {
      try {
          const response = await fetch(`${API_BASE_URL}/layout`);
          if (response.ok) return await response.json();
          return null;
      } catch (e) {
          return null;
      }
  },

  saveLayout: async (layout: WarehouseLayout) => {
      try {
          const response = await fetch(`${API_BASE_URL}/save-layout`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(layout)
          });
          return await response.json();
      } catch (e) {
          return { success: false };
      }
  }
};
