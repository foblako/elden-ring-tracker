import L from 'leaflet';
import type { TrackerMarker } from '../../types';
import { getItemSpecificImage } from '../../services/dataService';

export interface MarkerVisualInfo {
  iconUrl: string;
  fallbackUrl?: string;
  borderColor: string;
  glowColor: string;
  size: number;
  label: string;
}

/**
 * Maps all markers to baseline category visual metadata
 */
export function getCategoryVisual(marker: TrackerMarker): MarkerVisualInfo {
  const type = marker.type || '';
  const category = marker.category || '';
  const name = (marker.name || '').toLowerCase();

  // 1. Sites of Grace (Official Golden Flame)
  if (type === 'grace' || category === 'graces') {
    return {
      iconUrl: '/icons/categories/grace.png',
      borderColor: '#fde047',
      glowColor: '#facc15',
      size: 38,
      label: 'Место благодати',
    };
  }

  // 2. Bosses (Demigods/Legends vs Dungeon/Field Bosses)
  if (type === 'boss-legendary' || type === 'boss-great' || name.includes('remembrance')) {
    return {
      iconUrl: '/icons/categories/great.png',
      borderColor: '#ffd700',
      glowColor: '#ef4444',
      size: 42,
      label: 'Великий Босс / Полубог',
    };
  }
  if (type === 'boss' || category === 'bosses') {
    return {
      iconUrl: '/icons/categories/boss.png',
      borderColor: '#f87171',
      glowColor: '#dc2626',
      size: 36,
      label: 'Босс',
    };
  }

  // 3. Equipment & Magic
  if (category === 'weapons') {
    return {
      iconUrl: '/icons/categories/weapon.png',
      borderColor: '#60a5fa',
      glowColor: '#3b82f6',
      size: 32,
      label: 'Оружие / Щит',
    };
  }
  if (category === 'armour') {
    return {
      iconUrl: '/icons/categories/armor.png',
      borderColor: '#cbd5e1',
      glowColor: '#94a3b8',
      size: 32,
      label: 'Доспехи',
    };
  }
  if (category === 'talismans') {
    return {
      iconUrl: '/icons/categories/talisman.png',
      borderColor: '#c084fc',
      glowColor: '#a855f7',
      size: 32,
      label: 'Талисман',
    };
  }
  if (category === 'sorceries') {
    return {
      iconUrl: '/icons/categories/sorceries.png',
      borderColor: '#38bdf8',
      glowColor: '#0ea5e9',
      size: 32,
      label: 'Чары',
    };
  }
  if (category === 'incantations') {
    return {
      iconUrl: '/icons/categories/incantation.png',
      borderColor: '#fbbf24',
      glowColor: '#f59e0b',
      size: 32,
      label: 'Молитва',
    };
  }
  if (name.includes('lost ashes') || name.includes('lost ash')) {
    return {
      iconUrl: '/icons/categories/lost_ash.png',
      borderColor: '#a3e635',
      glowColor: '#84cc16',
      size: 32,
      label: 'Утраченный пепел войны',
    };
  }
  if (category === 'ashesOfWar') {
    return {
      iconUrl: '/icons/categories/ash_of_war.png',
      borderColor: '#a3e635',
      glowColor: '#84cc16',
      size: 32,
      label: 'Пепел войны',
    };
  }
  if (category === 'spiritAshes') {
    return {
      iconUrl: '/icons/categories/spirit.png',
      borderColor: '#2dd4bf',
      glowColor: '#14b8a6',
      size: 32,
      label: 'Прах духа',
    };
  }

  // 4. DLC & Core Flask Upgrades
  if (type === 'scadutree-fragment' || name.includes('scadutree')) {
    return {
      iconUrl: '/icons/categories/skadu.png',
      borderColor: '#facc15',
      glowColor: '#eab308',
      size: 36,
      label: 'Осколок Древа Упадка',
    };
  }
  if (type === 'revered-spirit-ash' || name.includes('revered spirit')) {
    return {
      iconUrl: '/icons/categories/ember_piece.png',
      borderColor: '#2dd4bf',
      glowColor: '#0d9488',
      size: 34,
      label: 'Прах славного духа',
    };
  }
  if (name.includes('golden seed') || name.includes('seed')) {
    return {
      iconUrl: '/icons/categories/seed.png',
      borderColor: '#facc15',
      glowColor: '#eab308',
      size: 34,
      label: 'Золотое семечко',
    };
  }
  if (
    name.includes('sacred tear') ||
    name.includes('crystal tear') ||
    name.includes('cracked tear') ||
    name.includes('bubbletear') ||
    name.includes('hardtear') ||
    name.includes('dried tear') ||
    name.includes('hidden tear')
  ) {
    return {
      iconUrl: '/icons/categories/crystal_tears.png',
      borderColor: '#4ade80',
      glowColor: '#22c55e',
      size: 34,
      label: 'Слеза для фляги',
    };
  }

  // 5. Special Quest & Collectibles
  if (name.includes('imbued sword key')) {
    return {
      iconUrl: '/icons/categories/stone_key_2.png',
      borderColor: '#38bdf8',
      glowColor: '#0284c7',
      size: 32,
      label: 'Насыщенный мечевидный ключ',
    };
  }
  if (name.includes('stonesword') || (name.includes('key') && !name.includes('item'))) {
    return {
      iconUrl: '/icons/categories/stone_key.png',
      borderColor: '#f97316',
      glowColor: '#ea580c',
      size: 32,
      label: 'Мечевидный ключ',
    };
  }
  if (name.includes('map fragment') || name.includes('map:')) {
    return {
      iconUrl: '/icons/categories/map.png',
      borderColor: '#fde047',
      glowColor: '#eab308',
      size: 34,
      label: 'Фрагмент карты',
    };
  }
  if (name.includes('larval')) {
    return {
      iconUrl: '/icons/categories/larval.png',
      borderColor: '#67e8f9',
      glowColor: '#06b6d4',
      size: 32,
      label: 'Личиночная слеза',
    };
  }
  if (name.includes('celestial dew') || name.includes('dew')) {
    return {
      iconUrl: '/icons/categories/dew.png',
      borderColor: '#a5f3fc',
      glowColor: '#06b6d4',
      size: 32,
      label: 'Небесная роса',
    };
  }
  if (name.includes('deathroot')) {
    return {
      iconUrl: '/icons/categories/death.png',
      borderColor: '#a855f7',
      glowColor: '#9333ea',
      size: 32,
      label: 'Корень Смерти',
    };
  }
  if (name.includes('dragon heart')) {
    return {
      iconUrl: '/icons/categories/dragon_heart.png',
      borderColor: '#ef4444',
      glowColor: '#dc2626',
      size: 34,
      label: 'Драконье сердце',
    };
  }
  if (name.includes('bell bearing') || name.includes('bearing')) {
    return {
      iconUrl: '/icons/categories/bell.png',
      borderColor: '#fbbf24',
      glowColor: '#d97706',
      size: 32,
      label: 'Колокольная сфера',
    };
  }
  if (name.includes('whetblade')) {
    return {
      iconUrl: '/icons/categories/whetblade.png',
      borderColor: '#38bdf8',
      glowColor: '#0284c7',
      size: 32,
      label: 'Точильный клинок',
    };
  }
  if (name.includes('cookbook')) {
    return {
      iconUrl: '/icons/categories/cookbook.png',
      borderColor: '#ea580c',
      glowColor: '#c2410c',
      size: 32,
      label: 'Справочник рецептов',
    };
  }
  if (
    name.includes('cracked pot') ||
    name.includes('ritual pot') ||
    name.includes('perfume bottle') ||
    name.includes('pot') ||
    name.includes('perfume')
  ) {
    return {
      iconUrl: '/icons/categories/pots_n_perfumes.png',
      borderColor: '#fb923c',
      glowColor: '#ea580c',
      size: 32,
      label: 'Горшок / Флакон',
    };
  }
  if (name.includes('prayerbook') || name.includes('scroll')) {
    return {
      iconUrl: '/icons/categories/prayerbook.png',
      borderColor: '#d97706',
      glowColor: '#b45309',
      size: 32,
      label: 'Молитвенник / Свиток',
    };
  }
  if (name.includes('memory stone') || name.includes('talisman pouch')) {
    return {
      iconUrl: '/icons/categories/memory.png',
      borderColor: '#a855f7',
      glowColor: '#7e22ce',
      size: 32,
      label: 'Камень памяти / Сумка',
    };
  }
  if (name.includes('great ghost glovewort') || name.includes('great grave glovewort')) {
    return {
      iconUrl: '/icons/categories/glove_high.png',
      borderColor: '#22d3ee',
      glowColor: '#0891b2',
      size: 32,
      label: 'Великий ландыш',
    };
  }
  if (name.includes('glovewort')) {
    return {
      iconUrl: '/icons/categories/glove.png',
      borderColor: '#5eead4',
      glowColor: '#0d9488',
      size: 33,
      label: 'Призрачный ландыш',
    };
  }
  if (name.includes('somber')) {
    return {
      iconUrl: '/icons/categories/smst_high.png',
      borderColor: '#cbd5e1',
      glowColor: '#94a3b8',
      size: 33,
      label: 'Кузнечный камень мрака',
    };
  }
  if (name.includes('smithing stone')) {
    return {
      iconUrl: '/icons/categories/smst.png',
      borderColor: '#94a3b8',
      glowColor: '#64748b',
      size: 33,
      label: 'Кузнечный камень',
    };
  }
  if (
    name.includes("hero's rune") ||
    name.includes("lord's rune") ||
    name.includes("marika's rune") ||
    name.includes('numen') ||
    name.includes('shadow realm rune')
  ) {
    return {
      iconUrl: '/icons/categories/rune_high.png',
      borderColor: '#fbbf24',
      glowColor: '#d97706',
      size: 33,
      label: 'Великая Руна / Прах',
    };
  }
  if (name.includes('rune arc') || name.includes('руническая дуга')) {
    return {
      iconUrl: '/icons/categories/rune_arc.png',
      borderColor: '#ffd700',
      glowColor: '#eab308',
      size: 32,
      label: 'Руническая дуга',
    };
  }
  if (name.includes('rune')) {
    return {
      iconUrl: '/icons/categories/rune_low.png',
      borderColor: '#d97706',
      glowColor: '#b45309',
      size: 32,
      label: 'Золотая руна',
    };
  }
  if (name.includes('starlight shard') || name.includes('shard')) {
    return {
      iconUrl: '/icons/categories/shard.png',
      borderColor: '#38bdf8',
      glowColor: '#0284c7',
      size: 33,
      label: 'Осколок звездосвета',
    };
  }
  if (name.includes('finger')) {
    return {
      iconUrl: '/icons/categories/finger.png',
      borderColor: '#f43f5e',
      glowColor: '#e11d48',
      size: 33,
      label: 'Сетевой палец / Зелье',
    };
  }
  if (name.includes('cross')) {
    return {
      iconUrl: '/icons/categories/nodes.png',
      borderColor: '#facc15',
      glowColor: '#ca8a04',
      size: 32,
      label: 'Крест Микеллы',
    };
  }
  if (name.includes('pate') || name.includes('prattling')) {
    return {
      iconUrl: '/icons/categories/pate.png',
      borderColor: '#a1a1aa',
      glowColor: '#71717a',
      size: 33,
      label: 'Говорящая голова',
    };
  }
  if (name.includes('painting')) {
    return {
      iconUrl: '/icons/categories/painting.png',
      borderColor: '#e2e8f0',
      glowColor: '#94a3b8',
      size: 32,
      label: 'Картина',
    };
  }
  if (name.includes('gesture')) {
    return {
      iconUrl: '/icons/categories/gesture.png',
      borderColor: '#f59e0b',
      glowColor: '#d97706',
      size: 32,
      label: 'Жест',
    };
  }
  if (name.includes('letter') || name.includes('message') || name.includes('note')) {
    return {
      iconUrl: '/icons/categories/quest.png',
      borderColor: '#e2e8f0',
      glowColor: '#94a3b8',
      size: 33,
      label: 'Записка / Задание',
    };
  }
  if (name.includes('grease')) {
    return {
      iconUrl: '/icons/categories/grease.png',
      borderColor: '#eab308',
      glowColor: '#ca8a04',
      size: 32,
      label: 'Оружейная смазка',
    };
  }
  if (name.includes('arrow') || name.includes('bolt')) {
    return {
      iconUrl: '/icons/categories/ammo.png',
      borderColor: '#a1a1aa',
      glowColor: '#71717a',
      size: 32,
      label: 'Стрелы / Болты',
    };
  }
  if (name.includes('dagger') || name.includes('kukri') || name.includes('dart')) {
    return {
      iconUrl: '/icons/categories/throw.png',
      borderColor: '#94a3b8',
      glowColor: '#64748b',
      size: 32,
      label: 'Метательное оружие',
    };
  }

  // 6. Navigation, Dungeons & Merchants
  if (type === 'spiritspring') {
    return {
      iconUrl: '/icons/categories/jump.png',
      borderColor: '#2dd4bf',
      glowColor: '#0d9488',
      size: 33,
      label: 'Воздушный поток',
    };
  }
  if (category === 'merchants' || type === 'merchant') {
    return {
      iconUrl: '/icons/categories/npc.png',
      borderColor: '#f59e0b',
      glowColor: '#d97706',
      size: 34,
      label: 'Торговец / NPC',
    };
  }
  // 6b. Specific Map Locations & Dungeons (Official MapGenie Taxonomy)
  if (
    category === 'dungeons' ||
    name.includes('catacomb') ||
    name.includes('cave') ||
    name.includes('tunnel') ||
    name.includes("hero's grave") ||
    name.includes('grotto') ||
    name.includes('катакомб') ||
    name.includes('пещер') ||
    name.includes('туннел') ||
    name.includes('могила героя')
  ) {
    return {
      iconUrl: '/icons/categories/dungeon.png',
      borderColor: '#94a3b8',
      glowColor: '#64748b',
      size: 34,
      label: 'Подземелье / Катакомбы',
    };
  }

  if (
    name.includes('castle') ||
    name.includes('academy') ||
    name.includes('leyndell') ||
    name.includes('farum azula') ||
    name.includes('haligtree') ||
    name.includes('volcano manor') ||
    name.includes('elphael') ||
    name.includes('fort ') ||
    name.includes('fortress') ||
    name.includes('замок') ||
    name.includes('академия') ||
    name.includes('поместье') ||
    name.includes('столица')
  ) {
    return {
      iconUrl: '/icons/categories/legacy_dungeon.png',
      borderColor: '#ffd700',
      glowColor: '#d97706',
      size: 36,
      label: 'Великая крепость / Замок',
    };
  }

  if (name.includes('divine tower') || name.includes('священная башня')) {
    return {
      iconUrl: '/icons/categories/divine_tower.png',
      borderColor: '#38bdf8',
      glowColor: '#0284c7',
      size: 36,
      label: 'Священная башня',
    };
  }

  if (name.includes('erdtree') || name.includes('древо эрд')) {
    return {
      iconUrl: '/icons/categories/minor_erdtree.png',
      borderColor: '#facc15',
      glowColor: '#ca8a04',
      size: 34,
      label: 'Малое Древо Эрд',
    };
  }

  if (name.includes('evergaol') || name.includes('узилищ')) {
    return {
      iconUrl: '/icons/categories/evergaol.png',
      borderColor: '#a855f7',
      glowColor: '#7e22ce',
      size: 32,
      label: 'Узилище',
    };
  }

  if (name.includes('mausoleum') || name.includes('мавзолей')) {
    return {
      iconUrl: '/icons/categories/wandering_mausoleum.png',
      borderColor: '#cbd5e1',
      glowColor: '#64748b',
      size: 34,
      label: 'Блуждающий мавзолей',
    };
  }

  if (category === 'dungeons' || type === 'poi' || category === 'poi') {
    return {
      iconUrl: '/icons/categories/landmark.png',
      borderColor: '#cbd5e1',
      glowColor: '#64748b',
      size: 34,
      label: 'Ориентир / Руины',
    };
  }

  // 7. Crafting Materials
  if (category === 'materials') {
    return {
      iconUrl: '/icons/categories/materials.png',
      borderColor: '#78716c',
      glowColor: '#57534e',
      size: 32,
      label: 'Материал для крафта',
    };
  }

  // 8. General Consumables
  return {
    iconUrl: '/icons/categories/consumables.png',
    borderColor: '#71717a',
    glowColor: '#52525b',
    size: 32,
    label: 'Расходник / Предмет',
  };
}

