
import React, { useState, useEffect, useCallback } from 'react';
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
import { AddressManagerScreen } from './screens/AddressManagerScreen'; 
import { BottomNav } from './components/BottomNav';
import { Sidebar } from './components/Sidebar'; 
import { ScannerModal } from './components/Modals';
import { Icon } from './components/Icon'; 
import { api, ApiCategory } from './services/api'; 

const initialBlocksData: Block[] = [];
const INACTIVITY_LIMIT = 15 * 60 * 1000;

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [blocks, setBlocks] = useState<Block[]>(initialBlocksData);
  const [categories, setCategories] = useState<ApiCategory[]>([]); 
  
  const [segmentFilter, setSegmentFilter] = useState<string | null>(null);
  const [activeBlock, setActiveBlock] = useState<any | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    setCurrentScreen('login');
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setCurrentScreen('dashboard');
  };

  useEffect(() => {
    if (currentScreen === 'login') return;
    let timeoutId: any;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => { handleLogout(); alert("Sessão expirada."); }, INACTIVITY_LIMIT);
    };
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    resetTimer();
    events.forEach(event => window.addEventListener(event, resetTimer));
    return () => { clearTimeout(timeoutId); events.forEach(event => window.removeEventListener(event, resetTimer)); };
  }, [currentScreen, handleLogout]);

  useEffect(() => {
    if (currentScreen !== 'login') {
      loadRealData();
    }
  }, [currentScreen]);

  const loadRealData = async () => {
    setIsLoading(true);
    try {
        const cats = await api.getCategories();
        setCategories(cats || []);

        // AGORA BUSCA BLOCOS JÁ AGRUPADOS E COM STATUS DE RESERVA DO BACKEND
        const fetchedBlocks = await api.getBlocks(1, 200); // Carrega 200 blocos
        if (fetchedBlocks && Array.isArray(fetchedBlocks)) {
            setBlocks(fetchedBlocks);
        }
    } catch (error) {
        console.error("Erro crítico ao carregar dados:", error);
    } finally {
        setIsLoading(false);
    }
  };

  const reservedCount = blocks.filter(b => b.status === 'progress' && (!b.lockedBy || b.lockedBy.userId === currentUser?.id)).length;
  
  const handleCategorySelect = (categoryLabel: string) => {
    setSelectedCategory(categoryLabel);
    setCurrentScreen('subcategories');
  };

  const handleSegmentSelect = (segment: string) => {
    setSegmentFilter(segment);
    setCurrentScreen('filtered_list');
  };

  const handleReserveBlock = async (id: number) => {
    if (!currentUser) return;
    const res = await api.reserveBlock(id, currentUser);
    if (res.success) {
        // Atualiza localmente para refletir o bloqueio imediatamente
        setBlocks(prev => prev.map(b => 
          b.id === id ? { 
              ...b, 
              status: 'progress', 
              lockedBy: { userId: currentUser.id, userName: currentUser.name, timestamp: new Date().toISOString() } 
          } : b
        ));
    } else {
        alert(res.message || 'Erro ao reservar.');
        loadRealData(); // Recarrega para ver status real
    }
  };

  const handleStartBlock = (block: any) => {
    setActiveBlock(block);
    setCurrentScreen('mission_detail');
  };

  const handleScanComplete = async (code: string) => {
    setShowScanner(false);
    if (code.startsWith('LOC-')) {
       // Lógica de scan de local...
       alert(`Local ${code} scaneado. Implementar filtro.`);
       return;
    }
    // Lógica de scan de produto...
    alert(`Item ${code} scaneado.`);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'login': return <LoginScreen onLogin={handleLogin} />;
      case 'dashboard': return <DashboardScreen onNavigate={setCurrentScreen} onCategorySelect={handleCategorySelect} currentUser={currentUser} onLogout={handleLogout} categories={categories} />;
      case 'list': return <ListScreen key="meta-list" onNavigate={setCurrentScreen} blocks={blocks} segmentFilter={null} onReserveBlock={handleReserveBlock} onClearFilter={() => {}} mode="daily_meta" />;
      case 'filtered_list': return <ListScreen key="browse-list" onNavigate={setCurrentScreen} blocks={blocks} segmentFilter={segmentFilter} onReserveBlock={handleReserveBlock} onClearFilter={() => { setSegmentFilter(null); setCurrentScreen('dashboard'); }} mode="browse" />;
      case 'reserved': return <ReservedScreen onNavigate={setCurrentScreen} blocks={blocks} onStartBlock={handleStartBlock} currentUser={currentUser} />;
      case 'history': return <HistoryScreen />;
      case 'analytics': return <AnalyticsScreen onNavigate={setCurrentScreen} />;
      case 'mission_detail': return <MissionDetailScreen blockData={activeBlock} onBack={() => { setCurrentScreen('reserved'); loadRealData(); }} currentUser={currentUser} />;
      case 'subcategories': return <SubcategoriesScreen categoryLabel={selectedCategory || ''} categories={categories} onBack={() => setCurrentScreen('dashboard')} onSelectSegment={handleSegmentSelect} />;
      case 'treatment': return <TreatmentScreen onNavigate={setCurrentScreen} />;
      case 'settings': return <SettingsScreen onBack={() => setCurrentScreen('dashboard')} currentUser={currentUser} />;
      case 'address_manager': return <AddressManagerScreen onBack={() => setCurrentScreen('dashboard')} />;
      default: return <DashboardScreen onNavigate={setCurrentScreen} onCategorySelect={handleCategorySelect} currentUser={currentUser} onLogout={handleLogout} categories={categories} />;
    }
  };

  const showNav = !['login', 'mission_detail', 'settings', 'treatment', 'analytics', 'address_manager'].includes(currentScreen);
  if (currentScreen === 'login') return <LoginScreen onLogin={handleLogin} />;
  const activeNavTab = (currentScreen === 'subcategories' || currentScreen === 'filtered_list') ? 'dashboard' : currentScreen;

  return (
    <div className="flex w-full min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white transition-opacity duration-300">
      {isLoading && <div className="fixed top-0 left-0 right-0 h-1 z-[100] bg-primary/20"><div className="h-full bg-primary animate-[shimmer_1s_infinite] w-1/3" /></div>}
      <Sidebar currentScreen={activeNavTab} onNavigate={setCurrentScreen} currentUser={currentUser} onLogout={handleLogout} reservedCount={reservedCount} />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto no-scrollbar relative w-full"><div className="w-full min-h-full animate-fade-in">{renderScreen()}</div></div>
        {showNav && <BottomNav currentScreen={activeNavTab} onNavigate={setCurrentScreen} onScanClick={() => setShowScanner(true)} isAdmin={currentUser?.isAdmin} reservedCount={reservedCount} />}
      </div>
      <ScannerModal isOpen={showScanner} onClose={() => setShowScanner(false)} onScanComplete={handleScanComplete} title="Escanear Código" instruction="Aponte para QR Code" />
    </div>
  );
};

export default App;
