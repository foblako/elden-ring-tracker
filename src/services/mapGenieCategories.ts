import type { TrackerMarker } from '../types';

export type MapGenieGroupId =
  | 'locations'
  | 'keyItems'
  | 'equipment'
  | 'bosses'
  | 'npcs'
  | 'materials'
  | 'other';

export interface MapGenieCategory {
  id: string;
  groupId: MapGenieGroupId;
  labelRu: string;
  labelEn: string;
  iconUrl: string;
  color: string;
}

export interface MapGenieGroup {
  id: MapGenieGroupId;
  titleRu: string;
  titleEn: string;
  icon: string;
  categories: MapGenieCategory[];
}

export const MAPGENIE_GROUPS: MapGenieGroup[] = [
  {
    id: 'locations',
    titleRu: 'Локации',
    titleEn: 'Locations',
    icon: '🌍',
    categories: [
      {
        id: 'grace',
        groupId: 'locations',
        labelRu: 'Места благодати',
        labelEn: 'Site of Grace',
        iconUrl: '/icons/categories/grace.png',
        color: '#facc15',
      },
      {
        id: 'dungeon',
        groupId: 'locations',
        labelRu: 'Подземелья и шахты',
        labelEn: 'Dungeon',
        iconUrl: '/icons/categories/ark.png',
        color: '#94a3b8',
      },
      {
        id: 'poi',
        groupId: 'locations',
        labelRu: 'Точки интереса и руины',
        labelEn: 'Point of Interest',
        iconUrl: '/icons/categories/interactible.png',
        color: '#38bdf8',
      },
      {
        id: 'divine-tower',
        groupId: 'locations',
        labelRu: 'Священные башни',
        labelEn: 'Divine Tower',
        iconUrl: '/icons/categories/statue.png',
        color: '#c084fc',
      },
      {
        id: 'minor-erdtree',
        groupId: 'locations',
        labelRu: 'Малые Древа Эрд',
        labelEn: 'Minor Erdtree',
        iconUrl: '/icons/categories/ember_piece.png',
        color: '#eab308',
      },
      {
        id: 'spiritspring',
        groupId: 'locations',
        labelRu: 'Воздушные потоки',
        labelEn: 'Spiritspring',
        iconUrl: '/icons/categories/jump.png',
        color: '#67e8f9',
      },
    ],
  },
  {
    id: 'keyItems',
    titleRu: 'Ключевые предметы',
    titleEn: 'Key Items',
    icon: '🗝️',
    categories: [
      {
        id: 'golden-seed',
        groupId: 'keyItems',
        labelRu: 'Золотые семечки',
        labelEn: 'Golden Seed',
        iconUrl: '/icons/categories/seed.png',
        color: '#fde047',
      },
      {
        id: 'sacred-tear',
        groupId: 'keyItems',
        labelRu: 'Священные слёзы',
        labelEn: 'Sacred Tear',
        iconUrl: '/icons/categories/crystal_tears.png',
        color: '#f59e0b',
      },
      {
        id: 'stonesword-key',
        groupId: 'keyItems',
        labelRu: 'Мечевидные ключи',
        labelEn: 'Stonesword Key',
        iconUrl: '/icons/categories/stone_key.png',
        color: '#93c5fd',
      },
      {
        id: 'larval-tear',
        groupId: 'keyItems',
        labelRu: 'Слёзы личинки',
        labelEn: 'Larval Tear',
        iconUrl: '/icons/categories/larval.png',
        color: '#a855f7',
      },
      {
        id: 'celestial-dew',
        groupId: 'keyItems',
        labelRu: 'Небесная роса',
        labelEn: 'Celestial Dew',
        iconUrl: '/icons/categories/dew.png',
        color: '#38bdf8',
      },
      {
        id: 'dragon-heart',
        groupId: 'keyItems',
        labelRu: 'Драконьи сердца',
        labelEn: 'Dragon Heart',
        iconUrl: '/icons/categories/dragon_heart.png',
        color: '#ef4444',
      },
      {
        id: 'deathroot',
        groupId: 'keyItems',
        labelRu: 'Корни Смерти',
        labelEn: 'Deathroot',
        iconUrl: '/icons/categories/death.png',
        color: '#71717a',
      },
      {
        id: 'memory-stone',
        groupId: 'keyItems',
        labelRu: 'Камни памяти',
        labelEn: 'Memory Stone',
        iconUrl: '/icons/categories/memory.png',
        color: '#818cf8',
      },
      {
        id: 'map-fragment',
        groupId: 'keyItems',
        labelRu: 'Фрагменты карт',
        labelEn: 'Map Fragment',
        iconUrl: '/icons/categories/map.png',
        color: '#fb923c',
      },
      {
        id: 'cookbook',
        groupId: 'keyItems',
        labelRu: 'Поваренные книги',
        labelEn: 'Cookbook',
        iconUrl: '/icons/categories/cookbook.png',
        color: '#fbbf24',
      },
      {
        id: 'scadutree-fragment',
        groupId: 'keyItems',
        labelRu: 'Осколки Древа Упадка (DLC)',
        labelEn: 'Scadutree Fragment',
        iconUrl: '/icons/categories/skadu.png',
        color: '#ca8a04',
      },
      {
        id: 'revered-spirit-ash',
        groupId: 'keyItems',
        labelRu: 'Прах почитаемого духа (DLC)',
        labelEn: 'Revered Spirit Ash',
        iconUrl: '/icons/categories/ash.png',
        color: '#78716c',
      },
      {
        id: 'ritual-pot',
        groupId: 'keyItems',
        labelRu: 'Ритуальные горшки',
        labelEn: 'Ritual Pot',
        iconUrl: '/icons/categories/pots_n_perfumes.png',
        color: '#f97316',
      },
      {
        id: 'cracked-pot',
        groupId: 'keyItems',
        labelRu: 'Треснувшие горшки',
        labelEn: 'Cracked Pot',
        iconUrl: '/icons/categories/pots_n_perfumes.png',
        color: '#ea580c',
      },
      {
        id: 'perfume-bottle',
        groupId: 'keyItems',
        labelRu: 'Флаконы для духов',
        labelEn: 'Perfume Bottle',
        iconUrl: '/icons/categories/pots_n_perfumes.png',
        color: '#f59e0b',
      },
      {
        id: 'great-rune',
        groupId: 'keyItems',
        labelRu: 'Великие руны',
        labelEn: 'Great Rune',
        iconUrl: '/icons/categories/rune_high.png',
        color: '#eab308',
      },
      {
        id: 'key-item',
        groupId: 'keyItems',
        labelRu: 'Прочие ключевые предметы',
        labelEn: 'Key Item',
        iconUrl: '/icons/categories/curio.png',
        color: '#fb923c',
      },
    ],
  },
  {
    id: 'equipment',
    titleRu: 'Снаряжение',
    titleEn: 'Equipment',
    icon: '⚔️',
    categories: [
      {
        id: 'weapon',
        groupId: 'equipment',
        labelRu: 'Оружие и щиты',
        labelEn: 'Weapon & Shield',
        iconUrl: '/icons/categories/weapon.png',
        color: '#60a5fa',
      },
      {
        id: 'armour',
        groupId: 'equipment',
        labelRu: 'Комплекты брони',
        labelEn: 'Armour',
        iconUrl: '/icons/categories/armor.png',
        color: '#cbd5e1',
      },
      {
        id: 'talisman',
        groupId: 'equipment',
        labelRu: 'Талисманы',
        labelEn: 'Talisman',
        iconUrl: '/icons/categories/talisman.png',
        color: '#c084fc',
      },
      {
        id: 'sorcery',
        groupId: 'equipment',
        labelRu: 'Чародейства',
        labelEn: 'Sorcery',
        iconUrl: '/icons/categories/sorceries.png',
        color: '#38bdf8',
      },
      {
        id: 'incantation',
        groupId: 'equipment',
        labelRu: 'Молитвы',
        labelEn: 'Incantation',
        iconUrl: '/icons/categories/incantation.png',
        color: '#facc15',
      },
      {
        id: 'ashes-of-war',
        groupId: 'equipment',
        labelRu: 'Пепел войны',
        labelEn: 'Ashes of War',
        iconUrl: '/icons/categories/ash.png',
        color: '#a3e635',
      },
      {
        id: 'spirit-ashes',
        groupId: 'equipment',
        labelRu: 'Прах призыва духов',
        labelEn: 'Spirit Ashes',
        iconUrl: '/icons/categories/spirit.png',
        color: '#2dd4bf',
      },
    ],
  },
  {
    id: 'bosses',
    titleRu: 'Боссы и враги',
    titleEn: 'Bosses & Enemies',
    icon: '💀',
    categories: [
      {
        id: 'great-boss',
        groupId: 'bosses',
        labelRu: 'Великие боссы и полубоги',
        labelEn: 'Great Boss & Demigod',
        iconUrl: '/icons/categories/great.png',
        color: '#f87171',
      },
      {
        id: 'boss',
        groupId: 'bosses',
        labelRu: 'Боссы локаций и подземелий',
        labelEn: 'Boss',
        iconUrl: '/icons/categories/boss.png',
        color: '#ef4444',
      },
    ],
  },
  {
    id: 'npcs',
    titleRu: 'Персонажи и торговцы',
    titleEn: 'NPCs & Merchants',
    icon: '🧙',
    categories: [
      {
        id: 'merchant',
        groupId: 'npcs',
        labelRu: 'Кочевые торговцы и NPC',
        labelEn: 'Merchant & NPC',
        iconUrl: '/icons/categories/npc.png',
        color: '#f59e0b',
      },
    ],
  },
  {
    id: 'materials',
    titleRu: 'Материалы и улучшения',
    titleEn: 'Upgrades & Materials',
    icon: '💎',
    categories: [
      {
        id: 'smithing-stone',
        groupId: 'materials',
        labelRu: 'Кузнечные камни',
        labelEn: 'Smithing Stone',
        iconUrl: '/icons/categories/smst.png',
        color: '#94a3b8',
      },
      {
        id: 'somber-smithing-stone',
        groupId: 'materials',
        labelRu: 'Кузнечные камни мрака',
        labelEn: 'Somber Smithing Stone',
        iconUrl: '/icons/categories/smst_high.png',
        color: '#64748b',
      },
      {
        id: 'glovewort',
        groupId: 'materials',
        labelRu: 'Призрачные и могильные ландыши',
        labelEn: 'Glovewort',
        iconUrl: '/icons/categories/glove.png',
        color: '#cbd5e1',
      },
      {
        id: 'crafting-material',
        groupId: 'materials',
        labelRu: 'Материалы для крафта',
        labelEn: 'Crafting Material',
        iconUrl: '/icons/categories/materials.png',
        color: '#78716c',
      },
    ],
  },
  {
    id: 'other',
    titleRu: 'Прочее',
    titleEn: 'Other',
    icon: '✨',
    categories: [
      {
        id: 'painting',
        groupId: 'other',
        labelRu: 'Картины художников',
        labelEn: 'Painting',
        iconUrl: '/icons/categories/painting.png',
        color: '#d97706',
      },
      {
        id: 'gesture',
        groupId: 'other',
        labelRu: 'Жесты',
        labelEn: 'Gesture',
        iconUrl: '/icons/categories/gesture.png',
        color: '#facc15',
      },
      {
        id: 'other',
        groupId: 'other',
        labelRu: 'Прочее и золотые руны',
        labelEn: 'Miscellaneous & Runes',
        iconUrl: '/icons/categories/rune_low.png',
        color: '#d97706',
      },
    ],
  },
];

