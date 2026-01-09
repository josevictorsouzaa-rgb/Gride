
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
  
  // States for Filtering
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState<string | null>(null);
  const [selectedGrCod, setSelectedGrCod] = useState<number | undefined>(undefined);
  const [selectedSgCod, setSelectedSgCod] = useState<number | undefined>(undefined);
  
  // Pagination State for Browsing
  const [browsePage, setBrowsePage] = useState(1);
  const BROWSE_LIMIT = 30; // Paginação de 30 itens por vez

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [blocks, setBlocks] = useState<Block[]>(initialBlocksData);
  const [categories, setCategories] = useState<ApiCategory[]>([]); 
  const [segmentFilter, setSegmentFilter] = useState<string | null>(null); // Visual only
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

  // Carrega Categorias ao entrar no sistema
  useEffect(() => {
      if (currentScreen === 'dashboard') {
          api.getCategories().then(setCategories);
      }
  }, [currentScreen]);

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
                // META DIÁRIA: Carrega vazio (ou 100 itens fixos para meta)
                const metaBlocks = await api.getBlocks(1, 100, '', undefined, undefined, true);
                setBlocks(metaBlocks);
            } else if (isFilteredList) {
                // EXPLORAR: Carrega com PAGINAÇÃO (30 itens) e filtros específicos de GR e SG
                // NOTA: Se segmentFilter for 'Resultado da Busca', não recarregamos aqui para não sobrescrever a busca do scanner,
                // a menos que estejamos paginando
                if (segmentFilter !== 'Resultado da Busca' && selectedGrCod) {
                    const filteredBlocks = await api.getBlocks(browsePage, BROWSE_LIMIT, '', selectedGrCod, selectedSgCod);
                    setBlocks(filteredBlocks);
                }
            } else if (currentScreen === 'reserved' && currentUser) {
                // RESERVADOS: Usa rota exclusiva para garantir que itens apareçam mesmo fora da paginação (SEM PAGINAÇÃO)
                const myReserved = await api.getReservedBlocks(currentUser.id);
                setBlocks(myReserved);
            } else if (currentScreen === 'dashboard') {
                // DASHBOARD: Sem carregar blocos pesados
            }
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        } finally {
            setIsLoading(false);
        }
    };

    fetchBlocks();
  }, [currentScreen, selectedGrCod, selectedSgCod, currentUser, browsePage]);

  const reservedCount = blocks.filter(b => b.status === 'progress' && (!b.lockedBy || b.lockedBy.userId === currentUser?.id)).length;
  
  const handleCategorySelect = (categoryLabel: string, dbId: number) => {
    setSelectedCategoryLabel(categoryLabel);
    setSelectedGrCod(dbId);
    setCurrentScreen('subcategories');
  };

  const handleSegmentSelect = (segmentLabel: string, sgId: number) => {
    setSegmentFilter(segmentLabel);
    setSelectedSgCod(sgId);
    setBrowsePage(1); // Reset page on new filter
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
    } else {
        alert(res.message || 'Erro ao reservar.');
        if (selectedGrCod) {
             // Refresh page
             const updated = await api.getBlocks(browsePage, BROWSE_LIMIT, '', selectedGrCod, selectedSgCod);
             setBlocks(updated);
        }
    }
  };

  const handleStartBlock = (block: any) => {
    setActiveBlock(block);
    setCurrentScreen('mission_detail');
  };

  // --- SMART SCANNER LOGIC ---
  const handleScanComplete = async (code: string) => {
    setShowScanner(false);
    
    // Tratamento básico da string (remover espaços)
    const cleanCode = code.trim().toUpperCase();
    
    // Verifica se é código de localização (LOC-...)
    if (cleanCode.startsWith('LOC-')) {
        setIsLoading(true);
        try {
            // Remove o prefixo para a busca (depende de como está no banco, mas assumindo que busca pelo código)
            // Se o usuário quer buscar TUDO que começa com o local (Tipo 1: G+E) ou EXATO (Tipo 2: G+E+P)
            // A API vai receber o código completo ou parcial e filtrar "STARTING WITH"
            const rawLocation = cleanCode.replace('LOC-', ''); 
            
            // Chama a API filtrando por localização
            // Passamos limit=100 para trazer bastante coisa se for um galpão inteiro
            const results = await api.getBlocks(1, 100, '', undefined, undefined, false, rawLocation);
            
            if (results.length > 0) {
                setBlocks(results);
                setSegmentFilter('Resultado da Busca');
                setBrowsePage(1); // Reset paginação
                // Limpa filtros de categoria para evitar conflito na logica do useEffect
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
        // Se não for LOC, assume que é código de produto/SKU e tenta buscar
        // O backend busca por descrição ou fabricante (SKU) no param 'search'
        setIsLoading(true);
        try {
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

  // Pagination Handlers
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
      case 'reserved': return <ReservedScreen onNavigate={setCurrentScreen} blocks={blocks} onStartBlock={handleStartBlock} currentUser={currentUser} />;
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
