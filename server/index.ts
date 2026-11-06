import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn, type ChildProcess } from 'child_process';
import { parseSaveFile, matchMarkersFromFlags } from '../src/services/saveParser.ts';
import staticPermFlags from '../src/data/permanentItemFlags.json';

const PORT = parseInt(process.env.PORT || '5173', 10);
const ROOT_DIR = path.resolve('.');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const TOOLS_DIR = path.join(ROOT_DIR, 'tools');

let trackerProcess: ChildProcess | null = null;
let latestMemoryState: Record<string, any> = { running: false, active: false };
let latestSaveChangeMs = Date.now();
let saveWatchersInitialized = false;
let saveDebounceTimer: NodeJS.Timeout | null = null;
let cachedMarkers: any[] | null = null;
let cachedMarkersMtime = 0;
let cachedSpoilerLog: any = null;
let cachedSpoilerLogMtime = 0;
let cachedSpoilerLogPath = '';
const watchedFolders = new Set<string>();

function getMarkersFilePath(): string {
  const pDist = path.join(DIST_DIR, 'data', 'unified-markers.json');
  if (fs.existsSync(pDist)) return pDist;
  const pPublic = path.join(ROOT_DIR, 'public', 'data', 'unified-markers.json');
  if (fs.existsSync(pPublic)) return pPublic;
  return pDist;
}

function getCachedMarkers(): any[] {
  try {
    const p = getMarkersFilePath();
    if (fs.existsSync(p)) {
      const stat = fs.statSync(p);
      if (!cachedMarkers || stat.mtimeMs > cachedMarkersMtime) {
        cachedMarkers = JSON.parse(fs.readFileSync(p, 'utf-8'));
        cachedMarkersMtime = stat.mtimeMs;
      }
    }
  } catch {}
  if (!cachedMarkers) cachedMarkers = [];
  return cachedMarkers;
}

function watchDirectory(dir: string) {
  if (!dir || watchedFolders.has(dir)) return;
  try {
    if (!fs.existsSync(dir)) return;
    const stat = fs.statSync(dir);
    const folderToWatch = stat.isDirectory() ? dir : path.dirname(dir);
    if (watchedFolders.has(folderToWatch)) return;
    fs.watch(folderToWatch, (_, filename) => {
      if (
        filename &&
        (filename.endsWith('.sl2') || filename.endsWith('.co2') || filename.endsWith('.randobak'))
      ) {
        if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
        saveDebounceTimer = setTimeout(() => {
          latestSaveChangeMs = Date.now();
        }, 200);
      }
    });
    watchedFolders.add(folderToWatch);
  } catch {}
}

const undergroundAreas = ['siofra river', 'ainsel river', 'lake of rot', 'mohgwyn', 'deeproot depths', 'nokron', 'nokstella'];
const mainAreas = [
  'limgrave', 'stormhill', 'weeping peninsula', 'liurnia', 'caelid', 'dragonbarrow',
  'altus plateau', 'mt. gelmir', 'leyndell', 'mountaintops', 'snowfield', 'farum azula',
  'haligtree', 'mohgwyn', 'siofra', 'ainsel'
];
const ignoreLocationWords = new Set([
  'under', 'golden', 'seed', 'tree', 'found', 'after', 'along', 'road', 'from',
  'near', 'beside', 'front', 'place', 'north', 'south', 'east', 'west', 'drops',
  'dropped', 'straight', 'leaning', 'right', 'left', 'corpse', 'lying', 'item'
]);

