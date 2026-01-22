
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
  history?: HistoryEntry[];
}

export interface UserPermissions {
  treatment: boolean;
  analytics: boolean;
  addressing: boolean;
  settings: boolean;
}

export interface User {
  name: string;
  id: string;
  role: string;
  avatar: string;
  isAdmin?: boolean; // Mantido para compatibilidade, mas o foco agora são as permissions
  canTreat?: boolean; // Deprecated, use permissions.treatment
  active: boolean;    // Bloqueio de usuário
  permissions: UserPermissions;
}

export interface Block {
  id: number;
  parentRef: string;
  location: string;
  status: 'pending' | 'progress' | 'late' | 'completed' | 'treatment_pending';
  date: string;
  subcategory?: string; // Added for filtering
  items: any[];
  lockedBy?: {
    userId: string;
    userName: string;
    timestamp: string;
  };
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

export interface TreatmentItem {
  id: number;
  sku: string;
  name: string;
  location: string;
  issueType: 'not_located' | 'divergence_info';
  description: string;
  reportedBy: string;
  reportedAt: string; // ISO Date
  status: 'PENDING' | 'RESOLVED';
  leadTimeHours?: number; // Calculado no front ou back
}
