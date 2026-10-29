import React from 'react';
import { useTracker } from '../../context/TrackerContext';
import { Compass, Sparkles, Trash2, X, CheckCircle, Clock, Navigation } from 'lucide-react';

interface RouteDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RouteDrawer: React.FC<RouteDrawerProps> = ({ isOpen, onClose }) => {
  const {
    activeRoute,
    removeFromRoute,
    clearRoute,
    optimizeActiveRoute,
    toggleCollected,
    currentProfile,
  } = useTracker();

  if (!isOpen) return null;

  return (
    <div className="absolute top-16 right-4 w-96 max-w-[calc(100vw-32px)] max-h-[calc(100vh-80px)] bg-[#0c0f16]/95 border border-[#262c3e] rounded-2xl shadow-2xl z-40 flex flex-col overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="p-3.5 border-b border-[#1f2434] flex items-center justify-between bg-[#111420]/80">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-950/80 border border-blue-500/40 text-blue-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-cinzel font-bold text-sm text-[#f5d38a] leading-none">
              Маршрут сбора лута
            </h2>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              {activeRoute ? `${activeRoute.waypoints.length} точек в маршруте` : 'Маршрут не построен'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-3.5 overflow-y-auto flex-1 flex flex-col gap-3">
        {!activeRoute || activeRoute.waypoints.length === 0 ? (
          <div className="py-12 text-center text-zinc-400 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-[#131724] border border-[#242b3d] flex items-center justify-center mb-3">
              <Navigation className="w-5 h-5 text-zinc-500" />
            </div>
            <p className="text-xs font-semibold text-zinc-300">Маршрутный лист пуст</p>
            <p className="text-[11px] text-zinc-500 mt-1 max-w-[220px]">
              Кликните на любой предмет на карте и нажмите «🧭 Маршрут» или «+ В Loot Run»
            </p>
          </div>
        ) : (
          <>
            {/* Route Summary Card */}
            <div className="bg-[#121622] border border-[#23293c] rounded-xl p-3 flex flex-col gap-2 shadow-sm">
              {activeRoute.startGrace && (
                <div className="flex items-start gap-2 text-xs">
                  <img src="/icons/categories/grace.png" alt="Grace" className="w-4 h-4 object-contain mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">
                      Стартовая благодать:
                    </span>
                    <div className="text-[#f5d38a] font-semibold text-xs">
                      {activeRoute.startGrace.nameRu || activeRoute.startGrace.name}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1d2232] text-xs">
                <div>
                  <span className="text-[10px] text-zinc-400">Дистанция:</span>
                  <div className="font-semibold text-zinc-200">
                    ~{activeRoute.totalDistanceMeters} м
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400">Время на Потоке:</span>
                  <div className="font-semibold text-zinc-200 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    ~{Math.max(1, Math.round(activeRoute.totalDistanceMeters / 600))} мин
                  </div>
                </div>
              </div>

              {/* Route Control Actions */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-[#1d2232]">
                {activeRoute.waypoints.length > 1 && (
                  <button
                    onClick={optimizeActiveRoute}
                    className="flex-1 py-1.5 px-2 bg-blue-950/70 hover:bg-blue-900/80 border border-blue-500/50 rounded-lg text-blue-300 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title="Найти кратчайший порядок сбора (2-Opt TSP)"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Оптимизировать</span>
                  </button>
                )}
                <button
                  onClick={clearRoute}
                  className="py-1.5 px-2.5 bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Очистить весь маршрут"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Очистить</span>
                </button>
              </div>
            </div>

            {/* Waypoints List */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-0.5">
                Порядок сбора ({activeRoute.waypoints.length}):
              </span>

              {activeRoute.waypoints.map((wp, idx) => {
                const isCol = wp.markerId ? !!currentProfile.collectedIds[wp.markerId] : false;

                return (
                  <div
                    key={wp.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                      isCol
                        ? 'bg-[#0e111a]/50 border-emerald-900/40 opacity-60'
                        : 'bg-[#121622] border-[#22283a] hover:border-[#c8aa6e]/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-blue-600/30 border border-blue-400/50 text-blue-300 text-xs font-bold flex items-center justify-center flex-shrink-0 font-mono">
                        {idx + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs text-zinc-200 truncate">
                          {wp.titleRu || wp.title}
                        </div>
                        {wp.titleRu && wp.titleRu !== wp.title && (
                          <div className="text-[10px] text-zinc-400 truncate font-serif">
                            {wp.title}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {wp.markerId && (
                        <button
                          onClick={() => toggleCollected(wp.markerId!)}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            isCol
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-700'
                              : 'bg-zinc-800/80 text-zinc-400 border-zinc-700 hover:text-white'
                          }`}
                          title={isCol ? 'Отменить сбор' : 'Отметить собранным'}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => removeFromRoute(wp.markerId || wp.id)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Удалить из маршрута"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
