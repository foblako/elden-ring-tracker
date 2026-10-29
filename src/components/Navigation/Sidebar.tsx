import React, { useState, useMemo } from 'react';
import { useTracker } from '../../context/TrackerContext';
import {
  MAPGENIE_GROUPS,
  MAPGENIE_CATEGORIES,
} from '../../services/mapGenieCategories';
import type { MapLayerId } from '../../types';
import {
  Search,
  X,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Eye,
  EyeOff,
  ChevronsUpDown,
  Check,
  CheckCircle2,
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const ALL_CATEGORY_IDS = MAPGENIE_CATEGORIES.map((c) => c.id);

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggleCollapse }) => {
  const {
    filter,
    setFilter,
    stats,
    setIsFollowPlayer,
  } = useTracker();

  const [searchQuery, setSearchQuery] = useState('');

  // Keep track of which groups are collapsed/expanded
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    materials: true,
    other: true,
  });

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const areAllGroupsCollapsed = useMemo(() => {
    return MAPGENIE_GROUPS.every((g) => !!collapsedGroups[g.id]);
  }, [collapsedGroups]);

  const toggleAllGroupsCollapse = () => {
    if (areAllGroupsCollapsed) {
      setCollapsedGroups({});
    } else {
      const all: Record<string, boolean> = {};
      for (const g of MAPGENIE_GROUPS) all[g.id] = true;
      setCollapsedGroups(all);
    }
  };

  // Determine which categories are currently active
  const isAllSelected =
    filter.selectedCategories.length === 0 || filter.selectedCategories.includes('all');

  const activeCategorySet = useMemo(() => {
    if (isAllSelected) {
      return new Set(ALL_CATEGORY_IDS);
    }
    return new Set(filter.selectedCategories);
  }, [isAllSelected, filter.selectedCategories]);

  // Handle single category toggle
  const handleToggleCategory = (catId: string) => {
    if (isAllSelected) {
      const next = ALL_CATEGORY_IDS.filter((id) => id !== catId);
      setFilter({ selectedCategories: next });
      return;
    }

    const current = new Set(filter.selectedCategories);
    if (current.has(catId)) {
      current.delete(catId);
    } else {
      current.add(catId);
    }

    if (current.size === ALL_CATEGORY_IDS.length || current.size === 0) {
      setFilter({ selectedCategories: current.size === 0 ? [] : ['all'] });
    } else {
      setFilter({ selectedCategories: Array.from(current) });
    }
  };

  const handleShowAll = () => {
    setFilter({ selectedCategories: ['all'] });
  };

  const handleHideAll = () => {
    setFilter({ selectedCategories: [] });
  };

  // Toggle all categories in a group
  const handleToggleGroup = (groupCategoryIds: string[]) => {
    const allInGroupActive = groupCategoryIds.every((id) => activeCategorySet.has(id));

    if (isAllSelected) {
      if (allInGroupActive) {
        const groupSet = new Set(groupCategoryIds);
        const next = ALL_CATEGORY_IDS.filter((id) => !groupSet.has(id));
        setFilter({ selectedCategories: next });
      }
      return;
    }

    const nextSet = new Set(filter.selectedCategories);
    if (allInGroupActive) {
      for (const id of groupCategoryIds) nextSet.delete(id);
    } else {
      for (const id of groupCategoryIds) nextSet.add(id);
    }

    if (nextSet.size === ALL_CATEGORY_IDS.length) {
      setFilter({ selectedCategories: ['all'] });
    } else {
      setFilter({ selectedCategories: Array.from(nextSet) });
    }
  };

  // Filter groups and categories based on search input
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return MAPGENIE_GROUPS;

    return MAPGENIE_GROUPS.map((g) => {
      const matchedCats = g.categories.filter((c) => {
        return (
          c.labelRu.toLowerCase().includes(q) ||
          c.labelEn.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
        );
      });
      return {
        ...g,
        categories: matchedCats,
      };
    }).filter((g) => g.categories.length > 0);
  }, [searchQuery]);

  const mapLayerOptions: { id: MapLayerId; titleRu: string; titleEn: string; icon: string }[] = [
    { id: 'base-game', titleRu: 'Междуземье', titleEn: 'The Lands Between', icon: '🌍' },
    { id: 'base-game-underground', titleRu: 'Подземелья', titleEn: 'Underground', icon: '🌌' },
    { id: 'dlc', titleRu: 'Царство Теней', titleEn: 'The Shadow Realm', icon: '🌑' },
  ];

  return (
    <aside
      className={`relative h-full bg-[#0d1017] border-r border-[#1e2330] flex flex-col z-20 select-none transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-0 overflow-hidden' : 'w-80 sm:w-88 flex-shrink-0'
      }`}
    >
      {/* 1. Header & MapGenie Map Switcher */}
      <div className="p-3.5 border-b border-[#1b202c] bg-[#0a0d14] flex flex-col gap-3">
        {/* Brand & Collapse */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#c8aa6e] to-[#8c6d37] flex items-center justify-center shadow-[0_0_12px_rgba(200,170,110,0.35)] border border-[#f5d38a]/40 flex-shrink-0">
              <span className="font-cinzel font-black text-black text-xs tracking-wider">ER</span>
            </div>
            <div>
              <h1 className="font-cinzel font-bold text-xs text-[#f5d38a] leading-none tracking-wider">
                ELDEN RING
              </h1>
              <p className="text-[9px] text-zinc-400 font-medium tracking-widest uppercase mt-0.5">
                MapGenie Tracker
              </p>
            </div>
          </div>

          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#181d28] transition-colors cursor-pointer"
            title="Свернуть сайдбар"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Map Switcher (The Lands Between / Underground / The Shadow Realm) */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
            Карта мира
          </label>
          <div className="grid grid-cols-3 gap-1 bg-[#131722] p-1 rounded-xl border border-[#202738]">
            {mapLayerOptions.map((opt) => {
              const isActive = filter.activeLayer === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    if (filter.activeLayer !== opt.id) {
                      setIsFollowPlayer(false);
                    }
                    setFilter({ activeLayer: opt.id });
                  }}
                  className={`py-1.5 px-1 rounded-lg text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                    isActive
                      ? 'bg-gradient-to-b from-[#c8aa6e] to-[#ab8b4c] text-black font-bold shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1b202e]'
                  }`}
                  title={`${opt.titleRu} (${opt.titleEn})`}
                >
                  <span className="text-xs">{opt.icon}</span>
                  <span className="text-[10px] leading-tight truncate max-w-full px-0.5">
                    {opt.titleRu}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Search & MapGenie Action Controls */}
      <div className="p-3 border-b border-[#1b202c] bg-[#0c0f16] flex flex-col gap-2.5">
        {/* Live Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск категорий (боссы, оружие, ключи...)"
            className="w-full bg-[#121622] border border-[#222838] focus:border-[#c8aa6e] rounded-lg pl-8 pr-8 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* SHOW ALL / HIDE ALL */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleShowAll}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              isAllSelected
                ? 'bg-[#c8aa6e] text-black font-bold shadow-sm'
                : 'bg-[#141824] border border-[#23283a] text-zinc-300 hover:text-white hover:bg-[#1a2030]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Показать все</span>
          </button>

          <button
            onClick={handleHideAll}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeCategorySet.size === 0
                ? 'bg-red-950/80 border border-red-500/70 text-red-300'
                : 'bg-[#141824] border border-[#23283a] text-zinc-400 hover:text-white hover:bg-[#1a2030]'
            }`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Скрыть все</span>
          </button>
        </div>

        {/* 3. The Core MapGenie "HIDE FOUND" Switch */}
        <div 
          onClick={() => setFilter({ onlyUncollected: !filter.onlyUncollected })}
          className="pt-2 pb-1 border-t border-[#1a1f2e] flex items-center justify-between cursor-pointer group select-none"
          title="Скрыть или показать найденные предметы, боссов и благодати"
        >
          <div className="flex flex-col">
            <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5 group-hover:text-white transition-colors">
              <span>Скрыть найденное</span>
              <span className="text-[10px] text-zinc-500 font-normal">(Hide Found)</span>
            </span>
            <span className="text-[10px] text-zinc-400 mt-0.5">
              {filter.onlyUncollected
                ? '✓ Найденное полностью скрыто'
                : '○ Найденное отображается'}
            </span>
          </div>

          <div
            className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
              filter.onlyUncollected ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.45)]' : 'bg-[#242b3d]'
            }`}
          >
            <div
              className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 flex items-center justify-center ${
                filter.onlyUncollected ? 'translate-x-5' : 'translate-x-0'
              }`}
            >
              {filter.onlyUncollected && <span className="text-[9px] text-emerald-600 font-black leading-none">✓</span>}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Category Accordion List (MapGenie Style) */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scroll p-3 flex flex-col gap-2">
        {/* Accordion header expand/collapse all */}
        <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1 pb-1">
          <span>КАТЕГОРИИ И ЛУТ</span>
          <button
            onClick={toggleAllGroupsCollapse}
            className="flex items-center gap-1 text-zinc-400 hover:text-[#f5d38a] transition-colors cursor-pointer text-[10px]"
          >
            <ChevronsUpDown className="w-3 h-3" />
            <span>{areAllGroupsCollapsed ? 'Развернуть все' : 'Свернуть все'}</span>
          </button>
        </div>

        {filteredGroups.map((group) => {
          const isCollapsed = !!collapsedGroups[group.id] && !searchQuery;
          const groupCategoryIds = group.categories.map((c) => c.id);
          const activeInGroupCount = groupCategoryIds.filter((id) => activeCategorySet.has(id)).length;
          const allInGroupActive = activeInGroupCount === groupCategoryIds.length;

          let groupTotal = 0;
          let groupCollected = 0;
          for (const cat of group.categories) {
            const s = stats.byMapGenieCategory?.[cat.id];
            if (s) {
              groupTotal += s.total;
              groupCollected += s.collected;
            }
          }

          const isGroupComplete = groupTotal > 0 && groupCollected >= groupTotal;

          return (
            <div
              key={group.id}
              className="rounded-xl border border-[#1b202e] bg-[#0e121a] overflow-hidden transition-all shadow-sm flex-shrink-0"
            >
              {/* Group Accordion Header */}
              <div
                onClick={() => toggleGroupCollapse(group.id)}
                className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-[#141824] transition-colors"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <span className="text-sm flex-shrink-0">{group.icon}</span>
                  <span className="font-cinzel font-bold text-xs text-[#f5d38a] tracking-wider truncate">
                    {group.titleRu}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded flex-shrink-0 ${
                      isGroupComplete
                        ? 'bg-emerald-950/70 text-emerald-300 font-bold border border-emerald-600/40'
                        : 'text-zinc-400 bg-zinc-800/60'
                    }`}
                  >
                    {groupCollected} / {groupTotal}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleToggleGroup(groupCategoryIds)}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold text-zinc-400 hover:text-[#f5d38a] hover:bg-zinc-800 transition-colors cursor-pointer"
                    title={allInGroupActive ? 'Скрыть группу' : 'Включить всю группу'}
                  >
                    {allInGroupActive ? 'Скрыть' : 'Все'}
                  </button>

                  <button
                    onClick={() => toggleGroupCollapse(group.id)}
                    className="text-zinc-500 hover:text-zinc-300 p-0.5"
                  >
                    {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Group Categories List */}
              {!isCollapsed && (
                <div className="p-1 pt-0 flex flex-col gap-0.5 border-t border-[#171c28]">
                  {group.categories.map((cat) => {
                    const isActive = activeCategorySet.has(cat.id);
                    const catStats = stats.byMapGenieCategory?.[cat.id];
                    const total = catStats?.total || 0;
                    const collected = catStats?.collected || 0;
                    const isComplete = total > 0 && collected >= total;

                    return (
                      <div
                        key={cat.id}
                        onClick={() => handleToggleCategory(cat.id)}
                        className={`px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-all cursor-pointer group ${
                          isActive
                            ? 'bg-[#141824] hover:bg-[#191f2e] text-zinc-200'
                            : 'bg-transparent hover:bg-[#121620] text-zinc-500 opacity-60 hover:opacity-90'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate pr-2">
                          {/* MapGenie Icon Badge */}
                          <div
                            className="w-5 h-5 rounded-md flex items-center justify-center p-0.5 flex-shrink-0 transition-transform group-hover:scale-110"
                            style={{ backgroundColor: isActive ? `${cat.color}25` : '#181d28' }}
                          >
                            <img
                              src={cat.iconUrl}
                              alt={cat.labelRu}
                              className="w-full h-full object-contain filter drop-shadow"
                              loading="lazy"
                            />
                          </div>

                          {/* Labels */}
                          <div className="truncate">
                            <div
                              className={`text-xs truncate transition-colors ${
                                isActive ? 'text-zinc-200 font-medium' : 'text-zinc-500'
                              }`}
                            >
                              {cat.labelRu}
                            </div>
                            <div className="text-[9px] text-zinc-500 truncate leading-tight">
                              {cat.labelEn}
                            </div>
                          </div>
                        </div>

                        {/* Counts & Checkbox */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                              isComplete
                                ? 'bg-emerald-950 text-emerald-300 font-semibold'
                                : 'text-zinc-500 bg-zinc-900/80'
                            }`}
                          >
                            {collected}/{total}
                          </span>

                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center transition-all ${
                              isActive
                                ? 'bg-[#c8aa6e] text-black shadow-sm'
                                : 'border border-zinc-700 bg-zinc-900/50'
                            }`}
                          >
                            {isActive && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
