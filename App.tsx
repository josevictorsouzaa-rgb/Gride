import React, { useState, useEffect } from 'react';
import { Screen, User, Block } from './types';
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { ListScreen } from './screens/ListScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { MissionDetailScreen } from './screens/MissionDetailScreen';
import { SubcategoriesScreen } from './screens/SubcategoriesScreen';
import { TreatmentScreen } from './screens/TreatmentScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ReservedScreen } from './screens/ReservedScreen';
import { AnalyticsScreen } from './screens/AnalyticsScreen'; 
import { BottomNav } from './components/BottomNav';
import { Sidebar } from './components/Sidebar'; 
import { ScannerModal } from './components/Modals';
import { api, ApiProduct, ApiCategory } from './services/api'; 

const initialBlocksData: Block[] = [
  { 
    id: 1, 
    parentRef: 'SISTEMA', 
    location: 'Aguardando', 
    status: 'pending', 
    date: 'Hoje', 
    subcategory: 'Geral', 
    items: []
  }
];

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [blocks, setBlocks] = useState<Block[]>(initialBlocksData);
  const [categories, setCategories] = useState<ApiCategory[]>([]); // Categorias do Banco
  
  const [segmentFilter, setSegmentFilter] = useState<string | null>(null);
  const [activeBlock, setActiveBlock] = useState<any | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load Categories & Products on Login
  useEffect(() => {
    if (currentScreen !== 'login') {
      loadRealData();
    }
  }, [currentScreen]);

  const loadRealData = async () => {
    setIsLoading(true);
    try {
        // 1. Carregar Categorias
        const cats = await api.getCategories();
        
        // Verificação de segurança para evitar crash se a API falhar
        if (Array.isArray(cats)) {
            setCategories(cats);
        } else {
            console.warn("Categorias retornadas não são um array:", cats);
            setCategories([]);
        }

        // 2. Carregar Produtos
        const products = await api.getProducts(1, 100);
        
        if (Array.isArray(products) && products.length > 0) {
            const groupedMap = new Map<string, any[]>();
            
            products.forEach((p: ApiProduct) => {
                const groupKey = p.similar_id ? `SIMILAR_${p.similar_id}` : `PROD_${p.id}`;
                
                if (!groupedMap.has(groupKey)) {
                groupedMap.set(groupKey, []);
                }
                
                groupedMap.get(groupKey)?.push({
                id: p.id,
                name: p.name,
                ref: p.sku, 
                brand: p.brand,
                balance: p.balance, 
                lastCount: null,
                location: p.location,
                similar_id: p.similar_id
                });
            });

            const realBlocks: Block[] = [];
            let idCounter = 1000;

            groupedMap.forEach((items, key) => {
                const isGroup = key.startsWith('SIMILAR_');
                const firstItem = items[0];
                
                let headerTitle = isGroup 
                ? `Agrupamento Similar #${firstItem.similar_id}` 
                : firstItem.name;

                if (isGroup && items.length === 1) {
                    headerTitle = firstItem.name;
                }

                realBlocks.push({
                id: idCounter++,
                parentRef: headerTitle, 
                location: firstItem.location || 'GERAL',
                status: 'pending', 
                date: 'Hoje',
                subcategory: firstItem.brand || 'DIVERSOS', 
                items: items
                });
            });

            setBlocks(realBlocks);
        }
    } catch (error) {
        console.error("Erro crítico ao carregar dados:", error);
    } finally {
        setIsLoading(false);
    }
  };

  const reservedCount = blocks.filter(b => b.status === 'progress').length;
  
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setCurrentScreen('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentScreen('login');
  };

  const handleCategorySelect = (categoryLabel: string) => {
    setSelectedCategory(categoryLabel);
    setCurrentScreen('subcategories');
  };

  const handleSegmentSelect = (segment: string) => {
    setSegmentFilter(segment);
    setCurrentScreen('filtered_list');
  };

  const handleReserveBlock = (id: number) => {
    setBlocks(prev => prev.map(b => 
      b.id === id ? { ...b, status: 'progress' } : b
    ));
  };

  const handleStartBlock = (block: any) => {
    setActiveBlock(