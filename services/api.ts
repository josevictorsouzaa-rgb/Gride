
import { User, Block, WarehouseLayout, WMSAddress, TreatmentItem, UserPermissions } from '../types';
import { getIconByTerm, GROUP_ICONS } from '../data/categories';

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

export interface MetaStatus {
  totalStock: number;
  mappedStock: number;
  cycleName?: string;
}

export interface Cycle {
    id: number;
    name: string;
    startDate: string;
    endDate?: string;
    active: boolean;
}

export interface CyclePerformance {
    totalCount: number;
    accuracy: number;
    divergenceCount: number;
    chartData: { date: string, count: number }[];
}

export interface ReportOptions {
    cycleId: number | string;
    statuses: string[];
    users: string[];
    columns: string[];
}

export interface RankingItem {
  name: string;
  counts: number;
}

export interface TopDivergenceItem {
  id: number;
  sku: string;
  name: string;
  location: string;
  user: string;
  counted: number;
  expected: number;
  diff: number;
  diffValue: number;
  costPrice: number;
  salesPrice: number;
}

export interface ApiFinancialItem {
    sku: string;
    name: string;
    qty: number;
    unitPrice: number;
    value: number;
}

export interface ApiFinancialSubgroup {
    id: number;
    name: string;
    qty: number;
    value: number;
}

export interface ApiFinancialGroup {
    id: number;
    name: string;
    qty: number;
    value: number;
    subgroups: ApiFinancialSubgroup[];
}

export interface Warehouse {
    id: number;
    sigla: string;
    descricao: string;
}

const BASE_URL = 'http://gride.local:8000';

const fetchJson = async (url: string, options?: RequestInit) => {
    try {
        const response = await fetch(`${BASE_URL}${url}`, options);
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`API Call failed: ${url}`, error);
        return null; 
    }
};

