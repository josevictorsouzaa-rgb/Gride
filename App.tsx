
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
const MIN_LOADING_TIME = 600; // ms - Tempo mínimo para o loader ficar visível

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
  
  // Global Badge Counters
  const [reservedCount, setReservedCount] = useState(0);
  const [treatmentCount, setTreatmentCount] = useState(0);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    setCurrentScreen('login');
    setReservedCount(0);
    setTreatmentCount(0);
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setCurrentScreen('dashboard');
  };

  // Helper to refresh global counts (Reserved + Treatment)
  const refreshGlobalCounts = useCallback(async () => {
      if (currentUser) {
          try {
              const [reserved, treatment] = await Promise.all([
                  api.getReservedBlocks(currentUser.id),
                  api.getTreatmentItems()
              ]);
              setReservedCount(reserved.length);
              setTreatmentCount(treatment.length);
          } catch (e) {
              console.error("Erro ao atualizar contadores", e);
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

  // Carrega Categorias e Contadores ao entrar no sistema
  useEffect(() => {
      if (currentUser && currentScreen !== 'login') {
          refreshGlobalCounts();
      }
      
      if (currentScreen === 'dashboard') {
          api.getCategories().then(setCategories);
      }
  }, [currentScreen, currentUser, refreshGlobalCounts]);

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
        // Delay mínimo artificial para evitar "flash" de tela
        const minDelay = new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME));

        try {
            if (isListScreen) {
                // META DIÁRIA
                const [metaBlocks] = await Promise.all([
                    api.getBlocks(1, 100, '', undefined, undefined, true),
                    minDelay
                ]);
                setBlocks(metaBlocks);
            } else if (isFilteredList) {
                // EXPLORAR
                if (segmentFilter !== 'Resultado da Busca' && selectedGrCod) {
                    const [filteredBlocks] = await Promise.all([
                        api.getBlocks(browsePage, BROWSE_LIMIT, '', selectedGrCod, selectedSgCod),
                        minDelay
                    ]);
                    setBlocks(filteredBlocks);
                } else {
                    await minDelay;
                }
            } else if (currentScreen === 'reserved' && currentUser) {
                // RESERVADOS - FETCH FRESCO GARANTIDO
                const [myReserved] = await Promise.all([
                    api.getReservedBlocks(currentUser.id),
                    minDelay
                ]);
                setBlocks(myReserved);
                setReservedCount(myReserved.length); // Update local cache of count
            } else {
                await minDelay; 
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
        // Remover da lista atual imediatamente para feedback visual (Transição Fluida)
        setBlocks(prev => prev.filter(b => b.id !== id));
        
        // Atualizar contadores globais (Visual Update no Badge)
        await refreshGlobalCounts();
        
        // NOTA: Não navegamos mais para 'reserved' automaticamente para manter o fluxo
        // setCurrentScreen('reserved'); 
    } else {
        alert(res.message || 'Erro ao reservar.');
    }
  };

  // Special handler for History Screen to ensure atomic update
  const handleHistoryReserve = async (blockId: string) => {
      if (!currentUser) return false;
      
      const res = await api.reserveBlock(blockId, currentUser);
      
      if (res.success) {
          // Wait for the count to update. The navigation is handled by HistoryScreen.
          await refreshGlobalCounts();
          return true;
      } else {
          alert(res.message || 'Erro ao reservar bloco.');
          return false;
      }
  };

  const handleStartBlock = (block: any) => {
    setActiveBlock(block);
    setCurrentScreen('mission_detail');
  };

  const handleScanComplete = async (code: string) => {
    setShowScanner(false);
    const cleanCode = code.trim().toUpperCase();
    
    setIsLoading(true);
    const minDelay = new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME));

    try {
        if (cleanCode.startsWith('LOC-')) {
            const rawLocation = cleanCode.replace('LOC-', ''); 
            const [results] = await Promise.all([
                api.getBlocks(1, 100, '', undefined, undefined, false, rawLocation),
                minDelay
            ]);
            
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
        } else {
            // Busca produto por código
            const [results] = await Promise.all([
                api.getBlocks(1, 50, cleanCode),
                minDelay
            ]);

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
        }
    } catch (error) {
        console.error(error);
        alert("Erro na busca.");
    } finally {
        setIsLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
      if (newPage < 1) return;
      setBrowsePage(newPage);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'login': return <LoginScreen onLogin={handleLogin} />;
      case 'dashboard': return <DashboardScreen onNavigate={setCurrentScreen} onCategorySelect={handleCategorySelect} currentUser={currentUser} onLogout={handleLogout} categories={categories} treatmentCount={treatmentCount} />;
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
      case 'reserved': return <ReservedScreen onNavigate={setCurrentScreen} blocks={blocks} onStartBlock={handleStartBlock} currentUser={currentUser} onRefreshCount={refreshGlobalCounts} />;
      case 'history': return <HistoryScreen currentUser={currentUser} onNavigate={setCurrentScreen} onReserve={handleHistoryReserve} />;
      case 'analytics': return <AnalyticsScreen onNavigate={setCurrentScreen} />;
      case 'mission_detail': return <MissionDetailScreen blockData={activeBlock} onBack={() => { setCurrentScreen('reserved'); }} currentUser={currentUser} />;
      case 'subcategories': return <SubcategoriesScreen categoryLabel={selectedCategoryLabel || ''} categories={categories} onBack={() => setCurrentScreen('dashboard')} onSelectSegment={handleSegmentSelect} />;
      case 'treatment': return <TreatmentScreen onNavigate={setCurrentScreen} onRefresh={refreshGlobalCounts} />;
      case 'settings': return <SettingsScreen onBack={() => setCurrentScreen('dashboard')} currentUser={currentUser} />;
      case 'address_manager': return <AddressManagerScreen onBack={() => setCurrentScreen('dashboard')} />;
      default: return <DashboardScreen onNavigate={setCurrentScreen} onCategorySelect={handleCategorySelect} currentUser={currentUser} onLogout={handleLogout} categories={categories} treatmentCount={treatmentCount} />;
    }
  };

  const showNav = !['login', 'mission_detail', 'settings', 'treatment', 'analytics', 'address_manager'].includes(currentScreen);
  if (currentScreen === 'login') return <LoginScreen onLogin={handleLogin} />;
  const activeNavTab = (currentScreen === 'subcategories' || currentScreen === 'filtered_list') ? 'dashboard' : currentScreen;

  return (
    <div className="flex w-full min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white transition-opacity duration-300">
      {/* LOADING OVERLAY GLOBAL */}
      {isLoading && <AutoPartsLoader message="Buscando Itens..." />}
      
      <Sidebar 
        currentScreen={activeNavTab} 
        onNavigate={setCurrentScreen} 
        currentUser={currentUser} 
        onLogout={handleLogout} 
        reservedCount={reservedCount}
        treatmentCount={treatmentCount} 
      />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <div id="main-scroll-container" className="flex-1 overflow-y-auto no-scrollbar relative w-full">
            <div key={currentScreen} className="w-full min-h-full animate-fade-in">
                {renderScreen()}
            </div>
        </div>
        {showNav && <BottomNav currentScreen={activeNavTab} onNavigate={setCurrentScreen} onScanClick={() => setShowScanner(true)} isAdmin={currentUser?.isAdmin} reservedCount={reservedCount} />}
      </div>
      <ScannerModal isOpen={showScanner} onClose={() => setShowScanner(false)} onScanComplete={handleScanComplete} title="Escanear Código" instruction="Aponte para QR Code" />
    </div>
  );
};

export default App;
