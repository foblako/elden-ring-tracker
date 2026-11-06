import type { TrackerMarker, FilterState } from '../types';
import { classifyMarker } from './mapGenieCategories.ts';

let cachedMarkers: TrackerMarker[] | null = null;
let cachedImages: Record<string, string> | null = null;

export async function loadItemImages(): Promise<Record<string, string>> {
  if (cachedImages) {
    return cachedImages;
  }
  try {
    const res = await fetch('/data/item-images.json');
    if (res.ok) {
      cachedImages = await res.json();
      return cachedImages!;
    }
  } catch (err) {
    console.warn('Failed to load item images map:', err);
  }
  return {};
}

export function getItemSpecificImage(name: string, imagesMap: Record<string, string>): string | null {
  if (!name || !imagesMap) return null;

  const normalize = (s: string) => s.toLowerCase().trim().replace(/[\u2018\u2019]/g, "'");
  const norm = normalize(name);

  // 1. Exact match
  if (imagesMap[norm]) return imagesMap[norm];

  // 2. Strip upgrade suffix like +1, +2
  const noPlusNum = norm.replace(/\s*\+\s*\d+$/, '').trim();
  if (imagesMap[noPlusNum]) return imagesMap[noPlusNum];

  // 3. Try without dots (e.g. "Sword of St. Trina" -> "sword of st trina")
  const noDots = norm.replace(/\./g, '');
  if (imagesMap[noDots]) return imagesMap[noDots];

  // 4. If bundle "Item A + Item B + Item C", resolve first available image (prioritizing tears/weapons/keys over consumables)
  if (norm.includes('+')) {
    const parts = norm.split('+').map(p => p.trim());
    // Prioritize specialized tears or items over common drops like Furnace Visage
    const priorityPart = parts.find(p => {
      const pl = p.toLowerCase();
      return (pl.includes('tear') || pl.includes('hardtear') || pl.includes('bubbletear')) && !pl.includes('visage');
    });
    if (priorityPart) {
      const match = getItemSpecificImage(priorityPart, imagesMap);
      if (match) return match;
    }
    for (const part of parts) {
      const match = getItemSpecificImage(part, imagesMap);
      if (match) return match;
    }
  }

  // 5. Clean quantities / brackets: [1], [2], x3, 3x
  const clean = norm
    .replace(/\s*\[\d+\]/g, '')
    .replace(/\s*x\d+/g, '')
    .replace(/^\d+x\s*/, '')
    .trim();
  if (imagesMap[clean]) return imagesMap[clean];
  if (imagesMap[clean.replace(/\./g, '')]) return imagesMap[clean.replace(/\./g, '')];

  // 6. Ash of War variations ("Ash of War: X" <-> "Ashes of War: X" <-> "X")
  if (norm.startsWith('ash of war:')) {
    const sub = norm.replace('ash of war:', '').trim();
    if (imagesMap['ashes of war: ' + sub]) return imagesMap['ashes of war: ' + sub];
    if (imagesMap['ash of war: ' + sub]) return imagesMap['ash of war: ' + sub];
    if (imagesMap[sub]) return imagesMap[sub];
  }

  // 7. Suffix/Parenthesis variations like (spell), (talisman), (altered)
  if (imagesMap[`${clean} (spell)`]) return imagesMap[`${clean} (spell)`];
  if (imagesMap[`${clean} (talisman)`]) return imagesMap[`${clean} (talisman)`];

  // 8. Hyphen / apostrophe variations
  const noHyphen = clean.replace(/-/g, ' ');
  if (imagesMap[noHyphen]) return imagesMap[noHyphen];
  const noApos = clean.replace(/'/g, '');
  if (imagesMap[noApos]) return imagesMap[noApos];

  // 9. Pure alphanumeric fallback (e.g. for complex punctuation like "Troll's Roar", "Stamp (Sweep)")
  const alphaNum = norm.replace(/[^a-z0-9]/g, '');
  if (imagesMap[alphaNum]) return imagesMap[alphaNum];
  if (norm.startsWith('ash of war:') || norm.startsWith('ashes of war:')) {
    const subAlpha = norm.replace(/^ash(es)? of war:\s*/i, '').replace(/[^a-z0-9]/g, '');
    if (imagesMap[subAlpha]) return imagesMap[subAlpha];
  }

  return null;
}

export async function loadUnifiedMarkers(): Promise<TrackerMarker[]> {
  if (cachedMarkers) {
    return cachedMarkers;
  }

  try {
    const res = await fetch('/data/unified-markers.json');
    if (!res.ok) {
      throw new Error(`Failed to load markers: ${res.statusText}`);
    }
    const data: TrackerMarker[] = await res.json();
    cachedMarkers = data;
    return data;
  } catch (err) {
    console.error('Error loading unified markers:', err);
    return [];
  }
}

export function filterMarkers(
  markers: TrackerMarker[],
  filter: FilterState,
  collectedMap: Record<string, boolean>,
  wishlistMap: Record<string, boolean>
): TrackerMarker[] {
  const { searchQuery, activeLayer, selectedCategories, onlyUncollected, onlyWishlist } = filter;
  const q = searchQuery.trim().toLowerCase();
  const searchTokens = q ? q.split(/\s+/).filter(Boolean) : null;
  const isAllCategories = selectedCategories.length === 0 || selectedCategories.includes('all');
  const catSet = isAllCategories ? null : new Set(selectedCategories);

  return markers.filter((m) => {
    // 1. Layer filter (fastest check)
    if (m.layer !== activeLayer) {
      return false;
    }

    const isCollected = !!collectedMap[m.id];
    const isWishlisted = !!wishlistMap[m.id];

    // 2. Uncollected filter
    if (onlyUncollected && isCollected) {
      return false;
    }

    // 3. Wishlist filter
    if (onlyWishlist && !isWishlisted) {
      return false;
    }

    // 4. Category filter (MapGenie subcategories)
    if (catSet) {
      const cat = classifyMarker(m);
      if (!catSet.has(cat) && !catSet.has(m.category as any)) {
        return false;
      }
    }

    // 5. Search query (matches all tokens against name, nameRu, placeName, dropSource)
    if (searchTokens) {
      const name = m.name.toLowerCase();
      const nameRu = (m.nameRu || '').toLowerCase();
      const place = (m.placeName || '').toLowerCase();
      const drop = (m.dropSource || '').toLowerCase();
      const dropRu = (m.dropSourceRu || '').toLowerCase();
      const desc = (m.description || '').toLowerCase();

      for (const token of searchTokens) {
        if (
          !name.includes(token) &&
          !nameRu.includes(token) &&
          !place.includes(token) &&
          !drop.includes(token) &&
          !dropRu.includes(token) &&
          !desc.includes(token)
        ) {
          return false;
        }
      }
    }

    return true;
  });
}

/** Find closest Sites of Grace on the same layer */
export function findNearestGraces(
  targetMarker: TrackerMarker,
  allMarkers: TrackerMarker[],
  limit = 5
): Array<{ grace: TrackerMarker; distanceMeters: number; distancePx: number; bearingDegrees: number }> {
  const graces = allMarkers.filter((m) => m.type === 'grace' && m.layer === targetMarker.layer && m.id !== targetMarker.id);

  const results = graces.map((g) => {
    const dx = targetMarker.px - g.px;
    const dy = targetMarker.py - g.py;
    const distancePx = Math.sqrt(dx * dx + dy * dy);
    const distanceMeters = Math.round(distancePx);

    let angleRad = Math.atan2(dx, -dy);
    if (angleRad < 0) angleRad += 2 * Math.PI;
    const bearingDegrees = Math.round((angleRad * 180) / Math.PI);

    return {
      grace: g,
      distancePx,
      distanceMeters,
      bearingDegrees,
    };
  });

  results.sort((a, b) => a.distancePx - b.distancePx);
  return results.slice(0, limit);
}

export function formatBearing(degrees: number): string {
  const directions = [
    'Север (N)',
    'Северо-восток (NE)',
    'Восток (E)',
    'Юго-восток (SE)',
    'Юг (S)',
    'Юго-запад (SW)',
    'Запад (W)',
    'Северо-запад (NW)',
  ];
  const idx = Math.round(degrees / 45) % 8;
  return directions[idx];
}
