import type { TrackerMarker, RouteWaypoint } from '../types';

/**
 * Route Planner & Optimizer Service
 * Provides single-point grace navigation and multi-stop TSP route optimization
 */

/** Solves TSP (Traveling Salesperson) using Nearest Neighbor + 2-Opt Heuristic */
export function optimizeRouteOrder(
  startGrace: TrackerMarker | null,
  targetMarkers: TrackerMarker[]
): RouteWaypoint[] {
  if (targetMarkers.length === 0) return [];
  if (targetMarkers.length === 1) {
    const t = targetMarkers[0];
    return [{
      id: `wp-${t.id}`,
      markerId: t.id,
      title: t.name,
      titleRu: t.nameRu,
      px: t.px,
      py: t.py,
      layer: t.layer,
      type: t.type,
      order: 1,
      completed: false
    }];
  }

  const points = [...targetMarkers];
  const ordered: TrackerMarker[] = [];
  
  let currentPos = startGrace 
    ? { px: startGrace.px, py: startGrace.py }
    : { px: points[0].px, py: points[0].py };

  if (!startGrace) {
    ordered.push(points.shift()!);
    currentPos = { px: ordered[0].px, py: ordered[0].py };
  }

  while (points.length > 0) {
    let nearestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const dx = p.px - currentPos.px;
      const dy = p.py - currentPos.py;
      const dist = dx * dx + dy * dy;
      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = i;
      }
    }

    const nextPoint = points.splice(nearestIdx, 1)[0];
    ordered.push(nextPoint);
    currentPos = { px: nextPoint.px, py: nextPoint.py };
  }

  if (ordered.length > 3 && ordered.length <= 40) {
    let improved = true;
    let iterations = 0;
    while (improved && iterations < 50) {
      improved = false;
      iterations++;
      for (let i = 0; i < ordered.length - 1; i++) {
        for (let j = i + 1; j < ordered.length; j++) {
          const d1 = distance(ordered[i], ordered[i + 1]) + (j + 1 < ordered.length ? distance(ordered[j], ordered[j + 1]) : 0);
          const d2 = distance(ordered[i], ordered[j]) + (j + 1 < ordered.length ? distance(ordered[i + 1], ordered[j + 1]) : 0);
          if (d2 < d1 - 0.1) {
            reverseSubarray(ordered, i + 1, j);
            improved = true;
          }
        }
      }
    }
  }

  return ordered.map((m, idx) => ({
    id: `wp-${m.id}`,
    markerId: m.id,
    title: m.name,
    titleRu: m.nameRu,
    px: m.px,
    py: m.py,
    layer: m.layer,
    type: m.type,
    order: idx + 1,
    completed: false
  }));
}

export function calculateTotalDistance(
  startGrace: TrackerMarker | null,
  waypoints: RouteWaypoint[]
): { distancePx: number; distanceMeters: number; walkingMinutes: number } {
  if (waypoints.length === 0) {
    return { distancePx: 0, distanceMeters: 0, walkingMinutes: 0 };
  }

  let totalPx = 0;
  let prevPos = startGrace ? { px: startGrace.px, py: startGrace.py } : null;

  for (const wp of waypoints) {
    if (prevPos) {
      const dx = wp.px - prevPos.px;
      const dy = wp.py - prevPos.py;
      totalPx += Math.sqrt(dx * dx + dy * dy);
    }
    prevPos = { px: wp.px, py: wp.py };
  }

  const distanceMeters = Math.round(totalPx);
  const walkingMinutes = Math.max(1, Math.round(distanceMeters / 600));

  return {
    distancePx: Math.round(totalPx),
    distanceMeters,
    walkingMinutes
  };
}

function distance(a: TrackerMarker, b: TrackerMarker): number {
  const dx = a.px - b.px;
  const dy = a.py - b.py;
  return Math.sqrt(dx * dx + dy * dy);
}

function reverseSubarray<T>(arr: T[], start: number, end: number) {
  while (start < end) {
    const temp = arr[start];
    arr[start] = arr[end];
    arr[end] = temp;
    start++;
    end--;
  }
}