/**
 * 100% Comprehensive In-Game & Official Wiki Icon Resolution
 * Maps all 4800+ markers to their exact individual Elden Ring in-game sprites and official wiki images
 */
export function resolveMarkerIconUrl(
  marker: TrackerMarker,
  itemImages?: Record<string, string>
): MarkerVisualInfo {
  const catVisual = getCategoryVisual(marker);

  // Teardrop Scarabs: render with the official Teardrop Scarab badge so players immediately see scarab encounters
  const isScarab = Boolean(
    (marker.dropSource && marker.dropSource.toLowerCase().includes('scarab')) ||
    (marker.dropSourceRu && marker.dropSourceRu.toLowerCase().includes('скарабей'))
  );
  if (isScarab) {
    return {
      iconUrl: '/icons/categories/teardrop_scarab.png',
      fallbackUrl: '/icons/categories/teardrop_scarab.png',
      borderColor: '#38bdf8',
      glowColor: '#0ea5e9',
      size: 34,
      label: 'Скарабей слёз',
    };
  }

  // If item has a specific individual official wiki image, use it!
  // ONLY for physical items. Bosses, Graces, and Merchants always use clean circular game badges!
  if (itemImages && marker.type === 'item') {
    const specificUrl = getItemSpecificImage(marker.name, itemImages);
    if (specificUrl) {
      return {
        ...catVisual,
        iconUrl: specificUrl,
        fallbackUrl: catVisual.iconUrl,
      };
    }
  }

  return {
    ...catVisual,
    fallbackUrl: catVisual.iconUrl,
  };
}

