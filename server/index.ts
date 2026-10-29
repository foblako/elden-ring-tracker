import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn, type ChildProcess } from 'child_process';
import { parseSaveFile, matchMarkersFromFlags } from '../src/services/saveParser.ts';

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
          randomized: m[1].trim(),
          area: m[2].trim(),
          location: m[3].trim(),
          vanilla: m[4].trim(),
          cost,
        });
      }
    }

    const markers = getCachedMarkers();
    const replacementsByMarkerId: Record<
      string,
      { randomized: string; vanilla: string; cost?: number | null; area: string }
    > = {};

    for (const marker of markers) {
      if (marker.type === 'grace' || marker.type === 'poi' || marker.type === 'portal') continue;
      const nameClean = marker.name.trim().replace(/\s*\d+x$/, '').toLowerCase();
      const candidates = byVanilla.get(nameClean);
      if (!candidates || candidates.length === 0) continue;

      let best = candidates[0];
      if (candidates.length > 1) {
        const markerArea = (marker.placeName || marker.layer || '').toLowerCase();
        for (const c of candidates) {
          if (markerArea && c.area.toLowerCase().includes(markerArea)) {
            best = c;
            break;
          }
        }
      }
      replacementsByMarkerId[marker.id] = {
        randomized: best.randomized,
        vanilla: best.vanilla,
        cost: best.cost,
        area: best.area,
      };
    }

    cachedSpoilerLog = {
      available: true,
      filename: path.basename(latestFile),
      fullPath: latestFile,
      seed,
      mtime: latestMtime,
      count: Object.keys(replacementsByMarkerId).length,
      replacements: replacementsByMarkerId,
    };
    cachedSpoilerLogMtime = latestMtime;
    cachedSpoilerLogPath = latestFile;

    return cachedSpoilerLog;
  } catch (err: any) {
    return { available: false, error: err.message };
  }
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
      const markers = getCachedMarkers();
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
process.on('exit', cleanup);

ensureTrackerProcess();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER_READY] Elden Ring Tracker running on http://localhost:${PORT}`);
});
