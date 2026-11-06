import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import type {
  TrackerMarker,
  FilterState,
  CharacterProfile,
  ActiveRoute,
  RouteWaypoint,
  LiveSyncState,
  SaveSlotSummary,
  PlayerLocation,
  LocalSaveInfo,
} from '../types';
import { loadUnifiedMarkers, findNearestGraces, loadItemImages } from '../services/dataService';
import { optimizeRouteOrder, calculateTotalDistance } from '../services/routeService';
import { liveSync } from '../services/liveSyncService';
import { classifyMarker } from '../services/mapGenieCategories.ts';

const STORAGE_KEY_PROFILES = 'er_tracker_profiles_v1';
const STORAGE_KEY_ACTIVE_PROFILE = 'er_tracker_active_profile_v1';
const STORAGE_KEY_SAVE_PATH = 'er_save_path';
const STORAGE_KEY_SAVE_NAME = 'er_save_name';
const STORAGE_KEY_TRACKED_SLOT = 'er_tracked_slot';
const STORAGE_KEY_RANDOMIZER = 'er_is_randomizer';

interface TrackerContextType {
  allMarkers: TrackerMarker[];
  itemImages: Record<string, string>;
  loading: boolean;
  filter: FilterState;
  setFilter: (f: Partial<FilterState> | ((prev: FilterState) => FilterState)) => void;
  profiles: CharacterProfile[];
  currentProfile: CharacterProfile;
  isRandomizer: boolean;
  setIsRandomizer: (val: boolean) => void;
  toggleCollected: (markerId: string) => void;
  toggleWishlist: (markerId: string) => void;
  batchSetCollected: (flagIdsOrMarkerIds: string[], status: boolean) => void;
  createProfile: (name: string) => void;
  switchProfile: (profileId: string) => void;
  deleteProfile: (profileId: string) => void;

  // Route state
  activeRoute: ActiveRoute | null;
  routeStops: TrackerMarker[];
  addToRoute: (marker: TrackerMarker) => void;
  removeFromRoute: (markerId: string) => void;
  clearRoute: () => void;
  optimizeActiveRoute: () => void;
  buildRouteToMarker: (target: TrackerMarker) => void;

  // Active selected marker
  selectedMarker: TrackerMarker | null;
  setSelectedMarker: (m: TrackerMarker | null) => void;

  // Stats
  stats: {
    total: number;
    collected: number;
    percent: number;
    byCategory: Record<string, { total: number; collected: number }>;
    byMapGenieCategory: Record<string, { total: number; collected: number }>;
  };

  // Web Live Tracking & Save Selection
  isSaveConfigured: boolean;
  activeSavePath: string | null;
  activeSaveName: string | null;
  trackedSlotIndex: number;
  liveSyncState: LiveSyncState;
  isLiveSyncSupported: boolean;
  playerLocation: PlayerLocation | null;
  isFollowPlayer: boolean;
  setIsFollowPlayer: React.Dispatch<React.SetStateAction<boolean>>;
  focusPlayerTrigger: number;
  centerOnPlayer: () => void;
  detectLocalSaves: () => Promise<LocalSaveInfo[]>;
  scanFolder: (folderPath: string) => Promise<{ folderPath: string; saves: LocalSaveInfo[]; error?: string }>;
  getSaveSlots: (filePath: string) => Promise<SaveSlotSummary[]>;
  selectSaveAndSlot: (
    savePath: string,
    fileName: string,
    slotIndex: number,
    slotSummary?: SaveSlotSummary
  ) => Promise<{ success: boolean; error?: string }>;
  startLiveSync: (
    targetSlot?: number,
    localSavePath?: string,
    localSaveName?: string
  ) => Promise<{ success: boolean; slots?: SaveSlotSummary[]; error?: string }>;
  stopLiveSync: () => void;
  setTrackedSlot: (slotIndex: number) => void;
  applyParsedSlot: (slot: SaveSlotSummary) => number;
}

