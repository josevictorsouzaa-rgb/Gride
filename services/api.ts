
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

export interface MetaStatus {
    dailyTarget: number;
    countedToday: number;
    accumulatedPending: number;
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

  // NOVA ROTA: Get Daily Suggestions based on Settings
  getDailyMeta: async (settings: CountingSettings): Promise<Block[]> => {
      try {
          const params = new URLSearchParams({
              dailyTarget: settings.dailyTarget.toString(),
              cooldownDays: settings.cooldownDays.toString(),
              highGiroThreshold: settings.highGiroThreshold.toString(),
              accumulationMode: settings.accumulationMode ? 'true' : 'false'
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
  getMetaStatus: async (dailyTarget: number): Promise<MetaStatus> => {
      try {
          const response = await fetch(`${API_BASE_URL}/meta-status?target=${dailyTarget}`);
          if (!response.ok) throw new Error('Erro ao buscar status da meta');
          return await response.json();
      } catch (error) {
          return { dailyTarget, countedToday: 0, accumulatedPending: 0 };
      }
  },

  getBlocks: async (page = 1, limit = 100, search = '', gr_cod?: number, sg_cod?: number, daily_meta?: boolean, location?: string): Promise<Block[]> => {
    try {
      const params = new URLSearchParams({ 
          page: page.toString(), 
          limit: limit.toString(), 
          search 