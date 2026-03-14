/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useTransactions, useShopMemory, exportData } from './store';
import { TrackingForm } from './components/TrackingForm';
import { Insights } from './components/Insights';
import { AIAssistant } from './components/AIAssistant';
import { ProfileModal } from './components/ProfileModal';
import { Flame, BarChart3, Download, LogIn, LogOut, User as UserIcon, Loader2, Sparkles } from 'lucide-react';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { LanguageProvider, useLanguage } from './LanguageContext';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, errorInfo: string }> {
  public state: { hasError: boolean, errorInfo: string };
  public props: { children: React.ReactNode };

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.props = props;
    this.state = { hasError: false, errorInfo: '' };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message || String(error) };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-100 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-red-100">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h2>
            <p className="text-stone-600 mb-6">An error occurred while using the app. This might be due to database permissions or a connection issue.</p>
            <div className="bg-stone-50 p-4 rounded-lg mb-6 overflow-auto max-h-40">
              <code className="text-xs text-stone-500">{this.state.errorInfo}</code>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-orange-600 text-white py-2 rounded-lg font-medium hover:bg-orange-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'track' | 'insights' | 'ai'>('track');
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { transactions, addTransaction, updateTransaction, clearData, loading: dataLoading } = useTransactions();
  const { memory, updateMemory, loading: memoryLoading } = useShopMemory();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <Loader2 className="animate-spin text-orange-600" size={40} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-stone-200">
          <div className="bg-gradient-to-br from-orange-500 to-red-600 w-20 h-20 rounded-3xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg rotate-3">
            <Flame size={40} />
          </div>
          <h1 className="text-3xl font-bold text-stone-900 mb-2">{t('appName')}</h1>
          <p className="text-stone-500 mb-8">Sign in to access your shop's tracking data and insights securely.</p>
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-stone-200 py-3 rounded-xl font-semibold hover:bg-stone-50 transition-all active:scale-95"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Continue with Google
          </button>
          <p className="mt-6 text-xs text-stone-400">Your data is stored safely in your personal account.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-orange-500 to-red-600 p-2 rounded-lg text-white shadow-sm">
              <Flame size={20} />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-lg leading-tight">{t('appName')}</h1>
              <p className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">{t('tagline')}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 md:gap-6">
            <nav className="flex gap-1 bg-stone-100 p-1 rounded-lg border border-stone-200">
              <button
                onClick={() => setActiveTab('track')}
                className={`px-3 md:px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'track' ? 'bg-white shadow-sm text-orange-600' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {t('dashboard')}
              </button>
              <button
                onClick={() => setActiveTab('insights')}
                className={`px-3 md:px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  activeTab === 'insights' ? 'bg-white shadow-sm text-orange-600' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <BarChart3 size={16} />
                <span className="hidden xs:inline">{t('insights')}</span>
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className={`px-3 md:px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  activeTab === 'ai' ? 'bg-white shadow-sm text-orange-600' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Sparkles size={16} />
                <span className="hidden xs:inline">{t('aiAssistant')}</span>
              </button>
            </nav>

            <div className="h-8 w-px bg-stone-200"></div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => exportData(transactions)}
                title="Download Backup"
                className="p-2 text-stone-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
              >
                <Download size={20} />
              </button>
              <div className="relative group">
                <button 
                  onClick={() => setIsProfileOpen(true)}
                  className="flex items-center gap-2 p-1 pl-2 bg-stone-50 border border-stone-200 rounded-full hover:bg-stone-100 transition-colors"
                >
                  <span className="text-xs font-medium text-stone-600 hidden md:inline">{user.displayName?.split(' ')[0]}</span>
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="User" className="w-7 h-7 rounded-full border border-white" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                      <UserIcon size={16} />
                    </div>
                  )}
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-stone-200 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <div className="px-4 py-2 border-b border-stone-100">
                    <p className="text-xs font-semibold text-stone-900 truncate">{user.displayName}</p>
                    <p className="text-[10px] text-stone-500 truncate">{user.email}</p>
                  </div>
                  <button 
                    onClick={() => setIsProfileOpen(true)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                  >
                    <UserIcon size={16} />
                    {t('profile')}
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={16} />
                    {t('logout')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {dataLoading || memoryLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-orange-600" size={32} />
            <p className="text-stone-500 text-sm animate-pulse">{t('loadingShopData')}</p>
          </div>
        ) : activeTab === 'track' ? (
          <TrackingForm onSubmit={addTransaction} transactions={transactions} />
        ) : activeTab === 'insights' ? (
          <Insights transactions={transactions} onClear={clearData} updateTransaction={updateTransaction} />
        ) : (
          <AIAssistant 
            transactions={transactions} 
            memory={memory} 
            updateMemory={updateMemory} 
            addTransaction={addTransaction} 
          />
        )}
      </main>

      <ProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        memory={memory} 
        updateMemory={updateMemory} 
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </ErrorBoundary>
  );
}
