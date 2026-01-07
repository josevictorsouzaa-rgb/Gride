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
import { api, ApiProduct } from './services/api'; 

const initialBlocksData: Block[] = [
  { 
    id: 1, 
    parentRef: 'DEMO / S/REF', 
    location: 'Exemplo: Rua 04', 
    status: 'late', 
    date: 'Ontem', 
    subcategory: 'Exemplo', 
    items: [
      { 
        name: 'ITEM DEMO (Conecte o Node)', ref: '0000', brand: 'GENERIC', balance: 0,
        lastCount: null 
      }
    ]
  }
];

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [blocks, setBlocks] = useState<Block[]>(initialBlocksData);
  
  const [segmentFilter, setSegmentFilter] = useState<string | null>(null);
  const [activeBlock, setActiveBlock] = useState<any | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentScreen !== 'login') {
      loadRealData();
    }
  }, [currentScreen]);

  const loadRealData = async () => {
    setIsLoading(true);
    const products = await api.getProducts(1, 100);
    
    if (products.length > 0) {
      // Nova Lógica: Agrupar por similar_id
      const groupedMap = new Map<string, any[]>();
      
      products.forEach((p: ApiProduct) => {
        // Se tiver similar_id, usa ele como chave. Se não, usa o ID do próprio produto (grupo único)
        const groupKey = p.similar_id ? `SIMILAR_${p.similar_id}` : `PROD_${p.id}`;
        
        if (!groupedMap.has(groupKey)) {
          groupedMap.set(groupKey, []);
        }
        
        groupedMap.get(groupKey)?.push({
          id: p.id,
          name: p.name,
          ref: p.sku, 
          brand: p.brand,
          balance: p.balance, // Agora vem de PRO_EST_ATUAL
          lastCount: null,
          location: p.location,
          similar_id: p.similar_id
        });
      });

      const realBlocks: Block[] = [];
      let idCounter = 1000;

      groupedMap.forEach((items, key) => {
        // Define o título do bloco
        // Se for grupo similar, usa o nome do primeiro item + Indicador
        // Se for item único, usa o nome do item
        const isGroup = key.startsWith('SIMILAR_');
        const firstItem = items[0];
        
        let headerTitle = isGroup 
           ? `Agrupamento Similar #${firstItem.similar_id}` 
           : firstItem.name;

        // Se o agrupamento tiver apenas 1 item e for similar, pode mostrar o nome do item
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
    setIsLoading(false);
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

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
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
    setActiveBlock(block);
    setCurrentScreen('mission_detail');
  };

  const handleScanComplete = (code: string) => {
    setShowScanner(false);
    let mockBlock;
    if (code.startsWith('PRD-')) {
       mockBlock = {
          id: 901,
          contextType: 'product_scan',
          parentRef: 'ITEM ESCANEADO',
          location: 'Item Avulso',
          status: 'progress',
          items: [
            { 
              name: 'ITEM IDENTIFICADO', 
              ref: code, 
              brand: 'AUTO', 
              balance: 1,
              lastCount: null
            }
          ]
       };
    } else {
       mockBlock = {
          id: 903,
          contextType: 'location_scan',
          parentRef: 'LOCALIZAÇÃO ESCANEADA',
          location: 'Corredor Central',
          status: 'progress',
          items: []
       };
    }
    handleStartBlock(mockBlock);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'login':
        return <LoginScreen onLogin={handleLogin} />;
      case 'dashboard':
        return (
          <DashboardScreen 
            onNavigate={setCurrentScreen} 
            onCategorySelect={handleCategorySelect}
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        );
      case 'list':
        return (
          <ListScreen 
            key="meta-list" 
            onNavigate={setCurrentScreen} 
            blocks={blocks}
            segmentFilter={null}
            onReserveBlock={handleReserveBlock}
            onClearFilter={() => {}}
            mode="daily_meta"
          />
        );
      case 'filtered_list':
        return (
          <ListScreen 
            key="browse-list" 
            onNavigate={setCurrentScreen} 
            blocks={blocks}
            segmentFilter={segmentFilter}
            onReserveBlock={handleReserveBlock}
            onClearFilter={() => {
              setSegmentFilter(null);
              setCurrentScreen('dashboard'); 
            }}
            mode="browse"
          />
        );
      case 'reserved':
        return (
          <ReservedScreen 
            onNavigate={setCurrentScreen} 
            blocks={blocks}
            onStartBlock={handleStartBlock}
            currentUser={currentUser} // Passado aqui
          />
        );
      case 'history':
        return <HistoryScreen />;
      case 'analytics':
        return <AnalyticsScreen onNavigate={setCurrentScreen} />;
      case 'mission_detail':
        return (
          <MissionDetailScreen 
            blockData={activeBlock} 
            onBack={() => setCurrentScreen('reserved')}
            currentUser={currentUser} // Passado aqui
          />
        );
      case 'subcategories':
        return (
          <SubcategoriesScreen 
            category={selectedCategory || ''} 
            onBack={() => setCurrentScreen('dashboard')}
            onSelectSegment={handleSegmentSelect}
          />
        );
      case 'treatment':
        return (
           <TreatmentScreen onNavigate={setCurrentScreen} />
        );
      case 'settings':
        return (
           <SettingsScreen 
             onBack={() => setCurrentScreen('dashboard')} 
             currentUser={currentUser}
           />
        );
      default:
        return (
          <DashboardScreen 
            onNavigate={setCurrentScreen} 
            onCategorySelect={handleCategorySelect}
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        );
    }
  };

  const showNav = currentScreen !== 'login' && 
                  currentScreen !== 'mission_detail' && 
                  currentScreen !== 'settings' && 
                  currentScreen !== 'treatment' &&
                  currentScreen !== 'analytics';
  
  if (currentScreen === 'login') {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const activeNavTab = (currentScreen === 'subcategories' || currentScreen === 'filtered_list') 
    ? 'dashboard' 
    : currentScreen;

  return (
    <div className="flex w-full min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white">
      {isLoading && (
        <div className="fixed top-0 left-0 right-0 h-1 z-[100] bg-primary/20">
          <div className="h-full bg-primary animate-[shimmer_1s_infinite] w-1/3" />
        </div>
      )}

      <Sidebar 
        currentScreen={activeNavTab}
        onNavigate={setCurrentScreen}
        currentUser={currentUser}
        onLogout={handleLogout}
        reservedCount={reservedCount}
      />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto no-scrollbar relative w-full">
           <div className="w-full min-h-full">
             {renderScreen()}
           </div>
        </div>

        {showNav && (
          <BottomNav 
            currentScreen={activeNavTab} 
            onNavigate={setCurrentScreen}
            onScanClick={() => setShowScanner(true)}
            isAdmin={currentUser?.isAdmin} 
            reservedCount={reservedCount}
          />
        )}
      </div>

      <ScannerModal 
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanComplete={handleScanComplete}
        title="Escanear Código"
        instruction="Aponte para o QR Code de um Produto, Prateleira ou Estante"
      />
    </div>
  );
};

export default App;
