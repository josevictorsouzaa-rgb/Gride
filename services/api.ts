import { User, Block, WarehouseLayout, WMSAddress, TreatmentItem } from '../types';

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

const BASE_URL = '/api';

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
      const res = await fetchJson(`/users/name/${code}`);
      return res?.name || null;
  },
  
  login: async (code: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
      const res = await postJson('/login', { code, password });
      return res || { success: false, error: 'Connection error' };
  },

  getMetaStatus: async (): Promise<MetaStatus> => {
      const res = await fetchJson('/meta/status');
      return res || { totalStock: 0, mappedStock: 0 };
  },

  getCategories: async (): Promise<ApiCategory[]> => {
      const res = await fetchJson('/categories');
      return res || [];
  },

  getHistory: async (page: number, limit: number): Promise<any[]> => {
      const res = await fetchJson(`/history?page=${page}&limit=${limit}`);
      return res || [];
  },

  updateCount: async (data: { logId: number, sku: string, newQty: number, oldQty: number, user_name: string, user_id: string }): Promise<{ success: boolean }> => {
      const res = await postJson('/history/update', data);
      return res || { success: false };
  },

  saveCount: async (data: any) => {
      return postJson('/counts', data);
  },

  getUsers: async (): Promise<User[]> => {
      const res = await fetchJson('/users');
      return res || [];
  },

  getReservedBlocks: async (userId: string): Promise<Block[]> => {
      const res = await fetchJson(`/blocks/reserved/${userId}`);
      return res || [];
  },

  getTreatmentItems: async (): Promise<TreatmentItem[]> => {
      const res = await fetchJson('/treatment');
      return res || [];
  },

  getBlocks: async (page: number, limit: number, search: string = '', gr?: number, sg?: number, isLocSearch: boolean = false, loc?: string): Promise<Block[]> => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      if (search) params.append('search', search);
      if (gr) params.append('gr', gr.toString());
      if (sg) params.append('sg', sg.toString());
      if (loc) params.append('loc', loc);
      
      const res = await fetchJson(`/blocks?${params.toString()}`);
      return res || [];
  },

  getBlockCounts: async (search: string = '', gr?: number, sg?: number, loc?: string) => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (gr) params.append('gr', gr.toString());
      if (sg) params.append('sg', sg.toString());
      if (loc) params.append('loc', loc);

      const res = await fetchJson(`/blocks/counts?${params.toString()}`);
      return res || { pending: 0, progress: 0, completed: 0 };
  },

  reserveBlock: async (id: number | string, user: User): Promise<{ success: boolean; message?: string }> => {
      const res = await postJson(`/blocks/${id}/reserve`, { userId: user.id, userName: user.name });
      return res || { success: false, message: 'Connection Error' };
  },

  updateReservationProgress: async (blockId: number, items: any[]) => {
      return postJson(`/blocks/${blockId}/progress`, { items });
  },

  finalizeBlock: async (data: { block_id: number, user_id: string, user_name: string, items: any[], parent_ref: string }) => {
      return postJson(`/blocks/finalize`, data);
  },

  releaseBlock: async (id: number) => {
      return postJson(`/blocks/${id}/release`, {});
  },

  resolveTreatment: async (id: number, note: string, user: string, action: string) => {
      return postJson(`/treatment/${id}/resolve`, { note, user, action });
  },

  getAnalyticsKPIs: async () => {
      const res = await fetchJson('/analytics/kpis');
      return res || { totalCost: 0, totalSales: 0, totalCount: 0, inactiveCount: 0 };
  },

  getFinancialCategories: async (): Promise<ApiFinancialGroup[]> => {
      const res = await fetchJson('/analytics/financial-groups');
      return res || [];
  },

  getAvailableYears: async (): Promise<number[]> => {
      const res = await fetchJson('/analytics/years');
      return res || [new Date().getFullYear()];
  },

  getHeatmapData: async (year: number): Promise<{ month: number, day: number, count: number }[]> => {
      const res = await fetchJson(`/analytics/heatmap/${year}`);
      return res || [];
  },

  getUserRanking: async (year: number): Promise<RankingItem[]> => {
      const res = await fetchJson(`/analytics/ranking/${year}`);
      return res || [];
  },

  getTopDivergences: async (year: number): Promise<TopDivergenceItem[]> => {
      const res = await fetchJson(`/analytics/divergences/${year}`);
      return res || [];
  },

  getFinancialItems: async (grId: number, sgId: number): Promise<ApiFinancialItem[]> => {
      const res = await fetchJson(`/analytics/financial-items?gr_cod=${grId}&sg_cod=${sgId}`);
      return res || [];
  },

  getProductHistory: async (sku: string): Promise<any[]> => {
      const res = await fetchJson(`/products/${sku}/history`);
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
      return postJson('/addresses', { addresses });
  },

  getWarehouses: async (): Promise<Warehouse[]> => {
      const res = await fetchJson('/warehouses');
      return res || [];
  },

  saveWarehouse: async (data: { sigla: string, descricao: string }) => {
      return postJson('/warehouses', data);
  },

  deleteWarehouse: async (id: number) => {
      return deleteJson(`/warehouses/${id}`);
  }
};