function scoreCandidate(marker: any, c: any, landmarks: any[]): number {
  const desc = (marker.description || '').toLowerCase();
  const place = (marker.placeName || '').toLowerCase();
  const cLoc = c.location.toLowerCase();
  const cArea = c.area.toLowerCase();

  let score = 0;

  // 0. Dimension / Layer consistency
  const isUndergroundCand = undergroundAreas.some((u) => cArea.includes(u));
  if (isUndergroundCand && marker.layer !== 'base-game-underground') return -100;
  if (!isUndergroundCand && marker.layer === 'base-game-underground') return -100;

  // 1. Precise stated landmark and distance matching ("Near <Landmark> (...) - <dist> away")
  const nearMatch = c.location.match(/near\s+([^(]+?)(?:\s*\([^)]*\))?\s*-\s*(\d+[,\.]\d+)\s+away/i);
  if (nearMatch) {
    const rawTarget = nearMatch[1].trim().toLowerCase();
    const expectedDist = parseFloat(nearMatch[2].replace(',', '.'));

    let bestL: any = null;
    for (const l of landmarks) {
      if (l.layer !== marker.layer) continue;
      const lName = l.name.toLowerCase();
      if (lName === rawTarget) {
        bestL = l;
        break;
      }
    }

    if (!bestL) {
      for (const l of landmarks) {
        if (l.layer !== marker.layer) continue;
        const lName = l.name.toLowerCase();
        if (rawTarget.includes(lName) || lName.includes(rawTarget)) {
          bestL = l;
          break;
        }
      }
    }

    if (bestL) {
      const actualDist = Math.hypot(bestL.px - marker.px, bestL.py - marker.py);
      const diff = Math.abs(actualDist - expectedDist);
      if (diff < 15) score += 120;
      else if (diff < 30) score += 80;
      else if (diff < 50) score += 40;
      else score -= 50; // Far away from stated landmark
    }
  }

  // 2. Open Coffin bonus / penalty
  if (cLoc.includes('open coffin') || cLoc.includes('coffin')) {
    if (desc.includes('grave') || desc.includes('coffin') || place.includes('grave') || place.includes('coffin') || desc.includes('tomb')) {
      score += 25;
    } else {
      score -= 30;
    }
  }

  // 3. Landmark mentions in c.location (e.g. Fort Haight, Gatefront, Castle Morne, Sellia, etc.)
  for (const l of landmarks) {
    if (l.layer !== marker.layer) continue;
    const lName = l.name.toLowerCase();
    if (lName.length < 5) continue;
    if (cLoc.includes(lName)) {
      const dist = Math.hypot(l.px - marker.px, l.py - marker.py);
      if (dist < 400) score += 80;
      else if (dist < 800) score += 50;
      else if (dist < 1500) score += 20;
      else score -= 40;
      if (desc.includes(lName)) score += 30;
    }
  }

  // 4. Distinctive keyword matching between c.location and marker.description / placeName
  const words = cLoc.split(/[^a-z0-9]+/).filter((w: string) => w.length >= 4 && !ignoreLocationWords.has(w));
  for (const w of words) {
    if (desc.includes(w) || place.includes(w)) {
      score += 25;
    }
  }

  // 5. Area matching
  for (const a of mainAreas) {
    if (cArea.includes(a)) {
      if (desc.includes(a) || place.includes(a)) {
        score += 30;
      } else {
        for (const other of mainAreas) {
          if (other !== a && (desc.includes(other) || place.includes(other))) {
            score -= 30;
            break;
          }
        }
      }
    }
  }

  return score;
}

function findBestCandidate(marker: any, candidates: any[], landmarks: any[], usedIds?: Set<number>) {
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) {
    if (usedIds && candidates[0].candId !== undefined) usedIds.add(candidates[0].candId);
    return candidates[0];
  }

  const scored = candidates.map((c) => ({
    candidate: c,
    score: scoreCandidate(marker, c, landmarks),
    isUsed: usedIds && c.candId !== undefined ? usedIds.has(c.candId) : false,
  }));

  // 1. Unused candidates that have a positive score matching the region/landmark
  const unusedScored = scored.filter((s) => !s.isUsed && s.score > 0);
  if (unusedScored.length > 0) {
    unusedScored.sort((a, b) => b.score - a.score);
    const chosen = unusedScored[0].candidate;
    if (usedIds && chosen.candId !== undefined) usedIds.add(chosen.candId);
    return chosen;
  }

  // 2. Fallback: candidate with highest positive score (even if used, to prefer same area over wrong map spot)
  const anyScored = scored.filter((s) => s.score > 0);
  if (anyScored.length > 0) {
    anyScored.sort((a, b) => b.score - a.score);
    const chosen = anyScored[0].candidate;
    if (usedIds && chosen.candId !== undefined) usedIds.add(chosen.candId);
    return chosen;
  }

  // 3. Unused candidate with >= 0 score (strictly exclude incompatible layers with negative scores)
  const unused = scored.filter((s) => !s.isUsed && s.score >= 0);
  if (unused.length > 0) {
    const chosen = unused[0].candidate;
    if (usedIds && chosen.candId !== undefined) usedIds.add(chosen.candId);
    return chosen;
  }

  return candidates[0];
}