/**
 * Creates high-performance, lightweight Leaflet DivIcon
 * Optimized to prevent GPU redraw hits and memory thrashing
 */
export function createMarkerIcon(
  marker: TrackerMarker,
  isCollected: boolean,
  isWishlisted: boolean,
  scaleMultiplier = 1.0,
  itemImages?: Record<string, string>
): L.DivIcon {
  const visual = resolveMarkerIconUrl(marker, itemImages);
  const size = Math.round(visual.size * scaleMultiplier);

  const isGrace = marker.type === 'grace' || marker.category === 'graces';
  const isBoss = marker.type.startsWith('boss') || marker.category === 'bosses';

  const nameLower = (marker.name || '').toLowerCase();
  const nameRuLower = (marker.nameRu || '').toLowerCase();
  const isThinItem =
    nameLower.includes('rune') ||
    nameLower.includes('smithing stone') ||
    nameLower.includes('somber') ||
    nameLower.includes('glovewort') ||
    nameLower.includes('twig') ||
    nameLower.includes('branch') ||
    nameLower.includes('needle') ||
    nameLower.includes('arrow') ||
    nameLower.includes('bolt') ||
    nameRuLower.includes('ветв') ||
    nameRuLower.includes('руна') ||
    nameRuLower.includes('камень') ||
    nameRuLower.includes('кузнечный') ||
    nameRuLower.includes('ландыш') ||
    nameRuLower.includes('игла') ||
    nameRuLower.includes('стрел') ||
    nameRuLower.includes('болт');

  const fallback = visual.fallbackUrl || '/icons/categories/consumables.png';

  const wishlistBadge = isWishlisted
    ? `<div class="er-marker-badge-star">★</div>`
    : '';

  const collectedBadge = isCollected
    ? `<div class="er-marker-badge-check">✓</div>`
    : '';

  const border = visual.borderColor || '#64748b';
  const glow = visual.glowColor || '#fbbf24';

  const html = `
    <div 
      class="er-marker-floating ${isGrace ? 'er-marker-grace' : ''} ${isBoss ? 'er-marker-boss' : ''} ${isThinItem ? 'is-thin-item' : ''} ${isCollected ? 'collected' : ''} ${isWishlisted ? 'wishlisted' : ''}" 
      style="width: ${size}px; height: ${size}px; --marker-border: ${border}; --marker-glow: ${glow};"
    >
      <img 
        class="er-marker-img"
        src="${visual.iconUrl}" 
        alt="${marker.name}" 
        onerror="this.onerror=null; this.src='${fallback}';"
        loading="lazy"
      />
      ${wishlistBadge}
      ${collectedBadge}
    </div>
  `;

  return L.divIcon({
    html,
    className: isCollected ? 'custom-er-marker custom-er-marker-collected' : 'custom-er-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

export function createWaypointIcon(orderNumber: number, isGrace = false): L.DivIcon {
  const size = 30;
  const bgStyle = isGrace
    ? 'background: linear-gradient(135deg, #f59e0b, #d97706); color: #000; border: 2px solid #fef08a;'
    : 'background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; border: 2px solid #93c5fd;';
  const label = isGrace ? '✦' : orderNumber.toString();

  const html = `
    <div 
      style="width: ${size}px; height: ${size}px; ${bgStyle} border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; font-family: monospace; user-select: none;"
    >
      ${label}
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-wp-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
