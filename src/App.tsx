/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  Package, 
  ChefHat, 
  ShoppingCart, 
  PlusCircle, 
  AlertTriangle,
  History,
  LayoutDashboard,
  Menu,
  X,
  LogIn,
  LogOut,
  Wallet,
  Users,
  Settings,
  Send,
  Loader2,
  CircleDollarSign,
  HandCoins
} from 'lucide-react';
import { cn } from './lib/utils';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Movements from './components/Movements';
import AlertsWidget from './components/AlertsWidget';

// Lazy-loaded components (code-splitting)
const FinanceDashboard = lazy(() => import('./components/FinanceDashboard'));
const HR = lazy(() => import('./components/HR'));
const Recipes = lazy(() => import('./components/Recipes'));
const Sales = lazy(() => import('./components/Sales'));
const CostsAnalysis = lazy(() => import('./components/CostsAnalysis'));
const NotificationSettings = lazy(() => import('./components/NotificationSettings'));
const PurchaseModal = lazy(() => import('./components/PurchaseModal'));
const PreparoDiario = lazy(() => import('./components/PreparoDiario'));
const ContasPagar = lazy(() => import('./components/ContasPagar'));
const PainelComprasTelegram = lazy(() => import('./components/PainelComprasTelegram'));
import { auth, googleProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

type Tab = 'dashboard' | 'finance' | 'hr' | 'inventory' | 'recipes' | 'sales' | 'movements' | 'costs' | 'settings' | 'preparo' | 'telegram' | 'contas_pagar';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const [globalError, setGlobalError] = useState<string | null>(null);

  // Auth observer
  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) setLoginLoading(false);
    });
  }, []);

  // Check for redirect result on mount
  useEffect(() => {
    getRedirectResult(auth).then((result) => {
      if (result?.user) {
        setUser(result.user);
      }
    }).catch((error) => {
      console.error('Redirect login error:', error);
      setLoginError(getLoginErrorMessage(error.code));
    });
  }, []);

  // Global Error Handler for Firestore Promise Rejections
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      try {
        const errorString = event.reason instanceof Error ? event.reason.message : String(event.reason);
        try {
          // Try parsing error as our FirestoreErrorInfo JSON
          const parsed = JSON.parse(errorString);
          if (parsed && typeof parsed === 'object' && 'operationType' in parsed && 'error' in parsed) {
            event.preventDefault(); // Prevent crash in console somewhat
            let userFriendlyMessage = "Ocorreu um erro inesperado ao se comunicar com o banco de dados.";
            
            if (parsed.error.includes("Missing or insufficient permissions") || parsed.error.includes("PERMISSION_DENIED")) {
                userFriendlyMessage = "Acesso Negado: A operação violou as regras de segurança ou você não tem permissão.";
            } else if (parsed.error.includes("Quota exceeded")) {
                userFriendlyMessage = "Limite diário de operações do banco de dados excedido. Tente novamente mais tarde.";
            } else {
                userFriendlyMessage = `Erro do Servidor: ${parsed.error}`;
            }

            setGlobalError(userFriendlyMessage);
            
            // Auto dismiss
            setTimeout(() => {
                setGlobalError(null);
            }, 8000);
          }
        } catch(e) { /* ignore non-JSON errors */ }
      } catch (e) { /* ignore */ }
    };
    
    const handleErrorEvent = (event: ErrorEvent) => {
      try {
        const parsed = JSON.parse(event.message || '');
        if (parsed && typeof parsed === 'object' && 'operationType' in parsed && 'error' in parsed) {
          event.preventDefault();
          let userFriendlyMessage = "Ocorreu um erro inesperado ao se comunicar com o banco de dados.";
          
          if (parsed.error.includes("Missing or insufficient permissions") || parsed.error.includes("PERMISSION_DENIED")) {
              userFriendlyMessage = "Acesso Negado: A operação violou as regras de segurança ou você não tem permissão.";
          } else if (parsed.error.includes("Quota exceeded")) {
              userFriendlyMessage = "Limite diário de operações do banco de dados excedido. Tente novamente mais tarde.";
          } else {
              userFriendlyMessage = `Erro do Servidor: ${parsed.error}`;
          }

          setGlobalError(userFriendlyMessage);
          
          setTimeout(() => setGlobalError(null), 8000);
        }
      } catch (e) { /* ignore non-JSON errors */ }
    };
    
    window.addEventListener('unhandledrejection', handleRejection);
    window.addEventListener('error', handleErrorEvent);
    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('error', handleErrorEvent);
    };
  }, []);

  const getLoginErrorMessage = (code: string): string => {
    switch (code) {
      case 'auth/popup-blocked':
        return 'Popup bloqueado pelo navegador. Tentando via redirecionamento...';
      case 'auth/popup-closed-by-user':
        return 'Login cancelado. Tente novamente.';
      case 'auth/cancelled-popup-request':
        return 'Login cancelado. Tente novamente.';
      case 'auth/unauthorized-domain':
        return 'Este domínio não está autorizado no Firebase. Adicione "localhost" nos domínios autorizados do Firebase Console > Authentication > Settings.';
      case 'auth/network-request-failed':
        return 'Erro de conexão. Verifique sua internet e tente novamente.';
      case 'auth/internal-error':
        return 'Erro interno do servidor de autenticação. Tente novamente em alguns instantes.';
      default:
        return `Erro ao fazer login (${code}). Tente novamente.`;
    }
  };

  const handleLogin = async () => {
    setLoginError(null);
    setLoginLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Erro no login:", error);
      const errorCode = error?.code || 'unknown';
      
      // If popup was blocked, fallback to redirect
      if (errorCode === 'auth/popup-blocked') {
        setLoginError('Popup bloqueado. Redirecionando para login...');
        try {
          await signInWithRedirect(auth, googleProvider);
          return; // Page will redirect
        } catch (redirectError: any) {
          console.error("Erro no redirect login:", redirectError);
          setLoginError(getLoginErrorMessage(redirectError?.code || 'unknown'));
        }
      } else {
        setLoginError(getLoginErrorMessage(errorCode));
      }
      setLoginLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);

  // Responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
      
      if (window.innerWidth < 768) setIsMobile(true);
      else setIsMobile(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'finance', label: 'Financeiro', icon: Wallet },
    { id: 'contas_pagar', label: 'Contas a Pagar', icon: CircleDollarSign },
    { id: 'movements', label: 'Contas a Receber', icon: HandCoins },
    { id: 'hr', label: 'Equipe e Ponto', icon: Users },
    { id: 'inventory', label: 'Estoque', icon: Package },
    { id: 'preparo', label: 'Preparo Diário', icon: ChefHat },
    { id: 'recipes', label: 'Cardápio / Ficha', icon: ChefHat },
    { id: 'sales', label: 'PDV Simulado', icon: ShoppingCart },
    { id: 'costs', label: 'Análise de Custos', icon: BarChart3 },
    { id: 'telegram', label: 'Integração Telegram', icon: Send },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Sincronizando Sistema...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 select-none overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200 p-12 rounded-[2rem] shadow-2xl max-w-md w-full text-center space-y-8 relative"
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-600 rounded-t-full"></div>
          
          <div className="space-y-2">
            <div className="bg-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-indigo-100 mb-6">
              <ChefHat size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-tight uppercase italic">
              Consumer <span className="text-indigo-600">Pro</span>
            </h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Gestão Avançada de Estoque e PDV</p>
          </div>

          <div className="space-y-4 pt-4">
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              Realize o acesso seguro para gerenciar insumos, fichas técnicas e operações de venda sincronizadas.
            </p>
            
            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs font-medium text-left leading-relaxed">
                ⚠️ {loginError}
              </div>
            )}
            
            <button 
              onClick={handleLogin}
              disabled={loginLoading}
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl active:scale-95 border-b-4 border-slate-950 active:border-b-0 active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loginLoading ? (
                <><Loader2 size={20} className="animate-spin" /> Conectando...</>
              ) : (
                <><LogIn size={20} /> Acessar com Google</>
              )}
            </button>
          </div>

          <div className="pt-8 border-t border-slate-100">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
              Sistema Restrito • Criptografia Ativa • v4.2.0
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col h-screen overflow-hidden">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 p-4 sm:px-6 sm:py-4 flex justify-between items-center shrink-0 z-10 gap-2">
        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 bg-black rounded-lg flex flex-col items-center justify-center shadow-md overflow-hidden relative">
             {/* If you place logo.png in the public folder, uncomment the img tag and remove the fallback div */}
             {/* <img src="/logo.png" alt="Chegou Pizza" className="w-full h-full object-cover" /> */}
             <div className="text-white flex flex-col items-center justify-center font-sans scale-[0.8] sm:scale-100 transform origin-center">
               <div className="flex items-center text-[11px] font-bold leading-none tracking-tighter">
                 CH
                 <div className="flex flex-col mx-[1px] gap-[1px]">
                   <div className="w-[7px] h-[2px] bg-green-500"></div>
                   <div className="w-[7px] h-[2px] bg-white"></div>
                   <div className="w-[7px] h-[2px] bg-red-500"></div>
                 </div>
                 GOU
               </div>
               <div className="text-[4px] tracking-[0.4em] font-light mt-0.5 ml-0.5">PIZZA</div>
             </div>
          </div>
          <div className="min-w-0 pr-2">
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-800 uppercase italic truncate">
              Controle de Estoque
            </h1>
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em] leading-none mt-1 hidden sm:block">Gestão de Pizzaria</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-6 shrink-0">
          <div className="hidden lg:block text-right border-r border-slate-200 pr-6">
            <p className="text-sm font-semibold">Chegou Pizza</p>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <div className="flex items-center gap-3 border border-transparent sm:border-slate-100 bg-transparent sm:bg-slate-50 py-1 sm:py-1.5 px-0 sm:px-3 rounded-xl hover:bg-slate-100 transition-colors cursor-default">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 sm:bg-white border border-slate-200 flex items-center justify-center shrink-0">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-slate-400 uppercase text-[10px]">{user.displayName?.charAt(0) || 'U'}</span>
                )}
              </div>
              <div className="text-left hidden xl:block">
                <p className="text-xs font-bold text-slate-700 leading-tight">{user.displayName}</p>
                <p className="text-[9px] text-slate-400 truncate max-w-[120px]">{user.email}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 sm:p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-90"
              title="Sair"
              aria-label="Sair da conta"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Global Error Toast */}
        <AnimatePresence>
          {globalError && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 pointer-events-none"
            >
              <div className="bg-red-500 text-white rounded-xl shadow-2xl p-4 flex gap-4 pointer-events-auto border border-red-600/50">
                <div className="bg-white/20 p-2 rounded-lg h-fit shrink-0">
                  <AlertTriangle size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0 pr-2">
                  <h3 className="font-bold text-sm tracking-tight mb-0.5">Operação Interrompida</h3>
                  <p className="text-xs text-red-100 font-medium leading-relaxed">{globalError}</p>
                </div>
                <button 
                  onClick={() => setGlobalError(null)}
                  className="text-white/60 hover:text-white shrink-0 p-1 -m-1 transition-colors h-fit rounded-lg hover:bg-white/10"
                >
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sidebar */}
        {!isMobile && (
          <motion.aside 
            initial={false}
            animate={{ width: isSidebarOpen ? 256 : 80 }}
            className="bg-slate-100 border-r border-slate-200 flex-shrink-0 overflow-hidden flex flex-col z-10"
            aria-label="Barra lateral de navegação"
          >
            <nav className="flex-1 py-6 px-3 space-y-2" role="navigation" aria-label="Navegação Principal">
              <button 
                onClick={() => setIsPurchasing(true)}
                className={cn(
                  "w-full flex items-center px-4 py-3 rounded-lg font-bold text-sm tracking-wide text-white bg-indigo-600 shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-colors mb-4 border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1",
                  !isSidebarOpen && "justify-center px-0"
                )}
                title={!isSidebarOpen ? 'Registrar Compra' : undefined}
              >
                <PlusCircle size={20} className={cn("text-white", isSidebarOpen && "mr-3")} />
                {isSidebarOpen && "Nova Compra"}
              </button>

              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as Tab)}
                  aria-current={activeTab === item.id ? 'page' : undefined}
                  aria-label={!isSidebarOpen ? item.label : undefined}
                  title={!isSidebarOpen ? item.label : undefined}
                  className={cn(
                    "w-full flex items-center px-4 py-3 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                    activeTab === item.id 
                      ? "bg-white text-indigo-700 shadow-sm border border-slate-200 font-bold" 
                      : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                  )}
                >
                  <item.icon size={20} className={cn("flex-shrink-0", activeTab === item.id ? "text-indigo-700" : "text-slate-500")} aria-hidden="true" />
                  {isSidebarOpen && <span className="ml-3 text-sm truncate">{item.label}</span>}
                </button>
              ))}
            </nav>

            <div className="p-4 mt-auto">
              <AlertsWidget isSidebarOpen={isSidebarOpen} />
            </div>
          </motion.aside>
        )}

        {/* Content Area */}
        <div className={cn("flex-1 overflow-y-auto bg-slate-50 pb-24 md:pb-6 p-4 sm:p-6 lg:p-8 relative", isMobile && "w-full")}>
          <ErrorBoundary fallbackMessage="Erro ao carregar este módulo. Tente recarregar a página.">
            <Suspense fallback={
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                <p className="text-slate-500 font-medium text-sm">Carregando módulo...</p>
              </div>
            }>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="max-w-[1400px] mx-auto w-full"
                >
                  {activeTab === 'dashboard' && <Dashboard />}
                  {activeTab === 'finance' && <FinanceDashboard onNavigate={setActiveTab} />}
                  {activeTab === 'hr' && <HR />}
                  {activeTab === 'inventory' && <Inventory />}
                  {activeTab === 'preparo' && <PreparoDiario />}
                  {activeTab === 'recipes' && <Recipes />}
                  {activeTab === 'sales' && <Sales />}
                  {activeTab === 'movements' && <Movements />}
                  {activeTab === 'contas_pagar' && <ContasPagar />}
                  {activeTab === 'costs' && <CostsAnalysis />}
                  {activeTab === 'telegram' && (
                    <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Alertas de Reposição</h2>
                          <p className="text-slate-500 text-sm">Configure e dispare mensagens de alertas pelo Telegram.</p>
                        </div>
                      </div>
                      <PainelComprasTelegram />
                    </div>
                  )}
                  {activeTab === 'settings' && <NotificationSettings />}
                </motion.div>
              </AnimatePresence>
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      {isMobile && (
        <nav className="fixed bottom-0 w-full bg-white/95 backdrop-blur-lg border-t border-slate-200 z-50 safe-area-bottom shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.15)]">
          <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide px-1 py-1.5 pb-2 gap-0.5">
            {/* Nova Compra button in mobile nav */}
            <button
              onClick={() => setIsPurchasing(true)}
              className="snap-center flex flex-col items-center justify-center min-w-[56px] py-1.5 px-1 rounded-xl transition-all shrink-0 text-white"
            >
              <div className="bg-indigo-600 rounded-xl p-2 shadow-lg shadow-indigo-200">
                <PlusCircle size={20} />
              </div>
              <span className="text-[7px] uppercase tracking-wider mt-1 text-center leading-tight whitespace-nowrap font-black text-indigo-600">
                Compra
              </span>
            </button>
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as Tab)}
                className={cn(
                  "snap-center flex flex-col items-center justify-center min-w-[56px] py-1.5 px-1 rounded-xl transition-all shrink-0",
                  activeTab === item.id 
                    ? "text-indigo-600" 
                    : "text-slate-400 active:text-slate-600 active:bg-slate-50"
                )}
              >
                <div className="relative">
                  <item.icon size={20} />
                  {activeTab === item.id && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-indigo-600 rounded-full" />
                  )}
                </div>
                <span className={cn(
                  "text-[7px] uppercase tracking-wider mt-1 text-center leading-tight whitespace-nowrap",
                  activeTab === item.id ? "font-black" : "font-medium"
                )}>
                  {item.label.length > 10 ? item.label.split(' ')[0] : item.label}
                </span>
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* Modals */}
      {isPurchasing && (
        <Suspense fallback={null}>
          <PurchaseModal onClose={() => setIsPurchasing(false)} />
        </Suspense>
      )}

      {/* Footer */}
      <footer className="hidden md:flex bg-indigo-900 text-white/50 px-6 py-2 justify-between items-center text-[10px] font-medium shrink-0">
        <p>Documentação de Suporte Tecnico v4.2.0 | Sistema Integrado Consumer</p>
        <p>© 2026 Gestão Inteligente para Gastronomia</p>
      </footer>
    </div>
  );
}
