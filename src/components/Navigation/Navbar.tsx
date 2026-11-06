import React, { useState, useEffect, useRef } from 'react';
import { useTracker } from '../../context/TrackerContext';
import type { MapLayerId } from '../../types';
import {
  Compass,
  Search,
  CheckCircle2,
  BarChart3,
  User,
  X,
  FolderOpen,
  SlidersHorizontal,
  Shuffle,
} from 'lucide-react';

interface NavbarProps {
  onOpenSaveModal: () => void;
  onToggleSidebar: () => void;
  isSidebarCollapsed: boolean;
  onToggleRouteDrawer: () => void;
  isRouteDrawerOpen: boolean;
  onToggleStatsDrawer: () => void;
  isStatsDrawerOpen: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSaveModal,
  onToggleSidebar,
  isSidebarCollapsed,
  onToggleRouteDrawer,
  isRouteDrawerOpen,
  onToggleStatsDrawer,
  isStatsDrawerOpen,
}) => {
  const {
    filter,
    setFilter,
    currentProfile,
    activeRoute,
    liveSyncState,
    playerLocation,
    centerOnPlayer,
    isFollowPlayer,
    setIsFollowPlayer,
    isRandomizer,
    setIsRandomizer,
  } = useTracker();

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounced search to prevent re-filtering 4800 items on every single keypress
  const [prevSearchQuery, setPrevSearchQuery] = useState(filter.searchQuery);
  const [searchInput, setSearchInput] = useState(filter.searchQuery);

  if (prevSearchQuery !== filter.searchQuery) {
    setPrevSearchQuery(filter.searchQuery);
    setSearchInput(filter.searchQuery);
  }

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== filter.searchQuery) {
        setFilter({ searchQuery: searchInput });
      }
    }, 150);

    return () => clearTimeout(handler);
  }, [searchInput, filter.searchQuery, setFilter]);

  // Global hotkey: '/' to focus search, 'Escape' to blur
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const layerOptions: { id: MapLayerId; label: string; shortLabel: string; icon: string }[] = [
    { id: 'base-game', label: 'Междуземье', shortLabel: 'Междуземье', icon: '🌍' },
    { id: 'base-game-underground', label: 'Подземелья', shortLabel: 'Подземелья', icon: '🌌' },
    { id: 'dlc', label: 'Царство Теней (DLC)', shortLabel: 'DLC', icon: '🌑' },
  ];

  return (
    <header className="h-14 bg-[#0a0c12]/95 border-b border-[#212534] px-2.5 sm:px-3.5 flex items-center justify-between gap-1.5 sm:gap-2.5 z-30 backdrop-blur-md select-none w-full max-w-full overflow-hidden">
      {/* Brand & Layer Switcher */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#c8aa6e] to-[#8c6d37] flex items-center justify-center shadow-[0_0_12px_rgba(200,170,110,0.35)] border border-[#f5d38a]/40 shrink-0">
            <span className="font-cinzel font-black text-black text-xs tracking-wider">ER</span>
          </div>
          <div className="hidden 2xl:block">
            <h1 className="font-cinzel font-bold text-xs text-[#f5d38a] leading-none tracking-wider">
              ELDEN RING
            </h1>
            <p className="text-[9px] text-zinc-400 font-medium tracking-widest uppercase mt-0.5">
              Live Map Tracker
            </p>
          </div>
        </div>

        {/* Layer Tabs */}
        <div className="flex items-center bg-[#11141e] p-0.5 rounded-lg border border-[#212638]">
          {layerOptions.map((l) => {
            const isActive = filter.activeLayer === l.id;
            return (
              <button
                key={l.id}
                onClick={() => {
                  if (filter.activeLayer !== l.id) {
                    setIsFollowPlayer(false);
                  }
                  setFilter({ activeLayer: l.id });
                }}
                className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#c8aa6e] text-black font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#181d2a]'
                }`}
                title={l.label}
              >
                <span>{l.icon}</span>
                <span className="hidden xl:inline">{l.label}</span>
                <span className="hidden md:inline xl:hidden">{l.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search Input with Hotkey */}
      <div className="flex-1 min-w-[90px] sm:min-w-[130px] max-w-xs sm:max-w-sm mx-1 relative">
        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Поиск маркеров..."
          className="w-full bg-[#11141e] border border-[#23283a] focus:border-[#c8aa6e]/80 focus:ring-1 focus:ring-[#c8aa6e]/30 rounded-lg pl-7 sm:pl-8 pr-7 sm:pr-10 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 outline-none transition-all truncate"
        />
        {searchInput ? (
          <button
            onClick={() => {
              setSearchInput('');
              setFilter({ searchQuery: '' });
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5 cursor-pointer"
            title="Очистить поиск"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <span className="hidden sm:block absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 border border-zinc-800 rounded px-1 font-mono pointer-events-none">
            /
          </span>
        )}
      </div>

      {/* Actions & Character Badge */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* MapGenie Sidebar Toggle */}
        <button
          onClick={onToggleSidebar}
          className={`px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            !isSidebarCollapsed
              ? 'bg-amber-950/80 text-amber-200 border-amber-500/80 shadow-[0_0_10px_rgba(200,170,110,0.3)]'
              : 'bg-[#11141e] text-zinc-300 border-[#212638] hover:text-[#f5d38a] hover:border-amber-500/50 hover:bg-[#181d2a]'
          }`}
          title="Показать / скрыть боковую панель категорий MapGenie"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="hidden 2xl:inline">Категории MapGenie</span>
          <span className="hidden md:inline 2xl:hidden">Категории</span>
        </button>

        {/* The Core MapGenie "Hide Found" Switch */}
        <button
          onClick={() => setFilter({ onlyUncollected: !filter.onlyUncollected })}
          className={`px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            filter.onlyUncollected
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
              : 'bg-[#11141e] text-zinc-400 border-[#212638] hover:text-zinc-200 hover:bg-[#181d2a]'
          }`}
          title={
            filter.onlyUncollected
              ? 'Hide Found ВКЛЮЧЕНО: найденный лут, благодати и боссы скрыты'
              : 'Hide Found ВЫКЛЮЧЕНО: показываются все маркеры'
          }
        >
          <CheckCircle2
            className={`w-3.5 h-3.5 shrink-0 ${filter.onlyUncollected ? 'text-emerald-400' : 'text-zinc-500'}`}
          />
          <span className="hidden 2xl:inline">Скрыть найденное</span>
          <span
            className={`text-[10px] px-1 py-0.5 rounded font-bold hidden sm:inline ${
              filter.onlyUncollected ? 'bg-emerald-500/30 text-emerald-300' : 'bg-zinc-800 text-zinc-500'
            }`}
          >
            {filter.onlyUncollected ? 'ВКЛ' : 'ВЫКЛ'}
          </span>
        </button>

        {/* Route Drawer Toggle */}
        <button
          onClick={onToggleRouteDrawer}
          className={`px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer relative ${
            isRouteDrawerOpen || (activeRoute && activeRoute.waypoints.length > 0)
              ? 'bg-blue-950/70 text-blue-300 border-blue-500/70 shadow-[0_0_8px_rgba(59,130,246,0.25)]'
              : 'bg-[#11141e] text-zinc-400 border-[#212638] hover:text-zinc-200 hover:bg-[#181d2a]'
          }`}
          title="Маршрутный лист и навигатор"
        >
          <Compass className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden lg:inline">Маршрут</span>
          {activeRoute && activeRoute.waypoints.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
              {activeRoute.waypoints.length}
            </span>
          )}
        </button>

        {/* Live Player Beacon & Follow Button */}
        {playerLocation && (
          <button
            onClick={() => {
              centerOnPlayer();
            }}
            className={`px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isFollowPlayer
                ? 'bg-amber-950/80 text-amber-200 border-amber-500/80 shadow-[0_0_10px_rgba(245,158,11,0.35)] hover:bg-amber-900/90'
                : 'bg-[#11141e] text-zinc-300 border-[#212638] hover:text-amber-200 hover:border-amber-500/50 hover:bg-[#181d2a]'
            }`}
            title="Перейти к положению игрока в прямом эфире и включить слежение"
          >
            <div className="relative flex items-center justify-center">
              <span className={`w-2 h-2 rounded-full ${isFollowPlayer ? 'bg-amber-400 animate-ping absolute' : ''}`} />
              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
            </div>
            <span className="hidden lg:inline">Игрок</span>
          </button>
        )}

        {/* Live-Sync / Save File Status Button */}
        {liveSyncState.enabled ? (
          <button
            onClick={onOpenSaveModal}
            className="px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all bg-emerald-950/80 text-emerald-300 border-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.3)] cursor-pointer hover:brightness-110 shrink-0"
            title={`Live-отслеживание активно (${liveSyncState.fileName || 'ER0000.sl2'}). Нажмите для смены персонажа или файла.`}
          >
            <div className="relative flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute" />
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
            </div>
            <span className="hidden xl:inline text-emerald-400 font-bold">Live:</span>
            <span className="font-mono text-zinc-100 text-[11px] truncate max-w-[85px] sm:max-w-[105px]">
              {liveSyncState.fileName || 'ER0000.sl2'}
            </span>
          </button>
        ) : (
          <button
            onClick={onOpenSaveModal}
            className="px-2 sm:px-2.5 py-1.5 rounded-lg bg-amber-950/40 text-[#f5d38a] border border-amber-500/50 hover:bg-amber-900/60 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_10px_rgba(200,170,110,0.2)] animate-pulse shrink-0"
            title="Выбрать файл сохранения (.sl2 / папку)"
          >
            <FolderOpen className="w-3.5 h-3.5 text-[#f5d38a] shrink-0" />
            <span className="hidden sm:inline">Выбрать сейв</span>
            <span className="sm:hidden">Сейв</span>
          </button>
        )}

        {/* Randomizer Mode Toggle */}
        <button
          onClick={() => setIsRandomizer(!isRandomizer)}
          className={`px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            isRandomizer
              ? 'bg-purple-950/80 text-purple-200 border-purple-500/80 shadow-[0_0_10px_rgba(168,85,247,0.35)] hover:bg-purple-900/90'
              : 'bg-[#11141e] text-zinc-400 border-[#212638] hover:text-zinc-200 hover:bg-[#181d2a]'
          }`}
          title={
            isRandomizer
              ? '🎲 Режим Рандомайзера ВКЛЮЧЕН: лут отмечается только по физическим событиям мира.'
              : '🎲 Режим Рандомайзера ВЫКЛЮЧЕН.'
          }
        >
          <Shuffle className={`w-3.5 h-3.5 shrink-0 ${isRandomizer ? 'text-purple-400' : 'text-zinc-500'}`} />
          <span className="hidden 2xl:inline">Рандомайзер</span>
          <span
            className={`text-[10px] px-1 py-0.5 rounded font-bold hidden sm:inline ${
              isRandomizer ? 'bg-purple-500/30 text-purple-300' : 'bg-zinc-800 text-zinc-500'
            }`}
          >
            {isRandomizer ? 'ВКЛ' : 'ВЫКЛ'}
          </span>
        </button>

        {/* Marker Size Scale */}
        <div className="hidden 2xl:flex items-center bg-[#11141e] p-0.5 rounded-lg border border-[#212638] text-xs">
          <span className="text-[10px] text-zinc-500 px-1.5 font-medium">Масштаб:</span>
          {[
            { scale: 1.0, label: '1x' },
            { scale: 1.15, label: '1.15x' },
            { scale: 1.35, label: '1.35x' },
          ].map((s) => (
            <button
              key={s.scale}
              onClick={() => setFilter({ markerScale: s.scale })}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                (filter.markerScale || 1.15) === s.scale
                  ? 'bg-[#c8aa6e] text-black font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Stats Button */}
        <button
          onClick={onToggleStatsDrawer}
          className={`p-2 rounded-lg border transition-all cursor-pointer shrink-0 ${
            isStatsDrawerOpen
              ? 'bg-amber-950/70 text-amber-300 border-amber-600/70 shadow-[0_0_8px_rgba(200,170,110,0.25)]'
              : 'bg-[#11141e] text-zinc-400 border-[#212638] hover:text-zinc-200 hover:bg-[#181d2a]'
          }`}
          title="Статистика прогресса"
        >
          <BarChart3 className="w-3.5 h-3.5" />
        </button>

        {/* Character Info Label (Static Badge, not a button) */}
        <div
          className="px-2.5 py-1.5 rounded-lg bg-[#11141e]/90 border border-[#212638] text-zinc-300 flex items-center gap-1.5 text-xs font-medium cursor-default shrink-0 select-none shadow-sm"
          title={`Персонаж: ${currentProfile.name}${currentProfile.level > 1 ? ` (${currentProfile.level} ур.)` : ''}`}
        >
          <User className="w-3.5 h-3.5 text-[#c8aa6e] shrink-0" />
          <span className="max-w-[70px] sm:max-w-[95px] md:max-w-[125px] truncate font-semibold text-zinc-200">
            {currentProfile.name}
          </span>
          {currentProfile.level > 1 && (
            <span className="text-[10px] text-[#f5d38a]/80 font-mono hidden md:inline shrink-0">
              {currentProfile.level} ур.
            </span>
          )}
        </div>
      </div>
    </header>
  );
};