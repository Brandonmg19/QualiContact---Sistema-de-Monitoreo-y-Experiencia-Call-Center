/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AlertTriangle, Lock, X } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';
import { GeneralSection } from './components/general/GeneralSection';
import { AnalystSection } from './components/analyst/AnalystSection';
import { ReportingSection } from './components/reports/ReportingSection';
import { AdminSection } from './components/admin/AdminSection';
import { LoginScreen } from './components/auth/LoginScreen';

const MainLayout: React.FC = () => {
  const { authStatus, activeSection, canAccessSection, currentUser, syncError, clearSyncError } = useApp();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  if (authStatus !== 'ready') {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-row font-sans text-slate-900">
      {/* Vertical Navigation Menu on the Left */}
      <Sidebar 
        isMobileOpen={isMobileOpen} 
        onCloseMobile={() => setIsMobileOpen(false)} 
      />

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader 
          onToggleMobileSidebar={() => setIsMobileOpen(!isMobileOpen)} 
        />

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {syncError && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start justify-between gap-3 text-xs text-rose-900">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{syncError}</span>
              </div>
              <button
                type="button"
                onClick={clearSyncError}
                className="p-1 rounded-md text-rose-600 hover:bg-rose-100 transition-colors shrink-0"
                title="Cerrar aviso"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {!canAccessSection(activeSection) ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center max-w-md mx-auto my-8 space-y-2 shadow-2xs">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                <Lock className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Acceso Restringido</h2>
              <p className="text-xs text-slate-500">
                Tu rol actual no tiene permisos habilitados para acceder a este módulo.
              </p>
            </div>
          ) : (
            <>
              {activeSection === 'general' && <GeneralSection />}
              {activeSection === 'analista' && <AnalystSection />}
              {activeSection === 'reporteria' && <ReportingSection />}
              {activeSection === 'administrador' && <AdminSection />}
            </>
          )}
        </main>

        {/* Clean quiet footer compliant with anti-slop guidelines */}
        <footer className="border-t border-slate-200 bg-white py-3.5 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">NEXA-CX</span>
              <span>·</span>
              <span>Sistema Integral de Gestión de Experiencia, Monitoreo y Feedback</span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span>Sesión activa: <strong className="text-slate-700">{currentUser.name}</strong> ({currentUser.role.replace('_', ' ')})</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
