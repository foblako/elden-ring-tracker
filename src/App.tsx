import React, { useState, useEffect } from 'react';
import { TrackerProvider, useTracker } from './context/TrackerContext';
import { Navbar } from './components/Navigation/Navbar';
import { Sidebar } from './components/Navigation/Sidebar';
import { MapViewer } from './components/Map/MapViewer';
import { RouteDrawer } from './components/Route/RouteDrawer';
import { SaveModal } from './components/SaveManager/SaveModal';
import { StatsDrawer } from './components/Stats/StatsDrawer';
import { Loader2 } from 'lucide-react';

const TrackerApp: React.FC = () => {
  const { loading, isSaveConfigured } = useTracker();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isRouteDrawerOpen, setIsRouteDrawerOpen] = useState(false);
  const [isStatsDrawerOpen, setIsStatsDrawerOpen] = useState(false);

  // Automatically prompt new users or unconfigured setup on launch
  useEffect(() => {
    if (!loading && !isSaveConfigured) {
      setIsSaveModalOpen(true);
    }
  }, [loading, isSaveConfigured]);

  if (loading) {
    return (
      <div className="w-screen h-screen bg-[#07080b] flex flex-col items-center justify-center gap-5 text-center select-none">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#c8aa6e] via-[#9e7d3b] to-[#594218] flex items-center justify-center shadow-[0_0_35px_rgba(200,170,110,0.45)] border border-[#f5d38a]/50">
            <span className="font-cinzel font-black text-black text-2xl tracking-widest pl-0.5">ER</span>
          </div>
          <div className="absolute -inset-1 rounded-2xl border border-[#c8aa6e]/20 animate-ping pointer-events-none" />
        </div>
        <div>
          <h2 className="font-cinzel font-bold text-lg text-[#f5d38a] tracking-widest">
            ELDEN RING
          </h2>
          <p className="text-[10px] text-zinc-400 font-medium tracking-widest uppercase mt-0.5">
            Interactive Map & Progress Tracker
          </p>
          <div className="text-xs text-zinc-400 mt-4 flex items-center justify-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#c8aa6e]" />
            <span>Подготовка карты и базы данных (4800+ маркеров)...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-[#07080b] relative">
      {/* Top Pro Navigation */}
      <Navbar
        onOpenSaveModal={() => setIsSaveModalOpen(true)}
        onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleRouteDrawer={() => setIsRouteDrawerOpen(!isRouteDrawerOpen)}
        isRouteDrawerOpen={isRouteDrawerOpen}
        onToggleStatsDrawer={() => setIsStatsDrawerOpen(!isStatsDrawerOpen)}
        isStatsDrawerOpen={isStatsDrawerOpen}
      />

      {/* Main Layout: Persistent MapGenie Left Sidebar + Map Viewport */}
      <div className="flex-1 flex w-full h-full overflow-hidden relative">
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Interactive Map */}
        <main className="relative flex-1 w-full h-full overflow-hidden">
          <MapViewer />

          {/* Floating Expand Sidebar Button when collapsed */}
          {isSidebarCollapsed && (
            <button
              onClick={() => setIsSidebarCollapsed(false)}
              className="absolute left-3 top-3 z-[1000] py-2 px-3 rounded-xl bg-[#0e121a]/95 text-[#f5d38a] border border-[#c8aa6e]/50 hover:bg-[#151c2a] flex items-center gap-2 shadow-2xl backdrop-blur-md transition-all cursor-pointer group"
              title="Развернуть боковую панель категорий MapGenie"
            >
              <span className="font-bold text-xs tracking-wide">☰ Категории MapGenie</span>
              <span className="text-[10px] text-zinc-400 group-hover:translate-x-0.5 transition-transform">▶</span>
            </button>
          )}

          {/* Route Drawer Overlay */}
          <RouteDrawer
            isOpen={isRouteDrawerOpen}
            onClose={() => setIsRouteDrawerOpen(false)}
          />

          {/* Stats Drawer Overlay */}
          <StatsDrawer
            isOpen={isStatsDrawerOpen}
            onClose={() => setIsStatsDrawerOpen(false)}
          />
        </main>
      </div>

      {/* Save Modal */}
      <SaveModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <TrackerProvider>
      <TrackerApp />
    </TrackerProvider>
  );
}