const defaultProfile: CharacterProfile = {
  id: 'default-profile-1',
  name: 'Персонаж 1 (Основной)',
  level: 1,
  playtimeSeconds: 0,
  collectedIds: {},
  wishlistIds: {},
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const defaultFilter: FilterState = {
  searchQuery: '',
  activeLayer: 'base-game',
  selectedCategories: ['all'],
  onlyUncollected: false,
  onlyWishlist: false,
  markerScale: 1.15,
};

const TrackerContext = createContext<TrackerContextType | undefined>(undefined);

export const TrackerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [rawMarkers, setRawMarkers] = useState<TrackerMarker[]>([]);
  const [itemImages, setItemImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilterState] = useState<FilterState>(defaultFilter);
  const [selectedMarker, setSelectedMarker] = useState<TrackerMarker | null>(null);

  const allMarkers = rawMarkers;

  // Profiles from localStorage
  const [profiles, setProfiles] = useState<CharacterProfile[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PROFILES);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p) => ({
            ...defaultProfile,
            ...p,
            collectedIds: p.collectedIds || {},
            wishlistIds: p.wishlistIds || {},
          }));
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [defaultProfile];
  });

  const [activeProfileId, setActiveProfileId] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ACTIVE_PROFILE);
      if (stored && profiles.some((p) => p.id === stored)) return stored;
    } catch (e) {
      console.error(e);
    }
    return profiles[0]?.id || defaultProfile.id;
  });

  const currentProfile = useMemo(() => {
    return profiles.find((p) => p.id === activeProfileId) || profiles[0] || defaultProfile;
  }, [profiles, activeProfileId]);

  // Route state
  const [routeStops, setRouteStops] = useState<TrackerMarker[]>([]);
  const [activeRoute, setActiveRoute] = useState<ActiveRoute | null>(null);

  // Save selection & live tracking state
  const [activeSavePath, setActiveSavePath] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY_SAVE_PATH);
  });
  const [activeSaveName, setActiveSaveName] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY_SAVE_NAME);
  });
  const [trackedSlotIndex, setTrackedSlotIndex] = useState<number>(() => {
    const s = localStorage.getItem(STORAGE_KEY_TRACKED_SLOT);
    return s !== null ? parseInt(s, 10) : 0;
  });
  const [isSaveConfigured, setIsSaveConfigured] = useState<boolean>(() => {
    return !!localStorage.getItem(STORAGE_KEY_SAVE_PATH);
  });

  // Randomizer Mode (when enabled, matches strictly by physical world event flags without checking vanilla inventory)
  const [isRandomizer, setIsRandomizerState] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_RANDOMIZER);
    if (saved !== null) return saved === 'true';
    return true; // Default to true for randomizer players
  });

  const setIsRandomizer = useCallback((val: boolean) => {
    setIsRandomizerState(val);
    try {
      localStorage.setItem(STORAGE_KEY_RANDOMIZER, String(val));
    } catch {}
    liveSync.setIsRandomizer(val);
    liveSync.resyncNow();
  }, []);

  useEffect(() => {
    liveSync.setIsRandomizer(isRandomizer);
  }, [isRandomizer]);

  // Track explicit manual user toggles in the UI so they are preserved across save polls
  const [manualOverrides, setManualOverrides] = useState<Record<string, boolean>>({});

  // Web Live Tracking
  const [liveSyncState, setLiveSyncState] = useState<LiveSyncState>({
    enabled: false,
    status: 'idle',
  });
  const [playerLocation, setPlayerLocation] = useState<PlayerLocation | null>(null);
  const [isFollowPlayer, setIsFollowPlayer] = useState<boolean>(false);
  const [focusPlayerTrigger, setFocusPlayerTrigger] = useState<number>(0);

  const centerOnPlayer = useCallback(() => {
    setFocusPlayerTrigger(Date.now());
  }, []);

  const isLiveSyncSupported = useMemo(() => liveSync.isSupported(), []);

  const applyParsedSlot = useCallback((slot: SaveSlotSummary): number => {
    let markerIdsToCollect: string[] = [];

    if (slot.matchedMarkerIds && slot.matchedMarkerIds.length > 0) {
      markerIdsToCollect = slot.matchedMarkerIds;
    } else {
      const flagSet = new Set(slot.matchedFlags);
      for (const m of allMarkers) {
        if (m.flagId && flagSet.has(m.flagId)) {
          markerIdsToCollect.push(m.id);
        }
      }
    }

    setProfiles((prev) =>
      prev.map((prof) => {
        if (prof.id !== currentProfile.id) return prof;
        const newCollected: Record<string, boolean> = { ...prof.collectedIds };
        for (const id of markerIdsToCollect) {
          newCollected[id] = true;
        }
        return {
          ...prof,
          name: slot.name || prof.name,
          level: slot.level || prof.level,
          collectedIds: newCollected,
          updatedAt: Date.now(),
        };
      })
    );

    const targetLayer = slot.playerLocation?.layer || 'base-game';

    setFilterState((prev) => ({
      ...prev,
      onlyUncollected: true,
      activeLayer: targetLayer,
    }));

    if (slot.playerLocation) {
      setPlayerLocation(slot.playerLocation);
    }

    return markerIdsToCollect.length;
  }, [allMarkers, currentProfile.id]);

  useEffect(() => {
    let mounted = true;
    Promise.all([loadUnifiedMarkers(), loadItemImages()]).then(([markers, images]) => {
      if (mounted) {
        setRawMarkers(markers);
        setItemImages(images);
        setLoading(false);

        // Check if user previously configured a save and slot
        const savedPath = localStorage.getItem(STORAGE_KEY_SAVE_PATH);
        const savedSlotStr = localStorage.getItem(STORAGE_KEY_TRACKED_SLOT);
        const savedName = localStorage.getItem(STORAGE_KEY_SAVE_NAME) || 'ER0000.sl2';

        if (savedPath && savedSlotStr !== null) {
          const targetSlot = parseInt(savedSlotStr, 10);
          setActiveSavePath(savedPath);
          setActiveSaveName(savedName);
          setTrackedSlotIndex(targetSlot);
          setIsSaveConfigured(true);

          liveSync
            .startWithLocalSave(savedPath, savedName, markers, targetSlot)
            .then((res) => {
              if (res.success && res.slots) {
                const chosen = res.slots.find((s) => s.index === targetSlot);
                if (chosen) {
                  applyParsedSlot(chosen);
                }
              }
            })
            .catch(() => {});
        } else {
          setIsSaveConfigured(false);
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, [applyParsedSlot]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
      localStorage.setItem(STORAGE_KEY_ACTIVE_PROFILE, activeProfileId);
    } catch (e) {
      console.error(e);
    }
  }, [profiles, activeProfileId]);

  const setFilter = (updater: Partial<FilterState> | ((prev: FilterState) => FilterState)) => {
    setFilterState((prev) => {
      if (typeof updater === 'function') {
        return updater(prev);
      }
      return { ...prev, ...updater };
    });
  };

  const toggleCollected = (markerId: string) => {
    setProfiles((prev) =>
      prev.map((prof) => {
        if (prof.id !== currentProfile.id) return prof;
        const isCurrentlyCollected = !!prof.collectedIds[markerId];
        const nextState = !isCurrentlyCollected;

        setManualOverrides((prevOverrides) => {
          const copy = { ...prevOverrides };
          copy[markerId] = nextState;
          return copy;
        });

                const updated = { ...prof.collectedIds };
        const affectedIds = [markerId];

        // Boss and Loot synchronization:
        // If a boss is defeated, automatically mark its drops as collected!
        // If all drops of a boss are found, mark the boss defeated!
        const targetMarker = allMarkers.find((m) => m.id === markerId);
        if (targetMarker) {
          const isBoss = targetMarker.type.startsWith('boss') || targetMarker.category === 'bosses';
          if (isBoss) {
            const bName = targetMarker.name.toLowerCase().replace(/['"’()]/g, '').trim();
            for (const m of allMarkers) {
              if (m.type === 'item' && m.dropSource && m.layer === targetMarker.layer) {
                const dName = m.dropSource.toLowerCase().replace(/['"’()]/g, '').trim();
                if (dName.includes(bName) || bName.includes(dName)) {
                  const dist = Math.hypot(m.px - targetMarker.px, m.py - targetMarker.py);
                  if (dist < 1200) {
                    affectedIds.push(m.id);
                  }
                }
              }
            }
          } else if (targetMarker.type === 'item' && targetMarker.dropSource) {
            const dName = targetMarker.dropSource.toLowerCase().replace(/['"’()]/g, '').trim();
            let closestBoss: TrackerMarker | null = null;
            let minDist = Infinity;
            for (const m of allMarkers) {
              if ((m.type.startsWith('boss') || m.category === 'bosses') && m.layer === targetMarker.layer) {
                const bName = m.name.toLowerCase().replace(/['"’()]/g, '').trim();
                if (dName.includes(bName) || bName.includes(dName)) {
                  const dist = Math.hypot(m.px - targetMarker.px, m.py - targetMarker.py);
                  if (dist < minDist && dist < 1200) {
                    minDist = dist;
                    closestBoss = m;
                  }
                }
              }
            }
            if (closestBoss) {
              affectedIds.push(closestBoss.id);
            }
          }
        }

        setManualOverrides((prevOverrides) => {
          const copy = { ...prevOverrides };
          for (const id of affectedIds) {
            copy[id] = nextState;
          }
          return copy;
        });

        for (const id of affectedIds) {
          if (nextState) {
            updated[id] = true;
          } else {
            delete updated[id];
          }
        }
        return { ...prof, collectedIds: updated, updatedAt: Date.now() };
      })
    );
  };

  const toggleWishlist = (markerId: string) => {
    setProfiles((prev) =>
      prev.map((prof) => {
        if (prof.id !== currentProfile.id) return prof;
        const updated = { ...prof.wishlistIds };
        if (updated[markerId]) {
          delete updated[markerId];
        } else {
          updated[markerId] = true;
        }
        return { ...prof, wishlistIds: updated, updatedAt: Date.now() };
      })
    );
  };

  const batchSetCollected = (flagIdsOrMarkerIds: string[], status: boolean) => {
    setProfiles((prev) =>
      prev.map((prof) => {
        if (prof.id !== currentProfile.id) return prof;
        const updated = { ...prof.collectedIds };
        for (const id of flagIdsOrMarkerIds) {
          if (status) {
            updated[id] = true;
          } else {
            delete updated[id];
          }
        }
        return { ...prof, collectedIds: updated, updatedAt: Date.now() };
      })
    );
  };

  const createProfile = (name: string) => {
    const newProfile: CharacterProfile = {
      id: `profile-${Date.now()}`,
      name: name.trim() || `Персонаж ${profiles.length + 1}`,
      level: 1,
      playtimeSeconds: 0,
      collectedIds: {},
      wishlistIds: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setProfiles((prev) => [...prev, newProfile]);
    setActiveProfileId(newProfile.id);
  };

  const switchProfile = (profileId: string) => {
    if (profiles.some((p) => p.id === profileId)) {
      setActiveProfileId(profileId);
    }
  };

  const deleteProfile = (profileId: string) => {
    if (profiles.length <= 1) return;
    const remaining = profiles.filter((p) => p.id !== profileId);
    setProfiles(remaining);
    if (activeProfileId === profileId) {
      setActiveProfileId(remaining[0].id);
    }
  };

  const addToRoute = (marker: TrackerMarker) => {
    if (routeStops.some((s) => s.id === marker.id)) return;
    const newStops = [...routeStops, marker];
    setRouteStops(newStops);

    const nearest = findNearestGraces(newStops[0], allMarkers, 1);
    const startGrace = nearest.length > 0 ? nearest[0].grace : undefined;
    const waypoints = optimizeRouteOrder(startGrace || null, newStops);
    const dist = calculateTotalDistance(startGrace || null, waypoints);

    setActiveRoute({
      id: `loot-run-${Date.now()}`,
      title: `Loot Run (${newStops.length} точек)`,
      startGrace,
      waypoints,
      totalDistancePx: dist.distancePx,
      totalDistanceMeters: dist.distanceMeters,
    });
  };

  const buildRouteToMarker = (target: TrackerMarker) => {
    const newStops = [target];
    setRouteStops(newStops);

    const nearest = findNearestGraces(target, allMarkers, 1);
    const startGrace = nearest.length > 0 ? nearest[0].grace : undefined;
    const waypoints = optimizeRouteOrder(startGrace || null, newStops);
    const dist = calculateTotalDistance(startGrace || null, waypoints);

    setActiveRoute({
      id: `loot-run-${Date.now()}`,
      title: `Loot Run (${newStops.length} точек)`,
      startGrace,
      waypoints,
      totalDistancePx: dist.distancePx,
      totalDistanceMeters: dist.distanceMeters,
    });
  };

  const removeFromRoute = (markerId: string) => {
    const updatedStops = routeStops.filter((s) => s.id !== markerId);
    setRouteStops(updatedStops);
    if (updatedStops.length === 0) {
      setActiveRoute(null);
      return;
    }

    const nearest = findNearestGraces(updatedStops[0], allMarkers, 1);
    const startGrace = nearest.length > 0 ? nearest[0].grace : undefined;
    const waypoints = optimizeRouteOrder(startGrace || null, updatedStops);
    const dist = calculateTotalDistance(startGrace || null, waypoints);

    setActiveRoute({
      id: `loot-run-${Date.now()}`,
      title: `Loot Run (${updatedStops.length} точек)`,
      startGrace,
      waypoints,
      totalDistancePx: dist.distancePx,
      totalDistanceMeters: dist.distanceMeters,
    });
  };

  const clearRoute = () => {
    setRouteStops([]);
    setActiveRoute(null);
  };

  const optimizeActiveRoute = () => {
    if (routeStops.length < 2) return;
    const nearest = findNearestGraces(routeStops[0], allMarkers, 1);
    const startGrace = nearest.length > 0 ? nearest[0].grace : undefined;
    const waypoints = optimizeRouteOrder(startGrace || null, routeStops);
    const dist = calculateTotalDistance(startGrace || null, waypoints);

    setActiveRoute((prev) =>
      prev
        ? {
            ...prev,
            startGrace,
            waypoints,
            totalDistancePx: dist.distancePx,
            totalDistanceMeters: dist.distanceMeters,
          }
        : null
    );
  };

  useEffect(() => {
    liveSync.setCallbacks(
      (data) => {
        setProfiles((prev) =>
          prev.map((prof, idx) => {
            const isTarget = prof.id === currentProfile.id || idx === 0;
            if (!isTarget) return prof;

            // Merge save-reported collected markers with active manual overrides
            const newCollected: Record<string, boolean> = { ...data.collectedIds };

            setManualOverrides((prevOverrides) => {
              const updatedOverrides = { ...prevOverrides };
              for (const [mid, state] of Object.entries(prevOverrides)) {
                if (state) {
                  // If save file now naturally has this marker, release the manual override
                  if (data.collectedIds[mid]) {
                    delete updatedOverrides[mid];
                  } else {
                    newCollected[mid] = true;
                  }
                } else {
                  // User explicitly unmarked this marker
                  delete newCollected[mid];
                }
              }
              return updatedOverrides;
            });

            return {
              ...prof,
              name: data.name || prof.name,
              level: data.level || prof.level,
              playtimeSeconds: data.playtimeSeconds || prof.playtimeSeconds,
              collectedIds: newCollected,
              updatedAt: Date.now(),
            };
          })
        );

        // Only use save file playerLocation if live memory tracking is NOT actively providing coordinates
        if (data.playerLocation) {
          setPlayerLocation((currentLoc) => {
            if (currentLoc && Date.now() - (currentLoc.lastUpdated || 0) < 5000) {
              return currentLoc; // Live memory is streaming, ignore stale save file location
            }
            if (data.playerLocation && data.playerLocation.layer) {
              setFilterState((prev) => {
                if (prev.activeLayer !== data.playerLocation!.layer) {
                  return { ...prev, activeLayer: data.playerLocation!.layer };
                }
                return prev;
              });
            }
            return data.playerLocation!;
          });
        }
      },
      (syncState) => {
        setLiveSyncState(syncState);
      },
      (loc) => {
        const charName =
          loc.charName && loc.charName !== 'Погасший'
            ? loc.charName
            : currentProfile.name && currentProfile.name !== 'Персонаж 1 (Основной)'
            ? currentProfile.name
            : 'Погасший';
        const charLevel =
          loc.charLevel && loc.charLevel > 1
            ? loc.charLevel
            : currentProfile.level > 1
            ? currentProfile.level
            : 1;

        setPlayerLocation({
          ...loc,
          charName,
          charLevel,
        });
      }
    );
  }, [currentProfile.id, currentProfile.level, currentProfile.name]);

  const detectLocalSaves = async () => {
    return await liveSync.detectLocalSaves();
  };

  const scanFolder = async (folderPath: string) => {
    return await liveSync.scanFolder(folderPath);
  };

  const getSaveSlots = async (filePath: string) => {
    return await liveSync.getSaveSlots(filePath);
  };

  const selectSaveAndSlot = async (
    savePath: string,
    fileName: string,
    slotIndex: number,
    slotSummary?: SaveSlotSummary
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      localStorage.setItem(STORAGE_KEY_SAVE_PATH, savePath);
      localStorage.setItem(STORAGE_KEY_SAVE_NAME, fileName);
      localStorage.setItem(STORAGE_KEY_TRACKED_SLOT, String(slotIndex));

      setActiveSavePath(savePath);
      setActiveSaveName(fileName);
      setTrackedSlotIndex(slotIndex);
      setIsSaveConfigured(true);

      const res = await liveSync.startWithLocalSave(savePath, fileName, allMarkers, slotIndex);
      if (res.success && res.slots) {
        const chosen = res.slots.find((s) => s.index === slotIndex) || res.slots[0];
        if (chosen) {
          applyParsedSlot(chosen);
        }
      } else if (slotSummary) {
        applyParsedSlot(slotSummary);
      } else if (res.error) {
        return { success: false, error: res.error };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const startLiveSync = async (targetSlot = 0, localSavePath?: string, localSaveName?: string) => {
    if (localSavePath) {
      return await liveSync.startWithLocalSave(localSavePath, localSaveName || 'ER0000.sl2', allMarkers, targetSlot);
    }
    return await liveSync.start(allMarkers, targetSlot);
  };

  const stopLiveSync = () => {
    liveSync.stop();
  };

  const setTrackedSlot = (slotIndex: number) => {
    setTrackedSlotIndex(slotIndex);
    localStorage.setItem(STORAGE_KEY_TRACKED_SLOT, String(slotIndex));
    liveSync.setTrackedSlot(slotIndex, allMarkers);
  };

  const stats = useMemo(() => {
    let total = 0;
    let collected = 0;
    const byCategory: Record<string, { total: number; collected: number }> = {};
    const byMapGenieCategory: Record<string, { total: number; collected: number }> = {};

    for (const m of allMarkers) {
      total++;
      const isCol = !!currentProfile.collectedIds[m.id];
      if (isCol) collected++;

      const cat = m.category || 'other';
      if (!byCategory[cat]) {
        byCategory[cat] = { total: 0, collected: 0 };
      }
      byCategory[cat].total++;
      if (isCol) byCategory[cat].collected++;

      const mgCat = classifyMarker(m);
      if (!byMapGenieCategory[mgCat]) {
        byMapGenieCategory[mgCat] = { total: 0, collected: 0 };
      }
      byMapGenieCategory[mgCat].total++;
      if (isCol) byMapGenieCategory[mgCat].collected++;
    }

    const percent = total > 0 ? Math.round((collected / total) * 100) : 0;
    return { total, collected, percent, byCategory, byMapGenieCategory };
  }, [allMarkers, currentProfile.collectedIds]);

  return (
    <TrackerContext.Provider
      value={{
        allMarkers,
        itemImages,
        loading,
        filter,
        setFilter,
        profiles,
        currentProfile,
        isRandomizer,
        setIsRandomizer,
        toggleCollected,
        toggleWishlist,
        batchSetCollected,
        createProfile,
        switchProfile,
        deleteProfile,
        activeRoute,
        routeStops,
        addToRoute,
        removeFromRoute,
        clearRoute,
        optimizeActiveRoute,
        buildRouteToMarker,
        selectedMarker,
        setSelectedMarker,
        stats,
        isSaveConfigured,
        activeSavePath,
        activeSaveName,
        trackedSlotIndex,
        liveSyncState,
        playerLocation,
        isFollowPlayer,
        setIsFollowPlayer,
        focusPlayerTrigger,
        centerOnPlayer,
        isLiveSyncSupported,
        detectLocalSaves,
        scanFolder,
        getSaveSlots,
        selectSaveAndSlot,
        startLiveSync,
        stopLiveSync,
        setTrackedSlot,
        applyParsedSlot,
      }}
    >
      {children}
    </TrackerContext.Provider>
  );
};

export const useTracker = () => {
  const ctx = useContext(TrackerContext);
  if (!ctx) throw new Error('useTracker must be used within a TrackerProvider');
  return ctx;
};