function getLatestSpoilerLog(customDir?: string) {
  try {
    const candidateDirs = [
      customDir,
      path.join(process.env.USERPROFILE || '', 'Desktop', 'randomizer', 'spoiler_logs'),
      path.join(process.env.USERPROFILE || '', 'Desktop', 'spoiler_logs'),
      path.join(ROOT_DIR, 'spoiler_logs'),
    ].filter(Boolean) as string[];

    let spoilerDir = '';
    for (const dir of candidateDirs) {
      if (fs.existsSync(dir)) {
        spoilerDir = dir;
        break;
      }
    }

    if (!spoilerDir) {
      return { available: false, reason: 'directory_not_found' };
    }

    const files = fs.readdirSync(spoilerDir).filter((f) => f.endsWith('.txt'));
    if (files.length === 0) {
      return { available: false, reason: 'no_logs_found' };
    }

    let latestFile = '';
    let latestMtime = 0;
    for (const f of files) {
      const full = path.join(spoilerDir, f);
      const stat = fs.statSync(full);
      if (stat.mtimeMs > latestMtime) {
        latestMtime = stat.mtimeMs;
        latestFile = full;
      }
    }

    if (!latestFile) {
      return { available: false, reason: 'no_latest_file' };
    }

    if (cachedSpoilerLog && cachedSpoilerLogPath === latestFile && latestMtime <= cachedSpoilerLogMtime) {
      return cachedSpoilerLog;
    }

    const content = fs.readFileSync(latestFile, 'utf-8');
    const spoilersIndex = content.indexOf('-- Spoilers:');
    const endSpoilersIndex = content.indexOf('-- End of item spoilers', spoilersIndex);
    if (spoilersIndex === -1 || endSpoilersIndex === -1) {
      return { available: false, reason: 'spoilers_section_missing', filename: path.basename(latestFile) };
    }

    const firstLine = content.substring(0, 500);
    const seedMatch = firstLine.match(/seed:(\d+)/i);
    const seed = seedMatch ? seedMatch[1] : '';

    const spoilerText = content.substring(spoilersIndex + 12, endSpoilersIndex);
    const lines = spoilerText.split('\n');
    const regex = /^(.+?)\s+in\s+([^:]+):\s+(.+?)\.\s+Replaces\s+(.+?)\.(?:\s*\(cost:\s*(\d+)\))?/i;

    const byVanilla = new Map<string, any[]>();
    let candCounter = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const m = line.match(regex);
      if (m) {
        let cost: number | null = null;
        if (i + 1 < lines.length && lines[i + 1].trim().startsWith('(cost:')) {
          const cm = lines[i + 1].trim().match(/\(cost:\s*(\d+)\)/);
          if (cm) cost = parseInt(cm[1], 10);
        }
        const vanillaClean = m[4].trim().replace(/\s*\d+x$/, '').toLowerCase();
        if (!byVanilla.has(vanillaClean)) byVanilla.set(vanillaClean, []);
        byVanilla.get(vanillaClean)!.push({
          candId: ++candCounter,
          randomized: m[1].trim(),
          area: m[2].trim(),
          location: m[3].trim(),
          vanilla: m[4].trim(),
          cost,
        });
      }
    }

    const markers = getCachedMarkers();
    const landmarks = markers.filter((m: any) => m.type === 'grace' || m.type === 'poi');
    const usedCandidateIds = new Set<number>();
    const replacementsByMarkerId: Record<
      string,
      {
        randomized: string;
        vanilla: string;
        cost?: number | null;
        area: string;
        allRandomized?: string[];
      }
    > = {};

    for (const marker of markers) {
      if (marker.type === 'grace' || marker.type === 'poi' || marker.type === 'portal') continue;

      // Check direct match or multi-part match if name contains '+'
      const nameClean = marker.name.trim().replace(/\s*\d+x$/, '').toLowerCase();
      const candidateGroups: any[][] = [];
      const directCandidates = byVanilla.get(nameClean);
      if (directCandidates && directCandidates.length > 0) {
        candidateGroups.push(directCandidates);
      } else if (marker.name.includes('+')) {
        const parts = marker.name.split(/\s+\+\s+/);
        if (parts.length > 1) {
          for (const p of parts) {
            const pClean = p.trim().replace(/\s*\d+x$/, '').toLowerCase();
            const cand = byVanilla.get(pClean);
            if (cand && cand.length > 0) {
              candidateGroups.push(cand);
            }
          }
        }
      }

      if (candidateGroups.length === 0) continue;

      const chosenItems: any[] = [];
      for (const candidates of candidateGroups) {
        const best = findBestCandidate(marker, candidates, landmarks, usedCandidateIds);
        if (best) chosenItems.push(best);
      }

      if (chosenItems.length === 0) continue;

      replacementsByMarkerId[marker.id] = {
        randomized: chosenItems.map((ci) => ci.randomized).join(' + '),
        vanilla: chosenItems.map((ci) => ci.vanilla).join(' + '),
        cost: chosenItems[0].cost,
        area: chosenItems[0].area,
        allRandomized: chosenItems.map((ci) => ci.randomized),
      };
    }

    const enemyRegex = /^Replacing\s+(.+?)\s+\(#(\d+)\)\s+in\s+([^:]+):\s+(.+?)\s+\(#(\d+)\)/mg;
    const enemyReplacementsByOrigId = new Map<number, any>();
    const enemyReplacementsList: any[] = [];
    let emMatch;
    while ((emMatch = enemyRegex.exec(content)) !== null) {
      const origName = emMatch[1].trim();
      const origId = parseInt(emMatch[2], 10);
      const repName = emMatch[4].trim();
      const repId = parseInt(emMatch[5], 10);
      const tilePrefix = Math.floor(origId / 10000);
      const repFlag = tilePrefix * 10000 + (repId % 10000);
      const entry = { origName, origId, repName, repId, repFlag, tilePrefix };
      enemyReplacementsByOrigId.set(origId, entry);
      enemyReplacementsList.push(entry);
    }

    cachedSpoilerLog = {
      available: true,
      filename: path.basename(latestFile),
      fullPath: latestFile,
      seed,
      mtime: latestMtime,
      count: Object.keys(replacementsByMarkerId).length,
      replacements: replacementsByMarkerId,
      enemyReplacementsByOrigId,
      enemyReplacementsList,
    };
    cachedSpoilerLogMtime = latestMtime;
    cachedSpoilerLogPath = latestFile;

    return cachedSpoilerLog;
  } catch (err: any) {
    return { available: false, error: err.message };
  }
}

