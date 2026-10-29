import React, { useRef } from 'react';
import { useTracker } from '../../context/TrackerContext';
import { BarChart3, Download, Upload, X } from 'lucide-react';

interface StatsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StatsDrawer: React.FC<StatsDrawerProps> = ({ isOpen, onClose }) => {
  const { stats, currentProfile, createProfile, batchSetCollected } = useTracker();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const categoryLabels: Record<string, { label: string; iconUrl: string }> = {
    graces: { label: 'Места благодати', iconUrl: '/icons/categories/grace.png' },
    bosses: { label: 'Боссы и полубоги', iconUrl: '/icons/categories/boss.png' },
    weapons: { label: 'Оружие и щиты', iconUrl: '/icons/categories/weapon.png' },
    talismans: { label: 'Талисманы', iconUrl: '/icons/categories/talisman.png' },
    sorceries: { label: 'Чары', iconUrl: '/icons/categories/sorceries.png' },
    incantations: { label: 'Молитвы', iconUrl: '/icons/categories/incantation.png' },
    upgrades: { label: 'Семена, слёзы и осколки', iconUrl: '/icons/categories/seed.png' },
    keyItems: { label: 'Ключевые предметы и карты', iconUrl: '/icons/categories/stone_key.png' },
    armour: { label: 'Комплекты брони', iconUrl: '/icons/categories/armor.png' },
    ashesOfWar: { label: 'Пеплы войны', iconUrl: '/icons/categories/ash.png' },
    spiritAshes: { label: 'Прахи духов', iconUrl: '/icons/categories/spirit.png' },
    dungeons: { label: 'Подземелья и локации', iconUrl: '/icons/categories/ark.png' },
    merchants: { label: 'Кочевые торговцы и NPC', iconUrl: '/icons/categories/npc.png' },
    materials: { label: 'Материалы для крафта', iconUrl: '/icons/categories/materials.png' },
    other: { label: 'Золотые руны и прочее', iconUrl: '/icons/categories/rune_high.png' },
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentProfile, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${currentProfile.name.replace(/\s+/g, '_')}_backup.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.name && parsed.collectedIds) {
          createProfile(parsed.name + ' (Импорт)');
          const ids = Object.keys(parsed.collectedIds);
          batchSetCollected(ids, true);
        }
      } catch (err: unknown) {
        console.error('JSON import error:', err);
        alert('Ошибка при импорте JSON: неверный формат профиля.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="absolute top-16 left-4 w-96 max-w-[calc(100vw-32px)] max-h-[calc(100vh-80px)] bg-[#0c0f16]/95 border border-[#262c3e] rounded-2xl shadow-2xl z-40 flex flex-col overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-left-4 duration-200">
      {/* Header */}
      <div className="p-3.5 border-b border-[#1f2434] flex items-center justify-between bg-[#111420]/80">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-amber-950/80 border border-amber-500/40 text-amber-400">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-cinzel font-bold text-sm text-[#f5d38a] leading-none">
              Прогресс персонажа
            </h2>
            <p className="text-[10px] text-zinc-400 mt-0.5">{currentProfile.name}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-3.5 overflow-y-auto flex-1 flex flex-col gap-3.5">
        {/* Overall Progress Card */}
        <div className="bg-[#121622] border border-[#23293c] rounded-xl p-3.5 flex flex-col gap-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-300">Общий прогресс игры:</span>
            <span className="font-cinzel font-bold text-base text-[#f5d38a]">
              {stats.percent}%
            </span>
          </div>

          <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden border border-[#242a3a]">
            <div
              className="h-full bg-gradient-to-r from-amber-600 to-[#c8aa6e] rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(200,170,110,0.4)]"
              style={{ width: `${stats.percent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5">
            <span>Отмечено:</span>
            <span className="font-medium text-zinc-200">
              {stats.collected} из {stats.total} точек
            </span>
          </div>
        </div>

        {/* Categories Breakdown */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-0.5">
            По категориям:
          </span>

          <div className="flex flex-col gap-1.5">
            {Object.entries(categoryLabels).map(([catKey, info]) => {
              const catStat = stats.byCategory[catKey] || { total: 0, collected: 0 };
              if (catStat.total === 0) return null;
              const catPercent = Math.round((catStat.collected / catStat.total) * 100);

              return (
                <div
                  key={catKey}
                  className="p-2 rounded-xl bg-[#121622] border border-[#212638] flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-4.5 h-4.5 rounded-full bg-black/60 p-0.5 flex-shrink-0 flex items-center justify-center border border-zinc-700/60">
                        <img src={info.iconUrl} alt={info.label} className="w-full h-full object-contain" />
                      </div>
                      <span className="text-zinc-200 font-medium truncate text-xs">{info.label}</span>
                    </div>
                    <span className="text-zinc-400 font-mono text-[11px] flex-shrink-0">
                      {catStat.collected}/{catStat.total} ({catPercent}%)
                    </span>
                  </div>

                  <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#c8aa6e]/80 rounded-full transition-all duration-300"
                      style={{ width: `${catPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Export / Import Section */}
        <div className="pt-2 border-t border-[#1f2434] flex flex-col gap-2">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-0.5">
            Резервная копия профиля:
          </span>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExportJson}
              className="py-1.5 px-2 bg-[#121622] hover:bg-[#181e2e] border border-[#23293c] rounded-lg text-zinc-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#c8aa6e]" />
              <span>Экспорт JSON</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="py-1.5 px-2 bg-[#121622] hover:bg-[#181e2e] border border-[#23293c] rounded-lg text-zinc-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              <span>Импорт JSON</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportJson}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
