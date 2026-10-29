import React, { useState, useMemo } from 'react';
import { useTracker } from '../../context/TrackerContext';
import {
  MAPGENIE_GROUPS,
  MAPGENIE_CATEGORIES,
} from '../../services/mapGenieCategories.ts';
import {
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Check,
  SlidersHorizontal,
  Layers,
  Eye,
  EyeOff,
  ChevronsUpDown,
} from 'lucide-react';

interface CategoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
}

const ALL_CATEGORY_IDS = MAPGENIE_CATEGORIES.map((c) => c.id);

export const CategoryDrawer: React.FC<CategoryDrawerProps> = ({ isOpen, onClose, onOpen }) => {
  const { filter, setFilter, stats } = useTracker();
  const [searchQuery, setSearchQuery] = useState('');

  // Keep track of which groups are collapsed/expanded
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    materials: true, // collapse large materials group by default
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

  // Show all categories
  const handleShowAll = () => {
    setFilter({ selectedCategories: ['all'] });
  };

  // Hide all categories
  const handleHideAll = () => {
    setFilter({ selectedCategories: [] });
  };

  // Toggle all categories in a specific group
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
      const matchingCats = g.categories.filter(
        (c) =>
          c.labelRu.toLowerCase().includes(q) ||
          c.labelEn.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
      );
      return {
        ...g,
        categories: matchingCats,
      };
    }).filter((g) => g.categories.length > 0);
  }, [searchQuery]);

  return (
    <>
      {/* Floating Left Edge Button when Drawer is Closed */}
      {!isOpen && (
        <button
          onClick={onOpen}
          className="fixed left-0 top-18 z-30 bg-[#0f131d]/95 hover:bg-[#161c2a] border-y border-r border-[#262c3e] hover:border-amber-500/60 text-[#f5d38a] rounded-r-xl shadow-2xl pl-3 pr-3.5 py-2.5 flex items-center gap-2.5 transition-all cursor-pointer group hover:pl-4"
          title="Открыть панель категорий (MapGenie)"
        >
          <div className="relative">
            <SlidersHorizontal className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform" />
            {!isAllSelected && (
              <span className="w-2 h-2 rounded-full bg-amber-400 absolute -top-1 -right-1 animate-pulse" />
            )}
          </div>
          <span className="font-cinzel font-bold text-xs tracking-wider">Категории</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
            {isAllSelected ? 'Все' : `${activeCategorySet.size}/${ALL_CATEGORY_IDS.length}`}
          </span>
        </button>
      )}

      {/* Slide-out Sidebar Drawer */}
      <aside
        onWheel={(e) => e.stopPropagation()}
        className={`fixed top-14 bottom-0 left-0 z-40 w-[360px] sm:w-[420px] max-w-[95vw] h-[calc(100vh-3.5rem)] max-h-[calc(100vh-3.5rem)] bg-[#0b0e16]/98 border-r border-[#202536] flex flex-col shadow-2xl transition-transform duration-300 ease-in-out backdrop-blur-md select-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Header (Fixed at top, won't scroll away) */}
        <div className="flex-shrink-0 p-3.5 border-b border-[#1c2130] bg-[#0e121c]/95 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-950/80 border border-amber-500/40 text-amber-300">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-cinzel font-bold text-xs text-[#f5d38a] tracking-wider uppercase">
                  Категории карты
                </h2>
                <p className="text-[10px] text-zinc-400">
                  {activeCategorySet.size} из {ALL_CATEGORY_IDS.length} категорий включено
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleAllGroupsCollapse}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-[#f5d38a] hover:bg-zinc-800/80 transition-colors cursor-pointer text-[10px] flex items-center gap-1"
                title={areAllGroupsCollapsed ? 'Развернуть все секции' : 'Свернуть все секции'}
              >
                <ChevronsUpDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {areAllGroupsCollapsed ? 'Развернуть' : 'Свернуть'}
                </span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Закрыть панель (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Category Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Фильтр категорий (семечки, боссы, чары...)"
              className="w-full bg-[#121622] border border-[#23283a] focus:border-[#c8aa6e] rounded-lg pl-8 pr-8 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 outline-none"
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

          {/* Quick Action Buttons: MapGenie Style */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleShowAll}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                isAllSelected
                  ? 'bg-gradient-to-r from-[#c8aa6e] to-[#deb874] text-black shadow-md'
                  : 'bg-[#141824] border border-[#23283a] text-zinc-300 hover:text-white hover:bg-[#181e2e]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Показать все</span>
            </button>

            <button
              onClick={handleHideAll}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeCategorySet.size === 0
                  ? 'bg-red-950/70 border border-red-500/70 text-red-300'
                  : 'bg-[#141824] border border-[#23283a] text-zinc-400 hover:text-white hover:bg-[#181e2e]'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Скрыть все</span>
            </button>
          </div>

          {/* Only Uncollected Quick Switch */}
          <div className="pt-2 border-t border-[#1a1f2e] flex items-center justify-between text-xs">
            <span className="text-zinc-300 font-medium">Только несобранное:</span>
            <button
              onClick={() => setFilter({ onlyUncollected: !filter.onlyUncollected })}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                filter.onlyUncollected
                  ? 'bg-amber-950/80 border border-amber-500/70 text-amber-300 shadow-[0_0_8px_rgba(200,170,110,0.2)]'
                  : 'bg-[#141824] border border-[#23283a] text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${filter.onlyUncollected ? 'bg-amber-400' : 'bg-zinc-600'}`} />
              <span>{filter.onlyUncollected ? 'Включено' : 'Выключено'}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Groups Accordion (Smoothly scrolls vertically) */}
        <div className="flex-1 min-h-0 custom-scroll p-3 flex flex-col gap-2.5 overscroll-contain">
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
                    <span className="text-[10px] text-zinc-500 font-mono flex-shrink-0">
                      ({groupCollected > 0 ? `${groupCollected}/` : ''}{groupTotal})
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
                            {/* MapGenie Icon */}
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

                            {/* Label */}
                            <div className="truncate">
                              <div
                                className={`text-xs truncate transition-colors ${
                                  isActive ? 'text-zinc-200 font-medium' : 'text-zinc-500'
                                }`}
                              >
                                {cat.labelRu}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Count Badge */}
                            {total > 0 && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                  collected > 0
                                    ? 'bg-amber-500/10 text-amber-300 font-semibold'
                                    : 'bg-zinc-800 text-zinc-400'
                                }`}
                              >
                                {collected > 0 ? `${collected}/${total}` : total}
                              </span>
                            )}

                            {/* Checkbox indicator */}
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                isActive
                                  ? 'border-[#c8aa6e] bg-[#c8aa6e] text-black shadow-sm'
                                  : 'border-zinc-700 bg-zinc-900 text-transparent'
                              }`}
                            >
                              <Check className="w-3 h-3 stroke-[3]" />
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

      {/* Dimmed backdrop when drawer is open on mobile */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 top-14 bg-black/40 z-30 lg:hidden backdrop-blur-[1px]"
        />
      )}
    </>
  );
};
