import React, { useState, useEffect, useCallback } from 'react';
import { Screen, User, Block, ApiCategory } from './types';
import { api } from './services/api';
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { ListScreen } from './screens/ListScreen';
import { ReservedScreen } from './screens/ReservedScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { TreatmentScreen } from './screens/TreatmentScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AnalyticsScreen } from './screens/AnalyticsScreen';
import { AddressManagerScreen } from './screens/AddressManagerScreen';
import { SubcategoriesScreen } from './screens/SubcategoriesScreen';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { ScannerModal } from './components/Modals';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Data States
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [reservedBlocks, setReservedBlocks] = useState<Block[]>([]);
  
  // Counts
  const [reservedCount, setReservedCount] = useState(0);
  const [treatmentCount, setTreatmentCount] = useState(0);

  // Filters / Navigation State
  const [segmentFilter, setSegmentFilter] = useState<string | null>(null);
  const [selectedSgCod, setSelectedSgCod] = useState<number | null>(null);
  const [browsePage, setBrowsePage] = useState(1);
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState<string | null>(null);

  // Scanner
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const refreshGlobalCounts = useCallback(async () => {
    if (!currentUser) return;
    
    // Reserved Count
    const rBlocks = await api.getReservedBlocks(currentUser.id);
    setReservedBlocks(rBlocks);
    setReservedCount(rBlocks.length);

    // Treatment Count
    if (currentUser.isAdmin) {
        const tItems = await api.getTreatmentItems();
        setTreatmentCount(tItems.length);
    }
  }, [currentUser]);

  const loadDashboardData = useCallback(async () => {
      const cats = await api.getCategories();
      setCategories(cats);
      await refreshGlobalCounts();
  }, [refreshGlobalCounts]);

  // Effects
  useEffect(() => {
    if (currentUser) {
        loadDashboardData();
    }
  }, [currentUser, loadDashboardData]);

  // Handlers
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setCurrentScreen('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentScreen('login');
    setBlocks([]);
    setReservedBlocks([]);
  };

  const handleNavigate = (screen: Screen) => {
    setCurrentScreen(screen);
    // Reset filters if navigating back to dashboard
    if (screen === 'dashboard') {
        setSegmentFilter(null);
        setSelectedSgCod(null);
        setSelectedCategoryLabel(null);
    }
  };

  const handleCategorySelect = (label: string, dbId: number) => {
      setSelectedCategoryLabel(label);
      setCurrentScreen('subcategories');
  };

  const handleSegmentSelect = async (segmentLabel: string, sgId: number) => {
    setSegmentFilter(segmentLabel);
    setSelectedSgCod(sgId);
    setBrowsePage(1); 
    
    // Fetch blocks for this segment
    const data = await api.getBlocks(1, 100, '', undefined, sgId);
    setBlocks(data);

    setCurrentScreen('filtered_list');
  };

  const handleReserveBlock = async (id: number | string) => {
    if (!currentUser) return;
    
    const res = await api.reserveBlock(id, currentUser);
    
    if (res.success) {
        // Remover da lista atual
        setBlocks(prev => prev.filter(b => b.id != id)); 
        
        // Atualizar contadores globais
        await refreshGlobalCounts();
        
        // Navegar para a tela de reservados
        setCurrentScreen('reserved');
    } else {
        alert(res.message || 'Erro ao reservar.');
    }
  };
  
  const handleScanClick = () => {
      setIsScannerOpen(true);
  };

  const handleScanComplete = (code: string) => {
      setIsScannerOpen(false);
      alert(`Código escaneado: ${code}`);
      // Futuro: Implementar navegação para o item/bloco escaneado
  };

  // Render logic
  if (currentScreen === 'login') {
      return <LoginScreen onLogin={handleLogin} />;
  }

  const renderScreen = () => {
      switch (currentScreen) {
          case 'dashboard':
              return (
                  <DashboardScreen 
                      onNavigate={handleNavigate}
                      onCategorySelect={handleCategorySelect}
                      currentUser={currentUser}
                      onLogout={handleLogout}
                      categories={categories}
                      treatmentCount={treatmentCount}
                  />
              );
          case 'subcategories':
              return (
                  <SubcategoriesScreen 
                      categoryLabel={selectedCategoryLabel || ''}
                      categories={categories}
                      onBack={() => setCurrentScreen('dashboard')}
                      onSelectSegment={handleSegmentSelect}
                  />
              );
          case 'list': // Daily Meta
              return (
                  <ListScreen 
                      onNavigate={handleNavigate}
                      blocks={[]} // ListScreen will fetch daily meta internally if mode='daily_meta'
                      mode="daily_meta"
                      segmentFilter={null}
                      onReserveBlock={handleReserveBlock}
                      onClearFilter={() => {}}
                  />
              );
          case 'filtered_list':
              return (
                  <ListScreen 
                      onNavigate={handleNavigate}
                      blocks={blocks}
                      mode="browse"
                      segmentFilter={segmentFilter}
                      onReserveBlock={handleReserveBlock}
                      onClearFilter={() => handleNavigate('dashboard')}
                      page={browsePage}
                      onPageChange={(p) => {
                          setBrowsePage(p);
                          if (selectedSgCod) {
                              api.getBlocks(p, 100, '', undefined, selectedSgCod).then(setBlocks);
                          }
                      }}
                  />
              );
          case 'reserved':
              return (
                  <ReservedScreen 
                      onNavigate={handleNavigate}
                      blocks={reservedBlocks} 
                      onStartBlock={() => {}}
                      currentUser={currentUser}
                      onRefreshCount={refreshGlobalCounts}
                  />
              );
          case 'history':
              return (
                  <HistoryScreen 
                      currentUser={currentUser}
                      onNavigate={handleNavigate}
                      onReserve={async (id) => {
                         if (!currentUser) return false;
                         const res = await api.reserveBlock(id, currentUser);
                         if (res.success) {
                             await refreshGlobalCounts();
                             return true;
                         }
                         return false;
                      }} 
                  />
              );
          case 'treatment':
              return (
                  <TreatmentScreen 
                      onNavigate={handleNavigate}
                      onRefresh={refreshGlobalCounts}
                  />
              );
          case 'settings':
              return (
                  <SettingsScreen 
                      onBack={() => handleNavigate('dashboard')}
                      currentUser={currentUser}
                  />
              );
          case 'analytics':
              return (
                  <AnalyticsScreen 
                      onNavigate={handleNavigate}
                  />
              );
          case 'address_manager':
              return (
                  <AddressManagerScreen 
                      onBack={() => handleNavigate('dashboard')}
                  />
              );
          default:
              return null;
      }
  };

  return (
    <div className="flex w-full min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white transition-colors duration-300">
       <Sidebar 
          currentScreen={currentScreen === 'subcategories' || currentScreen === 'filtered_list' ? 'dashboard' : currentScreen}
          onNavigate={handleNavigate}
          currentUser={currentUser}
          onLogout={handleLogout}
          reservedCount={reservedCount}
          treatmentCount={treatmentCount}
       />
       
       <div className="flex-1 flex flex-col relative w-full h-screen overflow-y-auto" id="main-scroll-container">
          {renderScreen()}
       </div>

       <BottomNav 
          currentScreen={currentScreen === 'subcategories' || currentScreen === 'filtered_list' ? 'dashboard' : currentScreen}
          onNavigate={handleNavigate}
          onScanClick={handleScanClick}
          isAdmin={currentUser?.isAdmin}
          reservedCount={reservedCount}
       />
       
       <ScannerModal 
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScanComplete={handleScanComplete}
       />
    </div>
  );
};

export default App;