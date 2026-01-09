
export type Screen = 'login' | 'dashboard' | 'list' | 'filtered_list' | 'history' | 'mission_detail' | 'subcategories' | 'treatment' | 'settings' | 'reserved' | 'analytics' | 'address_manager';

export type LayoutObjectType = 'shelf' | 'door' | 'desk' | 'wall' | 'area';

export interface LayoutObject {
  id: string;
  type: LayoutObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  qrCode?: string;
}

export interface WarehouseLayout {
  id: number;
  name: string;
  width: number;
  height: number;
  objects: LayoutObject[];
}

// --- WMS ADDRESS TYPES ---
export interface WMSAddress {
  id: number;
  code: string; // LOC-G01-R02-E05
  description: string; // Galpão 1, Rua 2, Estante 5
  type: 'shelf' | 'pallet' | 'bin';
  linkedSku?: string; // Produto vinculado (opcional)
}

export interface HistoryEntry {
  date: string;
  user: string;
  action: string;
  oldValue?: number | string;
  newValue?: number | string;
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  brand?: string;
  location?: string;
  quantity: number;
  image: string;
  status: 'pending' | 'completed' | 'issue';
  ref?: string;
  parentRef?: string;
  type?: string; // box, bag, etc.
  countedBy?: string;
  countedAt?: string;
  // Extended fields for Detail View
  costPrice?: number;
  salesPrice?: number;
  totalStockValue?: number;
  abcCategory?: 'A' | 'B' | 'C';
  history?: HistoryEntry[];
  // Novos campos do BD
  db_pro_cod?: number;
}

export interface User {
  name: string;
  id: string;
  role: string;
  avatar: string;
  isAdmin?: boolean; // Master user (Jose Victor)
  canTreat?: boolean; // Permission to treat issues
}

export interface Block {
  id: number; // Identificador único do bloco (pode ser o ID do similar principal)
  parentRef: string; // Título do Bloco (Nome do produto principal ou Similar)
  location: string;
  status: 'pending' | 'progress' | 'late' | 'completed';
  date: string;
  subcategory?: string; // Added for filtering
  items: any[];
  // Campos de Bloqueio/Reserva
  lockedBy?: {
    userId: string;
    userName: string;
    avatar?: string;
    timestamp: string;
  } | null;
}

export interface Mission {
  id: string;
  warehouse: string;
  sector: string;
  expiresIn: number; // seconds
  totalItems: number;
  completedItems: number;
  items: InventoryItem[];
}
