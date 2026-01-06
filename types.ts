
export type Screen = 'login' | 'dashboard' | 'list' | 'filtered_list' | 'history' | 'mission_detail' | 'subcategories' | 'treatment' | 'settings' | 'reserved' | 'analytics';

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
  id: number;
  parentRef: string;
  location: string;
  status: 'pending' | 'progress' | 'late' | 'completed';
  date: string;
  subcategory?: string; // Added for filtering
  items: any[];
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
