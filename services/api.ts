
export interface ApiProduct {
  id: number | string;
  name: string;
  sku: string;
  brand: string;
  balance: number;
  location: string;
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

// ATENÇÃO: Troque pelo IP da sua máquina na rede local para funcionar no celular
// Exemplo: 'http://192.168.0.15:8000'
const API_BASE_URL = 'http://localhost:8000'; 

export const api = {
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