export const MAPGENIE_CATEGORIES: MapGenieCategory[] = MAPGENIE_GROUPS.flatMap((g) => g.categories);
export const MAPGENIE_CATEGORY_MAP = new Map<string, MapGenieCategory>(
  MAPGENIE_CATEGORIES.map((c) => [c.id, c])
);

/**
 * Classifies any TrackerMarker into its canonical MapGenie category ID
 */
export function classifyMarker(m: TrackerMarker): string {
  const name = m.name || '';
  const nameRu = m.nameRu || '';

  // 1. Locations
  if (m.type === 'grace') return 'grace';
  if (m.category === 'dungeons' || (m.type as string) === 'dungeon') return 'dungeon';
  if (m.type === 'spiritspring') return 'spiritspring';
  if (m.category === 'poi') {
    if (name.includes('Tower') || nameRu.includes('башня')) return 'divine-tower';
    if (name.includes('Minor Erdtree') || nameRu.includes('Малое Древо')) return 'minor-erdtree';
    return 'poi';
  }

  // 2. Bosses
  if (m.type === 'boss-great' || m.type === 'boss-legendary') return 'great-boss';
  if (m.category === 'bosses' || m.type === 'boss') return 'boss';

  // 3. Equipment
  if (m.category === 'weapons') return 'weapon';
  if (m.category === 'armour') return 'armour';
  if (m.category === 'talismans') return 'talisman';
  if (m.category === 'sorceries') return 'sorcery';
  if (m.category === 'incantations') return 'incantation';
  if (m.category === 'ashesOfWar') return 'ashes-of-war';
  if (m.category === 'spiritAshes') return 'spirit-ashes';

  // 4. Key Items
  if (name.includes('Golden Seed') || nameRu.includes('Золотое семечко')) return 'golden-seed';
  if (name.includes('Sacred Tear') || nameRu.includes('Священная')) return 'sacred-tear';
  if (name.includes('Stonesword Key') || nameRu.includes('Мечевидный ключ')) return 'stonesword-key';
  if (name.includes('Larval Tear') || nameRu.includes('Слеза личинки')) return 'larval-tear';
  if (name.includes('Celestial Dew') || nameRu.includes('Небесная роса')) return 'celestial-dew';
  if (name.includes('Dragon Heart') || nameRu.includes('Драконье сердце')) return 'dragon-heart';
  if (name.includes('Deathroot') || nameRu.includes('Корень Смерти')) return 'deathroot';
  if (name.includes('Memory Stone') || nameRu.includes('Камень памяти')) return 'memory-stone';
  if (name.includes('Map:') || nameRu.includes('Карта:') || name.includes('Map Fragment') || nameRu.includes('Фрагмент карты')) return 'map-fragment';
  if (name.includes('Cookbook') || nameRu.includes('Поваренная книга')) return 'cookbook';
  if (name.includes('Great Rune') || nameRu.includes('Великая руна') || nameRu.includes('Руна принца') || nameRu.includes('Руна починки')) return 'great-rune';
  if (name.includes('Ritual Pot') || nameRu.includes('Ритуальный горшок')) return 'ritual-pot';
  if (name.includes('Cracked Pot') || nameRu.includes('Треснувший горшок')) return 'cracked-pot';
  if (name.includes('Perfume Bottle') || nameRu.includes('Флакон для духов')) return 'perfume-bottle';
  if (m.type === 'scadutree-fragment' || name.includes('Scadutree Fragment') || nameRu.includes('Осколок Древа Упадка')) return 'scadutree-fragment';
  if (m.type === 'revered-spirit-ash' || name.includes('Revered Spirit Ash') || nameRu.includes('Прах почитаемого духа')) return 'revered-spirit-ash';
  if (m.category === 'keyItems') return 'key-item';

  // 5. NPCs & Merchants
  if (m.category === 'merchants' || m.type === 'merchant') return 'merchant';

  // 6. Upgrades & Materials
  if (name.includes('Somber') || nameRu.includes('мрака')) return 'somber-smithing-stone';
  if (name.includes('Smithing Stone') || nameRu.includes('Кузнечный камень')) return 'smithing-stone';
  if (name.includes('Glovewort') || nameRu.includes('ландыш')) return 'glovewort';
  if (m.category === 'materials') return 'crafting-material';

  // 7. Other
  if (name.includes('Painting') || nameRu.includes('Картина')) return 'painting';
  if (name.includes('Gesture') || nameRu.includes('Жест')) return 'gesture';

  return 'other';
}
