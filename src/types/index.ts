export type MapLayerId = 'base-game' | 'base-game-underground' | 'dlc';

export type MarkerType = 
  | 'grace' 
  | 'boss' 
  | 'boss-great' 
  | 'boss-legendary' 
  | 'item' 
  | 'poi' 
  | 'spiritspring' 
  | 'merchant'
  | 'scadutree-fragment'
  | 'revered-spirit-ash';

export type ItemCategory = string;

export interface TrackerMarker {
  id: string;
  type: MarkerType;
  category: string;
  subCategory?: string;
  layer: MapLayerId;
  name: string;
  nameRu: string;
  px: number;
  py: number;
  flagId?: number;
  altFlags?: number[];
  itemKeys?: string[];
  placeName?: string;
  dropSource?: string;
  dropSourceRu?: string;
  description?: string;
  rarity?: number;
}

export interface RouteWaypoint {
  id: string;
  markerId?: string;
  title: string;
  titleRu: string;
  px: number;
  py: number;
  layer: MapLayerId;
  type: MarkerType;
  order: number;
  completed?: boolean;
}

export interface ActiveRoute {
  id: string;
  title: string;
  startGrace?: TrackerMarker;
  waypoints: RouteWaypoint[];
  totalDistancePx: number;
  totalDistanceMeters: number;
}

export interface CharacterProfile {
  id: string;
  name: string;
  characterClass?: string;
  level: number;
  playtimeSeconds: number;
  collectedIds: Record<string, boolean>; // id -> boolean for O(1) lookup
  wishlistIds: Record<string, boolean>;
  createdAt: number;
  updatedAt: number;
}

export interface FilterState {
  searchQuery: string;
  activeLayer: MapLayerId;
  selectedCategories: ItemCategory[];
  onlyUncollected: boolean;
  onlyWishlist: boolean;
  region?: string;
  markerScale?: number; // 0.9 to 1.6 scale
}

export interface LiveSyncState {
  enabled: boolean;
  status: 'idle' | 'checking' | 'active' | 'error';
  lastSyncTime?: number;
  fileName?: string;
  folderPath?: string;
  trackedSlot?: number;
  charName?: string;
  charLevel?: number;
  matchedCount?: number;
  isRandomizer?: boolean;
  error?: string;
}

export interface LocalSaveInfo {
  steamId: string;
  folderPath: string;
  fileName: string;
  path: string;
  size: number;
  mtime: number;
  slots?: SaveSlotSummary[];
  isRandomizer?: boolean;
}

export interface ParseSaveOptions {
  isRandomizer?: boolean;
}

export interface PlayerLocation {
  px: number;
  py: number;
  altitude: number;
  yawDeg: number;
  layer: MapLayerId;
  mapId: string;
  charName: string;
  charLevel: number;
  lastUpdated: number;
}

export interface SaveSlotSummary {
  index: number;
  name: string;
  level: number;
  playtimeFormatted: string;
  bossesDefeatedCount: number;
  gracesUnlockedCount: number;
  matchedFlags: number[];
  matchedMarkerIds?: string[];
  playerLocation?: PlayerLocation;
}