const postJson = async (url: string, data: any) => {
    return fetchJson(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
};

const deleteJson = async (url: string) => {
    return fetchJson(url, {
        method: 'DELETE'
    });
};

export const api = {
  getUserName: async (code: string): Promise<string | null> => {
      const res = await fetchJson(`/user-name/${code}`);
      return res?.name || null;
  },
  
  login: async (code: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
      try {
          const response = await fetch(`${BASE_URL}/login`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({ usuario_id: code, senha: password })
          });

          const data = await response.json().catch(() => null);

          if (response.ok) {
              return data;
          } else {
              if (data && data.error) {
                  return { success: false, error: data.error };
              }
              return { success: false, error: `Erro ${response.status}: Falha na autenticação` };
          }
      } catch (e) {
          console.error("Login Request Failed", e);
          return { success: false, error: 'Erro de conexão com o servidor. Verifique se ele está rodando.' };
      }
  },

  getMetaStatus: async (): Promise<MetaStatus> => {
      const res = await fetchJson('/meta-status');
      return res || { totalStock: 0, mappedStock: 0, cycleName: '' };
  },

  // --- MÉTODOS DE CICLOS & ANALYTICS AVANÇADO ---
  getCycles: async (): Promise<Cycle[]> => {
      const res = await fetchJson('/cycles');
      return res || [];
  },

  startNewCycle: async (name: string): Promise<{success: boolean, error?: string}> => {
      return postJson('/cycles', { name });
  },

  getCyclePerformance: async (cycleId: number): Promise<CyclePerformance | null> => {
      const res = await fetchJson(`/analytics/cycle-performance/${cycleId}`);
      return res;
  },

  generateReport: async (options: ReportOptions): Promise<any[]> => {
      const res = await postJson('/reports/generate', options);
      return res || [];
  },
  // ---------------------------------------------

  getCategories: async (): Promise<ApiCategory[]> => {
      const res = await fetchJson('/categories');
      if (!res) return [];
      return res.map((cat: any) => ({
          ...cat,
          icon: GROUP_ICONS[cat.db_id] || 'inventory_2',
          subcategories: cat.subcategories.map((sub: any) => ({
              ...sub,
              icon: getIconByTerm(sub.name)
          }))
      }));
  },

  getHistory: async (page: number, limit: number): Promise<any[]> => {
      const res = await fetchJson(`/history?page=${page}&limit=${limit}`);
      return res || [];
  },

  saveCount: async (data: any) => {
      return { success: true };
  },

  getUsers: async (): Promise<User[]> => {
      const res = await fetchJson('/users');
      return res || [];
  },

  updateUserPermissions: async (id: string, active: boolean, permissions: UserPermissions): Promise<{success: boolean, error?: string}> => {
      return postJson('/update-user-permissions', { id, active, permissions });
  },

  getReservedBlocks: async (userId: string): Promise<Block[]> => {
      const res = await fetchJson(`/reserved-blocks/${userId}`);
      return res || [];
  },

  getTreatmentItems: async (): Promise<TreatmentItem[]> => {
      const res = await fetchJson('/treatment-items');
      return res || [];
  },

  getBlocks: async (page: number, limit: number, search: string = '', gr?: number, sg?: number, isLocSearch: boolean = false, loc?: string): Promise<Block[]> => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      if (search) params.append('search', search);
      if (gr) params.append('gr_cod', gr.toString());
      if (sg) params.append('sg_cod', sg.toString());
      if (loc) params.append('location', loc);
      
      const res = await fetchJson(`/blocks?${params.toString()}`);
      return res || [];
  },

  getBlockCounts: async (search: string = '', gr?: number, sg?: number, loc?: string) => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (gr) params.append('gr_cod', gr.toString());
      if (sg) params.append('sg_cod', sg.toString());
      if (loc) params.append('location', loc);

      const res = await fetchJson(`/block-counts?${params.toString()}`);
      return res || { pending: 0, progress: 0, completed: 0 };
  },

  reserveBlock: async (id: number | string, user: User): Promise<{ success: boolean; message?: string }> => {
      const res = await postJson(`/reserve-block`, { block_id: id, user_id: user.id, user_name: user.name });
      return res || { success: false, message: 'Connection Error' };
  },

  updateReservationProgress: async (blockId: number, items: any[]) => {
      return postJson(`/update-reservation-progress`, { block_id: blockId, items });
  },

  finalizeBlock: async (data: { block_id: number, user_id: string, user_name: string, items: any[], parent_ref: string }) => {
      return postJson(`/finalize-block`, data);
  },

  releaseBlock: async (id: number) => {
      return postJson(`/release-block`, { block_id: id });
  },

  resolveTreatment: async (id: number, note: string, user: string, action: string) => {
      return postJson(`/resolve-treatment`, { id, note, user, action });
  },

  getAnalyticsKPIs: async () => {
      const res = await fetchJson('/analytics/kpis');
      return res || { totalCost: 0, totalSales: 0, totalCount: 0, inactiveCount: 0 };
  },

  getFinancialCategories: async (): Promise<ApiFinancialGroup[]> => {
      const res = await fetchJson('/analytics/categories-financial');
      return res || [];
  },

  getAvailableYears: async (): Promise<number[]> => {
      const res = await fetchJson('/analytics/years');
      return res || [new Date().getFullYear()];
  },

  getHeatmapData: async (year: number): Promise<{ month: number, day: number, count: number }[]> => {
      const res = await fetchJson(`/analytics/heatmap?year=${year}`);
      return res || [];
  },

  getUserRanking: async (year: number): Promise<RankingItem[]> => {
      const res = await fetchJson(`/analytics/ranking?year=${year}`);
      return res || [];
  },

  getTopDivergences: async (year: number): Promise<TopDivergenceItem[]> => {
      const res = await fetchJson(`/analytics/top-divergences?year=${year}`);
      return res || [];
  },

  getFinancialItems: async (grId: number, sgId: number): Promise<ApiFinancialItem[]> => {
      const res = await fetchJson(`/analytics/financial-items?gr_cod=${grId}&sg_cod=${sgId}`);
      return res || [];
  },

  getProductHistory: async (sku: string): Promise<any[]> => {
      const res = await fetchJson(`/product-history/${encodeURIComponent(sku)}`);
      return res || [];
  },

  getLayout: async (): Promise<WarehouseLayout | null> => {
      const res = await fetchJson('/layout'); 
      return res || null;
  },

  saveLayout: async (layout: WarehouseLayout) => {
      return postJson('/layout', layout);
  },

  getAddresses: async (): Promise<WMSAddress[]> => {
      const res = await fetchJson('/addresses');
      return res || [];
  },

  saveAddresses: async (addresses: Partial<WMSAddress>[]) => {
      return postJson('/save-addresses', addresses);
  },

  getWarehouses: async (): Promise<Warehouse[]> => {
      const res = await fetchJson('/warehouses');
      return res || [];
  },

  saveWarehouse: async (data: { sigla: string, descricao: string }) => {
      return postJson('/save-warehouse', data);
  },

  deleteWarehouse: async (id: number) => {
      return postJson(`/delete-warehouse`, { id });
  }
};
