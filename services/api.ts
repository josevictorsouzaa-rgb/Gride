
import { User, WMSAddress, WarehouseLayout, Block, TreatmentItem } from '../types';
import { getIconByTerm, GROUP_ICONS } from '../data/categories';

export interface ApiCategory {
  id: string;
  db_id: number;
  label: string;
  icon: string;
  count: number;        // Total de Itens Ativos
  mappedCount: number;  // Itens já Inventariados
  subcategories: { 
    id: string; 
    db_id: number;
    name: string; 
    count: number;
    mappedCount: number;
    icon: string; 
  }[];
}

export interface MetaStatus {
    totalStock: number;
    mappedStock: number;
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
      return { success: false, error: 'Servidor offline.' };
    }
  },

  getCategories: async (): Promise<ApiCategory[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/categories`);
      if (!response.ok) throw new Error('Erro');
      const data: ApiCategory[] = await response.json();
      
      // Add visual icons in frontend
      return data.map(cat => ({
          ...cat,
          icon: GROUP_ICONS[cat.db_id] || 'inventory_2',
          subcategories: cat.subcategories.map(sub => ({
              ...sub,
              icon: getIconByTerm(sub.name)
          }))
      }));
    } catch (error) { return []; }
  },

  getMetaStatus: async (): Promise<MetaStatus> => {
      try {
          const response = await fetch(`${API_BASE_URL}/meta-status`);
          if (!response.ok) throw new Error('Erro');
          return await response.json();
      } catch (error) {
          return { totalStock: 0, mappedStock: 0 };
      }
  },

  getBlocks: async (page = 1, limit = 100, search = '', gr_cod?: number, sg_cod?: number, location?: string): Promise<Block[]> => {
    try {
      const params = new URLSearchParams({ 
          page: page.toString(), 
          limit: limit.toString(), 
          search,
          ...(gr_cod ? { gr_cod: gr_cod.toString() } : {}),
          ...(sg_cod ? { sg_cod: sg_cod.toString() } : {}),
          ...(location ? { location } : {})
      });
      
      const response = await fetch(`${API_BASE_URL}/blocks?${params}`);
      if (!response.ok) throw new Error('Network error');
      return await response.json();
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  getReservedBlocks: async (userId: string): Promise<Block[]> => {
      try {
          const response = await fetch(`${API_BASE_URL}/reserved-blocks/${userId}`);
          if (response.ok) return await response.json();
          return [];
      } catch (e) { return []; }
  },

  reserveBlock: async (blockId: number | string, user: User): Promise<{ success: boolean; message?: string }> => {
      try {
          const response = await fetch(`${API_BASE_URL}/reserve-block`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ block_id: blockId, user_id: user.id, user_name: user.name })
          });
          return await response.json();
      } catch (e) { return { success: false, message: 'Erro de conexão' }; }
  },

  updateReservationProgress: async (blockId: number, items: any[]): Promise<{ success: boolean }> => {
      try {
          const response = await fetch(`${API_BASE_URL}/update-reservation-progress`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ block_id: blockId, items })
          });
          return await response.json();
      } catch (e) { return { success: false }; }
  },

  finalizeBlock: async (data: any): Promise<{ success: boolean }> => {
      try {
          const response = await fetch(`${API_BASE_URL}/finalize-block`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
          });
          return await response.json();
      } catch (e) { return { success: false }; }
  },

  releaseBlock: async (blockId: number): Promise<{ success: boolean }> => {
      try {
          const response = await fetch(`${API_BASE_URL}/release-block`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ block_id: blockId })
          });
          return await response.json();
      } catch (e) { return { success: false }; }
  },

  getHistory: async (page = 1, limit = 50): Promise<any[]> => {
      try {
          const response = await fetch(`${API_BASE_URL}/history`);
          if (response.ok) return await response.json();
          return [];
      } catch (e) { return []; }
  },

  getProductHistory: async (sku: string): Promise<any[]> => {
      return []; // Not used in this simplified version yet
  },

  getTreatmentItems: async (): Promise<TreatmentItem[]> => [],
  
  resolveTreatment: async (id: number, note: string, user: string, action: string): Promise<boolean> => true,
  
  saveCount: async (data: {
      sku: string;
      nome_produto: string;
      usuario_id: string;
      usuario_nome: string;
      qtd_sistema: number;
      qtd_contada: number;
      localizacao: string;
      status: string;
      divergencia_motivo?: string;
  }): Promise<{ success: boolean }> => ({ success: true }),
  
  updateCount: async (data: {
      logId: number;
      sku: string;
      newQty: number;
      oldQty: number;
      user_name: string;
      user_id: string;
  }): Promise<{ success: boolean }> => ({ success: true }),
  
  getAddresses: async (): Promise<WMSAddress[]> => [],
  
  saveAddresses: async (addresses: Partial<WMSAddress>[]): Promise<{ success: boolean, count: number, skipped: number }> => ({ success: true, count: 0, skipped: 0 }),
  
  getWarehouses: async (): Promise<Warehouse[]> => [],
  
  saveWarehouse: async (data: { sigla: string; descricao: string }): Promise<{ success: boolean; message?: string }> => ({ success: true }),
  
  deleteWarehouse: async (id: number): Promise<{ success: boolean }> => ({ success: true }),
  
  getLayout: async (): Promise<WarehouseLayout | null> => null,
  
  saveLayout: async (layout: WarehouseLayout): Promise<boolean> => true,
  
  getUsers: async (): Promise<User[]> => []
};
