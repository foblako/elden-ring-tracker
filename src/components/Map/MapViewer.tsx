import React, { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import { useTracker } from '../../context/TrackerContext';
import { filterMarkers } from '../../services/dataService';
import { createMarkerIcon, createWaypointIcon, resolveMarkerIconUrl } from './markerIcons';
import type { TrackerMarker } from '../../types';

interface MountedMarkerEntry {
  marker: L.Marker;
  isCollected: boolean;
  isWishlisted: boolean;
  scale: number;
  iconUrl?: string;
}

/**
 * Intelligent radial separation for close/overlapping markers in screen-space
 * Ensures every marker is clearly visible and clickable without stacking
 */
function computeDeclutteredPositions(
  markers: TrackerMarker[],
  map: L.Map
): Map<string, L.LatLng> {
  const result = new Map<string, L.LatLng>();
  const zoom = map.getZoom();

  // At high zoom levels (>= 5.2) or regional/world zoom (<= 4.2), preserve coordinates directly for 60fps performance
  if (zoom >= 5.2 || zoom <= 4.2) {
    for (let i = 0; i < markers.length; i++) {
      const m = markers[i];
      result.set(m.id, map.unproject([m.px, m.py], 6));
    }
    return result;
  }

  // Fast O(N) spatial grid collision decluttering (28px screen-space buckets)
  const cellSize = 28;
  const grid = new Map<string, TrackerMarker[]>();

  for (let i = 0; i < markers.length; i++) {
    const m = markers[i];
    const pt = map.latLngToLayerPoint(map.unproject([m.px, m.py], 6));
    const cellKey = `${Math.floor(pt.x / cellSize)}:${Math.floor(pt.y / cellSize)}`;
    let bucket = grid.get(cellKey);
    if (!bucket) {
      bucket = [];
      grid.set(cellKey, bucket);
    }
    bucket.push(m);
  }

  grid.forEach((bucket) => {
    if (bucket.length === 1) {
      const m = bucket[0];
      result.set(m.id, map.unproject([m.px, m.py], 6));
    } else {
      const first = bucket[0];
      const basePt = map.latLngToLayerPoint(map.unproject([first.px, first.py], 6));
      const N = bucket.length;
      const radius = Math.min(36, 16 + (N - 2) * 4);
      for (let k = 0; k < N; k++) {
        const theta = (2 * Math.PI * k) / N - Math.PI / 2;
        const offsetPt = L.point(
          basePt.x + radius * Math.cos(theta),
          basePt.y + radius * Math.sin(theta)
        );
        result.set(bucket[k].id, map.layerPointToLatLng(offsetPt));
      }
    }
  });

  return result;
}

export const MapViewer: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);
  const routeGroupRef = useRef<L.LayerGroup | null>(null);
  const playerGroupRef = useRef<L.LayerGroup | null>(null);
  const playerMarkerRef = useRef<L.Marker | null>(null);
  const lastCameraPanRef = useRef<number>(0);

  // Active markers pool for minimal DOM operations
  const activeMarkersRef = useRef<Map<string, MountedMarkerEntry>>(new Map());

  const {
    allMarkers,
    itemImages,
    filter,
    setFilter,
    currentProfile,
    toggleCollected,
    toggleWishlist,
    activeRoute,
    buildRouteToMarker,
    addToRoute,
    setSelectedMarker,
    playerLocation,
    isFollowPlayer,
    setIsFollowPlayer,
    focusPlayerTrigger,
    centerOnPlayer,
  } = useTracker();

  // Stable references for popup callbacks
  const callbacksRef = useRef({
    toggleCollected,
    toggleWishlist,
    buildRouteToMarker,
    addToRoute,
    setSelectedMarker,
  });

  useEffect(() => {
    callbacksRef.current = {
      toggleCollected,
      toggleWishlist,
      buildRouteToMarker,
      addToRoute,
      setSelectedMarker,
    };
  }, [toggleCollected, toggleWishlist, buildRouteToMarker, addToRoute, setSelectedMarker]);

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      crs: L.CRS.Simple,
      minZoom: 1,
      maxZoom: 9,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      wheelPxPerZoomLevel: 80,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
    });

    // Native zoom level is 6 (10496 x 10496 pixels)
    const southWest = map.unproject([0, 10496], 6);
    const northEast = map.unproject([10496, 0], 6);
    const bounds = new L.LatLngBounds(southWest, northEast);
    map.setMaxBounds(bounds);

    // Initial center on Limgrave / The First Step
    const initialCenter = map.unproject([3695, 7359], 6);
    map.setView(initialCenter, 3);

    // Zoom control at bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Layer groups for markers, routes, and live player beacon
    const markerGroup = L.layerGroup().addTo(map);
    const routeGroup = L.layerGroup().addTo(map);
    const playerGroup = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    markerGroupRef.current = markerGroup;
    routeGroupRef.current = routeGroup;
    playerGroupRef.current = playerGroup;

    // Automatic map resize on sidebar collapse/expand
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      activeMarkersRef.current.clear();
    };
  }, []);

  // 2. Base Tile Layer Swap
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const southWest = map.unproject([0, 10496], 6);
    const northEast = map.unproject([10496, 0], 6);
    const bounds = new L.LatLngBounds(southWest, northEast);

    const tileUrl = `https://pub-238a4d612158463b976849e111f93946.r2.dev/tiles-native/${filter.activeLayer}/{z}/{x}/{y}.webp`;

    const newTileLayer = L.tileLayer(tileUrl, {
      bounds,
      minZoom: 1,
      maxZoom: 9,
      maxNativeZoom: 6,
      noWrap: true,
      errorTileUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"/>',
    }).addTo(map);

    tileLayerRef.current = newTileLayer;

    // Pan map to layer center
    if (filter.activeLayer === 'base-game') {
      map.panTo(map.unproject([3700, 7300], 6));
    } else if (filter.activeLayer === 'base-game-underground') {
      map.panTo(map.unproject([3500, 5000], 6));
    } else if (filter.activeLayer === 'dlc') {
      map.panTo(map.unproject([5300, 4800], 6));
    }
  }, [filter.activeLayer]);

  // Create authentic 1:1 MapGenie popup DOM
  const createPopupContent = useCallback((m: TrackerMarker, isCollected: boolean, isWishlisted: boolean) => {
    const visual = resolveMarkerIconUrl(m, itemImages);
    const container = document.createElement('div');
    container.className = 'p-3 max-w-[280px] bg-[#161a24] text-[#e2e8f0] font-sans rounded-xl border border-[#2b3346] shadow-2xl';

    const header = document.createElement('div');
    header.className = 'border-b border-[#242b3b] pb-2.5';

    const fallbackImg = visual.fallbackUrl || '/icons/categories/consumables.png';
    const mainTitle = m.nameRu || m.name;
    const subTitle = m.nameRu && m.nameRu !== m.name ? m.name : '';

    header.innerHTML = `
      <div class="flex items-start gap-2.5">
        <div class="w-10 h-10 flex-shrink-0 flex items-center justify-center p-0.5">
          <img 
            src="${visual.iconUrl}" 
            alt="${m.name}" 
            onerror="this.onerror=null; this.src='${fallbackImg}';"
            class="w-full h-full object-contain pointer-events-none" 
            style="filter: drop-shadow(0 2px 5px rgba(0,0,0,0.9)) drop-shadow(0 0 6px ${visual.glowColor});"
          />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-1">
            <span 
              class="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider uppercase"
              style="color: ${visual.borderColor}; background-color: ${visual.borderColor}20;"
            >
              ${visual.label}
            </span>
            <span class="text-[9px] text-zinc-500 font-mono">
              ${Math.round(m.px)}, ${Math.round(m.py)}
            </span>
          </div>
          <h3 class="font-cinzel font-bold text-sm text-[#f5d38a] mt-1 leading-snug line-clamp-2">
            ${mainTitle}
          </h3>
          ${subTitle ? `<div class="text-[10px] text-zinc-400 italic line-clamp-1 mt-0.5 font-serif">${subTitle}</div>` : ''}
        </div>
      </div>
      ${m.placeName ? `<div class="text-[11px] text-zinc-400 mt-2 font-medium flex items-center gap-1">📍 ${m.placeName}</div>` : ''}
      ${m.dropSourceRu || m.dropSource ? `
        <div class="mt-1.5 text-[11px] text-amber-200/90 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-800/30">
          ⚔️ ${m.dropSourceRu || m.dropSource}
        </div>` : ''}
    `;
    container.appendChild(header);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'mt-2.5 flex flex-col gap-2';

    // 1. MapGenie Iconic Big "FOUND" Button
    const btnCollect = document.createElement('button');
    btnCollect.className = `w-full py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
      isCollected
        ? 'bg-emerald-500 text-black font-extrabold shadow-[0_0_12px_rgba(16,185,129,0.35)] hover:bg-emerald-400'
        : 'bg-[#1e2433] text-zinc-200 border border-[#2f384d] hover:bg-[#283145] hover:text-white'
    }`;
    btnCollect.innerHTML = isCollected
      ? '<span class="w-4 h-4 rounded-full bg-black text-emerald-400 flex items-center justify-center text-[10px] font-black">✓</span> НАЙДЕНО'
      : '<span class="w-4 h-4 rounded-full border border-zinc-400 flex items-center justify-center text-[10px]"></span> ОТМЕТИТЬ КАК НАЙДЕННОЕ';
    btnCollect.onclick = () => {
      callbacksRef.current.toggleCollected(m.id);
      mapInstanceRef.current?.closePopup();
    };
    actions.appendChild(btnCollect);

    // 2. Secondary action row (Route & Wishlist)
    const secondaryRow = document.createElement('div');
    secondaryRow.className = 'grid grid-cols-2 gap-1.5';

    const btnRoute = document.createElement('button');
    btnRoute.className = 'py-1 px-2 rounded-lg text-[10px] font-semibold bg-[#1a202c] text-[#f5d38a] border border-[#3b321c] hover:bg-[#232c3d] flex items-center justify-center gap-1 transition-colors cursor-pointer';
    btnRoute.innerHTML = '🧭 Маршрут';
    btnRoute.onclick = () => {
      callbacksRef.current.buildRouteToMarker(m);
      mapInstanceRef.current?.closePopup();
    };

    const btnWish = document.createElement('button');
    btnWish.className = `py-1 px-2 rounded-lg text-[10px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
      isWishlisted
        ? 'bg-amber-950/80 text-amber-300 border border-amber-600/60 hover:bg-amber-900'
        : 'bg-[#1a202c] text-zinc-400 border border-[#283042] hover:text-zinc-200 hover:bg-[#232c3d]'
    }`;
    btnWish.innerHTML = isWishlisted ? '★ В избранном' : '☆ Избранное';
    btnWish.onclick = () => {
      callbacksRef.current.toggleWishlist(m.id);
      mapInstanceRef.current?.closePopup();
    };

    secondaryRow.appendChild(btnRoute);
    secondaryRow.appendChild(btnWish);
    actions.appendChild(secondaryRow);

    container.appendChild(actions);
    return container;
  }, [itemImages]);

  // 3. High-Performance Multi-Tier Level of Detail (LOD) & Viewport Culling
  const updateVisibleMarkers = useCallback(() => {
    const map = mapInstanceRef.current;
    const markerGroup = markerGroupRef.current;
    if (!map || !markerGroup) return;

    const zoom = map.getZoom();
    // Use conservative padding so we don't render excessive offscreen markers
    const bounds = map.getBounds().pad(0.12);
    const markerScale = filter.markerScale || 1.15;

    // Filter markers according to user filter (search, active layer, categories, uncollected, wishlist)
    const allFiltered = filterMarkers(allMarkers, filter, currentProfile.collectedIds, currentProfile.wishlistIds);

    const hasActiveSearch = Boolean(filter.searchQuery && filter.searchQuery.trim().length > 0);
    const isCustomNarrowFilter = Boolean(
      filter.selectedCategories &&
      filter.selectedCategories.length > 0 &&
      filter.selectedCategories.length <= 2
    );
    // If user has a search query or specifically focused on <= 2 categories, bypass LOD
    const skipLod = hasActiveSearch || isCustomNarrowFilter;

    // Viewport bounds culling & MapGenie-grade Level of Detail (LOD) for 60fps at all zooms
    const visibleMarkers: TrackerMarker[] = [];
    for (let i = 0; i < allFiltered.length; i++) {
      const m = allFiltered[i];
      const isWishlisted = Boolean(currentProfile.wishlistIds[m.id]);

      // Level of Detail (LOD): prevent rendering thousands of micro-items when zoomed out
      if (!skipLod && !isWishlisted) {
        const cat = m.category || '';
        const type = m.type || '';
        const name = m.name || '';

        const isFlaskUpgrade =
          cat === 'upgrades' &&
          (name.includes('Seed') || name.includes('Tear') || name.includes('Scadutree') || name.includes('Revered'));

        // Tier 1: World overview (zoom < 3.2)
        // Show only Graces, Great Bosses, and Major Dungeons
        if (zoom < 3.2) {
          const isTop =
            cat === 'graces' || type === 'grace' ||
            type === 'boss-great' || type === 'boss-legendary' ||
            cat === 'dungeons';
          if (!isTop) continue;
        }
        // Tier 2: Continental / Regional view (3.2 <= zoom < 4.4)
        // Graces, ALL Bosses, Dungeons, Core Flask Upgrades (Seeds, Tears, Scadu, Revered), Map Steles, Merchants
        else if (zoom < 4.4) {
          const isRegional =
            cat === 'graces' || type === 'grace' ||
            cat === 'bosses' || type.startsWith('boss') ||
            cat === 'dungeons' || type === 'spiritspring' ||
            cat === 'merchants' ||
            (cat === 'keyItems' && (name.includes('Map:') || name.includes('Great Rune') || name.includes('Medallion'))) ||
            isFlaskUpgrade;
          if (!isRegional) continue;
        }
        // Tier 3: Zone view (4.4 <= zoom < 5.4)
        // Add Weapons, Armor, Talismans, Spells, Ashes of War, Spirit Ashes, Key Items
        // Exclude regular Smithing Stones, Gloveworts, Golden Runes, Materials, Consumables
        else if (zoom < 5.4) {
          if (cat === 'materials' || cat === 'consumables' || cat === 'other') continue;
          if (cat === 'upgrades' && !isFlaskUpgrade && !name.includes('Ancient Dragon')) continue;
        }
        // Tier 4: Detail view (zoom >= 5.4)
        // Everything visible at full fidelity!
      }

      const latLng = map.unproject([m.px, m.py], 6);

      if (!bounds.contains(latLng)) {
        continue;
      }

      visibleMarkers.push(m);
    }

    // 4. Intelligent screen-space decluttering for overlapping / close markers
    const declutteredPositions = computeDeclutteredPositions(visibleMarkers, map);

    const currentActiveMap = activeMarkersRef.current;
    const nextActiveMap = new Map<string, MountedMarkerEntry>();

    for (let i = 0; i < visibleMarkers.length; i++) {
      const m = visibleMarkers[i];
      const isCollected = Boolean(currentProfile.collectedIds[m.id]);
      const isWishlisted = Boolean(currentProfile.wishlistIds[m.id]);
      const latLng = declutteredPositions.get(m.id) || map.unproject([m.px, m.py], 6);

      const visual = resolveMarkerIconUrl(m, itemImages);
      const existing = currentActiveMap.get(m.id);

      if (existing) {
        // Reuse existing Leaflet Marker and update decluttered position smoothly
        existing.marker.setLatLng(latLng);

        if (
          existing.isCollected !== isCollected ||
          existing.isWishlisted !== isWishlisted ||
          existing.scale !== markerScale ||
          existing.iconUrl !== visual.iconUrl
        ) {
          const newIcon = createMarkerIcon(m, isCollected, isWishlisted, markerScale, itemImages);
          existing.marker.setIcon(newIcon);
          existing.marker.setPopupContent(createPopupContent(m, isCollected, isWishlisted));
          existing.isCollected = isCollected;
          existing.isWishlisted = isWishlisted;
          existing.scale = markerScale;
          existing.iconUrl = visual.iconUrl;
        }
        nextActiveMap.set(m.id, existing);
        currentActiveMap.delete(m.id);
      } else {
        // Mount new marker at decluttered position
        const icon = createMarkerIcon(m, isCollected, isWishlisted, markerScale, itemImages);
        const marker = L.marker(latLng, { icon });

        marker.bindPopup(() => createPopupContent(m, isCollected, isWishlisted), {
          minWidth: 260,
          maxWidth: 300,
          className: 'custom-er-popup',
        });

        marker.on('click', () => {
          callbacksRef.current.setSelectedMarker(m);
        });

        markerGroup.addLayer(marker);
        nextActiveMap.set(m.id, {
          marker,
          isCollected,
          isWishlisted,
          scale: markerScale,
          iconUrl: visual.iconUrl,
        });
      }
    }

    // Clean up markers that left the viewport or were collected
    currentActiveMap.forEach((entry) => {
      if (entry.marker.isPopupOpen()) {
        map.closePopup();
      }
      markerGroup.removeLayer(entry.marker);
    });

    activeMarkersRef.current = nextActiveMap;
  }, [allMarkers, itemImages, filter, currentProfile.collectedIds, currentProfile.wishlistIds, createPopupContent]);

  const updateVisibleMarkersRef = useRef(updateVisibleMarkers);
  updateVisibleMarkersRef.current = updateVisibleMarkers;

  // Immediate marker refresh whenever filter, collected markers or search changes
  useEffect(() => {
    updateVisibleMarkers();
  }, [updateVisibleMarkers]);

  // Synchronize on moveend and zoomend (smooth drag without lag!), disable follow on any user touch/drag
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    let timeoutId: number | null = null;
    const handleViewportChange = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        updateVisibleMarkersRef.current();
      }, 40);
    };

    const container = map.getContainer();
    const handleUserInteraction = () => {
      map.stop();
      setIsFollowPlayer(false);
    };

    container.addEventListener('mousedown', handleUserInteraction, { passive: true });
    container.addEventListener('touchstart', handleUserInteraction, { passive: true });
    map.on('moveend', handleViewportChange);
    map.on('zoomend', handleViewportChange);
    map.on('dragstart', handleUserInteraction);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      container.removeEventListener('mousedown', handleUserInteraction);
      container.removeEventListener('touchstart', handleUserInteraction);
      map.off('moveend', handleViewportChange);
      map.off('zoomend', handleViewportChange);
      map.off('dragstart', handleUserInteraction);
    };
  }, [setIsFollowPlayer]);

  // 4. Render Active Route
  useEffect(() => {
    const map = mapInstanceRef.current;
    const routeGroup = routeGroupRef.current;
    if (!map || !routeGroup) return;

    routeGroup.clearLayers();

    if (!activeRoute || activeRoute.waypoints.length === 0) return;

    const latLngs: L.LatLng[] = [];

    // Start Grace marker if present
    if (activeRoute.startGrace) {
      const graceLatLng = map.unproject([activeRoute.startGrace.px, activeRoute.startGrace.py], 6);
      latLngs.push(graceLatLng);

      const graceMarker = L.marker(graceLatLng, {
        icon: createWaypointIcon(0, true),
      }).bindTooltip(`Старт: ${activeRoute.startGrace.nameRu || activeRoute.startGrace.name}`, {
        permanent: false,
        direction: 'top',
      });
      routeGroup.addLayer(graceMarker);
    }

    // Waypoints
    activeRoute.waypoints.forEach((wp, idx) => {
      const wpLatLng = map.unproject([wp.px, wp.py], 6);
      latLngs.push(wpLatLng);

      const wpMarker = L.marker(wpLatLng, {
        icon: createWaypointIcon(idx + 1, false),
      }).bindTooltip(`${idx + 1}. ${wp.titleRu || wp.title}`, {
        permanent: false,
        direction: 'top',
      });
      routeGroup.addLayer(wpMarker);
    });

    if (latLngs.length > 1) {
      // Subtle gold ambient glow halo
      const haloLine = L.polyline(latLngs, {
        color: '#ffdd80',
        weight: 6,
        opacity: 0.25,
        lineCap: 'round',
        lineJoin: 'round',
      });
      routeGroup.addLayer(haloLine);

      // Main dashed line
      const mainLine = L.polyline(latLngs, {
        color: '#f5d38a',
        weight: 3,
        opacity: 0.9,
        dashArray: '10, 8',
        className: 'route-dash-animated',
      });
      routeGroup.addLayer(mainLine);

      // Fit map view to route bounds
      const routeBounds = L.latLngBounds(latLngs);
      map.flyToBounds(routeBounds, { padding: [80, 80], maxZoom: 5, duration: 0.8 });
    }
  }, [activeRoute]);

  // 5. Render Live Player Location, Directional Beacon (60fps smooth glide)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const playerGroup = playerGroupRef.current;
    if (!map || !playerGroup) return;

    if (!playerLocation) {
      playerGroup.clearLayers();
      playerMarkerRef.current = null;
      return;
    }

    // Automatically follow player across layers (e.g. from DLC to Overworld / Liurnia)
    if (isFollowPlayer && playerLocation.layer !== filter.activeLayer) {
      setFilter({ activeLayer: playerLocation.layer });
      return;
    }

    // Only render on the map if the active layer matches
    if (playerLocation.layer === filter.activeLayer) {
      const playerLatLng = map.unproject([playerLocation.px, playerLocation.py], 6);
      const charName =
        playerLocation.charName && playerLocation.charName !== 'Погасший'
          ? playerLocation.charName
          : currentProfile.name && currentProfile.name !== 'Персонаж 1 (Основной)'
          ? currentProfile.name
          : 'Погасший';
      const charLevel =
        playerLocation.charLevel && playerLocation.charLevel > 1
          ? playerLocation.charLevel
          : currentProfile.level > 1
          ? currentProfile.level
          : 1;
      const yawDeg = Math.round(playerLocation.yawDeg || 0);

      let marker = playerMarkerRef.current;

      if (!marker) {
        playerGroup.clearLayers();

        const beaconIcon = L.divIcon({
          className: 'player-beacon-icon',
          html: `
            <div style="position: relative; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; pointer-events: none;">
              <!-- Golden Ping Pulse -->
              <div style="position: absolute; inset: 0; border-radius: 9999px; border: 1.5px solid rgba(251, 191, 36, 0.7); background: rgba(245, 158, 11, 0.15); animation: ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite; pointer-events: none;"></div>
              
              <!-- Aura Halo -->
              <div style="position: absolute; width: 28px; height: 28px; border-radius: 9999px; border: 2px solid #f5d38a; background: rgba(217, 119, 6, 0.35); box-shadow: 0 0 16px rgba(245, 211, 138, 0.85); pointer-events: none;"></div>
              
              <!-- Directional Pointer -->
              <div class="player-beacon-pointer" style="position: absolute; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; transform: rotate(${yawDeg}deg); transition: transform 0.1s linear; pointer-events: none;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="filter: drop-shadow(0 0 3px rgba(0,0,0,0.9));">
                  <polygon points="12,1 18,16 12,12 6,16" fill="#fff7b0" stroke="#b45309" stroke-width="1.5" />
                </svg>
              </div>

              <!-- Central Core Beacon -->
              <div style="position: relative; width: 12px; height: 12px; border-radius: 9999px; background: #ffffff; border: 2px solid #d97706; box-shadow: 0 0 10px #ffffff; pointer-events: none;"></div>

              <!-- Floating Badge Tag -->
              <div style="position: absolute; top: -30px; left: 50%; transform: translateX(-50%); white-space: nowrap; padding: 2px 8px; border-radius: 9999px; background: rgba(10, 12, 18, 0.92); border: 1px solid rgba(245, 211, 138, 0.5); box-shadow: 0 4px 12px rgba(0,0,0,0.6); display: flex; align-items: center; gap: 5px; pointer-events: none; backdrop-filter: blur(4px);">
                <span style="width: 6px; height: 6px; border-radius: 9999px; background: #34d399; box-shadow: 0 0 6px #34d399;"></span>
                <span style="font-family: Cinzel, serif; font-size: 10px; font-weight: bold; color: #fef08a;">${charName}</span>
                <span style="font-family: monospace; font-size: 9px; color: #f59e0b;">${charLevel} ур.</span>
              </div>
            </div>
          `,
          iconSize: [48, 48],
          iconAnchor: [24, 24],
        });

        marker = L.marker(playerLatLng, {
          icon: beaconIcon,
          interactive: false,
          zIndexOffset: 1000,
        });

        playerGroup.addLayer(marker);
        playerMarkerRef.current = marker;
      } else {
        // Continuous smooth 60fps update of position & heading
        marker.setLatLng(playerLatLng);
        const markerEl = marker.getElement();
        if (markerEl) {
          const pointer = markerEl.querySelector('.player-beacon-pointer') as HTMLElement | null;
          if (pointer) {
            pointer.style.transform = `rotate(${yawDeg}deg)`;
          }
        }
      }

      // Smooth camera follow without fighting the user or flickering
      if (isFollowPlayer) {
        const now = Date.now();
        const centerPt = map.latLngToContainerPoint(map.getCenter());
        const playerPt = map.latLngToContainerPoint(playerLatLng);
        const distPx = Math.hypot(centerPt.x - playerPt.x, centerPt.y - playerPt.y);

        // Pan smoothly only if player drifted outside 150px center safezone and at least 800ms passed
        if (distPx > 150 && now - lastCameraPanRef.current > 800) {
          lastCameraPanRef.current = now;
          map.panTo(playerLatLng, { animate: true, duration: 0.4 });
        }
      }
    } else {
      playerGroup.clearLayers();
      playerMarkerRef.current = null;
    }
  }, [playerLocation, filter.activeLayer, isFollowPlayer, setFilter, currentProfile.name, currentProfile.level]);

  // Keep a stable ref to latest player location for one-shot camera triggers
  const playerLocationRef = useRef(playerLocation);
  useEffect(() => {
    playerLocationRef.current = playerLocation;
  }, [playerLocation]);

  const lastHandledTriggerRef = useRef(0);

  // Focus player smoothly upon user request (runs ONLY once per user button press, NEVER on 100ms ticks!)
  useEffect(() => {
    if (!focusPlayerTrigger || focusPlayerTrigger === lastHandledTriggerRef.current) return;
    lastHandledTriggerRef.current = focusPlayerTrigger;

    const loc = playerLocationRef.current;
    const map = mapInstanceRef.current;
    if (!loc || !map) return;

    if (filter.activeLayer !== loc.layer) {
      setFilter({ activeLayer: loc.layer });
    }

    const pLatLng = map.unproject([loc.px, loc.py], 6);
    map.stop();
    map.flyTo(pLatLng, Math.max(map.getZoom(), 4.8), {
      duration: 0.5,
    });
  }, [focusPlayerTrigger, filter.activeLayer, setFilter]);

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden bg-[#06070a]">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating HUD: Live Player Tracking Control (Always visible) */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col items-end gap-1.5 pointer-events-auto">
        <div className="bg-[#0b0e14]/92 backdrop-blur-md border border-[#c8aa6e]/40 p-1.5 rounded-xl shadow-2xl flex items-center gap-1.5">
          <button
            onClick={() => {
              if (!isFollowPlayer) {
                if (playerLocation) {
                  centerOnPlayer();
                }
                setIsFollowPlayer(true);
              } else {
                setIsFollowPlayer(false);
              }
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-cinzel font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              isFollowPlayer
                ? 'bg-amber-950/80 text-amber-200 border border-amber-500/70 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                : 'bg-[#141824] text-zinc-300 border border-[#2a324b] hover:text-amber-200 hover:border-amber-500/40'
            }`}
            title="Автоматически центрировать карту на игроке при перемещении"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                playerLocation
                  ? isFollowPlayer
                    ? 'bg-amber-400 animate-ping'
                    : 'bg-emerald-400'
                  : 'bg-zinc-500'
              }`}
            />
            <span>{isFollowPlayer ? 'Слежение: ВКЛ' : 'Слежение: ВЫКЛ'}</span>
          </button>

          <button
            onClick={() => {
              if (playerLocation) {
                centerOnPlayer();
              }
            }}
            disabled={!playerLocation}
            className={`p-1.5 px-2.5 rounded-lg border text-xs flex items-center gap-1.5 font-cinzel font-medium transition-all ${
              playerLocation
                ? 'bg-[#141824] border-[#2a324b] text-[#f5d38a] hover:bg-[#1e2436] hover:border-[#f5d38a]/50 cursor-pointer shadow-sm'
                : 'bg-[#10121a]/60 border-[#1c202d] text-zinc-600 cursor-not-allowed'
            }`}
            title={playerLocation ? 'Центрировать карту на текущем положении игрока' : 'Ожидание подключения к игре'}
          >
            <span>🎯</span>
            <span className="hidden sm:inline">К игроку</span>
          </button>
        </div>

        {playerLocation && (
          <div className="text-[10px] bg-black/75 backdrop-blur-sm border border-zinc-800/80 rounded-md px-2 py-0.5 text-zinc-400 font-mono flex items-center gap-2 shadow">
            <span className="text-[#f5d38a] font-semibold">{playerLocation.charName || currentProfile.name || 'trie7'}</span>
            <span className="text-amber-400 font-mono">({(playerLocation.charLevel && playerLocation.charLevel > 1) ? playerLocation.charLevel : currentProfile.level || 85} ур.)</span>
            <span>({Math.round(playerLocation.px)}, {Math.round(playerLocation.py)})</span>
            <span className="text-zinc-500 uppercase">{playerLocation.layer}</span>
          </div>
        )}
      </div>
    </div>
  );
};
