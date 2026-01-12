
import { User, WMSAddress, WarehouseLayout, Block, TreatmentItem } from '../types';
import { getIconByTerm, GROUP_ICONS } from '../data/categories';

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
    db_id: number;
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
      const data: ApiCategory[] = await response.json();
      
      // Enforce frontend icons mapping for better visual representation
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

  getBlocks: async (page = 1, limit = 100, search = '', gr_cod?: number, sg_cod?: number, daily_meta?: boolean, location?: string): Promise<Block[]> => {
    try {
      const params = new URLSearchParams({ 
          page: page.toString(), 
          limit: limit.toString(), 
          search 
      });
      if (gr_cod) params.append('gr_cod', gr_cod.toString());
      if (sg_cod) params.append('sg_cod', sg_cod.toString());
      if (daily_meta) params.append('daily_meta', 'true');
      if (location) params.append('location', location); 

      const response = await fetch(`${API_BASE_URL}/blocks?${params}`);
      if (!response.ok) throw new Error('Erro blocks');
      return await response.json();
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  getReservedBlocks: async (userId: string): Promise<Block[]> => {
      try {
          const response = await fetch(`${API_BASE_URL}/reserved-blocks/${userId}`);
          if (!response.ok) throw new Error('Erro ao buscar reservados');
          return await response.json();
      } catch (e) { 
          console.error(e);
          return []; 
      }
  },

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

  // NOVA FUNÇÃO: Atualizar progresso sem finalizar
  updateReservationProgress: async (blockId: number | string, items: any[]) => {
      try {
          await fetch(`${API_BASE_URL}/update-reservation-progress`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ block_id: blockId, items: items })
          });
          return { success: true };
      } catch (e) { return { success: false }; }
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

  // saveCount REMOVIDO/DEPRECADO para este fluxo (usado apenas em ad-hoc se necessário, mas aqui controlamos tudo pelo finalize)
  saveCount: async (data: InventoryLogEntry) => {
    // Mantido apenas para compatibilidade com MissionDetailScreen se ainda usar
    try {
      await fetch(`${API_BASE_URL}/save-count`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      return { success: true };
    } catch (error) { return { success: false }; }
  },

  getHistory: async (page = 1, limit = 30) => {
    try {
      const response = await fetch(`${API_BASE_URL}/history?page=${page}&limit=${limit}`);
      if (!response.ok) throw new Error('Erro');
      return await response.json();
    } catch (error) { return []; }
  },

  getProductHistory: async (sku: string) => {
      try {
          const response = await fetch(`${API_BASE_URL}/product-history/${sku}`);
          if (!response.ok) throw new Error('Erro');
          return await response.json();
      } catch (e) { return []; }
  },

  // --- TRATAMENTO ---
  getTreatmentItems: async (): Promise<TreatmentItem[]> => {
      try {
          const response = await fetch(`${API_BASE_URL}/treatment-items`);
          if (response.ok) return await response.json();
          return [];
      } catch (e) { return []; }
  },

  resolveTreatment: async (id: number, resolution: string, userId: string, action: 'adjust' | 'inactivate' | 'ignore') => {
      try {
          const response = await fetch(`${API_BASE_URL}/resolve-treatment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, resolution, userId, action })
          });
          return await response.json();
      } catch (e) { return { success: false }; }
  },

  // --- ADDRESS & WAREHOUSE ---
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

  getLayout: async (): Promise<WarehouseLayout | null> => { return null; },
  saveLayout: async (layout: WarehouseLayout) => { return { success: true }; },
  
  getProducts: async () => { return []; } 
};
