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
import { api, ApiProduct } from './services/api'; // Import API Service

// Initial Data fallback (used while loading or if API fails)
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
        name: 'ITEM DEMO (Conecte o PHP)', ref: '0000', brand: 'GENERIC', balance: 0,
        lastCount: null 
      }
    ]
  }
];

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Blocks state initialized with empty/demo, will be updated by API
  const [blocks, setBlocks] = useState<Block[]>(initialBlocksData);
  
  const [segmentFilter, setSegmentFilter] = useState<string | null>(null);
  const [activeBlock, setActiveBlock] = useState<any | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // --- DATA LOADING EFFECT ---
  useEffect(() => {
    if (currentScreen !== 'login') {
      loadRealData();
    }
  }, [currentScreen]);

  const loadRealData = async () => {
    setIsLoading(true);
    // Fetch first 100 items from Firebird
    const products = await api.getProducts(1, 100);
    
    if (products.length > 0) {
      // Transformation Logic: Group Products by Location to create "Blocks"
      const groupedMap = new Map<string, any[]>();
      
      products.forEach((p: ApiProduct) => {
        // Use Location as the key. If empty, group under "ESTOQUE GERAL"
        const locationKey = p.location ? p.location.trim() : 'ESTOQUE GERAL';
        
        if (!groupedMap.has(locationKey)) {
          groupedMap.set(locationKey, []);
        }
        
        groupedMap.get(locationKey)?.push({
          id: p.id,
          name: p.name,
          ref: p.sku, // Mapping SKU to ref
          brand: p.brand,
          balance: p.balance,
          lastCount: null // API doesn't provide history yet
        });
      });

      // Convert Map to Block Array
      const realBlocks: Block[] = [];
      let idCounter = 1000;

      groupedMap.forEach((items, loc) => {
        realBlocks.push({
          id: idCounter++,
          parentRef: loc, // Title of the block is the Location
          location: loc,
          status: 'pending', // Default status for new daily meta
          date: 'Hoje',
          subcategory: items[0].brand || 'DIVERSOS', // Heuristic for category
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
    
    // Logic to handle scans (could also fetch specific item from API if needed)
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
      
      {/* Loading Indicator */}
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