let cachedEnrichedMarkers: any[] | null = null;
let cachedEnrichedMarkersKey = '';
let cachedEnrichedMarkersJson: string | null = null;

function getEnrichedMarkers(): any[] {
  const baseMarkers = getCachedMarkers();
  const spoiler = getLatestSpoilerLog();
  const spoilerMtime = spoiler.available ? spoiler.mtime : 0;
  const currentKey = `${cachedMarkersMtime}:${spoilerMtime}`;
  if (cachedEnrichedMarkers && cachedEnrichedMarkersKey === currentKey) {
    return cachedEnrichedMarkers;
  }

  if (!spoiler.available || !spoiler.replacements) {
    cachedEnrichedMarkers = baseMarkers;
    cachedEnrichedMarkersKey = currentKey;
    cachedEnrichedMarkersJson = JSON.stringify(baseMarkers);
    return cachedEnrichedMarkers;
  }

  // Build item name -> permanent flags mapping
  const itemNameToFlags = new Map<string, number[]>();
  function addFlag(name: string, flag: number) {
    if (!name || flag <= 0) return;
    const clean = name.toLowerCase().trim().replace(/\s*\d+x$/, '').trim();
    if (!itemNameToFlags.has(clean)) itemNameToFlags.set(clean, []);
    if (!itemNameToFlags.get(clean)!.includes(flag)) itemNameToFlags.get(clean)!.push(flag);
  }

  // 1. Static permanent flags catalog (376 items: all cookbooks, pots, whetblades, bottles, etc.)
  for (const [name, flags] of Object.entries(staticPermFlags)) {
    for (const f of flags as number[]) {
      addFlag(name, f);
    }
  }

  // 2. Base markers flags
  for (const m of baseMarkers) {
    if (m.flagId && m.flagId >= 60000 && m.flagId < 70000) {
      addFlag(m.name, m.flagId);
      if (m.name.includes('+')) {
        for (const part of m.name.split('+')) addFlag(part, m.flagId);
      }
    }
    if (m.altFlags) {
      for (const af of m.altFlags) {
        if (af >= 60000 && af < 70000) {
          addFlag(m.name, af);
          if (m.name.includes('+')) {
            for (const part of m.name.split('+')) addFlag(part, af);
          }
        }
      }
    }
  }

  const enemyByOrigId = spoiler.enemyReplacementsByOrigId || new Map();
  const enemyList = spoiler.enemyReplacementsList || [];

  const enriched = baseMarkers.map((marker: any) => {
    let copy: any = null;

    const rep = spoiler.replacements ? spoiler.replacements[marker.id] : null;
    if (rep) {
      const randomizedList: string[] =
        rep.allRandomized && rep.allRandomized.length > 0 ? rep.allRandomized : [rep.randomized];

      for (const randName of randomizedList) {
        const rClean = randName.toLowerCase().replace(/\s*\d+x$/, '').trim();
        const flagsForRandomized = itemNameToFlags.get(rClean);
        if (flagsForRandomized && flagsForRandomized.length > 0) {
          if (!copy) {
            copy = { ...marker, altFlags: [...(marker.altFlags || [])] };
          }
          for (const f of flagsForRandomized) {
            if (!copy.altFlags.includes(f)) copy.altFlags.push(f);
          }
        }
      }
    }

    if (marker.dropSource || (marker.type && marker.type.startsWith('boss')) || marker.category === 'bosses') {
      const tilePrefix = marker.flagId ? Math.floor(marker.flagId / 10000) : null;
      let emMatch = marker.flagId ? enemyByOrigId.get(marker.flagId) : null;
      if (!emMatch && marker.dropSource && tilePrefix) {
        const dClean = marker.dropSource.toLowerCase().replace(/['"’()]/g, '').trim();
        for (const entry of enemyList) {
          if (entry.tilePrefix === tilePrefix) {
            const eClean = entry.origName.toLowerCase().replace(/['"’()]/g, '').trim();
            if (eClean.includes(dClean) || dClean.includes(eClean)) {
              emMatch = entry;
              break;
            }
          }
        }
      }

      if (emMatch) {
        if (!copy) {
          copy = { ...marker, altFlags: [...(marker.altFlags || [])] };
        }
        if (!copy.altFlags.includes(emMatch.repFlag)) copy.altFlags.push(emMatch.repFlag);
        if (!copy.altFlags.includes(emMatch.origId)) copy.altFlags.push(emMatch.origId);
      }
    }

    if (rep) {
      return {
        ...(copy || marker),
        randomized: rep.randomized,
        vanilla: rep.vanilla,
        spoilerArea: rep.area,
        allRandomized: rep.allRandomized,
      };
    }
    return copy || marker;
  });

  cachedEnrichedMarkers = enriched;
  cachedEnrichedMarkersKey = currentKey;
  cachedEnrichedMarkersJson = JSON.stringify(enriched);
  return cachedEnrichedMarkers;
}

function getQuickSlots(filePath: string) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const buf = fs.readFileSync(filePath);
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const slots = parseSaveFile(arrayBuffer, []);
    return slots.map((s: any) => ({
      index: s.index,
      name: s.name,
      level: s.level,
      playtimeFormatted: s.playtimeFormatted,
      bossesDefeatedCount: s.bossesDefeatedCount,
      gracesUnlockedCount: s.gracesUnlockedCount,
    }));
  } catch {
    return [];
  }
}

function initSaveWatchers() {
  if (saveWatchersInitialized) return;
  try {
    const appData = process.env.APPDATA;
    if (!appData) return;
    const erDir = path.join(appData, 'EldenRing');
    if (!fs.existsSync(erDir)) return;

    const subdirs = fs.readdirSync(erDir, { withFileTypes: true });
    for (const d of subdirs) {
      if (d.isDirectory() && /^\d+$/.test(d.name)) {
        const fullDir = path.join(erDir, d.name);
        watchDirectory(fullDir);
      }
    }
    saveWatchersInitialized = true;
  } catch {}
}

function ensureTrackerProcess() {
  const trackerExe = path.join(TOOLS_DIR, 'er_tracker.exe');
  if (trackerProcess && !trackerProcess.killed) return;
  if (!fs.existsSync(trackerExe)) return;

  try {
    trackerProcess = spawn(trackerExe, [], {
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });

    let stdoutBuffer = '';
    trackerProcess.stdout?.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString('utf-8');
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            latestMemoryState = JSON.parse(trimmed);
          } catch {}
        }
      }
    });

    trackerProcess.on('exit', () => {
      trackerProcess = null;
    });
  } catch (err) {
    console.error('Failed to spawn er_tracker.exe:', err);
  }
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function serveStatic(reqPath: string, res: http.ServerResponse): boolean {
  let filePath = path.join(DIST_DIR, reqPath === '/' ? 'index.html' : reqPath);
  
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Cache static assets with hash in name
    if (reqPath.startsWith('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    return true;
  }
  return false;
}

let cachedSyncResult: any = null;
let cachedSyncKey = '';

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // API Routes
  if (url.pathname === '/api/player/live-memory') {
    res.setHeader('Content-Type', 'application/json');
    ensureTrackerProcess();
    initSaveWatchers();
    res.end(JSON.stringify({ ...latestMemoryState, saveChangeMs: latestSaveChangeMs }));
    return;
  }

  if (url.pathname === '/api/save/detect') {
    res.setHeader('Content-Type', 'application/json');
    try {
      const appData = process.env.APPDATA;
      if (!appData) {
        res.end(JSON.stringify({ saves: [] }));
        return;
      }
      const erDir = path.join(appData, 'EldenRing');
      if (!fs.existsSync(erDir)) {
        res.end(JSON.stringify({ saves: [] }));
        return;
      }

      const saves: Array<{
        steamId: string;
        folderPath: string;
        fileName: string;
        path: string;
        size: number;
        mtime: number;
        slots: any[];
        isRandomizer?: boolean;
      }> = [];

      const subdirs = fs.readdirSync(erDir, { withFileTypes: true });
      for (const d of subdirs) {
        if (d.isDirectory() && /^\d+$/.test(d.name)) {
          const fullDir = path.join(erDir, d.name);
          watchDirectory(fullDir);
          const files = fs.readdirSync(fullDir);
          const hasRandobak = files.some((x) => x.endsWith('.randobak'));
          for (const f of files) {
            if (f.endsWith('.sl2') || f.endsWith('.co2') || f.endsWith('.randobak')) {
              const filePath = path.join(fullDir, f);
              const stat = fs.statSync(filePath);
              const slots = getQuickSlots(filePath);
              saves.push({
                steamId: d.name,
                folderPath: fullDir,
                fileName: f,
                path: filePath,
                size: stat.size,
                mtime: stat.mtimeMs,
                slots,
                isRandomizer: hasRandobak || f.endsWith('.randobak'),
              });
            }
          }
        }
      }
      saves.sort((a, b) => b.mtime - a.mtime);
      res.end(JSON.stringify({ saves }));
    } catch (e: any) {
      res.end(JSON.stringify({ error: e.message, saves: [] }));
    }
    return;
  }

  if (url.pathname === '/api/save/scan-folder') {
    res.setHeader('Content-Type', 'application/json');
    const rawPath = url.searchParams.get('path');
    if (!rawPath) {
      res.end(JSON.stringify({ error: 'Папка не указана', saves: [] }));
      return;
    }
    let resolved = rawPath.trim();
    if (resolved.startsWith('%APPDATA%') && process.env.APPDATA) {
      resolved = path.join(process.env.APPDATA, resolved.slice(9));
    }
    if (!fs.existsSync(resolved)) {
      res.end(JSON.stringify({ error: 'Папка не найдена: ' + resolved, saves: [] }));
      return;
    }
    try {
      const stat = fs.statSync(resolved);
      const dir = stat.isDirectory() ? resolved : path.dirname(resolved);
      watchDirectory(dir);

      const saves: any[] = [];
      const files = fs.readdirSync(dir);
      const hasRandobak = files.some((x) => x.endsWith('.randobak'));
      for (const f of files) {
        if (f.endsWith('.sl2') || f.endsWith('.co2') || f.endsWith('.randobak')) {
          const filePath = path.join(dir, f);
          const fstat = fs.statSync(filePath);
          const slots = getQuickSlots(filePath);
          saves.push({
            steamId: path.basename(dir),
            folderPath: dir,
            fileName: f,
            path: filePath,
            size: fstat.size,
            mtime: fstat.mtimeMs,
            slots,
            isRandomizer: hasRandobak || f.endsWith('.randobak'),
          });
        }
      }
      saves.sort((a, b) => b.mtime - a.mtime);
      res.end(JSON.stringify({ folderPath: dir, saves }));
    } catch (e: any) {
      res.end(JSON.stringify({ error: e.message, saves: [] }));
    }
    return;
  }

  if (url.pathname === '/api/save/slots') {
    res.setHeader('Content-Type', 'application/json');
    const targetPath = url.searchParams.get('path');
    if (!targetPath || !fs.existsSync(targetPath)) {
      res.end(JSON.stringify({ exists: false, slots: [] }));
      return;
    }
    try {
      watchDirectory(path.dirname(targetPath));
      const slots = getQuickSlots(targetPath);
      res.end(JSON.stringify({ exists: true, path: targetPath, slots }));
    } catch (e: any) {
      res.end(JSON.stringify({ exists: false, error: e.message, slots: [] }));
    }
    return;
  }

  if (url.pathname === '/api/save/sync-state') {
    res.setHeader('Content-Type', 'application/json');
    const targetPath = url.searchParams.get('path');
    const targetSlot = parseInt(url.searchParams.get('slot') || '0', 10);
    const isRandomizer = url.searchParams.get('randomizer') === 'true';
    const clientLastMtime = Number(url.searchParams.get('lastMtime') || 0);
    const clientLastCount = Number(url.searchParams.get('lastCount') || -1);

    if (!targetPath || !fs.existsSync(targetPath)) {
      res.end(JSON.stringify({ exists: false }));
      return;
    }
    try {
      watchDirectory(path.dirname(targetPath));
      const stat = fs.statSync(targetPath);
      const liveFlagsPath = path.join(TOOLS_DIR, 'live_flags.bin');
      let liveFlagsMtime = 0;
      if (fs.existsSync(liveFlagsPath)) {
        try {
          liveFlagsMtime = fs.statSync(liveFlagsPath).mtimeMs;
        } catch {}
      }

      const currentKey = `${targetPath}:${stat.mtimeMs}:${targetSlot}:${isRandomizer}:${liveFlagsMtime}`;
      if (cachedSyncResult && cachedSyncKey === currentKey) {
        if (clientLastMtime === stat.mtimeMs && clientLastCount === cachedSyncResult.matchedCount) {
          res.end(JSON.stringify({ exists: true, modified: false, mtime: stat.mtimeMs, matchedCount: cachedSyncResult.matchedCount }));
          return;
        }
        res.end(JSON.stringify(cachedSyncResult));
        return;
      }

      const buf = fs.readFileSync(targetPath);
      const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      const markers = isRandomizer ? getEnrichedMarkers() : getCachedMarkers();
      const slots = parseSaveFile(arrayBuffer, markers, targetSlot >= 0 ? targetSlot : undefined, {
        isRandomizer,
      });
      let slot = slots.find((s: any) => s.index === targetSlot);
      if (!slot && slots.length > 0) {
        slot = slots[0];
      }

      let finalMatchedIds: string[] = slot && slot.matchedMarkerIds ? [...slot.matchedMarkerIds] : [];

      if (liveFlagsMtime > 0) {
        try {
          const liveBytes = fs.readFileSync(liveFlagsPath);
          if (liveBytes.length === 1833375) {
            const liveResult = matchMarkersFromFlags(
              new Uint8Array(liveBytes.buffer, liveBytes.byteOffset, liveBytes.byteLength),
              markers,
              isRandomizer
            );
            const merged = new Set(finalMatchedIds);
            for (const id of liveResult.matchedMarkerIds) {
              merged.add(id);
            }
            finalMatchedIds = Array.from(merged);
          }
        } catch {}
      }

      const responsePayload = {
        exists: true,
        modified: true,
        mtime: stat.mtimeMs,
        slotIndex: slot ? slot.index : targetSlot,
        name: slot ? slot.name : 'Погасший',
        level: slot ? slot.level : 1,
        matchedCount: finalMatchedIds.length,
        matchedMarkerIds: finalMatchedIds,
        playerLocation: slot ? slot.playerLocation : null,
        liveFlagsActive: liveFlagsMtime > 0,
      };

      cachedSyncKey = currentKey;
      cachedSyncResult = responsePayload;

      res.end(JSON.stringify(responsePayload));
    } catch (e: any) {
      res.end(JSON.stringify({ exists: false, error: e.message }));
    }
    return;
  }

  if (url.pathname === '/api/randomizer/spoiler-log') {
    res.setHeader('Content-Type', 'application/json');
    const customDir = url.searchParams.get('dir') || undefined;
    const data = getLatestSpoilerLog(customDir);
    res.end(JSON.stringify(data));
    return;
  }

  if (url.pathname === '/api/save/poll') {
    res.setHeader('Content-Type', 'application/json');
    const targetPath = url.searchParams.get('path');
    const since = Number(url.searchParams.get('since') || 0);
    if (!targetPath || !fs.existsSync(targetPath)) {
      res.end(JSON.stringify({ exists: false }));
      return;
    }
    try {
      const stat = fs.statSync(targetPath);
      const modified = stat.mtimeMs > since;
      res.end(JSON.stringify({ exists: true, modified, mtime: stat.mtimeMs, size: stat.size }));
    } catch {
      res.end(JSON.stringify({ exists: false }));
    }
    return;
  }

  if (url.pathname === '/api/save/read') {
    const targetPath = url.searchParams.get('path');
    if (!targetPath || !fs.existsSync(targetPath)) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    try {
      watchDirectory(path.dirname(targetPath));
      const buf = fs.readFileSync(targetPath);
      const stat = fs.statSync(targetPath);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('X-Save-Mtime', String(stat.mtimeMs));
      res.setHeader('X-Save-Size', String(stat.size));
      res.end(buf);
    } catch (e: any) {
      res.statusCode = 500;
      res.end(e.message);
    }
    return;
  }

  if (url.pathname === '/data/unified-markers.json') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    getEnrichedMarkers();
    res.end(cachedEnrichedMarkersJson);
    return;
  }

  // Static files fallback
  const handled = serveStatic(url.pathname, res);
  if (!handled) {
    res.statusCode = 404;
    res.end('Not found');
  }
});

function cleanup() {
  if (trackerProcess) {
    try {
      trackerProcess.kill();
    } catch {}
    trackerProcess = null;
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

ensureTrackerProcess();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER_READY] Elden Ring Tracker running on http://localhost:${PORT}`);
});
