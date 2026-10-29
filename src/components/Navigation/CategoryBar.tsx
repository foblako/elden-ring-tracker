import React, { useRef, useState, useEffect } from 'react';
import { useTracker } from '../../context/TrackerContext';
import type { ItemCategory } from '../../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CategoryItem {
  id: ItemCategory;
  label: string;
  iconUrl: string;
  badgeCountKey?: string;
  borderColor?: string;
}

export const CategoryBar: React.FC = () => {
  const { filter, setFilter, stats } = useTracker();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const categories: CategoryItem[] = [
    { id: 'all', label: 'Все', iconUrl: '/icons/categories/highlight.png', borderColor: '#c8aa6e' },
    { id: 'graces', label: 'Благодати', iconUrl: '/icons/categories/grace.png', badgeCountKey: 'graces', borderColor: '#fde047' },
    { id: 'bosses', label: 'Боссы', iconUrl: '/icons/categories/boss.png', badgeCountKey: 'bosses', borderColor: '#f87171' },
    { id: 'weapons', label: 'Оружие', iconUrl: '/icons/categories/weapon.png', badgeCountKey: 'weapons', borderColor: '#60a5fa' },
    { id: 'armour', label: 'Броня', iconUrl: '/icons/categories/armor.png', badgeCountKey: 'armour', borderColor: '#cbd5e1' },
    { id: 'talismans', label: 'Талисманы', iconUrl: '/icons/categories/talisman.png', badgeCountKey: 'talismans', borderColor: '#c084fc' },
    { id: 'sorceries', label: 'Чары', iconUrl: '/icons/categories/sorceries.png', badgeCountKey: 'sorceries', borderColor: '#38bdf8' },
    { id: 'incantations', label: 'Молитвы', iconUrl: '/icons/categories/incantation.png', badgeCountKey: 'incantations', borderColor: '#fbbf24' },
    { id: 'upgrades', label: 'Семена / Слёзы', iconUrl: '/icons/categories/seed.png', badgeCountKey: 'upgrades', borderColor: '#facc15' },
    { id: 'keyItems', label: 'Ключи / Карты', iconUrl: '/icons/categories/stone_key.png', badgeCountKey: 'keyItems', borderColor: '#f97316' },
    { id: 'ashesOfWar', label: 'Пеплы войны', iconUrl: '/icons/categories/ash.png', badgeCountKey: 'ashesOfWar', borderColor: '#a3e635' },
    { id: 'spiritAshes', label: 'Прахи духов', iconUrl: '/icons/categories/spirit.png', badgeCountKey: 'spiritAshes', borderColor: '#2dd4bf' },
    { id: 'dungeons', label: 'Подземелья', iconUrl: '/icons/categories/ark.png', badgeCountKey: 'dungeons', borderColor: '#94a3b8' },
    { id: 'merchants', label: 'NPC / Торговцы', iconUrl: '/icons/categories/npc.png', badgeCountKey: 'merchants', borderColor: '#f59e0b' },
    { id: 'materials', label: 'Материалы', iconUrl: '/icons/categories/materials.png', badgeCountKey: 'materials', borderColor: '#78716c' },
    { id: 'other', label: 'Руны / Прочее', iconUrl: '/icons/categories/rune_high.png', badgeCountKey: 'other', borderColor: '#d97706' },
  ];

  const updateScrollState = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 5);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 5);
  };

  useEffect(() => {
    updateScrollState();
    window.addEventListener('resize', updateScrollState);
    return () => window.removeEventListener('resize', updateScrollState);
  }, []);

  const scrollByAmount = (offset: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
      setTimeout(updateScrollState, 250);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (scrollContainerRef.current) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        scrollContainerRef.current.scrollLeft += e.deltaY;
        updateScrollState();
      }
    }
  };

  const handleSelect = (catId: ItemCategory) => {
    if (catId === 'all') {
      setFilter({ selectedCategories: ['all'] });
      return;
    }

    let current: ItemCategory[] = filter.selectedCategories.filter((c) => c !== 'all');
    if (current.includes(catId)) {
      current = current.filter((c) => c !== catId);
      if (current.length === 0) current = ['all'];
    } else {
      current = [...current, catId];
    }
    setFilter({ selectedCategories: current });
  };

  const selectOnly = (catId: ItemCategory, e: React.MouseEvent) => {
    e.stopPropagation();
    setFilter({ selectedCategories: [catId] });
  };

  return (
    <div className="relative w-full h-10 bg-[#090b10]/95 border-b border-[#1c202d] px-2 flex items-center z-20 backdrop-blur-sm select-none">
      {/* Left Scroll Arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scrollByAmount(-260)}
          className="absolute left-0 top-0 bottom-0 z-30 px-1 bg-gradient-to-r from-[#090b10] via-[#090b10]/90 to-transparent flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
          title="Прокрутить влево"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Full-width Responsive Category Bar */}
      <div
        ref={scrollContainerRef}
        onWheel={handleWheel}
        onScroll={updateScrollState}
        className="w-full h-full flex items-center justify-between gap-1 overflow-x-auto no-scrollbar px-1"
      >
        {categories.map((c) => {
          const isSelected =
            c.id === 'all'
              ? filter.selectedCategories.includes('all') || filter.selectedCategories.length === 0
              : filter.selectedCategories.includes(c.id);

          const categoryStats = c.badgeCountKey ? stats.byCategory[c.badgeCountKey] : null;

          return (
            <button
              key={c.id}
              onClick={() => handleSelect(c.id)}
              onDoubleClick={(e) => selectOnly(c.id, e)}
              title={`Клик — переключить. Двойной клик — показать только "${c.label}"`}
              className={`group relative flex-1 min-w-fit px-2 py-1 rounded-full text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                isSelected
                  ? 'bg-[#c8aa6e] text-black font-semibold shadow-[0_0_8px_rgba(200,170,110,0.35)]'
                  : 'bg-[#11141c] text-zinc-300 hover:text-white hover:bg-[#161a24] border border-[#202534]'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center p-0.5 flex-shrink-0 ${
                  isSelected ? 'bg-black/20' : 'bg-black/50'
                }`}
              >
                <img
                  src={c.iconUrl}
                  alt={c.label}
                  className="w-full h-full object-contain filter drop-shadow"
                  loading="eager"
                />
              </div>
              <span className="truncate">{c.label}</span>
              {categoryStats && categoryStats.total > 0 && (
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono flex-shrink-0 ${
                    isSelected ? 'bg-black/20 text-black font-bold' : 'bg-zinc-800/80 text-zinc-400'
                  }`}
                >
                  {categoryStats.collected}/{categoryStats.total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Right Scroll Arrow */}
      {canScrollRight && (
        <button
          onClick={() => scrollByAmount(260)}
          className="absolute right-0 top-0 bottom-0 z-30 px-1 bg-gradient-to-l from-[#090b10] via-[#090b10]/90 to-transparent flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
          title="Прокрутить вправо"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
