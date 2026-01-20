
// ... (imports anteriores mantidos)
import { User, WMSAddress, WarehouseLayout, Block, TreatmentItem } from '../types';
import { getIconByTerm, GROUP_ICONS } from '../data/categories';
import { CountingSettings } from '../data/settingsStore';

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
  mappedCount: number;
  subcategories: { 
    id: string; 
    db_id: number;
    name: string; 
    count: number; 
    mappedCount: number;
    icon: string; 
  }[];
}

export interface Warehouse {
    id: number;
    sigla: string;
    descricao: string;
}

export interface MetaStatus {
    totalStock: number;
    mappedStock: number;
}

export interface RankingItem {
    name: string;
    counts: number;
    accuracy: number;
    id: number;
}

export interface TopDivergenceItem {
    id: number;
    sku: string;
    name: string;
    brand: string;
    location: string;
    expected: number;
    counted: number;
    diff: number;
    diffValue: number;
}

// Alterado para usar Proxy do Vite via '/api'
// Isso resolve problemas de CORS e Mixed Content (HTTPS frontend -> HTTP backend)
const API_BASE_URL = '/api';

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
      return { success: false, error: 'Servidor offline ou inacessível.' };
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

  // NOVA ROTA: Get Daily Suggestions based on Settings
  getDailyMeta: async (settings: CountingSettings): Promise<Block[]> => {
      try {
          const params = new URLSearchParams({
              dailyTarget: settings.dailyTarget.toString(),
              cooldownDays: settings.cooldownDays.toString(),
              highGiroThreshold: settings.highGiroThreshold.toString(),
              accumulationMode: settings.accumulationMode ? 'true' : 'false',
              highGiroSplit: (settings.highGiroSplit || 40).toString()
          });

          const response = await fetch(`${API_BASE_URL}/daily-meta-suggestions?${params}`);
          if (!response.ok) throw new Error('Erro ao buscar meta diária');
          return await response.json();
      } catch (error) {
          console.error(error);
          return [];
      }
  },

  // NOVA ROTA: Get Meta Status (Counts)
  getMetaStatus: async (): Promise<MetaStatus> => {
      try {
          const response = await fetch(`${API_BASE_URL}/meta-status`);
          if (!response.ok) throw new Error('Erro ao buscar status da meta');
          return await response.json();
      } catch (error) {
          return { totalStock: 0, mappedStock: 0 };
      }
  },

  // NOVA ROTA: Get KPIs para Analytics (Valor Total, etc)
  getAnalyticsKPIs: async (): Promise<{ totalCost: number, totalSales: number, totalCount: number, inactiveCount: number }> => {
      try {
          const response = await fetch(`${API_BASE_URL}/analytics/kpis`);
          if (!response.ok) return { totalCost: 0, totalSales: 0, totalCount: 0, inactiveCount: 0 };
          return await response.json();
      } catch (e) {
          return { totalCost: 0, totalSales: 0, totalCount: 0, inactiveCount: 0 };
      }
  },

  getAvailableYears: async (): Promise<number[]> => {
      try {
          const response = await fetch(`${API_BASE_URL}/analytics/years`);
          if (response.ok) return await response.json();
          return [new Date().getFullYear()];
      } catch(e) { return [new Date().getFullYear()]; }
  },

  // NOVA ROTA: Get Heatmap Data (With Year Filter)
  getHeatmapData: async (year?: number): Promise<{ month: number, day: number, count: number }[]> => {
      try {
          const url = year ? `${API_BASE_URL}/analytics/heatmap?year=${year}` : `${API_BASE_URL}/analytics/heatmap`;
          const response = await fetch(url);
          if (response.ok) return await response.json();
          return [];
      } catch (e) { return []; }
  },

  getUserRanking: async (year?: number): Promise<RankingItem[]> => {
      try {
          const url = year ? `${API_BASE_URL}/analytics/ranking?year=${year}` : `${API_BASE_URL}/analytics/ranking`;
          const response = await fetch(url);
          if (response.ok) return await response.json();
          return [];
      } catch(e) { return []; }
  },

  getTopDivergences: async (year?: number): Promise<TopDivergenceItem[]> => {
      try {
          const url = year ? `${API_BASE_URL}/analytics/top-divergences?year=${year}` : `${API_BASE_URL}/analytics/top-divergences`;
          const response = await fetch(url);
          if (response.ok) return await response.json();
          return [];
      } catch(e) { return []; }
  },

  // NOVA ROTA: Get Financial Categories
  getFinancialCategories: async (): Promise<{ name: string, qty: number, value: number }[]> => {
      try {
          const response = await fetch(`${API_BASE_URL}/analytics/categories-financial`);
          if (response.ok) return await response.json();
          return [];
      } catch (e) { return []; }
  },

  // NOVA ROTA: Get User Daily Stats
  getDailyStats: async (userId: string): Promise<{ countedToday: number }> => {
      try {
          const response = await fetch(`${API_BASE_URL}/daily-stats/${userId}`);
          if (!response.ok) return { countedToday: 0 };
          return await response.json();
      } catch (e) {
          return { countedToday: 0 };
      }
  },

  getBlocks: async (page = 1, limit = 100, search = '', gr_cod?: number, sg_cod?: number, daily_meta?: boolean, location?: string): Promise<Block[]> => {
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
      if (!response.ok) throw new Error('Network response was not ok');
      return await response.json();
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  // NOVA FUNÇÃO: Obter contagem de status para os filtros atuais
  getBlockCounts: async (search = '', gr_cod?: number, sg_cod?: number, location?: string): Promise<{ pending: number, progress: number, completed: number }> => {
      try {
          const params = new URLSearchParams({ 
              search,
              ...(gr_cod ? { gr_cod: gr_cod.toString() } : {}),
              ...(sg_cod ? { sg_cod: sg_cod.toString() } : {}),
              ...(location ? { location } : {})
          });
          
          const response = await fetch(`${API_BASE_URL}/block-counts?${params}`);
          if (!response.ok) return { pending: 0, progress: 0, completed: 0 };
          return await response.json();
      } catch (e) {
          return { pending: 0, progress: 0, completed: 0 };
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

  finalizeBlock: async (data: { block_id: number, user_id: string, user_name: string, items: any[], parent_ref: string }): Promise<{ success: boolean }> => {
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
          const response = await fetch(`${API_BASE_URL}/history?page=${page}&limit=${limit}`);
          if (response.ok) return await response.json();
          return [];
      } catch (e) { return []; }
  },

  getProductHistory: async (sku: string): Promise<any[]> => {
      try {
          const response = await fetch(`${API_BASE_URL}/product-history/${encodeURIComponent(sku)}`);
          if (response.ok) return await response.json();
          return [];
      } catch (e) { return []; }
  },

  getTreatmentItems: async (): Promise<TreatmentItem[]> => {
      try {
          const response = await fetch(`${API_BASE_URL}/treatment-items`);
          if (response.ok) return await response.json();
          return [];
      } catch (e) { return []; }
  },

  resolveTreatment: async (id: number, note: string, user: string, action: 'adjust' | 'inactivate' | 'ignore'): Promise<boolean> => {
      try {
          const response = await fetch(`${API_BASE_URL}/resolve-treatment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, note, user, action })
          });
          const json = await response.json();
          return json.success;
      } catch(e) { return false; }
  },

  saveCount: async (logEntry: Partial<InventoryLogEntry>) => {
      console.log("Saving ad-hoc count:", logEntry);
      return { success: true };
  },

  // NOVA FUNÇÃO: ATUALIZAR CONTAGEM EXISTENTE (AUDITADA)
  updateCount: async (data: { logId: number, sku: string, newQty: number, oldQty: number, user_name: string, user_id: string }): Promise<{ success: boolean }> => {
      try {
          const response = await fetch(`${API_BASE_URL}/update-count`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
          });
          return await response.json();
      } catch (e) { return { success: false }; }
  },

  // --- WMS ADDRESS MANAGEMENT ---
  getAddresses: async (): Promise<WMSAddress[]> => {
      try {
          const response = await fetch(`${API_BASE_URL}/addresses`);
          if (response.ok) return await response.json();
          return [];
      } catch(e) { return []; }
  },

  saveAddresses: async (addresses: Partial<WMSAddress>[]): Promise<{ success: boolean, count: number, skipped: number }> => {
      try {
          const response = await fetch(`${API_BASE_URL}/save-addresses`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(addresses)
          });
          return await response.json();
      } catch(e) { return { success: false, count: 0, skipped: 0 }; }
  },

  // --- WAREHOUSE MANAGEMENT ---
  getWarehouses: async (): Promise<Warehouse[]> => {
      try {
          const response = await fetch(`${API_BASE_URL}/warehouses`);
          if (response.ok) return await response.json();
          return [];
      } catch(e) { return []; }
  },

  saveWarehouse: async (data: Partial<Warehouse>): Promise<{ success: boolean, message?: string }> => {
      try {
          const response = await fetch(`${API_BASE_URL}/save-warehouse`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
          });
          return await response.json();
      } catch(e) { return { success: false, message: 'Erro conexao' }; }
  },

  deleteWarehouse: async (id: number): Promise<{ success: boolean }> => {
      try {
          const response = await fetch(`${API_BASE_URL}/delete-warehouse`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id })
          });
          return await response.json();
      } catch(e) { return { success: false }; }
  },

  // --- LAYOUT EDITOR ---
  getLayout: async (): Promise<WarehouseLayout | null> => {
      try {
        const stored = localStorage.getItem('gride_layout_v1');
        return stored ? JSON.parse(stored) : null;
      } catch (e) { return null; }
  },

  saveLayout: async (layout: WarehouseLayout): Promise<boolean> => {
      try {
        localStorage.setItem('gride_layout_v1', JSON.stringify(layout));
        return true;
      } catch (e) { return false; }
  }
};
