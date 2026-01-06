
export interface ApiProduct {
  id: number | string;
  name: string;
  sku: string;
  brand: string;
  balance: number;
  location: string;
  status: 'active' | 'inactive';
}

// URL do seu servidor PHP local (php -S localhost:8000)
const API_BASE_URL = 'http://localhost:8000';

export const api = {
  /**
   * Busca produtos do ERP (DATABASE.FDB) via PHP
   */
  getProducts: async (page = 1, limit = 100, search = ''): Promise<ApiProduct[]> => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search
      });
      
      const response = await fetch(`${API_BASE_URL}/get_produtos.php?${params}`);
      
      if (!response.ok) {
        throw new Error('Falha na comunicação com o servidor PHP');
      }
      
      return await response.json();
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
      // Retorna array vazio em caso de erro para não quebrar a UI
      return [];
    }
  },

  /**
   * Placeholder para futura implementação de Logs/Settings no GRIDE.FDB
   */
  saveSettings: async (settings: any) => {
    // Aqui você chamará o save_settings.php futuramente
    console.log("Salvando configurações no GRIDE.FDB:", settings);
    return true;
  }
};
