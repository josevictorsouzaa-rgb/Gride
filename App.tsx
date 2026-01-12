
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
import { AutoPartsLoader } from './components/AutoPartsLoader';
import { api, ApiCategory } from './services/api'; 

const initialBlocksData: Block[] = [];
const INACTIVITY_LIMIT = 15 * 60 * 1000;

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  
  // States for Filtering
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState<string | null>(null);
  const [selectedGrCod, setSelectedGrCod] = useState<number | undefined>(undefined);
  const [selectedSgCod, setSelectedSgCod] = useState<number | undefined>(undefined);
  
  // Pagination State for Browsing
  const [browsePage, setBrowsePage] = useState(1);
  const BROWSE_LIMIT = 30; 

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [blocks, setBlocks] = useState<Block[]>(initialBlocksData);
  const [categories, setCategories] = useState<ApiCategory[]>([]); 
  const [segmentFilter, setSegmentFilter] = useState<string | null>(null); 
  const [activeBlock, setActiveBlock] = useState<any | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Global Badge Counter for Reserved Items
  const [reservedCount, setReservedCount] = useState(0);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    setCurrentScreen('login');
    setReservedCount(0);
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setCurrentScreen('dashboard');
  };

  // Helper to refresh reserved count globally
  const refreshReservedCount = useCallback(async () => {
      if (currentUser) {
          try {
              const reserved = await api.getReservedBlocks(currentUser.id);
              setReservedCount(reserved.length);
          } catch (e) {
              console.error("Erro ao atualizar badge de reservados", e);
          }
      }
  }, [currentUser]);

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

  // Carrega Categorias ao entrar no sistema e atualiza badge
  useEffect(() => {
      if (currentUser && currentScreen !== 'login') {
          refreshReservedCount();
      }
      
      if (currentScreen === 'dashboard') {
          api.getCategories().then(setCategories);
      }
  }, [currentScreen, currentUser, refreshReservedCount]);

  // Lógica principal de carregamento de blocos baseada na tela e filtros
  useEffect(() => {
    if (currentScreen === 'login') return;

    const fetchBlocks = async () => {
        const shouldFetchReservations = currentScreen === 'reserved' || currentScreen === 'dashboard';
        const isListScreen = currentScreen === 'list';
        const isFilteredList = currentScreen === 'filtered_list';

        if (!isListScreen && !isFilteredList && !shouldFetchReservations) {
            return; 
        }

        setIsLoading(true);
        try {
            if (isListScreen) {
                // META DIÁRIA: Carrega blocos para meta
                const metaBlocks = await api.getBlocks(1, 100, '', undefined, undefined, true);
                setBlocks(metaBlocks);
            } else if (isFilteredList) {
                // EXPLORAR: Carrega com filtros de GR e SG
                if (segmentFilter !== 'Resultado da Busca' && selectedGrCod) {
                    const filteredBlocks = await api.getBlocks(browsePage, BROWSE_LIMIT, '', selectedGrCod, selectedSgCod);
                    setBlocks(filteredBlocks);
                }
            } else if (currentScreen === 'reserved' && currentUser) {
                // RESERVADOS: Rota específica
                const myReserved = await api.getReservedBlocks(currentUser.id);
                setBlocks(myReserved);
                // Also update count to ensure sync
                setReservedCount(myReserved.length);
            }
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        } finally {
            setIsLoading(false);
        }
    };

    fetchBlocks();
  }, [currentScreen, selectedGrCod, selectedSgCod, currentUser, browsePage]);

  
  const handleCategorySelect = (categoryLabel: string, dbId: number) => {
    setSelectedCategoryLabel(categoryLabel);
    setSelectedGrCod(dbId);
    setCurrentScreen('subcategories');
  };

  const handleSegmentSelect = (segmentLabel: string, sgId: number) => {
    setSegmentFilter(segmentLabel);
    setSelectedSgCod(sgId);
    setBrowsePage(1); 
    setCurrentScreen('filtered_list');
  };

  const handleReserveBlock = async (id: number) => {
    if (!currentUser) return;
    const res = await api.reserveBlock(id, currentUser);
    if (res.success) {
        setBlocks(prev => prev.map(b => 
          b.id === id ? { 
              ...b, 
              status: 'progress', 
              lockedBy: { userId: currentUser.id, userName: currentUser.name, timestamp: new Date().toISOString() } 
          } : b
        ));
        refreshReservedCount(); // Update badge immediately
    } else {
        alert(res.message || 'Erro ao reservar.');
    }
  };

  const handleStartBlock = (block: any) => {
    setActiveBlock(block);
    setCurrentScreen('mission_detail');
  };

  const handleScanComplete = async (code: string) => {
    setShowScanner(false);
    const cleanCode = code.trim().toUpperCase();
    
    if (cleanCode.startsWith('LOC-')) {
        setIsLoading(true);
        try {
            const rawLocation = cleanCode.replace('LOC-', ''); 
            const results = await api.getBlocks(1, 100, '', undefined, undefined, false, rawLocation);
            
            if (results.length > 0) {
                setBlocks(results);
                setSegmentFilter('Resultado da Busca');
                setBrowsePage(1);
                setSelectedGrCod(undefined);
                setSelectedSgCod(undefined);
                setCurrentScreen('filtered_list');
            } else {
                alert(`Nenhum item encontrado na localização: ${cleanCode}`);
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao buscar itens por localização.");
        } finally {
            setIsLoading(false);
        }
    } else {
        setIsLoading(true);
        try {
            // Busca produto por código
            const results = await api.getBlocks(1, 50, cleanCode);
            if (results.length > 0) {
                setBlocks(results);
                setSegmentFilter('Resultado da Busca');
                setBrowsePage(1);
                setSelectedGrCod(undefined);
                setSelectedSgCod(undefined);
                setCurrentScreen('filtered_list');
            } else {
                alert(`Nenhum item encontrado com o código: ${code}`);
            }
        } catch (e) {
            alert("Erro na busca.");
        } finally {
            setIsLoading(false);
        }
    }
  };

  const handlePageChange = (newPage: number) => {
      if (newPage < 1) return;
      setBrowsePage(newPage);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'login': return <LoginScreen onLogin={handleLogin} />;
      case 'dashboard': return <DashboardScreen onNavigate={setCurrentScreen} onCategorySelect={handleCategorySelect} currentUser={currentUser} onLogout={handleLogout} categories={categories} />;
      case 'list': return <ListScreen key="meta-list" onNavigate={setCurrentScreen} blocks={blocks} segmentFilter={null} onReserveBlock={handleReserveBlock} onClearFilter={() => {}} mode="daily_meta" />;
      case 'filtered_list': 
        return <ListScreen 
            key="browse-list" 
            onNavigate={setCurrentScreen} 
            blocks={blocks} 
            segmentFilter={segmentFilter} 
            onReserveBlock={handleReserveBlock} 
            onClearFilter={() => { setSegmentFilter(null); setSelectedSgCod(undefined); setCurrentScreen('subcategories'); }} 
            mode="browse"
            page={browsePage}
            onPageChange={handlePageChange}
        />;
      case 'reserved': return <ReservedScreen onNavigate={setCurrentScreen} blocks={blocks} onStartBlock={handleStartBlock} currentUser={currentUser} onRefreshCount={refreshReservedCount} />;
      case 'history': return <HistoryScreen />;
      case 'analytics': return <AnalyticsScreen onNavigate={setCurrentScreen} />;
      case 'mission_detail': return <MissionDetailScreen blockData={activeBlock} onBack={() => { setCurrentScreen('reserved'); }} currentUser={currentUser} />;
      case 'subcategories': return <SubcategoriesScreen categoryLabel={selectedCategoryLabel || ''} categories={categories} onBack={() => setCurrentScreen('dashboard')} onSelectSegment={handleSegmentSelect} />;
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
      {/* LOADING OVERLAY GLOBAL */}
      {isLoading && <AutoPartsLoader message="Buscando Itens..." />}
      
      <Sidebar currentScreen={activeNavTab} onNavigate={setCurrentScreen} currentUser={currentUser} onLogout={handleLogout} reservedCount={reservedCount} />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <div id="main-scroll-container" className="flex-1 overflow-y-auto no-scrollbar relative w-full"><div className="w-full min-h-full animate-fade-in">{renderScreen()}</div></div>
        {showNav && <BottomNav currentScreen={activeNavTab} onNavigate={setCurrentScreen} onScanClick={() => setShowScanner(true)} isAdmin={currentUser?.isAdmin} reservedCount={reservedCount} />}
      </div>
      <ScannerModal isOpen={showScanner} onClose={() => setShowScanner(false)} onScanComplete={handleScanComplete} title="Escanear Código" instruction="Aponte para QR Code" />
    </div>
  );
};

export default App;
